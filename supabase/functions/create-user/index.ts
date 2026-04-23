import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Client with caller's JWT to check admin role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    // Check admin role
    const { data: profile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (profile?.role !== "ADMIN") throw new Error("Forbidden: Admin only");

    // Parse body
    const { email, company_name, role, temporary_password } = await req.json();
    if (!email || !company_name || !role || !temporary_password) {
      throw new Error("Missing required fields");
    }
    if (!["CLIENT", "SUPPLIER"].includes(role)) {
      throw new Error("Invalid role");
    }

    // Admin client with service role to create auth user
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: { role, company_name },
    });

    if (createError) throw createError;

    // The trigger auto-creates the profile. Update status to ACTIVE.
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ status: "ACTIVE" })
      .eq("id", newUser.user.id);

    if (updateError) throw updateError;

    // Get the created profile for response
    const { data: createdProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", newUser.user.id)
      .single();

    // Audit log
    await adminClient.from("admin_audit_log").insert({
      admin_id: caller.id,
      action: "CREATE_USER",
      target_user_id: newUser.user.id,
      details: { email, company_name, role },
    });

    return new Response(JSON.stringify({ user: createdProfile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
