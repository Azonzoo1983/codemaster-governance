import { supabase } from './supabase';

// --- Email Notification Types ---
export type EmailNotificationType = 'status_change' | 'assignment' | 'comment' | 'sla_warning' | 'new_request';

export interface EmailNotificationPayload {
  type: EmailNotificationType;
  requestId: string;
  requestTitle: string;
  recipientEmail: string;
  recipientName: string;
  details: {
    oldStatus?: string;
    newStatus?: string;
    assignedTo?: string;
    commentBy?: string;
    commentText?: string;
    slaHoursRemaining?: number;
    requesterName?: string;
    priority?: string;
  };
}

export interface EmailResult {
  success: boolean;
  provider?: string;
  error?: string;
}

// --- Email Notification Preferences (stored in localStorage) ---
export interface EmailPreferences {
  enabled: boolean;
  statusChanges: boolean;
  assignments: boolean;
  comments: boolean;
  slaWarnings: boolean;
  newRequests: boolean;
}

const DEFAULT_PREFERENCES: EmailPreferences = {
  enabled: false,
  statusChanges: true,
  assignments: true,
  comments: true,
  slaWarnings: true,
  newRequests: true,
};

const PREFS_KEY = 'cm-email-prefs';

export function getEmailPreferences(): EmailPreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFERENCES };
}

export function setEmailPreferences(prefs: Partial<EmailPreferences>): void {
  const current = getEmailPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
}

// --- Check if a notification type should be sent ---
function shouldSend(type: EmailNotificationType): boolean {
  const prefs = getEmailPreferences();
  if (!prefs.enabled) return false;

  switch (type) {
    case 'status_change': return prefs.statusChanges;
    case 'assignment': return prefs.assignments;
    case 'comment': return prefs.comments;
    case 'sla_warning': return prefs.slaWarnings;
    case 'new_request': return prefs.newRequests;
    default: return false;
  }
}

// --- Send notification via Supabase Edge Function ---
export async function sendEmailNotification(payload: EmailNotificationPayload): Promise<EmailResult> {
  // Check preferences before sending
  if (!shouldSend(payload.type)) {
    return { success: true, provider: 'skipped' };
  }

  // Validate email
  if (!payload.recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.recipientEmail)) {
    return { success: false, error: 'Invalid recipient email' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: payload,
    });

    if (error) {
      console.warn('[Email] Edge function error:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success ?? true,
      provider: data?.provider,
    };
  } catch (err: any) {
    // Graceful fallback — don't crash the app if email sending fails
    console.warn('[Email] Failed to send notification:', err.message);
    return { success: false, error: err.message };
  }
}

// --- Convenience helpers for common notification types ---

export function notifyStatusChange(
  requestId: string,
  requestTitle: string,
  recipientEmail: string,
  recipientName: string,
  oldStatus: string,
  newStatus: string
): Promise<EmailResult> {
  return sendEmailNotification({
    type: 'status_change',
    requestId,
    requestTitle,
    recipientEmail,
    recipientName,
    details: { oldStatus, newStatus },
  });
}

export function notifyAssignment(
  requestId: string,
  requestTitle: string,
  recipientEmail: string,
  recipientName: string,
  assignedTo: string
): Promise<EmailResult> {
  return sendEmailNotification({
    type: 'assignment',
    requestId,
    requestTitle,
    recipientEmail,
    recipientName,
    details: { assignedTo },
  });
}

export function notifyComment(
  requestId: string,
  requestTitle: string,
  recipientEmail: string,
  recipientName: string,
  commentBy: string,
  commentText: string
): Promise<EmailResult> {
  return sendEmailNotification({
    type: 'comment',
    requestId,
    requestTitle,
    recipientEmail,
    recipientName,
    details: { commentBy, commentText },
  });
}

export function notifySLAWarning(
  requestId: string,
  requestTitle: string,
  recipientEmail: string,
  recipientName: string,
  slaHoursRemaining: number
): Promise<EmailResult> {
  return sendEmailNotification({
    type: 'sla_warning',
    requestId,
    requestTitle,
    recipientEmail,
    recipientName,
    details: { slaHoursRemaining },
  });
}

export function notifyNewRequest(
  requestId: string,
  requestTitle: string,
  recipientEmail: string,
  recipientName: string,
  requesterName: string,
  priority: string
): Promise<EmailResult> {
  return sendEmailNotification({
    type: 'new_request',
    requestId,
    requestTitle,
    recipientEmail,
    recipientName,
    details: { requesterName, priority },
  });
}
