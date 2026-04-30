import type { AmiWorkerEnv } from "./env";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function sanitizeFileName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function storeUpload(env: AmiWorkerEnv, category: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max allowed size is 25MB.");
  }

  const safeName = sanitizeFileName(file.name || "upload.bin");
  const objectKey = `ami/${category}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  await env.UPLOADS.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  return {
    key: objectKey,
    url: `/api/super/uploads/object/${encodeURIComponent(objectKey)}`,
  };
}
