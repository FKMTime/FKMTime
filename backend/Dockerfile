FROM node:lts-alpine AS build
RUN npm install -g @nestjs/cli
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV production

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npx prisma -v
RUN npm run build

FROM node:lts-alpine
RUN apk add --no-cache curl
RUN apk add --no-cache openssl

WORKDIR /app
COPY --from=build /app/dist/src /app
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/entrypoint.sh /app/entrypoint.sh

ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

EXPOSE 5000
CMD [ "/app/entrypoint.sh" ]
