import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SupplierAutocomplete } from '@/components/purchase/SupplierAutocomplete';
import { RawMaterialAutocomplete } from '@/components/purchase/RawMaterialAutocomplete';
import {
  createRawMaterialInvoice,
  createRawMaterialInvoiceItems,
  updateRawMaterialInvoiceStatus,
  uploadRawMaterialAttachment,
  recalculateRawMaterialInvoiceTotal,
  logRawMaterialEvent,
} from '@/services/rawMaterialApi';
import type { Supplier1cCache, RawMaterial1cCache, PayerEntity } from '@/types/rawMaterial';
import { toast } from 'sonner';

interface LocalItem {
  raw_material_1c_id: string;
  raw_material_name: string;
  uom: string;
  qty: string;
  price: string;
}

interface PendingFile {
  file: File;
  id: string;
  isSupplierInvoice: boolean;
}

const emptyItem = (): LocalItem => ({
  raw_material_1c_id: '',
  raw_material_name: '',
  uom: 'кг',
  qty: '',
  price: '',
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

export default function RawMaterialInvoiceForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [supplier, setSupplier] = useState<Supplier1cCache | null>(null);
  const [payerEntity, setPayerEntity] = useState<PayerEntity>('FOODTECH');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [plannedPaymentDate, setPlannedPaymentDate] = useState('');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => setItems([...items, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LocalItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleMaterialSelect = (index: number, material: RawMaterial1cCache | null, customName?: string) => {
    const updated = [...items];
    if (material) {
      updated[index] = {
        ...updated[index],
        raw_material_1c_id: material.raw_material_1c_id,
        raw_material_name: material.name,
        uom: material.default_uom,
      };
    } else {
      updated[index] = {
        ...updated[index],
        raw_material_1c_id: '',
        raw_material_name: customName || '',
      };
    }
    setItems(updated);
  };

  const getLineAmount = (item: LocalItem): number => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    return qty * price;
  };

  const totalAmount = items.reduce((sum, item) => sum + getLineAmount(item), 0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isSupplierInvoice: boolean) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: файл перевищує 5 МБ`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: непідтримуваний формат`);
        continue;
      }
      setPendingFiles(prev => [...prev, { file, id: crypto.randomUUID(), isSupplierInvoice }]);
    }
    e.target.value = '';
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(p => p.id !== id));
  };

  const validate = (submitForApproval: boolean): boolean => {
    if (!submitForApproval) return true;

    if (!supplier) {
      toast.error('Оберіть постачальника');
      return false;
    }
    const validItems = items.filter(i => i.raw_material_1c_id && parseFloat(i.qty) > 0);
    if (validItems.length === 0) {
      toast.error('Додайте хоча б одну позицію з обраною сировиною та кількістю > 0');
      return false;
    }
    for (const item of validItems) {
      if (parseFloat(item.price) < 0) {
        toast.error('Ціна не може бути від\'ємною');
        return false;
      }
    }
    const hasSupplierInvoice = pendingFiles.some(f => f.isSupplierInvoice);
    if (!hasSupplierInvoice) {
      toast.error('Для відправки на погодження необхідно прикріпити рахунок постачальника (PDF)');
      return false;
    }
    return true;
  };

  const handleSave = async (submitForApproval: boolean) => {
    if (!user?.id) {
      toast.error('Користувач не авторизований');
      return;
    }
    if (!validate(submitForApproval)) return;

    try {
      setSubmitting(true);

      // 1. Create invoice
      const invoice = await createRawMaterialInvoice({
        supplier_1c_id: supplier?.supplier_1c_id || '',
        supplier_name: supplier?.name || '',
        supplier_tax_id: supplier?.tax_id || undefined,
        payer_entity: payerEntity,
        expected_delivery_date: expectedDeliveryDate || undefined,
        planned_payment_date: plannedPaymentDate || undefined,
        comment: comment.trim() || undefined,
        created_by: user.id,
      });

      // 2. Create items
      const validItems = items.filter(i => i.raw_material_1c_id && parseFloat(i.qty) > 0);
      if (validItems.length > 0) {
        await createRawMaterialInvoiceItems(
          validItems.map(item => ({
            invoice_id: invoice.id,
            raw_material_1c_id: item.raw_material_1c_id,
            raw_material_name: item.raw_material_name,
            uom: item.uom,
            qty: parseFloat(item.qty),
            price: parseFloat(item.price) || 0,
          }))
        );
      }

      // 3. Recalculate total
      await recalculateRawMaterialInvoiceTotal(invoice.id);

      // 4. Upload files
      for (const pending of pendingFiles) {
        try {
          await uploadRawMaterialAttachment(
            pending.file,
            invoice.id,
            user.id,
            pending.isSupplierInvoice
          );
        } catch (err) {
          console.error('File upload error:', err);
          toast.error(`Не вдалося завантажити: ${pending.file.name}`);
        }
      }

      // 5. Log creation
      await logRawMaterialEvent(invoice.id, 'CREATED', 'Рахунок створено');

      // 6. Submit if needed
      if (submitForApproval) {
        await updateRawMaterialInvoiceStatus(invoice.id, 'SUBMITTED');
        await logRawMaterialEvent(invoice.id, 'SUBMITTED', 'Відправлено на погодження');
        toast.success('Рахунок відправлено на погодження');
      } else {
        toast.success('Чернетку збережено');
      }

      navigate(`/purchase/raw-invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Не вдалося створити рахунок');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Supplier & payer */}
      <Card>
        <CardHeader>
          <CardTitle>Постачальник та платник</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Постачальник *</Label>
              <SupplierAutocomplete value={supplier} onChange={setSupplier} />
              {supplier?.tax_id && (
                <p className="text-xs text-muted-foreground">ЄДРПОУ: {supplier.tax_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Платник *</Label>
              <Select value={payerEntity} onValueChange={(v) => setPayerEntity(v as PayerEntity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOODTECH">FOODTECH</SelectItem>
                  <SelectItem value="FOP">ФОП</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Дати</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Очікувана дата поставки</Label>
              <Input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Планована дата оплати</Label>
              <Input
                type="date"
                value={plannedPaymentDate}
                onChange={(e) => setPlannedPaymentDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Позиції рахунку</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Додати позицію
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Сировина *</TableHead>
                <TableHead className="w-[10%]">Од. виміру</TableHead>
                <TableHead className="w-[15%]">Кількість *</TableHead>
                <TableHead className="w-[15%]">Ціна, ₴</TableHead>
                <TableHead className="w-[15%]">Сума, ₴</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <RawMaterialAutocomplete
                      value={item.raw_material_name}
                      onChange={(material, customName) => handleMaterialSelect(index, material, customName)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.uom}
                      onChange={(e) => updateItem(index, 'uom', e.target.value)}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {getLineAmount(item).toFixed(2)}
                    </span>
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

          <div className="flex justify-end pt-2 border-t">
            <div className="text-right">
              <span className="text-sm text-muted-foreground mr-3">Загальна сума:</span>
              <span className="text-lg font-bold">{totalAmount.toFixed(2)} ₴</span>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="rawComment">Коментар</Label>
            <Textarea
              id="rawComment"
              placeholder="Внутрішній коментар..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          {/* Supplier invoice file (mandatory for submission) */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Рахунок постачальника (PDF) *
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('supplier-invoice-input')?.click()}
              >
                Додати рахунок
              </Button>
              <input
                id="supplier-invoice-input"
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelect(e, true)}
                accept=".pdf"
              />
            </div>
            {pendingFiles.filter(f => f.isSupplierInvoice).map((pending) => (
              <div key={pending.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border">
                <span className="text-xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pending.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(pending.file.size / 1024 / 1024).toFixed(2)} МБ
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removePendingFile(pending.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Additional attachments */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Додаткові файли
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('raw-extra-files-input')?.click()}
              >
                Додати файл
              </Button>
              <input
                id="raw-extra-files-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e, false)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
            </div>
            {pendingFiles.filter(f => !f.isSupplierInvoice).map((pending) => (
              <div key={pending.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border">
                <span className="text-xl">📎</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pending.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(pending.file.size / 1024 / 1024).toFixed(2)} МБ
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removePendingFile(pending.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              PDF, DOC, DOCX, XLS, XLSX, JPG, PNG • макс. 5 МБ на файл
            </p>
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
