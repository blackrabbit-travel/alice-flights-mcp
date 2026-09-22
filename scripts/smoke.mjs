// Smoke test for the Alice Flights MCP server.
// Spawns `node dist/index.js` and runs the real MCP handshake (initialize →
// tools/list → tools/call) via the official SDK client, then a LIVE search
// against Alice's public endpoint, and reports PASS/FAIL. No credentials needed.
//
//   npm run build
//   node scripts/smoke.mjs                        # TLV→LON, departing 30 days from now
//   node scripts/smoke.mjs TLV ATH 2026-11-05     # explicit route / dates
//   node scripts/smoke.mjs CDG NRT 2026-11-05 2026-11-12
//
// Mind the public endpoint's limiter: 10 searches per minute per IP.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Default departure is always in the future, so this never rots into a
// past-date rejection the way a hard-coded date would.
const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const [origin = "TLV", destination = "LON", departure_date = in30Days, return_date] =
  process.argv.slice(2);

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: process.env,
});
const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });

let failed = false;
try {
  await client.connect(transport);
  console.log("✓ connected — server booted and completed the MCP handshake");

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  const tool = tools.find((t) => t.name === "search_flights");
  console.log(`${tool ? "✓" : "✗"} tools/list → [${names.join(", ")}]`);
  if (!tool) failed = true;

  const a = tool?.annotations ?? {};
  const annotationsOk =
    a.readOnlyHint === true && a.destructiveHint === false && a.openWorldHint === true;
  console.log(
    `${annotationsOk ? "✓" : "✗"} annotations → readOnly=${a.readOnlyHint} destructive=${a.destructiveHint} openWorld=${a.openWorldHint}`
  );
  if (!annotationsOk) failed = true;

  const args = { origin, destination, departure_date, adults: 1 };
  if (return_date) args.return_date = return_date;
  console.log(
    `… calling search_flights ${origin}→${destination} ${departure_date}${return_date ? " / " + return_date : ""}`
  );
  const t0 = Date.now();
  const res = await client.callTool({ name: "search_flights", arguments: args });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const text = res.content?.[0]?.text ?? "";
  if (res.isError) {
    console.log(`✗ search errored after ${secs}s:\n   ` + text.split("\n")[0]);
    failed = true;
  } else {
    console.log(`✓ live search succeeded in ${secs}s — total: ${res.structuredContent?.total}`);
    console.log(text.split("\n").slice(0, 8).map((l) => "   " + l).join("\n"));
  }
} catch (e) {
  console.log("✗ smoke failed:", e?.message ?? e);
  failed = true;
} finally {
  await client.close().catch(() => {});
}

console.log(failed ? "\nRESULT: FAIL" : "\nRESULT: PASS");
process.exit(failed ? 1 : 0);
