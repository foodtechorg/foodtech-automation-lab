import { supabase } from '@/integrations/supabase/client';
import type { KBDocument, KBDocumentInsert, KBDocumentUpdate } from '@/types/kb';

export async function fetchKBDocuments(): Promise<KBDocument[]> {
  const { data, error } = await supabase
    .from('kb_documents')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as KBDocument[];
}

export async function fetchKBDocument(id: string): Promise<KBDocument> {
  const { data, error } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as KBDocument;
}

export async function createKBDocument(doc: KBDocumentInsert): Promise<KBDocument> {
  const { data, error } = await supabase
    .from('kb_documents')
    .insert(doc)
    .select()
    .single();

  if (error) throw error;
  return data as KBDocument;
}

export async function updateKBDocument(id: string, updates: KBDocumentUpdate): Promise<KBDocument> {
  const { data, error } = await supabase
    .from('kb_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as KBDocument;
}

export async function deleteKBDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('kb_documents')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function uploadKBFile(
  documentId: string,
  file: File
): Promise<{ bucket: string; path: string; mimeType: string }> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${documentId}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('kb')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  return {
    bucket: 'kb',
    path: filePath,
    mimeType: file.type,
  };
}

export async function deleteKBFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('kb')
    .remove([path]);

  if (error) throw error;
}

export function getKBFileUrl(path: string): string {
  const { data } = supabase.storage
    .from('kb')
    .getPublicUrl(path);
  return data.publicUrl;
}

export async function getKBFileSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('kb')
    .createSignedUrl(path, 3600); // 1 hour

  if (error) throw error;
  return data.signedUrl;
}

export async function triggerKBIngest(documentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('kb-trigger-ingest', {
    body: { document_id: documentId },
  });

  if (error) throw error;
}
