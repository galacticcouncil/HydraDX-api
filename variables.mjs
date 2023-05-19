import path from "path";
import { fileURLToPath } from "url";

export const IS_DOCKER_RUN = process.env.DOCKER_RUN !== undefined;
export const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined;

export const dirname = () => path.dirname(fileURLToPath(import.meta.url));

export const redisUri = () => {
  if (IS_GOOGLE_CLOUD_RUN) {
    return "redis://10.130.48.5:6379";
  } else {
    return "redis://127.0.0.1:6379";
  }
};

export const rpcUri = () => "wss://rpc.hydradx.cloud";

export const sqlUri = () => {
  if (IS_GOOGLE_CLOUD_RUN) {
    return "postgres://squid:squid@10.130.49.4:5432/squid";
  } else {
    return "postgres://squid:squid@127.0.0.1:5432/squid";
  }
};
