import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportUser {
  email: string;
  name?: string;
  role?: 'admin' | 'sales_manager' | 'rd_dev' | 'rd_manager' | 'procurement_manager' | 'coo' | 'ceo' | 'treasurer' | 'accountant' | 'quality_manager' | 'admin_director' | 'chief_engineer' | 'production_deputy' | 'warehouse_manager';
}

interface ImportRequest {
  users: ImportUser[];
  sendInvites?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { users, sendInvites = true }: ImportRequest = await req.json();
    console.log('Importing users:', users.length, 'Send invites:', sendInvites);

    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new Error('No users provided');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const user of users) {
      try {
        const email = user.email;
        const name = user.name || email.split('@')[0];
        const role = user.role || 'sales_manager';

        console.log(`Processing user: ${email}`);

        // Check if user already exists
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile) {
          console.log(`User ${email} already exists, skipping`);
          results.push({ email, success: false, error: 'User already exists' });
          continue;
        }

        // Create user in auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name }
        });

        if (authError) {
          console.error(`Auth error for ${email}:`, authError);
          results.push({ email, success: false, error: authError.message });
          continue;
        }

        // Update role in user_roles
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .update({ role })
          .eq('user_id', authUser.user.id);

        if (roleError) {
          console.error(`Role error for ${email}:`, roleError);
        }

        // Update profile with name and role
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ role, name })
          .eq('id', authUser.user.id);

        if (profileError) {
          console.error(`Profile error for ${email}:`, profileError);
        }

        // Send invite email if requested
        if (sendInvites) {
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { redirectTo: `${req.headers.get('origin') || 'https://lovable.dev'}/set-password` }
          });

          if (!linkError && linkData) {
            await resend.emails.send({
              from: 'FoodTech R&D <noreply@news.foodtech.org.ua>',
              to: [email],
              subject: 'Запрошення до FoodTech R&D',
              html: `<h2>Вітаємо, ${name}!</h2><p>Вас запрошено до системи FoodTech R&D.</p><p><a href="${linkData.properties.action_link}">Встановити пароль</a></p>`
            });
            console.log(`Invite sent to ${email}`);
          }
        }

        results.push({ email, success: true });
        console.log(`User ${email} imported successfully`);

      } catch (userError: any) {
        console.error(`Error processing user:`, userError);
        results.push({ email: user.email, success: false, error: userError.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Import complete: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      imported: successful,
      failed,
      results 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
