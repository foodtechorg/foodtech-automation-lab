import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { quickHandoffToTesting } from '@/services/samplesApi';

interface QuickHandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestCode: string;
  onSuccess: () => void;
}

export function QuickHandoffDialog({
  open,
  onOpenChange,
  requestId,
  requestCode,
  onSuccess,
}: QuickHandoffDialogProps) {
  const [productName, setProductName] = useState('');
  const [weightG, setWeightG] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = productName.trim().length > 0 && Number(weightG) > 0;

  const previewCode = useMemo(() => {
    return `${requestCode}/Q1`; // Preview shows Q1, actual will be calculated server-side
  }, [requestCode]);

  const displayName = useMemo(() => {
    if (!productName.trim()) return '';
    return `${productName.trim()} (${previewCode})`;
  }, [productName, previewCode]);

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await quickHandoffToTesting(requestId, productName.trim(), Number(weightG));
      
      toast({
        title: 'Успішно',
        description: 'Зразок передано на тестування',
      });
      
      // Reset form
      setProductName('');
      setWeightG('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Помилка',
        description: error.message || 'Не вдалося передати зразок на тестування',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setProductName('');
      setWeightG('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Передати на тестування
          </DialogTitle>
          <DialogDescription>
            Заявка {requestCode} буде передана менеджеру для тестування у клієнта.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="productName">
              Назва продукту <span className="text-destructive">*</span>
            </Label>
            <Input
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Введіть назву продукту"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weightG">
              Вага, г <span className="text-destructive">*</span>
            </Label>
            <Input
              id="weightG"
              type="number"
              value={weightG}
              onChange={(e) => setWeightG(e.target.value)}
              placeholder="Введіть вагу в грамах"
              min="1"
              step="1"
              disabled={isSubmitting}
            />
          </div>

          {displayName && (
            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription>
                <span className="text-muted-foreground">Відображатиметься як:</span>
                <br />
                <span className="font-medium">{displayName}</span>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Скасувати
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Передача...' : 'Передати'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
