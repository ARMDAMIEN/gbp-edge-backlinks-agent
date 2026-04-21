import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { CONTACTED_PROSPECTS_PATH } from "../config.js";

export interface ContactedProspect {
  email: string;
  domain: string;
  business_name: string;
  client: string;
  city: string | null;
  niche: string | null;
  sent_at: string;
  message_id: string | null;
  subject: string;
}

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

function normDomain(d: string): string {
  return d.trim().toLowerCase().replace(/^www\./, "");
}

export function extractDomain(input: string): string {
  const s = input.trim().toLowerCase();
  if (s.includes("@")) return normDomain(s.split("@")[1] ?? "");
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return normDomain(u.hostname);
  } catch {
    return normDomain(s);
  }
}

async function readStore(): Promise<ContactedProspect[]> {
  try {
    const raw = await readFile(CONTACTED_PROSPECTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStoreAtomic(rows: ContactedProspect[]): Promise<void> {
  await mkdir(dirname(CONTACTED_PROSPECTS_PATH), { recursive: true });
  const tmp = `${CONTACTED_PROSPECTS_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await rename(tmp, CONTACTED_PROSPECTS_PATH);
}

export async function checkProspectContacted(params: {
  email?: string;
  domain?: string;
}): Promise<{
  contacted: boolean;
  last_sent_at: string | null;
  client: string | null;
  match: "email" | "domain" | null;
}> {
  const rows = await readStore();
  const email = params.email ? normEmail(params.email) : null;
  const domain = params.domain ? normDomain(params.domain) : null;

  for (const r of rows) {
    if (email && r.email === email) {
      return { contacted: true, last_sent_at: r.sent_at, client: r.client, match: "email" };
    }
  }
  if (domain) {
    for (const r of rows) {
      if (r.domain === domain) {
        return { contacted: true, last_sent_at: r.sent_at, client: r.client, match: "domain" };
      }
    }
  }
  return { contacted: false, last_sent_at: null, client: null, match: null };
}

export async function markProspectContacted(prospect: {
  email: string;
  domain?: string;
  business_name: string;
  client: string;
  city?: string | null;
  niche?: string | null;
  sent_at: string;
  message_id?: string | null;
  subject: string;
}): Promise<{ total: number }> {
  const rows = await readStore();
  const email = normEmail(prospect.email);
  const domain = normDomain(prospect.domain ?? extractDomain(email));
  rows.push({
    email,
    domain,
    business_name: prospect.business_name,
    client: prospect.client,
    city: prospect.city ?? null,
    niche: prospect.niche ?? null,
    sent_at: prospect.sent_at,
    message_id: prospect.message_id ?? null,
    subject: prospect.subject,
  });
  await writeStoreAtomic(rows);
  return { total: rows.length };
}

export async function getContactedCount(): Promise<{ total: number }> {
  const rows = await readStore();
  return { total: rows.length };
}
