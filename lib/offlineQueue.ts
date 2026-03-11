import { upsertRecord, deleteRecord, upsertMany, DbResult } from './supabase';

// --- Types ---
interface QueuedOperation {
  id: string;
  type: 'upsert' | 'delete' | 'upsertMany';
  table: string;
  payload: any;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = 'cm-offline-queue';
const MAX_RETRIES = 5;

// --- Internal state ---
let queue: QueuedOperation[] = [];
let processing = false;
let listeners: Array<(count: number) => void> = [];

// --- Persistence ---
function save() {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* quota exceeded — keep in memory */ }
  notify();
}

function load() {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) queue = JSON.parse(stored);
  } catch { queue = []; }
}

function notify() {
  for (const fn of listeners) fn(queue.length);
}

// --- Public API ---

/** Subscribe to queue count changes */
export function onQueueChange(fn: (count: number) => void): () => void {
  listeners.push(fn);
  fn(queue.length); // immediate
  return () => { listeners = listeners.filter(l => l !== fn); };
}

/** Get current pending count */
export function getPendingCount(): number {
  return queue.length;
}

/** Enqueue a failed operation for retry */
export function enqueue(op: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>) {
  queue.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    retries: 0,
  });
  save();
}

/** Process the queue — retry all pending operations */
export async function processQueue(): Promise<void> {
  if (processing || queue.length === 0 || !navigator.onLine) return;
  processing = true;

  const toProcess = [...queue];
  const failed: QueuedOperation[] = [];

  for (const op of toProcess) {
    let result: DbResult;
    try {
      switch (op.type) {
        case 'upsert':
          result = await upsertRecord(op.table, op.payload);
          break;
        case 'delete':
          result = await deleteRecord(op.table, op.payload);
          break;
        case 'upsertMany':
          result = await upsertMany(op.table, op.payload);
          break;
        default:
          result = { success: false, error: 'Unknown operation type' };
      }
    } catch {
      result = { success: false, error: 'Network error' };
    }

    if (!result.success) {
      if (op.retries < MAX_RETRIES) {
        failed.push({ ...op, retries: op.retries + 1 });
      } else {
        console.warn(`Offline queue: dropping operation after ${MAX_RETRIES} retries:`, op);
      }
    }
  }

  queue = failed;
  processing = false;
  save();
}

/** Resilient upsert — tries directly, queues on failure */
export async function resilientUpsert<T extends { id: string }>(
  table: string,
  record: T
): Promise<DbResult> {
  try {
    const result = await upsertRecord(table, record);
    if (result.success) return result;
    enqueue({ type: 'upsert', table, payload: record });
    return { success: true, error: 'Queued for retry' };
  } catch {
    enqueue({ type: 'upsert', table, payload: record });
    return { success: true, error: 'Queued for retry (offline)' };
  }
}

/** Resilient delete — tries directly, queues on failure */
export async function resilientDelete(
  table: string,
  id: string
): Promise<DbResult> {
  try {
    const result = await deleteRecord(table, id);
    if (result.success) return result;
    enqueue({ type: 'delete', table, payload: id });
    return { success: true, error: 'Queued for retry' };
  } catch {
    enqueue({ type: 'delete', table, payload: id });
    return { success: true, error: 'Queued for retry (offline)' };
  }
}

/** Resilient bulk upsert */
export async function resilientUpsertMany<T extends { id: string }>(
  table: string,
  records: T[]
): Promise<DbResult> {
  try {
    const result = await upsertMany(table, records);
    if (result.success) return result;
    enqueue({ type: 'upsertMany', table, payload: records });
    return { success: true, error: 'Queued for retry' };
  } catch {
    enqueue({ type: 'upsertMany', table, payload: records });
    return { success: true, error: 'Queued for retry (offline)' };
  }
}

// --- Initialize ---
load();

// Retry on reconnect
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('Back online — processing offline queue...');
    processQueue();
  });
}
