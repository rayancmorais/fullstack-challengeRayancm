import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const PLAYER_ID = 'c785afb7-b513-40e4-88df-b7b840400515'

const wallet = await prisma.wallet.upsert({
  where: { jogadorId: PLAYER_ID },
  update: {},
  create: {
    jogadorId: PLAYER_ID,
    nomeUsuario: 'player',
    saldo: 100_000_000n,
  },
})

console.log('Seed: wallet do player criada/atualizada')

await prisma.$disconnect()
