import { JOBS } from "./variables.mjs";
import { cacheCoingeckoTickersJob } from "./jobs/cache_coingecko_tickers_job.mjs";
import { newSqlClientWithFallback } from "./clients/sql.mjs";
import { newRedisClient } from "./clients/redis.mjs";

const { JOB_NAME, CONTINUOUS_JOB } = process.env;

const main = async () => {
  if (!JOB_NAME) {
    throw new Error(
      `JOB_NAME env var is required. Available jobs: ${Object.values(JOBS).join(
        ", "
      )}`
    );
  }

  console.log(`Job ${JOB_NAME} started`);
  console.log(`CONTINUOUS_JOB: ${isContinuousJob()}`);

  await executeJob(JOB_NAME);

  console.log(`Job ${JOB_NAME} completed`);
  process.exit();
};

async function executeJob(job_name) {
  // Validate job name before opening any connections
  if (!Object.values(JOBS).includes(job_name)) {
    throw new Error(
      `Job not found: ${job_name}. Available jobs: ${Object.values(JOBS).join(
        ", "
      )}`
    );
  }

  const redisClient = await newRedisClient();

  try {
    do {
      // Fresh SQL client each iteration: tries orca first, then fallbacks.
      // This ensures automatic failover if orca goes down between iterations.
      let sqlClient;
      try {
        sqlClient = await newSqlClientWithFallback();
        console.log(`Executing ${job_name}..`);
        switch (job_name) {
          case JOBS["cacheCoingeckoTickersJob"]: {
            await cacheCoingeckoTickersJob(sqlClient, redisClient);
            break;
          }
        }
        console.log(`Executed ${job_name}`);
      } finally {
        if (sqlClient) await sqlClient.release();
      }
    } while (isContinuousJob());
  } finally {
    await redisClient.disconnect();
  }

  return true;
}

function isContinuousJob() {
  return CONTINUOUS_JOB === "true";
}

// Start script
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
