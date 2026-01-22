-- Create development_sample_pilot table for pilot/tasting data
CREATE TABLE public.development_sample_pilot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id UUID NOT NULL UNIQUE REFERENCES public.development_samples(id) ON DELETE CASCADE,
  
  -- Header fields
  tasting_sheet_no TEXT NULL,
  tasting_date DATE NULL,
  direction TEXT NULL,
  tasting_goal TEXT NULL,
  
  -- Score fields (1-10)
  score_appearance INTEGER NULL CHECK (score_appearance IS NULL OR (score_appearance BETWEEN 1 AND 10)),
  score_color INTEGER NULL CHECK (score_color IS NULL OR (score_color BETWEEN 1 AND 10)),
  score_aroma INTEGER NULL CHECK (score_aroma IS NULL OR (score_aroma BETWEEN 1 AND 10)),
  score_taste INTEGER NULL CHECK (score_taste IS NULL OR (score_taste BETWEEN 1 AND 10)),
  score_consistency INTEGER NULL CHECK (score_consistency IS NULL OR (score_consistency BETWEEN 1 AND 10)),
  score_juiciness INTEGER NULL CHECK (score_juiciness IS NULL OR (score_juiciness BETWEEN 1 AND 10)),
  score_break_moisture INTEGER NULL CHECK (score_break_moisture IS NULL OR (score_break_moisture BETWEEN 1 AND 10)),
  score_syneresis INTEGER NULL CHECK (score_syneresis IS NULL OR (score_syneresis BETWEEN 1 AND 10)),
  score_curl_formation INTEGER NULL CHECK (score_curl_formation IS NULL OR (score_curl_formation BETWEEN 1 AND 10)),
  score_cut_pattern INTEGER NULL CHECK (score_cut_pattern IS NULL OR (score_cut_pattern BETWEEN 1 AND 10)),
  score_fibers INTEGER NULL CHECK (score_fibers IS NULL OR (score_fibers BETWEEN 1 AND 10)),
  score_structure_density INTEGER NULL CHECK (score_structure_density IS NULL OR (score_structure_density BETWEEN 1 AND 10)),
  score_air_inclusions INTEGER NULL CHECK (score_air_inclusions IS NULL OR (score_air_inclusions BETWEEN 1 AND 10)),
  score_overall INTEGER NULL CHECK (score_overall IS NULL OR (score_overall BETWEEN 1 AND 10)),
  
  -- Comment
  comment TEXT NULL,
  
  -- Technical
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_sample_pilot ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same as other development tables)
CREATE POLICY "Allow admin and coo full access to pilot results"
ON public.development_sample_pilot
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'coo'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_development_sample_pilot_updated_at
  BEFORE UPDATE ON public.development_sample_pilot
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_development_sample_pilot_sample_id 
  ON public.development_sample_pilot(sample_id);