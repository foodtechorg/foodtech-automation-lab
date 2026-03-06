const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const BASE_URL = Deno.env.get('ONE_C_BASE_URL')!;
  const API_KEY = Deno.env.get('ONE_C_API_KEY')!;

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  const headers1c: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    let response: Response;

    switch (action) {
      case 'search-raw-materials': {
        const q = url.searchParams.get('q') || '';
        const limit = url.searchParams.get('limit') || '20';
        if (q.length < 2) {
          return new Response(JSON.stringify({ items: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        response = await fetch(
          `${BASE_URL}/raw-materials/search?q=${encodeURIComponent(q)}&limit=${limit}`,
          { headers: headers1c }
        );
        break;
      }

      case 'get-raw-material': {
        const id = url.searchParams.get('id');
        if (!id) {
          return new Response(JSON.stringify({ error: 'id is required' }), {
            status: 400, headers: corsHeaders,
          });
        }
        response = await fetch(`${BASE_URL}/raw-materials/${id}`, { headers: headers1c });
        break;
      }

      case 'search-contractors': {
        const q = url.searchParams.get('q') || '';
        const limit = url.searchParams.get('limit') || '20';
        if (q.length < 2) {
          return new Response(JSON.stringify({ items: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        response = await fetch(
          `${BASE_URL}/contractors/search?q=${encodeURIComponent(q)}&limit=${limit}`,
          { headers: headers1c }
        );
        break;
      }

      case 'get-contractor': {
        const id = url.searchParams.get('id');
        if (!id) {
          return new Response(JSON.stringify({ error: 'id is required' }), {
            status: 400, headers: corsHeaders,
          });
        }
        response = await fetch(`${BASE_URL}/contractors/${id}`, { headers: headers1c });
        break;
      }

      case 'create-contractor': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST required' }), {
            status: 405, headers: corsHeaders,
          });
        }
        const body = await req.json();
        response = await fetch(`${BASE_URL}/contractors`, {
          method: 'POST',
          headers: headers1c,
          body: JSON.stringify(body),
        });
        break;
      }

      case 'create-supplier-order': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST required' }), {
            status: 405, headers: corsHeaders,
          });
        }
        const body = await req.json();
        response = await fetch(`${BASE_URL}/supplier-orders`, {
          method: 'POST',
          headers: headers1c,
          body: JSON.stringify(body),
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: corsHeaders,
        });
    }

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('proxy-1c error:', err);
    return new Response(JSON.stringify({ error: 'Failed to reach 1C API', details: String(err) }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
