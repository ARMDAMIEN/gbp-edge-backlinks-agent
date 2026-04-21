import "dotenv/config";

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-6";

export const NOTION_API_KEY = process.env.NOTION_API_KEY ?? "";
export const NOTION_CLIENTS_DB_ID = process.env.NOTION_CLIENTS_DB_ID ?? "";

export const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID ?? "";
export const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? "";
export const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN ?? "";
export const GMAIL_SENDER = process.env.GMAIL_SENDER ?? "armourdom.damien.pro@gmail.com";
export const GMAIL_SENDER_NAME = process.env.GMAIL_SENDER_NAME ?? "Damien - GBP Edge";

export const TELEGRAM_BOT_API_KEY =
  process.env.TELEGRAM_BOT_API_KEY ?? "8697715401:AAEWQiVgLC8DmQhqVRH2ec2ovddmcYpxnBQ";
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "1391187403";

export const MAX_PROSPECTS_PER_CLIENT = Number(process.env.MAX_PROSPECTS_PER_CLIENT ?? 2);
export const DRY_RUN = (process.env.DRY_RUN ?? "false").toLowerCase() === "true";

export const DATA_DIR = new URL("../data/", import.meta.url).pathname;
export const CONTACTED_PROSPECTS_PATH = `${DATA_DIR}contacted_prospects.json`;
