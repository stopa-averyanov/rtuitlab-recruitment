FROM node:22.12.0-alpine

WORKDIR /usr/webservice/

RUN mkdir ./postgres-initdb/

COPY ./src/ ./src/
COPY ./config/ ./config/
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
COPY ./tsconfig.json ./tsconfig.json
COPY ./init.sql ./init.sql

RUN npm install

EXPOSE 8080

ENTRYPOINT [ "/bin/sh", "-c" ]
CMD [ "cp ./init.sql ./postgres-initdb/init.sql && npm run start -- --db.host=postgres" ]