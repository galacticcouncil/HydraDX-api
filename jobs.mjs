import { JOBS } from "./variables.mjs";
import { cacheCoingeckoTickersJob } from "./jobs/cache_coingecko_tickers_job.mjs";
import { cacheDefillamaVolumeJob } from "./jobs/cache_defillama_volume_job.mjs";
import { newRedisClient } from "./clients/redis.mjs";

const { JOB_NAME, CONTINUOUS_JOB, JOB_INTERVAL_MS } = process.env;

// the loop used to spin with no delay, which was survivable while every
// iteration was a slow aggregate query. it is an http fetch now.
const intervalMs = Number(JOB_INTERVAL_MS ?? 60_000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      try {
        console.log(`Executing ${job_name}..`);
        switch (job_name) {
          case JOBS["cacheCoingeckoTickersJob"]: {
            const count = await cacheCoingeckoTickersJob(redisClient);
            console.log(`Executed ${job_name} (${count} tickers)`);
            break;
          }
          case JOBS["cacheDefillamaVolumeJob"]: {
            const volume = await cacheDefillamaVolumeJob(redisClient);
            console.log(`Executed ${job_name} (volume_usd ${volume})`);
            break;
          }
        }
      } catch (err) {
        // a continuous job must outlive a transient upstream failure; the
        // cached answer keeps serving until the next iteration succeeds.
        if (!isContinuousJob()) throw err;
        console.error(`[jobs] ${job_name} iteration failed: ${err.message}`);
      }

      if (isContinuousJob()) await sleep(intervalMs);
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
