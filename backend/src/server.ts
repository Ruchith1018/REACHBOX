// backend/src/server.ts
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRouter from './routes/admin';
import emailsRouter from './routes/emails';
import { startImapForAccounts } from './imap/sync';
import { ensureIndex } from './es/indexer';
import { info, error } from './logger';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

app.use('/api/admin', adminRouter);
app.use('/api/emails', emailsRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = parseInt(process.env.PORT || '4000', 10);
app.listen(port, async () => {
  try {
    info(`Backend listening on ${port}`);
    await ensureIndex();
    startImapForAccounts().catch(e => error('IMAP starter failed', e));
  } catch (e) {
    error('Startup failed', e);
    process.exit(1);
  }
});
