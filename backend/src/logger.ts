// backend/src/logger.ts
export function info(...args: any[]) { console.log('[INFO]', ...args); }
export function warn(...args: any[]) { console.warn('[WARN]', ...args); }
export function error(...args: any[]) { console.error('[ERROR]', ...args); }
