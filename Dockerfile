FROM node:15-alpine

RUN apk add bash python make g++

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY lib ./lib
COPY config ./config
COPY contracts ./contracts
COPY scripts ./scripts
COPY hardhat.config.ts ./

RUN npm run compile
