# ---- build: instala workspaces e gera o bundle do cliente ----
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @vigilia/client build

# ---- runtime: apenas server + shared + client/dist ----
FROM node:24-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile --prod --filter @vigilia/server --filter @vigilia/shared
COPY shared/src shared/src
COPY server/src server/src
COPY --from=build /app/client/dist client/dist
EXPOSE 3210
USER node
CMD ["pnpm", "--filter", "@vigilia/server", "start"]
