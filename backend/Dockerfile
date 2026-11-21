FROM node:24-alpine AS build
RUN npm install --global npm@11.16.0
# Prisma's CLI needs OpenSSL to generate the client and the schema SQL; it
# stays in this stage, and the image it builds needs neither
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
# create.sql and version. The upgrade scripts (from-*.sql) need the git
# history, so publish-backend-image.yml writes them into prisma/sql before the
# build; a build without them can still create a fresh database.
RUN node scripts/schema-sql.mjs create
RUN npm run build
# --omit=optional too: @prisma/client names the Prisma CLI as an optional peer,
# so a dev-only prune keeps the CLI and its engine
RUN npm prune --omit=dev --omit=optional

FROM node:24-alpine
RUN apk add --no-cache curl

WORKDIR /app
COPY --from=build /app/dist/src /app
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/prisma/sql /app/prisma/sql
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/entrypoint.sh /app/entrypoint.sh

ENV NODE_ENV=production

EXPOSE 5000
CMD [ "/app/entrypoint.sh" ]
