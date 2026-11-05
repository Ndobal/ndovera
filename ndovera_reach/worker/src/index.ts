export interface Env {
  DB: D1Database;
  MESSAGE_QUEUE: Queue;
  ASSETS: R2Bucket;
  APP_ENV: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  EMAIL_API_KEY?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "ndovera-reach-api", environment: env.APP_ENV, sendingEnabled: false });
    }
    if (url.pathname === "/api/webhooks/whatsapp" && request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token && token === env.WHATSAPP_VERIFY_TOKEN && challenge) return new Response(challenge);
      return new Response("Forbidden", { status: 403 });
    }
    // Webhook POST processing is deliberately unavailable until signature
    // verification and durable event handling are implemented and tested.
    if (url.pathname.startsWith("/api/webhooks/") && request.method === "POST") {
      return json({ error: "Webhook ingestion is not enabled in this build." }, 501);
    }
    // No public contact or campaign mutation endpoints are exposed until an
    // authentication provider and authorisation policy are configured.
    if (url.pathname.startsWith("/api/")) return json({ error: "API route not enabled. Configure authentication and persistence first." }, 501);
    return new Response("Not found", { status: 404 });
  },
};
