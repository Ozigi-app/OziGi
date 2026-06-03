# ── Build stage — needs devDependencies (esbuild, tsx) ───────────────────────
FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS builder

WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

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
ENV DISPLAY=:99

# Install Xvfb — virtual display so Chromium runs headed (not headless) on the server
RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

# Only production deps at runtime
COPY package.json ./
RUN npm install --ignore-scripts --omit=dev

# Copy compiled output from build stage
COPY --from=builder /app/dist ./dist

# Startup script: launch virtual display then start the worker
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

CMD ["./start.sh"]
