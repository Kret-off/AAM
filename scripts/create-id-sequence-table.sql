-- CreateTable
CREATE TABLE IF NOT EXISTS "id_sequence" (
    "table_name" TEXT NOT NULL,
    "current_value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "id_sequence_pkey" PRIMARY KEY ("table_name")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "id_sequence_table_name_idx" ON "id_sequence"("table_name");




