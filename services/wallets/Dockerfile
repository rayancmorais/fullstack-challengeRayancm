FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

COPY . .

EXPOSE 4002

CMD sh -c "bunx prisma migrate deploy && bunx prisma db seed && bun run src/main.ts"
