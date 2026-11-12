import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | null = null;
function adminApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]!);
  // Either paste the service-account JSON as-is (FIREBASE_SERVICE_ACCOUNT_JSON) or its base64 (FIREBASE_SERVICE_ACCOUNT_BASE64).
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8") : "");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  app = initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }), projectId: sa.project_id });
  return app;
}
export const adminAuth = () => getAuth(adminApp());
export const db = () => getFirestore(adminApp());

export function audit(action: string, target: string, by: string, detail: unknown = null) {
  return db().collection("auditLog").add({ action, target, by, detail, at: Date.now() });
}
