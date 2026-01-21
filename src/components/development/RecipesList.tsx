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
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Copy, Archive, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchRecipesByRequestId,
  createRecipe,
  copyRecipe,
  archiveRecipe,
  DevelopmentRecipe
} from '@/services/developmentApi';

interface RecipesListProps {
  requestId: string;
  onOpenRecipe: (recipeId: string) => void;
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

export function RecipesList({ requestId, onOpenRecipe }: RecipesListProps) {
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
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus className="h-4 w-4 mr-2" />
          {createMutation.isPending ? 'Створення...' : 'Створити рецепт'}
        </Button>

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
                      {recipe.status !== 'Archived' && (
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
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Рецептів ще немає</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Створіть перший рецепт для цієї заявки, щоб почати розробку.
          </p>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Створити рецепт
          </Button>
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
