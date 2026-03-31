FROM node:20-alpine

RUN apk add --no-cache vips-dev build-base python3 ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && apk del build-base python3

COPY . .

RUN mkdir -p /app/cache /app/config /data && \
    chown -R node:node /app/cache /app/config /data

EXPOSE 3000

# Unraid Template
LABEL net.unraid.docker.managed="dockerman"
LABEL net.unraid.docker.webui="http://[IP]:[PORT:3100]/"
LABEL net.unraid.docker.icon="/app/public/icons/icon-512.png"

# Memory-Safety: sharp wird mit Concurrency 1 betrieben
ENV NODE_OPTIONS="--max-old-space-size=384"
ENV AUTO_SOURCES="true"

USER node

CMD ["node", "server.js"]
