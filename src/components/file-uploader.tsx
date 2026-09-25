"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateUpload, buildStoragePath, type UploadKind } from "@/lib/storage/upload";

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
    const path = buildStoragePath(prefix, file.name, crypto.randomUUID());
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      setState("error");
      setMessage("Upload failed. Try again.");
      input.value = "";
      return;
    }

    const result = await onUploaded(path);
    if (result && result.error) {
      await supabase.storage.from(bucket).remove([path]);
      setState("error");
      setMessage(result.error);
    } else {
      setState("idle");
    }
    input.value = "";
  }

  return (
    <div>
      <label className="inline-block cursor-pointer rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
        {state === "uploading" ? "Uploading…" : label}
        <input
          type="file"
          className="hidden"
          disabled={state === "uploading"}
          accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp"}
          onChange={handleChange}
        />
      </label>
      {state === "error" ? <p className="mt-1 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
