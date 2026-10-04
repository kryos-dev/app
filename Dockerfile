# Base Node.js image
# Next.js 16 needs Node >= 20; 22 is the current LTS.
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy all project files
COPY . .

# Set Next.js telemetry to disabled
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders: lib/db and lib/encryption throw at import when
# these are unset, and `next build` imports route modules. Real values come
# from the runtime env (compose env_file); nothing here reaches the image.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build

ENV CSRF_SECRET=build
# NEXT_PUBLIC_* are inlined at build time; override with --build-arg.
ARG NEXT_PUBLIC_APP_NAME=Zola
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# The assert-based tests behind `npm test`. They run here because the builder
# stage has already paid for `npm ci`. A failure means no image is pushed, so
# the running container keeps serving.
RUN npm test

# Build the application
RUN npm run build

# Verify standalone build was created
RUN ls -la .next/ && \
    if [ ! -d ".next/standalone" ]; then \
      echo "ERROR: .next/standalone directory not found. Make sure output: 'standalone' is set in next.config.ts"; \
      exit 1; \
    fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Drizzle migrations, applied on boot by instrumentation.ts
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# Attachment blobs live on a mounted volume. Create the directory here so an
# empty named volume inherits nextjs ownership when Docker seeds it from the
# image; a bare mount would land root-owned and the app runs as uid 1001.
RUN mkdir -p /data/blobs && chown -R nextjs:nodejs /data

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Set environment variable for port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Health check: 127.0.0.1, not localhost -- alpine resolves localhost to ::1
# first and Next listens on IPv4 only, so the check failed inside the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
