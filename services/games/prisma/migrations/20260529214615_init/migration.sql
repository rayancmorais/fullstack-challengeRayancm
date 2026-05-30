-- CreateTable
CREATE TABLE "rodadas" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "hashSeedServidor" TEXT NOT NULL,
    "seedServidor" TEXT NOT NULL,
    "pontoCrash" DOUBLE PRECISION NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "crashadoEm" TIMESTAMP(3),

    CONSTRAINT "rodadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apostas" (
    "id" TEXT NOT NULL,
    "rodadaId" TEXT NOT NULL,
    "jogadorId" TEXT NOT NULL,
    "nomeUsuario" TEXT NOT NULL,
    "valorCentavos" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "multiplicadorSaque" DOUBLE PRECISION,
    "pagamentoCentavos" BIGINT,
    "apostadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apostas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apostas_rodadaId_jogadorId_key" ON "apostas"("rodadaId", "jogadorId");

-- AddForeignKey
ALTER TABLE "apostas" ADD CONSTRAINT "apostas_rodadaId_fkey" FOREIGN KEY ("rodadaId") REFERENCES "rodadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
