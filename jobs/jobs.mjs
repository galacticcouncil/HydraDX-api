// Retrieve Job-defined env vars
const { CLOUD_RUN_TASK_INDEX = 0, CLOUD_RUN_TASK_ATTEMPT = 0 } = process.env;
// Retrieve User-defined env vars
const { JOB_NAME } = process.env;

import { JOBS } from "../variables.mjs";
import { cacheRpcBlockHeightJob } from "./cache_rpc_block_height_job.mjs";

const main = async () => {
  console.log(
    `${JOB_NAME} started (task index #${CLOUD_RUN_TASK_INDEX}, attempt #${CLOUD_RUN_TASK_ATTEMPT})`
  );

  switch (JOB_NAME) {
    case JOBS["cacheRpcBlockHeightJob"]: {
      await cacheRpcBlockHeightJob();
      break;
    }
    default: {
      throw new Error(`Job not found: ${JOB_NAME}`);
    }
  }

  console.log(`${JOB_NAME} completed (task index #${CLOUD_RUN_TASK_INDEX})`);

  process.exit();
};

// Start script
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
