import { createPrismaClients, disconnectPrismaClients, resolveSyncOptions } from "./rds-sync-utils.mjs";

const STEP_SUMMARY_PREFIX = "__RDS_SYNC_STEP_SUMMARY__";

function toApplicationInsertData(sourceApplications) {
  return sourceApplications.map((row) => ({
    application_id: row.application_id,
    generation_id: row.generation_id,
    user_id: row.user_id,
    name: row.name,
    birth_date: row.birth_date,
    phone_number: row.phone_number,
    university: row.university,
    major: row.major,
    gender: row.gender,
    application_part_type: row.application_part_type,
    pass_status: row.pass_status,
    is_submitted: true,
    submitted_at: row.submitted_at,
    is_synced_to_notion: false,
    notion_synced_at: null,
  }));
}

async function syncApplicationBatch(sourcePrisma, localPrisma, cursorId, batchSize) {
  const sourceApplications = await sourcePrisma.application.findMany({
    where: {
      is_submitted: true,
      application_id: {
        gt: cursorId,
      },
    },
    orderBy: {
      application_id: "asc",
    },
    take: batchSize,
    select: {
      application_id: true,
      generation_id: true,
      user_id: true,
      name: true,
      birth_date: true,
      phone_number: true,
      university: true,
      major: true,
      gender: true,
      application_part_type: true,
      pass_status: true,
      submitted_at: true,
    },
  });

  if (sourceApplications.length === 0) {
    return {
      done: true,
      nextCursorId: cursorId,
      readCount: 0,
      insertedApplications: 0,
      insertedApplicationIds: [],
    };
  }

  const nextCursorId = sourceApplications[sourceApplications.length - 1].application_id;
  const sourceIds = sourceApplications.map((row) => row.application_id);

  const existingRows = await localPrisma.application.findMany({
    where: {
      application_id: {
        in: sourceIds,
      },
    },
    select: {
      application_id: true,
    },
  });

  const existingIdSet = new Set(existingRows.map((row) => row.application_id.toString()));
  const newApplications = sourceApplications.filter((row) => !existingIdSet.has(row.application_id.toString()));

  if (newApplications.length === 0) {
    return {
      done: false,
      nextCursorId,
      readCount: sourceApplications.length,
      insertedApplications: 0,
      insertedApplicationIds: [],
    };
  }

  const result = await localPrisma.application.createMany({
    data: toApplicationInsertData(newApplications),
    skipDuplicates: true,
  });

  return {
    done: false,
    nextCursorId,
    readCount: sourceApplications.length,
    insertedApplications: result.count,
    insertedApplicationIds: newApplications.map((row) => row.application_id.toString()),
  };
}

async function main() {
  const { localPrisma, sourcePrisma } = createPrismaClients();
  const { batchSize, maxBatches, startAfterId } = resolveSyncOptions();

  let cursorId = startAfterId;
  let batchIndex = 0;
  let totalRead = 0;
  let totalInsertedApplications = 0;
  const totalInsertedApplicationIds = [];

  console.info("[rds-sync:applications] started", {
    batchSize,
    maxBatches,
    startAfterId: cursorId.toString(),
  });

  try {
    while (true) {
      if (maxBatches > 0 && batchIndex >= maxBatches) {
        console.info("[rds-sync:applications] reached max batches", { maxBatches });
        break;
      }

      const batch = await syncApplicationBatch(sourcePrisma, localPrisma, cursorId, batchSize);
      if (batch.done) {
        break;
      }

      batchIndex += 1;
      cursorId = batch.nextCursorId;
      totalRead += batch.readCount;
      totalInsertedApplications += batch.insertedApplications;
      totalInsertedApplicationIds.push(...batch.insertedApplicationIds);

      console.info("[rds-sync:applications] batch completed", {
        batchIndex,
        readCount: batch.readCount,
        insertedApplications: batch.insertedApplications,
        cursorId: cursorId.toString(),
      });
    }

    console.info("[rds-sync:applications] finished", {
      batches: batchIndex,
      totalRead,
      insertedApplications: totalInsertedApplications,
      finalCursorId: cursorId.toString(),
    });

    return {
      step: "applications",
      batches: batchIndex,
      totalRead,
      insertedCount: totalInsertedApplications,
      insertedIds: totalInsertedApplicationIds,
      finalCursorId: cursorId.toString(),
    };
  } finally {
    await disconnectPrismaClients(localPrisma, sourcePrisma);
  }
}

main()
  .then((summary) => {
    console.log(`${STEP_SUMMARY_PREFIX}${JSON.stringify(summary)}`);
  })
  .catch((error) => {
    console.error("[rds-sync:applications] failed", error);
    process.exitCode = 1;
  });
