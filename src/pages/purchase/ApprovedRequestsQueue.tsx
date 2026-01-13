import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Plus, Edit, Check, X, Receipt, CreditCard, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseRequest, PurchaseType, PurchaseInvoice } from '@/types/purchase';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PurchaseNavTabs } from '@/components/purchase/PurchaseNavTabs';
import { PurchasePageHeader } from '@/components/purchase/PurchasePageHeader';
import { createPurchaseInvoice, createPurchaseInvoiceItems, logPurchaseEvent, updatePurchaseInvoice } from '@/services/invoiceApi';
import { getPurchaseRequestItems, updatePurchaseRequestStatus } from '@/services/purchaseApi';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const typeLabels: Record<PurchaseType, string> = {
  TMC: 'ТМЦ',
  SERVICE: 'Послуга',
};

const paymentTermsLabels: Record<string, string> = {
  PREPAYMENT: 'Передоплата',
  POSTPAYMENT: 'Післяоплата',
};

interface RequestWithCreator extends PurchaseRequest {
  creator_name: string;
  creator_email: string;
  has_draft_invoice?: boolean;
  has_remaining_items?: boolean;
}

interface InvoiceWithCreator extends PurchaseInvoice {
  creator_name: string;
  creator_email: string;
  requester_name?: string;
  requester_email?: string;
}

export default function ApprovedRequestsQueue() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  // Procurement manager queue state
  const [requests, setRequests] = useState<RequestWithCreator[]>([]);
  
  // COO/CEO queue state
  const [pendingApprovalRequests, setPendingApprovalRequests] = useState<RequestWithCreator[]>([]);
  const [pendingCOOInvoices, setPendingCOOInvoices] = useState<InvoiceWithCreator[]>([]);
  const [pendingCEOInvoices, setPendingCEOInvoices] = useState<InvoiceWithCreator[]>([]);
  
  // Treasurer queue state
  const [toPayInvoices, setToPayInvoices] = useState<InvoiceWithCreator[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const isCOO = profile?.role === 'coo' || profile?.role === 'admin';
  const isCEO = profile?.role === 'ceo' || profile?.role === 'admin';
  const isProcurementManager = profile?.role === 'procurement_manager' || profile?.role === 'admin';
  const isTreasurer = profile?.role === 'treasurer' || profile?.role === 'chief_accountant' || profile?.role === 'admin';

  useEffect(() => {
    loadQueueData();
  }, [profile?.role]);

  async function loadQueueData() {
    try {
      setLoading(true);
      setError(null);

      // Load data based on role
      if (isCOO) {
        await loadCOOQueue();
      }
      if (isCEO) {
        await loadCEOQueue();
      }
      if (isProcurementManager) {
        await loadProcurementQueue();
      }
      if (isTreasurer) {
        await loadTreasurerQueue();
      }
    } catch (err) {
      console.error(err);
      setError('Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  }

  async function loadCOOQueue() {
    // Load PENDING_APPROVAL requests
    const { data: requestsData, error: reqError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false });

    if (reqError) throw reqError;

    // Load PENDING_COO invoices where COO hasn't decided yet
    const { data: invoicesData, error: invError } = await supabase
      .from('purchase_invoices')
      .select('*')
      .eq('status', 'PENDING_COO')
      .eq('coo_decision', 'PENDING')
      .order('created_at', { ascending: false });

    if (invError) throw invError;

    // Get creator profiles for requests
    const reqCreatorIds = [...new Set((requestsData || []).map(r => r.created_by))];
    const invCreatorIds = [...new Set((invoicesData || []).map(i => i.created_by))];
    const allCreatorIds = [...new Set([...reqCreatorIds, ...invCreatorIds])];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', allCreatorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Enrich requests
    const enrichedRequests: RequestWithCreator[] = (requestsData || []).map(req => {
      const profile = profileMap.get(req.created_by);
      return {
        ...req,
        creator_name: profile?.name || profile?.email || 'Невідомий',
        creator_email: profile?.email || '',
      };
    });

    // For invoices, get requester info from linked purchase_requests
    const invoiceRequestIds = [...new Set((invoicesData || []).filter(i => i.request_id).map(i => i.request_id!))];
    let requestCreatorMap = new Map<string, { name: string; email: string }>();
    
    if (invoiceRequestIds.length > 0) {
      const { data: linkedRequests } = await supabase
        .from('purchase_requests')
        .select('id, created_by')
        .in('id', invoiceRequestIds);
      
      const linkedRequestCreatorIds = [...new Set((linkedRequests || []).map(r => r.created_by))];
      const { data: requesterProfiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', linkedRequestCreatorIds);
      
      const requesterProfileMap = new Map(requesterProfiles?.map(p => [p.id, p]) || []);
      
      for (const req of linkedRequests || []) {
        const profile = requesterProfileMap.get(req.created_by);
        if (profile) {
          requestCreatorMap.set(req.id, { 
            name: profile.name || profile.email || 'Невідомий', 
            email: profile.email || '' 
          });
        }
      }
    }

    // Enrich invoices with requester info
    const enrichedInvoices: InvoiceWithCreator[] = (invoicesData || []).map(inv => {
      const profile = profileMap.get(inv.created_by);
      const requester = inv.request_id ? requestCreatorMap.get(inv.request_id) : null;
      return {
        ...inv,
        creator_name: profile?.name || profile?.email || 'Невідомий',
        creator_email: profile?.email || '',
        requester_name: requester?.name || '',
        requester_email: requester?.email || '',
      };
    });

    setPendingApprovalRequests(enrichedRequests);
    setPendingCOOInvoices(enrichedInvoices);
  }

  async function loadCEOQueue() {
    // Load PENDING_COO invoices where CEO hasn't decided yet (parallel approval)
    const { data: invoicesData, error: invError } = await supabase
      .from('purchase_invoices')
      .select('*')
      .eq('status', 'PENDING_COO')
      .eq('ceo_decision', 'PENDING')
      .order('created_at', { ascending: false });

    if (invError) throw invError;

    // Get creator profiles
    const creatorIds = [...new Set((invoicesData || []).map(i => i.created_by))];

    const { data: profiles } = creatorIds.length > 0 
      ? await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', creatorIds)
      : { data: [] as { id: string; name: string | null; email: string }[] };

    const profileMap = new Map(profiles?.map(p => [p.id, p] as const) || []);

    // For invoices, get requester info from linked purchase_requests
    const invoiceRequestIds = [...new Set((invoicesData || []).filter(i => i.request_id).map(i => i.request_id!))];
    let requestCreatorMap = new Map<string, { name: string; email: string }>();
    
    if (invoiceRequestIds.length > 0) {
      const { data: linkedRequests } = await supabase
        .from('purchase_requests')
        .select('id, created_by')
        .in('id', invoiceRequestIds);
      
      const linkedRequestCreatorIds = [...new Set((linkedRequests || []).map(r => r.created_by))];
      const { data: requesterProfiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', linkedRequestCreatorIds);
      
      const requesterProfileMap = new Map(requesterProfiles?.map(p => [p.id, p]) || []);
      
      for (const req of linkedRequests || []) {
        const profile = requesterProfileMap.get(req.created_by);
        if (profile) {
          requestCreatorMap.set(req.id, { 
            name: profile.name || profile.email || 'Невідомий', 
            email: profile.email || '' 
          });
        }
      }
    }

    // Enrich invoices with requester info
    const enrichedInvoices: InvoiceWithCreator[] = (invoicesData || []).map(inv => {
      const profile = profileMap.get(inv.created_by);
      const requester = inv.request_id ? requestCreatorMap.get(inv.request_id) : null;
      return {
        ...inv,
        creator_name: profile?.name || profile?.email || 'Невідомий',
        creator_email: profile?.email || '',
        requester_name: requester?.name || '',
        requester_email: requester?.email || '',
      };
    });

    setPendingCEOInvoices(enrichedInvoices);
  }

  async function loadProcurementQueue() {
    // Get all IN_PROGRESS requests
    const { data: requestsData, error: requestsError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('status', 'IN_PROGRESS')
      .order('created_at', { ascending: false });

    if (requestsError) throw requestsError;

    if (!requestsData || requestsData.length === 0) {
      setRequests([]);
      return;
    }

    const requestIds = requestsData.map(r => r.id);

    // Get all request items
    const { data: allItems } = await supabase
      .from('purchase_request_items')
      .select('id, request_id, quantity')
      .in('request_id', requestIds);

    // Get ALL invoices for these requests
    const { data: allInvoices } = await supabase
      .from('purchase_invoices')
      .select('id, request_id, status')
      .in('request_id', requestIds);

    // Get invoice items from NON-DRAFT invoices
    const nonDraftInvoiceIds = (allInvoices || [])
      .filter(inv => inv.status !== 'DRAFT')
      .map(inv => inv.id);

    const { data: invoiceItems } = nonDraftInvoiceIds.length > 0 
      ? await supabase
          .from('purchase_invoice_items')
          .select('request_item_id, quantity')
          .in('invoice_id', nonDraftInvoiceIds)
      : { data: [] };

    // Calculate closed quantities
    const invoicedByItem = new Map<string, number>();
    for (const item of invoiceItems || []) {
      if (item.request_item_id) {
        invoicedByItem.set(
          item.request_item_id, 
          (invoicedByItem.get(item.request_item_id) || 0) + Number(item.quantity)
        );
      }
    }

    // Identify requests with DRAFT invoices
    const draftInvoiceRequestIds = new Set(
      (allInvoices || [])
        .filter(inv => inv.status === 'DRAFT')
        .map(inv => inv.request_id)
    );

    // Get creator profiles
    const creatorIds = [...new Set(requestsData.map(r => r.created_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', creatorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Filter and enrich requests
    const enrichedRequests: RequestWithCreator[] = [];
    
    for (const request of requestsData) {
      const hasDraftInvoice = draftInvoiceRequestIds.has(request.id);
      
      const requestItems = (allItems || []).filter(i => i.request_id === request.id);
      let hasRemainingItems = false;
      
      for (const item of requestItems) {
        const invoiced = invoicedByItem.get(item.id) || 0;
        if (Number(item.quantity) > invoiced) {
          hasRemainingItems = true;
          break;
        }
      }

      if (hasDraftInvoice || hasRemainingItems) {
        const profile = profileMap.get(request.created_by);
        enrichedRequests.push({
          ...request,
          creator_name: profile?.name || profile?.email || 'Невідомий',
          creator_email: profile?.email || '',
          has_draft_invoice: hasDraftInvoice,
          has_remaining_items: hasRemainingItems,
        });
      }
    }

    setRequests(enrichedRequests);
  }

  async function loadTreasurerQueue() {
    // Get all TO_PAY invoices, sorted by planned_payment_date (null last)
    const { data: invoicesData, error: invError } = await supabase
      .from('purchase_invoices')
      .select('*')
      .eq('status', 'TO_PAY')
      .order('planned_payment_date', { ascending: true, nullsFirst: false });

    if (invError) throw invError;

    if (!invoicesData || invoicesData.length === 0) {
      setToPayInvoices([]);
      return;
    }

    // Get creator profiles
    const creatorIds = [...new Set(invoicesData.map(i => i.created_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', creatorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Get requester info from linked purchase_requests
    const invoiceRequestIds = [...new Set(invoicesData.filter(i => i.request_id).map(i => i.request_id!))];
    let requestCreatorMap = new Map<string, { name: string; email: string }>();
    
    if (invoiceRequestIds.length > 0) {
      const { data: linkedRequests } = await supabase
        .from('purchase_requests')
        .select('id, created_by')
        .in('id', invoiceRequestIds);
      
      const linkedRequestCreatorIds = [...new Set((linkedRequests || []).map(r => r.created_by))];
      const { data: requesterProfiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', linkedRequestCreatorIds);
      
      const requesterProfileMap = new Map(requesterProfiles?.map(p => [p.id, p]) || []);
      
      for (const req of linkedRequests || []) {
        const profile = requesterProfileMap.get(req.created_by);
        if (profile) {
          requestCreatorMap.set(req.id, { 
            name: profile.name || profile.email || 'Невідомий', 
            email: profile.email || '' 
          });
        }
      }
    }

    // Enrich invoices
    const enrichedInvoices: InvoiceWithCreator[] = invoicesData.map(inv => {
      const profile = profileMap.get(inv.created_by);
      const requester = inv.request_id ? requestCreatorMap.get(inv.request_id) : null;
      return {
        ...inv,
        creator_name: profile?.name || profile?.email || 'Невідомий',
        creator_email: profile?.email || '',
        requester_name: requester?.name || '',
        requester_email: requester?.email || '',
      };
    });

    setToPayInvoices(enrichedInvoices);
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: uk });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ' + currency;
  };

  // Procurement manager - create invoice
  const handleCreateInvoice = async (request: RequestWithCreator) => {
    if (!user?.id) return;
    
    setCreatingInvoiceFor(request.id);
    try {
      const items = await getPurchaseRequestItems(request.id);
      
      const { data: nonDraftInvoices } = await supabase
        .from('purchase_invoices')
        .select('id')
        .eq('request_id', request.id)
        .neq('status', 'DRAFT');

      const nonDraftIds = (nonDraftInvoices || []).map(i => i.id);
      
      const invoicedQuantities = new Map<string, number>();
      if (nonDraftIds.length > 0) {
        const { data: invoiceItems } = await supabase
          .from('purchase_invoice_items')
          .select('request_item_id, quantity')
          .in('invoice_id', nonDraftIds);
        
        for (const item of invoiceItems || []) {
          if (item.request_item_id) {
            invoicedQuantities.set(
              item.request_item_id,
              (invoicedQuantities.get(item.request_item_id) || 0) + Number(item.quantity)
            );
          }
        }
      }
      
      const invoice = await createPurchaseInvoice({
        request_id: request.id,
        currency: request.currency,
        created_by: user.id,
      });

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

      await logPurchaseEvent('INVOICE', invoice.id, 'CREATED');

      toast.success('Рахунок створено');
      navigate(`/purchase/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Помилка при створенні рахунку');
    } finally {
      setCreatingInvoiceFor(null);
    }
  };

  // COO - approve request
  const handleApproveRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({
          status: 'IN_PROGRESS',
          coo_decision: 'APPROVED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      await logPurchaseEvent('REQUEST', requestId, 'APPROVED_BY_COO');
      toast.success('Заявку погоджено');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні заявки');
    } finally {
      setProcessingId(null);
    }
  };

  // COO - reject request
  const handleRejectRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({
          status: 'REJECTED',
          coo_decision: 'REJECTED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
          coo_comment: rejectComment || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      await logPurchaseEvent('REQUEST', requestId, 'REJECTED_BY_COO', rejectComment || undefined);
      toast.success('Заявку відхилено');
      setRejectComment('');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні заявки');
    } finally {
      setProcessingId(null);
    }
  };

  // COO - approve invoice (parallel approval)
  const handleApproveInvoiceCOO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      // Fetch current invoice to check CEO decision
      const { data: invoice, error: fetchError } = await supabase
        .from('purchase_invoices')
        .select('ceo_decision')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;

      // If CEO already approved, set TO_PAY; otherwise keep PENDING_COO
      const newStatus = invoice?.ceo_decision === 'APPROVED' ? 'TO_PAY' : 'PENDING_COO';

      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: newStatus,
          coo_decision: 'APPROVED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'APPROVED_BY_COO');
      toast.success(newStatus === 'TO_PAY' ? 'Рахунок повністю погоджено' : 'Рахунок погоджено COO');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  // COO - reject invoice
  const handleRejectInvoiceCOO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: 'REJECTED',
          coo_decision: 'REJECTED',
          coo_decided_by: user?.id,
          coo_decided_at: new Date().toISOString(),
          coo_comment: rejectComment || null,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'REJECTED_BY_COO', rejectComment || undefined);
      toast.success('Рахунок відхилено');
      setRejectComment('');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  // CEO - approve invoice (parallel approval)
  const handleApproveInvoiceCEO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      // Fetch current invoice to check COO decision
      const { data: invoice, error: fetchError } = await supabase
        .from('purchase_invoices')
        .select('coo_decision')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;

      // If COO already approved, set TO_PAY; otherwise keep PENDING_COO
      const newStatus = invoice?.coo_decision === 'APPROVED' ? 'TO_PAY' : 'PENDING_COO';

      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: newStatus,
          ceo_decision: 'APPROVED',
          ceo_decided_by: user?.id,
          ceo_decided_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'APPROVED_BY_CEO');
      toast.success(newStatus === 'TO_PAY' ? 'Рахунок повністю погоджено' : 'Рахунок погоджено CEO');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при погодженні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  // CEO - reject invoice
  const handleRejectInvoiceCEO = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: 'REJECTED',
          ceo_decision: 'REJECTED',
          ceo_decided_by: user?.id,
          ceo_decided_at: new Date().toISOString(),
          ceo_comment: rejectComment || null,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'REJECTED_BY_CEO', rejectComment || undefined);
      toast.success('Рахунок відхилено');
      setRejectComment('');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при відхиленні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  // Treasurer - mark invoice as paid
  const handleMarkPaid = async (invoiceId: string) => {
    setProcessingId(invoiceId);
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({
          status: 'PAID',
          paid_date: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      await logPurchaseEvent('INVOICE', invoiceId, 'MARKED_PAID');
      toast.success('Рахунок позначено як оплачений');
      await loadQueueData();
    } catch (err) {
      console.error(err);
      toast.error('Помилка при оновленні рахунку');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (request: RequestWithCreator) => {
    if (request.has_draft_invoice && request.has_remaining_items) {
      return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />В роботі</Badge>;
    }
    if (request.has_draft_invoice) {
      return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Чернетка</Badge>;
    }
    return <Badge variant="outline">Очікує</Badge>;
  };

  // Get row class for payment date highlighting
  const getPaymentRowClassName = (invoice: InvoiceWithCreator) => {
    if (!invoice.planned_payment_date) return '';
    
    const paymentDate = startOfDay(new Date(invoice.planned_payment_date));
    const today = startOfDay(new Date());
    
    if (isBefore(paymentDate, today)) {
      // Overdue - red highlighting
      return 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500';
    }
    if (isToday(new Date(invoice.planned_payment_date))) {
      // Due today - amber highlighting
      return 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-500';
    }
    return '';
  };

  const getPageTitle = () => {
    if (profile?.role === 'treasurer' || profile?.role === 'chief_accountant') return 'Рахунки до оплати';
    if (profile?.role === 'coo') return 'Заявки та рахунки на погодження';
    if (profile?.role === 'ceo') return 'Рахунки на погодження';
    return 'Заявки, готові до створення рахунку';
  };

  const renderRejectDialog = (
    id: string, 
    onReject: (id: string) => void, 
    title: string,
    buttonClassName?: string
  ) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" className={buttonClassName} disabled={processingId === id}>
          <X className="h-4 w-4 mr-1" />
          Відхилити
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете відхилити? Вкажіть причину відхилення.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Причина відхилення (необов'язково)"
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setRejectComment('')}>Скасувати</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onReject(id)}
          >
            Відхилити
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Calculate totals for display
  const totalPendingTasks = 
    (isCOO ? pendingApprovalRequests.length + pendingCOOInvoices.length : 0) +
    (isCEO && !isCOO ? pendingCEOInvoices.length : 0) +
    (isCEO && isCOO ? pendingCEOInvoices.length : 0) +
    (isProcurementManager ? requests.length : 0) +
    (isTreasurer ? toPayInvoices.length : 0);

  return (
    <div className="space-y-6">
      <PurchasePageHeader description={getPageTitle()} />

      <PurchaseNavTabs />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-destructive">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* COO: Pending Approval Requests */}
          {isCOO && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Заявки на погодження
                  {pendingApprovalRequests.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingApprovalRequests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingApprovalRequests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає заявок на погодження
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Замовник</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Бажана дата</TableHead>
                        <TableHead>Створено</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovalRequests.map((request) => (
                        <TableRow 
                          key={request.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/purchase/requests/${request.id}`, { state: { from: 'queue' } })}
                        >
                          <TableCell className="font-medium">
                            {request.number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.creator_name}</p>
                              <p className="text-sm text-muted-foreground">{request.creator_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{typeLabels[request.purchase_type]}</TableCell>
                          <TableCell>{formatDate(request.desired_date)}</TableCell>
                          <TableCell>{formatDate(request.created_at)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm"
                                className="min-w-[100px]"
                                onClick={() => handleApproveRequest(request.id)}
                                disabled={processingId === request.id}
                              >
                                {processingId === request.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4 mr-1" />
                                )}
                                Погодити
                              </Button>
                              {renderRejectDialog(request.id, handleRejectRequest, 'Відхилити заявку', 'min-w-[100px]')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* COO: Pending COO Invoices */}
          {isCOO && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Рахунки на погодження (COO)
                  {pendingCOOInvoices.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingCOOInvoices.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingCOOInvoices.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає рахунків на погодження
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Постачальник</TableHead>
                        <TableHead>Сума</TableHead>
                        <TableHead>Умови оплати</TableHead>
                        <TableHead>Замовник</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCOOInvoices.map((invoice) => (
                        <TableRow 
                          key={invoice.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/purchase/invoices/${invoice.id}`, { state: { from: 'queue' } })}
                        >
                          <TableCell className="font-medium">
                            {invoice.number}
                          </TableCell>
                          <TableCell>{invoice.supplier_name}</TableCell>
                          <TableCell>{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                          <TableCell>{paymentTermsLabels[invoice.payment_terms]}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{invoice.requester_name || '—'}</p>
                              {invoice.requester_email && (
                                <p className="text-sm text-muted-foreground">{invoice.requester_email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm"
                                className="min-w-[100px]"
                                onClick={() => handleApproveInvoiceCOO(invoice.id)}
                                disabled={processingId === invoice.id}
                              >
                                {processingId === invoice.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4 mr-1" />
                                )}
                                Погодити
                              </Button>
                              {renderRejectDialog(invoice.id, handleRejectInvoiceCOO, 'Відхилити рахунок', 'min-w-[100px]')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* CEO: Pending CEO Invoices */}
          {isCEO && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Рахунки на погодження (CEO)
                  {pendingCEOInvoices.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingCEOInvoices.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingCEOInvoices.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає рахунків на погодження
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Постачальник</TableHead>
                        <TableHead>Сума</TableHead>
                        <TableHead>Умови оплати</TableHead>
                        <TableHead>Замовник</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCEOInvoices.map((invoice) => (
                        <TableRow 
                          key={invoice.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/purchase/invoices/${invoice.id}`, { state: { from: 'queue' } })}
                        >
                          <TableCell className="font-medium">
                            {invoice.number}
                          </TableCell>
                          <TableCell>{invoice.supplier_name}</TableCell>
                          <TableCell>{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                          <TableCell>{paymentTermsLabels[invoice.payment_terms]}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{invoice.requester_name || '—'}</p>
                              {invoice.requester_email && (
                                <p className="text-sm text-muted-foreground">{invoice.requester_email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm"
                                className="min-w-[100px]"
                                onClick={() => handleApproveInvoiceCEO(invoice.id)}
                                disabled={processingId === invoice.id}
                              >
                                {processingId === invoice.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4 mr-1" />
                                )}
                                Погодити
                              </Button>
                              {renderRejectDialog(invoice.id, handleRejectInvoiceCEO, 'Відхилити рахунок', 'min-w-[100px]')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Procurement Manager: Queue */}
          {isProcurementManager && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Черга на опрацювання
                  {requests.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{requests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає заявок для опрацювання
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Замовник</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Бажана дата</TableHead>
                        <TableHead>Створено</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => (
                        <TableRow 
                          key={request.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/purchase/requests/${request.id}`, { state: { from: 'queue' } })}
                        >
                          <TableCell className="font-medium">
                            {request.number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.creator_name}</p>
                              <p className="text-sm text-muted-foreground">{request.creator_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{typeLabels[request.purchase_type]}</TableCell>
                          <TableCell>{formatDate(request.desired_date)}</TableCell>
                          <TableCell>{formatDate(request.created_at)}</TableCell>
                          <TableCell>{getStatusBadge(request)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {request.has_remaining_items && (
                              <Button
                                size="sm"
                                onClick={() => handleCreateInvoice(request)}
                                disabled={creatingInvoiceFor === request.id}
                              >
                                {creatingInvoiceFor === request.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4 mr-1" />
                                )}
                                Створити рахунок
                              </Button>
                            )}
                            {!request.has_remaining_items && request.has_draft_invoice && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/purchase/requests/${request.id}`)}
                              >
                                Переглянути
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Treasurer: TO_PAY Invoices */}
          {isTreasurer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Рахунки до оплати
                  {toPayInvoices.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{toPayInvoices.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {toPayInvoices.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Немає рахунків до оплати
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Постачальник</TableHead>
                        <TableHead>Сума</TableHead>
                        <TableHead>Дата оплати</TableHead>
                        <TableHead>Замовник</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {toPayInvoices.map((invoice) => (
                        <TableRow 
                          key={invoice.id}
                          className={cn("cursor-pointer", getPaymentRowClassName(invoice) || "hover:bg-muted/50")}
                          onClick={() => navigate(`/purchase/invoices/${invoice.id}`, { state: { from: 'queue' } })}
                        >
                          <TableCell className="font-medium">
                            {invoice.number}
                          </TableCell>
                          <TableCell>{invoice.supplier_name}</TableCell>
                          <TableCell>{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {invoice.planned_payment_date ? (
                                <>
                                  {isBefore(startOfDay(new Date(invoice.planned_payment_date)), startOfDay(new Date())) && (
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  )}
                                  {isToday(new Date(invoice.planned_payment_date)) && (
                                    <span className="text-amber-600 font-medium">Сьогодні</span>
                                  )}
                                  {!isToday(new Date(invoice.planned_payment_date)) && formatDate(invoice.planned_payment_date)}
                                </>
                              ) : (
                                <span className="text-muted-foreground">Не вказано</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{invoice.requester_name || '—'}</p>
                              {invoice.requester_email && (
                                <p className="text-sm text-muted-foreground">{invoice.requester_email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              size="sm"
                              variant="success"
                              onClick={() => handleMarkPaid(invoice.id)}
                              disabled={processingId === invoice.id}
                            >
                              {processingId === invoice.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <CreditCard className="h-4 w-4 mr-1" />
                              )}
                              Оплачено
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
