-- Create table for lab results
CREATE TABLE IF NOT EXISTS public.development_sample_lab_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id uuid NOT NULL UNIQUE REFERENCES public.development_samples(id) ON DELETE CASCADE,
  bulk_density_g_dm3 numeric(12,3) NULL,
  appearance text NULL,
  color text NULL,
  smell text NULL,
  taste text NULL,
  chlorides_pct numeric(12,3) NULL,
  phosphates_pct numeric(12,3) NULL,
  moisture_pct numeric(12,3) NULL,
  ph_value numeric(12,3) NULL,
  hydration text NULL,
  gel_strength_g_cm3 numeric(12,3) NULL,
  viscosity_cps numeric(12,3) NULL,
  colority numeric(12,3) NULL,
  additional_info text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for sample_id
CREATE INDEX IF NOT EXISTS idx_development_sample_lab_results_sample_id 
ON public.development_sample_lab_results(sample_id);

-- Enable RLS
ALTER TABLE public.development_sample_lab_results ENABLE ROW LEVEL SECURITY;

-- RLS policies (same as other development tables - admin and coo only)
CREATE POLICY "Admin and COO can view development_sample_lab_results"
  ON public.development_sample_lab_results
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can create development_sample_lab_results"
  ON public.development_sample_lab_results
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can update development_sample_lab_results"
  ON public.development_sample_lab_results
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can delete development_sample_lab_results"
  ON public.development_sample_lab_results
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_development_sample_lab_results_updated_at
  BEFORE UPDATE ON public.development_sample_lab_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();