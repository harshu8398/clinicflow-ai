import { logger } from "./logger";

type SyncJob = () => Promise<void>;

const queue: SyncJob[] = [];
let isProcessing = false;

export function enqueueSyncJob(job: SyncJob) {
  queue.push(job);
  processQueue().catch((err) => {
    logger.error({ err }, "Error processing Google Calendar sync queue");
  });
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    if (job) {
      try {
        await job();
      } catch (err) {
        logger.error({ err }, "Google Calendar sync queue job failed");
      }
    }
  }

  isProcessing = false;
}
