const ENDPOINT = "https://gbp-edge-saas-adb8619b93ab.herokuapp.com/api/netlinking-actions/agent";
const AGENT_TOKEN = "agent-prod-b4k9-2m7x-gbpedge-outreach";

export async function logBacklinkAction(params: {
  locationId: string;
  url: string;
  name: string;
  actionDate: string;
}): Promise<{ ok: boolean; status: number; response: string }> {
  const body = {
    locationId: params.locationId,
    actionType: "BACKLINK",
    url: params.url,
    name: params.name,
    actionDate: params.actionDate,
    status: "CONTACTED",
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Token": AGENT_TOKEN,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, response: text.slice(0, 500) };
}
