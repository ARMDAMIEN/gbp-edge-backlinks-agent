import { TELEGRAM_BOT_API_KEY, TELEGRAM_CHAT_ID } from "../config.js";

const MAX_MSG = 4000;

async function postMessage(text: string): Promise<{ ok: boolean; message_id: number | null; error?: string }> {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_API_KEY}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(TELEGRAM_CHAT_ID),
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(20000),
    }
  );
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok || !data?.ok) {
    return {
      ok: false,
      message_id: null,
      error: `Telegram API ${res.status}: ${JSON.stringify(data).slice(0, 300)}`,
    };
  }
  return { ok: true, message_id: data.result?.message_id ?? null };
}

function splitText(text: string): string[] {
  if (text.length <= MAX_MSG) return [text];
  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";
  for (const line of lines) {
    if ((current + "\n" + line).length > MAX_MSG) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function sendTelegramReport(params: {
  text: string;
}): Promise<{ ok: boolean; sent_messages: number; errors: string[] }> {
  if (!TELEGRAM_BOT_API_KEY || !TELEGRAM_CHAT_ID) {
    return { ok: false, sent_messages: 0, errors: ["TELEGRAM_BOT_API_KEY or TELEGRAM_CHAT_ID not set"] };
  }

  const chunks = splitText(params.text);
  const errors: string[] = [];
  let sent = 0;
  for (const chunk of chunks) {
    const r = await postMessage(chunk);
    if (r.ok) {
      sent++;
    } else {
      errors.push(r.error ?? "unknown error");
    }
  }
  return { ok: errors.length === 0, sent_messages: sent, errors };
}
