FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN npm ci --workspaces --include-workspace-root \
	&& npm cache clean --force \
	&& mkdir -p /app/storage \
	&& chown -R node:node /app

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["npm", "--workspace=packages/super-admin-server", "run", "start"]