"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, type AppCheck } from "firebase/app-check";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let appCheck: AppCheck | null = null;

export function firebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  const app = initializeApp(config);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey && typeof window !== "undefined") {
    appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  }
  return app;
}

export const auth = (): Auth => getAuth(firebaseApp());
export const fs = (): Firestore => getFirestore(firebaseApp());
export const storage = (): FirebaseStorage => getStorage(firebaseApp());

export async function appCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    return (await getToken(appCheck, false)).token;
  } catch {
    return null;
  }
}
