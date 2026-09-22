#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchFlights } from "./search_flights.js";
import type { Env } from "./types.js";

// Zero configuration by default. Searches go to Alice's public flight-search
// front door, which needs no credentials — the affiliate identity is attached
// server-side at Alice's edge, so nothing secret ever lives in this process or
// this repo. ALICE_API_URL is an optional override (testing, a future region).
const DEFAULT_API_URL = "https://api.alice.co.il/flights/search";
const env: Env = {
  ALICE_API_URL: process.env.ALICE_API_URL?.trim() || DEFAULT_API_URL,
};

const server = new McpServer({ name: "alice-flights", version: "1.0.0" });
registerSearchFlights(server, env);

const transport = new StdioServerTransport();
await server.connect(transport);

// Never write to stdout — it carries the MCP protocol. Logs go to stderr.
console.error("alice-flights-mcp running on stdio");
