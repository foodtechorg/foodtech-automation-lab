import { supabase } from '@/integrations/supabase/client';

// Types based on DB schema
export type DevelopmentSampleStatus = 
  | 'Draft' 
  | 'Prepared' 
  | 'Lab' 
  | 'LabDone' 
  | 'Pilot' 
  | 'PilotDone' 
  | 'ReadyForHandoff' 
  | 'HandedOff' 
  | 'Archived';

export interface DevelopmentSample {
  id: string;
  request_id: string;
  recipe_id: string;
  sample_seq: number;
  sample_code: string;
  batch_weight_g: number;
  status: DevelopmentSampleStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DevelopmentSampleIngredient {
  id: string;
  sample_id: string;
  ingredient_name: string;
  recipe_grams: number;
  required_grams: number;
  lot_number: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSampleResult {
  sample: DevelopmentSample;
  ingredients: DevelopmentSampleIngredient[];
}

// Status labels for UI
export const sampleStatusLabels: Record<DevelopmentSampleStatus, string> = {
  Draft: 'Чернетка',
  Prepared: 'Підготовлено',
  Lab: 'Лабораторія',
  LabDone: 'Лаб. завершено',
  Pilot: 'Пілот',
  PilotDone: 'Пілот завершено',
  ReadyForHandoff: 'Готовий до передачі',
  HandedOff: 'Передано',
  Archived: 'Архів'
};

export const sampleStatusColors: Record<DevelopmentSampleStatus, string> = {
  Draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Prepared: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Lab: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  LabDone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Pilot: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  PilotDone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  ReadyForHandoff: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  HandedOff: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Archived: 'bg-muted text-muted-foreground'
};

// Fetch samples for a request
export async function fetchSamplesByRequestId(
  requestId: string,
  includeArchived: boolean = false
): Promise<DevelopmentSample[]> {
  let query = supabase
    .from('development_samples')
    .select('*')
    .eq('request_id', requestId)
    .order('sample_code', { ascending: true });

  if (!includeArchived) {
    query = query.neq('status', 'Archived');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as DevelopmentSample[];
}

// Fetch samples for a recipe
export async function fetchSamplesByRecipeId(
  recipeId: string,
  includeArchived: boolean = false
): Promise<DevelopmentSample[]> {
  let query = supabase
    .from('development_samples')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('sample_seq', { ascending: true });

  if (!includeArchived) {
    query = query.neq('status', 'Archived');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as DevelopmentSample[];
}

// Fetch single sample with ingredients
export async function fetchSampleWithIngredients(sampleId: string): Promise<{
  sample: DevelopmentSample;
  ingredients: DevelopmentSampleIngredient[];
}> {
  const [sampleResult, ingredientsResult] = await Promise.all([
    supabase
      .from('development_samples')
      .select('*')
      .eq('id', sampleId)
      .single(),
    supabase
      .from('development_sample_ingredients')
      .select('*')
      .eq('sample_id', sampleId)
      .order('sort_order', { ascending: true })
  ]);

  if (sampleResult.error) throw sampleResult.error;
  if (ingredientsResult.error) throw ingredientsResult.error;

  return {
    sample: sampleResult.data as unknown as DevelopmentSample,
    ingredients: (ingredientsResult.data || []) as unknown as DevelopmentSampleIngredient[]
  };
}

// Create new sample using RPC
export async function createSample(
  recipeId: string,
  batchWeightG: number
): Promise<CreateSampleResult> {
  const { data, error } = await supabase.rpc('create_development_sample', {
    p_recipe_id: recipeId,
    p_batch_weight_g: batchWeightG
  });

  if (error) throw error;
  
  const result = data as unknown as {
    sample: DevelopmentSample;
    ingredients: DevelopmentSampleIngredient[];
  };
  
  return result;
}

// Recalculate sample ingredients when batch_weight_g changes
export async function recalculateSampleIngredients(
  sampleId: string,
  newBatchWeightG: number
): Promise<CreateSampleResult> {
  const { data, error } = await supabase.rpc('recalculate_sample_ingredients', {
    p_sample_id: sampleId,
    p_new_batch_weight_g: newBatchWeightG
  });

  if (error) throw error;
  
  const result = data as unknown as {
    sample: DevelopmentSample;
    ingredients: DevelopmentSampleIngredient[];
  };
  
  return result;
}

// Update sample status
export async function updateSampleStatus(
  sampleId: string,
  status: DevelopmentSampleStatus
): Promise<DevelopmentSample> {
  const { data, error } = await supabase
    .from('development_samples')
    .update({ status })
    .eq('id', sampleId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as DevelopmentSample;
}

// Prepare sample (transition Draft -> Prepared)
export async function prepareSample(sampleId: string): Promise<DevelopmentSample> {
  return updateSampleStatus(sampleId, 'Prepared');
}

// Archive sample
export async function archiveSample(sampleId: string): Promise<DevelopmentSample> {
  return updateSampleStatus(sampleId, 'Archived');
}

// Update lot number for an ingredient
export async function updateIngredientLotNumber(
  ingredientId: string,
  lotNumber: string
): Promise<DevelopmentSampleIngredient> {
  const { data, error } = await supabase
    .from('development_sample_ingredients')
    .update({ lot_number: lotNumber })
    .eq('id', ingredientId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as DevelopmentSampleIngredient;
}

// Bulk update lot numbers
export async function updateLotNumbers(
  updates: Array<{ id: string; lot_number: string }>
): Promise<void> {
  for (const update of updates) {
    const { error } = await supabase
      .from('development_sample_ingredients')
      .update({ lot_number: update.lot_number })
      .eq('id', update.id);
    
    if (error) throw error;
  }
}

// Check if sample can be prepared (lot numbers are optional now)
export function canPrepareSample(ingredients: DevelopmentSampleIngredient[]): {
  canPrepare: boolean;
  missingLotNumbers: string[];
} {
  // Lot numbers are optional, so we always allow preparation
  return {
    canPrepare: true,
    missingLotNumbers: []
  };
}

// Fetch recipe code for a sample (for display purposes)
export async function fetchRecipeCodeForSample(recipeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('development_recipes')
    .select('recipe_code')
    .eq('id', recipeId)
    .single();

  if (error) return null;
  return data?.recipe_code || null;
}

// Copy a prepared sample with lot numbers preserved
export async function copySample(sampleId: string): Promise<CreateSampleResult> {
  const { data, error } = await supabase.rpc('copy_development_sample', {
    p_sample_id: sampleId
  });

  if (error) throw error;
  
  const result = data as unknown as {
    sample: DevelopmentSample;
    ingredients: DevelopmentSampleIngredient[];
  };
  
  return result;
}
