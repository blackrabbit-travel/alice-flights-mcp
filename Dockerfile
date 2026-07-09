# Runnable wrapper for the hosted Alice Flights MCP server, for directories and
# clients that introspect a runnable process rather than a bare remote URL.
# It bridges the remote Streamable-HTTP endpoint to stdio via mcp-remote.
#
# NOTE: the endpoint is OAuth-gated (one-click anonymous consent), so the first
# connection opens a browser to authorize; fully headless introspection must be
# able to complete that consent.
FROM node:22-alpine

# mcp-remote is fetched at runtime via npx; no build step or secrets required.
ENTRYPOINT ["npx", "-y", "mcp-remote", "https://mcp.alice.co.il/mcp"]
