FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ./
RUN npm install

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public directory exists for Next.js
RUN mkdir -p public

# Set production env
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Build args for NEXT_PUBLIC_ variables (needed at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_TRPC_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_TRPC_URL=${NEXT_PUBLIC_TRPC_URL}

# Unit tests gate the deploy
RUN npm test

# Build Next.js with environment variables
RUN npm run build

# Production runner
FROM base AS runner
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy config files (needed for Next.js)
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./

# Copy built app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
