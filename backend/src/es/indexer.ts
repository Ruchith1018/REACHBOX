// backend/src/es/indexer.ts
import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
import { info, error } from '../logger';
dotenv.config();

const ES_NODE = process.env.ES_NODE || 'http://localhost:9200';
export const es = new Client({ node: ES_NODE });

const INDEX = 'emails';

export async function ensureIndex() {
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      info('Creating ES index', INDEX);
      await es.indices.create({
        index: INDEX,
        body: {
          mappings: {
            properties: {
              account: { type: 'keyword' },
              folder: { type: 'keyword' },
              uid: { type: 'keyword' },
              date: { type: 'date' },
              subject: { type: 'text' },
              from: { type: 'text' },
              to: { type: 'text' },
              body: { type: 'text' },
              category: { type: 'keyword' }
            }
          }
        }
      });
    }
  } catch (e) {
    error('ensureIndex error', e);
    throw e;
  }
}

export async function indexEmailToES(email: any) {
  try {
    await ensureIndex();
    const id = `${email.account}_${email.uid}`;
    // Basic upsert: index will overwrite if exists
    await es.index({
      index: INDEX,
      id,
      document: {
        account: email.account,
        folder: email.folder,
        uid: String(email.uid),
        date: email.date,
        subject: email.subject,
        from: email.from,
        to: email.to,
        body: email.body,
        category: email.category || null
      },
      refresh: 'wait_for'
    });
    info('Indexed email', id);
  } catch (e) {
    error('indexEmailToES error', e);
  }
}

export async function updateCategory(id: string, category: string) {
  try {
    await es.update({
      index: INDEX,
      id,
      doc: { category },
      doc_as_upsert: true
    });
    info('Updated category for', id, '->', category);
  } catch (e) {
    error('updateCategory error', e);
  }
}

export async function searchEmails(query: any) {
  try {
    await ensureIndex();
    const q = String(query.q || '').trim();
    const account = query.account as string | undefined;
    const folder = query.folder as string | undefined;
    const page = Math.max(1, parseInt(String(query.page || '1')));
    const size = Math.min(100, Math.max(1, parseInt(String(query.size || '20'))));

    const must: any[] = [];
    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['subject^3', 'from', 'to', 'body']
        }
      });
    }
    if (account) must.push({ term: { account } });
    if (folder) must.push({ term: { folder } });

    const body = must.length ? { bool: { must } } : { match_all: {} };

    const resp = await es.search({
      index: INDEX,
      from: (page - 1) * size,
      size,
      query: body
    });

    const hits = resp.hits.hits.map(h => ({ id: h._id, ...(h._source as any) }));
    return { total: resp.hits.total, hits };
  } catch (e) {
    error('searchEmails error', e);
    return { total: 0, hits: [] };
  }
}

export async function getEmailById(id: string) {
  try {
    const resp = await es.get({ index: INDEX, id });
    return resp._source;
  } catch (e) {
    throw e;
  }
}
