# --- Stage 1: Build & Dependency Resolution ---
FROM node:20-slim AS builder
WORKDIR /app

# Install all dependencies (including devDependencies) for build/test tasks
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# --- Stage 2: Production Runtime ---
FROM node:20-slim AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install production dependencies only (optimized for layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Deploy application artifacts from builder
COPY --from=builder /app .

# Ensure environment hygiene by removing any non-production leftovers
RUN npm prune --production

# Run as non-privileged user for security
USER node

# Expose port for Google Cloud Run compatibility
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
