import { useEffect, useRef, useState } from 'react';
import {
  User,
  Priority,
  AttributeDefinition,
  RequestItem,
  InviteToken,
  MOCK_USERS,
  MOCK_PRIORITIES,
  MOCK_ATTRIBUTES,
} from '../types';
import { supabase, loadAll, upsertMany, TABLES } from '../lib/supabase';
import { useUserStore } from './userStore';
import { useAdminStore } from './adminStore';
import { useRequestStore } from './requestStore';
import { useInviteStore } from './inviteStore';

/**
 * Custom hook that loads all data from Supabase and sets up real-time subscriptions.
 * Returns `loading` state.
 */
export function useInitializeStores(): boolean {
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // --- Load all data from Supabase on mount ---
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [dbUsers, dbPriorities, dbAttributes, dbRequests, dbTokens] = await Promise.all([
          loadAll<User>(TABLES.users),
          loadAll<Priority>(TABLES.priorities),
          loadAll<AttributeDefinition>(TABLES.attributes),
          loadAll<RequestItem>(TABLES.requests),
          loadAll<InviteToken>(TABLES.inviteTokens),
        ]);

        if (cancelled) return;

        // Seed defaults if tables empty
        const { setUsers, resolveCurrentUser } = useUserStore.getState();
        const { setAttributes, setPriorities } = useAdminStore.getState();
        const { setRequests } = useRequestStore.getState();
        const { setInviteTokens } = useInviteStore.getState();

        if (dbUsers.length === 0) {
          await upsertMany(TABLES.users, MOCK_USERS);
          setUsers(MOCK_USERS);
        } else {
          setUsers(dbUsers);
        }

        if (dbPriorities.length === 0) {
          await upsertMany(TABLES.priorities, MOCK_PRIORITIES);
          setPriorities(MOCK_PRIORITIES);
        } else {
          setPriorities(dbPriorities);
        }

        if (dbAttributes.length === 0) {
          await upsertMany(TABLES.attributes, MOCK_ATTRIBUTES);
          setAttributes(MOCK_ATTRIBUTES);
        } else {
          setAttributes(dbAttributes);
        }

        setRequests(dbRequests);
        setInviteTokens(dbTokens);

        // Resolve current user from localStorage
        const allUsers = dbUsers.length > 0 ? dbUsers : MOCK_USERS;
        resolveCurrentUser(allUsers);

        initialLoadDone.current = true;
      } catch (err) {
        console.error('Failed to load from Supabase:', err);
        // Fall back to mock data — already set as initial state in each store
        initialLoadDone.current = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Real-time subscriptions for multi-user sync ---
  useEffect(() => {
    const channel = supabase
      .channel('cm-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.requests },
        (payload) => {
          if (!initialLoadDone.current) return;
          const { setRequests } = useRequestStore.getState();
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = (payload.new as { data: RequestItem }).data;
            useRequestStore.setState((state) => {
              const exists = state.requests.find((r) => r.id === record.id);
              if (exists) {
                return { requests: state.requests.map((r) => (r.id === record.id ? record : r)) };
              }
              return { requests: [record, ...state.requests] };
            });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            useRequestStore.setState((state) => ({
              requests: state.requests.filter((r) => r.id !== id),
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.users },
        (payload) => {
          if (!initialLoadDone.current) return;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = (payload.new as { data: User }).data;
            useUserStore.setState((state) => {
              const exists = state.users.find((u) => u.id === record.id);
              if (exists) {
                return { users: state.users.map((u) => (u.id === record.id ? record : u)) };
              }
              return { users: [...state.users, record] };
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.priorities },
        (payload) => {
          if (!initialLoadDone.current) return;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = (payload.new as { data: Priority }).data;
            useAdminStore.setState((state) => {
              const exists = state.priorities.find((p) => p.id === record.id);
              if (exists) {
                return {
                  priorities: state.priorities.map((p) => (p.id === record.id ? record : p)),
                };
              }
              return { priorities: [...state.priorities, record] };
            });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            useAdminStore.setState((state) => ({
              priorities: state.priorities.filter((p) => p.id !== id),
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.attributes },
        (payload) => {
          if (!initialLoadDone.current) return;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = (payload.new as { data: AttributeDefinition }).data;
            useAdminStore.setState((state) => {
              const exists = state.attributes.find((a) => a.id === record.id);
              if (exists) {
                return {
                  attributes: state.attributes.map((a) => (a.id === record.id ? record : a)),
                };
              }
              return { attributes: [...state.attributes, record] };
            });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            useAdminStore.setState((state) => ({
              attributes: state.attributes.filter((a) => a.id !== id),
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.inviteTokens },
        (payload) => {
          if (!initialLoadDone.current) return;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = (payload.new as { data: InviteToken }).data;
            useInviteStore.setState((state) => {
              const exists = state.inviteTokens.find((t) => t.id === record.id);
              if (exists) {
                return {
                  inviteTokens: state.inviteTokens.map((t) =>
                    t.id === record.id ? record : t
                  ),
                };
              }
              return { inviteTokens: [...state.inviteTokens, record] };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return loading;
}
