import assert from "node:assert/strict";
import test from "node:test";
import { retryDelaySeconds, sendTelegramMessage } from "./telegram-delivery.ts";

const message = {
  telegram_user_id: 123456,
  message_text: "Test message",
  parse_mode: "HTML",
};

test("accepts a successful Telegram response", async () => {
  const result = await sendTelegramMessage("token", message, async () =>
    Response.json({ ok: true, result: { message_id: 42, chat: { id: 123456 } } }));

  assert.equal(result.ok, true);
  assert.equal(result.messageId, 42);
  assert.deepEqual(result.response, { ok: true, result: { message_id: 42 } });
});

test("honors Telegram retry_after", async () => {
  const result = await sendTelegramMessage("token", message, async () =>
    Response.json(
      { ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 17 } },
      { status: 429 },
    ));

  assert.equal(result.ok, false);
  assert.equal(result.permanent, false);
  assert.equal(result.retryAfterSeconds, 17);
});

test("treats a blocked bot response as permanent", async () => {
  const result = await sendTelegramMessage("token", message, async () =>
    Response.json(
      { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
      { status: 403 },
    ));

  assert.equal(result.ok, false);
  assert.equal(result.permanent, true);
});

test("retries server and network failures", async () => {
  const serverFailure = await sendTelegramMessage("token", message, async () =>
    Response.json({ ok: false, error_code: 500, description: "Internal Server Error" }, { status: 500 }));
  const networkFailure = await sendTelegramMessage("token", message, async () => {
    throw new Error("timeout");
  });

  assert.equal(serverFailure.permanent, false);
  assert.equal(networkFailure.permanent, false);
  assert.match(networkFailure.error ?? "", /timeout/);
});

test("uses bounded exponential retry delays", () => {
  assert.equal(retryDelaySeconds(1), 60);
  assert.equal(retryDelaySeconds(4), 240);
  assert.equal(retryDelaySeconds(20), 3600);
});
