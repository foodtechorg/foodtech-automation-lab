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
import { ArrowLeft, Loader2, Package, Send, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPurchaseRequestById, getPurchaseRequestItems, updatePurchaseRequestStatus, deletePurchaseRequest } from '@/services/purchaseApi';
import type { PurchaseRequest, PurchaseRequestItem, PurchaseRequestStatus, PurchaseType, PurchaseItemStatus } from '@/types/purchase';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from 'sonner';

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

const typeLabels: Record<PurchaseType, string> = {
  TMC: 'ТМЦ',
  SERVICE: 'Послуга',
};

const itemStatusLabels: Record<PurchaseItemStatus, string> = {
  IN_PROGRESS: 'В роботі',
  PENDING_APPROVAL: 'На погодженні',
  TO_PAY: 'До оплати',
  PAID: 'Оплачено',
  DELIVERED: 'Доставлено',
  REJECTED: 'Відхилено',
};

export default function PurchaseRequestDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isDraft = request?.status === 'DRAFT';

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      
      try {
        setLoading(true);
        const [requestData, itemsData] = await Promise.all([
          getPurchaseRequestById(id),
          getPurchaseRequestItems(id),
        ]);
        
        if (!requestData) {
          setError('Заявку не знайдено');
          return;
        }
        
        setRequest(requestData);
        setItems(itemsData);
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
      await updatePurchaseRequestStatus(id, 'PENDING_APPROVAL');
      setRequest(prev => prev ? { ...prev, status: 'PENDING_APPROVAL' } : null);
      toast.success('Заявку відправлено на погодження');
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
      await deletePurchaseRequest(id);
      toast.success('Заявку видалено');
      navigate('/purchase/requests');
    } catch (err) {
      console.error(err);
      toast.error('Помилка при видаленні заявки');
      setIsDeleting(false);
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/purchase/requests')}>
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchase/requests')}>
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
      </div>

      {/* Request Info */}
      <Card>
        <CardHeader>
          <CardTitle>Інформація про заявку</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Тип закупівлі</p>
              <p className="font-medium">{typeLabels[request.purchase_type]}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Валюта</p>
              <p className="font-medium">{request.currency}</p>
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
                  <TableHead className="text-right">Кількість</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{itemStatusLabels[item.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
