import { supabase } from '@/integrations/supabase/client';

export interface EnqueueNotificationResult {
  event_id: string;
  rules_matched: number;
  recipients_enqueued: number;
  duplicates_skipped: number;
}

/**
 * Enqueue a notification event for processing by the outbox dispatcher.
 * This creates pending notification records for all recipients matching
 * active notification rules for the given event type.
 * 
 * @param eventType - The event type identifier (e.g., 'INVOICE_SENT_FOR_APPROVAL')
 * @param payload - Key-value pairs for template placeholder substitution
 * @param eventId - Optional custom event ID for idempotency
 * @param recipientProfileIds - Optional array of profile IDs to send to specific users
 * @returns Result with counts of rules matched, recipients enqueued, and duplicates skipped
 */
export async function enqueueNotificationEvent(
  eventType: string,
  payload: Record<string, string | number>,
  eventId?: string,
  recipientProfileIds?: string[]
): Promise<EnqueueNotificationResult> {
  const { data, error } = await supabase.rpc('enqueue_notification_event', {
    p_event_type: eventType,
    p_payload: payload,
    p_event_id: eventId ?? null,
    p_recipient_profile_ids: recipientProfileIds ?? null,
  });

  if (error) {
    console.error('Error enqueueing notification event:', error);
    throw error;
  }

  return data as unknown as EnqueueNotificationResult;
}
