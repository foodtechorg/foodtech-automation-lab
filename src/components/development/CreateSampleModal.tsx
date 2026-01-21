import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FlaskConical } from 'lucide-react';
import { createSample } from '@/services/samplesApi';

interface CreateSampleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeCode: string;
  requestId: string;
  onSampleCreated?: (sampleId: string) => void;
}

export function CreateSampleModal({
  open,
  onOpenChange,
  recipeId,
  recipeCode,
  requestId,
  onSampleCreated
}: CreateSampleModalProps) {
  const queryClient = useQueryClient();
  const [batchWeight, setBatchWeight] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const weight = parseFloat(batchWeight);
      if (isNaN(weight) || weight <= 0) {
        throw new Error('Партія має бути числом більше 0');
      }
      return createSample(recipeId, weight);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['development-samples', requestId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples-recipe', recipeId] });
      toast.success(`Зразок ${result.sample.sample_code} створено`);
      onOpenChange(false);
      setBatchWeight('');
      setError('');
      onSampleCreated?.(result.sample.id);
    },
    onError: (error: Error) => {
      setError(error.message);
      toast.error(`Помилка створення зразка: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const weight = parseFloat(batchWeight);
    if (isNaN(weight) || weight <= 0) {
      setError('Введіть партію більше 0 грамів');
      return;
    }
    
    createMutation.mutate();
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      onOpenChange(false);
      setBatchWeight('');
      setError('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Створення зразка
          </DialogTitle>
          <DialogDescription>
            Створення нового зразка для рецепту <span className="font-mono font-medium">{recipeCode}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-weight">Партія зразка, г *</Label>
              <Input
                id="batch-weight"
                type="number"
                placeholder="Введіть вагу партії в грамах"
                value={batchWeight}
                onChange={(e) => {
                  setBatchWeight(e.target.value);
                  setError('');
                }}
                min="0.001"
                step="0.001"
                className={error ? 'border-destructive' : ''}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Інгредієнти будуть розраховані пропорційно до цієї ваги
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !batchWeight}
            >
              {createMutation.isPending ? 'Створення...' : 'Створити зразок'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
