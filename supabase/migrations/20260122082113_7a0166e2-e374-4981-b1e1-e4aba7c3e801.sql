-- Create RPC function to generate tasting sheet number in format NN/DDMM
CREATE OR REPLACE FUNCTION public.generate_tasting_sheet_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_seq integer;
  v_ddmm text;
BEGIN
  -- Count existing records created today with a tasting_sheet_no + 1
  SELECT COUNT(*) + 1 INTO v_seq
  FROM development_sample_pilot
  WHERE DATE(created_at) = v_today
    AND tasting_sheet_no IS NOT NULL;
  
  -- Format: DD (day), MM (month)
  v_ddmm := LPAD(EXTRACT(DAY FROM v_today)::text, 2, '0') 
         || LPAD(EXTRACT(MONTH FROM v_today)::text, 2, '0');
  
  -- Result: NN/DDMM (e.g., 01/2201)
  RETURN LPAD(v_seq::text, 2, '0') || '/' || v_ddmm;
END;
$$;