# CyberChef Playground Docker Image
# Multi-stage build for optimal image size

# Stage 1: Build — install Node deps
FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production deps and strip unnecessary files to keep node_modules lean
RUN npm ci --omit=dev && \
    find node_modules -name "*.md" -delete && \
    find node_modules -name "*.map" -delete && \
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "docs" -o -name ".github" \) \
        -exec rm -rf {} + 2>/dev/null || true && \
    npm cache clean --force

# Stage 2: Sync — shallow clone challenges from CCPG-Challenges repo
FROM alpine/git AS challenges

WORKDIR /ccpg-challenges
RUN git clone --depth=1 --single-branch https://github.com/ChickenLoner/CCPG-Challenges.git .

# Stage 3: Production image
FROM node:20-alpine

# Add labels for metadata
LABEL maintainer="CyberChef Playground"
LABEL description="CTF-style challenge platform for learning cryptography and reverse engineering"
LABEL version="2.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies with correct ownership at copy time (avoids a chown layer duplicating all files)
COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs flow-control.js ./
COPY --chown=nodejs:nodejs sync.js ./
COPY --chown=nodejs:nodejs ccpg.config.json ./
COPY --chown=nodejs:nodejs public ./public

# Copy only the challenges/ subfolder from the cloned CCPG-Challenges repo
COPY --from=challenges --chown=nodejs:nodejs /ccpg-challenges/challenges ./challenges

# Tell server.js where challenges live inside the container
ENV CHALLENGES_DIR=/app/challenges

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/progress', {headers: {'X-Session-ID': 'health-check'}}, (res) => { process.exit(res.statusCode === 200 || res.statusCode === 401 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "server.js"]
