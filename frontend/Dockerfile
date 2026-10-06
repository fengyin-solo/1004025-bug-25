# 构建阶段：跑同一条部署流水线（环境→依赖→样例校验→类型检查→构建→产物核对），
# 本地 npm run build 与镜像构建走同一套口径；流水线失败则镜像构建失败。
FROM node:20-alpine AS build
WORKDIR /srv/web
COPY package.json ./
COPY . .
RUN npm run deploy

# 运行阶段：纯静态产物，由 nginx 提供（不再在容器里跑 vite dev）
FROM nginx:1.27-alpine
COPY --from=build /srv/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
