import {
  pgTable,
  uuid,
  text,
  char,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * REQ-S2.01 — alerts table.
 * UUID PK uses gen_random_uuid() (PG 13+ built-in; no pgcrypto extension required).
 * All timestamps are timestamptz (UTC).
 */
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceKey: text("source_key").notNull(),
    hazardKind: text("hazard_kind").notNull(),
    stateUf: char("state_uf", { length: 2 }).notNull(),
    severity: text("severity").notNull(),
    headline: text("headline").notNull(),
    body: text("body"),
    sourceUrl: text("source_url"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    payloadHash: text("payload_hash").notNull(),
    raw: jsonb("raw").notNull(),
  },
  (t) => ({
    stateFetchedIdx: index("alerts_state_fetched_idx").on(t.stateUf, t.fetchedAt.desc()),
    sourceHashUq: uniqueIndex("alerts_source_payload_hash_uq").on(t.sourceKey, t.payloadHash),
    validUntilIdx: index("alerts_valid_until_idx").on(t.validUntil),
  }),
);

/**
 * REQ-S2.01 — sources_health table.
 * Per-source health bookkeeping. PK = source_key.
 */
export const sourcesHealth = pgTable("sources_health", {
  sourceKey: text("source_key").primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  payloadHashDriftCount: integer("payload_hash_drift_count").notNull().default(0),
});

/**
 * REQ-S2.01 — snapshot_cache table (write-through archive of Upstash hot path).
 * snapshot_archive lands in plan 02-09 as a separate migration.
 */
export const snapshotCache = pgTable("snapshot_cache", {
  snapshotKey: text("snapshot_key").primaryKey(),
  body: jsonb("body").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  formulaVersion: text("formula_version").notNull(),
});

/**
 * REQ-S2.11 — snapshot_archive table (daily archive of snapshot_cache).
 * Composite PK (date, snapshot_key). 30-day retention enforced by /api/archive
 * cron job (plan 02-09). Body shape mirrors snapshotCache.body (StateSnapshot[]).
 */
export const snapshotArchive = pgTable(
  "snapshot_archive",
  {
    date: date("date").notNull(),
    snapshotKey: text("snapshot_key").notNull(),
    body: jsonb("body").notNull(),
    formulaVersion: text("formula_version").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.date, t.snapshotKey] }) }),
);

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type SourceHealth = typeof sourcesHealth.$inferSelect;
export type NewSourceHealth = typeof sourcesHealth.$inferInsert;
export type SnapshotCacheRow = typeof snapshotCache.$inferSelect;
export type NewSnapshotCacheRow = typeof snapshotCache.$inferInsert;
export type SnapshotArchiveRow = typeof snapshotArchive.$inferSelect;
export type NewSnapshotArchiveRow = typeof snapshotArchive.$inferInsert;
