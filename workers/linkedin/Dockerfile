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
ENV PATCHRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production
ENV DISPLAY=:99

# Install Xvfb (virtual display) and Google Chrome.
# Chrome has the correct JA3/JA4 TLS fingerprint that Playwright's bundled
# Chromium lacks — LinkedIn uses TLS fingerprinting as a bot signal.
RUN apt-get update && apt-get install -y xvfb wget gnupg && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Only production deps at runtime
COPY package.json ./
RUN npm install --ignore-scripts --omit=dev

# Copy compiled output from build stage
COPY --from=builder /app/dist ./dist

# Startup script: launch virtual display then start the worker
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

CMD ["./start.sh"]
