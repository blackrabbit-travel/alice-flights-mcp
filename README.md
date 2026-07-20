# Alice Flights — MCP Server for Flight Search

[![Alice Flights MCP server — Glama score](https://glama.ai/mcp/servers/blackrabbit-travel/alice-flights-mcp/badges/score.svg)](https://glama.ai/mcp/servers/blackrabbit-travel/alice-flights-mcp) [![smithery badge](https://smithery.ai/badge/orb/alice)](https://smithery.ai/servers/orb/alice)

**Add real-time flight search to Claude and any MCP client.** Alice Flights is a
hosted, remote [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
server that lets an AI assistant search flights — best, cheapest, and fastest
options with live seat availability — directly in a conversation. Powered by
[Alice](https://www.alice.co.il), one of Israel's best-known travel apps and a top flight seller.

> This repository is the **reference implementation** of the Alice Flights MCP
> server *and* documentation for the hosted service. For everyday use there's
> nothing to run — Alice hosts it at `https://mcp.alice.co.il/mcp` (one-click,
> no API key). You can also [**run this server yourself**](#run-it-yourself): it's
> a complete, standalone MCP server, not a proxy.

- **Endpoint:** `https://mcp.alice.co.il/mcp` (Streamable HTTP)
- **Auth:** OAuth 2.0 — one-click, anonymous consent. No account, no API key.
- **Official MCP Registry:** [`il.co.alice/flights`](https://registry.modelcontextprotocol.io/?search=il.co.alice/flights)
- **Glama:** [glama.ai/mcp/connectors/il.co.alice/flights](https://glama.ai/mcp/connectors/il.co.alice/flights)
- **Website & privacy:** [mcp.alice.co.il](https://mcp.alice.co.il) · [privacy policy](https://mcp.alice.co.il/privacy)

## Features

- **Best / cheapest / fastest** — results arrive categorized, not as a flat list; every
  option carries *why* it was picked.
- **Live seat availability** — a low-seats note when only a few seats remain.
- **Interactive results widget** (MCP Apps) — carrier chips, itinerary timeline, baggage
  info, tabs, and a nonstop filter; renders inline in hosts like Claude Cowork. *(Hosted
  service only.)*
- **Bilingual** — ask in **English or Hebrew**; Hebrew results render right-to-left. *(Hosted
  service only.)*
- **Read-only & anonymous** — it searches and links you to book on alice.co.il; it can't
  book, charge, or change anything, and it needs no sign-in.

## Add it to Claude

**claude.ai / Claude Desktop / Cowork:** open *Settings → Connectors → Add custom
connector*, paste the endpoint, and click **Connect** (approve the one-click consent):

```
https://mcp.alice.co.il/mcp
```

**Claude Code:**

```bash
claude mcp add --transport http alice https://mcp.alice.co.il/mcp
```

## Use it from any MCP client

Alice is a standard remote MCP server (Streamable HTTP + OAuth), so it works with any
MCP-capable client. Clients that read an `mcp.json`:

```json
{
  "mcpServers": {
    "alice": {
      "type": "http",
      "url": "https://mcp.alice.co.il/mcp"
    }
  }
}
```

For **stdio-only** clients, bridge the hosted endpoint with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "alice": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.alice.co.il/mcp"]
    }
  }
}
```

(The first connection opens a browser once for the anonymous OAuth consent.)

## Run it yourself

This repo is a complete, standalone MCP server (TypeScript, stdio transport) that talks
**directly** to the Alice flight-search API — no proxying.

```bash
git clone https://github.com/blackrabbit-travel/alice-flights-mcp
cd alice-flights-mcp
npm install
npm run build
cp .env.example .env      # add your Alice affiliate credentials
npm start                 # runs the MCP server on stdio
```

Configuration (see [`.env.example`](./.env.example)):

| Variable | Required | Description |
|---|---|---|
| `ALICE_API_URL` | for real searches | Alice flight-search API endpoint (issued by Alice) |
| `ALICE_AFFILIATE_ID` | for real searches | Your Alice affiliate ID |
| `ALICE_SECRET` | for real searches | Your Alice affiliate secret |

> **Credentials.** `ALICE_AFFILIATE_ID` / `ALICE_SECRET` are private partner credentials
> issued by Alice — they live only in your environment and are **never committed** to this
> repo. Without them the server still starts and lists its tools; searches return a clear
> "missing credentials" message. **Most users don't need this** — just use the hosted
> endpoint above.

Or with Docker:

```bash
docker build -t alice-flights-mcp .
docker run -i --rm -e ALICE_API_URL=… -e ALICE_AFFILIATE_ID=… -e ALICE_SECRET=… alice-flights-mcp
```

Point any stdio MCP client at the built entry (`node dist/index.js`).

## Tools

- **search_flights** — Search flights by **origin, destination, dates, passengers, and cabin
  class**. Returns options tagged `best` / `cheapest` / `fastest`, each with price, itinerary,
  baggage, and `seats_remaining`.

Try asking:
- *"Find me a flight from Tel Aviv to London next Thursday, back on Sunday."*
- *"What's the cheapest nonstop to Athens in August for two adults?"*

## About

Operated by Alice ([alice.co.il](https://www.alice.co.il)). The flight-search **backend**
(the search engine and pricing) is proprietary; the **MIT license** in this repository covers
this connector — the MCP server implementation, `Dockerfile`, `server.json`, and config
examples. The hosted service adds an interactive widget, bilingual UI, and OAuth consent on
top of the same `search_flights` tool.
