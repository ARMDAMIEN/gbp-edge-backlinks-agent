FROM node:22-slim

WORKDIR /app

RUN npm install -g tsx

COPY package*.json tsconfig.json ./
RUN npm ci --production

COPY src ./src
COPY scripts ./scripts

CMD ["tsx", "src/index.ts"]
