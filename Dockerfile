# Builds and runs the Alice Flights MCP server locally over stdio.
#
# All configuration is provided at RUNTIME via environment variables (never baked
# into the image): ALICE_API_URL, ALICE_AFFILIATE_ID, ALICE_SECRET. The server
# boots without them; real searches then return a clear error. See .env.example.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install

# Build the TypeScript server.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

CMD ["node", "dist/index.js"]
