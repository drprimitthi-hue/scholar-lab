import { describe, expect, it } from "vitest";
import { cloudinarySignature, privateDownloadUrl, signedUploadFields } from "@/lib/server/cloudinarySign";

describe("Cloudinary signing", () => {
  it("matches Cloudinary's documented example", () => {
    // From Cloudinary's "Generating authentication signatures" documentation.
    expect(cloudinarySignature({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 }, "abcd")).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
  it("ignores api_key, file, resource_type, cloud_name and empty values", () => {
    const a = cloudinarySignature({ public_id: "x", timestamp: 1 }, "s");
    expect(cloudinarySignature({ public_id: "x", timestamp: 1, api_key: "k", file: "f", resource_type: "raw", cloud_name: "c", eager: "" }, "s")).toBe(a);
  });
  const cfg = { cloud: "demo", key: "123", secret: "sec" };
  it("upload fields lock the exact path and private type", () => {
    const u = signedUploadFields(cfg, "scholars/U1/uploads/1-a.pdf", 1700000000);
    expect(u.url).toBe("https://api.cloudinary.com/v1_1/demo/raw/upload");
    expect(u.fields).toMatchObject({ public_id: "scholars/U1/uploads/1-a.pdf", type: "authenticated", overwrite: "false", api_key: "123", timestamp: "1700000000" });
    expect(u.fields.signature).toBe(cloudinarySignature({ public_id: "scholars/U1/uploads/1-a.pdf", timestamp: 1700000000, type: "authenticated", overwrite: "false" }, "sec"));
    expect(JSON.stringify(u)).not.toContain("sec\"");
  });
  it("download links expire and never contain the secret", () => {
    const url = new URL(privateDownloadUrl(cfg, "office/S/a.pdf", 1700000000, 300));
    expect(url.pathname).toBe("/v1_1/demo/raw/download");
    expect(url.searchParams.get("expires_at")).toBe("1700000300");
    expect(url.searchParams.get("type")).toBe("authenticated");
    expect(url.toString()).not.toContain("sec&");
    expect(url.searchParams.get("signature")).toBe(cloudinarySignature({ public_id: "office/S/a.pdf", timestamp: 1700000000, type: "authenticated", expires_at: 1700000300 }, "sec"));
  });
});
