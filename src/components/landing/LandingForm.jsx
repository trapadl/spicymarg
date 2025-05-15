// src/components/landing/LandingForm.jsx
import React, { useState } from 'react';
import { signupLead } from '../../api/supabase';
import { updateContact, EmailTemplates, sendTransactionalEmail } from '../../api/brevo';
import Button from '../common/Button';
import Input from '../common/Input';

// Regular expression for email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LandingForm() {
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validate form fields
  const validateForm = () => {
    if (!email || !EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    if (!dob) {
      setError('Please enter your date of birth');
      return false;
    }
    
    // Age validation
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      setError('You must be 18 or older to sign up');
      return false;
    }
    
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Register lead in Supabase
      const result = await signupLead(email, dob);
      console.log('[LandingForm] Supabase signupLead result:', result);
      
      if (!result.success || !result.guest_id) { // Ensure guest_id is present
        setError(result.message || 'Failed to sign up. Please try again.');
        setIsSubmitting(false);
        return;
      }
      const { guest_id: newGuestId } = result; 
      
      const brevoListIdForNewSignups = 7; 

      // Prepare for voucher email
      const voucherToken = btoa(`${newGuestId}|${email}`); // Token for /voucher page
      const voucherLink = `${window.location.origin}/voucher?token=${voucherToken}`;
      console.log('[LandingForm] Sending signup voucher email (Template ID 1) with VOUCHER_LINK:', voucherLink);

      const attributesForBrevo = {
        STAGE: 0,
        LAST_STAGE_UPDATE: new Date().toISOString(),
        DOB: dob,
        GUEST_ID: newGuestId,
        // Add these crucial attributes for reminders:
        VOUCHER_LINK: voucherLink,
        COUPON_LINK_PATH: `https://trapadl.github.io/spicymarg/voucher?token=${voucherToken}`,
      };
      console.log('[LandingForm] Attributes for initial Brevo contact update:', JSON.stringify(attributesForBrevo));
      await updateContact(email, attributesForBrevo, [brevoListIdForNewSignups]);
      


      
      await sendTransactionalEmail(
       49, 
       { email }, 
        {
          VOUCHER_LINK: voucherLink, 
          EMAIL: email 
        }
      );
      
      
      console.log('[LandingForm] Signup process successful.');
      setSuccess(true);
    } catch (err) {
      console.error('[LandingForm] Error during signup process:', err);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If signup was successful
  if (success) {
    return (
      <div className="success-container bg-dark rounded-lg shadow p-6 text-center">
        <div className="text-pink success-icon">✓</div>
        <h2 className="text-2xl font-bold mb-4">check your email! 📧</h2>
        <p className="mb-4">
          we've sent you a link with your free spicy margarita voucher.
          come to the bar, open the email and click the link to claim it!
        </p>
        <p className="text-sm text-gray-400">
          <i>don't see it? check your spam fam.</i>
        </p>
        <Button 
          className="w-full py-3 mt-4" // Added mt-4 for spacing
          variant="primary"
          onClick={() => window.open('https://www.trapadl.com/', '_blank')}
        >
          find out more about trap.
        </Button><br /><br />
        <Button 
          className="w-full py-3"
          variant="primary"
          onClick={() => window.open('https://www.instagram.com/trap.adl', '_blank')}
        >
          our instagram.
        </Button><br /><br />
        <Button 
          className="w-full py-3"
          variant="primary"
          onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSe57gW9pysQn_LBf5PKRmur-yoccAw3rXOiFYUdNK2N3EszSQ/viewform', '_blank')}
        >
          make a booking.
        </Button>
      </div>
    );
  }

  // Main form
  return (
    <div className="landing-form-container">
      <h2>here's a free spicy margarita from the team at trap.</h2>
      <p className="tagline">
        our margs are the best you'll ever have. We make our own house-fermented 
        chili special, and we're so confident you'll love them - here's a free one!
      </p>
      
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="form-group mb-4">
          <label htmlFor="email" className="block font-medium mb-1">Email Address</label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
        </div>
        
        <div className="form-group mb-6">
          <label htmlFor="dob" className="block font-medium mb-1">Date of Birth</label>
          <Input
            id="dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Max date is 18 years ago
            required
          />
          <p className="dob-note text-sm text-gray-400 mt-1">You must be 18+ to redeem this offer</p>
        </div>
        
        <Button 
          type="submit" 
          className="w-full py-3"
          variant="primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'get my free margarita'}
        </Button>
        
        <p className="terms-text text-sm text-gray-400 text-center mt-4">
          By submitting, you agree to receive marketing emails from trap. 
          You can unsubscribe at any time.
        </p>
      </form>
    </div>
  );
}