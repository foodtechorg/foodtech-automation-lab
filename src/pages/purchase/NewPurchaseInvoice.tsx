import { useEffect, useState } from 'react';
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
import { ArrowLeft, Loader2, Package, Save, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getPurchaseRequestById, getPurchaseRequestItems } from '@/services/purchaseApi';
import {
  createPurchaseInvoice,
  createPurchaseInvoiceItems,
  updatePurchaseInvoice,
  logPurchaseEvent,
} from '@/services/invoiceApi';
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PaymentTerms,
  CreatePurchaseInvoiceItemPayload,
} from '@/types/purchase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface InvoiceItem {
  request_item_id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
}

export default function NewPurchaseInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [requestItems, setRequestItems] = useState<PurchaseRequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [description, setDescription] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('PREPAYMENT');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expectedDate, setExpectedDate] = useState('');
  const [plannedPaymentDate, setPlannedPaymentDate] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (!requestId) {
      setError('Не вказано ID заявки');
      setLoading(false);
      return;
    }

    async function loadRequestData() {
      try {
        setLoading(true);
        const [reqData, reqItems] = await Promise.all([
          getPurchaseRequestById(requestId!),
          getPurchaseRequestItems(requestId!),
        ]);

        if (!reqData) {
          setError('Заявку не знайдено');
          return;
        }

        if (reqData.status !== 'IN_PROGRESS') {
          setError('Рахунок можна створити тільки для заявок зі статусом "В роботі"');
          return;
        }

        setRequest(reqData);
        setRequestItems(reqItems);
        setCurrency(reqData.currency);
        
        // Pre-populate items from request
        if (reqData.desired_date) {
          setExpectedDate(format(new Date(reqData.desired_date), 'yyyy-MM-dd'));
        }
        
        setItems(reqItems.map(item => ({
          request_item_id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          price: 0,
          amount: 0,
        })));
      } catch (err) {
        console.error(err);
        setError('Помилка завантаження даних заявки');
      } finally {
        setLoading(false);
      }
    }

    loadRequestData();
  }, [requestId]);

  const updateItemPrice = (index: number, price: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          price,
          amount: item.quantity * price,
        };
      }
      return item;
    }));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          quantity,
          amount: quantity * item.price,
        };
      }
      return item;
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const handleSave = async (submitForApproval: boolean = false) => {
    if (!user?.id || !requestId) {
      toast.error('Помилка автентифікації');
      return;
    }

    if (!supplierName.trim()) {
      toast.error('Вкажіть постачальника');
      return;
    }

    if (items.length === 0) {
      toast.error('Додайте позиції до рахунку');
      return;
    }

    if (submitForApproval && items.some(item => item.price <= 0)) {
      toast.error('Вкажіть ціни для всіх позицій');
      return;
    }

    setSaving(true);
    try {
      // Create invoice
      const invoice = await createPurchaseInvoice({
        request_id: requestId,
        supplier_name: supplierName.trim(),
        supplier_contact: supplierContact.trim() || undefined,
        description: description.trim() || undefined,
        payment_terms: paymentTerms,
        invoice_date: invoiceDate || undefined,
        expected_date: expectedDate || undefined,
        planned_payment_date: plannedPaymentDate || undefined,
        currency,
        created_by: user.id,
      });

      // Create invoice items
      const itemPayloads: CreatePurchaseInvoiceItemPayload[] = items.map(item => ({
        invoice_id: invoice.id,
        request_item_id: item.request_item_id,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
      }));

      await createPurchaseInvoiceItems(itemPayloads);

      // Update total amount
      await updatePurchaseInvoice(invoice.id, { amount: totalAmount });

      // Log event
      await logPurchaseEvent('INVOICE', invoice.id, 'CREATED', undefined, {
        request_id: requestId,
        supplier_name: supplierName,
        amount: totalAmount,
      });

      // If submitting for approval
      if (submitForApproval) {
        await updatePurchaseInvoice(invoice.id, { status: 'PENDING_COO' });
        await logPurchaseEvent('INVOICE', invoice.id, 'SUBMITTED_FOR_APPROVAL');
        toast.success('Рахунок створено та відправлено на погодження');
      } else {
        toast.success('Рахунок збережено як чернетку');
      }

      navigate(`/purchase/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Помилка при створенні рахунку');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Помилка</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Новий рахунок</h1>
          <p className="text-muted-foreground">
            На основі заявки {request?.number}
          </p>
        </div>
      </div>

      {/* Invoice Info */}
      <Card>
        <CardHeader>
          <CardTitle>Інформація про рахунок</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier">Постачальник *</Label>
              <Input
                id="supplier"
                placeholder="Назва постачальника"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Контакт постачальника</Label>
              <Input
                id="contact"
                placeholder="Телефон, email"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Умови оплати</Label>
              <Select value={paymentTerms} onValueChange={(v) => setPaymentTerms(v as PaymentTerms)}>
                <SelectTrigger id="paymentTerms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREPAYMENT">Передоплата</SelectItem>
                  <SelectItem value="POSTPAYMENT">Постоплата</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Валюта</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UAH">UAH</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Дата рахунку</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expectedDate">Очікувана дата поставки</Label>
              <Input
                id="expectedDate"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedPaymentDate">Планова дата оплати</Label>
              <Input
                id="plannedPaymentDate"
                type="date"
                value={plannedPaymentDate}
                onChange={(e) => setPlannedPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Примітки</Label>
            <Textarea
              id="description"
              placeholder="Додаткова інформація..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoice Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Позиції рахунку
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Найменування</TableHead>
                <TableHead>Од. виміру</TableHead>
                <TableHead className="w-[120px]">Кількість</TableHead>
                <TableHead className="w-[150px]">Ціна, {currency}</TableHead>
                <TableHead className="text-right">Сума, {currency}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.request_item_id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value) || 0)}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.price || ''}
                      onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold">
                  Всього:
                </TableCell>
                <TableCell className="text-right font-bold text-lg">
                  {totalAmount.toFixed(2)} {currency}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>
          Скасувати
        </Button>
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Зберегти чернетку
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Відправити на погодження
        </Button>
      </div>
    </div>
  );
}
