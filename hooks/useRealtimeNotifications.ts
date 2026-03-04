/**
 * Real-Time Notifications Hook
 *
 * Subscribes to Supabase Realtime changes on the requests table
 * and generates in-app notifications when requests are updated.
 */

import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { TABLES } from '../lib/supabase';
import { RequestItem, RequestStatus, User } from '../types';

// --- Notification Types ---
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'status_change' | 'assignment' | 'comment' | 'sla_warning' | 'info';
  requestId?: string;
  timestamp: string;
  read: boolean;
}

// --- Notification Store ---
interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notif) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set(state => ({
      notifications: [newNotif, ...state.notifications].slice(0, 50), // Keep last 50
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) => set(state => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    unreadCount: Math.max(0, state.unreadCount - (state.notifications.find(n => n.id === id && !n.read) ? 1 : 0)),
  })),

  markAllAsRead: () => set(state => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

// --- Status Change Descriptions ---
function getStatusChangeMessage(oldStatus: string, newStatus: string, requestTitle: string): string {
  const title = requestTitle.length > 30 ? requestTitle.slice(0, 30) + '...' : requestTitle;
  switch (newStatus) {
    case RequestStatus.PENDING_APPROVAL:
      return `"${title}" is waiting for manager approval`;
    case RequestStatus.SUBMITTED_TO_POC:
      return `"${title}" has been submitted for POC review`;
    case RequestStatus.ASSIGNED:
      return `"${title}" has been assigned to a specialist`;
    case RequestStatus.UNDER_SPECIALIST_REVIEW:
      return `"${title}" is now under specialist review`;
    case RequestStatus.UNDER_TECHNICAL_VALIDATION:
      return `"${title}" is under technical validation`;
    case RequestStatus.PENDING_ORACLE_CREATION:
      return `"${title}" is pending Oracle code creation`;
    case RequestStatus.COMPLETED:
      return `"${title}" has been completed!`;
    case RequestStatus.REJECTED:
      return `"${title}" has been rejected`;
    case RequestStatus.RETURNED_FOR_CLARIFICATION:
      return `"${title}" needs clarification`;
    default:
      return `"${title}" status changed to ${newStatus}`;
  }
}

function getNotificationType(status: string): AppNotification['type'] {
  if (status === RequestStatus.ASSIGNED) return 'assignment';
  if (status === RequestStatus.RETURNED_FOR_CLARIFICATION) return 'comment';
  return 'status_change';
}

// --- Main Hook ---
export function useRealtimeNotifications(currentUserId: string, enabled: boolean = true) {
  const addNotification = useNotificationStore(s => s.addNotification);

  const handleRealtimeChange = useCallback((payload: { new: { id: string; data: RequestItem } | null; old: { id: string; data: RequestItem } | null; eventType: string }) => {
    const { eventType } = payload;

    if (eventType === 'UPDATE' && payload.new?.data && payload.old?.data) {
      const newReq = payload.new.data;
      const oldReq = payload.old.data;

      // Status changed
      if (newReq.status !== oldReq.status) {
        // Check if this is relevant to the current user
        const isRelevant =
          newReq.requesterId === currentUserId ||
          newReq.assignedSpecialistId === currentUserId ||
          newReq.managerId === currentUserId ||
          newReq.technicalReviewerId === currentUserId;

        if (isRelevant) {
          addNotification({
            title: `Status: ${newReq.status}`,
            message: getStatusChangeMessage(oldReq.status, newReq.status, newReq.title),
            type: getNotificationType(newReq.status),
            requestId: newReq.id,
          });
        }
      }

      // Specialist assignment changed
      if (newReq.assignedSpecialistId !== oldReq.assignedSpecialistId && newReq.assignedSpecialistId === currentUserId) {
        addNotification({
          title: 'New Assignment',
          message: `You have been assigned to "${newReq.title}"`,
          type: 'assignment',
          requestId: newReq.id,
        });
      }

      // New clarification comment
      if (
        newReq.clarificationThread &&
        oldReq.clarificationThread &&
        newReq.clarificationThread.length > oldReq.clarificationThread.length
      ) {
        const lastComment = newReq.clarificationThread[newReq.clarificationThread.length - 1];
        if (lastComment.userId !== currentUserId) {
          addNotification({
            title: 'New Clarification',
            message: `${lastComment.userName} commented on "${newReq.title}"`,
            type: 'comment',
            requestId: newReq.id,
          });
        }
      }
    }

    if (eventType === 'INSERT' && payload.new?.data) {
      const newReq = payload.new.data;
      // Notify POCs and admins about new requests
      addNotification({
        title: 'New Request',
        message: `New request "${newReq.title}" has been submitted`,
        type: 'info',
        requestId: newReq.id,
      });
    }
  }, [currentUserId, addNotification]);

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to changes on the requests table
    const channel = supabase
      .channel('request-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.requests,
        },
        (payload: any) => handleRealtimeChange(payload)
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time notifications: subscribed to request changes');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, handleRealtimeChange]);
}
