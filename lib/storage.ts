import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "project-files";
let bucketReady: Promise<void> | null = null;

function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createAdminClient();
      const { data } = await supabase.storage.getBucket(BUCKET);
      if (!data) {
        await supabase.storage.createBucket(BUCKET, { public: true });
      }
    })();
  }
  return bucketReady;
}

export async function uploadProjectFile(
  folderId: string,
  file: File,
): Promise<{ url: string; name: string } | null> {
  if (!file || file.size === 0) return null;

  await ensureBucket();
  const supabase = createAdminClient();

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${folderId}/${randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined });

  if (error) return null;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}

export async function deleteProjectFile(url: string) {
  const marker = `/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;

  const path = url.slice(index + marker.length);
  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
