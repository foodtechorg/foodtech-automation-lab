import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError) throw userError;

    // Use the project's production URL for password reset redirect
    const siteUrl = 'https://foody-forge-cloud.lovable.app';
    
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
      options: { redirectTo: `${siteUrl}/set-password` }
    });

    if (linkError) throw linkError;

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    await resend.emails.send({
      from: 'FoodTech R&D <noreply@news.foodtech.org.ua>',
      to: [userData.user.email!],
      subject: 'Скидання паролю FoodTech R&D',
      html: `<p>Для встановлення нового паролю перейдіть за посиланням:</p><p><a href="${linkData.properties.action_link}">Встановити пароль</a></p>`
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
