import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token.length);

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.error('Auth error:', authError.message, authError.code);
      throw new Error(`Unauthorized: ${authError.message}`);
    }

    if (!requestingUser) {
      console.error('No user returned from getUser');
      throw new Error('Unauthorized: No user found');
    }

    console.log('Requesting user:', requestingUser.id, requestingUser.email);

    // Check if requesting user is admin
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .single();

    if (!adminRole) {
      throw new Error('Only administrators can change user roles');
    }

    const { userId, newRole } = await req.json();

    if (!userId || !newRole) {
      throw new Error('userId and newRole are required');
    }

    const validRoles = ['admin', 'sales_manager', 'rd_dev', 'rd_manager', 'procurement_manager', 'coo', 'ceo', 'treasurer', 'chief_accountant', 'accountant', 'quality_manager', 'admin_director', 'chief_engineer', 'production_deputy', 'warehouse_manager', 'lawyer', 'office_manager', 'foreign_trade_manager', 'finance_deputy', 'financial_analyst', 'economist'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Prevent admin from changing their own role
    if (userId === requestingUser.id) {
      throw new Error('You cannot change your own role');
    }

    console.log(`Updating role for user ${userId} to ${newRole}`);

    // Update user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (roleError) {
      console.error('Error updating user_roles:', roleError);
      throw new Error(`Failed to update user_roles: ${roleError.message}`);
    }

    // Update profiles table for consistency
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profiles:', profileError);
      throw new Error(`Failed to update profiles: ${profileError.message}`);
    }

    console.log(`Successfully updated role for user ${userId} to ${newRole}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Role updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in update-user-role:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
