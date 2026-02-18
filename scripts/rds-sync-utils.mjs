import { PrismaClient } from "@prisma/client";

export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function parseBigInt(value, fallback) {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid bigint value: ${value}`);
  }
  return BigInt(value);
}

export function resolveSyncOptions() {
  return {
    batchSize: parsePositiveInt(process.env.RDS_SYNC_BATCH_SIZE, 200),
    maxBatches: parsePositiveInt(process.env.RDS_SYNC_MAX_BATCHES, 0),
    startAfterId: parseBigInt(process.env.RDS_SYNC_START_AFTER_ID, 0n),
  };
}

export function createPrismaClients() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) {
    throw new Error("SOURCE_DATABASE_URL is required.");
  }

  const localPrisma = new PrismaClient({
    log: ["error", "warn"],
  });

  const sourcePrisma = new PrismaClient({
    datasources: {
      db: {
        url: sourceUrl,
      },
    },
    log: ["error"],
  });

  return { localPrisma, sourcePrisma };
}

export async function disconnectPrismaClients(localPrisma, sourcePrisma) {
  await Promise.all([localPrisma.$disconnect(), sourcePrisma.$disconnect()]);
}
