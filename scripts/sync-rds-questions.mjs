import { createPrismaClients, disconnectPrismaClients, resolveSyncOptions } from "./rds-sync-utils.mjs";

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

async function fetchQuestionIdsByApplications(sourcePrisma, applicationIds) {
  const sourceAnswers = await sourcePrisma.applicationAnswer.findMany({
    where: {
      application_id: {
        in: applicationIds,
      },
    },
    select: {
      question_id: true,
    },
  });

  const questionIdSet = new Set(sourceAnswers.map((row) => row.question_id.toString()));
  return Array.from(questionIdSet).map((id) => BigInt(id));
}

async function syncQuestionBatch(sourcePrisma, localPrisma, cursorId, batchSize) {
  const sourceApplicationRows = await fetchSubmittedApplicationIds(sourcePrisma, cursorId, batchSize);

  if (sourceApplicationRows.length === 0) {
    return {
      done: true,
      nextCursorId: cursorId,
      readCount: 0,
      insertedQuestions: 0,
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
      insertedQuestions: 0,
    };
  }

  const questionIds = await fetchQuestionIdsByApplications(sourcePrisma, localApplicationIds);
  if (questionIds.length === 0) {
    return {
      done: false,
      nextCursorId,
      readCount: sourceApplicationRows.length,
      insertedQuestions: 0,
    };
  }

  const sourceQuestions = await sourcePrisma.question.findMany({
    where: {
      question_id: {
        in: questionIds,
      },
    },
    select: {
      question_id: true,
      generation_id: true,
      sequence: true,
      question_type: true,
      content: true,
      max_length: true,
    },
  });

  if (sourceQuestions.length === 0) {
    return {
      done: false,
      nextCursorId,
      readCount: sourceApplicationRows.length,
      insertedQuestions: 0,
    };
  }

  const result = await localPrisma.question.createMany({
    data: sourceQuestions,
    skipDuplicates: true,
  });

  return {
    done: false,
    nextCursorId,
    readCount: sourceApplicationRows.length,
    insertedQuestions: result.count,
  };
}

async function main() {
  const { localPrisma, sourcePrisma } = createPrismaClients();
  const { batchSize, maxBatches, startAfterId } = resolveSyncOptions();

  let cursorId = startAfterId;
  let batchIndex = 0;
  let totalRead = 0;
  let totalInsertedQuestions = 0;

  console.info("[rds-sync:questions] started", {
    batchSize,
    maxBatches,
    startAfterId: cursorId.toString(),
  });

  try {
    while (true) {
      if (maxBatches > 0 && batchIndex >= maxBatches) {
        console.info("[rds-sync:questions] reached max batches", { maxBatches });
        break;
      }

      const batch = await syncQuestionBatch(sourcePrisma, localPrisma, cursorId, batchSize);
      if (batch.done) {
        break;
      }

      batchIndex += 1;
      cursorId = batch.nextCursorId;
      totalRead += batch.readCount;
      totalInsertedQuestions += batch.insertedQuestions;

      console.info("[rds-sync:questions] batch completed", {
        batchIndex,
        readCount: batch.readCount,
        insertedQuestions: batch.insertedQuestions,
        cursorId: cursorId.toString(),
      });
    }

    console.info("[rds-sync:questions] finished", {
      batches: batchIndex,
      totalRead,
      insertedQuestions: totalInsertedQuestions,
      finalCursorId: cursorId.toString(),
    });
  } finally {
    await disconnectPrismaClients(localPrisma, sourcePrisma);
  }
}

main().catch((error) => {
  console.error("[rds-sync:questions] failed", error);
  process.exitCode = 1;
});
