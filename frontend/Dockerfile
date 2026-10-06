# 构建阶段：走统一的可恢复部署流水线 prepare → typecheck → build → verify。
# 任一环节失败都会在 .deploy/logs 留日志、在 deploy-status.json 标记卡点，构建直接终止。
FROM node:20-alpine AS build
WORKDIR /srv/web
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run deploy -- --reset

# 运行阶段：静态产物交给 vite preview，状态文件与样例快照随产物一起分发。
FROM node:20-alpine
WORKDIR /srv/web
ENV NODE_ENV=production
COPY --from=build /srv/web/node_modules ./node_modules
COPY --from=build /srv/web/package.json ./package.json
COPY --from=build /srv/web/dist ./dist
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
