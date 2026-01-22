import { supabase } from '@/integrations/supabase/client';

// Types based on DB schema
export interface DevelopmentRecipe {
  id: string;
  request_id: string;
  recipe_seq: number;
  recipe_code: string;
  name: string | null;
  status: 'Draft' | 'Locked' | 'Testing' | 'Approved' | 'Archived';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DevelopmentRecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  grams: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Fetch recipes for a request
export async function fetchRecipesByRequestId(
  requestId: string,
  includeArchived: boolean = false
): Promise<DevelopmentRecipe[]> {
  let query = supabase
    .from('development_recipes')
    .select('*')
    .eq('request_id', requestId)
    .order('recipe_seq', { ascending: true });

  if (!includeArchived) {
    query = query.neq('status', 'Archived');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DevelopmentRecipe[];
}

// Fetch single recipe with ingredients
export async function fetchRecipeWithIngredients(recipeId: string): Promise<{
  recipe: DevelopmentRecipe;
  ingredients: DevelopmentRecipeIngredient[];
}> {
  const [recipeResult, ingredientsResult] = await Promise.all([
    supabase
      .from('development_recipes')
      .select('*')
      .eq('id', recipeId)
      .single(),
    supabase
      .from('development_recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true })
  ]);

  if (recipeResult.error) throw recipeResult.error;
  if (ingredientsResult.error) throw ingredientsResult.error;

  return {
    recipe: recipeResult.data as DevelopmentRecipe,
    ingredients: (ingredientsResult.data || []) as DevelopmentRecipeIngredient[]
  };
}

// Create new recipe using RPC (handles seq generation with advisory lock)
export async function createRecipe(requestId: string): Promise<DevelopmentRecipe> {
  const { data, error } = await supabase.rpc('create_development_recipe', {
    p_request_id: requestId
  });

  if (error) throw error;
  return data as DevelopmentRecipe;
}

// Copy recipe using RPC
export async function copyRecipe(recipeId: string): Promise<DevelopmentRecipe> {
  const { data, error } = await supabase.rpc('copy_development_recipe', {
    p_recipe_id: recipeId
  });

  if (error) throw error;
  return data as DevelopmentRecipe;
}

// Update recipe (name only for now, status for archiving)
export async function updateRecipe(
  recipeId: string,
  updates: { name?: string | null; status?: 'Draft' | 'Locked' | 'Archived' }
): Promise<DevelopmentRecipe> {
  const { data, error } = await supabase
    .from('development_recipes')
    .update(updates)
    .eq('id', recipeId)
    .select()
    .single();

  if (error) throw error;
  return data as DevelopmentRecipe;
}

// Archive recipe
export async function archiveRecipe(recipeId: string): Promise<DevelopmentRecipe> {
  return updateRecipe(recipeId, { status: 'Archived' });
}

// Lock recipe (finalize for sample creation)
export async function lockRecipe(recipeId: string): Promise<DevelopmentRecipe> {
  return updateRecipe(recipeId, { status: 'Locked' });
}

// ========== Ingredients ==========

// Add ingredient
export async function addIngredient(
  recipeId: string,
  ingredientName: string,
  grams: number,
  sortOrder: number
): Promise<DevelopmentRecipeIngredient> {
  const { data, error } = await supabase
    .from('development_recipe_ingredients')
    .insert({
      recipe_id: recipeId,
      ingredient_name: ingredientName,
      grams,
      sort_order: sortOrder
    })
    .select()
    .single();

  if (error) throw error;
  return data as DevelopmentRecipeIngredient;
}

// Update ingredient
export async function updateIngredient(
  ingredientId: string,
  updates: { ingredient_name?: string; grams?: number; sort_order?: number }
): Promise<DevelopmentRecipeIngredient> {
  const { data, error } = await supabase
    .from('development_recipe_ingredients')
    .update(updates)
    .eq('id', ingredientId)
    .select()
    .single();

  if (error) throw error;
  return data as DevelopmentRecipeIngredient;
}

// Delete ingredient
export async function deleteIngredient(ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('development_recipe_ingredients')
    .delete()
    .eq('id', ingredientId);

  if (error) throw error;
}

// Bulk save ingredients (for form saving)
export async function saveIngredients(
  recipeId: string,
  ingredients: Array<{
    id?: string;
    ingredient_name: string;
    grams: number;
    sort_order: number;
  }>
): Promise<DevelopmentRecipeIngredient[]> {
  // Get existing ingredients
  const { data: existing, error: fetchError } = await supabase
    .from('development_recipe_ingredients')
    .select('id')
    .eq('recipe_id', recipeId);

  if (fetchError) throw fetchError;

  const existingIds = new Set((existing || []).map(i => i.id));
  const newIngredientIds = new Set(ingredients.filter(i => i.id).map(i => i.id));

  // Delete removed ingredients
  const toDelete = [...existingIds].filter(id => !newIngredientIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('development_recipe_ingredients')
      .delete()
      .in('id', toDelete);
    if (deleteError) throw deleteError;
  }

  // Upsert remaining ingredients
  const toUpsert = ingredients.map((ing, index) => ({
    id: ing.id || undefined,
    recipe_id: recipeId,
    ingredient_name: ing.ingredient_name,
    grams: ing.grams,
    sort_order: index
  }));

  // Separate new and existing
  const newIngredients = toUpsert.filter(i => !i.id);
  const existingIngredients = toUpsert.filter(i => i.id);

  const results: DevelopmentRecipeIngredient[] = [];

  // Insert new
  if (newIngredients.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('development_recipe_ingredients')
      .insert(newIngredients.map(({ id, ...rest }) => rest))
      .select();
    if (insertError) throw insertError;
    results.push(...(inserted as DevelopmentRecipeIngredient[]));
  }

  // Update existing one by one (bulk update not supported easily)
  for (const ing of existingIngredients) {
    const { data: updated, error: updateError } = await supabase
      .from('development_recipe_ingredients')
      .update({
        ingredient_name: ing.ingredient_name,
        grams: ing.grams,
        sort_order: ing.sort_order
      })
      .eq('id', ing.id!)
      .select()
      .single();
    if (updateError) throw updateError;
    results.push(updated as DevelopmentRecipeIngredient);
  }

  return results.sort((a, b) => a.sort_order - b.sort_order);
}
