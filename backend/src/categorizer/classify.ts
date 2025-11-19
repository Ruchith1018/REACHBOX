// backend/src/categorizer/classify.ts
import { chatCompletion } from '../utils/openrouter';
import dotenv from 'dotenv';
import axios from 'axios';
import { updateCategory } from '../es/indexer';
import { warn } from '../logger';
import { sendSlackNotification } from '../utils/slack'; // <-- new import
dotenv.config();

const LABELS = ['Interested', 'Meeting Booked', 'Not Interested', 'Spam', 'Out of Office'];

/**
 * classifyEmail: uses the LLM to return one label from LABELS.
 * Returns fallback 'Not Interested' on failure.
 */
export async function classifyEmail(email: { subject?: string; body?: string }) {
  const subject = (email.subject || '').slice(0, 800);
  const body = (email.body || '').slice(0, 3000);

  const prompt = `
You are a classifier. Choose exactly ONE label from the list below for the email:
[Interested, Meeting Booked, Not Interested, Spam, Out of Office]

Return ONLY the label name on a single line (no explanation).

Email Subject:
${subject}

Email Body:
${body}
  `.trim();

  try {
    const reply = await chatCompletion([{ role: 'user', content: prompt }]);
    const labelGuess = (reply || '').split('\n')[0].trim();
    const matched = LABELS.find(l => l.toLowerCase() === labelGuess.toLowerCase());
    if (matched) return matched;
  } catch (e) {
    warn('LLM classification failed', e);
  }

  // Fallback heuristics
  const combined = `${subject}\n${body}`.toLowerCase();
  if (/out of office|on leave|away from the office|ooo/i.test(combined)) return 'Out of Office';
  if (/schedule|book|available|slot|interview|call/i.test(combined)) return 'Meeting Booked';
  if (/unsubscribe|buy now|click here|free trial|win money|lottery|promo/i.test(combined)) return 'Spam';
  if (/interested|count me in|i am interested|sounds good|i would like/i.test(combined)) return 'Interested';
  return 'Not Interested';
}

/**
 * classifyEmailAndNotify: classify, update ES, and notify Slack/webhook when Interested.
 */
export async function classifyEmailAndNotify(email: { account: string; uid: string | number; subject?: string; body?: string; from?: string }) {
  const id = `${email.account}_${email.uid}`;
  try {
    const label = await classifyEmail({ subject: email.subject, body: email.body });
    await updateCategory(id, label);

    if (label === 'Interested') {
      // Build a helpful Slack payload with blocks (Slack Block Kit)
      const shortBody = (email.body || '').slice(0, 400).replace(/\n/g, ' ');
      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: `*Interested email detected*` } },
        { type: 'section', text: { type: 'mrkdwn', text: `*From:* ${email.from || 'unknown'}\n*Subject:* ${email.subject || '---'}` } },
        { type: 'section', text: { type: 'mrkdwn', text: `> ${shortBody}` } },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Account: \`${email.account}\`  •  ID: \`${id}\`` }]
        }
      ];

      // Send Slack notification (retries handled inside helper)
      await sendSlackNotification({
        text: `Interested email: ${email.subject || 'no-subject'}`,
        blocks
      }).catch(e => warn('Slack helper failed', e));

      // External webhook for automation (webhook.site etc.)
      try {
        
        if (process.env.EXTERNAL_WEBHOOK) {
          console.log("[DEBUG] Webhook triggered for Interested email",process.env.EXTERNAL_WEBHOOK);
          await axios.post(process.env.EXTERNAL_WEBHOOK, {
            id,
            account: email.account,
            subject: email.subject,
            from: email.from,
            category: label
          }, { timeout: 5000 });
        }
      } catch (e) {
        warn('External webhook failed', e);
      }
    }

    return label;
  } catch (e) {
    warn('classifyEmailAndNotify failed', e);
    await updateCategory(id, 'Not Interested').catch(()=>{});
    return 'Not Interested';
  }
}
