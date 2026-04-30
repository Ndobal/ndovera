export type AmiWorkerEnv = {
  AMI_DB: D1Database;
  SESSIONS: KVNamespace;
  UPLOADS: R2Bucket;
  CORS_ORIGIN: string;
  SESSION_COOKIE_NAME?: string;
  SESSION_TTL_SECONDS?: string;
  HYPERDRIVE_CONNECTION_STRING?: string;
  HYPERDRIVE?: { connectionString: string };
  SUPER_ADMIN_EMAIL?: string;
  SUPER_ADMIN_PASSWORD_HASH?: string;
};

export function resolveAllowedOrigins(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function resolveSessionCookieName(env: AmiWorkerEnv): string {
  return String(env.SESSION_COOKIE_NAME || "ndovera_ami_session").trim();
}

export function resolveSessionTtl(env: AmiWorkerEnv): number {
  const parsed = Number(env.SESSION_TTL_SECONDS || "2592000");
  if (!Number.isFinite(parsed) || parsed <= 0) return 2592000;
  return Math.floor(parsed);
}
