import { supabase } from '@/integrations/supabase/client';

// Lab results interface
export interface LabResults {
  id: string;
  sample_id: string;
  bulk_density_g_dm3: number | null;
  appearance: string | null;
  color: string | null;
  smell: string | null;
  taste: string | null;
  chlorides_pct: number | null;
  phosphates_pct: number | null;
  moisture_pct: number | null;
  ph_value: number | null;
  hydration: string | null;
  gel_strength_g_cm3: number | null;
  viscosity_cps: number | null;
  colority: number | null;
  additional_info: string | null;
  created_at: string;
  updated_at: string;
}

// Lab fields configuration for UI
export interface LabFieldConfig {
  key: keyof Omit<LabResults, 'id' | 'sample_id' | 'created_at' | 'updated_at'>;
  label: string;
  type: 'number' | 'text' | 'textarea';
  unit?: string;
}

export const labFieldsConfig: LabFieldConfig[] = [
  { key: 'bulk_density_g_dm3', label: 'Насипна щільність', type: 'number', unit: 'г/дм³' },
  { key: 'appearance', label: 'Зовнішній вигляд', type: 'text' },
  { key: 'color', label: 'Колір', type: 'text' },
  { key: 'smell', label: 'Запах', type: 'text' },
  { key: 'taste', label: 'Смак', type: 'text' },
  { key: 'chlorides_pct', label: 'Масова частка хлоридів', type: 'number', unit: '%' },
  { key: 'phosphates_pct', label: 'Вміст фосфатів', type: 'number', unit: '%' },
  { key: 'moisture_pct', label: 'Вологість', type: 'number', unit: '%' },
  { key: 'ph_value', label: 'pH', type: 'number' },
  { key: 'hydration', label: 'Гідротація', type: 'text' },
  { key: 'gel_strength_g_cm3', label: 'Сила гелю', type: 'number', unit: 'г/см³' },
  { key: 'viscosity_cps', label: "В'язкість", type: 'number', unit: 'cps' },
  { key: 'colority', label: 'Колірність', type: 'number' },
  { key: 'additional_info', label: 'Додаткова інформація', type: 'textarea' },
];

// Fetch lab results for a sample
export async function fetchLabResults(sampleId: string): Promise<LabResults | null> {
  const { data, error } = await supabase
    .from('development_sample_lab_results')
    .select('*')
    .eq('sample_id', sampleId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as LabResults | null;
}

// Create or update lab results (upsert)
export async function upsertLabResults(
  sampleId: string,
  results: Partial<Omit<LabResults, 'id' | 'sample_id' | 'created_at' | 'updated_at'>>
): Promise<LabResults> {
  // First check if record exists
  const existing = await fetchLabResults(sampleId);
  
  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('development_sample_lab_results')
      .update(results)
      .eq('sample_id', sampleId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as LabResults;
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('development_sample_lab_results')
      .insert({ sample_id: sampleId, ...results })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as LabResults;
  }
}

// Initialize empty lab results when transitioning to Lab status
export async function initializeLabResults(sampleId: string): Promise<LabResults> {
  const existing = await fetchLabResults(sampleId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('development_sample_lab_results')
    .insert({ sample_id: sampleId })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as LabResults;
}

// Validate that at least one field is filled
export function validateLabResults(results: LabResults | null): { 
  isValid: boolean; 
  errorMessage: string | null;
} {
  if (!results) {
    return { 
      isValid: false, 
      errorMessage: 'Заповніть хоча б один показник лабораторного аналізу' 
    };
  }

  const numericFields: (keyof LabResults)[] = [
    'bulk_density_g_dm3',
    'chlorides_pct',
    'phosphates_pct',
    'moisture_pct',
    'ph_value',
    'gel_strength_g_cm3',
    'viscosity_cps',
    'colority'
  ];

  const textFields: (keyof LabResults)[] = [
    'appearance',
    'color',
    'smell',
    'taste',
    'hydration',
    'additional_info'
  ];

  // Check if any numeric field is filled
  const hasNumericValue = numericFields.some(field => 
    results[field] !== null && results[field] !== undefined
  );

  // Check if any text field is filled
  const hasTextValue = textFields.some(field => {
    const value = results[field];
    return value !== null && value !== undefined && String(value).trim().length > 0;
  });

  if (hasNumericValue || hasTextValue) {
    return { isValid: true, errorMessage: null };
  }

  return { 
    isValid: false, 
    errorMessage: 'Заповніть хоча б один показник лабораторного аналізу' 
  };
}
