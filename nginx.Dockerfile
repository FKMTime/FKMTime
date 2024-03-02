## BUILD FLUTTER ##
FROM debian:latest AS delegate-app-builder

RUN apt-get update
RUN apt-get install -y curl git wget unzip libgconf-2-4 gdb libstdc++6 libglu1-mesa fonts-droid-fallback python3
RUN apt-get clean

ENV DEBIAN_FRONTEND=dialog
ENV PUB_HOSTED_URL=https://pub.flutter-io.cn
ENV FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn

RUN git clone --branch master --single-branch https://github.com/flutter/flutter.git /usr/local/flutter

ENV PATH="/usr/local/flutter/bin:/usr/local/flutter/bin/cache/dart-sdk/bin:${PATH}"

RUN flutter doctor -v

WORKDIR /app
COPY ./delegate_app .

RUN touch .env

RUN flutter pub get
RUN flutter build web
## END BUILD ##

## BUILD FRONTEND ##
FROM node:18 AS frontend-app-builder

WORKDIR /app
COPY ./admin-site/package*.json ./
RUN npm install
COPY ./admin-site .
RUN npm run build
## END BUILD ##



## NGINX ##
FROM nginx:alpine

RUN apk add openssl && rm -rf /var/cache/apk/*
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/nginx.key -out /etc/ssl/certs/nginx.crt \
    -subj "/C=PL/ST=/L=/O=FKM/OU=/CN=delegate.lan"
RUN openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

RUN mkdir -p /etc/nginx/snippets

COPY --from=delegate-app-builder /app/build/web /delegate
COPY --from=frontend-app-builder /app/dist /frontend

EXPOSE 80
COPY ./nginx/ssl-params.conf /etc/nginx/snippets/ssl-params.conf
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY ./nginx/entrypoint.sh /entrypoint.sh

CMD ["/entrypoint.sh"]
