-- Database schema for Spicy Margarita Funnel application

-- Drop dependent views first if they exist and depend on monthly_metrics
DROP VIEW IF EXISTS public.funnel_profitability; -- If this view exists and uses old monthly_metrics
DROP VIEW IF EXISTS public.funnel_stats; -- Recreate this later with Stage 4

-- Drop existing tables if they exist to apply changes (or use ALTER TABLE carefully for data preservation)
DROP TABLE IF EXISTS public.visits;
DROP TABLE IF EXISTS public.phone_otps;
DROP TABLE IF EXISTS public.monthly_metrics; -- Dropping before guests if there were FKs, though not in your original
DROP TABLE IF EXISTS public.guests;


-- Guests table: Stores all customer information
CREATE TABLE public.guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    dob DATE NOT NULL,                  -- Must be 18+
    phone TEXT UNIQUE,
    full_name TEXT,
    stage INTEGER DEFAULT 0,            -- 0=Lead, 1=VoucherClaimed, 2=FirstVisit(SpicyMarg), 3=SecondVisit(IceyMarg), 4=ThirdVisit(FunnelComplete)
    created_at TIMESTAMPTZ DEFAULT now(),
    last_stage_at TIMESTAMPTZ DEFAULT now(), -- Timestamp of the last stage update
    marketing_opt_in BOOLEAN DEFAULT true,
    sms_opt_out BOOLEAN DEFAULT false
);

-- Phone OTP table: For SMS verification
CREATE TABLE public.phone_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
    otp_code CHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Visits table: Records each in-venue visit
CREATE TABLE public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
    visit_number INTEGER NOT NULL,      -- 1 (Spicy Marg), 2 (Icey Marg), or 3 (House Cocktail)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Monthly metrics: For manually entering aggregated data
CREATE TABLE public.monthly_metrics (
    month DATE PRIMARY KEY,             -- e.g., 2025-04-01

    -- Pre-Funnel
    total_ad_impressions NUMERIC DEFAULT 0,
    total_ad_clicks NUMERIC DEFAULT 0,
    stage0_ad_spend NUMERIC DEFAULT 0,

    -- In-Funnel (Counts - these represent transitions/achievements *within* the month)
    new_leads_generated_this_month NUMERIC DEFAULT 0,       -- New signups (Stage 0) this month
    vouchers_claimed_this_month NUMERIC DEFAULT 0,    -- Verified phone for spicy marg (Stage 1) this month
    first_visits_this_month NUMERIC DEFAULT 0,        -- Redeemed spicy marg (Stage 2) this month
    second_visits_this_month NUMERIC DEFAULT 0,       -- Redeemed icey marg (Stage 3) this month
    third_visits_this_month NUMERIC DEFAULT 0,        -- Redeemed house cocktail (Stage 4 - funnel complete) this month

    -- In-Funnel (Costs/Revenue)
    stage1_cogs NUMERIC DEFAULT 0,                    -- COGS for spicy margarita (Visit 1)
    stage1_sms_cost NUMERIC DEFAULT 0,                -- SMS cost (auto-calculated: vouchers_claimed_this_month * 0.1091)
    stage2_cogs NUMERIC DEFAULT 0,                    -- COGS for icey margarita (Visit 2)
    stage3_cogs NUMERIC DEFAULT 0,                    -- COGS for house cocktail (Visit 3)
    total_revenue_from_funnel_this_month NUMERIC DEFAULT 0,

    notes TEXT
);

-- Create function for age validation
CREATE OR REPLACE FUNCTION is_adult(birth_date DATE) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (birth_date + INTERVAL '18 years') <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;


-- Create RPC functions for the frontend to call

-- 1. Sign up a new lead (landing page)
CREATE OR REPLACE FUNCTION public.signup_lead(
    p_email TEXT,
    p_dob DATE
) RETURNS jsonb AS $$ -- Changed to jsonb for consistency
DECLARE
    v_guest_id UUID;
    v_created BOOLEAN;
BEGIN
    IF (p_dob + INTERVAL '18 years') > CURRENT_DATE THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You must be at least 18 years old to sign up',
            'guest_id', null,
            'new_signup', false
        );
    END IF;
    
    INSERT INTO public.guests (email, dob, stage, created_at, last_stage_at)
    VALUES (p_email, p_dob, 0, now(), now())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_guest_id;
    
    v_created := FOUND;
    
    IF NOT v_created THEN
        SELECT id INTO v_guest_id FROM public.guests WHERE email = p_email;
        -- Optionally, update last_stage_at or other fields if re-engaging an existing lead
        -- For now, we just return the existing guest_id
        RETURN jsonb_build_object(
            'success', true, 
            'guest_id', v_guest_id,
            'new_signup', false,
            'message', 'Welcome back! Proceed to the next step.' -- Or a different message
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true, 
        'guest_id', v_guest_id,
        'new_signup', v_created,
        'message', 'Signup successful! Check your email.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Send OTP to phone
CREATE OR REPLACE FUNCTION public.send_otp(
    p_guest_id UUID,
    p_phone TEXT
) RETURNS json AS $$
DECLARE
    v_otp CHAR(6);
    v_expires_at TIMESTAMPTZ;
    v_guest_exists BOOLEAN;
    v_phone_in_use_by_other BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.guests WHERE id = p_guest_id) INTO v_guest_exists;
    IF NOT v_guest_exists THEN
        RETURN json_build_object('success', false, 'message', 'Guest not found');
    END IF;
    
    IF p_phone IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM public.guests WHERE phone = p_phone AND id != p_guest_id) INTO v_phone_in_use_by_other;
        IF v_phone_in_use_by_other THEN
            RETURN json_build_object('success', false, 'message', 'Phone number already in use by another account.');
        END IF;
        UPDATE public.guests SET phone = p_phone WHERE id = p_guest_id;
    END IF;
    
    v_otp := lpad(floor(random() * 1000000)::text, 6, '0');
    v_expires_at := now() + interval '10 minutes';
    
    DELETE FROM public.phone_otps WHERE guest_id = p_guest_id;
    INSERT INTO public.phone_otps (guest_id, otp_code, expires_at)
    VALUES (p_guest_id, v_otp, v_expires_at);
    
    RETURN json_build_object('success', true, 'otp', v_otp, 'expires_at', v_expires_at, 'message', 'OTP sent.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verify OTP and upgrade to stage 1
CREATE OR REPLACE FUNCTION public.verify_otp(
    p_guest_id UUID,
    p_otp TEXT, -- Ensure it's TEXT to match frontend
    p_full_name TEXT
) RETURNS json AS $$
DECLARE
    v_guest_record public.guests%ROWTYPE;
    v_otp_valid BOOLEAN;
BEGIN
    SELECT * INTO v_guest_record FROM public.guests WHERE id = p_guest_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Guest not found');
    END IF;

    -- Ensure p_otp is treated as CHAR(6) if it's passed as TEXT
    SELECT EXISTS (
        SELECT 1 FROM public.phone_otps 
        WHERE guest_id = p_guest_id 
        AND otp_code = p_otp -- Direct comparison
        AND expires_at > now()
    ) INTO v_otp_valid;
    
    IF NOT v_otp_valid THEN
        RETURN json_build_object('success', false, 'message', 'Invalid or expired OTP');
    END IF;
    
    UPDATE public.guests 
    SET full_name = p_full_name, 
        stage = 1, 
        last_stage_at = now(),
        phone = COALESCE(v_guest_record.phone, (SELECT po.otp_code FROM public.phone_otps po WHERE po.guest_id = p_guest_id AND po.otp_code = p_otp LIMIT 1)) -- Bit of a hack if phone wasn't set before
    WHERE id = p_guest_id;
    
    DELETE FROM public.phone_otps WHERE guest_id = p_guest_id AND otp_code = p_otp;
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Phone verified! Your Spicy Margarita voucher is active.',
        'guest_id', p_guest_id,
        'full_name', p_full_name,
        'email', v_guest_record.email -- Return email for Brevo updates
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Confirm visit and advance stage
CREATE OR REPLACE FUNCTION public.confirm_visit(
    p_guest_id UUID,
    p_expected_visit_number INTEGER
) RETURNS json AS $$
DECLARE
    v_guest_record public.guests%ROWTYPE;
    v_actual_next_visit_number INTEGER;
    v_next_stage INTEGER;
BEGIN
    SELECT * INTO v_guest_record FROM public.guests WHERE id = p_guest_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false, 'message', 'Guest not found.',
            'email', null, 'stage', null, 'guest_id', p_guest_id, 'full_name', null, 'visit_number', null
        );
    END IF;

    CASE v_guest_record.stage
        WHEN 1 THEN -- Claimed voucher (Stage 1), expecting Spicy Margarita redemption (Visit 1)
            v_actual_next_visit_number := 1; v_next_stage := 2;
        WHEN 2 THEN -- Redeemed Spicy Marg (Stage 2), expecting Icey Margarita redemption (Visit 2)
            v_actual_next_visit_number := 2; v_next_stage := 3;
        WHEN 3 THEN -- Redeemed Icey Marg (Stage 3), expecting House Cocktail redemption (Visit 3)
            v_actual_next_visit_number := 3; v_next_stage := 4; -- Stage 4 is Funnel Complete
        ELSE
            RETURN json_build_object(
                'success', false, 'message', 'Guest is not at a stage eligible for this visit confirmation. Current stage: ' || v_guest_record.stage,
                'email', v_guest_record.email, 'stage', v_guest_record.stage, 'guest_id', p_guest_id, 'full_name', v_guest_record.full_name, 'visit_number', null
            );
    END CASE;

    IF p_expected_visit_number IS NULL OR v_actual_next_visit_number != p_expected_visit_number THEN
        -- Check if this specific expected visit was ALREADY recorded (e.g. user clicks old link)
        IF EXISTS (SELECT 1 FROM public.visits WHERE guest_id = p_guest_id AND visit_number = p_expected_visit_number) THEN
             RETURN json_build_object(
                'success', false, 'message', 'This specific offer (for visit ' || p_expected_visit_number || ') has already been redeemed.',
                'email', v_guest_record.email, 'stage', v_guest_record.stage, 'guest_id', p_guest_id, 'full_name', v_guest_record.full_name, 'visit_number', p_expected_visit_number
             );
        ELSE -- Link is for a visit number that doesn't match current eligibility
             RETURN json_build_object(
                'success', false, 'message', 'Offer link (for visit ' || p_expected_visit_number || ') does not match current guest progress (eligible for visit ' || v_actual_next_visit_number || ' based on stage ' || v_guest_record.stage || ').',
                'email', v_guest_record.email, 'stage', v_guest_record.stage, 'guest_id', p_guest_id, 'full_name', v_guest_record.full_name, 'visit_number', null
             );
        END IF;
    END IF;

    -- If eligible and expected matches, check if this actual_next_visit_number was ALREADY recorded (double-check, defensive)
    IF EXISTS (SELECT 1 FROM public.visits WHERE guest_id = p_guest_id AND visit_number = v_actual_next_visit_number) THEN
        RETURN json_build_object(
            'success', false, 'message', 'This visit (' || v_actual_next_visit_number || ') has already been recorded.',
            'email', v_guest_record.email, 'stage', v_guest_record.stage, 'visit_number', v_actual_next_visit_number, 'guest_id', p_guest_id, 'full_name', v_guest_record.full_name
        );
    END IF;

    INSERT INTO public.visits (guest_id, visit_number, created_at)
    VALUES (p_guest_id, v_actual_next_visit_number, now());

    UPDATE public.guests
    SET stage = v_next_stage, last_stage_at = now()
    WHERE id = p_guest_id;

    RETURN json_build_object(
        'success', true, 'message', 'Visit ' || v_actual_next_visit_number || ' confirmed!',
        'email', v_guest_record.email, 'visit_number', v_actual_next_visit_number, 'stage', v_next_stage, 
        'guest_id', p_guest_id, 'full_name', v_guest_record.full_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Get Guest Status by ID (for VoucherForm)
CREATE OR REPLACE FUNCTION public.get_guest_status_by_id(p_guest_id UUID)
RETURNS json AS $$
DECLARE
    v_guest_record public.guests%ROWTYPE;
BEGIN
    SELECT * INTO v_guest_record FROM public.guests WHERE id = p_guest_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Guest not found by ID.');
    END IF;

    RETURN json_build_object(
        'success', true,
        'guest', json_build_object(
            'guestId', v_guest_record.id, -- ensure key matches frontend expectations
            'fullName', v_guest_record.full_name,
            'phone', v_guest_record.phone,
            'stage', v_guest_record.stage,
            'email', v_guest_record.email
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Admin stats view for dashboard (including Stage 4)
CREATE OR REPLACE VIEW public.funnel_stats_overview AS
WITH stage_counts AS (
    SELECT 0 AS stage, COUNT(*) AS count FROM public.guests WHERE stage = 0 UNION ALL
    SELECT 1 AS stage, COUNT(*) AS count FROM public.guests WHERE stage = 1 UNION ALL
    SELECT 2 AS stage, COUNT(*) AS count FROM public.guests WHERE stage = 2 UNION ALL
    SELECT 3 AS stage, COUNT(*) AS count FROM public.guests WHERE stage = 3 UNION ALL
    SELECT 4 AS stage, COUNT(*) AS count FROM public.guests WHERE stage = 4 -- Funnel Complete
),
total_initial_leads AS (
    SELECT COALESCE(NULLIF(COUNT(*), 0), 1) AS total_count FROM public.guests -- Avoid division by zero if no guests
),
conversion_rates AS (
    SELECT
        s1.stage,
        s1.count,
        CASE
            WHEN s1.stage = 0 AND (SELECT total_count FROM total_initial_leads) > 0 THEN 100.00 -- All leads start here
            WHEN s1.stage = 0 AND (SELECT total_count FROM total_initial_leads) = 0 THEN 0.00
            WHEN LAG(s1.count) OVER (ORDER BY s1.stage) = 0 THEN 0.00
            ELSE ROUND((s1.count * 100.0 / LAG(s1.count) OVER (ORDER BY s1.stage))::numeric, 2)
        END AS conversion_from_previous_stage,
        ROUND((s1.count * 100.0 / (SELECT total_count FROM total_initial_leads))::numeric, 2) AS conversion_from_total_leads
    FROM stage_counts s1
)
SELECT 
    cr.stage,
    CASE 
        WHEN cr.stage = 0 THEN 'Leads (Signed Up)'
        WHEN cr.stage = 1 THEN 'Voucher Claimed (Spicy Marg)'
        WHEN cr.stage = 2 THEN '1st Visit (Spicy Marg Redeemed)'
        WHEN cr.stage = 3 THEN '2nd Visit (Icey Marg Redeemed)'
        WHEN cr.stage = 4 THEN '3rd Visit (Funnel Completed)'
    END AS stage_name,
    cr.count,
    cr.conversion_from_previous_stage,
    cr.conversion_from_total_leads
FROM conversion_rates cr
ORDER BY cr.stage;

-- RPC to get funnel stats data (can be used by frontend if preferred over client-side calculation)
CREATE OR REPLACE FUNCTION public.get_funnel_stats_data()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(t)
    INTO result
    FROM (
        SELECT 
            stage,
            stage_name,
            count,
            conversion_from_previous_stage as conversion_rate -- simpler key for frontend
        FROM public.funnel_stats_overview
    ) t;
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- Function to log admin access (called by verify-admin Edge Function)
-- You might want an admin_logs table for this.
-- CREATE TABLE IF NOT EXISTS public.admin_access_logs (
--     id BIGSERIAL PRIMARY KEY,
--     accessed_at TIMESTAMPTZ DEFAULT now(),
--     ip_address TEXT -- Can be tricky to get reliably from Edge Function
-- );
-- CREATE OR REPLACE FUNCTION public.log_admin_access()
-- RETURNS VOID AS $$
-- BEGIN
--     INSERT INTO public.admin_access_logs (accessed_at) VALUES (now());
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
-- For simplicity, if you don't have the table, the RPC call in edge func will just do nothing or error silently.


-- Set up row level security (RLS)
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for guests:
-- Allow anonymous users to insert (for signup_lead RPC which is SECURITY DEFINER)
CREATE POLICY "Enable insert for anonymous users via RPC" ON public.guests FOR INSERT TO anon WITH CHECK (true);
-- Allow authenticated users (admin) to read all guest data for dashboard
CREATE POLICY "Enable read access for authenticated admin" ON public.guests FOR SELECT TO authenticated USING (true);
-- Allow service_role full access (Supabase internal)
CREATE POLICY "Enable full access for service_role" ON public.guests TO service_role USING (true) WITH CHECK (true);


-- Policies for phone_otps:
CREATE POLICY "Enable access for anonymous users via RPC" ON public.phone_otps FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable full access for service_role otp" ON public.phone_otps TO service_role USING (true) WITH CHECK (true);


-- Policies for visits:
CREATE POLICY "Enable access for anonymous users via RPC for visits" ON public.visits FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable full access for service_role for visits" ON public.visits TO service_role USING (true) WITH CHECK (true);

-- Policies for monthly_metrics:
-- Allow authenticated users (admin) to manage their own metrics.
CREATE POLICY "Authenticated admin can manage monthly_metrics" ON public.monthly_metrics FOR ALL TO authenticated
    USING (true) -- Allows read
    WITH CHECK (true); -- Allows write (insert, update, delete)
CREATE POLICY "Enable full access for service_role for monthly_metrics" ON public.monthly_metrics TO service_role USING (true) WITH CHECK (true);

-- Grant USAGE on schema public to anon and authenticated if not already there
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant EXECUTE on specific functions to anon role (since they are called from client-side anon key)
GRANT EXECUTE ON FUNCTION public.signup_lead(TEXT, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.send_otp(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_otp(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_visit(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_guest_status_by_id(UUID) TO anon;

-- Grant EXECUTE on functions for authenticated role (admin)
GRANT EXECUTE ON FUNCTION public.get_funnel_stats_data() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.log_admin_access() TO service_role; -- If using this

-- Grant SELECT on views to authenticated role (admin)
GRANT SELECT ON public.funnel_stats_overview TO authenticated;