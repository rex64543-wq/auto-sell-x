# Multi-stage lightweight production Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Final runtime image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose Web Dashboard Port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/auth/captcha || exit 1

# Start the Discord Bot & Web Dashboard
CMD ["npm", "start"]
