## BUILD FRONTEND ##
FROM node:18 AS frontend-app-builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build
## END BUILD ##

## NGINX ##
FROM nginx:alpine

RUN apk add openssl && rm -rf /var/cache/apk/*
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/nginx.key -out /etc/ssl/certs/nginx.crt \
    -subj "/C=PL/ST=/L=/O=FKM/OU=/CN=delegate.lan"
RUN openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

RUN mkdir -p /etc/nginx/snippets

COPY --from=frontend-app-builder /app/dist /frontend

EXPOSE 80
COPY ./nginx/ssl-params.conf /etc/nginx/snippets/ssl-params.conf
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY ./nginx/entrypoint.sh /entrypoint.sh

CMD ["/entrypoint.sh"]
