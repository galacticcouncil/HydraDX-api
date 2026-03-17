import http from "http";
import { newRedisClient } from "./clients/redis.mjs";
import { runMonitorChecks, metrics } from "./jobs/monitor_job.mjs";

const MONITOR_PORT = Number(process.env.MONITOR_PORT ?? 9090);
const CHECK_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Prometheus text format helpers
// ---------------------------------------------------------------------------

function prometheusEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function gauge(name, help, labelSets) {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`];
  for (const { labels, value } of labelSets) {
    if (value === null) continue;
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${prometheusEscape(v)}"`)
      .join(",");
    lines.push(`${name}{${labelStr}} ${value}`);
  }
  return lines.join("\n");
}

function buildMetricsOutput() {
  const upLines = [];
  const ageLines = [];
  const lastCheckLines = [];

  for (const [endpoint, m] of Object.entries(metrics)) {
    const labels = { endpoint };
    upLines.push({ labels, value: m.up === null ? null : m.up ? 1 : 0 });
    ageLines.push({ labels, value: m.ageSeconds });
    lastCheckLines.push({ labels, value: m.lastCheck });
  }

  return [
    gauge(
      "hydration_endpoint_up",
      "1 if the endpoint check passed, 0 if it failed",
      upLines
    ),
    gauge(
      "hydration_data_age_seconds",
      "Seconds since the most recent data was produced (staleness-checked endpoints only)",
      ageLines
    ),
    gauge(
      "hydration_last_check_timestamp",
      "Unix timestamp of the most recent completed check",
      lastCheckLines
    ),
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// HTTP server – serves /metrics for Prometheus
// ---------------------------------------------------------------------------

function startMetricsServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/metrics") {
      const body = buildMetricsOutput();
      res.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      });
      res.end(body);
    } else if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(MONITOR_PORT, "0.0.0.0", () => {
    console.log(`[monitor] Metrics server listening on :${MONITOR_PORT}`);
  });

  return server;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const redisClient = await newRedisClient();
  console.log("[monitor] Redis connected");

  startMetricsServer();

  // Run immediately on start, then every minute
  await runMonitorChecks(redisClient);
  setInterval(() => runMonitorChecks(redisClient), CHECK_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[monitor] Fatal error:", err);
  process.exit(1);
});
