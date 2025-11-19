// backend/src/utils/slack.ts
import axios from 'axios';
import dotenv from 'dotenv';
import { warn, info, error } from '../logger';
dotenv.config();

const SLACK_URL = process.env.SLACK_WEBHOOK_URL;

if (!SLACK_URL) {
  warn('SLACK_WEBHOOK_URL not set - Slack notifications disabled');
}

/**
 * sendSlackNotification
 * - text: plain text fallback
 * - blocks: optional Slack Block Kit JSON
 * - maxRetries: attempt count for rate-limit / transient failures
 */
export async function sendSlackNotification({
  text,
  blocks,
  maxRetries = 3
}: {
  text: string;
  blocks?: any;
  maxRetries?: number;
}) {
  if (!SLACK_URL) {
    warn('sendSlackNotification skipped: SLACK_WEBHOOK_URL not configured');
    return;
  }

  const payload: any = { text };
  if (blocks) payload.blocks = blocks;

  let attempt = 0;
  const backoff = (i: number) => 500 * Math.pow(2, i); // 500ms, 1000ms, 2000ms

  while (attempt < maxRetries) {
    try {
      await axios.post(SLACK_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      info('Slack notification sent');
      return;
    } catch (err: any) {
      attempt++;
      const status = err?.response?.status;
      warn(`Slack post failed (attempt ${attempt}/${maxRetries})`, status || err?.message || err);
      if (attempt >= maxRetries) {
        error('Slack notification permanently failed', err?.response?.data || err?.message || err);
        return;
      }
      await new Promise(r => setTimeout(r, backoff(attempt)));
    }
  }
}
