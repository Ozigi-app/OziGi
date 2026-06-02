# ── Build stage — needs devDependencies (esbuild, tsx) ───────────────────────
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS builder

WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install all deps (including devDeps for esbuild)
COPY package.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

# Only production deps at runtime
COPY package.json ./
RUN npm install --ignore-scripts --omit=dev

# Copy compiled output from build stage
COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
