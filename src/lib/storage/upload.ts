export type UploadKind = "photo" | "document";

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_TYPES = ["application/pdf", ...IMAGE_TYPES];

export function validateUpload(file: { type: string; size: number }, kind: UploadKind): string | null {
  if (file.size === 0) return "That file is empty.";
  if (kind === "photo") {
    if (!IMAGE_TYPES.includes(file.type)) return "Photos must be JPG, PNG or WebP.";
    if (file.size > PHOTO_MAX_BYTES) return "Photo is too large (max 8 MB).";
    return null;
  }
  if (!DOCUMENT_TYPES.includes(file.type)) return "Documents must be PDF, JPG, PNG or WebP.";
  if (file.size > DOCUMENT_MAX_BYTES) return "Document is too large (max 10 MB).";
  return null;
}

export function buildStoragePath(prefix: string, filename: string, id: string): string {
  const match = /\.([a-zA-Z0-9]{1,5})$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : "bin";
  return `${prefix}/${id}.${ext}`;
}
