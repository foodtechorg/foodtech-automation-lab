export type TelegramOutboxMessage = {
  telegram_user_id: number;
  message_text: string;
  parse_mode: string | null;
};

export type TelegramDeliveryResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
  httpStatus: number;
  retryAfterSeconds?: number;
  permanent: boolean;
  response: Record<string, unknown>;
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const PERMANENT_HTTP_STATUSES = new Set([400, 401, 403, 404]);
const ALLOWED_PARSE_MODES = new Set(["HTML", "Markdown", "MarkdownV2"]);

function sanitizedResponse(body: Record<string, unknown>): Record<string, unknown> {
  const parameters = body.parameters;
  const result = body.result;

  return {
    ok: body.ok === true,
    ...(typeof body.error_code === "number" ? { error_code: body.error_code } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
    ...(parameters && typeof parameters === "object"
      ? {
          parameters: {
            ...(typeof (parameters as Record<string, unknown>).retry_after === "number"
              ? { retry_after: (parameters as Record<string, unknown>).retry_after }
              : {}),
          },
        }
      : {}),
    ...(result && typeof result === "object" && typeof (result as Record<string, unknown>).message_id === "number"
      ? { result: { message_id: (result as Record<string, unknown>).message_id } }
      : {}),
  };
}

export function retryDelaySeconds(attempts: number): number {
  return Math.min(3600, Math.max(60, 30 * 2 ** Math.max(0, attempts - 1)));
}

export async function sendTelegramMessage(
  token: string,
  message: TelegramOutboxMessage,
  fetcher: Fetcher = fetch,
): Promise<TelegramDeliveryResult> {
  let response: Response;

  try {
    response = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.telegram_user_id,
        text: message.message_text,
        ...(message.parse_mode && ALLOWED_PARSE_MODES.has(message.parse_mode)
          ? { parse_mode: message.parse_mode }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Network request failed";
    return {
      ok: false,
      error: `Telegram network error: ${detail}`,
      httpStatus: 0,
      permanent: false,
      response: { ok: false, description: detail },
    };
  }

  let rawBody: Record<string, unknown> = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === "object") rawBody = parsed as Record<string, unknown>;
  } catch {
    rawBody = { ok: false, description: `Telegram returned non-JSON HTTP ${response.status}` };
  }

  const safeBody = sanitizedResponse(rawBody);
  const messageId = (rawBody.result as Record<string, unknown> | undefined)?.message_id;
  if (response.ok && rawBody.ok === true && typeof messageId === "number") {
    return {
      ok: true,
      messageId,
      httpStatus: response.status,
      permanent: false,
      response: safeBody,
    };
  }

  const retryAfter = (rawBody.parameters as Record<string, unknown> | undefined)?.retry_after;
  const errorCode = typeof rawBody.error_code === "number" ? rawBody.error_code : response.status;
  const description = typeof rawBody.description === "string"
    ? rawBody.description
    : `Telegram HTTP ${response.status}`;

  return {
    ok: false,
    error: `${errorCode}: ${description}`,
    httpStatus: response.status,
    ...(typeof retryAfter === "number" ? { retryAfterSeconds: retryAfter } : {}),
    permanent: PERMANENT_HTTP_STATUSES.has(errorCode) && errorCode !== 429,
    response: safeBody,
  };
}
