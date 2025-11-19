// backend/src/utils/mailparser.ts
import { simpleParser } from 'mailparser';
import { warn } from '../logger';

export async function parseRawEmail(raw: Buffer | string) {
  try {
    const parsed = await simpleParser(raw);
    return {
      subject: parsed.subject || '',
      from: parsed.from?.text || '',
      to: parsed.to?.text || '',
      text: parsed.text || '',
      html: parsed.html || '',
      date: parsed.date ? parsed.date.toISOString() : new Date().toISOString()
    };
  } catch (e) {
    warn('mailparser failed, returning raw text fallback', e);
    return {
      subject: '',
      from: '',
      to: '',
      text: typeof raw === 'string' ? raw : raw.toString('utf8'),
      html: '',
      date: new Date().toISOString()
    };
  }
}
