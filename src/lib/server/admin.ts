import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAppCheck } from "firebase-admin/app-check";

let app: App | null = null;

function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  // Either paste the service-account JSON as-is (FIREBASE_SERVICE_ACCOUNT_JSON) or its base64 (FIREBASE_SERVICE_ACCOUNT_BASE64).
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8") : "");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  const sa = JSON.parse(raw) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  app = initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
    projectId: sa.project_id,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  return app;
}

export const adminAuth = () => getAuth(adminApp());
export const projectId = () => adminApp().options.projectId as string;
/** OAuth access token of the service account, for Google management APIs. */
export async function accessToken(): Promise<string> {
  const cred = adminApp().options.credential;
  if (!cred) throw new Error("No credential");
  return (await cred.getAccessToken()).access_token;
}
export const db = () => getFirestore(adminApp());
export const bucket = () => getStorage(adminApp()).bucket();
export const appCheck = () => getAppCheck(adminApp());
