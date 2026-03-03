import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// --- Generic CRUD helpers for JSONB tables ---
// Each table has: id TEXT PRIMARY KEY, data JSONB NOT NULL

export async function loadAll<T extends { id: string }>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('data');
  if (error) {
    console.error(`Failed to load ${table}:`, error.message);
    return [];
  }
  return (data || []).map((row: { data: T }) => row.data);
}

export async function upsertRecord<T extends { id: string }>(table: string, record: T): Promise<void> {
  const { error } = await supabase
    .from(table)
    .upsert({ id: record.id, data: record }, { onConflict: 'id' });
  if (error) {
    console.error(`Failed to upsert ${table}/${record.id}:`, error.message);
  }
}

export async function deleteRecord(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.error(`Failed to delete ${table}/${id}:`, error.message);
  }
}

export async function upsertMany<T extends { id: string }>(table: string, records: T[]): Promise<void> {
  const rows = records.map(r => ({ id: r.id, data: r }));
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`Failed to bulk upsert ${table}:`, error.message);
  }
}

// --- Table names ---
export const TABLES = {
  users: 'cm_users',
  priorities: 'cm_priorities',
  attributes: 'cm_attributes',
  requests: 'cm_requests',
  inviteTokens: 'cm_invite_tokens',
} as const;
