import { createClient } from "npm:@supabase/supabase-js@2.86.2";
import {
  retryDelaySeconds,
  sendTelegramMessage,
  type TelegramOutboxMessage,
} from "../_shared/telegram-delivery.ts";

type OutboxRow = TelegramOutboxMessage & {
  id: string;
  attempts: number;
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function jwtRole(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  try {
    const token = authorization.slice("Bearer ".length);
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  // The Supabase gateway verifies the JWT before this handler runs. Only the
  // project anon/service roles may request delivery, and every request must name
  // an unguessable existing outbox UUID. The function cannot create messages.
  if (!["anon", "service_role"].includes(jwtRole(req) ?? "")) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const expectedDispatchSecret = Deno.env.get("OUTBOX_DISPATCH_SECRET");
  const suppliedDispatchSecret = req.headers.get("x-dispatch-secret");
  if (!expectedDispatchSecret || suppliedDispatchSecret !== expectedDispatchSecret) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!telegramToken || !supabaseUrl || !serviceRoleKey) {
    console.error("telegram-dispatcher configuration is incomplete");
    return jsonResponse({ error: "Dispatcher configuration is incomplete" }, 500);
  }

  let payload: { outboxId?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.outboxId || !UUID_PATTERN.test(payload.outboxId)) {
    return jsonResponse({ error: "Invalid outboxId" }, 400);
  }

  const workerId = Deno.env.get("SB_EXECUTION_ID") ?? crypto.randomUUID();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("claim_notification_outbox", {
    p_outbox_id: payload.outboxId,
    p_batch_size: 1,
    p_worker_id: workerId,
  });

  if (error) {
    console.error("Failed to claim notification outbox", error.message);
    return jsonResponse({ error: "Failed to claim notification outbox" }, 500);
  }

  const rows = (data ?? []) as OutboxRow[];
  const results: Array<{ id: string; status: "sent" | "retry" | "failed" | "state_error" }> = [];

  for (const row of rows) {
    const delivery = await sendTelegramMessage(telegramToken, row);

    if (delivery.ok) {
      const { data: completed, error: completeError } = await supabase.rpc("complete_notification_outbox", {
        p_outbox_id: row.id,
        p_telegram_message_id: delivery.messageId,
        p_telegram_response: delivery.response,
      });

      if (completeError || completed !== true) {
        console.error("Failed to complete notification outbox row", row.id, completeError?.message);
        results.push({ id: row.id, status: "state_error" });
      } else {
        results.push({ id: row.id, status: "sent" });
      }
      continue;
    }

    const retryAfter = delivery.retryAfterSeconds ?? retryDelaySeconds(row.attempts);
    const { data: failed, error: failError } = await supabase.rpc("fail_notification_outbox", {
      p_outbox_id: row.id,
      p_error: delivery.error ?? "Unknown Telegram delivery error",
      p_telegram_response: delivery.response,
      p_retry_after_seconds: retryAfter,
      p_permanent: delivery.permanent,
    });

    if (failError || failed !== true) {
      console.error("Failed to record notification delivery error", row.id, failError?.message);
      results.push({ id: row.id, status: "state_error" });
    } else {
      results.push({ id: row.id, status: delivery.permanent ? "failed" : "retry" });
    }
  }

  const summary = results.reduce(
    (counts, result) => ({ ...counts, [result.status]: counts[result.status] + 1 }),
    { sent: 0, retry: 0, failed: 0, state_error: 0 },
  );

  return jsonResponse({ ok: summary.state_error === 0, claimed: rows.length, ...summary });
});
