FROM node:20-alpine AS base

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Playwright to use system Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
FROM base AS deps
RUN npm ci --only=production

FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM base AS production

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Create browser profiles directory
RUN mkdir -p /app/browser-profiles

# Create entrypoint script that fixes volume permissions then drops to nestjs
RUN printf '#!/bin/sh\nchown -R nestjs:nodejs /app/browser-profiles 2>/dev/null || true\nexec su-exec nestjs node dist/main.js\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Install su-exec for dropping privileges
RUN apk add --no-cache su-exec

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["/app/entrypoint.sh"]
