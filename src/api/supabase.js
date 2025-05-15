// src/api/supabase.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with env variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase configuration missing. Check your environment variables.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Guest Signup - Landing Page (Stage 0)
export async function signupLead(email, dob) {
  try {
    const formattedDob = dob instanceof Date ? dob.toISOString().split('T')[0] : dob;
    const { data, error } = await supabase.rpc('signup_lead', {
      p_email: email,
      p_dob: formattedDob
    });
    
    if (error) throw error;
    // RPC returns { success, guest_id, new_signup, message }
    // Your original return structure was fine, ensuring all expected fields are passed.
    return {
      success: data.success, 
      guest_id: data.guest_id, 
      new_signup: data.new_signup, 
      message: data.message 
    };
  } catch (error) {
    console.error('Error signing up lead:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred while signing up.'
    };
  }
}

// Send OTP for phone verification
export async function sendOtp(guestId, phone) {
  try {
    // Client-side formatting is good for consistency before sending to RPC
    const formattedPhone = phone.startsWith('+')
      ? phone
      : phone.startsWith('0')
        ? `+61${phone.substring(1)}`
        : `+61${phone}`; // Assumes Australian numbers if not starting with + or 0
        
    const { data, error } = await supabase.rpc('send_otp', {
      p_guest_id: guestId, 
      p_phone: formattedPhone // Send the client-formatted phone
    });
    
    if (error) throw error;
    // RPC returns { success, otp, expires_at, message }
    return {
      success: data.success,
      otp: data.otp, 
      expires_at: data.expires_at,
      message: data.message 
    };
  } catch (error) {  
    console.error('Error sending OTP:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred while sending OTP.'
    };
  }
}

// Verify OTP and complete voucher claim (Stage 1)
export async function verifyOtp(guestId, otp, fullName) {
  try {
    const { data, error } = await supabase.rpc('verify_otp', {
      p_guest_id: guestId,
      p_otp: otp, // RPC expects text
      p_full_name: fullName
    });
    
    if (error) throw error;
    // RPC returns { success, message, guest_id, full_name, email }
    return { 
      success: data.success,
      email: data.email,          
      guest_id: data.guest_id,    
      full_name: data.full_name,  
      message: data.message       
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { 
      success: false, 
      message: error.message || 'An unexpected error occurred during OTP verification.' 
    };
  }
}

// Confirm visit by bartender
export async function confirmVisit(guestId, expectedVisitNumber) {
  console.log('[supabase.js] Calling confirmVisit RPC with guestId:', guestId, 'expectedVisitNumber:', expectedVisitNumber);

  if (!guestId || typeof guestId !== 'string' || guestId.trim() === '') {
    console.error('[supabase.js] confirmVisit: Invalid guestId provided.');
    return { success: false, message: 'Invalid guest ID provided.' };
  }
  if (typeof expectedVisitNumber !== 'number') {
    console.error('[supabase.js] confirmVisit: Invalid expectedVisitNumber provided.');
    return { success: false, message: 'Invalid expected visit number provided.' };
  }

  try {
    const { data, error } = await supabase.rpc('confirm_visit', {
      p_guest_id: guestId,
      p_expected_visit_number: expectedVisitNumber
    });
    
    if (error) throw error;
    // RPC returns { success, message, email, visit_number, stage, guest_id, full_name }
    return { 
      success: data.success,      
      message: data.message,      
      email: data.email,                 
      stage: data.stage,          
      visit_number: data.visit_number, 
      guest_id: data.guest_id,    
      full_name: data.full_name   
    };
  } catch (error) {
    console.error('[supabase.js] Error in confirmVisit RPC call:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred during visit confirmation.',
      email: null, stage: null, visit_number: null, guest_id: guestId, full_name: null // Keep returning structure
    };
  }
}

// Get funnel statistics for admin dashboard using the RPC
export async function getFunnelStats( /* Potentially add startDate, endDate if implementing time filter here later */ ) {
  try {
    // Call the RPC function that aggregates stats from the funnel_stats_overview view
    const { data, error } = await supabase.rpc('get_funnel_stats_data'); 
    
    if (error) {
        console.error('Error fetching funnel stats via RPC:', error);
        throw error; // Let AdminPage catch and display error
    }
    
    // RPC 'get_funnel_stats_data' should return an array of objects:
    // [{ stage, stage_name, count, conversion_rate (from_previous_stage) }, ...]
    // Ensure the keys match what FunnelStats.jsx expects (e.g., `conversion_rate`).
    // The RPC `get_funnel_stats_data` in your schema.sql already aliases `conversion_from_previous_stage` to `conversion_rate`.
    return data || []; 
  } catch (error) {
    console.error('Error processing funnel stats:', error);
    // Return a default structure on error to prevent AdminPage from crashing
    return [
      { stage: 0, stage_name: 'Leads (Signed Up)', count: 0, conversion_rate: 0 },
      { stage: 1, stage_name: 'Voucher Claimed (Spicy Marg)', count: 0, conversion_rate: 0 },
      { stage: 2, stage_name: '1st Visit (Spicy Marg Redeemed)', count: 0, conversion_rate: 0 },
      { stage: 3, stage_name: '2nd Visit (Icey Marg Redeemed)', count: 0, conversion_rate: 0 },
      { stage: 4, stage_name: '3rd Visit (Funnel Completed)', count: 0, conversion_rate: 0 }
    ];
  }
}

// Get monthly metrics for admin dashboard
export async function getMonthlyMetrics() {
  try {
    const { data, error } = await supabase
      .from('monthly_metrics')
      .select('*') // Selects all columns, including the new ones
      .order('month', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching monthly metrics:', error);
    return [];
  }
}

// Update monthly metrics
export async function updateMonthlyMetrics(metricData) {
  try {
    console.log("Updating/inserting monthly metrics with data:", metricData);
    const { data, error } = await supabase
      .from('monthly_metrics')
      .upsert(metricData, { onConflict: 'month' }); 
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating monthly metrics:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred while updating metrics.'
    };
  }
}

export async function getGuestStatusById(guestId) {
  try {
    const { data, error } = await supabase.rpc('get_guest_status_by_id', {
      p_guest_id: guestId
    });
    if (error) throw error;
    // RPC returns { success, guest: { guestId, fullName, phone, stage, email } }
    return data; 
  } catch (error) {
    console.error('Error fetching guest status by ID:', error);
    return { success: false, message: error.message || 'An unexpected error occurred while fetching guest status.' };
  }
}

// Delete monthly metrics
export async function deleteMonthlyMetrics(month) {
  try {
    console.log("Attempting to delete metrics for month:", month);
    // Check if record exists (optional, delete is idempotent but good for user feedback)
    // const { data: checkData, error: checkError } = await supabase
    //   .from('monthly_metrics')
    //   .select('month')
    //   .eq('month', month)
    //   .maybeSingle(); // Use maybeSingle to not error if not found

    // if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is " بالضبط صف واحد لم يتم إرجاعه بواسطة الاستعلام " / "Exactly one row not returned by query"
    //   throw checkError;
    // }
    // if (!checkData) {
    //   console.warn(`No metrics found for month: ${month} to delete.`);
    //   return { success: false, message: 'No metrics found for the selected month to delete.' };
    // }
    
    const { error } = await supabase
      .from('monthly_metrics')
      .delete()
      .eq('month', month);
    
    if (error) {
      console.error('Supabase delete error for monthly_metrics:', error);
      throw error;
    }
    
    console.log("Metrics deleted successfully for month:", month);
    return { success: true };
  } catch (error) {
    console.error('Error deleting monthly metrics:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred while deleting metrics.'
    };
  }
}