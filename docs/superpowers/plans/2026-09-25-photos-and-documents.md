# Unit Photos & Documents (Supabase Storage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Admins upload/delete **unit photos** (cover / property / banner) on the unit detail page; every logged-in role can see them (unit photos are not sensitive) — including a photo strip on the SP-facing `/available-listings/[id]` page. (2) Admins upload/delete **unit documents** (IC / hakmilik / other) — admin-only, never visible to SP. (3) An SP can attach a **photo to a Unit Submission** (spec: "SP: Submit Unit (photo, address, discovery_type)"); admins see it on the submission review page.

**Architecture:** Files go **browser → Supabase Storage directly** (using the user's own session), then a small server action records the DB row. Not through a Next server action: phone photos are 4–8 MB, Next's default server-action body limit is 1 MB, and Netlify functions cap request bodies around 6 MB. Three **private** buckets; access control lives in `storage.objects` RLS policies (real enforcement, not UI hiding); files are displayed through **short-lived signed URLs** created server-side with the user's session (so the storage SELECT policy gates URL creation). The existing `url` columns on `unit_photos` / `unit_documents` / `unit_submissions.photo_url` store the **object path** (e.g. `<unit_id>/<uuid>.jpg`), not a public URL.

**Tech Stack:** Supabase Storage (`@supabase/ssr` browser client + server client), Next.js Server Components/Actions, Tailwind, Vitest.

## Important Context

- Tables `unit_photos` (`id, unit_id, space_id, url, photo_type ∈ cover|property|banner, created_by, created_at`) and `unit_documents` (`id, unit_id, doc_type ∈ ic|hakmilik|other, url, uploaded_by, restricted default true, created_at`) already exist with RLS: `unit_photos_select_all` (any authenticated), `unit_photos_write_admin` (super_admin or area_admin of the unit's area), `unit_documents_admin_only` (same admin scope, no SP). `unit_submissions.photo_url text` exists (nothing writes it yet). No app code touches Storage yet.
- One new migration `0010` creates the buckets and the `storage.objects` policies. The user runs it manually in the Supabase SQL Editor.
- **Security posture** (the point of this plan): documents are IC/land-title scans — the most sensitive files in the system. Buckets are private, no public URLs, admin-scoped policies keyed off the first path segment (the unit id), signed URLs valid 1 hour, MIME/size limits enforced by the bucket itself.
- Prior-lesson checklist for every new query: read and surface `error` (PostgREST/Storage errors are otherwise silently swallowed into empty data); embeds must be single-FK.
- Out of scope: image compression/thumbnails, drag-and-drop, per-space photos (the `space_id` column stays null), copying a submission photo onto the new unit's photo gallery when a submission is converted, virus scanning.

## Global Constraints

- Path convention: `unit-photos/<unit_id>/<uuid>.<ext>`, `unit-documents/<unit_id>/<uuid>.<ext>`, `submission-photos/<auth.uid()>/<uuid>.<ext>` (bucket / object name).
- Limits: photos ≤ 8 MB (`image/jpeg`, `image/png`, `image/webp`); documents ≤ 10 MB (`application/pdf` + the three image types). Enforced by the buckets (`file_size_limit`, `allowed_mime_types`) AND checked client-side for fast feedback.
- Signed URL TTL 3600 s. Never render or store a permanent public URL.
- Server actions that record a row must verify the path starts with `<unit_id>/` (a client must not be able to register another unit's object) and that the actor is `super_admin`/`area_admin`.
- Light theme, sky-blue accents, existing Tailwind conventions.

---

## File Structure

- `src/lib/storage/upload.ts` (+ `upload.test.ts`) — pure `validateUpload`, `buildStoragePath`, constants.
- `supabase/migrations/0010_storage_buckets_and_policies.sql` — new.
- `src/components/file-uploader.tsx` — new client component (direct upload).
- `src/components/unit-media-uploaders.tsx` — new client wrappers (`UnitPhotoUploader`, `UnitDocumentUploader`, `SubmissionPhotoField`).
- `src/app/(app)/units/[unitId]/media-actions.ts` — new server actions.
- `src/app/(app)/units/[unitId]/page.tsx` — modify: Photos + Documents sections.
- `src/app/(app)/submit-unit/page.tsx` + `actions.ts` — modify: photo field, save `photo_url`.
- `src/app/(app)/unit-submissions/[submissionId]/page.tsx` — modify: show submission photo.
- `src/app/(app)/available-listings/[listingId]/page.tsx` — modify: photo strip.

---

### Task 1: Upload helpers

**Files:**
- Create: `src/lib/storage/upload.ts`
- Test: `src/lib/storage/upload.test.ts`

**Interfaces:**
- Produces: `type UploadKind = "photo" | "document"`, `PHOTO_MAX_BYTES`, `DOCUMENT_MAX_BYTES`, `validateUpload(file: { type: string; size: number }, kind: UploadKind): string | null`, `buildStoragePath(prefix: string, filename: string, id: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/storage/upload.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateUpload, buildStoragePath, PHOTO_MAX_BYTES, DOCUMENT_MAX_BYTES } from "./upload";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, `Cannot find module './upload'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/storage/upload.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/upload.ts src/lib/storage/upload.test.ts
git commit -m "feat: add storage upload validation helpers"
```

---

### Task 2: Storage buckets + policies migration

**Files:**
- Create: `supabase/migrations/0010_storage_buckets_and_policies.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0010_storage_buckets_and_policies.sql` (header-comment style of `0005_*.sql`; the user runs it manually in the Supabase SQL Editor — do NOT try to run it):

```sql
-- Private Storage buckets for unit photos, IC/land-title documents and SP submission photos.
-- Access control is enforced here (storage.objects RLS), keyed off the first path
-- segment: <unit_id>/... for unit buckets, <auth.uid()>/... for submission photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('unit-photos', 'unit-photos', false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('unit-documents', 'unit-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('submission-photos', 'submission-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- unit-photos: any logged-in user reads; only super_admin / the unit's area admin writes
create policy "unit_photos_objects_select" on storage.objects for select
  using (bucket_id = 'unit-photos' and auth.role() = 'authenticated');
create policy "unit_photos_objects_insert" on storage.objects for insert
  with check (
    bucket_id = 'unit-photos'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );
create policy "unit_photos_objects_delete" on storage.objects for delete
  using (
    bucket_id = 'unit-photos'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );

-- unit-documents (IC / hakmilik): admin-only for every operation, never SP
create policy "unit_documents_objects_select" on storage.objects for select
  using (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );
create policy "unit_documents_objects_insert" on storage.objects for insert
  with check (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );
create policy "unit_documents_objects_delete" on storage.objects for delete
  using (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );

-- submission-photos: an SP uploads into their own folder and can read only their own;
-- admins (super_admin, or role area_admin) can read all to review submissions
create policy "submission_photos_objects_insert" on storage.objects for insert
  with check (
    bucket_id = 'submission-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "submission_photos_objects_select" on storage.objects for select
  using (
    bucket_id = 'submission-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or public.is_super_admin()
         or public.current_role() = 'area_admin')
  );
```

- [ ] **Step 2: Self-check**

Confirm from `supabase/migrations/0001_phase1_schema.sql` that `public.is_super_admin()`, `public.is_area_admin_for_area(uuid)`, `public.area_id_for_unit(uuid)`, `public.current_role()` exist with those exact signatures, and from `0005` that `is_area_admin_for_area` rechecks the role. Note that a malformed first path segment makes the `::uuid` cast raise, which fails the policy (deny) — acceptable; mention it in the report. `storage.foldername(name)` returns the folder path segments of the object name (verify against Supabase docs knowledge; it returns `text[]` of directories, so `[1]` is the first folder). Report anything that looks wrong instead of guessing.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_storage_buckets_and_policies.sql
git commit -m "feat: add private storage buckets with RLS policies"
```

---

### Task 3: Unit photos + documents (uploader, actions, unit page)

**Files:**
- Create: `src/components/file-uploader.tsx`
- Create: `src/components/unit-media-uploaders.tsx`
- Create: `src/app/(app)/units/[unitId]/media-actions.ts`
- Modify: `src/app/(app)/units/[unitId]/page.tsx`

**Interfaces:**
- Consumes: `validateUpload`, `buildStoragePath`, `UploadKind` (Task 1); buckets/policies (Task 2)
- Produces: `recordUnitPhoto`, `recordUnitDocument`, `deleteUnitPhoto`, `deleteUnitDocument`

- [ ] **Step 1: Direct-upload client component**

Create `src/components/file-uploader.tsx`:

```tsx
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
```

- [ ] **Step 2: Server actions**

Create `src/app/(app)/units/[unitId]/media-actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

const PHOTO_TYPES = ["cover", "property", "banner"];
const DOC_TYPES = ["ic", "hakmilik", "other"];

async function requireAdmin() {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }
  return actor;
}

export async function recordUnitPhoto(unitId: string, path: string, photoType: string): Promise<{ error?: string }> {
  const actor = await requireAdmin();
  if (!path.startsWith(`${unitId}/`) || !PHOTO_TYPES.includes(photoType)) {
    return { error: "Invalid upload." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_photos")
    .insert({ unit_id: unitId, url: path, photo_type: photoType, created_by: actor.id });
  if (error) return { error: "Could not save photo." };
  revalidatePath(`/units/${unitId}`);
  return {};
}

export async function recordUnitDocument(unitId: string, path: string, docType: string): Promise<{ error?: string }> {
  const actor = await requireAdmin();
  if (!path.startsWith(`${unitId}/`) || !DOC_TYPES.includes(docType)) {
    return { error: "Invalid upload." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_documents")
    .insert({ unit_id: unitId, url: path, doc_type: docType, uploaded_by: actor.id });
  if (error) return { error: "Could not save document." };
  revalidatePath(`/units/${unitId}`);
  return {};
}

export async function deleteUnitPhoto(formData: FormData) {
  await requireAdmin();
  const unitId = String(formData.get("unitId"));
  const photoId = String(formData.get("photoId"));
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("unit_photos")
    .delete()
    .eq("id", photoId)
    .eq("unit_id", unitId)
    .select("url")
    .maybeSingle();
  if (row) {
    await supabase.storage.from("unit-photos").remove([row.url]);
  }
  redirect(`/units/${unitId}`);
}

export async function deleteUnitDocument(formData: FormData) {
  await requireAdmin();
  const unitId = String(formData.get("unitId"));
  const documentId = String(formData.get("documentId"));
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("unit_documents")
    .delete()
    .eq("id", documentId)
    .eq("unit_id", unitId)
    .select("url")
    .maybeSingle();
  if (row) {
    await supabase.storage.from("unit-documents").remove([row.url]);
  }
  redirect(`/units/${unitId}`);
}
```

- [ ] **Step 3: Client wrappers**

Create `src/components/unit-media-uploaders.tsx`:

```tsx
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
```

- [ ] **Step 4: Unit page sections**

In `src/app/(app)/units/[unitId]/page.tsx` (read the whole file first; keep all existing behaviour, tabs and deep links):
1. Fetch photos for every viewer: `supabase.from("unit_photos").select("id, url, photo_type").eq("unit_id", unitId).order("created_at", { ascending: false })`, surfacing `error`; create signed URLs with `supabase.storage.from("unit-photos").createSignedUrls(paths, 3600)` (skip if no rows; surface any error). Build a `path → signedUrl` map.
2. For admins only (reuse the page's existing `canManage` flag — super_admin, or area_admin of this unit's area) fetch documents: `supabase.from("unit_documents").select("id, url, doc_type").eq("unit_id", unitId)` + `createSignedUrls(paths, 3600)` from bucket `unit-documents`. Do not run the documents queries for non-admins.
3. Add to the **Overview** panel, below the existing fields: a "Photos" section — grid of `<img>` (plain `<img>` with `alt`, `className="h-32 w-full rounded-lg object-cover"`), each with a small photo-type Badge and, when `canManage`, a delete `<form action={deleteUnitPhoto}>` (hidden `unitId`, `photoId`); when `canManage` also render `<UnitPhotoUploader unitId={unitId} />`; empty state "No photos yet." Then, only when `canManage`, a "Documents · admin only" section listing each doc as a link (`<a href={signedUrl} target="_blank" rel="noopener noreferrer">`) with doc-type label, a delete form (`deleteUnitDocument`, hidden `unitId`, `documentId`), and `<UnitDocumentUploader unitId={unitId} />`.
4. `@next/next/no-img-element` warns on `<img>`: add `{/* eslint-disable-next-line @next/next/no-img-element */}` above each `<img>`; signed URLs are short-lived and remote, so `next/image` is not appropriate here.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — clean. Run: `npm test` — passing. Run: `npx eslint` on the changed files — no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/file-uploader.tsx src/components/unit-media-uploaders.tsx "src/app/(app)/units/[unitId]"
git commit -m "feat: add unit photo and document uploads"
```

---

### Task 4: SP submission photo + photo displays

**Files:**
- Modify: `src/components/unit-media-uploaders.tsx` (add `SubmissionPhotoField`)
- Modify: `src/app/(app)/submit-unit/page.tsx`, `src/app/(app)/submit-unit/actions.ts`
- Modify: `src/app/(app)/unit-submissions/[submissionId]/page.tsx`
- Modify: `src/app/(app)/available-listings/[listingId]/page.tsx`

- [ ] **Step 1: Submission photo field**

Append to `src/components/unit-media-uploaders.tsx` (needs the current user id for the folder — the folder MUST be the uploader's `auth.uid()` per the storage policy; get it with `createClient().auth.getUser()` inside the click flow, so wrap as below):

```tsx
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
```

- [ ] **Step 2: Submit form + action**

In `src/app/(app)/submit-unit/page.tsx` add `<SubmissionPhotoField userId={profile.id} />` inside the form (it is a Server Component page with the profile already loaded; pass the profile id — read the file to place it sensibly, e.g. above the submit button). In `submit-unit/actions.ts` read `photoPath` from `formData`; accept it only if it starts with `${actor.id}/` (else null) and pass it as `photo_url` in the insert (the tightened insert policy from migration 0007-era only pins status/matched_unit_id, so this is allowed).

- [ ] **Step 3: Admin review + SP listing photo strip**

- `src/app/(app)/unit-submissions/[submissionId]/page.tsx`: if the submission has `photo_url`, create a signed URL (`supabase.storage.from("submission-photos").createSignedUrl(photo_url, 3600)`; surface error) and show the image in the submission details (`<img>` with the same eslint-disable comment). Select `photo_url` in the existing submission query.
- `src/app/(app)/available-listings/[listingId]/page.tsx`: select `unit_id` in the existing `available_listings` query (the view has `unit_id`), fetch up to 6 `unit_photos` for that unit (cover first: order by `photo_type` so `cover` sorts first — simplest: fetch all then sort in JS with cover first), create signed URLs (`unit-photos` bucket) and render a horizontally scrollable photo strip under the title. Surface errors; render nothing if there are no photos. No document access anywhere on this page.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — clean. Run: `npm test` — passing. Eslint on changed files — no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/unit-media-uploaders.tsx "src/app/(app)/submit-unit" "src/app/(app)/unit-submissions/[submissionId]" "src/app/(app)/available-listings/[listingId]/page.tsx"
git commit -m "feat: add submission photo and photo displays"
```

---

## Manual Verification (controller-driven, after the user runs 0010)

1. As admin, unit page → Add photo (generate a small PNG in the browser via JS `File`/`DataTransfer`) → appears in Photos with a signed URL that loads (HTTP 200); delete removes the row and the object.
2. Upload a document → listed under "Documents · admin only", link opens; verify it does NOT appear on `/available-listings/<id>`.
3. Try invalid files (wrong MIME, empty) → clear client-side message; attempt an oversize upload check by unit test only.
4. Storage RLS via REST as the test admin: create a signed URL for a document path works; then confirm anonymous (anon key, no login) access to `/storage/v1/object/unit-documents/<path>` is denied and `/storage/v1/object/public/...` is not served (private bucket).
5. SP path (needs the Test Salesperson session — the user must log in): submit a unit with a photo; admin sees it on the submission review page; SP cannot read `unit-documents` objects (expect 400/403) and cannot read another user's `submission-photos` folder.
6. Cleanup: delete test files/rows.

## Self-Review Notes

- **Spec coverage:** unit photos (spec `unit_photos`, SP-visible listing photo), unit documents (restricted, never SP), SP Submit Unit photo. Not covered: per-space photos, submission→unit photo copy on conversion, compression, bulk upload.
- **Accepted:** a client can upload an object to `unit-photos/<unit_id>/…` without ever creating the DB row (orphan object); the admin-only insert policy bounds this to admins. MIME is client-declared; the bucket's `allowed_mime_types` is the backstop and there is no content sniffing.
- **Type consistency:** action signatures `recordUnitPhoto(unitId, path, photoType)` / `recordUnitDocument(unitId, path, docType)` match the wrappers; bucket names `unit-photos` / `unit-documents` / `submission-photos` are identical in SQL, uploaders and pages.
