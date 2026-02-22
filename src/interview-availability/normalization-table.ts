import { prisma } from "@/lib/prisma";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS interview_availability_normalizations (
  application_id BIGINT NOT NULL PRIMARY KEY,
  source_text LONGTEXT NOT NULL,
  normalized_text LONGTEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  synced_at DATETIME(6) NULL,
  last_error LONGTEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_interview_availability_norm_application
    FOREIGN KEY (application_id) REFERENCES applications(application_id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  INDEX idx_interview_availability_norm_status (status),
  INDEX idx_interview_availability_norm_synced_at (synced_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

export async function ensureInterviewAvailabilityNormalizationTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
}
