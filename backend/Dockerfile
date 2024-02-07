FROM node

RUN apt update && apt upgrade -y
RUN apt install openssl -y

RUN npm i -g pnpm
RUN npm i -g prisma

ENV DATABASE_URL=mysql://root@localhost:3306/sls_times

WORKDIR /app

ADD package*.json .
RUN pnpm i

RUN prisma generate

ADD . .

EXPOSE 5000
CMD [ "pnpm", "start:dev" ]