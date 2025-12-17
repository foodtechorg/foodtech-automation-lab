import { useState } from 'react';
import { Download, Trash2, Loader2, FileText } from 'lucide-react';
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
}

export function AttachmentsList({ 
  attachments, 
  entityType, 
  canDelete = false,
  onDelete 
}: AttachmentsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id);
    try {
      const url = await getSignedUrl(attachment.file_path);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Помилка завантаження файлу');
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

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div 
          key={attachment.id} 
          className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border"
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
