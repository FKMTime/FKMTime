FROM node:21-alpine as builder
WORKDIR /app
RUN npm install -g prisma

COPY ./backend/prisma/schema.prisma /app/schema.prisma
RUN npx prisma migrate diff --from-empty --script --to-schema-datamodel /app/schema.prisma > /app/schema.sql
RUN  sed -i -e 's/CREATE TABLE/CREATE TABLE IF NOT EXISTS/g' /app/schema.sql

FROM mariadb:latest
COPY ./db/init.sql /docker-entrypoint-initdb.d/init.sql
COPY ./db/seed.sql /docker-entrypoint-initdb.d/seed.sql
COPY --from=builder /app/schema.sql /docker-entrypoint-initdb.d/schema.sql
RUN cat /docker-entrypoint-initdb.d/schema.sql >> /docker-entrypoint-initdb.d/init.sql
RUN cat /docker-entrypoint-initdb.d/seed.sql >> /docker-entrypoint-initdb.d/init.sql
RUN rm /docker-entrypoint-initdb.d/schema.sql /docker-entrypoint-initdb.d/seed.sql
