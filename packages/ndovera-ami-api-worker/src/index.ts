import { Hono } from "hono";
import { cors } from "hono/cors";
import { readDocument, writeDocument } from "./lib/db";
import type { AmiWorkerEnv } from "./lib/env";
import { resolveAllowedOrigins } from "./lib/env";
import { clearSession, createSession, getSessionUser } from "./lib/session";
import { storeUpload } from "./lib/uploads";

type Bindings = AmiWorkerEnv;

type PricingPlan = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  billingInterval: string;
  features: string[];
};

type PlansState = { plans: PricingPlan[] };

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const allowedOrigins = resolveAllowedOrigins(c.env.CORS_ORIGIN);
  return cors({
    origin: (origin) => {
      if (!origin) return "";
      return allowedOrigins.includes(origin) ? origin : "";
    },
    credentials: true,
    allowHeaders: ["Content-Type", "X-CSRF-Token"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })(c, next);
});

app.get("/health", async (c) => {
  await c.env.AMI_DB.exec("SELECT 1;");
  return c.json({ ok: true, service: "ndovera-ami-api-worker" });
});

app.post("/api/super/auth/login", async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");

  const configuredEmail = String(c.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const configuredPasswordHash = String(c.env.SUPER_ADMIN_PASSWORD_HASH || "").trim();

  if (!configuredEmail || !configuredPasswordHash) {
    return c.json({ error: "Super-admin credentials are not configured." }, 503);
  }

  const passwordHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const incomingHash = Array.from(new Uint8Array(passwordHash))
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");

  if (email !== configuredEmail || incomingHash !== configuredPasswordHash) {
    return c.json({ error: "Invalid credentials." }, 401);
  }

  const user = await createSession(c, {
    id: "super-admin",
    name: "Super Admin",
    email: configuredEmail,
    roles: ["Super Admin"],
    activeRole: "Super Admin",
  });

  return c.json({ user });
});

app.get("/api/super/auth/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json({ user });
});

app.post("/api/super/auth/logout", async (c) => {
  await clearSession(c);
  return c.json({ ok: true });
});

app.get("/api/super/plans", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthenticated" }, 401);
  const state = await readDocument<PlansState>(c.env, "billing-plans", "__global__", () => ({
    plans: [
      {
        id: "starter",
        name: "Starter",
        description: "Starter plan",
        priceCents: 0,
        billingInterval: "monthly",
        features: ["Core operations", "Basic analytics"],
      },
    ],
  }));
  return c.json({ plans: state.plans });
});

app.post("/api/super/plans", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthenticated" }, 401);

  const payload = await c.req.json().catch(() => ({}));
  const id = String(payload?.id || "").trim();
  const name = String(payload?.name || "").trim();
  if (!id || !name) return c.json({ error: "id and name are required" }, 400);

  const nextPlan: PricingPlan = {
    id,
    name,
    description: String(payload?.description || ""),
    priceCents: Number(payload?.priceCents || 0),
    billingInterval: String(payload?.billingInterval || "monthly"),
    features: Array.isArray(payload?.features) ? payload.features.map((entry: unknown) => String(entry)) : [],
  };

  const state = await readDocument<PlansState>(c.env, "billing-plans", "__global__", () => ({ plans: [] }));
  state.plans = state.plans.filter((entry) => entry.id !== nextPlan.id);
  state.plans.push(nextPlan);
  await writeDocument(c.env, "billing-plans", "__global__", state);
  return c.json({ plan: nextPlan }, 201);
});

app.post("/api/super/uploads/:category", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthenticated" }, 401);

  const category = String(c.req.param("category") || "general").trim();
  const form = await c.req.formData();
  const fileCandidate = form.get("file") || form.get("asset");
  if (!(fileCandidate instanceof File)) {
    return c.json({ error: "file field is required" }, 400);
  }

  const uploaded = await storeUpload(c.env, category, fileCandidate);
  return c.json({ ok: true, ...uploaded }, 201);
});

app.get("/api/super/uploads/object/:key", async (c) => {
  const objectKey = decodeURIComponent(c.req.param("key"));
  const object = await c.env.UPLOADS.get(objectKey);
  if (!object) return c.text("Not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
  console.error("ndovera-ami-api-worker error", error);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
