import { supabase } from '@/integrations/supabase/client';

// Pilot results interface matching the development_sample_pilot table
export interface PilotResults {
  id: string;
  sample_id: string;
  // Header fields
  tasting_sheet_no: string | null;
  tasting_date: string | null;
  direction: string | null;
  tasting_goal: string | null;
  // Score fields (1-10)
  score_appearance: number | null;
  score_color: number | null;
  score_aroma: number | null;
  score_taste: number | null;
  score_consistency: number | null;
  score_juiciness: number | null;
  score_break_moisture: number | null;
  score_syneresis: number | null;
  score_curl_formation: number | null;
  score_cut_pattern: number | null;
  score_fibers: number | null;
  score_structure_density: number | null;
  score_air_inclusions: number | null;
  score_overall: number | null;
  // Comment
  comment: string | null;
  // Technical
  created_at: string;
  updated_at: string;
}

// Direction options removed - direction is inherited from the R&D request

// Score fields configuration for UI
export interface PilotScoreFieldConfig {
  key: keyof Omit<PilotResults, 'id' | 'sample_id' | 'tasting_sheet_no' | 'tasting_date' | 'direction' | 'tasting_goal' | 'comment' | 'created_at' | 'updated_at'>;
  label: string;
  required?: boolean;
}

export const pilotScoreFieldsConfig: PilotScoreFieldConfig[] = [
  { key: 'score_appearance', label: 'Зовнішній вигляд' },
  { key: 'score_color', label: 'Колір' },
  { key: 'score_aroma', label: 'Аромат' },
  { key: 'score_taste', label: 'Смак' },
  { key: 'score_consistency', label: 'Консистенція' },
  { key: 'score_juiciness', label: 'Соковитість' },
  { key: 'score_break_moisture', label: 'Вологість на зламі' },
  { key: 'score_syneresis', label: 'Синерезис (утворення бульйону)' },
  { key: 'score_curl_formation', label: 'Утворення завитку' },
  { key: 'score_cut_pattern', label: 'Утворення малюнку на зламі' },
  { key: 'score_fibers', label: 'Наявність волокон' },
  { key: 'score_structure_density', label: 'Щільність структури' },
  { key: 'score_air_inclusions', label: 'Наявність повітряних включень' },
  { key: 'score_overall', label: 'Загальна оцінка продукту', required: true },
];

// Type for form data
export type PilotFormData = Partial<Omit<PilotResults, 'id' | 'sample_id' | 'created_at' | 'updated_at'>>;

// Fetch pilot results for a sample
export async function fetchPilotResults(sampleId: string): Promise<PilotResults | null> {
  const { data, error } = await supabase
    .from('development_sample_pilot')
    .select('*')
    .eq('sample_id', sampleId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as PilotResults | null;
}

// Create or update pilot results (upsert)
export async function upsertPilotResults(
  sampleId: string,
  results: PilotFormData
): Promise<PilotResults> {
  // First check if record exists
  const existing = await fetchPilotResults(sampleId);
  
  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('development_sample_pilot')
      .update(results)
      .eq('sample_id', sampleId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PilotResults;
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('development_sample_pilot')
      .insert({ sample_id: sampleId, ...results })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PilotResults;
  }
}

// Initialize pilot results when transitioning to Pilot status
// Generates tasting_sheet_no automatically using RPC function
export async function initializePilotResults(sampleId: string): Promise<PilotResults> {
  const existing = await fetchPilotResults(sampleId);
  if (existing) return existing;

  // Generate tasting sheet number via RPC
  const { data: sheetNo, error: rpcError } = await supabase
    .rpc('generate_tasting_sheet_number');
  
  if (rpcError) throw rpcError;

  const { data, error } = await supabase
    .from('development_sample_pilot')
    .insert({ 
      sample_id: sampleId,
      tasting_sheet_no: sheetNo,
      tasting_date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PilotResults;
}

// Validate that score_overall is filled for PilotDone transition
export function validatePilotResults(results: PilotResults | PilotFormData | null): { 
  isValid: boolean; 
  errorMessage: string | null;
} {
  if (!results) {
    return { 
      isValid: false, 
      errorMessage: 'Спочатку заповніть дегустаційний лист' 
    };
  }

  const overallScore = results.score_overall;

  if (overallScore === null || overallScore === undefined) {
    return { 
      isValid: false, 
      errorMessage: 'Для фіксації результатів обов\'язково вкажіть "Загальна оцінка продукту"' 
    };
  }

  if (overallScore < 1 || overallScore > 10) {
    return { 
      isValid: false, 
      errorMessage: 'Загальна оцінка продукту має бути від 1 до 10' 
    };
  }

  return { isValid: true, errorMessage: null };
}
