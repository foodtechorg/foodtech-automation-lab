UPDATE public.requests
SET responsible_email = 'o.gorbenko@macros.net.ua'
WHERE responsible_email = 'm.kravchishina@foodtech.org.ua'
  AND status IN ('IN_PROGRESS','SENT_FOR_TEST','REJECTED_BY_CLIENT');