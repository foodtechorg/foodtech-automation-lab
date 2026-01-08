import { supabase } from '@/integrations/supabase/client';

export interface RdAttachment {
  id: string;
  request_id: string;
  event_id?: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

const BUCKET_NAME = 'rd-attachments';

const ALLOWED_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateRdFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Непідтримуваний тип файлу. Дозволені: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, JPG, PNG, GIF, WEBP, ZIP, RAR, 7Z';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Файл занадто великий. Максимальний розмір: 5 МБ';
  }
  return null;
}

export async function uploadRdAttachment(
  file: File,
  requestId: string,
  userId: string,
  eventId?: string
): Promise<RdAttachment> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeFileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
  const filePath = `requests/${requestId}/${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Помилка завантаження файлу: ${uploadError.message}`);
  }

  const insertData: any = {
    request_id: requestId,
    file_name: file.name,
    file_path: filePath,
    file_type: file.type,
    file_size: file.size,
    uploaded_by: userId,
  };
  
  if (eventId) {
    insertData.event_id = eventId;
  }

  const { data, error: dbError } = await supabase
    .from('rd_request_attachments')
    .insert(insertData)
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    console.error('Database insert error:', dbError);
    throw new Error('Помилка збереження інформації про файл');
  }

  return data as RdAttachment;
}

export async function getRdAttachments(requestId: string): Promise<RdAttachment[]> {
  const { data, error } = await supabase
    .from('rd_request_attachments')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching R&D attachments:', error);
    throw error;
  }

  return (data || []) as RdAttachment[];
}

export async function deleteRdAttachment(attachmentId: string, filePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (storageError) {
    console.error('Storage delete error:', storageError);
  }

  const { error: dbError } = await supabase
    .from('rd_request_attachments')
    .delete()
    .eq('id', attachmentId);

  if (dbError) {
    console.error('Database delete error:', dbError);
    throw new Error('Помилка видалення файлу');
  }
}

export async function getRdSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600);

  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error('Помилка доступу до файлу');
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
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦';
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return '📃';
  return '📎';
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
