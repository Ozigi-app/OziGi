import { Client, Receiver } from "@upstash/qstash";

// QStash client for scheduling HTTP requests
export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// Receiver for verifying incoming QStash requests
export const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/**
 * Schedule a post to be published at an exact time
 * @param postId - The ID of the scheduled post
 * @param scheduledFor - ISO string of when to publish
 * @returns The QStash message ID
 */
export async function schedulePostWithQStash(
  postId: string,
  scheduledFor: string
): Promise<string> {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes("localhost")) {
    throw new Error(
      "APP_URL is not set to a public URL. QStash cannot deliver webhooks to localhost. " +
      "Set APP_URL=https://your-production-domain.com in your environment variables."
    );
  }
  const publishUrl = `${appUrl}/api/qstash/publish`;
  
  // Calculate delay in seconds from now
  const scheduledTime = new Date(scheduledFor).getTime();
  const now = Date.now();
  const delaySeconds = Math.max(0, Math.floor((scheduledTime - now) / 1000));
  
  const response = await qstashClient.publishJSON({
    url: publishUrl,
    body: { postId },
    delay: delaySeconds,
    retries: 3,
  });
  
  console.log(`[QStash] Scheduled post ${postId} for ${scheduledFor} (delay: ${delaySeconds}s), messageId: ${response.messageId}`);
  
  return response.messageId;
}

/**
 * Cancel a scheduled QStash message
 * @param messageId - The QStash message ID to cancel
 */
export async function cancelQStashMessage(messageId: string): Promise<void> {
  try {
    await qstashClient.messages.delete(messageId);
    console.log(`[QStash] Cancelled message ${messageId}`);
  } catch (error) {
    console.error(`[QStash] Failed to cancel message ${messageId}:`, error);
  }
}

/**
 * Enqueue an async generation job.
 * The worker URL defaults to /api/qstash/generate on this host, but can be
 * overridden via GENERATION_WORKER_URL to point at a Cloud Run endpoint with
 * a longer timeout — no other code changes needed.
 */
export async function enqueueGenerationJob(
  jobId: string,
  appUrl: string,
): Promise<string> {
  const workerUrl =
    process.env.GENERATION_WORKER_URL ||
    `${appUrl}/api/qstash/generate`;

  // Local dev: call the worker directly instead of going through QStash,
  // since QStash can't deliver webhooks to localhost. Run the worker with:
  //   npx tsx worker/server.ts
  // and set GENERATION_WORKER_URL=http://localhost:8080 in .env.local
  if (workerUrl.includes('localhost')) {
    console.log(`[QStash] Dev mode — calling worker directly at ${workerUrl}`);
    fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch((err) => console.error('[QStash] Dev worker call failed:', err));
    return 'dev-direct';
  }

  const response = await qstashClient.publishJSON({
    url: workerUrl,
    body: { jobId },
    retries: 3,
  });

  console.log(`[QStash] Enqueued generation job ${jobId}, messageId: ${response.messageId}`);
  return response.messageId;
}

/**
 * Verify that an incoming request is from QStash
 */
export async function verifyQStashRequest(
  signature: string,
  body: string
): Promise<boolean> {
  try {
    const isValid = await qstashReceiver.verify({
      signature,
      body,
    });
    return isValid;
  } catch (error) {
    console.error("[QStash] Signature verification failed:", error);
    return false;
  }
}

/**
 * Create a recurring QStash schedule that fires the promotional cron daily at 10am UTC.
 * Returns the QStash scheduleId — store this if you need to delete it later.
 */
export async function createPromoSchedule(): Promise<string> {
  const appUrl = process.env.APP_URL;
  if (!appUrl || appUrl.includes("localhost")) {
    throw new Error(
      "APP_URL must be a public URL. QStash cannot deliver webhooks to localhost."
    );
  }

  const response = await qstashClient.schedules.create({
    destination: `${appUrl}/api/cron/promotional`,
    cron: "0 10 * * *",
    retries: 3,
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      "Upstash-Method": "GET",
    },
  });

  console.log(`[QStash] Created promo schedule: ${response.scheduleId}`);
  return response.scheduleId;
}

/**
 * Delete a QStash schedule by ID.
 */
export async function deletePromoSchedule(scheduleId: string): Promise<void> {
  await qstashClient.schedules.delete(scheduleId);
  console.log(`[QStash] Deleted promo schedule: ${scheduleId}`);
}

/**
 * List all QStash schedules (useful for finding the current promo schedule ID).
 */
export async function listSchedules() {
  return qstashClient.schedules.list();
}
