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
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { handoffSampleToTesting } from '@/services/samplesApi';

interface HandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleId: string;
  sampleCode: string;
  onSuccess?: (displayName: string) => void;
}

export function HandoffDialog({
  open,
  onOpenChange,
  sampleId,
  sampleCode,
  onSuccess,
}: HandoffDialogProps) {
  const queryClient = useQueryClient();
  const [workingTitle, setWorkingTitle] = useState('');

  const handoffMutation = useMutation({
    mutationFn: () => handoffSampleToTesting(sampleId, workingTitle),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      queryClient.invalidateQueries({ queryKey: ['development-request'] });
      toast.success(`Зразок "${result.display_name}" передано на тестування`);
      onOpenChange(false);
      setWorkingTitle('');
      onSuccess?.(result.display_name);
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workingTitle.trim()) {
      toast.error('Введіть робочу назву');
      return;
    }
    
    handoffMutation.mutate();
  };

  const handleClose = () => {
    if (!handoffMutation.isPending) {
      onOpenChange(false);
      setWorkingTitle('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Передати на тестування
            </DialogTitle>
            <DialogDescription>
              Зразок <span className="font-mono font-medium">{sampleCode}</span> буде
              передано менеджеру для тестування у клієнта.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="working-title">
                Робоча назва <span className="text-destructive">*</span>
              </Label>
              <Input
                id="working-title"
                value={workingTitle}
                onChange={(e) => setWorkingTitle(e.target.value)}
                placeholder="Наприклад: Запах копчення - 26"
                disabled={handoffMutation.isPending}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Ця назва буде показана менеджеру разом з кодом зразка
              </p>
            </div>

            {workingTitle.trim() && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Відображатиметься як:</p>
                <p className="font-medium">
                  {workingTitle.trim()} ({sampleCode})
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={handoffMutation.isPending}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={handoffMutation.isPending || !workingTitle.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {handoffMutation.isPending ? 'Передача...' : 'Передати'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
