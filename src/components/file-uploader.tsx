"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateUpload, buildStoragePath, type UploadKind } from "@/lib/storage/upload";

// crypto.randomUUID is undefined on insecure (plain http) origins; getRandomValues is not.
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function FileUploader({
  bucket,
  prefix,
  kind,
  label,
  onUploaded,
}: {
  bucket: string;
  prefix: string;
  kind: UploadKind;
  label: string;
  onUploaded: (path: string) => Promise<{ error?: string } | void>;
}) {
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const problem = validateUpload(file, kind);
    if (problem) {
      setState("error");
      setMessage(problem);
      input.value = "";
      return;
    }

    setState("uploading");
    setMessage("");
    const supabase = createClient();
    let uploadedPath: string | null = null;
    let failure: string | null = null;
    try {
      const path = buildStoragePath(prefix, file.name, newId());
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        failure = "Upload failed. Try again.";
      } else {
        uploadedPath = path;
        const result = await onUploaded(path);
        if (result && result.error) {
          failure = result.error;
        } else {
          uploadedPath = null; // recorded; keep the object
        }
      }
    } catch {
      failure = "Upload failed. Try again.";
    }
    if (uploadedPath) {
      // Object uploaded but not recorded: best-effort cleanup so it is not orphaned.
      try {
        await supabase.storage.from(bucket).remove([uploadedPath]);
      } catch {
        // nothing more we can do client-side
      }
    }
    setState(failure ? "error" : "idle");
    setMessage(failure ?? "");
    input.value = "";
  }

  return (
    <div>
      <label className="inline-block cursor-pointer rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-sky-400">
        {state === "uploading" ? "Uploading…" : label}
        <input
          type="file"
          className="sr-only"
          disabled={state === "uploading"}
          accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp"}
          onChange={handleChange}
        />
      </label>
      {state === "error" ? <p className="mt-1 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
