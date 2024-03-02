FROM nginx:alpine

RUN apk add openssl && rm -rf /var/cache/apk/*
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/nginx.key -out /etc/ssl/certs/nginx.crt \
    -subj "/C=PL/ST=/L=/O=FKM/OU=/CN=delegate.lan"
RUN openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

RUN mkdir -p /etc/nginx/snippets

EXPOSE 80
COPY ./ssl-params.conf /etc/nginx/snippets/ssl-params.conf
COPY ./default.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
