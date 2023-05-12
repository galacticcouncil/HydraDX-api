import path from 'path';
import { fileURLToPath } from 'url';

export const RPC_ADDR = 'wss://rpc.hydradx.cloud';
export const dirname = () => path.dirname(fileURLToPath(import.meta.url));
