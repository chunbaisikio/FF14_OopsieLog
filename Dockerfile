# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the frontend pointing storage mode to the local API
ENV VITE_STORAGE_MODE=api
RUN npm run build

# ---- Stage 2: Production Server ----
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy backend server script
COPY --from=builder /app/server ./server

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data

ENV DB_PATH=/app/data/data.db
ENV PORT=3001

EXPOSE 3001

# Start the server
CMD ["npm", "run", "server"]
