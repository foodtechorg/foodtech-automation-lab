import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { ArrowLeft, Loader2, Plus, Trash2, Paperclip, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createPurchaseRequest, createPurchaseRequestItems, updatePurchaseRequestStatus } from '@/services/purchaseApi';
import { uploadAttachment, validateFile, type Attachment } from '@/services/attachmentService';
import { AttachmentsList } from '@/components/purchase/AttachmentsList';
import RawMaterialInvoiceForm from '@/components/purchase/RawMaterialInvoiceForm';
import type { PurchaseType } from '@/types/purchase';
import { toast } from 'sonner';

const FIXED_ASSET_HINT = 'Основний засіб — це майно для тривалого використання (більше одного року): обладнання, техніка, меблі, інструменти, пристрої тощо. Якщо предмет буде закріплений за працівником або підрозділом і використовуватиметься багато разів — оберіть «Так».';
const MVO_HINT = 'Матеріально відповідальна особа — це працівник, за яким закріплюється майно компанії і який відповідає за його збереження, правильне використання та повернення у разі передачі або звільнення. Працівник повинен бути в штаті юридичної особи на яку купується основний засіб.';

interface LocalItem {
  name: string;
  unit: string;
  quantity: string;
}

interface PendingFile {
  file: File;
  id: string;
}

const emptyItem = (): LocalItem => ({ name: '', unit: '', quantity: '' });

export default function NewPurchaseRequest() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const RAW_MATERIAL_ROLES = ['admin', 'financial_analyst', 'foreign_trade_manager'];
  const canCreateRawMaterial = !!profile?.role && RAW_MATERIAL_ROLES.includes(profile.role);
  
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('TMC');
  const [desiredDate, setDesiredDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  const [isFixedAsset, setIsFixedAsset] = useState(false);
  const [fixedAssetMvo, setFixedAssetMvo] = useState('');

  const isRawMaterial = purchaseType === 'RAW_MATERIAL';

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }
      setPendingFiles(prev => [...prev, { file, id: crypto.randomUUID() }]);
    }
    e.target.value = '';
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = async (submitForApproval: boolean) => {
    if (!user?.id) {
      toast.error('Користувач не авторизований');
      return;
    }

    if (!validateItems()) return;

    if (purchaseType === 'TMC' && isFixedAsset && !fixedAssetMvo.trim()) {
      toast.error('Вкажіть МВО для основного засобу');
      return;
    }

    try {
      setSubmitting(true);

      const applyFixedAsset = purchaseType === 'TMC' && isFixedAsset;
      const newRequest = await createPurchaseRequest({
        purchase_type: purchaseType,
        description: description.trim() || undefined,
        desired_date: desiredDate || undefined,
        is_fixed_asset: applyFixedAsset,
        fixed_asset_mvo: applyFixedAsset ? fixedAssetMvo.trim() : null,
        created_by: user.id,
      });

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

      for (const pending of pendingFiles) {
        try {
          await uploadAttachment(pending.file, 'request', newRequest.id, user.id);
        } catch (err) {
          console.error('File upload error:', err);
          toast.error(`Не вдалося завантажити: ${pending.file.name}`);
        }
      }

      if (submitForApproval) {
        await updatePurchaseRequestStatus(newRequest.id, 'IN_PROGRESS');
        toast.success('Заявку відправлено в роботу');
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
          <h1 className="text-2xl font-bold">
            {isRawMaterial ? 'Новий рахунок на сировину' : 'Нова заявка на закупівлю'}
          </h1>
          <p className="text-muted-foreground">
            {isRawMaterial
              ? 'Створення рахунку на закупівлю сировини'
              : 'Створення нової заявки на закупівлю ТМЦ'}
          </p>
        </div>
      </div>

      {/* Purchase type selector - always visible */}
      <Card>
        <CardHeader>
          <CardTitle>Тип закупівлі</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="purchaseType">Тип *</Label>
            <Select value={purchaseType} onValueChange={(v) => setPurchaseType(v as PurchaseType)}>
              <SelectTrigger id="purchaseType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TMC">ТМЦ (товарно-матеріальні цінності)</SelectItem>
                <SelectItem value="SERVICE">Послуга</SelectItem>
                {canCreateRawMaterial && (
                  <SelectItem value="RAW_MATERIAL">Закупівля сировини</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conditional form rendering */}
      {isRawMaterial ? (
        <RawMaterialInvoiceForm />
      ) : (
        <>
          {/* General Info - dates */}
          <Card>
            <CardHeader>
              <CardTitle>Загальна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="desiredDate">Бажана дата поставки</Label>
                <Input
                  id="desiredDate"
                  type="date"
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                />
              </div>

              {purchaseType === 'TMC' && (
                <TooltipProvider delayDuration={150}>
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isFixedAsset"
                        checked={isFixedAsset}
                        onCheckedChange={(checked) => {
                          const next = checked === true;
                          setIsFixedAsset(next);
                          if (!next) setFixedAssetMvo('');
                        }}
                      />
                      <Label htmlFor="isFixedAsset" className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-base">
                        Це заявка на основний засіб? <span className="text-muted-foreground font-normal">(Так)</span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Підказка про основний засіб"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm">{FIXED_ASSET_HINT}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {isFixedAsset && (
                      <div className="space-y-2 max-w-xl pl-6">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="fixedAssetMvo">
                            Вкажіть будь ласка МВО для основного засобу <span className="text-destructive">*</span>
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Підказка про МВО"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{MVO_HINT}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="fixedAssetMvo"
                          value={fixedAssetMvo}
                          onChange={(e) => setFixedAssetMvo(e.target.value)}
                          placeholder="ПІБ працівника"
                        />
                      </div>
                    )}
                  </div>
                </TooltipProvider>
              )}
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

              {/* File attachments */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Прикріплені файли
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Додати файл
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                </div>
                
                {pendingFiles.length > 0 && (
                  <div className="space-y-2">
                    {pendingFiles.map((pending) => (
                      <div 
                        key={pending.id} 
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border"
                      >
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
                  </div>
                )}
                
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
                  Відправити в роботу
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
        </>
      )}
    </div>
  );
}
