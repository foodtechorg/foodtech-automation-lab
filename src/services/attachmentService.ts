import { supabase } from '@/integrations/supabase/client';

export interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export type AttachmentEntityType = 'request' | 'invoice';

const BUCKET_NAME = 'purchase-attachments';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Непідтримуваний тип файлу. Дозволені: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Файл занадто великий. Максимальний розмір: 5 МБ';
  }
  return null;
}

export async function uploadAttachment(
  file: File,
  entityType: AttachmentEntityType,
  entityId: string,
  userId: string
): Promise<Attachment> {
  // Generate safe file path using UUID to avoid encoding issues with non-ASCII filenames
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeFileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${entityType}s/${entityId}/${safeFileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Помилка завантаження файлу: ${uploadError.message}`);
  }

  // Save metadata to the appropriate table
  const tableName = entityType === 'request' 
    ? 'purchase_request_attachments' 
    : 'purchase_invoice_attachments';
  
  const idColumn = entityType === 'request' ? 'request_id' : 'invoice_id';

  const { data, error: dbError } = await (supabase as any)
    .from(tableName)
    .insert({
      [idColumn]: entityId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (dbError) {
    // Try to clean up uploaded file
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    console.error('Database insert error:', dbError);
    throw new Error('Помилка збереження інформації про файл');
  }

  return data as Attachment;
}

export async function getAttachments(
  entityType: AttachmentEntityType,
  entityId: string
): Promise<Attachment[]> {
  const tableName = entityType === 'request' 
    ? 'purchase_request_attachments' 
    : 'purchase_invoice_attachments';
  
  const idColumn = entityType === 'request' ? 'request_id' : 'invoice_id';

  const { data, error } = await (supabase as any)
    .from(tableName)
    .select('*')
    .eq(idColumn, entityId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching attachments:', error);
    throw error;
  }

  return (data || []) as Attachment[];
}

export async function deleteAttachment(
  entityType: AttachmentEntityType,
  attachmentId: string,
  filePath: string
): Promise<void> {
  const tableName = entityType === 'request' 
    ? 'purchase_request_attachments' 
    : 'purchase_invoice_attachments';

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (storageError) {
    console.error('Storage delete error:', storageError);
  }

  // Delete metadata from database
  const { error: dbError } = await (supabase as any)
    .from(tableName)
    .delete()
    .eq('id', attachmentId);

  if (dbError) {
    console.error('Database delete error:', dbError);
    throw new Error('Помилка видалення файлу');
  }
}

export function getFileDownloadUrl(filePath: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    throw error;
  }

  return data.signedUrl;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.startsWith('image/')) return '🖼️';
  return '📎';
}
