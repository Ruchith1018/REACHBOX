// backend/src/routes/emails.ts
import express from 'express';
import { searchEmails, getEmailById } from '../es/indexer';
import { suggestReply } from '../rag/vector';
import { error } from '../logger';

const router = express.Router();

/**
 * GET /api/emails?q=&account=&folder=&page=&size=
 * Response: { ok: true, total, hits }
 */
router.get('/', async (req, res) => {
  try {
    const { total, hits } = await searchEmails(req.query);
    res.json({ ok: true, total, results: hits });
  } catch (e: any) {
    error('GET /api/emails failed', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/emails/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await getEmailById(id);

    if (!doc) {
      return res.status(404).json({ error: "Email not found" });
    }

    return res.json(doc);

  } catch (e) {
    return res.status(404).json({ error: "Invalid ID" });
  }
});


/**
 * POST /api/emails/:id/suggest-reply
 * Returns { ok: true, reply: string }
 */
router.post('/:id/suggest-reply', async (req, res) => {
  try {
    const id = req.params.id;

    const doc = await getEmailById(id);
    if (!doc) {
      console.log("[SUGGEST-REPLY] ERROR: Email not found:", id);
      return res.status(404).json({ ok: false, error: 'Email not found' });
    }

    console.log("[SUGGEST-REPLY] Loaded email:", {
      id,
      subject: doc.subject,
      bodyLen: doc.body?.length || 0
    });

    const subject = doc.subject || "";
    const body = doc.body || "";
    const payload = `${subject}\n\n${body}`;

    // 🔥 DEBUG: BEFORE RAG
    console.log("\n================ RAG INPUT =================");
    console.log("EMAIL TEXT SENT TO RAG:");
    console.log(payload.slice(0, 400) + (payload.length > 400 ? "..." : ""));
    console.log("============================================\n");

    const reply = await suggestReply(payload);

    // 🔥🔥🔥 BIG DEBUG PRINT — FINAL SUGGESTED REPLY 🔥🔥🔥
    console.log("\n================ RAG FINAL REPLY =================");
    console.log(reply);
    console.log("==================================================\n");

    return res.json({ ok: true, reply });

  } catch (e: any) {
    console.error("[SUGGEST-REPLY] ERROR:", e);
    return res.status(500).json({ ok: false, error: e.message || 'internal error' });
  }
});

export default router;
