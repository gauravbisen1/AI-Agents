import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
export const pool = new Pool({ connectionString: config.databaseUrl });

export async function insertIncomingError(payload) {
  const result = await pool.query(
    `
      INSERT INTO incoming_errors (source, external_id, repo_hint, message, stack_trace)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      payload.source,
      payload.externalId || null,
      payload.repoHint || null,
      payload.message,
      payload.stackTrace || null
    ]
  );

  return result.rows[0].id;
}

export async function createErrorJob(incomingErrorId, mappedRepo, bullmqJobId) {
  await pool.query(
    `
      INSERT INTO error_jobs (incoming_error_id, mapped_repo, bullmq_job_id)
      VALUES ($1, $2, $3)
    `,
    [incomingErrorId, mappedRepo, String(bullmqJobId)]
  );
}
