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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Trash2, Save, GripVertical, Copy, Archive, FlaskConical, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchRecipeWithIngredients,
  saveIngredients,
  lockRecipe,
  copyRecipe,
  archiveRecipe,
} from '@/services/developmentApi';
import { CreateSampleModal } from './CreateSampleModal';

interface RecipeFormProps {
  recipeId: string;
  onBack: () => void;
  onRecipeCopied?: (newRecipeId: string) => void;
  onSampleCreated?: (sampleId: string) => void;
}

interface IngredientRow {
  id?: string;
  ingredient_name: string;
  grams: string;
  sort_order: number;
  isNew?: boolean;
}

const statusLabels: Record<string, string> = {
  Draft: 'Чернетка',
  Locked: 'В роботі',
  Archived: 'Архів'
};

const statusColors: Record<string, string> = {
  Draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Locked: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Archived: 'bg-muted text-muted-foreground'
};

export function RecipeForm({ recipeId, onBack, onRecipeCopied, onSampleCreated }: RecipeFormProps) {
  const queryClient = useQueryClient();
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [createSampleModalOpen, setCreateSampleModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['development-recipe', recipeId],
    queryFn: () => fetchRecipeWithIngredients(recipeId)
  });

  const recipe = data?.recipe;
  const isDraft = recipe?.status === 'Draft';
  const isLocked = recipe?.status === 'Locked';
  const isArchived = recipe?.status === 'Archived';
  const isReadOnly = isLocked || isArchived;

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

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const validIngredients = ingredients.filter(
        (ing) => ing.ingredient_name.trim() && parseFloat(ing.grams) > 0
      );

      if (validIngredients.length === 0 && ingredients.length > 0) {
        throw new Error('Додайте хоча б один інгредієнт з назвою та вагою > 0');
      }

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
      toast.success('Чернетку збережено');
    },
    onError: (error: Error) => {
      toast.error(`Помилка збереження: ${error.message}`);
    }
  });

  // Lock recipe mutation
  const lockMutation = useMutation({
    mutationFn: async () => {
      const validIngredients = ingredients.filter(
        (ing) => ing.ingredient_name.trim() && parseFloat(ing.grams) > 0
      );

      if (validIngredients.length === 0) {
        throw new Error('Неможливо зафіксувати рецепт без інгредієнтів');
      }

      // Save ingredients first
      await saveIngredients(
        recipeId,
        validIngredients.map((ing, index) => ({
          id: ing.id,
          ingredient_name: ing.ingredient_name.trim(),
          grams: parseFloat(ing.grams),
          sort_order: index
        }))
      );

      // Then lock the recipe
      await lockRecipe(recipeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-recipe', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['development-recipes'] });
      setHasChanges(false);
      setLockDialogOpen(false);
      toast.success('Рецепт зафіксовано');
    },
    onError: (error: Error) => {
      toast.error(`Помилка фіксації: ${error.message}`);
    }
  });

  // Copy recipe mutation
  const copyMutation = useMutation({
    mutationFn: () => copyRecipe(recipeId),
    onSuccess: (newRecipe) => {
      queryClient.invalidateQueries({ queryKey: ['development-recipes'] });
      toast.success(`Рецепт скопійовано як ${newRecipe.recipe_code}`);
      onRecipeCopied?.(newRecipe.id);
    },
    onError: (error: Error) => {
      toast.error(`Помилка копіювання: ${error.message}`);
    }
  });

  // Archive recipe mutation
  const archiveMutation = useMutation({
    mutationFn: () => archiveRecipe(recipeId),
    onSuccess: (archivedRecipe) => {
      queryClient.invalidateQueries({ queryKey: ['development-recipe', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['development-recipes'] });
      setArchiveDialogOpen(false);
      toast.success(`Рецепт ${archivedRecipe.recipe_code} архівовано`);
      onBack();
    },
    onError: (error: Error) => {
      toast.error(`Помилка архівації: ${error.message}`);
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

  const handleCreateSample = () => {
    setCreateSampleModalOpen(true);
  };

  const handleSampleCreated = (sampleId: string) => {
    onSampleCreated?.(sampleId);
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

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <>
              <Button
                variant="outline"
                onClick={() => copyMutation.mutate()}
                disabled={copyMutation.isPending}
              >
                <Copy className="h-4 w-4 mr-2" />
                Копіювати
              </Button>
              <Button
                variant="outline"
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending || !hasChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveDraftMutation.isPending ? 'Збереження...' : 'Зберегти чернетку'}
              </Button>
              <Button
                onClick={() => setLockDialogOpen(true)}
                disabled={lockMutation.isPending || ingredients.length === 0}
              >
                <Lock className="h-4 w-4 mr-2" />
                Зафіксувати рецепт
              </Button>
            </>
          )}

          {isLocked && (
            <>
              <Button
                variant="outline"
                onClick={() => copyMutation.mutate()}
                disabled={copyMutation.isPending}
              >
                <Copy className="h-4 w-4 mr-2" />
                Копіювати
              </Button>
              <Button
                variant="outline"
                onClick={handleCreateSample}
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                Виготовити зразок
              </Button>
              <Button
                variant="outline"
                onClick={() => setArchiveDialogOpen(true)}
              >
                <Archive className="h-4 w-4 mr-2" />
                Архівувати
              </Button>
            </>
          )}
        </div>
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

      {/* Lock Confirmation Dialog */}
      <AlertDialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Зафіксувати рецепт?</AlertDialogTitle>
            <AlertDialogDescription>
              Після фіксації рецепт {recipe.recipe_code} не можна буде редагувати.
              Ви зможете створювати зразки на основі цього рецепту.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => lockMutation.mutate()}
              disabled={lockMutation.isPending}
            >
              {lockMutation.isPending ? 'Фіксація...' : 'Зафіксувати'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архівувати рецепт?</AlertDialogTitle>
            <AlertDialogDescription>
              Рецепт {recipe.recipe_code} буде переміщено в архів.
              Ви зможете переглянути його, увімкнувши показ архівних рецептів.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Архівація...' : 'Архівувати'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Sample Modal */}
      <CreateSampleModal
        open={createSampleModalOpen}
        onOpenChange={setCreateSampleModalOpen}
        recipeId={recipeId}
        recipeCode={recipe.recipe_code}
        requestId={recipe.request_id}
        onSampleCreated={handleSampleCreated}
      />
    </div>
  );
}
