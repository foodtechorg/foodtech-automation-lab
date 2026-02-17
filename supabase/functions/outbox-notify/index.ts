import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { outboxId, createdAt } = await req.json();

    if (!outboxId) {
      return new Response(
        JSON.stringify({ error: "outboxId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl =
      Deno.env.get("N8N_OUTBOX_WEBHOOK_URL") ||
      "https://foodtech.app.n8n.cloud/webhook/fta/outbox-notify";
    const webhookToken = Deno.env.get("N8N_OUTBOX_WEBHOOK_TOKEN") || "";
    const timeoutMs = parseInt(
      Deno.env.get("N8N_OUTBOX_WEBHOOK_TIMEOUT_MS") || "5000",
      10
    );

    // Create service-role client for DB updates
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = JSON.stringify({
      event: "outbox.created",
      outboxId,
      createdAt: createdAt || new Date().toISOString(),
    });

    let lastError: string | null = null;
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-fta-token": webhookToken,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Update tracking after each attempt
        await supabase
          .from("notification_outbox")
          .update({
            webhook_attempts: attempt,
            webhook_last_attempt_at: new Date().toISOString(),
            webhook_last_error: resp.ok ? null : `HTTP ${resp.status}: ${await resp.text().catch(() => "unknown")}`,
          })
          .eq("id", outboxId);

        if (resp.ok) {
          success = true;
          break;
        }

        lastError = `HTTP ${resp.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);

        await supabase
          .from("notification_outbox")
          .update({
            webhook_attempts: attempt,
            webhook_last_attempt_at: new Date().toISOString(),
            webhook_last_error: lastError,
          })
          .eq("id", outboxId);
      }

      // Exponential backoff before next retry
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return new Response(
      JSON.stringify({
        ok: success,
        outboxId,
        ...(lastError && !success ? { error: lastError } : {}),
      }),
      {
        status: success ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("outbox-notify error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
