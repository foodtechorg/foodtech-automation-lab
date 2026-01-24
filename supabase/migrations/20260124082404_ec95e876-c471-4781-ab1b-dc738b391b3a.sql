-- Add new notification rule for invoice paid event
-- Notifies the request creator when their invoice has been paid

INSERT INTO public.notification_rules (
  code,
  event_type,
  channel,
  is_enabled,
  recipient_roles,
  template_text
) VALUES (
  'INVOICE_PAID',
  'INVOICE_PAID',
  'telegram',
  true,
  ARRAY[]::app_role[],  -- Empty array - recipients will be determined by requester email, not roles
  'Ваш рахунок по заявці {{request_number}} на суму {{invoice_amount}} на постачальника {{supplier_name}} був сплачений.'
);