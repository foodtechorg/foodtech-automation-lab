const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  console.log('[proxy-1c] Request received:', req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[proxy-1c] No Bearer token');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // Check if this is a service_role call (bypass getUser)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = authHeader.replace('Bearer ', '');
  const isServiceRole = serviceRoleKey && token === serviceRoleKey;

  if (!isServiceRole) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('[proxy-1c] Verifying user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('[proxy-1c] Auth failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    console.log('[proxy-1c] User verified:', user.email);
  } else {
    console.log('[proxy-1c] Service role bypass - test mode');
  }

  const BASE_URL = Deno.env.get('ONE_C_BASE_URL')!;
  const API_KEY = Deno.env.get('ONE_C_API_KEY')!;

  console.log('[proxy-1c] BASE_URL:', BASE_URL ? `${BASE_URL.substring(0, 30)}...` : 'NOT SET');
  console.log('[proxy-1c] API_KEY:', API_KEY ? 'SET' : 'NOT SET');

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  console.log('[proxy-1c] Action:', action);

  const headers1c: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    let response: Response;
    let targetUrl: string;

    switch (action) {
      case 'search-raw-materials': {
        const q = url.searchParams.get('q') || '';
        const limit = url.searchParams.get('limit') || '20';
        if (q.length < 2) {
          return new Response(JSON.stringify({ items: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        targetUrl = `${BASE_URL}/raw-materials/search?q=${encodeURIComponent(q)}&limit=${limit}`;
        break;
      }

      case 'get-raw-material': {
        const id = url.searchParams.get('id');
        if (!id) {
          return new Response(JSON.stringify({ error: 'id is required' }), {
            status: 400, headers: corsHeaders,
          });
        }
        targetUrl = `${BASE_URL}/raw-materials/${id}`;
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
        targetUrl = `${BASE_URL}/contractors/search?q=${encodeURIComponent(q)}&limit=${limit}`;
        break;
      }

      case 'get-contractor': {
        const id = url.searchParams.get('id');
        if (!id) {
          return new Response(JSON.stringify({ error: 'id is required' }), {
            status: 400, headers: corsHeaders,
          });
        }
        targetUrl = `${BASE_URL}/contractors/${id}`;
        break;
      }

      case 'create-contractor': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST required' }), {
            status: 405, headers: corsHeaders,
          });
        }
        const body = await req.json();
        console.log('[proxy-1c] POST to 1C:', `${BASE_URL}/contractors`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          response = await fetch(`${BASE_URL}/contractors`, {
            method: 'POST',
            headers: headers1c,
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        const data = await response.text();
        console.log('[proxy-1c] 1C response status:', response.status);
        return new Response(data, {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-supplier-order': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST required' }), {
            status: 405, headers: corsHeaders,
          });
        }
        const body = await req.json();
        console.log('[proxy-1c] POST to 1C:', `${BASE_URL}/supplier-orders`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          response = await fetch(`${BASE_URL}/supplier-orders`, {
            method: 'POST',
            headers: headers1c,
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        const data = await response.text();
        console.log('[proxy-1c] 1C response status:', response.status);
        return new Response(data, {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: corsHeaders,
        });
    }

    // GET requests with timeout
    console.log('[proxy-1c] Fetching 1C:', targetUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      response = await fetch(targetUrl, { headers: headers1c, signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      console.error('[proxy-1c] Fetch error:', isAbort ? 'TIMEOUT (10s)' : String(err));
      return new Response(JSON.stringify({ 
        error: isAbort ? '1C API timeout (10s)' : 'Failed to reach 1C API', 
        details: String(err) 
      }), {
        status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    clearTimeout(timeout);

    console.log('[proxy-1c] 1C response status:', response.status);
    const data = await response.text();
    console.log('[proxy-1c] 1C response length:', data.length);
    
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[proxy-1c] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Failed to reach 1C API', details: String(err) }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
