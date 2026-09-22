# Builds and runs the Alice Flights MCP server locally over stdio.
#
# No configuration or credentials are needed: searches go to Alice's public
# flight-search endpoint by default. ALICE_API_URL may be passed at runtime to
# override the endpoint (see .env.example); nothing is baked into the image.
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
