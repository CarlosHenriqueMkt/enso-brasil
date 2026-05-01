CREATE TABLE "snapshot_archive" (
	"date" date NOT NULL,
	"snapshot_key" text NOT NULL,
	"body" jsonb NOT NULL,
	"formula_version" text NOT NULL,
	CONSTRAINT "snapshot_archive_date_snapshot_key_pk" PRIMARY KEY("date","snapshot_key")
);
