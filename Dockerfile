# CyberChef Playground Docker Image
# Multi-stage build for optimal image size

# Stage 1: Base Node.js image
FROM node:20-alpine AS base

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Production image
FROM node:20-alpine

# Add labels for metadata
LABEL maintainer="CyberChef Playground"
LABEL description="CTF-style challenge platform for learning cryptography and reverse engineering"
LABEL version="2.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from base stage
COPY --from=base /app/node_modules ./node_modules

# Copy application files
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs challenges-config ./challenges-config
COPY --chown=nodejs:nodejs solutions ./solutions
COPY --chown=nodejs:nodejs challenges ./challenges

# Create necessary directories with correct permissions
RUN mkdir -p /app/challenges /app/challenges-config /app/solutions /app/public && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/progress', {headers: {'X-Session-ID': 'health-check'}}, (res) => { process.exit(res.statusCode === 200 || res.statusCode === 401 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "server.js"]