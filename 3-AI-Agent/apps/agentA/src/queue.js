import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config.js';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
export const queue = new Queue(config.queueName, { connection });

export async function enqueueErrorJob(data) {
  const job = await queue.add('triage-error', data, {
    attempts: Number(process.env.MAX_JOB_ATTEMPTS || 2),
    removeOnComplete: 100,
    removeOnFail: 100
  });

  return job;
}
