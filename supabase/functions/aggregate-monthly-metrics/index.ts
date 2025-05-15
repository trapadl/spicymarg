// supabase/functions/aggregate-monthly-metrics/index.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

console.log("[aggregate-monthly-metrics] Function script starting.");

// Environment variables for the Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific origin if needed
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MonthlyCounts {
  new_leads_generated_this_month: number;
  vouchers_claimed_this_month: number; // Users who reached stage 1 THIS month
  first_visits_this_month: number;
  second_visits_this_month: number;
  third_visits_this_month: number;
}

Deno.serve(async (req: Request) => {
  console.log(`[aggregate-monthly-metrics] Request received: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Secure this function: only allow calls from a trusted source (e.g., cron job, specific auth)
  // For simplicity here, we'll assume it's callable, but in production, add auth.
  // const authHeader = req.headers.get('Authorization');
  // if (authHeader !== `Bearer ${Deno.env.get('CRON_JOB_SECRET')}`) {
  //   return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  // }


  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[aggregate-monthly-metrics] Missing Supabase URL or Service Role Key in environment variables.");
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), { status: 500 });
  }

  const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);

  let targetDateInput: string | null = null;
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      targetDateInput = body.targetDate; // Expects YYYY-MM-DD format for start of month
    } catch (e) {
      console.warn("[aggregate-monthly-metrics] Could not parse POST body for targetDate, will use previous month.");
    }
  }
  
  let forMonthStart: Date;
  if (targetDateInput && /^\d{4}-\d{2}-\d{2}$/.test(targetDateInput)) {
    forMonthStart = new Date(targetDateInput + "T00:00:00.000Z"); // Treat as UTC start of day
  } else {
    // Default to the start of the previous month
    const today = new Date();
    forMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  }

  const forMonthEnd = new Date(Date.UTC(forMonthStart.getUTCFullYear(), forMonthStart.getUTCMonth() + 1, 1));
  const monthKey = forMonthStart.toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`[aggregate-monthly-metrics] Aggregating metrics for month starting: ${monthKey}`);

  try {
    const counts: MonthlyCounts = {
      new_leads_generated_this_month: 0,
      vouchers_claimed_this_month: 0,
      first_visits_this_month: 0,
      second_visits_this_month: 0,
      third_visits_this_month: 0,
    };

    // 1. New Leads Generated This Month
    const { count: newLeadsCount, error: newLeadsError } = await supabaseAdminClient
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', forMonthStart.toISOString())
      .lt('created_at', forMonthEnd.toISOString());
    if (newLeadsError) throw new Error(`Error fetching new leads: ${newLeadsError.message}`);
    counts.new_leads_generated_this_month = newLeadsCount || 0;
    console.log(`New leads for ${monthKey}: ${counts.new_leads_generated_this_month}`);


    // 2. Vouchers Claimed This Month (Guest reached Stage 1 this month)
    // This is the trickiest. We need to identify when they *first* hit stage 1.
    // Assuming 'last_stage_at' is updated upon each stage progression AND 'stage' reflects current stage.
    // We look for guests whose last_stage_at falls in the month AND their current stage is >= 1
    // AND whose previous stage (if recorded or inferred) was 0.
    // A simpler proxy, if your Brevo/DB logic is solid: guests who entered stage 1, and their last_stage_at for that entry is in the month.
    // For now, a simplified approach: guests whose `last_stage_at` is in the month AND whose current stage is 1 (or >1 if they progressed fast)
    // AND whose `created_at` was before or during this month (to avoid counting future leads).
    // This still isn't perfect for "transitioned to stage 1 THIS month".
    // A more robust way would be to have an event log or a specific "voucher_claimed_at" timestamp.
    // Let's use last_stage_at for stage 1 for now, assuming it marks the transition time to stage 1.
    const { count: vouchersClaimedCount, error: vouchersClaimedError } = await supabaseAdminClient
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 1) // Or .gte('stage', 1) depending on how you want to count if they progressed past stage 1 in same month
      .gte('last_stage_at', forMonthStart.toISOString()) // And this last_stage_at corresponds to reaching stage 1
      .lt('last_stage_at', forMonthEnd.toISOString());
    if (vouchersClaimedError) throw new Error(`Error fetching vouchers claimed: ${vouchersClaimedError.message}`);
    counts.vouchers_claimed_this_month = vouchersClaimedCount || 0;
    console.log(`Vouchers claimed for ${monthKey}: ${counts.vouchers_claimed_this_month}`);


    // 3. Visits This Month
    const visitTypes = [
      { number: 1, key: 'first_visits_this_month' as keyof MonthlyCounts },
      { number: 2, key: 'second_visits_this_month' as keyof MonthlyCounts },
      { number: 3, key: 'third_visits_this_month' as keyof MonthlyCounts },
    ];

    for (const visitType of visitTypes) {
      const { count: visitCount, error: visitError } = await supabaseAdminClient
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('visit_number', visitType.number)
        .gte('created_at', forMonthStart.toISOString())
        .lt('created_at', forMonthEnd.toISOString());
      if (visitError) throw new Error(`Error fetching visit number ${visitType.number}: ${visitError.message}`);
      counts[visitType.key] = visitCount || 0;
      console.log(`${visitType.key} for ${monthKey}: ${counts[visitType.key]}`);
    }

    // Prepare data for upsert (only update count fields and calculated SMS cost)
    const calculatedSmsCost = (counts.vouchers_claimed_this_month || 0) * 0.1091;
    const dataToUpsert = {
      month: monthKey,
      new_leads_generated_this_month: counts.new_leads_generated_this_month,
      vouchers_claimed_this_month: counts.vouchers_claimed_this_month,
      first_visits_this_month: counts.first_visits_this_month,
      second_visits_this_month: counts.second_visits_this_month,
      third_visits_this_month: counts.third_visits_this_month,
      stage1_sms_cost: parseFloat(calculatedSmsCost.toFixed(2)), // Ensure it's a number
      // IMPORTANT: We are NOT updating ad_spend, COGS, revenue here. Those remain manual.
    };

    console.log(`[aggregate-monthly-metrics] Upserting data for ${monthKey}:`, dataToUpsert);
    const { error: upsertError } = await supabaseAdminClient
      .from('monthly_metrics')
      .upsert(dataToUpsert, { onConflict: 'month' });

    if (upsertError) {
      console.error("[aggregate-monthly-metrics] Error upserting monthly metrics:", upsertError.message);
      throw new Error(`Error upserting monthly metrics: ${upsertError.message}`);
    }

    console.log(`[aggregate-monthly-metrics] Successfully aggregated and saved metrics for ${monthKey}.`);
    return new Response(JSON.stringify({ success: true, message: `Metrics aggregated for ${monthKey}`, aggregatedData: dataToUpsert }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[aggregate-monthly-metrics] Error in handler:", error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

console.log("[aggregate-monthly-metrics] Function script loaded.");