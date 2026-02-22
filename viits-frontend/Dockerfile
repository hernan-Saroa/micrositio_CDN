# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev && npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ───────────────────────────────────
FROM nginx:1.25-alpine AS runtime

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
