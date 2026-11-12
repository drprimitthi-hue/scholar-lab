/**
 * One-time setup for a new deployment. Run locally (never on Vercel):
 *
 *   FIREBASE_SERVICE_ACCOUNT_BASE64=... npm run bootstrap -- --email you@example.com --name "Dr. Your Name"
 *
 * It (1) turns on authenticator-app 2FA, a strong password policy and email-enumeration protection,
 * (2) creates the supervisor account with a temporary password, and (3) writes default settings/templates.
 * Safe to re-run: existing data is not overwritten.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from "../src/lib/domain/defaults";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.toLowerCase();
  const name = arg("name");
  if (!email || !name) throw new Error('Usage: npm run bootstrap -- --email you@example.com --name "Your Name"');
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_BASE64");
  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
  const auth = getAuth();
  const db = getFirestore();

  console.log("1/3 Security configuration…");
  try {
    await auth.projectConfigManager().updateProjectConfig({
      multiFactorConfig: { state: "ENABLED", providerConfigs: [{ state: "ENABLED", totpProviderConfig: { adjacentIntervals: 5 } }] },
      passwordPolicyConfig: {
        enforcementState: "ENFORCE",
        forceUpgradeOnSignin: true,
        constraints: { requireUppercase: true, requireLowercase: true, requireNumeric: true, minLength: 10, maxLength: 64 },
      },
      emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
    });
    console.log("   ✓ 2FA (authenticator app), password policy, email-enumeration protection enabled");
  } catch (e) {
    console.error("   ✗ Could not update Authentication settings. Upgrade to 'Firebase Authentication with Identity Platform' in the Firebase console (Authentication → Settings), then re-run.");
    throw e;
  }

  console.log("2/3 Supervisor account…");
  let uid: string;
  let temp: string | null = null;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    console.log("   • account already exists; ensuring supervisor role");
  } catch {
    temp = randomBytes(9).toString("base64url") + "Aa9";
    uid = (await auth.createUser({ email, password: temp, displayName: name, emailVerified: true })).uid;
  }
  await auth.setCustomUserClaims(uid, { role: "supervisor", active: true });
  const userRef = db.doc(`users/${uid}`);
  if (!(await userRef.get()).exists)
    await userRef.set({ uid, email, name, role: "supervisor", status: "active", mustChangePassword: true, createdAt: Date.now() });

  console.log("3/3 Default settings and templates…");
  const settingsRef = db.doc("settings/lab");
  if (!(await settingsRef.get()).exists) {
    const settings = { ...DEFAULT_SETTINGS, supervisorName: name };
    await settingsRef.set(settings);
    await db.doc("publicSite/info").set({
      labName: settings.labName, institution: settings.institution, department: settings.department,
      supervisorName: settings.supervisorName, tagline: settings.tagline, accent: settings.accent,
    });
  }
  for (const t of DEFAULT_TEMPLATES) {
    const ref = db.doc(`milestoneTemplates/${t.programmeId}`);
    if (!(await ref.get()).exists) await ref.set(t);
  }
  await db.collection("auditLog").add({ actorUid: "system", actorRole: "system", action: "deployment.bootstrapped", targetType: "user", targetId: uid, before: null, after: { email }, at: Date.now() });

  console.log("\nDone.");
  if (temp) console.log(`Sign in at /login with ${email} and temporary password: ${temp}\nYou will be asked to change it and set up your authenticator app.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
