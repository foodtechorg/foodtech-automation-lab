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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createPurchaseRequest, createPurchaseRequestItems, updatePurchaseRequestStatus } from '@/services/purchaseApi';
import type { PurchaseType } from '@/types/purchase';
import { toast } from 'sonner';

interface LocalItem {
  name: string;
  unit: string;
  quantity: string;
}

const emptyItem = (): LocalItem => ({ name: '', unit: '', quantity: '' });

export default function NewPurchaseRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('TMC');
  const [desiredDate, setDesiredDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    setItems([...items, emptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LocalItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const validateItems = (): boolean => {
    const validItems = items.filter(item => item.name.trim() !== '');
    if (validItems.length === 0) {
      toast.error('Додайте хоча б одну позицію з назвою');
      return false;
    }
    return true;
  };

  const handleSave = async (submitForApproval: boolean) => {
    if (!user?.id) {
      toast.error('Користувач не авторизований');
      return;
    }

    if (!validateItems()) return;

    try {
      setSubmitting(true);
      
      // 1. Create the purchase request
      const newRequest = await createPurchaseRequest({
        purchase_type: purchaseType,
        description: description.trim() || undefined,
        desired_date: desiredDate || undefined,
        created_by: user.id,
      });

      // 2. Create items
      const validItems = items.filter(item => item.name.trim() !== '');
      if (validItems.length > 0) {
        await createPurchaseRequestItems(
          validItems.map(item => ({
            request_id: newRequest.id,
            name: item.name.trim(),
            unit: item.unit.trim() || 'шт',
            quantity: parseFloat(item.quantity) || 1,
          }))
        );
      }

      // 3. Update status if submitting for approval
      if (submitForApproval) {
        await updatePurchaseRequestStatus(newRequest.id, 'PENDING_APPROVAL');
        toast.success('Заявку відправлено на погодження');
      } else {
        toast.success('Чернетку збережено');
      }

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

      {/* General Info */}
      <Card>
        <CardHeader>
          <CardTitle>Загальна інформація</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="desiredDate">Бажана дата поставки</Label>
              <Input
                id="desiredDate"
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Позиції заявки</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Додати позицію
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Найменування *</TableHead>
                <TableHead>Одиниці виміру</TableHead>
                <TableHead>Кількість</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      placeholder="Введіть назву..."
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="шт"
                      value={item.unit}
                      onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Comment */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="description">Коментар до заявки</Label>
            <Textarea
              id="description"
              placeholder="Додатковий коментар або пояснення..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 pt-4">
            <Button 
              onClick={() => handleSave(false)} 
              disabled={submitting}
              variant="outline"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Зберегти чернетку
            </Button>
            <Button 
              onClick={() => handleSave(true)} 
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Відправити на погодження
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/purchase/requests')}
            >
              Скасувати
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
