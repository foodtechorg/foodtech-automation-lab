import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  name: string;
  role: 'admin' | 'sales_manager' | 'rd_dev' | 'rd_manager' | 'procurement_manager' | 'coo' | 'ceo' | 'treasurer' | 'accountant' | 'quality_manager' | 'admin_director' | 'chief_engineer' | 'production_deputy' | 'warehouse_manager';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, role }: CreateUserRequest = await req.json();
    console.log('Creating user:', { email, name, role });

    if (!email || !name || !role) {
      throw new Error('Missing required fields: email, name or role');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) throw authError;

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({ role })
      .eq('user_id', authUser.user.id);

    if (roleError) console.error('Role update error:', roleError);

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role, name })
      .eq('id', authUser.user.id);

    if (profileError) console.error('Profile update error:', profileError);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: 'https://staging.rd.foodtech.org.ua/set-password' }
    });

    if (linkError) throw linkError;

    await resend.emails.send({
      from: 'FoodTech R&D <noreply@news.foodtech.org.ua>',
      to: [email],
      subject: 'Запрошення до FoodTech R&D',
      html: `<h2>Вітаємо, ${name}!</h2><p>Вас запрошено до системи FoodTech R&D.</p><p><a href="${linkData.properties.action_link}">Встановити пароль</a></p>`
    });

    return new Response(JSON.stringify({ success: true, userId: authUser.user.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
