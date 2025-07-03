FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY src ./src

# Install TypeScript globally for building
RUN npm install -g typescript

# Build TypeScript
RUN npm run build

# Remove dev dependencies and TypeScript after build
RUN npm prune --production && \
    npm uninstall -g typescript

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (if needed for metrics/health checks)
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]