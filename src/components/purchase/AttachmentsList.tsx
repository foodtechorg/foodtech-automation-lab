import { useState } from 'react';
import { Download, Trash2, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { toast } from 'sonner';
import { 
  deleteAttachment, 
  getSignedUrl, 
  formatFileSize,
  getFileIcon,
  type AttachmentEntityType,
  type Attachment 
} from '@/services/attachmentService';

interface AttachmentsListProps {
  attachments: Attachment[];
  entityType: AttachmentEntityType;
  canDelete?: boolean;
  onDelete?: (attachmentId: string) => void;
  draggable?: boolean;
}

export function AttachmentsList({ 
  attachments, 
  entityType, 
  canDelete = false,
  onDelete,
  draggable = false,
}: AttachmentsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id);
    // Open window immediately to avoid Safari popup blocker
    const newWindow = window.open('about:blank', '_blank');
    
    try {
      const url = await getSignedUrl(attachment.file_path);
      
      // Verify the URL is valid before attempting download
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Файл не знайдено (HTTP ${response.status})`);
      }
      
      if (newWindow) {
        newWindow.location.href = url;
      }
    } catch (error: any) {
      console.error('Download error:', error);
      if (newWindow) {
        newWindow.close();
      }
      const message = error?.message || 'Невідома помилка';
      toast.error(`Помилка завантаження: ${message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    setDeletingId(attachment.id);
    try {
      await deleteAttachment(entityType, attachment.id, attachment.file_path);
      onDelete?.(attachment.id);
      toast.success('Файл видалено');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Помилка видалення файлу');
    } finally {
      setDeletingId(null);
    }
  };

  if (attachments.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Файли відсутні</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, attachment: Attachment) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      file_name: attachment.file_name,
      file_path: attachment.file_path,
      file_type: attachment.file_type,
      file_size: attachment.file_size,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div 
          key={attachment.id} 
          className={cn(
            "flex items-center gap-3 p-3 bg-muted/30 rounded-md border",
            draggable && "cursor-grab active:cursor-grabbing hover:border-primary/50"
          )}
          draggable={draggable}
          onDragStart={draggable ? (e) => handleDragStart(e, attachment) : undefined}
        >
          <span className="text-xl">{getFileIcon(attachment.file_type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{attachment.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(attachment.file_size)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDownload(attachment)}
              disabled={downloadingId === attachment.id}
            >
              {downloadingId === attachment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === attachment.id}
                  >
                    {deletingId === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Видалити файл?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ви впевнені, що хочете видалити файл "{attachment.file_name}"? 
                      Цю дію неможливо скасувати.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Скасувати</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(attachment)}>
                      Видалити
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
