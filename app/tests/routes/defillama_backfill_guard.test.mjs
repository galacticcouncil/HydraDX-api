import { test } from "tap";
import { defillamaTrustedFrom } from "../../../variables.mjs";

// The guard is a plain lexical date comparison on YYYY-MM-DD, which is what the
// route does. These pin the boundary itself rather than standing up fastify,
// which would need a live archive and a redis.
const before = (day) => day < defillamaTrustedFrom();

test("the trust boundary defaults to the measured one", async (t) => {
  t.equal(defillamaTrustedFrom(), "2026-02-01");
});

test("days before the boundary are refused", async (t) => {
  // no Broadcast.Swapped3 in the archive at all -> a sweep would report 0
  t.ok(before("2024-04-28"), "DefiLlama adapter start date");
  t.ok(before("2024-08-20"), "the 2024 fees gap");
  t.ok(before("2025-05-20"), "last day with no swap events");

  // archive has events, but the derived figures run up to 40% off
  t.ok(before("2025-05-21"), "first day with events, still untrusted");
  t.ok(before("2025-09-01"), "measured ratio 1.206");
  t.ok(before("2026-01-01"), "measured ratio 1.176");
});

test("days from the boundary onward are served", async (t) => {
  t.notOk(before("2026-02-01"), "measured ratio 1.002");
  t.notOk(before("2026-02-15"), "measured ratio 0.997");
  t.notOk(before("2026-07-05"), "a fillable gap day");
  t.notOk(before("2026-07-09"), "a fillable gap day");
  t.notOk(before("2026-08-27"), "current data");
});

test("the boundary is overridable for a deliberate backfill", async (t) => {
  const original = process.env.DEFILLAMA_TRUSTED_FROM;
  process.env.DEFILLAMA_TRUSTED_FROM = "2025-05-21";
  t.equal(defillamaTrustedFrom(), "2025-05-21");
  t.notOk("2025-06-01" < defillamaTrustedFrom(), "earlier era opens up");
  t.ok("2025-05-20" < defillamaTrustedFrom(), "the zero era stays shut");

  if (original === undefined) delete process.env.DEFILLAMA_TRUSTED_FROM;
  else process.env.DEFILLAMA_TRUSTED_FROM = original;
});
