import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { sendOtp, supabase, getGuestStatusById } from '../../api/supabase'; // Add getGuestStatusById
import { sendOtpSms } from '../../api/brevo';
import Button from '../common/Button';
import Input from '../common/Input';
import OtpVerify from './OtpVerify';
import VoucherDisplay from './VoucherDisplay';

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

export default function VoucherForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [guestId, setGuestId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alreadyClaimedDetails, setAlreadyClaimedDetails] = useState(null); // Stores guest object if processed
  const [flowMessage, setFlowMessage] = useState('');

  useEffect(() => {
    setIsLoading(true);
    setError('');
    setFlowMessage('');
    setAlreadyClaimedDetails(null);
    setGuestId(''); // Reset derived states
    setEmail('');   // Reset derived states

    let localParsedGuestId = '';
    let localParsedEmail = '';

    if (token) {
      try {
        const decodedString = atob(token);
        const parts = decodedString.split('|');
        if (parts.length === 2 && parts[0] && parts[1]) {
          localParsedGuestId = decodeURIComponent(parts[0]);
          localParsedEmail = decodeURIComponent(parts[1]);
        } else {
          setError('Invalid voucher link (token content error).');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        setError('Invalid voucher link (decoding error).');
        setIsLoading(false);
        return;
      }
    } else {
      setError('Missing voucher token.');
      setIsLoading(false);
      return;
    }

    setGuestId(localParsedGuestId); // Set state based on current token
    setEmail(localParsedEmail);   // Set state based on current token

    const checkGuestStatus = async (guestIdFromToken) => { // Removed emailFromToken as it's not needed if querying by ID
  if (!guestIdFromToken) {
    setError('Voucher link is missing essential guest information.');
    setIsLoading(false);
    return;
  }

  try {
    // const { data: guest, error: guestError } = await supabase // OLD DIRECT QUERY
    //   .from('guests')
    //   .select('id, full_name, phone, stage, email')
    //   .eq('id', guestIdFromToken)
    //   .single();
    
    const result = await getGuestStatusById(guestIdFromToken); // NEW RPC CALL

    if (!result.success || !result.guest) {
      // setError(result.message || 'Could not retrieve your details. Please try the link again or sign up.');
      // If guest not found by ID from token, it's an invalid link for this stage.
      setError('This voucher link is not associated with a valid signup. Please sign up first.');
    } else {
      const guest = result.guest;
      // Sync email state if guest object has it (it should from the RPC)
      if (guest.email) { // localParsedEmail is from token, guest.email from DB via RPC
         if (localParsedEmail && guest.email !== localParsedEmail) {
            console.warn("Email from DB differs from token, using DB email.", guest.email);
         }
         setEmail(guest.email);
      }


      if (guest.stage >= 2) {
        setFlowMessage("this one's been claimed. maybe you're thinking of a different voucher?");
        setAlreadyClaimedDetails(guest);
      } else if (guest.stage === 1) {
        setFlowMessage("phone verified, show this to your bartender.");
        setAlreadyClaimedDetails(guest);
      }
    }
  } catch (e) {
    setError("An error occurred while checking your voucher status.");
    console.error("Error in checkGuestStatus (VoucherForm):", e);
  } finally {
    setIsLoading(false);
  }
};

    if (localParsedGuestId) { // Only proceed if guestId was successfully parsed from token
        checkGuestStatus(localParsedGuestId);
    } else {
        // This case means localParsedGuestId wasn't set from token, error should have been set earlier.
        setIsLoading(false);
    }

  }, [token, navigate, supabase]);


  const handlePhoneChange = (e) => {
    let value = e.target.value;
    if (value.startsWith('0')) {
      value = '+61' + value.substring(1);
    }
    setPhone(value);
  };

  const validateForm = () => {
    if (!guestId) {
        setError('Guest information is missing (No Guest ID). Cannot send OTP.');
        return false;
    }
    if (!fullName || fullName.trim().length < 2) {
      setError('Please enter your full name');
      return false;
    }
    if (!phone || !PHONE_REGEX.test(phone)) {
      setError('Please enter a valid phone number (e.g., +61412345678 or 0412345678).');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+61${phone.substring(phone.startsWith('0') ? 1 : 0)}`;
      const result = await sendOtp(guestId, formattedPhone); 

      if (!result.success) {
        setError(result.message || 'Failed to send verification code. Please try again.');
      } else {
        await sendOtpSms(formattedPhone, result.otp);
        setShowOtpForm(true);
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return ( <div className="voucher-form-container" style={{ textAlign: 'center' }}><p>Loading...</p></div> );
  }

  if (error) { 
    return ( 
      <div className="voucher-form-container" style={{ textAlign: 'center' }}>
        <div className="error-message" style={{marginBottom: '1rem'}}>{error}</div>
        <Button onClick={()=>navigate('/')} variant="primary">Go to Homepage</Button> 
      </div> 
    );
  }
  
  if (alreadyClaimedDetails) {
    if (alreadyClaimedDetails.stage >= 2) { 
      return (
          <div className="voucher-form-container confirmation-card" style={{ textAlign: 'center' }}>
            <h2>nice try 🤡</h2>
            <p style={{marginBottom: '1rem'}}>{flowMessage || "This offer has already been processed."}</p>
            <Button onClick={() => window.close()} variant="secondary" style={{marginTop: '1rem'}}>close</Button>
          </div>
      );
    }
    // Stage is 1: phone verified, margarita not yet redeemed. Show VoucherDisplay.
    return <VoucherDisplay guestId={alreadyClaimedDetails.guestId} fullName={alreadyClaimedDetails.fullName || "Valued Guest"} />;
  }

  if (showOtpForm) {
    return (
      <OtpVerify
        guestId={guestId} 
        phone={phone}
        fullName={fullName}
        onBackToForm={() => setShowOtpForm(false)}
      />
    );
  }

  return (
    <div className="voucher-form-container">
      <h2>get your free spicy marg.</h2>
      <p className="tagline">
        almost there! just verify your number so we know its you.
      </p>
      {/* Display error here if it occurred before form submission */}
      {error && !isSubmitting && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fullName"></label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="full name"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="phone"></label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="phone number e.g. +61412345678 or 0412345678"
            required
          />
          <p className="small-text">get ready for a verification code</p>
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || !guestId || isLoading} 
        >
          {isSubmitting ? 'sending code...' : 'send code.'}
        </Button>
      </form>
    </div>
  );
}