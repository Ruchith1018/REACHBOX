// backend/src/routes/admin.ts
import express from 'express';
import { upsertKnowledge } from '../rag/vector';
import { error } from '../logger';
const router = express.Router();
import { getEmailById } from '../es/indexer';
import { suggestReply } from '../rag/vector';

/**
 * POST /api/admin/index-knowledge
 * Body: { id: string, text: string }
 */
router.post('/index-knowledge', async (req, res) => {
  const { id, text } = req.body;
  if (!id || !text) return res.status(400).json({ ok: false, error: 'id and text required' });
  try {
    await upsertKnowledge(id, text);
    return res.json({ ok: true });
  } catch (e: any) {
    error('index-knowledge fail', e);
    return res.status(500).json({ ok: false, error: e.message || 'index failed' });
  }
});

router.post('/:id/suggest-reply', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await getEmailById(id);
    if (!doc) return res.status(404).json({ ok: false, error: 'email not found' });
    const payload = `${doc.subject || ''}\n\n${doc.body || ''}`;
    const reply = await suggestReply(payload);
    res.json({ ok: true, reply });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || 'suggestion failed' });
  }
});

export default router;
