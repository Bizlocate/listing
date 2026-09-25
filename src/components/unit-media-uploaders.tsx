"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUploader } from "@/components/file-uploader";
import { recordUnitPhoto, recordUnitDocument } from "@/app/(app)/units/[unitId]/media-actions";

const SELECT_CLASSES = "rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none";

export function UnitPhotoUploader({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [photoType, setPhotoType] = useState("property");
  return (
    <div className="flex flex-wrap items-start gap-2">
      <select value={photoType} onChange={(e) => setPhotoType(e.target.value)} className={SELECT_CLASSES}>
        <option value="cover">Cover</option>
        <option value="property">Property</option>
        <option value="banner">Banner</option>
      </select>
      <FileUploader
        bucket="unit-photos"
        prefix={unitId}
        kind="photo"
        label="Add photo"
        onUploaded={async (path) => {
          const result = await recordUnitPhoto(unitId, path, photoType);
          if (!result.error) router.refresh();
          return result;
        }}
      />
    </div>
  );
}

export function UnitDocumentUploader({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [docType, setDocType] = useState("hakmilik");
  return (
    <div className="flex flex-wrap items-start gap-2">
      <select value={docType} onChange={(e) => setDocType(e.target.value)} className={SELECT_CLASSES}>
        <option value="ic">IC</option>
        <option value="hakmilik">Hakmilik</option>
        <option value="other">Other</option>
      </select>
      <FileUploader
        bucket="unit-documents"
        prefix={unitId}
        kind="document"
        label="Add document"
        onUploaded={async (path) => {
          const result = await recordUnitDocument(unitId, path, docType);
          if (!result.error) router.refresh();
          return result;
        }}
      />
    </div>
  );
}

export function SubmissionPhotoField({ userId }: { userId: string }) {
  const [path, setPath] = useState("");
  return (
    <div>
      <input type="hidden" name="photoPath" value={path} />
      <FileUploader
        bucket="submission-photos"
        prefix={userId}
        kind="photo"
        label={path ? "Replace photo" : "Add photo"}
        onUploaded={async (uploaded) => {
          setPath(uploaded);
        }}
      />
      {path ? <p className="mt-1 text-sm text-sky-700">Photo attached.</p> : null}
    </div>
  );
}
