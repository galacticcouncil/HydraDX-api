import { neckworkBaseUrl } from "../variables.mjs";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ATTEMPTS = 3;

// a 4xx will not fix itself on retry; everything below is transient
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function neckworkGet(
  path,
  { attempts = DEFAULT_ATTEMPTS, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  const url = `${neckworkBaseUrl()}${path}`;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(250 * 2 ** (attempt - 1));

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const error = new Error(`[neckwork] GET ${path} -> ${response.status}`);
        error.retryable = RETRYABLE_STATUS.has(response.status);
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error.retryable === false) throw error;
      lastError = error;
    }
  }

  throw new Error(
    `[neckwork] GET ${path} failed after ${attempts} attempts: ${lastError?.message}`
  );
}
