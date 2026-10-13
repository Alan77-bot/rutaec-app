
FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci

COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma7.config.ts ./prisma7.config.ts
COPY tsconfig.json ./tsconfig.json

RUN mkdir -p src/generated/prisma

RUN npx prisma generate

COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev"]
