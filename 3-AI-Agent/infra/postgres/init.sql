CREATE TABLE IF NOT EXISTS incoming_errors (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT,
  repo_hint TEXT,
  message TEXT NOT NULL,
  stack_trace TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_jobs (
  id BIGSERIAL PRIMARY KEY,
  incoming_error_id BIGINT NOT NULL REFERENCES incoming_errors(id),
  bullmq_job_id TEXT,
  mapped_repo TEXT,
  branch_name TEXT,
  pr_url TEXT,
  action_summary TEXT,
  checks_status TEXT,
  worker_status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incoming_errors_updated_at ON incoming_errors;
CREATE TRIGGER trg_incoming_errors_updated_at
BEFORE UPDATE ON incoming_errors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_error_jobs_updated_at ON error_jobs;
CREATE TRIGGER trg_error_jobs_updated_at
BEFORE UPDATE ON error_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
