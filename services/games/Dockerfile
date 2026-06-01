FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

COPY . .

EXPOSE 4001

CMD sh -c "until bunx prisma migrate deploy; do echo 'Aguardando banco games...'; sleep 3; done && bun run src/main.ts"
