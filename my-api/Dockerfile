# Use the official Bun base image (Debian-based)
FROM oven/bun:1 AS base

# Install curl and unzip for Bun/Playwright setup
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Install Chromium and its OS-level system dependencies (gtk, nss, alsa, gstreamer, etc.)
RUN bunx playwright install --with-deps chromium

# Copy the rest of the application code
COPY . .

# Expose Express server port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Default command starts the API server (can be overridden to run the worker)
CMD ["bun", "run", "src/index.ts"]
