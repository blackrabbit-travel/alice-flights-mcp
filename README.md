# Alice Flights — MCP Server for Flight Search

**Add real-time flight search to Claude and any MCP client.** Alice Flights is a
hosted, remote [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
server that lets an AI assistant search flights — best, cheapest, and fastest
options with live seat availability — directly in a conversation. Powered by
[Alice](https://www.alice.co.il), Israel's flight-booking travel app.

> This is the public **connector reference** for the Alice Flights MCP server. The
> server is hosted by Alice at `https://mcp.alice.co.il/mcp` — there's nothing to
> install or self-host. This repo documents how to connect and links to the
> official listings.

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
  info, tabs, and a nonstop filter; renders inline in hosts like Claude Cowork.
- **Bilingual** — ask in **English or Hebrew**; Hebrew results render right-to-left.
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

For **stdio-only** clients, bridge it with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

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

## Tools

- **search_flights** — Search flights by **origin, destination, dates, passengers, and cabin
  class** (with an optional `language` of `en`/`he`). Returns options tagged `best` /
  `cheapest` / `fastest`, each with price, itinerary, baggage, and `seats_remaining`.

Try asking:
- *"Find me a flight from Tel Aviv to London next Thursday, back on Sunday."*
- *"What's the cheapest nonstop to Athens in August for two adults?"*

## About

Operated by Alice ([alice.co.il](https://www.alice.co.il)). The hosted service's source is
proprietary; the **MIT license** in this repository covers only this connector reference
(README, `Dockerfile`, `server.json`, config examples).
