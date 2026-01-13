import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, Download, Trash2, RefreshCw, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  uploadAttachment, 
  deleteAttachment, 
  getSignedUrl, 
  validateFile, 
  formatFileSize, 
  createSupplierInvoiceFromExistingFile,
  type Attachment 
} from '@/services/attachmentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SupplierInvoiceUploadProps {
  invoiceId: string;
  userId: string;
  supplierInvoiceFile: Attachment | null;
  canEdit: boolean;
  onUpload: (attachment: Attachment) => void;
  onDelete: (attachmentId: string) => void;
}

export function SupplierInvoiceUpload({
  invoiceId,
  userId,
  supplierInvoiceFile,
  canEdit,
  onUpload,
  onDelete,
}: SupplierInvoiceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploading(true);
    try {
      const attachment = await uploadAttachment(file, 'invoice', invoiceId, userId, true);
      onUpload(attachment);
      toast.success('Рахунок постачальника завантажено');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Помилка завантаження файлу');
    } finally {
      setIsUploading(false);
    }
  }, [invoiceId, userId, onUpload]);

  const handleDropFromExisting = useCallback(async (attachmentData: {
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }) => {
    setIsUploading(true);
    try {
      const attachment = await createSupplierInvoiceFromExistingFile(
        invoiceId,
        userId,
        attachmentData
      );
      onUpload(attachment);
      toast.success('Рахунок постачальника додано');
    } catch (error) {
      console.error('Create from existing error:', error);
      toast.error('Помилка додавання файлу');
    } finally {
      setIsUploading(false);
    }
  }, [invoiceId, userId, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    // Check if dropped from existing attachment
    const attachmentJson = e.dataTransfer.getData('application/json');
    if (attachmentJson) {
      try {
        const attachmentData = JSON.parse(attachmentJson);
        if (attachmentData.file_path) {
          handleDropFromExisting(attachmentData);
          return;
        }
      } catch {
        // Not a valid attachment JSON, proceed with file drop
      }
    }
    
    // Regular file drop from computer
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect, handleDropFromExisting]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  }, [handleFileSelect]);

  const handleDownload = async () => {
    if (!supplierInvoiceFile) return;
    setIsDownloading(true);
    // Open window immediately to avoid Safari popup blocker
    const newWindow = window.open('about:blank', '_blank');
    
    try {
      const url = await getSignedUrl(supplierInvoiceFile.file_path);
      if (newWindow) {
        newWindow.location.href = url;
      }
    } catch (error) {
      console.error('Download error:', error);
      if (newWindow) {
        newWindow.close();
      }
      toast.error('Помилка завантаження файлу');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!supplierInvoiceFile) return;
    setIsDeleting(true);
    try {
      await deleteAttachment('invoice', supplierInvoiceFile.id, supplierInvoiceFile.file_path);
      onDelete(supplierInvoiceFile.id);
      toast.success('Рахунок постачальника видалено');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Помилка видалення файлу');
    } finally {
      setIsDeleting(false);
    }
  };

  // Display existing file
  if (supplierInvoiceFile) {
    return (
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium">{supplierInvoiceFile.file_name}</p>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(supplierInvoiceFile.file_size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
          
          {canEdit && (
            <>
              <label>
                <Button variant="outline" size="sm" asChild disabled={isUploading}>
                  <span className="cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileInput}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
              </label>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isDeleting}>
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Видалити файл?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ви впевнені, що хочете видалити рахунок постачальника?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Скасувати</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Видалити</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    );
  }

  // Upload zone when no file exists
  if (!canEdit) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        Рахунок постачальника не завантажено
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200",
        isUploading && "border-primary bg-primary/5",
        isDragOver && "border-primary bg-primary/10 scale-[1.02]",
        !isUploading && !isDragOver && "border-muted-foreground/25 hover:border-primary/50"
      )}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
    >
      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Завантаження...</p>
        </div>
      ) : isDragOver ? (
        <div className="flex flex-col items-center gap-2">
          <GripVertical className="h-8 w-8 text-primary" />
          <p className="text-sm font-medium text-primary">
            Відпустіть, щоб додати як рахунок постачальника
          </p>
        </div>
      ) : (
        <label className="cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Перетягніть файл або натисніть для вибору
            </p>
            <p className="text-xs text-muted-foreground">
              Або перетягніть файл з «Документи заявки» вище
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (до 5 МБ)
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            onChange={handleFileInput}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          />
        </label>
      )}
    </div>
  );
}
