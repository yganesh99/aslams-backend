FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies separately for better caching
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Expose default port (can be overridden by PORT env)
EXPOSE 4000

# Use NODE_ENV=production by default
ENV NODE_ENV=production


CMD ["node", "src/server.js"]