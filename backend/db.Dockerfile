FROM mariadb

RUN apt update && apt upgrade -y
RUN apt install nodejs npm -y

RUN npm i -g prisma

EXPOSE 3306