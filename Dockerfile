FROM node:18-alpine
WORKDIR /app
COPY server.js .
COPY public/ ./public/
EXPOSE 4000
ENV PORT=4000
ENV POOL_NAME=Parasite
ENV POLL_INTERVAL_MS=60000
ENV DISCORD_WEBHOOK_URL=""
CMD ["node", "server.js"]
