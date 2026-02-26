# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build argument — can override API URL at build time
# Default: empty (nginx proxies /api/* to backend container)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Install ALL deps (devDeps needed for tsc + vite build)
COPY package*.json ./
RUN npm ci

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
