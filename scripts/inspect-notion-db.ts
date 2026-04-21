import "dotenv/config";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const dbId = process.env.NOTION_CLIENTS_DB_ID!;

const db: any = await notion.databases.retrieve({ database_id: dbId });
console.log("DB title:", db.title?.map((t: any) => t.plain_text).join(""));
console.log("\nProperties:");
for (const [name, prop] of Object.entries<any>(db.properties)) {
  let extra = "";
  if (prop.type === "select") extra = ` options=[${prop.select.options.map((o: any) => o.name).join(", ")}]`;
  if (prop.type === "status") extra = ` options=[${prop.status.options.map((o: any) => o.name).join(", ")}]`;
  if (prop.type === "multi_select") extra = ` options=[${prop.multi_select.options.map((o: any) => o.name).join(", ")}]`;
  console.log(`  - "${name}" (${prop.type})${extra}`);
}

console.log("\nFirst 3 rows (property values):");
const q: any = await notion.databases.query({ database_id: dbId, page_size: 3 });
for (const page of q.results) {
  console.log("---");
  for (const [name, prop] of Object.entries<any>(page.properties)) {
    const val = JSON.stringify(prop).slice(0, 150);
    console.log(`  ${name} (${prop.type}): ${val}`);
  }
}
