// Smoke test for the Alice Flights MCP server.
// Spawns `node dist/index.js` and runs the real MCP handshake (initialize →
// tools/list → tools/call) via the official SDK client, then reports PASS/FAIL.
//
//   npm run build
//   node scripts/smoke.mjs                                        # boot + introspect + graceful no-creds search
//   ALICE_AFFILIATE_ID=… ALICE_SECRET=… node scripts/smoke.mjs    # full live search
//
// Optional args: origin destination departure_date [return_date]
//   node scripts/smoke.mjs TLV LON 2026-08-15 2026-08-20

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [origin = "TLV", destination = "LON", departure_date = "2026-08-15", return_date] =
  process.argv.slice(2);
const hasCreds = Boolean(process.env.ALICE_AFFILIATE_ID && process.env.ALICE_SECRET);

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
  const hasTool = names.includes("search_flights");
  console.log(`${hasTool ? "✓" : "✗"} tools/list → [${names.join(", ")}]`);
  if (!hasTool) failed = true;

  const args = { origin, destination, departure_date, adults: 1 };
  if (return_date) args.return_date = return_date;
  console.log(
    `… calling search_flights ${origin}→${destination} ${departure_date}` +
      `${return_date ? " / " + return_date : ""}  (creds: ${hasCreds ? "yes" : "no"})`
  );
  const res = await client.callTool({ name: "search_flights", arguments: args });
  const text = res.content?.[0]?.text ?? "";
  if (res.isError) {
    if (hasCreds) {
      console.log("✗ search errored WITH creds present:\n   " + text);
      failed = true;
    } else {
      console.log("✓ search returned a graceful error (no creds — expected):\n   " + text.split("\n")[0]);
    }
  } else {
    console.log("✓ search succeeded — total:", res.structuredContent?.total);
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
