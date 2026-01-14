import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, Package, Send, Trash2, Check, X, Paperclip, Receipt, FileText } from 'lucide-react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { getPurchaseRequestById, getPurchaseRequestItems, updatePurchaseRequestStatus, deletePurchaseRequest } from '@/services/purchaseApi';
import { getPurchaseInvoicesByRequestId, getInvoicedQuantitiesByRequestId, createPurchaseInvoice, createPurchaseInvoiceItems, logPurchaseEvent } from '@/services/invoiceApi';
import { getAttachments, type Attachment } from '@/services/attachmentService';
import { AttachmentsList } from '@/components/purchase/AttachmentsList';
import { FileUploadZone } from '@/components/purchase/FileUploadZone';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseRequest, PurchaseRequestItem, PurchaseRequestStatus, PurchaseType, PurchaseInvoice, PurchaseInvoiceStatus } from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';

const statusLabels: Record<PurchaseRequestStatus, string> = {
  DRAFT: 'Чернетка',
  PENDING_APPROVAL: 'На погодженні',
  IN_PROGRESS: 'В роботі',
  REJECTED: 'Відхилено',
};

const statusVariants: Record<PurchaseRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'outline',
  IN_PROGRESS: 'default',
  REJECTED: 'destructive',
};

const invoiceStatusLabels: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: 'Чернетка',
  PENDING_COO: 'На погодженні',
  PENDING_CEO: 'На погодженні',
  TO_PAY: 'До оплати',
  PAID: 'Оплачено',
  DELIVERED: 'Доставлено',
  REJECTED: 'Відхилено',
};

const typeLabels: Record<PurchaseType, string> = {
  TMC: 'ТМЦ',
  SERVICE: 'Послуга',
};

export default function PurchaseRequestDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  
  const fromQueue = location.state?.from === 'queue';
  const backPath = fromQueue ? '/purchase/queue' : '/purchase/requests';
  
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [creatorName, setCreatorName] = useState<string>('');
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoicedQuantities, setInvoicedQuantities] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const isDraft = request?.status === 'DRAFT';
  const isPendingApproval = request?.status === 'PENDING_APPROVAL';
  const isInProgress = request?.status === 'IN_PROGRESS';
  const isCOO = profile?.role === 'coo' || profile?.role === 'admin';
  const isProcurementManager = profile?.role === 'procurement_manager' || profile?.role === 'admin';
  const isOwner = request?.created_by === user?.id;

  // Check if there are remaining quantities to invoice
  const hasRemainingQuantities = items.some(item => {
    const invoiced = invoicedQuantities.get(item.id) || 0;
    return item.quantity > invoiced;
  });

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      
      try {
        setLoading(true);
        const [requestData, itemsData, attachmentsData, invoicesData, invoicedQty] = await Promise.all([
          getPurchaseRequestById(id),
          getPurchaseRequestItems(id),
          getAttachments('request', id),
          getPurchaseInvoicesByRequestId(id),
          getInvoicedQuantitiesByRequestId(id),
        ]);
        
        if (!requestData) {
          setError('Заявку не знайдено');
          return;
        }
        
        setRequest(requestData);
        setItems(itemsData);
        setAttachments(attachmentsData);
        setInvoices(invoicesData);
        setInvoicedQuantities(invoicedQty);
        
        // Load creator profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', requestData.created_by)
          .single();
        
        if (profileData) {
          setCreatorName(profileData.name || profileData.email);
        }
      } catch (err) {
        console.error(err);
        setError('Не вдалося завантажити дані заявки');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: uk });
  };

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: uk });
  };

  const handleSubmitForApproval = async () => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      await updatePurchaseRequestStatus(id, 'IN_PROGRESS');
      setRequest(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null);
      toast.success('Заявку відправлено в роботу');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відправці в роботу');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deletePurchaseRequest(id);
      toast.success('Заявку видалено');
      navigate('/purchase/requests');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при видаленні заявки');
      setIsDeleting(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    setIsApproving(true);
    try {
      await updatePurchaseRequestStatus(id, 'IN_PROGRESS');
      setRequest(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null);
      toast.success('Заявку погоджено');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні заявки');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setIsRejecting(true);
    try {
      await updatePurchaseRequestStatus(id, 'REJECTED');
      setRequest(prev => prev ? { ...prev, status: 'REJECTED' } : null);
      toast.success('Заявку відхилено');
      setRejectComment('');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні заявки');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!id || !user?.id || !request) return;
    setIsCreatingInvoice(true);
    try {
      // Create draft invoice immediately
      const invoice = await createPurchaseInvoice({
        request_id: id,
        currency: request.currency,
        created_by: user.id,
      });

      // Create invoice items from remaining quantities
      const remainingItems = items
        .filter(item => {
          const invoiced = invoicedQuantities.get(item.id) || 0;
          return item.quantity > invoiced;
        })
        .map(item => {
          const invoiced = invoicedQuantities.get(item.id) || 0;
          const remaining = item.quantity - invoiced;
          return {
            invoice_id: invoice.id,
            request_item_id: item.id,
            name: item.name,
            unit: item.unit,
            quantity: remaining,
            price: 0,
          };
        });

      if (remainingItems.length > 0) {
        await createPurchaseInvoiceItems(remainingItems);
      }

      // Log the creation
      await logPurchaseEvent('INVOICE', invoice.id, 'CREATED');

      toast.success('Рахунок створено');
      navigate(`/purchase/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Помилка при створенні рахунку');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Помилка</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error || 'Заявку не знайдено'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{request.number}</h1>
            <Badge variant={statusVariants[request.status]}>
              {statusLabels[request.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">Заявка на закупівлю</p>
        </div>
        
        {/* Draft actions */}
        {isDraft && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmitForApproval}
              disabled={isSubmitting || items.length === 0}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Відправити в роботу
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Видалити
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Видалити заявку?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ви впевнені, що хочете видалити заявку {request.number}? Цю дію неможливо скасувати.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Видалити
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* COO Approval actions removed - requests are auto-approved */}

        {/* Procurement Manager actions for IN_PROGRESS requests */}
        {isProcurementManager && isInProgress && hasRemainingQuantities && (
          <Button onClick={handleCreateInvoice} disabled={isCreatingInvoice}>
            {isCreatingInvoice ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="mr-2 h-4 w-4" />
            )}
            Створити рахунок
          </Button>
        )}
      </div>

      {/* Request Info */}
      <Card>
        <CardHeader>
          <CardTitle>Інформація про заявку</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Замовник</p>
              <p className="font-medium">{creatorName || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Тип закупівлі</p>
              <p className="font-medium">{typeLabels[request.purchase_type]}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Бажана дата поставки</p>
              <p className="font-medium">{formatDateShort(request.desired_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Дата створення</p>
              <p className="font-medium">{formatDate(request.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Останнє оновлення</p>
              <p className="font-medium">{formatDate(request.updated_at)}</p>
            </div>
          </div>
          
          {request.description && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Опис</p>
              <p className="whitespace-pre-wrap">{request.description}</p>
            </div>
          )}

          {/* Invoices section */}
          {invoices.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Рахунки ({invoices.length})
              </p>
              <div className="space-y-2">
                {invoices.map(invoice => (
                  <div key={invoice.id} className="flex items-center gap-3 text-sm">
                    <Link 
                      to={`/purchase/invoices/${invoice.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {invoice.number}
                    </Link>
                    <Badge variant={invoice.status === 'DRAFT' ? 'secondary' : invoice.status === 'REJECTED' ? 'destructive' : 'outline'} className="text-xs">
                      {invoiceStatusLabels[invoice.status]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {invoice.amount.toFixed(2)} {invoice.currency}
                    </span>
                    <span className="text-muted-foreground">
                      {invoice.supplier_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Позиції заявки
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              Позиції відсутні. Додайте позиції до заявки.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Найменування</TableHead>
                  <TableHead>Од. виміру</TableHead>
                  <TableHead className="text-right">Замовлено</TableHead>
                  {isInProgress && (
                    <>
                      <TableHead className="text-right">В рахунках</TableHead>
                      <TableHead className="text-right">Залишок</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const invoiced = invoicedQuantities.get(item.id) || 0;
                  const remaining = item.quantity - invoiced;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      {isInProgress && (
                        <>
                          <TableCell className="text-right">{invoiced}</TableCell>
                          <TableCell className={`text-right font-medium ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {remaining}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Прикріплені файли
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isDraft && isOwner && user?.id && (
            <div className="mb-4">
              <FileUploadZone
                entityType="request"
                entityId={id!}
                userId={user.id}
                onUploadComplete={(attachment) => {
                  setAttachments(prev => [...prev, attachment]);
                }}
              />
            </div>
          )}
          <AttachmentsList
            attachments={attachments}
            entityType="request"
            canDelete={isDraft && isOwner}
            onDelete={(attachmentId) => {
              setAttachments(prev => prev.filter(a => a.id !== attachmentId));
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}