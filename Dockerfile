FROM node:15-alpine
RUN apk add bash python make g++
RUN adduser -D runner
RUN mkdir -p /home/runner/app
WORKDIR /home/runner/app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install -g typescript
RUN chown -R runner:runner /home/runner

USER runner

RUN npm install

COPY lib ./lib
COPY config ./config
COPY contracts ./contracts
COPY scripts ./scripts
COPY hardhat.config.ts ./

RUN npm run compile
