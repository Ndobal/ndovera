FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN npm ci --workspaces --include-workspace-root \
	&& npm cache clean --force \
	&& mkdir -p /app/storage /app/packages/server/src/data /app/packages/server/uploads \
	&& chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["npm", "--workspace=packages/server", "run", "start"]