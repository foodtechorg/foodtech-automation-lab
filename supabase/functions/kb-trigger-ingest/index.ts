import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get env variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const n8nWebhookUrl = Deno.env.get('N8N_KB_INGEST_WEBHOOK_URL');
    const n8nSharedSecret = Deno.env.get('N8N_SHARED_SECRET');

    // Check if n8n is configured
    if (!n8nWebhookUrl || !n8nSharedSecret) {
      console.log('N8N webhook not configured');
      return new Response(
        JSON.stringify({ 
          error: 'N8N webhook не налаштовано. Додайте N8N_KB_INGEST_WEBHOOK_URL та N8N_SHARED_SECRET в секрети.' 
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Необхідна авторизація' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT to check permissions
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Невалідний токен авторизації' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has COO or admin role using service client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Roles check error:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Помилка перевірки ролей' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userRoles = roles?.map(r => r.role) || [];
    const hasAccess = userRoles.includes('coo') || userRoles.includes('admin');

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Недостатньо прав. Доступ тільки для COO та Admin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'document_id є обов\'язковим' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ingest request for document: ${document_id}`);

    // Update document status to pending
    const { error: updateError } = await supabaseAdmin
      .from('kb_documents')
      .update({ 
        index_status: 'pending', 
        index_error: null 
      })
      .eq('id', document_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Не вдалося оновити статус документа' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call n8n webhook
    console.log(`Calling n8n webhook: ${n8nWebhookUrl}`);
    
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': n8nSharedSecret,
      },
      body: JSON.stringify({ document_id }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error(`N8N webhook error: ${n8nResponse.status} - ${errorText}`);
      
      // Update document status to error
      await supabaseAdmin
        .from('kb_documents')
        .update({ 
          index_status: 'error', 
          index_error: `N8N webhook error: ${n8nResponse.status}` 
        })
        .eq('id', document_id);

      return new Response(
        JSON.stringify({ error: `N8N webhook помилка: ${n8nResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully triggered ingest for document: ${document_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Документ відправлено на індексацію',
        document_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Внутрішня помилка сервера' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
