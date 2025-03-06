FROM node:23.6-alpine

WORKDIR /usr/src/app

COPY app/package*.json ./

RUN npm install

COPY app .

EXPOSE 3000

CMD ["sh", "-c", "npm install && node app.js"] 