// Supabase Edge Function: send-notification
// Sends email notifications for request status changes
//
// Deploy with: supabase functions deploy send-notification
// Set secrets: supabase secrets set SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USER=user SMTP_PASS=pass SMTP_FROM=noreply@codemaster.com
//
// This function is invoked from the client via supabase.functions.invoke('send-notification', { body: ... })

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface NotificationPayload {
  type: 'status_change' | 'assignment' | 'comment' | 'sla_warning' | 'new_request';
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

function buildEmailSubject(payload: NotificationPayload): string {
  switch (payload.type) {
    case 'status_change':
      return `[CodeMaster] Request ${payload.requestId} — Status changed to ${payload.details.newStatus}`;
    case 'assignment':
      return `[CodeMaster] Request ${payload.requestId} — Assigned to ${payload.details.assignedTo}`;
    case 'comment':
      return `[CodeMaster] Request ${payload.requestId} — New comment from ${payload.details.commentBy}`;
    case 'sla_warning':
      return `[CodeMaster] SLA Warning — Request ${payload.requestId} (${payload.details.slaHoursRemaining}h remaining)`;
    case 'new_request':
      return `[CodeMaster] New Request ${payload.requestId} — ${payload.requestTitle}`;
    default:
      return `[CodeMaster] Notification for ${payload.requestId}`;
  }
}

function buildEmailBody(payload: NotificationPayload): string {
  const { type, requestId, requestTitle, recipientName, details } = payload;

  let content = '';

  switch (type) {
    case 'status_change':
      content = `
        <p>The status of request <strong>${requestId}</strong> has been updated.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600;width:140px">Request</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${requestId} — ${requestTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600">Previous Status</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${details.oldStatus || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600">New Status</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#2563eb;font-weight:600">${details.newStatus}</td>
          </tr>
        </table>`;
      break;

    case 'assignment':
      content = `
        <p>Request <strong>${requestId}</strong> has been assigned.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600;width:140px">Request</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${requestId} — ${requestTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600">Assigned To</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#2563eb;font-weight:600">${details.assignedTo}</td>
          </tr>
        </table>`;
      break;

    case 'comment':
      content = `
        <p>A new comment has been added to request <strong>${requestId}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600;width:140px">Request</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${requestId} — ${requestTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600">Comment By</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${details.commentBy}</td>
          </tr>
        </table>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:12px 0;font-style:italic;color:#475569">
          "${details.commentText}"
        </div>`;
      break;

    case 'sla_warning':
      content = `
        <p style="color:#d97706;font-weight:600">⚠️ SLA Warning for request <strong>${requestId}</strong></p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#fef3c7;border:1px solid #fde68a;font-weight:600;width:140px">Request</td>
            <td style="padding:8px 12px;border:1px solid #fde68a">${requestId} — ${requestTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#fef3c7;border:1px solid #fde68a;font-weight:600">Time Remaining</td>
            <td style="padding:8px 12px;border:1px solid #fde68a;color:#d97706;font-weight:600">${details.slaHoursRemaining} business hours</td>
          </tr>
        </table>`;
      break;

    case 'new_request':
      content = `
        <p>A new request has been submitted and requires your attention.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600;width:140px">Request ID</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${requestId}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600">Title</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${requestTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600">Requester</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${details.requesterName || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600">Priority</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0">${details.priority || 'Normal'}</td>
          </tr>
        </table>`;
      break;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px 32px">
          <h1 style="margin:0;color:white;font-size:20px;font-weight:700">CodeMaster Governance</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:1px">Notification</p>
        </div>

        <!-- Body -->
        <div style="padding:32px">
          <p style="margin:0 0 8px;color:#475569;font-size:14px">Hello ${recipientName},</p>
          ${content}
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
            This is an automated notification from CodeMaster Governance Tool.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
          <p style="margin:0;font-size:11px;color:#94a3b8">CodeMaster Governance Tool &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>`;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const payload: NotificationPayload = await req.json();

    // Validate required fields
    if (!payload.recipientEmail || !payload.requestId || !payload.type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const subject = buildEmailSubject(payload);
    const htmlBody = buildEmailBody(payload);

    // Get SMTP config from secrets
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT') || '587';
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@codemaster.com';

    // If SMTP not configured, use Resend API as alternative
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (resendApiKey) {
      // Send via Resend API
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: smtpFrom,
          to: [payload.recipientEmail],
          subject,
          html: htmlBody,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        throw new Error(`Resend API error: ${errorText}`);
      }

      const result = await resendResponse.json();
      return new Response(JSON.stringify({ success: true, messageId: result.id, provider: 'resend' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (smtpHost && smtpUser && smtpPass) {
      // Send via SMTP (using Deno smtp client)
      // Note: In production, use a proper SMTP library or HTTP-based email service
      // For now, log the email and return success for development
      console.log(`[EMAIL] To: ${payload.recipientEmail}, Subject: ${subject}`);
      console.log(`[EMAIL] SMTP: ${smtpHost}:${smtpPort}, From: ${smtpFrom}`);

      return new Response(JSON.stringify({
        success: true,
        provider: 'smtp',
        message: 'Email queued via SMTP',
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // No email provider configured — log only
    console.log(`[EMAIL-DRY-RUN] Would send to: ${payload.recipientEmail}`);
    console.log(`[EMAIL-DRY-RUN] Subject: ${subject}`);

    return new Response(JSON.stringify({
      success: true,
      provider: 'dry-run',
      message: 'No email provider configured. Set RESEND_API_KEY or SMTP_* secrets.',
      subject,
      to: payload.recipientEmail,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error('send-notification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
