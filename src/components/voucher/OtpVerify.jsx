import React, { useState, useEffect, useRef } from 'react';
import { verifyOtp, sendOtp } from '../../api/supabase';
import { sendOtpSms, updateContactStage, updateContact  } from '../../api/brevo';
import Button from '../common/Button';
import Input from '../common/Input';
import VoucherDisplay from './VoucherDisplay';

export default function OtpVerify({ guestId, phone, fullName, onBackToForm }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef([]);
  
  // Set up countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !canResend) {
      setCanResend(true);
    }
  }, [countdown, canResend]);
  
  // Handle input of each OTP digit
  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;
    
    // Update OTP array
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };
  
  // Handle key press for backspace
  const handleKeyDown = (index, e) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Verify OTP via Supabase
      const result = await verifyOtp(guestId, otpString, fullName);
      
      if (!result.success) {
        setError(result.message || 'Invalid verification code. Please try again.');
        setIsSubmitting(false);
        return;
      }
      
      // Update contact stage in Brevo
      await updateContactStage(result.email, 1, {
        guestId: result.guest_id || guestId,
        fullName: result.full_name || fullName
      });

      await updateContact(result.email, {
    SMS: phone,  // Use "SMS" as the attribute name, not "PHONE"
  SMS_OPT_IN: true  // Custom attribute for your tracking (if needed)
});
      
      // Show voucher display
      setVerified(true);
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle OTP resend
  const handleResend = async () => {
    setError('');
    setCanResend(false);
    setCountdown(60);
    
    try {
      // Resend OTP via Supabase
      const result = await sendOtp(guestId, phone);
      
      if (!result.success) {
        setError(result.message || 'Failed to resend code. Please try again.');
        setCanResend(true);
        return;
      }
      
      // Send OTP SMS via Brevo
      await sendOtpSms(phone, result.otp);
    } catch (err) {
      console.error('Error resending OTP:', err);
      setError('An unexpected error occurred. Please try again later.');
      setCanResend(true);
    }
  };
  
  // If verified, show voucher display
  if (verified) {
    return <VoucherDisplay guestId={guestId} fullName={fullName} />;
  }
  
  // OTP verification form
  return (
    <div className="otp-verification-container">
      <h2>get verified.</h2>
      <p className="tagline">
        we've sent a 6-digit code to {phone}. enter it below to become verified.
      </p>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="otp-inputs">
          {otp.map((digit, index) => (
            <Input
              key={index}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              ref={(el) => (inputRefs.current[index] = el)}
              className="otp-input"
              autoFocus={index === 0}
            />
          ))}
        </div>
        
        <div className="otp-actions">
          <Button 
            type="submit" 
            className="primary-btn"
            disabled={isSubmitting || otp.join('').length !== 6}
          >
            {isSubmitting ? 'Verifying...' : 'Verify Code'}
          </Button>
          
          <div className="resend-section">
            {canResend ? (
              <button 
                type="button"
                className="text-btn"
                onClick={handleResend}
              >
                resend code.
              </button>
            ) : (
              <p className="countdown-text">
                resend code in {countdown} seconds.
              </p>
            )}
          </div>
        </div>
        
        <button 
          type="button"
          className="text-btn back-btn"
          onClick={onBackToForm}
        >
          &larr; go back.
        </button>
      </form>
    </div>
  );
}