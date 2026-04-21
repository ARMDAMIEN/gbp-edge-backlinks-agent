import "dotenv/config";
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { CLAUDE_MODEL, DRY_RUN, MAX_PROSPECTS_PER_CLIENT } from "./config.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { fetchActiveClients } from "./tools/fetchActiveClients.js";
import { sendGmail } from "./tools/sendGmail.js";
import { logBacklinkAction } from "./tools/logBacklinkAction.js";
import {
  checkProspectContacted,
  markProspectContacted,
  getContactedCount,
} from "./tools/prospectStore.js";
import { sendTelegramReport } from "./tools/sendTelegramReport.js";

// ─── Tool definitions ───────────────────────────────────────────────────────

const fetchActiveClientsTool = tool(
  "fetch_active_clients",
  "Fetch all active clients from the Notion CRM. Returns their business_name, city, niche, email, place_id. Skips clients without a city.",
  {},
  async () => {
    console.log(`  📋 fetch_active_clients`);
    try {
      const result = await fetchActiveClients();
      console.log(`    → ${result.clients.length} active clients (skipped ${result.skipped})`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `fetch_active_clients failed: ${err}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true, openWorldHint: true } }
);

const checkProspectContactedTool = tool(
  "check_prospect_contacted",
  "Check whether a prospect has already been contacted in a previous run. Call this BEFORE send_gmail. Matches by exact email OR by domain.",
  {
    email: z.string().optional(),
    domain: z.string().optional(),
  },
  async (args) => {
    try {
      const result = await checkProspectContacted(args);
      console.log(`  🔎 check_prospect_contacted: ${args.email ?? args.domain} → ${result.contacted ? "ALREADY" : "new"}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `check failed: ${err}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } }
);

const sendGmailTool = tool(
  "send_gmail",
  "Send the outreach email DIRECTLY via the Gmail API (not a draft). Respects DRY_RUN. Always call check_prospect_contacted first.",
  {
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  },
  async (args) => {
    console.log(`  ✉️  send_gmail → ${args.to}${DRY_RUN ? " [DRY_RUN]" : ""}`);
    try {
      const result = await sendGmail(args);
      console.log(`    → message_id=${result.message_id}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `send_gmail failed: ${err}` }], isError: true };
    }
  },
  { annotations: { destructiveHint: true, openWorldHint: true } }
);

const markProspectContactedTool = tool(
  "mark_prospect_contacted",
  "Record a prospect as contacted in the local JSON store. Call this immediately after every successful send_gmail.",
  {
    email: z.string().email(),
    domain: z.string().optional(),
    business_name: z.string(),
    client: z.string().describe("The GBP Edge client this prospect was contacted for"),
    city: z.string().nullable().optional(),
    niche: z.string().nullable().optional(),
    sent_at: z.string(),
    message_id: z.string().nullable().optional(),
    subject: z.string(),
  },
  async (args) => {
    try {
      const result = await markProspectContacted(args);
      console.log(`  💾 mark_prospect_contacted: total=${result.total}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `mark failed: ${err}` }], isError: true };
    }
  },
  { annotations: { destructiveHint: false } }
);

const logBacklinkActionTool = tool(
  "log_backlink_action",
  "POST the backlink outreach to the GBP Edge SaaS backend (netlinking-actions). Call this immediately after every successful send_gmail, once per prospect. Requires the client's Notion locationId (place_id).",
  {
    locationId: z.string().describe("The client's Notion place_id / LocationId"),
    url: z.string().describe("The prospect's website URL"),
    name: z.string().describe("The prospect's business name"),
    actionDate: z.string().describe("Today's date in YYYY-MM-DD format"),
  },
  async (args) => {
    console.log(`  🔗 log_backlink_action → ${args.name} (${args.locationId})`);
    try {
      const result = await logBacklinkAction(args);
      console.log(`    → status=${result.status} ok=${result.ok}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        isError: !result.ok,
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `log_backlink_action failed: ${err}` }], isError: true };
    }
  },
  { annotations: { destructiveHint: false, openWorldHint: true } }
);

const getContactedCountTool = tool(
  "get_contacted_count",
  "Return the total number of prospects already contacted across all previous runs. Useful for the final report.",
  {},
  async () => {
    try {
      const result = await getContactedCount();
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `get failed: ${err}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } }
);

const sendTelegramReportTool = tool(
  "send_telegram_report",
  "Send the final French run summary to Telegram. Call this as the VERY LAST step. Auto-splits messages longer than 4000 chars.",
  {
    text: z.string().describe("The full report text in French, Markdown formatted"),
  },
  async (args) => {
    console.log(`  📡 send_telegram_report (${args.text.length} chars)`);
    try {
      const result = await sendTelegramReport(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }], isError: !result.ok };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Telegram error: ${err}` }], isError: true };
    }
  },
  { annotations: { destructiveHint: false, openWorldHint: true } }
);

// ─── MCP server ─────────────────────────────────────────────────────────────

const mcpServer = createSdkMcpServer({
  name: "gbp_backlinks",
  version: "1.0.0",
  tools: [
    fetchActiveClientsTool,
    checkProspectContactedTool,
    sendGmailTool,
    markProspectContactedTool,
    logBacklinkActionTool,
    getContactedCountTool,
    sendTelegramReportTool,
  ],
});

// ─── Task prompt ────────────────────────────────────────────────────────────

const taskPrompt = `Exécute le cycle hebdomadaire complet de recherche de backlinks pour GBP Edge.

Étapes :
1. Appelle \`fetch_active_clients\` pour obtenir la liste des clients actifs depuis Notion.
2. Pour chaque client, recherche jusqu'à ${MAX_PROSPECTS_PER_CLIENT} prospects locaux non concurrents, vérifie-les avec \`check_prospect_contacted\`, envoie l'email avec \`send_gmail\`, puis appelle \`mark_prospect_contacted\`.
3. À la toute fin, appelle \`send_telegram_report\` avec un résumé complet en français.

Mode : ${DRY_RUN ? "DRY_RUN (aucun email réellement envoyé)" : "LIVE (les emails sont envoyés via Gmail)"}`;

console.log(
  `\n🚀 gbp-edge-backlinks-agent | max_prospects_per_client=${MAX_PROSPECTS_PER_CLIENT} | dry_run=${DRY_RUN}\n`
);

async function main() {
  for await (const message of query({
    prompt: taskPrompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      model: CLAUDE_MODEL,
      mcpServers: { gbp_backlinks: mcpServer },
      allowedTools: ["mcp__gbp_backlinks__*", "WebSearch", "WebFetch"],
      permissionMode: "bypassPermissions",
      maxTurns: 120,
      sandbox: { failIfUnavailable: false },
    } as any,
  })) {
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if (block.type === "text" && block.text) {
          console.log(`\n🤖 ${block.text.slice(0, 400)}`);
        }
        if (block.type === "tool_use") {
          console.log(`\n🔧 ${block.name}`);
        }
      }
    }
    if (message.type === "result") {
      if (message.subtype === "success") {
        console.log(`\n✅ Done. Cost: $${message.total_cost_usd?.toFixed(4) ?? "?"}`);
      } else {
        console.error(`\n❌ Agent failed:`, (message as any).errors);
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
