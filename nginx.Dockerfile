## BUILD FRONTEND ##
FROM node:18 AS frontend-app-builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build
## END BUILD ##

## NGINX ##
FROM filipton/proxied-nginx:latest

COPY --from=frontend-app-builder /app/dist /frontend
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
