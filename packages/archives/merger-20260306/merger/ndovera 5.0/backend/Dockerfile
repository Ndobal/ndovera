# backend/Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build tools for native dependencies (e.g., sqlite3)
RUN apk add --no-cache make gcc g++ python3

# Copy package manifest and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy backend source code
COPY . .

# Create directory for SQLite databases (will be mounted as a volume)
RUN mkdir -p /app/local_databases

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["node", "server.js"]
