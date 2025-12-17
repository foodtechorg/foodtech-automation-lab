import { useCallback, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  validateFile, 
  uploadAttachment, 
  formatFileSize,
  getFileIcon,
  type AttachmentEntityType,
  type Attachment 
} from '@/services/attachmentService';

interface FileUploadZoneProps {
  entityType: AttachmentEntityType;
  entityId: string;
  userId: string;
  onUploadComplete: (attachment: Attachment) => void;
  disabled?: boolean;
}

interface PendingFile {
  file: File;
  progress: number;
  error?: string;
}

export function FileUploadZone({ 
  entityType, 
  entityId, 
  userId, 
  onUploadComplete,
  disabled = false 
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        continue;
      }

      setPendingFiles(prev => [...prev, { file, progress: 0 }]);

      try {
        const attachment = await uploadAttachment(file, entityType, entityId, userId);
        onUploadComplete(attachment);
        setPendingFiles(prev => prev.filter(p => p.file !== file));
        toast.success(`${file.name} завантажено`);
      } catch (error) {
        console.error('Upload error:', error);
        setPendingFiles(prev => 
          prev.map(p => p.file === file ? { ...p, error: 'Помилка завантаження' } : p)
        );
      }
    }
  }, [entityType, entityId, userId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    processFiles(e.dataTransfer.files);
  }, [disabled, processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }, [processFiles]);

  const removePendingFile = (file: File) => {
    setPendingFiles(prev => prev.filter(p => p.file !== file));
  };

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
        `}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-1">
          Перетягніть файли сюди або
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          Виберіть файли
        </Button>
        <input
          id="file-upload-input"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
        />
        <p className="text-xs text-muted-foreground mt-2">
          PDF, DOC, DOCX, XLS, XLSX, JPG, PNG • макс. 5 МБ
        </p>
      </div>

      {/* Pending uploads */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          {pendingFiles.map((pending, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3 p-2 bg-muted/50 rounded-md"
            >
              <span className="text-lg">{getFileIcon(pending.file.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pending.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(pending.file.size)}
                </p>
              </div>
              {pending.error ? (
                <>
                  <span className="text-xs text-destructive">{pending.error}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => removePendingFile(pending.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
