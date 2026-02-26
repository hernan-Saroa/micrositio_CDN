# ── Stage 1: Install production dependencies ─────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Security: non-root user
RUN addgroup -S viits && adduser -S viits -G viits

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create writable directories for uploads and SQLite data
RUN mkdir -p data uploads temp logs \
    && chown -R viits:viits /app

USER viits

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

EXPOSE ${PORT:-3000}
ENV NODE_ENV=production

CMD ["node", "server.js"]
