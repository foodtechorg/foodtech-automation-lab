export type KBCategory = 
  | 'SOP' 
  | 'OrgStructure' 
  | 'Policy' 
  | 'Instructions' 
  | 'BusinessProcess_BPMN' 
  | 'BusinessProcess_Text';

export type KBStatus = 'active' | 'archived';

export type KBIndexStatus = 'not_indexed' | 'pending' | 'indexed' | 'error';

export interface KBDocument {
  id: string;
  title: string;
  category: KBCategory;
  version: string | null;
  status: KBStatus;
  access_level: string;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  raw_text: string | null;
  index_status: KBIndexStatus;
  indexed_at: string | null;
  index_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KBDocumentInsert {
  title: string;
  category: KBCategory;
  version?: string | null;
  status?: KBStatus;
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  raw_text?: string | null;
  created_by: string;
}

export interface KBDocumentUpdate {
  title?: string;
  category?: KBCategory;
  version?: string | null;
  status?: KBStatus;
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  raw_text?: string | null;
  index_status?: KBIndexStatus;
  indexed_at?: string | null;
  index_error?: string | null;
}

export const KB_CATEGORY_LABELS: Record<KBCategory, string> = {
  SOP: 'SOP',
  OrgStructure: 'Оргструктура',
  Policy: 'Політика',
  Instructions: 'Інструкції',
  BusinessProcess_BPMN: 'Бізнес-процес (BPMN)',
  BusinessProcess_Text: 'Бізнес-процес (текст)',
};

export const KB_STATUS_LABELS: Record<KBStatus, string> = {
  active: 'Активний',
  archived: 'В архіві',
};

export const KB_INDEX_STATUS_LABELS: Record<KBIndexStatus, string> = {
  not_indexed: 'Не індексовано',
  pending: 'В обробці',
  indexed: 'Проіндексовано',
  error: 'Помилка',
};
