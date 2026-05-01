CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"hazard_kind" text NOT NULL,
	"state_uf" char(2) NOT NULL,
	"severity" text NOT NULL,
	"headline" text NOT NULL,
	"body" text,
	"source_url" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"payload_hash" text NOT NULL,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshot_cache" (
	"snapshot_key" text PRIMARY KEY NOT NULL,
	"body" jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"formula_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources_health" (
	"source_key" text PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"payload_hash_drift_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "alerts_state_fetched_idx" ON "alerts" USING btree ("state_uf","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_source_payload_hash_uq" ON "alerts" USING btree ("source_key","payload_hash");--> statement-breakpoint
CREATE INDEX "alerts_valid_until_idx" ON "alerts" USING btree ("valid_until");