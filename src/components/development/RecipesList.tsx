import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Copy, Archive, ClipboardList, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchRecipesByRequestId,
  createRecipe,
  copyRecipe,
  archiveRecipe,
  DevelopmentRecipe
} from '@/services/developmentApi';
import {
  fetchSamplesByRecipeId,
  DevelopmentSample
} from '@/services/samplesApi';
import { CreateSampleModal } from '@/components/development/CreateSampleModal';
import { SampleStatusTracker } from './SampleStatusTracker';

interface RecipesListProps {
  requestId: string;
  onOpenRecipe: (recipeId: string) => void;
  onOpenSample?: (sampleId: string) => void;
  onSampleCreated?: (sampleId: string) => void;
  canEdit?: boolean;
}

const statusLabels: Record<string, string> = {
  Draft: 'Чернетка',
  Locked: 'В роботі',
  Testing: 'Тестування',
  Approved: 'Погоджено',
  Archived: 'Архів'
};

const statusColors: Record<string, string> = {
  Draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Locked: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Testing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Archived: 'bg-muted text-muted-foreground'
};

// Inner component for expandable samples row
function RecipeSamplesRow({ 
  recipe, 
  onOpenSample, 
  onSampleCreated,
  requestId,
  canEdit = true
}: { 
  recipe: DevelopmentRecipe;
  onOpenSample?: (sampleId: string) => void;
  onSampleCreated?: (sampleId: string) => void;
  requestId: string;
  canEdit?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: samples, isLoading } = useQuery({
    queryKey: ['recipe-samples', recipe.id],
    queryFn: () => fetchSamplesByRecipeId(recipe.id, false),
    enabled: isOpen
  });

  const handleSampleCreated = (sampleId: string) => {
    onSampleCreated?.(sampleId);
  };

  // Only show expandable for Locked, Testing, Approved recipes
  if (!['Locked', 'Testing', 'Approved'].includes(recipe.status)) {
    return null;
  }

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/50">
      <TableCell colSpan={5} className="p-0">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start px-4 py-2 h-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              <FlaskConical className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Зразки рецепту ({samples?.length ?? '...'})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-8 pb-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : samples && samples.length > 0 ? (
                <div className="border rounded-lg overflow-hidden bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Код зразка</TableHead>
                        <TableHead className="text-xs">Статус</TableHead>
                        <TableHead className="text-xs text-right">Партія, г</TableHead>
                        <TableHead className="text-xs w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samples.map((sample) => (
                        <TableRow 
                          key={sample.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onOpenSample?.(sample.id)}
                        >
                          <TableCell className="font-mono text-sm">
                            {sample.sample_code}
                          </TableCell>
                          <TableCell>
                            <SampleStatusTracker status={sample.status} compact />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {sample.batch_weight_g.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSample?.(sample.id);
                              }}
                            >
                              Відкрити
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Зразків для цього рецепту ще немає
                </p>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreateModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Створити новий зразок
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <CreateSampleModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          recipeId={recipe.id}
          recipeCode={recipe.recipe_code}
          requestId={requestId}
          onSampleCreated={handleSampleCreated}
        />
      </TableCell>
    </TableRow>
  );
}

export function RecipesList({ requestId, onOpenRecipe, onOpenSample, onSampleCreated, canEdit = true }: RecipesListProps) {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [recipeToArchive, setRecipeToArchive] = useState<DevelopmentRecipe | null>(null);

  const { data: recipes, isLoading } = useQuery({
    queryKey: ['development-recipes', requestId, showArchived],
    queryFn: () => fetchRecipesByRequestId(requestId, showArchived)
  });

  const createMutation = useMutation({
    mutationFn: () => createRecipe(requestId),
    onSuccess: (newRecipe) => {
      queryClient.invalidateQueries({ queryKey: ['development-recipes', requestId] });
      toast.success(`Рецепт ${newRecipe.recipe_code} створено`);
      onOpenRecipe(newRecipe.id);
    },
    onError: (error: Error) => {
      toast.error(`Помилка створення рецепта: ${error.message}`);
    }
  });

  const copyMutation = useMutation({
    mutationFn: (recipeId: string) => copyRecipe(recipeId),
    onSuccess: (newRecipe) => {
      queryClient.invalidateQueries({ queryKey: ['development-recipes', requestId] });
      toast.success(`Рецепт скопійовано як ${newRecipe.recipe_code}`);
      onOpenRecipe(newRecipe.id);
    },
    onError: (error: Error) => {
      toast.error(`Помилка копіювання: ${error.message}`);
    }
  });

  const archiveMutation = useMutation({
    mutationFn: (recipeId: string) => archiveRecipe(recipeId),
    onSuccess: (archivedRecipe) => {
      queryClient.invalidateQueries({ queryKey: ['development-recipes', requestId] });
      toast.success(`Рецепт ${archivedRecipe.recipe_code} архівовано`);
      setArchiveDialogOpen(false);
      setRecipeToArchive(null);
    },
    onError: (error: Error) => {
      toast.error(`Помилка архівації: ${error.message}`);
    }
  });

  const handleArchiveClick = (recipe: DevelopmentRecipe) => {
    setRecipeToArchive(recipe);
    setArchiveDialogOpen(true);
  };

  const confirmArchive = () => {
    if (recipeToArchive) {
      archiveMutation.mutate(recipeToArchive.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {canEdit && (
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            {createMutation.isPending ? 'Створення...' : 'Створити рецепт'}
          </Button>
        )}
        {!canEdit && <div />}

        <div className="flex items-center space-x-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="text-sm">
            Показати архівні
          </Label>
        </div>
      </div>

      {/* Table */}
      {recipes && recipes.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Назва</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Створено</TableHead>
                <TableHead className="text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => (
                <>
                  <TableRow 
                    key={recipe.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onOpenRecipe(recipe.id)}
                  >
                    <TableCell className="font-mono font-medium">
                      {recipe.recipe_code}
                    </TableCell>
                    <TableCell>{recipe.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[recipe.status]}>
                        {statusLabels[recipe.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(recipe.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && recipe.status !== 'Archived' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyMutation.mutate(recipe.id);
                              }}
                              disabled={copyMutation.isPending}
                              title="Копіювати"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveClick(recipe);
                              }}
                              title="Архівувати"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expandable samples row for Locked recipes */}
                  <RecipeSamplesRow 
                    key={`samples-${recipe.id}`}
                    recipe={recipe} 
                    onOpenSample={onOpenSample}
                    onSampleCreated={onSampleCreated}
                    requestId={requestId}
                    canEdit={canEdit}
                  />
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Рецептів ще немає</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            {canEdit 
              ? 'Створіть перший рецепт для цієї заявки, щоб почати розробку.'
              : 'Рецептів для цієї заявки ще не створено.'}
          </p>
          {canEdit && (
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Створити рецепт
            </Button>
          )}
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архівувати рецепт?</AlertDialogTitle>
            <AlertDialogDescription>
              Рецепт {recipeToArchive?.recipe_code} буде переміщено в архів.
              Ви зможете переглянути його, увімкнувши показ архівних рецептів.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Архівація...' : 'Архівувати'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
