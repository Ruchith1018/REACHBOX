// backend/src/imap/sync.ts
import { ImapFlow } from 'imapflow';
import dotenv from 'dotenv';
import { parseRawEmail } from '../utils/mailparser';
import { indexEmailToES } from '../es/indexer';
import { classifyEmailAndNotify } from '../categorizer/classify';
import { info, warn, error } from '../logger';
dotenv.config();

const IMAP_JSON = process.env.IMAP_ACCOUNTS_JSON;

if (!IMAP_JSON) {
  warn('IMAP_ACCOUNTS_JSON not set - IMAP sync will not start');
}

export async function startImapForAccounts() {
  if (!IMAP_JSON) return;
  let accounts;
  try {
    accounts = JSON.parse(IMAP_JSON);
  } catch (e) {
    error('Invalid IMAP_ACCOUNTS_JSON:', e);
    return;
  }

  for (const acc of accounts) {
    startAccountLoop(acc).catch(e => error('startAccountLoop error:', e));
  }
}

async function startAccountLoop(acc: any) {
  while (true) {
    try {
      await startImapForAccount(acc);
      // if startImapForAccount returns (unexpected), wait then retry
      info('IMAP worker for', acc.user, 'exited normally; restarting in 5s');
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      error('IMAP worker crashed for', acc.user, e);
      // backoff
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function startImapForAccount(accountConfig: any) {
  const client = new ImapFlow({
    host: accountConfig.host,
    port: accountConfig.port,
    secure: accountConfig.secure,
    auth: { user: accountConfig.user, pass: accountConfig.password },
    logger: false
  });

  client.on('error', (err) => warn('IMAP client error', err));
  await client.connect();
  info('IMAP connected for', accountConfig.user);

  // ensure INBOX open
  await client.mailboxOpen('INBOX');

  // initial fetch: last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDateStr = since.toISOString().split('T')[0];

  info('Starting initial 30-day fetch for', accountConfig.user);
  for await (const msg of client.fetch({ since: sinceDateStr }, { source: true, envelope: true, uid: true })) {
    try {
      const parsed = await parseRawEmail(msg.source);
      const doc = {
        account: accountConfig.user,
        folder: 'INBOX',
        uid: msg.uid,
        subject: parsed.subject,
        from: parsed.from,
        to: parsed.to,
        body: parsed.text,
        date: parsed.date
      };
      await indexEmailToES(doc);
      classifyEmailAndNotify(doc).catch(e => warn('Classification failed after initial index', e));
    } catch (e) {
      warn('Initial fetch processing error', e);
    }
  }
  info('Initial fetch completed for', accountConfig.user);

  // Real-time: listen to 'exists' (new mail) and fetch newest UID
  client.on('exists', async (num) => {
    // When new message arrives, uidnext will be > previous highest
    try {
      const status = await client.status('INBOX', { uidnext: true });
      const newestUid = status.uidnext - 1;
      for await (const msg of client.fetch({ uid: newestUid }, { source: true, envelope: true, uid: true })) {
        try {
          const parsed = await parseRawEmail(msg.source);
          const doc = {
            account: accountConfig.user,
            folder: 'INBOX',
            uid: msg.uid,
            subject: parsed.subject,
            from: parsed.from,
            to: parsed.to,
            body: parsed.text,
            date: parsed.date
          };
          await indexEmailToES(doc);
          classifyEmailAndNotify(doc).catch(e => warn('Classification failed on new mail', e));
        } catch (e) {
          warn('Processing new message failed', e);
        }
      }
    } catch (e) {
      warn('Error fetching new message on exists event', e);
    }
  });

  // keep connection alive – ImapFlow's IDLE keeps it
  // Wait forever unless connection drops
  await new Promise((resolve, reject) => {
    client.on('close', () => {
      warn('IMAP connection closed for', accountConfig.user);
      resolve(undefined);
    });
    client.on('error', (e) => {
      warn('IMAP connection error (will reconnect)', e);
      // let outer loop reconnect
      resolve(undefined);
    });
  });

  // ensure graceful close
  try { await client.logout(); } catch {}
}
