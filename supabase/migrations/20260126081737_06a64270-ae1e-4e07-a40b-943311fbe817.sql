-- Add notification rule for sample ready for testing
INSERT INTO public.notification_rules (
  code,
  event_type,
  channel,
  is_enabled,
  recipient_roles,
  template_text
) VALUES (
  'SAMPLE_READY_FOR_TESTING',
  'SAMPLE_READY_FOR_TESTING',
  'telegram',
  true,
  '{}',
  'Ваша заявка на розробку в відділ R&D номер {{request_code}} для компанії {{customer_company}} готова до тестування. Деталі заявки за посиланням: {{request_url}}'
);