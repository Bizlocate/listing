import { describe, it, expect } from "vitest";
import { validateUpload, buildStoragePath, isObjectPathIn, PHOTO_MAX_BYTES, DOCUMENT_MAX_BYTES } from "./upload";

describe("validateUpload", () => {
  it("accepts jpeg/png/webp photos within the limit", () => {
    expect(validateUpload({ type: "image/jpeg", size: 1000 }, "photo")).toBeNull();
    expect(validateUpload({ type: "image/png", size: PHOTO_MAX_BYTES }, "photo")).toBeNull();
    expect(validateUpload({ type: "image/webp", size: 1 }, "photo")).toBeNull();
  });

  it("rejects non-image photos and oversize photos", () => {
    expect(validateUpload({ type: "application/pdf", size: 1000 }, "photo")).toMatch(/JPG, PNG or WebP/);
    expect(validateUpload({ type: "image/jpeg", size: PHOTO_MAX_BYTES + 1 }, "photo")).toMatch(/8 MB/);
  });

  it("accepts pdf and images for documents, rejects others and oversize", () => {
    expect(validateUpload({ type: "application/pdf", size: DOCUMENT_MAX_BYTES }, "document")).toBeNull();
    expect(validateUpload({ type: "image/png", size: 5 }, "document")).toBeNull();
    expect(validateUpload({ type: "text/plain", size: 5 }, "document")).toMatch(/PDF, JPG, PNG or WebP/);
    expect(validateUpload({ type: "application/pdf", size: DOCUMENT_MAX_BYTES + 1 }, "document")).toMatch(/10 MB/);
  });

  it("rejects empty files", () => {
    expect(validateUpload({ type: "image/jpeg", size: 0 }, "photo")).toMatch(/empty/i);
  });
});

describe("buildStoragePath", () => {
  it("joins prefix, id and a lowercased safe extension", () => {
    expect(buildStoragePath("unit-1", "Front Shop.JPG", "abc")).toBe("unit-1/abc.jpg");
    expect(buildStoragePath("unit-1", "scan.pdf", "abc")).toBe("unit-1/abc.pdf");
  });

  it("falls back to bin for missing or suspicious extensions", () => {
    expect(buildStoragePath("u", "noext", "abc")).toBe("u/abc.bin");
    expect(buildStoragePath("u", "evil.p/hp", "abc")).toBe("u/abc.bin");
    expect(buildStoragePath("u", "x.averyveryverylongextension", "abc")).toBe("u/abc.bin");
  });
});

describe("isObjectPathIn", () => {
  it("isObjectPathIn rejects traversal and foreign folders", () => {
    const f = "11111111-1111-1111-1111-111111111111", id = "22222222-2222-4222-8222-222222222222";
    expect(isObjectPathIn(f, `${f}/${id}.jpg`)).toBe(true);
    expect(isObjectPathIn(f, `${f}/%2e%2e/%2e%2e/auth/v1/logout`)).toBe(false);
    expect(isObjectPathIn(f, `${f}/../x/${id}.jpg`)).toBe(false);
    expect(isObjectPathIn(f, `33333333-3333-3333-3333-333333333333/${id}.jpg`)).toBe(false);
    expect(isObjectPathIn("not-a-uuid", "not-a-uuid/x.jpg")).toBe(false);
    const upper = "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA";
    expect(isObjectPathIn(upper, `${upper}/${id}.jpg`)).toBe(false);
  });
});
