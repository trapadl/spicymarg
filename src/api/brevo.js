// src/api/brevo.js

// Constants for templates (ensure these match your Brevo Template IDs)
export const EmailTemplates = {
  SIGNUP_VOUCHER: 1,       // Initial free margarita voucher (uses params)
  FIRST_VISIT_THANKS: 2,   // Thank you + Icey Margarita coupon (will use contact attributes)
  SECOND_VISIT_THANKS: 3,  // Thank you + Free cocktail coupon (will use contact attributes)
  FINAL_THANKS: 4          // Final thank you after completion (uses params)
};

// Get API key from environment
const BREVO_API_KEY = process.env.REACT_APP_BREVO_API_KEY || import.meta.env?.VITE_BREVO_API_KEY;

if (!BREVO_API_KEY) {
  console.warn('Brevo API key missing. Check your environment variables.');
}

const API_BASE_URL = 'https://api.brevo.com/v3';
// const APP_BASE_URL = window.location.origin; // Not strictly needed here if paths are relative

// Request headers
const getHeaders = () => {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'api-key': BREVO_API_KEY
  };
};

// Create or update contact in Brevo
export async function updateContact(email, attributes, listIds = []) {
  try {
    console.log('[Brevo API] Updating contact:', email, 'Attributes:', JSON.stringify(attributes), 'List IDs:', listIds);
    
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        email,
        attributes,
        listIds,
        updateEnabled: true
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Brevo API] Failed to update contact. Status:', response.status, 'Response:', errorData);
      throw new Error(errorData.message || 'Failed to update contact');
    }
    
    console.log('[Brevo API] Contact updated successfully for:', email);
    return { success: true };
  } catch (error) {
    console.error('[Brevo API] Error updating contact:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred while updating contact'
    };
  }
}

export async function sendTransactionalEmail(templateId, recipient, params = {}) {
  try {
    console.log('[Brevo API] Sending transactional email. Template ID:', templateId, 'Recipient:', recipient.email, 'Params:', JSON.stringify(params));
    
    const response = await fetch(`${API_BASE_URL}/smtp/email`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        templateId: parseInt(templateId),
        to: [{ 
          email: recipient.email, 
          name: recipient.name || recipient.email
        }],
        params,
        headers: {
          'X-Mailin-custom': 'trap-margarita-funnel'
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Brevo API] Failed to send transactional email. Status:', response.status, 'Response:', errorData);
      throw new Error(errorData.message || 'Failed to send email');
    }
    
    const data = await response.json();
    console.log('[Brevo API] Transactional email sent successfully. Message ID:', data.messageId);
    return { 
      success: true,
      messageId: data.messageId 
    };
  } catch (error) {
    console.error('[Brevo API] Error sending transactional email:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred while sending email'
    };
  }
}

export async function sendSms(phoneNumber, message, senderName = 'Trap') {
  try {
    let cleaned = phoneNumber.replace(/\s+|\(|\)|\-/g, '');
    let formattedPhone;
    if (cleaned.startsWith('+61')) { formattedPhone = cleaned; }
    else if (cleaned.startsWith('04')) { formattedPhone = `+614${cleaned.substring(2)}`; }
    else if (cleaned.startsWith('0')) { formattedPhone = `+61${cleaned.substring(1)}`; }
    else if (/^\d+$/.test(cleaned)) { formattedPhone = `+61${cleaned}`; }
    else if (cleaned.startsWith('+')) { formattedPhone = cleaned; }
    else { formattedPhone = `+61${cleaned}`; }
    
    console.log(`[Brevo API] Sending SMS to ${formattedPhone}: "${message}"`);
    
    const response = await fetch(`${API_BASE_URL}/transactionalSMS/send`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        sender: senderName,
        recipient: formattedPhone,
        content: message,
        type: "marketing", 
        unicodeEnabled: true
      })
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Brevo API] Failed to send SMS. Status:', response.status, 'Response:', errorData);
      throw new Error(errorData.message || 'Failed to send SMS');
    }
    
    const data = await response.json();
    console.log('[Brevo API] SMS sent successfully. Message ID:', data.messageId);
    return { 
      success: true,
      messageId: data.messageId 
    };
  } catch (error) {
    console.error('[Brevo API] Error sending SMS:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred while sending SMS'
    };
  }
}

export async function sendOtpSms(phone, otp) {
  const message = `boom. $200 please, my bank pin number is.....i mean....your trap. verification code is: ${otp}. Valid for 10 minutes only. Reply STOP to opt out.`;
  return sendSms(phone, message);
}

export async function updateContactStage(email, stage, guestInfo, lastStageDate = new Date()) {
  if (!guestInfo || !guestInfo.guestId || !guestInfo.fullName) {
    console.error('[Brevo API] updateContactStage: guestInfo with guestId and fullName is required. Aborting attribute update.');
    return { success: false, message: 'Missing guestId or fullName for Brevo attribute update.' };
  }

  const formattedDate = lastStageDate.toISOString();
  
  const attributes = {
    STAGE: stage, 
    LAST_STAGE_UPDATE: formattedDate, 
    GUEST_ID: guestInfo.guestId, 
    FULL_NAME: guestInfo.fullName, 
    FIRST_NAME: guestInfo.fullName.split(' ')[0] 
  };
  
  if (stage === 2 || stage === 3) {
    const visitTypeForLink = stage === 2 ? 'icey-margarita' : 'free-cocktail';
    const token = btoa(`${guestInfo.guestId}|${guestInfo.fullName}`);
    attributes.COUPON_LINK_PATH = `https://spicymarg.netlify.app/confirm/${token}?type=${visitTypeForLink}`;
    attributes.VISIT_TYPE_FOR_COUPON = visitTypeForLink;
    attributes.REVIEW_LINK = "https://g.co/kgs/RFM6TGv"; 
  } else {
    attributes.COUPON_LINK_PATH = null; 
    attributes.VISIT_TYPE_FOR_COUPON = null;
    // If STAGE is now 4 (completed), REVIEW_LINK might have already been sent or could be cleared.
    // For simplicity, we are not clearing REVIEW_LINK here explicitly if stage is not 2 or 3.
    // It will be cleared by `completeFunnel` if that path is taken.
  }
  
  return updateContact(email, attributes);
}

export async function optOutSms(email) {
  return updateContact(email, { SMS_OPT_OUT: true });
}

export async function optOutMarketing(email) {
  return updateContact(email, { MARKETING_CONSENT: false });
}

export async function completeFunnel(email, completionDate = new Date()) {
  console.log(`[Brevo API] Marking funnel as complete for ${email}. Setting STAGE to 4.`);
  // We assume GUEST_ID and FULL_NAME are already on the contact from previous updates.
  // If not, you might need to pass them to completeFunnel and include them here.
  return updateContact(email, {
    FUNNEL_COMPLETED: true, 
    COMPLETION_DATE: completionDate.toISOString(), 
    STAGE: 4, // Explicitly set Brevo STAGE to 4
    COUPON_LINK_PATH: null, 
    VISIT_TYPE_FOR_COUPON: null,
    REVIEW_LINK: null // Clear review link as well, or set a "final review" link
  });
}

export async function sendFinalThanksEmail(guestEmail, guestName) {
  console.log('[Brevo API] Attempting to send final thanks email to:', guestEmail);
  return sendTransactionalEmail(
    EmailTemplates.FINAL_THANKS,
    { email: guestEmail, name: guestName },
    {
      FIRST_NAME: guestName ? guestName.split(' ')[0] : 'Valued Customer',
      REVIEW_LINK: "https://g.co/kgs/RFM6TGv" 
    }
  );
}