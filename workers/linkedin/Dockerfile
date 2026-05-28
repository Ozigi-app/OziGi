# Use the official Playwright image — Chromium + all system deps pre-installed
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Skip browser download — browsers already exist in the image at /ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

# Install dependencies (no postinstall browser download)
COPY package.json ./
RUN npm install --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
