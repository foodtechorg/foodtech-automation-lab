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
import { enqueueNotificationEvent } from '@/services/notifications';
import { supabase } from '@/integrations/supabase/client';

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
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      queryClient.invalidateQueries({ queryKey: ['development-request'] });
      toast.success(`Зразок "${result.display_name}" передано на тестування`);
      onOpenChange(false);
      setWorkingTitle('');
      onSuccess?.(result.display_name);

      // Send notification to request author
      try {
        const { data: request } = await supabase
          .from('requests')
          .select('id, code, customer_company, author_email')
          .eq('id', result.testing_sample.request_id)
          .single();

        if (request) {
          const { data: authorProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', request.author_email)
            .single();

          if (authorProfile) {
            const requestUrl = `${window.location.origin}/requests/${request.id}`;
            
            await enqueueNotificationEvent(
              'SAMPLE_READY_FOR_TESTING',
              {
                request_code: request.code,
                customer_company: request.customer_company,
                request_url: requestUrl,
              },
              `sample_ready_${sampleId}`, // Unique event ID for idempotency
              [authorProfile.id]
            );
          }
        }
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
        // Don't block the main flow if notification fails
      }
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
