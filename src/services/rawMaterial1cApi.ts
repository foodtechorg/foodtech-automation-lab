import { supabase } from '@/integrations/supabase/client';
import type { RawMaterial1cCache, Supplier1cCache } from '@/types/rawMaterial';

// ─── Raw Materials (via 1C API) ──────────────────────

export async function search1cRawMaterials(query: string, limit = 20): Promise<RawMaterial1cCache[]> {
  if (query.trim().length < 2) return [];

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=search-raw-materials&q=${encodeURIComponent(query)}&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('search1cRawMaterials error:', res.status, errText);
    if (res.status === 401) {
      throw new Error('Помилка авторизації 1С (401). Перевірте налаштування API ключа.');
    }
    throw new Error(`Помилка 1С API: ${res.status}`);
  }

  const json = await res.json();
  const items: any[] = Array.isArray(json) ? json : json.items ? json.items : [json];

  return items.map((item) => ({
    raw_material_1c_id: item.id || item.code || item.Ref_Key || '',
    name: item.name || item.Description || '',
    default_uom: item.defaultUom || item.unit || 'кг',
    is_active: true,
    synced_at: new Date().toISOString(),
  }));
}

export async function get1cRawMaterial(id: string): Promise<RawMaterial1cCache | null> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=get-raw-material&id=${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('get1cRawMaterial error:', errText);
    return null;
  }

  const item = await res.json();
  return {
    raw_material_1c_id: item.id,
    name: item.name,
    default_uom: item.defaultUom || 'кг',
    is_active: true,
    synced_at: new Date().toISOString(),
  };
}

// ─── Contractors (via 1C API) ────────────────────────

const FRONT_CONTRACTOR_LIMIT = 7;

function pickFirst<T = any>(obj: any, keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function mapContractor(item: any): Supplier1cCache {
  const id = pickFirst<string>(item, ['id', 'code', 'Ref_Key', 'ref_key', 'Code']) || '';
  const name = pickFirst<string>(item, ['name', 'Description', 'description']) || '';
  const taxId = pickFirst<string>(item, ['taxId', 'tax_id', 'EDRPOU', 'edrpou', 'Edrpou', 'INN', 'inn']) || null;

  const rawAccounts =
    pickFirst<any[]>(item, ['bankAccounts', 'bank_accounts', 'BankAccounts', 'accounts', 'Accounts']) || undefined;

  const bank_accounts = Array.isArray(rawAccounts)
    ? rawAccounts.map((a: any) => ({
        account_number:
          pickFirst<string>(a, ['accountNumber', 'account_number', 'AccountNumber', 'iban', 'IBAN', 'number']) || '',
        bank_name: pickFirst<string>(a, ['bankName', 'bank_name', 'BankName', 'bank']) || null,
        mfo: pickFirst<string>(a, ['mfo', 'MFO', 'bik', 'BIK']) || null,
        currency: pickFirst<string>(a, ['currency', 'Currency', 'currencyCode']) || null,
        is_default: Boolean(pickFirst(a, ['isDefault', 'is_default', 'IsDefault', 'default'])),
      }))
    : undefined;

  return {
    supplier_1c_id: id,
    name,
    tax_id: taxId,
    is_active: true,
    synced_at: new Date().toISOString(),
    ...(bank_accounts ? { bank_accounts } : {}),
  };
}

export async function search1cContractors(query: string, limit = FRONT_CONTRACTOR_LIMIT): Promise<Supplier1cCache[]> {
  if (query.trim().length < 2) return [];

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=search-contractors&q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('search1cContractors error:', res.status, errText);
    if (res.status === 401) {
      throw new Error('Помилка авторизації 1С (401). Перевірте налаштування API ключа.');
    }
    throw new Error(`Помилка 1С API: ${res.status}`);
  }

  const json = await res.json();
  const items: any[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.items)
      ? json.items
      : json && typeof json === 'object'
        ? [json]
        : [];

  // Hard-cap on the frontend (1C ignores limit)
  return items.slice(0, Math.min(limit, FRONT_CONTRACTOR_LIMIT)).map(mapContractor);
}

export async function get1cContractor(id: string): Promise<Supplier1cCache | null> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=get-contractor&id=${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('get1cContractor error:', errText);
    return null;
  }

  const json = await res.json();
  // Card may come as a single object, an array of one, or wrapped in { items: [...] }
  const item = Array.isArray(json)
    ? json[0]
    : Array.isArray(json?.items)
      ? json.items[0]
      : json;

  if (!item) return null;
  return mapContractor(item);
}
