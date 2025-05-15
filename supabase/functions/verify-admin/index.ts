// supabase/functions/verify-admin/index.ts

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import bcryptjs from 'https://esm.sh/bcryptjs@2.4.3'; // Import the default export from bcryptjs

console.log("[verify-admin] Function script starting to load/execute...");

const supabaseUrlFromEnv = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKeyFromEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const adminHashedPasswordFromEnv = Deno.env.get('ADMIN_HASHED_PASSWORD');

console.log(`[verify-admin] SUPABASE_URL: ${supabaseUrlFromEnv ? `Loaded (starts with: ${supabaseUrlFromEnv.substring(0, 20)}...)` : 'NOT LOADED - CRITICAL!'}`);
console.log(`[verify-admin] SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKeyFromEnv ? `Loaded (key length: ${supabaseServiceRoleKeyFromEnv.length}, starts with: ${supabaseServiceRoleKeyFromEnv.substring(0, 5)}...)` : 'NOT LOADED - CRITICAL FOR RPC!'}`);
console.log(`[verify-admin] ADMIN_HASHED_PASSWORD: ${adminHashedPasswordFromEnv ? `Loaded (hash starts with: ${adminHashedPasswordFromEnv.substring(0, 10)}...)` : 'NOT LOADED - CRITICAL!'}`);

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  const requestUrl = new URL(req.url);
  console.log(`[verify-admin] Request received: ${req.method} ${requestUrl.pathname}`);

  if (req.method === 'OPTIONS') {
    console.log("[verify-admin] Handling OPTIONS request.");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`[verify-admin] Method not allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log("[verify-admin] Processing POST request...");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminHashedPassword = Deno.env.get('ADMIN_HASHED_PASSWORD');

    if (!supabaseUrl || !supabaseKey || !adminHashedPassword) {
        console.error("[verify-admin] CRITICAL ERROR: Required environment variables missing within handler.");
        return new Response(JSON.stringify({ success: false, message: 'Server configuration error: Secrets missing.' }), 
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log("[verify-admin] All critical environment variables loaded within handler.");

    let accessCode: string | undefined;
    try {
        const body = await req.json();
        accessCode = body.accessCode;
        console.log("[verify-admin] Parsed request body. Access Code received:", accessCode ? "Exists" : "Missing");
    } catch (jsonError) {
        console.error("[verify-admin] Error parsing JSON body:", jsonError.message);
        return new Response(JSON.stringify({ success: false, message: 'Invalid JSON payload.' }), 
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (!accessCode) {
      console.log("[verify-admin] Access code is missing.");
      return new Response(JSON.stringify({ success: false, message: 'Access code is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("[verify-admin] Comparing provided access code with stored hash using bcryptjs.compare...");
    // Use bcryptjs directly as it's the default export containing the methods
    const isMatch = await bcryptjs.compare(accessCode, adminHashedPassword); 
    
    if (!isMatch) {
      console.log("[verify-admin] Password comparison: No match. Invalid access code.");
      return new Response(JSON.stringify({ success: false, message: 'Invalid access code' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("[verify-admin] Password comparison: Match! Access granted. Attempting to log access...");
    
    let supabaseClient: SupabaseClient | null = null;
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
      console.log("[verify-admin] Supabase client initialized for RPC call.");
    } catch(clientError) {
        console.error("[verify-admin] Error initializing Supabase client for RPC:", clientError.message);
    }

    if (supabaseClient) {
        try {
            const { error: rpcError } = await supabaseClient.rpc('log_admin_access');
            if (rpcError) {
                console.error("[verify-admin] Error calling 'log_admin_access' RPC:", rpcError.message);
            } else {
                console.log("[verify-admin] 'log_admin_access' RPC called successfully.");
            }
        } catch (rpcCatchError) {
            console.error("[verify-admin] Exception during 'log_admin_access' RPC call:", rpcCatchError.message);
        }
    } else {
        console.warn("[verify-admin] Supabase client for RPC was not initialized. Skipping log_admin_access.");
    }
    
    console.log("[verify-admin] Returning success response.");
    return new Response(JSON.stringify({ success: true, message: 'Access granted' }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[verify-admin] UNHANDLED ERROR in POST request handler:", error.message, error.stack);
    return new Response(JSON.stringify({ success: false, message: error.message || 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

console.log("[verify-admin] Function script loaded. Deno.serve is configured.");