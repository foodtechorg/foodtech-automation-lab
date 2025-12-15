import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createPurchaseRequest } from '@/services/purchaseApi';
import type { PurchaseType } from '@/types/purchase';
import { toast } from 'sonner';

const currencies = ['UAH', 'EUR', 'USD'];

export default function NewPurchaseRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('TMC');
  const [description, setDescription] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('Користувач не авторизований');
      return;
    }

    try {
      setSubmitting(true);
      
      const newRequest = await createPurchaseRequest({
        purchase_type: purchaseType,
        description: description.trim() || undefined,
        desired_date: desiredDate || undefined,
        currency,
        created_by: user.id,
      });

      toast.success('Заявку на закупівлю створено');
      navigate(`/purchase/requests/${newRequest.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Не вдалося створити заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchase/requests')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Нова заявка на закупівлю</h1>
          <p className="text-muted-foreground">Створення нової заявки на закупівлю ТМЦ</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Форма заявки</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchaseType">Тип закупівлі *</Label>
                <Select value={purchaseType} onValueChange={(v) => setPurchaseType(v as PurchaseType)}>
                  <SelectTrigger id="purchaseType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TMC">ТМЦ (товарно-матеріальні цінності)</SelectItem>
                    <SelectItem value="SERVICE">Послуга</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Валюта *</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desiredDate">Бажана дата поставки</Label>
              <Input
                id="desiredDate"
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Опис / коментар</Label>
              <Textarea
                id="description"
                placeholder="Опишіть, що потрібно закупити..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Створити заявку
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/purchase/requests')}
              >
                Скасувати
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
