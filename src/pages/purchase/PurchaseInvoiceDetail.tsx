import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
  ArrowLeft,
  Loader2,
  Package,
  Send,
  Trash2,
  Check,
  X,
  Clock,
  CreditCard,
  Truck,
  FileText,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  getPurchaseInvoiceById,
  getPurchaseInvoiceItems,
  updatePurchaseInvoice,
  deletePurchaseInvoice,
  logPurchaseEvent,
  getPurchaseLogs,
} from '@/services/invoiceApi';
import { supabase } from '@/integrations/supabase/client';
import type {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseInvoiceStatus,
  PaymentTerms,
  PurchaseLog,
} from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from 'sonner';

const statusLabels: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: 'Чернетка',
  PENDING_COO: 'На погодженні',
  PENDING_CEO: 'На погодженні',
  TO_PAY: 'До оплати',
  PAID: 'Оплачено',
  DELIVERED: 'Доставлено',
  REJECTED: 'Відхилено',
};

const statusVariants: Record<PurchaseInvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_COO: 'outline',
  PENDING_CEO: 'outline',
  TO_PAY: 'default',
  PAID: 'default',
  DELIVERED: 'default',
  REJECTED: 'destructive',
};

const paymentTermsLabels: Record<PaymentTerms, string> = {
  PREPAYMENT: 'Передоплата',
  POSTPAYMENT: 'Постоплата',
};

export default function PurchaseInvoiceDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile, user } = useAuth();

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);
  const [logs, setLogs] = useState<PurchaseLog[]>([]);
  const [creatorName, setCreatorName] = useState<string>('');
  const [requestNumber, setRequestNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  // Role checks
  const isDraft = invoice?.status === 'DRAFT';
  const isPendingCOO = invoice?.status === 'PENDING_COO';
  const isPendingCEO = invoice?.status === 'PENDING_CEO';
  const isToPayStatus = invoice?.status === 'TO_PAY';
  const isPaidStatus = invoice?.status === 'PAID';
  const isOwner = invoice?.created_by === user?.id;
  const isCOO = profile?.role === 'coo' || profile?.role === 'admin';
  const isCEO = profile?.role === 'ceo' || profile?.role === 'admin';
  const isTreasurer = profile?.role === 'treasurer' || profile?.role === 'admin';
  const isAccountant = profile?.role === 'accountant' || profile?.role === 'admin';
  const isProcurementManager = profile?.role === 'procurement_manager' || profile?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      if (!id) return;

      try {
        setLoading(true);
        const [invoiceData, itemsData, logsData] = await Promise.all([
          getPurchaseInvoiceById(id),
          getPurchaseInvoiceItems(id),
          getPurchaseLogs('INVOICE', id),
        ]);

        if (!invoiceData) {
          setError('Рахунок не знайдено');
          return;
        }

        setInvoice(invoiceData);
        setItems(itemsData);
        setLogs(logsData);

        // Load creator profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', invoiceData.created_by)
          .single();

        if (profileData) {
          setCreatorName(profileData.name || profileData.email);
        }

        // Load request number if linked
        if (invoiceData.request_id) {
          const { data: requestData } = await supabase
            .from('purchase_requests')
            .select('number')
            .eq('id', invoiceData.request_id)
            .single();

          if (requestData) {
            setRequestNumber(requestData.number);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Не вдалося завантажити дані рахунку');
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
      await updatePurchaseInvoice(id, { status: 'PENDING_COO' });
      await logPurchaseEvent('INVOICE', id, 'SUBMITTED_FOR_APPROVAL');
      setInvoice(prev => prev ? { ...prev, status: 'PENDING_COO' } : null);
      toast.success('Рахунок відправлено на погодження');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відправці на погодження');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deletePurchaseInvoice(id);
      toast.success('Рахунок видалено');
      navigate('/purchase/invoices');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при видаленні рахунку');
      setIsDeleting(false);
    }
  };

  const handleCOOApprove = async () => {
    if (!id || !user?.id) return;
    setIsApproving(true);
    try {
      // COO approves - check if CEO also approved
      const ceoAlreadyApproved = invoice?.ceo_decision === 'APPROVED';
      const newStatus: PurchaseInvoiceStatus = ceoAlreadyApproved ? 'TO_PAY' : 'PENDING_CEO';

      await updatePurchaseInvoice(id, {
        coo_decision: 'APPROVED',
        coo_decided_by: user.id,
        coo_decided_at: new Date().toISOString(),
        status: newStatus,
      });
      await logPurchaseEvent('INVOICE', id, 'COO_APPROVED');
      setInvoice(prev =>
        prev
          ? {
              ...prev,
              status: newStatus,
              coo_decision: 'APPROVED',
              coo_decided_by: user.id,
              coo_decided_at: new Date().toISOString(),
            }
          : null
      );
      toast.success(ceoAlreadyApproved ? 'Рахунок погоджено, передано до оплати' : 'Рахунок погоджено COO');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCEOApprove = async () => {
    if (!id || !user?.id) return;
    setIsApproving(true);
    try {
      // CEO approves - check if COO also approved
      const cooAlreadyApproved = invoice?.coo_decision === 'APPROVED';
      const newStatus: PurchaseInvoiceStatus = cooAlreadyApproved ? 'TO_PAY' : 'PENDING_COO';

      await updatePurchaseInvoice(id, {
        ceo_decision: 'APPROVED',
        ceo_decided_by: user.id,
        ceo_decided_at: new Date().toISOString(),
        status: newStatus,
      });
      await logPurchaseEvent('INVOICE', id, 'CEO_APPROVED');
      setInvoice(prev =>
        prev
          ? {
              ...prev,
              status: newStatus,
              ceo_decision: 'APPROVED',
              ceo_decided_by: user.id,
              ceo_decided_at: new Date().toISOString(),
            }
          : null
      );
      toast.success(cooAlreadyApproved ? 'Рахунок погоджено, передано до оплати' : 'Рахунок погоджено CEO');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (role: 'COO' | 'CEO') => {
    if (!id || !user?.id) return;
    setIsRejecting(true);
    try {
      const updates: Partial<PurchaseInvoice> =
        role === 'COO'
          ? {
              coo_decision: 'REJECTED',
              coo_decided_by: user.id,
              coo_decided_at: new Date().toISOString(),
              coo_comment: rejectComment || null,
              status: 'REJECTED',
            }
          : {
              ceo_decision: 'REJECTED',
              ceo_decided_by: user.id,
              ceo_decided_at: new Date().toISOString(),
              ceo_comment: rejectComment || null,
              status: 'REJECTED',
            };

      await updatePurchaseInvoice(id, updates);
      await logPurchaseEvent('INVOICE', id, `${role}_REJECTED`, rejectComment || undefined);
      setInvoice(prev => (prev ? { ...prev, ...updates } : null));
      toast.success('Рахунок відхилено');
      setRejectComment('');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!id) return;
    setIsApproving(true);
    try {
      await updatePurchaseInvoice(id, {
        status: 'PAID',
        paid_date: new Date().toISOString(),
      });
      await logPurchaseEvent('INVOICE', id, 'MARKED_PAID');
      setInvoice(prev =>
        prev ? { ...prev, status: 'PAID', paid_date: new Date().toISOString() } : null
      );
      toast.success('Рахунок позначено як оплачений');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при оновленні статусу');
    } finally {
      setIsApproving(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!id) return;
    setIsApproving(true);
    try {
      await updatePurchaseInvoice(id, {
        status: 'DELIVERED',
        delivered_date: new Date().toISOString(),
      });
      await logPurchaseEvent('INVOICE', id, 'MARKED_DELIVERED');
      setInvoice(prev =>
        prev ? { ...prev, status: 'DELIVERED', delivered_date: new Date().toISOString() } : null
      );
      toast.success('Товар позначено як доставлений');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при оновленні статусу');
    } finally {
      setIsApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/purchase/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Помилка</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error || 'Рахунок не знайдено'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine which COO/CEO actions to show
  const showCOOApproval = isCOO && (isPendingCOO || (isPendingCEO && invoice.coo_decision === 'PENDING'));
  const showCEOApproval = isCEO && (isPendingCEO || (isPendingCOO && invoice.ceo_decision === 'PENDING'));
  const showTreasurerAction = isTreasurer && isToPayStatus;
  const showAccountantAction = isAccountant && isPaidStatus;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchase/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{invoice.number}</h1>
            <Badge variant={statusVariants[invoice.status]}>{statusLabels[invoice.status]}</Badge>
          </div>
          <p className="text-muted-foreground">Рахунок на закупівлю</p>
        </div>

        {/* Draft actions */}
        {isDraft && isOwner && (
          <div className="flex items-center gap-2">
            <Button onClick={handleSubmitForApproval} disabled={isSubmitting || items.length === 0}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Відправити на погодження
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
                  <AlertDialogTitle>Видалити рахунок?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ви впевнені, що хочете видалити рахунок {invoice.number}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Видалити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* COO Approval */}
        {showCOOApproval && (
          <div className="flex items-center gap-2">
            <Button onClick={handleCOOApprove} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
              {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Погодити (COO)
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isRejecting}>
                  {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  Відхилити
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Відхилити рахунок?</AlertDialogTitle>
                  <AlertDialogDescription>Ви впевнені, що хочете відхилити рахунок {invoice.number}?</AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Причина відхилення"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  className="my-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleReject('COO')}>Відхилити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* CEO Approval */}
        {showCEOApproval && (
          <div className="flex items-center gap-2">
            <Button onClick={handleCEOApprove} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
              {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Погодити (CEO)
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isRejecting}>
                  {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  Відхилити
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Відхилити рахунок?</AlertDialogTitle>
                  <AlertDialogDescription>Ви впевнені, що хочете відхилити рахунок {invoice.number}?</AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Причина відхилення"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  className="my-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleReject('CEO')}>Відхилити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Treasurer Action */}
        {showTreasurerAction && (
          <Button onClick={handleMarkPaid} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
            {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Позначити оплаченим
          </Button>
        )}

        {/* Accountant Action */}
        {showAccountantAction && (
          <Button onClick={handleMarkDelivered} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
            {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Позначити доставленим
          </Button>
        )}
      </div>

      {/* Invoice Info */}
      <Card>
        <CardHeader>
          <CardTitle>Інформація про рахунок</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Постачальник</p>
              <p className="font-medium">{invoice.supplier_name}</p>
              {invoice.supplier_contact && (
                <p className="text-sm text-muted-foreground">{invoice.supplier_contact}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Заявка</p>
              {requestNumber ? (
                <Button
                  variant="link"
                  className="p-0 h-auto font-medium"
                  onClick={() => navigate(`/purchase/requests/${invoice.request_id}`)}
                >
                  {requestNumber}
                </Button>
              ) : (
                <p className="font-medium">—</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Сума</p>
              <p className="font-medium text-lg">
                {invoice.amount.toFixed(2)} {invoice.currency}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Умови оплати</p>
              <p className="font-medium">{paymentTermsLabels[invoice.payment_terms]}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Дата рахунку</p>
              <p className="font-medium">{formatDateShort(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Очікувана поставка</p>
              <p className="font-medium">{formatDateShort(invoice.expected_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Створив</p>
              <p className="font-medium">{creatorName || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Дата створення</p>
              <p className="font-medium">{formatDate(invoice.created_at)}</p>
            </div>
            {invoice.paid_date && (
              <div>
                <p className="text-sm text-muted-foreground">Дата оплати</p>
                <p className="font-medium">{formatDateShort(invoice.paid_date)}</p>
              </div>
            )}
            {invoice.delivered_date && (
              <div>
                <p className="text-sm text-muted-foreground">Дата доставки</p>
                <p className="font-medium">{formatDateShort(invoice.delivered_date)}</p>
              </div>
            )}
          </div>

          {invoice.description && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Примітки</p>
              <p className="whitespace-pre-wrap">{invoice.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Status */}
      {(invoice.coo_decision !== 'PENDING' || invoice.ceo_decision !== 'PENDING') && (
        <Card>
          <CardHeader>
            <CardTitle>Статус погодження</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    invoice.coo_decision === 'APPROVED'
                      ? 'bg-green-500'
                      : invoice.coo_decision === 'REJECTED'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}
                />
                <div>
                  <p className="font-medium">COO</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.coo_decision === 'APPROVED'
                      ? 'Погоджено'
                      : invoice.coo_decision === 'REJECTED'
                      ? 'Відхилено'
                      : 'Очікує'}
                    {invoice.coo_decided_at && ` • ${formatDateShort(invoice.coo_decided_at)}`}
                  </p>
                  {invoice.coo_comment && (
                    <p className="text-sm text-muted-foreground mt-1">{invoice.coo_comment}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    invoice.ceo_decision === 'APPROVED'
                      ? 'bg-green-500'
                      : invoice.ceo_decision === 'REJECTED'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}
                />
                <div>
                  <p className="font-medium">CEO</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.ceo_decision === 'APPROVED'
                      ? 'Погоджено'
                      : invoice.ceo_decision === 'REJECTED'
                      ? 'Відхилено'
                      : 'Очікує'}
                    {invoice.ceo_decided_at && ` • ${formatDateShort(invoice.ceo_decided_at)}`}
                  </p>
                  {invoice.ceo_comment && (
                    <p className="text-sm text-muted-foreground mt-1">{invoice.ceo_comment}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Позиції рахунку
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">Позиції відсутні</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Найменування</TableHead>
                  <TableHead>Од. виміру</TableHead>
                  <TableHead className="text-right">Кількість</TableHead>
                  <TableHead className="text-right">Ціна</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{item.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">
                    Всього:
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {invoice.amount.toFixed(2)} {invoice.currency}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Історія змін
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p>
                      <span className="font-medium">{log.action}</span> — {log.user_email}
                    </p>
                    {log.comment && <p className="text-muted-foreground">{log.comment}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
