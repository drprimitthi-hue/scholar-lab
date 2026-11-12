// Cloudinary request signing (no network, no server-only import) so it can be unit-tested.
import { createHash } from "node:crypto";

/** Cloudinary signature: sort params, join "k=v" with "&", append the API secret, SHA-1 hex.
 *  `file`, `cloud_name`, `resource_type` and `api_key` are never signed. Empty values are left out. */
export function cloudinarySignature(params: Record<string, string | number | boolean | undefined>, apiSecret: string): string {
  const skip = new Set(["file", "cloud_name", "resource_type", "api_key", "signature"]);
  const str = Object.keys(params)
    .filter((k) => !skip.has(k) && params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(str + apiSecret).digest("hex");
}

export interface CloudinaryConfig { cloud: string; key: string; secret: string }

/** Fields the browser posts to Cloudinary for one signed, private upload to an exact path. */
export function signedUploadFields(cfg: CloudinaryConfig, publicId: string, nowSec: number) {
  const params = { public_id: publicId, timestamp: nowSec, type: "authenticated", overwrite: "false" };
  return {
    url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloud)}/raw/upload`,
    fields: { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: cfg.key, signature: cloudinarySignature(params, cfg.secret) },
  };
}

/** A time-limited link to a private (authenticated) raw file, like Cloudinary's private_download_url. */
export function privateDownloadUrl(cfg: CloudinaryConfig, publicId: string, nowSec: number, expiresInSec: number, attachment = false): string {
  const params: Record<string, string | number | boolean> = { public_id: publicId, timestamp: nowSec, type: "authenticated", expires_at: nowSec + expiresInSec };
  if (attachment) params.attachment = "true";
  const sig = cloudinarySignature(params, cfg.secret);
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: cfg.key, signature: sig });
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloud)}/raw/download?${q.toString()}`;
}
