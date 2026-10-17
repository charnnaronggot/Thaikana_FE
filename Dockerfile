FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG BUILD_CONFIGURATION=production
RUN npm run build -- --configuration ${BUILD_CONFIGURATION}

FROM nginx:stable-alpine
ENV PORT=8080
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/thaikana/browser /usr/share/nginx/html
EXPOSE 8080
