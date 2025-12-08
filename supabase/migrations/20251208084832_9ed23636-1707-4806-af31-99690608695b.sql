-- Створити таблицю для історії результатів тестування
CREATE TABLE public.test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  result client_result NOT NULL,
  feedback TEXT NOT NULL,
  is_final BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Увімкнути RLS
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- Політика для додавання результатів (менеджер продажів для своїх заявок)
CREATE POLICY "Sales can add test results for own requests"
  ON public.test_results FOR INSERT
  WITH CHECK (
    actor_email = (SELECT email FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM requests r 
      WHERE r.id = test_results.request_id 
      AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Політика для перегляду результатів
CREATE POLICY "Users can view test results for accessible requests"
  ON public.test_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = test_results.request_id
      AND (
        has_role(auth.uid(), 'rd_dev') OR
        has_role(auth.uid(), 'rd_manager') OR
        has_role(auth.uid(), 'admin') OR
        (has_role(auth.uid(), 'sales_manager') AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid()))
      )
    )
  );

-- Індекс для швидкого пошуку
CREATE INDEX idx_test_results_request_id ON public.test_results(request_id);