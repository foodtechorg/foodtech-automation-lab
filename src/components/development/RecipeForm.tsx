import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchRecipeWithIngredients,
  updateRecipe,
  saveIngredients,
  DevelopmentRecipe,
  DevelopmentRecipeIngredient
} from '@/services/developmentApi';

interface RecipeFormProps {
  recipeId: string;
  onBack: () => void;
}

interface IngredientRow {
  id?: string;
  ingredient_name: string;
  grams: string; // string for input handling
  sort_order: number;
  isNew?: boolean;
}

const statusLabels: Record<string, string> = {
  Draft: 'Чернетка',
  Locked: 'Заблоковано',
  Archived: 'Архів'
};

const statusColors: Record<string, string> = {
  Draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Locked: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Archived: 'bg-muted text-muted-foreground'
};

export function RecipeForm({ recipeId, onBack }: RecipeFormProps) {
  const queryClient = useQueryClient();
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['development-recipe', recipeId],
    queryFn: () => fetchRecipeWithIngredients(recipeId)
  });

  const recipe = data?.recipe;
  const isReadOnly = recipe?.status === 'Locked' || recipe?.status === 'Archived';

  // Initialize form data when loaded
  useEffect(() => {
    if (data) {
      setIngredients(
        data.ingredients.map((ing) => ({
          id: ing.id,
          ingredient_name: ing.ingredient_name,
          grams: ing.grams.toString(),
          sort_order: ing.sort_order
        }))
      );
      setHasChanges(false);
    }
  }, [data]);

  // Calculate totals and percentages
  const calculations = useMemo(() => {
    const total = ingredients.reduce((sum, ing) => {
      const grams = parseFloat(ing.grams) || 0;
      return sum + grams;
    }, 0);

    const rows = ingredients.map((ing) => {
      const grams = parseFloat(ing.grams) || 0;
      const percent = total > 0 ? (grams / total) * 100 : 0;
      return {
        ...ing,
        gramsNum: grams,
        percent: Math.round(percent * 100) / 100
      };
    });

    return { total, rows };
  }, [ingredients]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Validate ingredients
      const validIngredients = ingredients.filter(
        (ing) => ing.ingredient_name.trim() && parseFloat(ing.grams) > 0
      );

      if (validIngredients.length === 0 && ingredients.length > 0) {
        throw new Error('Додайте хоча б один інгредієнт з назвою та вагою > 0');
      }

      // Save ingredients
      await saveIngredients(
        recipeId,
        validIngredients.map((ing, index) => ({
          id: ing.id,
          ingredient_name: ing.ingredient_name.trim(),
          grams: parseFloat(ing.grams),
          sort_order: index
        }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-recipe', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['development-recipes'] });
      setHasChanges(false);
      toast.success('Рецепт збережено');
    },
    onError: (error: Error) => {
      toast.error(`Помилка збереження: ${error.message}`);
    }
  });

  const handleIngredientChange = (index: number, field: 'ingredient_name' | 'grams', value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    );
    setHasChanges(true);
  };

  const handleAddIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      {
        ingredient_name: '',
        grams: '',
        sort_order: prev.length,
        isNew: true
      }
    ]);
    setHasChanges(true);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Рецепт не знайдено</h2>
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад до списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono">{recipe.recipe_code}</h2>
              <Badge variant="outline" className={statusColors[recipe.status]}>
                {statusLabels[recipe.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {isReadOnly ? 'Перегляд рецепту' : 'Редагування рецепту'}
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Збереження...' : 'Зберегти'}
          </Button>
        )}
      </div>

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle>Склад рецепту</CardTitle>
        </CardHeader>
        <CardContent>
          {ingredients.length > 0 ? (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                    {!isReadOnly && <TableHead className="w-10"></TableHead>}
                    <TableHead>Інгредієнт</TableHead>
                    <TableHead className="w-32">Грами</TableHead>
                    <TableHead className="w-24 text-right">%</TableHead>
                    {!isReadOnly && <TableHead className="w-16"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculations.rows.map((row, index) => (
                    <TableRow key={row.id || `new-${index}`}>
                      {!isReadOnly && (
                        <TableCell className="text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </TableCell>
                      )}
                      <TableCell>
                        {isReadOnly ? (
                          <span>{row.ingredient_name}</span>
                        ) : (
                          <Input
                            value={row.ingredient_name}
                            onChange={(e) =>
                              handleIngredientChange(index, 'ingredient_name', e.target.value)
                            }
                            placeholder="Назва інгредієнта"
                            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {isReadOnly ? (
                          <span className="font-mono">{row.gramsNum.toFixed(3)}</span>
                        ) : (
                          <Input
                            type="number"
                            value={row.grams}
                            onChange={(e) =>
                              handleIngredientChange(index, 'grams', e.target.value)
                            }
                            placeholder="0"
                            min="0"
                            step="0.001"
                            className="font-mono border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.percent.toFixed(2)}%
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveIngredient(index)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    {!isReadOnly && <TableCell></TableCell>}
                    <TableCell className="font-semibold">Всього</TableCell>
                    <TableCell className="font-mono font-semibold">
                      {calculations.total.toFixed(3)} г
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      100.00%
                    </TableCell>
                    {!isReadOnly && <TableCell></TableCell>}
                  </TableRow>
                </TableFooter>
                </Table>
              </div>
              
              {!isReadOnly && (
                <Button variant="outline" onClick={handleAddIngredient}>
                  <Plus className="h-4 w-4 mr-2" />
                  Додати інгредієнт
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                Інгредієнтів ще немає
              </p>
              {!isReadOnly && (
                <Button variant="outline" onClick={handleAddIngredient}>
                  <Plus className="h-4 w-4 mr-2" />
                  Додати інгредієнт
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
