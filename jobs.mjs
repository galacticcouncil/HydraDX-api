// Retrieve Job-defined env vars
const { CLOUD_RUN_TASK_INDEX = 0, CLOUD_RUN_TASK_ATTEMPT = 0 } = process.env;
// Retrieve User-defined env vars
const { JOB_NAME, CONTINUOUS_JOB } = process.env;

import { JOBS } from "./variables.mjs";
import { cacheRpcBlockHeightJob } from "./jobs/cache_rpc_block_height_job.mjs";
import { cacheCoingeckoTickersJob } from "./jobs/cache_coingecko_tickers_job.mjs";

const main = async () => {
  console.log(
    `Cloud Run Job ${JOB_NAME} started (task index #${CLOUD_RUN_TASK_INDEX}, attempt #${CLOUD_RUN_TASK_ATTEMPT})`
  );
  console.log(`CONTINUOUS_JOB: ${isContinuousJob()}`);

  await executeJob(JOB_NAME);

  console.log(
    `Cloud Run Job ${JOB_NAME} completed (task index #${CLOUD_RUN_TASK_INDEX})`
  );

  process.exit();
};

async function executeJob(job_name) {
  console.log(`Executing ${job_name}..`);

  switch (job_name) {
    case JOBS["cacheRpcBlockHeightJob"]: {
      await cacheRpcBlockHeightJob();
      break;
    }
    case JOBS["cacheCoingeckoTickersJob"]: {
      await cacheCoingeckoTickersJob();
      break;
    }
    default: {
      throw new Error(`Job not found: ${JOB_NAME}`);
    }
  }

  console.log(`Executed ${job_name}`);

  if (CONTINUOUS_JOB == "true") {
    return executeJob(job_name);
  } else {
    return true;
  }
}

function isContinuousJob() {
  return CONTINUOUS_JOB == "true";
}

// Start script
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
