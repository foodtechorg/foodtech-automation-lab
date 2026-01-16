import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Loader2, Package, Send, Trash2, Check, X, Clock, CreditCard, Truck, FileText, Paperclip, Receipt, CalendarIcon } from "lucide-react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getPurchaseInvoiceById, getPurchaseInvoiceItems, updatePurchaseInvoice, updatePurchaseInvoiceItem, deletePurchaseInvoice, logPurchaseEvent, getPurchaseLogs, recalculateInvoiceTotal, getInvoicedQuantitiesByRequestId } from "@/services/invoiceApi";
import { getPurchaseRequestItems, syncRequestStatusFromInvoice } from "@/services/purchaseApi";
import { getAttachments, type Attachment } from "@/services/attachmentService";
import { AttachmentsList } from "@/components/purchase/AttachmentsList";
import { FileUploadZone } from "@/components/purchase/FileUploadZone";
import { SupplierInvoiceUpload } from "@/components/purchase/SupplierInvoiceUpload";
import { supabase } from "@/integrations/supabase/client";
import type { PurchaseInvoice, PurchaseInvoiceItem, PurchaseInvoiceStatus, PaymentTerms, PurchaseLog, PurchaseRequestItem } from "@/types/purchase";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
const statusLabels: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: "Чернетка",
  PENDING_COO: "На погодженні",
  PENDING_CEO: "На погодженні",
  TO_PAY: "До оплати",
  PAID: "Оплачено",
  DELIVERED: "Доставлено",
  REJECTED: "Відхилено"
};
const statusVariants: Record<PurchaseInvoiceStatus, "default" | "secondary" | "destructive" | "outline" | "success"> = {
  DRAFT: "secondary",
  PENDING_COO: "outline",
  PENDING_CEO: "outline",
  TO_PAY: "default",
  PAID: "success",
  DELIVERED: "success",
  REJECTED: "destructive"
};
const paymentTermsLabels: Record<PaymentTerms, string> = {
  PREPAYMENT: "Передоплата",
  POSTPAYMENT: "Постоплата"
};
interface InvoiceItemWithRemaining extends PurchaseInvoiceItem {
  ordered: number;
  previouslyInvoiced: number;
  maxQuantity: number;
}
export default function PurchaseInvoiceDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const {
    profile,
    user
  } = useAuth();

  // Determine back URL based on where user came from
  const backUrl = (location.state as {
    from?: string;
  })?.from === 'queue' ? '/purchase/queue' : '/purchase/invoices';
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [items, setItems] = useState<InvoiceItemWithRemaining[]>([]);
  const [logs, setLogs] = useState<PurchaseLog[]>([]);
  const [creatorName, setCreatorName] = useState<string>("");
  const [requestNumber, setRequestNumber] = useState<string>("");
  const [requesterName, setRequesterName] = useState<string>("");
  const [requesterEmail, setRequesterEmail] = useState<string>("");

  // Attachments state
  const [requestAttachments, setRequestAttachments] = useState<Attachment[]>([]);
  const [invoiceAttachments, setInvoiceAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  // Editable fields for DRAFT
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [description, setDescription] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("PREPAYMENT");
  const [expectedDate, setExpectedDate] = useState<Date | undefined>();
  const [plannedPaymentDate, setPlannedPaymentDate] = useState<Date | undefined>();

  // Role checks
  const isDraft = invoice?.status === "DRAFT";
  const isPendingCOO = invoice?.status === "PENDING_COO";
  const isPendingCEO = invoice?.status === "PENDING_CEO";
  const isToPayStatus = invoice?.status === "TO_PAY";
  const isPaidStatus = invoice?.status === "PAID";
  const isOwner = invoice?.created_by === user?.id;
  const isCOO = profile?.role === "coo" || profile?.role === "admin";
  const isCEO = profile?.role === "ceo" || profile?.role === "admin";
  const isTreasurer = profile?.role === "treasurer" || profile?.role === "chief_accountant" || profile?.role === "accountant" || profile?.role === "admin";
  const isAccountant = profile?.role === "accountant" || profile?.role === "admin";
  const isProcurementManager = profile?.role === "procurement_manager" || profile?.role === "admin";
  const canEdit = isDraft && (isOwner || isProcurementManager);

  // Separate supplier invoice from other attachments
  const supplierInvoiceFile = invoiceAttachments.find(a => a.is_supplier_invoice);
  const otherInvoiceAttachments = invoiceAttachments.filter(a => !a.is_supplier_invoice);
  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const [invoiceData, itemsData, logsData, invoiceAttachmentsData] = await Promise.all([getPurchaseInvoiceById(id), getPurchaseInvoiceItems(id), getPurchaseLogs("INVOICE", id), getAttachments("invoice", id)]);
        if (!invoiceData) {
          setError("Рахунок не знайдено");
          return;
        }
        setInvoice(invoiceData);
        setLogs(logsData);
        setInvoiceAttachments(invoiceAttachmentsData);

        // Set editable fields
        setSupplierName(invoiceData.supplier_name || "");
        setSupplierContact(invoiceData.supplier_contact || "");
        setDescription(invoiceData.description || "");
        setPaymentTerms(invoiceData.payment_terms);
        setExpectedDate(invoiceData.expected_date ? new Date(invoiceData.expected_date) : undefined);
        setPlannedPaymentDate(invoiceData.planned_payment_date ? new Date(invoiceData.planned_payment_date) : undefined);

        // Load request-related data if linked
        if (invoiceData.request_id) {
          const [requestData, requestAttachmentsData, requestItems, invoicedQty] = await Promise.all([supabase.from("purchase_requests").select("number, created_by").eq("id", invoiceData.request_id).single(), getAttachments("request", invoiceData.request_id), getPurchaseRequestItems(invoiceData.request_id), getInvoicedQuantitiesByRequestId(invoiceData.request_id)]);
          if (requestData.data) {
            setRequestNumber(requestData.data.number);

            // Fetch requester profile
            if (requestData.data.created_by) {
              const {
                data: requesterProfile
              } = await supabase.from("profiles").select("name, email").eq("id", requestData.data.created_by).single();
              if (requesterProfile) {
                setRequesterName(requesterProfile.name || "");
                setRequesterEmail(requesterProfile.email);
              }
            }
          }
          setRequestAttachments(requestAttachmentsData);

          // Calculate max quantities for each item
          const itemsWithRemaining: InvoiceItemWithRemaining[] = itemsData.map(item => {
            const requestItem = requestItems.find(ri => ri.id === item.request_item_id);
            const ordered = requestItem?.quantity || item.quantity;
            // Invoiced quantities exclude current invoice's items (they're already in the invoice)
            const totalInvoiced = invoicedQty.get(item.request_item_id || "") || 0;
            // For current invoice, max is: ordered - (totalInvoiced - currentItemQty)
            // Since totalInvoiced doesn't include DRAFT invoices, we add current item back
            const previouslyInvoiced = totalInvoiced;
            const maxQuantity = ordered - previouslyInvoiced + item.quantity;
            return {
              ...item,
              ordered,
              previouslyInvoiced,
              maxQuantity
            };
          });
          setItems(itemsWithRemaining);
        } else {
          setItems(itemsData.map(item => ({
            ...item,
            ordered: item.quantity,
            previouslyInvoiced: 0,
            maxQuantity: item.quantity
          })));
        }

        // Load creator profile
        const {
          data: profileData
        } = await supabase.from("profiles").select("name, email").eq("id", invoiceData.created_by).single();
        if (profileData) {
          setCreatorName(profileData.name || profileData.email);
        }
      } catch (err) {
        console.error(err);
        setError("Не вдалося завантажити дані рахунку");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd.MM.yyyy HH:mm", {
      locale: uk
    });
  };
  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd.MM.yyyy", {
      locale: uk
    });
  };
  const handleSave = useCallback(async () => {
    if (!id || !canEdit) return;
    setIsSaving(true);
    try {
      await updatePurchaseInvoice(id, {
        supplier_name: supplierName,
        supplier_contact: supplierContact || null,
        description: description || null,
        payment_terms: paymentTerms,
        expected_date: expectedDate?.toISOString() || null,
        planned_payment_date: plannedPaymentDate?.toISOString() || null
      });
      setInvoice(prev => prev ? {
        ...prev,
        supplier_name: supplierName,
        supplier_contact: supplierContact || null,
        description: description || null,
        payment_terms: paymentTerms,
        expected_date: expectedDate?.toISOString() || null,
        planned_payment_date: plannedPaymentDate?.toISOString() || null
      } : null);
      toast.success("Зміни збережено");
    } catch (err) {
      console.error(err);
      toast.error("Помилка збереження");
    } finally {
      setIsSaving(false);
    }
  }, [id, canEdit, supplierName, supplierContact, description, paymentTerms, expectedDate, plannedPaymentDate]);
  const handleItemUpdate = async (itemId: string, field: "quantity" | "price", value: number) => {
    if (!canEdit) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Validate quantity against max
    if (field === "quantity" && value > item.maxQuantity) {
      toast.error(`Максимальна кількість: ${item.maxQuantity}`);
      return;
    }
    const newQuantity = field === "quantity" ? value : item.quantity;
    const newPrice = field === "price" ? value : item.price;
    const newAmount = newQuantity * newPrice;
    try {
      await updatePurchaseInvoiceItem(itemId, {
        [field]: value,
        amount: newAmount
      });
      setItems(prev => prev.map(i => i.id === itemId ? {
        ...i,
        [field]: value,
        amount: newAmount
      } : i));

      // Recalculate total
      if (id) {
        const newTotal = await recalculateInvoiceTotal(id);
        setInvoice(prev => prev ? {
          ...prev,
          amount: newTotal
        } : null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Помилка оновлення");
    }
  };
  const handleSubmitForApproval = async () => {
    if (!id) return;

    // Validate
    if (!supplierName.trim()) {
      toast.error("Вкажіть постачальника");
      return;
    }
    const hasValidItems = items.some(i => i.quantity > 0 && i.price > 0);
    if (!hasValidItems) {
      toast.error("Додайте хоча б одну позицію з кількістю та ціною");
      return;
    }
    if (!supplierInvoiceFile) {
      toast.error("Необхідно завантажити рахунок постачальника");
      return;
    }
    setIsSubmitting(true);
    try {
      // Save changes first
      await updatePurchaseInvoice(id, {
        supplier_name: supplierName,
        supplier_contact: supplierContact || null,
        description: description || null,
        payment_terms: paymentTerms,
        expected_date: expectedDate?.toISOString() || null,
        planned_payment_date: plannedPaymentDate?.toISOString() || null,
        status: "PENDING_COO"
      });
      await logPurchaseEvent("INVOICE", id, "SUBMITTED_FOR_APPROVAL");

      // Sync request status to INVOICE_PENDING
      if (invoice?.request_id) {
        await syncRequestStatusFromInvoice(invoice.request_id, "PENDING_COO");
      }
      setInvoice(prev => prev ? {
        ...prev,
        status: "PENDING_COO"
      } : null);
      toast.success("Рахунок відправлено на погодження");
    } catch (err) {
      console.error(err);
      toast.error("Помилка при відправці на погодження");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deletePurchaseInvoice(id);
      toast.success("Рахунок видалено");
      navigate("/purchase/invoices");
    } catch (err) {
      console.error(err);
      toast.error("Помилка при видаленні рахунку");
      setIsDeleting(false);
    }
  };
  const handleCOOApprove = async () => {
    if (!id || !user?.id) return;
    setIsApproving(true);
    try {
      const ceoAlreadyApproved = invoice?.ceo_decision === "APPROVED";
      const newStatus: PurchaseInvoiceStatus = ceoAlreadyApproved ? "TO_PAY" : "PENDING_CEO";
      await updatePurchaseInvoice(id, {
        coo_decision: "APPROVED",
        coo_decided_by: user.id,
        coo_decided_at: new Date().toISOString(),
        status: newStatus
      });
      await logPurchaseEvent("INVOICE", id, "COO_APPROVED");

      // Sync request status if fully approved
      if (newStatus === "TO_PAY" && invoice?.request_id) {
        await syncRequestStatusFromInvoice(invoice.request_id, "TO_PAY");
      }
      setInvoice(prev => prev ? {
        ...prev,
        status: newStatus,
        coo_decision: "APPROVED",
        coo_decided_by: user.id,
        coo_decided_at: new Date().toISOString()
      } : null);
      toast.success(ceoAlreadyApproved ? "Рахунок погоджено, передано до оплати" : "Рахунок погоджено COO");
    } catch (err) {
      console.error(err);
      toast.error("Помилка при погодженні");
    } finally {
      setIsApproving(false);
    }
  };
  const handleCEOApprove = async () => {
    if (!id || !user?.id) return;
    setIsApproving(true);
    try {
      const cooAlreadyApproved = invoice?.coo_decision === "APPROVED";
      const newStatus: PurchaseInvoiceStatus = cooAlreadyApproved ? "TO_PAY" : "PENDING_COO";
      await updatePurchaseInvoice(id, {
        ceo_decision: "APPROVED",
        ceo_decided_by: user.id,
        ceo_decided_at: new Date().toISOString(),
        status: newStatus
      });
      await logPurchaseEvent("INVOICE", id, "CEO_APPROVED");

      // Sync request status if fully approved
      if (newStatus === "TO_PAY" && invoice?.request_id) {
        await syncRequestStatusFromInvoice(invoice.request_id, "TO_PAY");
      }
      setInvoice(prev => prev ? {
        ...prev,
        status: newStatus,
        ceo_decision: "APPROVED",
        ceo_decided_by: user.id,
        ceo_decided_at: new Date().toISOString()
      } : null);
      toast.success(cooAlreadyApproved ? "Рахунок погоджено, передано до оплати" : "Рахунок погоджено CEO");
    } catch (err) {
      console.error(err);
      toast.error("Помилка при погодженні");
    } finally {
      setIsApproving(false);
    }
  };
  const handleReject = async (role: "COO" | "CEO") => {
    if (!id || !user?.id) return;

    // Validate comment is not empty
    if (!rejectComment.trim()) {
      toast.error("Коментар обов'язковий для відхилення");
      return;
    }
    setIsRejecting(true);
    try {
      // Use RPC function for rejection (bypasses RLS issues)
      const {
        data,
        error
      } = await supabase.rpc('reject_purchase_invoice', {
        p_invoice_id: id,
        p_role: role,
        p_comment: rejectComment.trim()
      });
      if (error) {
        console.error('Rejection RPC error:', error);
        toast.error(`Помилка: ${error.message} (${error.code || 'unknown'})`);
        return;
      }

      // Update local state from RPC response
      const updates: Partial<PurchaseInvoice> = {
        status: "DRAFT",
        coo_decision: "PENDING",
        coo_decided_by: null,
        coo_decided_at: null,
        ceo_decision: "PENDING",
        ceo_decided_by: null,
        ceo_decided_at: null,
        coo_comment: role === "COO" ? rejectComment.trim() : null,
        ceo_comment: role === "CEO" ? rejectComment.trim() : null
      };
      setInvoice(prev => prev ? {
        ...prev,
        ...updates
      } : null);
      toast.success("Рахунок відхилено та повернуто на доопрацювання");
      setRejectComment("");
    } catch (err: any) {
      console.error('Rejection error:', err);
      toast.error(`Помилка при відхиленні: ${err?.message || 'невідома помилка'}`);
    } finally {
      setIsRejecting(false);
    }
  };
  const handleMarkPaid = async () => {
    if (!id) return;
    setIsApproving(true);
    try {
      await updatePurchaseInvoice(id, {
        status: "PAID",
        paid_date: new Date().toISOString()
      });
      await logPurchaseEvent("INVOICE", id, "MARKED_PAID");

      // Sync request status to COMPLETED
      if (invoice?.request_id) {
        await syncRequestStatusFromInvoice(invoice.request_id, "PAID");
      }
      setInvoice(prev => prev ? {
        ...prev,
        status: "PAID",
        paid_date: new Date().toISOString()
      } : null);
      toast.success("Рахунок позначено як оплачений");
    } catch (err) {
      console.error(err);
      toast.error("Помилка при оновленні статусу");
    } finally {
      setIsApproving(false);
    }
  };
  const handleMarkDelivered = async () => {
    if (!id) return;
    setIsApproving(true);
    try {
      await updatePurchaseInvoice(id, {
        status: "DELIVERED",
        delivered_date: new Date().toISOString()
      });
      await logPurchaseEvent("INVOICE", id, "MARKED_DELIVERED");
      setInvoice(prev => prev ? {
        ...prev,
        status: "DELIVERED",
        delivered_date: new Date().toISOString()
      } : null);
      toast.success("Товар позначено як доставлений");
    } catch (err) {
      console.error(err);
      toast.error("Помилка при оновленні статусу");
    } finally {
      setIsApproving(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>;
  }
  if (error || !invoice) {
    return <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(backUrl)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Помилка</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error || "Рахунок не знайдено"}</p>
          </CardContent>
        </Card>
      </div>;
  }
  const showCOOApproval = isCOO && (isPendingCOO || isPendingCEO && invoice.coo_decision === "PENDING");
  const showCEOApproval = isCEO && (isPendingCEO || isPendingCOO && invoice.ceo_decision === "PENDING");
  const showTreasurerAction = isTreasurer && isToPayStatus;
  const showAccountantAction = isAccountant && isPaidStatus;
  return <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backUrl)}>
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
        {canEdit && <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Зберегти
            </Button>
            <Button onClick={handleSubmitForApproval} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Відправити на погодження
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
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
          </div>}

        {/* COO Approval */}
        {showCOOApproval && <div className="flex items-center gap-2">
            <Button onClick={handleCOOApprove} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
              {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Погодити
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
                  <AlertDialogDescription>
                    Ви впевнені, що хочете відхилити рахунок {invoice.number}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea placeholder="Причина відхилення" value={rejectComment} onChange={e => setRejectComment(e.target.value)} className="my-2" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleReject("COO")}>Відхилити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>}

        {/* CEO Approval */}
        {showCEOApproval && <div className="flex items-center gap-2">
            <Button onClick={handleCEOApprove} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
              {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Погодити
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
                  <AlertDialogDescription>
                    Ви впевнені, що хочете відхилити рахунок {invoice.number}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea placeholder="Причина відхилення" value={rejectComment} onChange={e => setRejectComment(e.target.value)} className="my-2" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleReject("CEO")}>Відхилити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>}

        {/* Treasurer Action */}
        {showTreasurerAction && <Button onClick={handleMarkPaid} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
            {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Позначити оплаченим
          </Button>}

        {/* Accountant Action */}
        {showAccountantAction && <Button onClick={handleMarkDelivered} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
            {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Позначити доставленим
          </Button>}
      </div>

      {/* Invoice Info - Editable for DRAFT */}
      <Card>
        <CardHeader>
          <CardTitle>Інформація про рахунок</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Постачальник *</Label>
                <Input id="supplierName" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Назва постачальника" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierContact">Контактна особа</Label>
                <Input id="supplierContact" value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Ім'я, телефон" />
              </div>
              <div className="space-y-2">
                <Label>Заявка</Label>
                {requestNumber ? <Button variant="link" className="p-0 h-auto font-medium" onClick={() => navigate(`/purchase/requests/${invoice.request_id}`)}>
                    {requestNumber}
                  </Button> : <p className="text-sm text-muted-foreground">—</p>}
              </div>
              <div className="space-y-2">
                <Label>Умови оплати</Label>
                <Select value={paymentTerms} onValueChange={v => setPaymentTerms(v as PaymentTerms)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PREPAYMENT">Передоплата</SelectItem>
                    <SelectItem value="POSTPAYMENT">Постоплата</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Очікувана дата поставки</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expectedDate ? format(expectedDate, "PPP", {
                    locale: uk
                  }) : "Оберіть дату"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={expectedDate} onSelect={setExpectedDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Очікувана дата оплати</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !plannedPaymentDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {plannedPaymentDate ? format(plannedPaymentDate, "PPP", {
                    locale: uk
                  }) : "Оберіть дату"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={plannedPaymentDate} onSelect={setPlannedPaymentDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="description">Примітки</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Додаткова інформація" rows={3} />
              </div>
            </div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Постачальник</p>
                <p className="font-medium">{invoice.supplier_name || "—"}</p>
                {invoice.supplier_contact && <p className="text-sm text-muted-foreground">{invoice.supplier_contact}</p>}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Заявка</p>
                {requestNumber ? <Button variant="link" className="p-0 h-auto font-medium" onClick={() => navigate(`/purchase/requests/${invoice.request_id}`)}>
                    {requestNumber}
                  </Button> : <p className="font-medium">—</p>}
              </div>
              {requesterEmail && <div>
                  <p className="text-sm text-muted-foreground">Замовник</p>
                  <p className="font-medium">{requesterName || requesterEmail}</p>
                  {requesterName && <p className="text-sm text-muted-foreground">{requesterEmail}</p>}
                </div>}
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
                <p className="text-sm text-muted-foreground">Очікувана дата поставки</p>
                <p className="font-medium">{formatDateShort(invoice.expected_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Очікувана дата оплати</p>
                <p className="font-medium">{formatDateShort(invoice.planned_payment_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Створив</p>
                <p className="font-medium">{creatorName || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Дата створення</p>
                <p className="font-medium">{formatDate(invoice.created_at)}</p>
              </div>
              {invoice.paid_date && <div>
                  <p className="text-sm text-muted-foreground">Дата оплати</p>
                  <p className="font-medium">{formatDateShort(invoice.paid_date)}</p>
                </div>}
              {invoice.delivered_date && <div>
                  <p className="text-sm text-muted-foreground">Дата доставки</p>
                  <p className="font-medium">{formatDateShort(invoice.delivered_date)}</p>
                </div>}
              {invoice.description && <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-sm text-muted-foreground mb-1">Примітки</p>
                  <p className="whitespace-pre-wrap">{invoice.description}</p>
                </div>}
            </div>}
        </CardContent>
      </Card>

      {/* Rejection Comment for DRAFT - show when invoice was returned for revision */}
      {isDraft && (invoice.coo_comment || invoice.ceo_comment) && <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="text-amber-600">Коментар до відхилення</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.coo_comment && <div className="mb-2">
                <p className="text-sm font-medium text-muted-foreground">COO:</p>
                <p className="whitespace-pre-wrap">{invoice.coo_comment}</p>
              </div>}
            {invoice.ceo_comment && <div>
                <p className="text-sm font-medium text-muted-foreground">CEO:</p>
                <p className="whitespace-pre-wrap">{invoice.ceo_comment}</p>
              </div>}
          </CardContent>
        </Card>}

      {/* Approval Status */}
      {!isDraft && (invoice.coo_decision !== "PENDING" || invoice.ceo_decision !== "PENDING") && <Card>
          <CardHeader>
            <CardTitle>Статус погодження</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${invoice.coo_decision === "APPROVED" ? "bg-green-500" : invoice.coo_decision === "REJECTED" ? "bg-red-500" : "bg-yellow-500"}`} />
                <div>
                  <p className="font-medium">COO</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.coo_decision === "APPROVED" ? "Погоджено" : invoice.coo_decision === "REJECTED" ? "Відхилено" : "Очікує"}
                    {invoice.coo_decided_at && ` • ${formatDateShort(invoice.coo_decided_at)}`}
                  </p>
                  {invoice.coo_comment && <p className="text-sm text-muted-foreground mt-1">{invoice.coo_comment}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${invoice.ceo_decision === "APPROVED" ? "bg-green-500" : invoice.ceo_decision === "REJECTED" ? "bg-red-500" : "bg-yellow-500"}`} />
                <div>
                  <p className="font-medium">CEO</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.ceo_decision === "APPROVED" ? "Погоджено" : invoice.ceo_decision === "REJECTED" ? "Відхилено" : "Очікує"}
                    {invoice.ceo_decided_at && ` • ${formatDateShort(invoice.ceo_decided_at)}`}
                  </p>
                  {invoice.ceo_comment && <p className="text-sm text-muted-foreground mt-1">{invoice.ceo_comment}</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>}

      {/* Invoice Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Позиції рахунку
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-center py-4 text-muted-foreground">Позиції відсутні</p> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Найменування</TableHead>
                  <TableHead>Од. виміру</TableHead>
                  {canEdit && <TableHead className="text-right">Замовлено</TableHead>}
                  <TableHead className="text-right">Кількість</TableHead>
                  <TableHead className="text-right">Ціна</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    {canEdit && <TableCell className="text-right text-muted-foreground">{item.ordered}</TableCell>}
                    <TableCell className="text-right">
                      {canEdit ? <Input type="number" min={0} max={item.maxQuantity} step={0.01} value={item.quantity} onChange={e => handleItemUpdate(item.id, "quantity", parseFloat(e.target.value) || 0)} className="w-24 text-right ml-auto" /> : item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit ? <Input type="number" min={0} step={0.01} value={item.price} onChange={e => handleItemUpdate(item.id, "price", parseFloat(e.target.value) || 0)} className="w-24 text-right ml-auto" /> : item.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">{item.amount.toFixed(2)}</TableCell>
                  </TableRow>)}
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} className="text-right font-bold">
                    Всього:
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {invoice.amount.toFixed(2)} {invoice.currency}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>}
        </CardContent>
      </Card>

      {/* Request Documents (read-only) */}
      {requestAttachments.length > 0 && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Документи заявки
            </CardTitle>
            <CardDescription>
              Файли, прикріплені замовником до заявки
              {canEdit && " — перетягніть файл у «Рахунок постачальника»"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttachmentsList attachments={requestAttachments} entityType="request" canDelete={false} draggable={canEdit} />
          </CardContent>
        </Card>}

      {/* Supplier Invoice (highlighted) */}
      <Card className="border-primary border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Рахунок постачальника
            {canEdit && <span className="text-destructive">*</span>}
          </CardTitle>
          <CardDescription>Документ з реквізитами для оплати бухгалтером</CardDescription>
        </CardHeader>
        <CardContent>
          {user?.id && <SupplierInvoiceUpload invoiceId={id!} userId={user.id} supplierInvoiceFile={supplierInvoiceFile || null} canEdit={canEdit} onUpload={attachment => setInvoiceAttachments(prev => [...prev, attachment])} onDelete={attachmentId => setInvoiceAttachments(prev => prev.filter(a => a.id !== attachmentId))} />}
        </CardContent>
      </Card>

      {/* Additional Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Додаткові документи
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit && user?.id && <div className="mb-4">
              <FileUploadZone entityType="invoice" entityId={id!} userId={user.id} onUploadComplete={attachment => setInvoiceAttachments(prev => [...prev, attachment])} />
            </div>}
          <AttachmentsList attachments={otherInvoiceAttachments} entityType="invoice" canDelete={canEdit} onDelete={attachmentId => setInvoiceAttachments(prev => prev.filter(a => a.id !== attachmentId))} />
        </CardContent>
      </Card>

      {/* Activity Log */}
      {logs.length > 0 && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Хронологія подій
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.map(log => <div key={log.id} className="flex items-start gap-3 text-sm">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p>
                      <span className="font-medium">{t.purchaseAction(log.action)}</span> — {log.user_name || log.user_email}
                    </p>
                    {log.comment && <p className="text-muted-foreground">{log.comment}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  </div>
                </div>)}
            </div>
          </CardContent>
        </Card>}
    </div>;
}