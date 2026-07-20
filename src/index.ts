#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchFlights } from "./search_flights.js";
import type { Env } from "./types.js";

// All configuration comes from the environment (see .env.example) — nothing is
// hardcoded. ALICE_API_URL is the Alice flight-search endpoint; ALICE_AFFILIATE_ID
// / ALICE_SECRET are the affiliate credentials. The server boots without them;
// searches then return a clear "missing configuration" error.
const env: Env = {
  ALICE_API_URL: process.env.ALICE_API_URL?.trim() ?? "",
  ALICE_AFFILIATE_ID: process.env.ALICE_AFFILIATE_ID ?? "",
  ALICE_SECRET: process.env.ALICE_SECRET ?? "",
};

const server = new McpServer({ name: "alice-flights", version: "1.0.0" });
registerSearchFlights(server, env);

const transport = new StdioServerTransport();
await server.connect(transport);

// Never write to stdout — it carries the MCP protocol. Logs go to stderr.
console.error("alice-flights-mcp running on stdio");
