import { createPrismaClients, disconnectPrismaClients, resolveSyncOptions } from "./rds-sync-utils.mjs";

const STEP_SUMMARY_PREFIX = "__RDS_SYNC_STEP_SUMMARY__";

async function fetchSubmittedApplicationIds(sourcePrisma, cursorId, batchSize) {
  return sourcePrisma.application.findMany({
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
    },
  });
}

async function filterLocalApplicationIds(localPrisma, sourceApplicationIds) {
  const rows = await localPrisma.application.findMany({
    where: {
      application_id: {
        in: sourceApplicationIds,
      },
    },
    select: {
      application_id: true,
    },
  });
  return rows.map((row) => row.application_id);
}

async function syncAnswerBatch(sourcePrisma, localPrisma, cursorId, batchSize) {
  const sourceApplicationRows = await fetchSubmittedApplicationIds(sourcePrisma, cursorId, batchSize);

  if (sourceApplicationRows.length === 0) {
    return {
      done: true,
      nextCursorId: cursorId,
      readCount: 0,
      insertedAnswers: 0,
      insertedAnswerIds: [],
    };
  }

  const nextCursorId = sourceApplicationRows[sourceApplicationRows.length - 1].application_id;
  const sourceApplicationIds = sourceApplicationRows.map((row) => row.application_id);
  const localApplicationIds = await filterLocalApplicationIds(localPrisma, sourceApplicationIds);

  if (localApplicationIds.length === 0) {
    return {
      done: false,
      nextCursorId,
      readCount: sourceApplicationRows.length,
      insertedAnswers: 0,
      insertedAnswerIds: [],
    };
  }

  const sourceAnswers = await sourcePrisma.applicationAnswer.findMany({
    where: {
      application_id: {
        in: localApplicationIds,
      },
    },
    select: {
      answer_id: true,
      application_id: true,
      question_id: true,
      content: true,
    },
  });

  if (sourceAnswers.length === 0) {
    return {
      done: false,
      nextCursorId,
      readCount: sourceApplicationRows.length,
      insertedAnswers: 0,
      insertedAnswerIds: [],
    };
  }

  const sourceAnswerIds = sourceAnswers.map((row) => row.answer_id);
  const existingAnswerRows = await localPrisma.applicationAnswer.findMany({
    where: {
      answer_id: {
        in: sourceAnswerIds,
      },
    },
    select: {
      answer_id: true,
    },
  });
  const existingAnswerIdSet = new Set(existingAnswerRows.map((row) => row.answer_id.toString()));
  const newAnswers = sourceAnswers.filter((row) => !existingAnswerIdSet.has(row.answer_id.toString()));

  if (newAnswers.length === 0) {
    return {
      done: false,
      nextCursorId,
      readCount: sourceApplicationRows.length,
      insertedAnswers: 0,
      insertedAnswerIds: [],
    };
  }

  const result = await localPrisma.applicationAnswer.createMany({
    data: newAnswers,
    skipDuplicates: true,
  });

  return {
    done: false,
    nextCursorId,
    readCount: sourceApplicationRows.length,
    insertedAnswers: result.count,
    insertedAnswerIds: newAnswers.map((row) => row.answer_id.toString()),
  };
}

async function main() {
  const { localPrisma, sourcePrisma } = createPrismaClients();
  const { batchSize, maxBatches, startAfterId } = resolveSyncOptions();

  let cursorId = startAfterId;
  let batchIndex = 0;
  let totalRead = 0;
  let totalInsertedAnswers = 0;
  const totalInsertedAnswerIds = [];

  console.info("[rds-sync:answers] started", {
    batchSize,
    maxBatches,
    startAfterId: cursorId.toString(),
  });

  try {
    while (true) {
      if (maxBatches > 0 && batchIndex >= maxBatches) {
        console.info("[rds-sync:answers] reached max batches", { maxBatches });
        break;
      }

      const batch = await syncAnswerBatch(sourcePrisma, localPrisma, cursorId, batchSize);
      if (batch.done) {
        break;
      }

      batchIndex += 1;
      cursorId = batch.nextCursorId;
      totalRead += batch.readCount;
      totalInsertedAnswers += batch.insertedAnswers;
      totalInsertedAnswerIds.push(...batch.insertedAnswerIds);

      console.info("[rds-sync:answers] batch completed", {
        batchIndex,
        readCount: batch.readCount,
        insertedAnswers: batch.insertedAnswers,
        cursorId: cursorId.toString(),
      });
    }

    console.info("[rds-sync:answers] finished", {
      batches: batchIndex,
      totalRead,
      insertedAnswers: totalInsertedAnswers,
      finalCursorId: cursorId.toString(),
    });

    return {
      step: "answers",
      batches: batchIndex,
      totalRead,
      insertedCount: totalInsertedAnswers,
      insertedIds: totalInsertedAnswerIds,
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
    console.error("[rds-sync:answers] failed", error);
    process.exitCode = 1;
  });
