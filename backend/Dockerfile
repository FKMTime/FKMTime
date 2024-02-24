FROM node:18

RUN apt update && apt upgrade -y
RUN apt install openssl -y

WORKDIR /app

ENV NODE_ENV production

RUN npm install -g @nestjs/cli

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start:prod"]
