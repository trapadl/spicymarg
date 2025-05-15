import React, { useState } from 'react';
import { confirmVisit } from '../../api/supabase'; // Assuming confirmVisit is correctly in api/supabase
import { updateContactStage } from '../../api/brevo'; // Assuming this is correctly in api/brevo
import Button from '../common/Button';
import Input from '../common/Input';

export default function VoucherDisplay({ guestId, fullName }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false); // True if this specific redemption attempt was successful
  const [error, setError] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [bartenderPassword, setBartenderPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // No alreadyRedeemed state here, as VoucherForm should prevent reaching this if already fully redeemed.
  // This component's purpose is to attempt the *first* visit confirmation.

  const voucherCode = `SPICY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const BARTENDER_ACCESS_CODE = 'drank';
  
  const processVisitConfirmation = async () => {
    setError('');
    setPasswordError('');
    setIsConfirming(true);
    
    try {
      // Attempt to confirm the FIRST visit (expectedVisitNumber = 1)
      const result = await confirmVisit(guestId, 1); 
      
      if (result.success) {
        if(result.email) { // Check if email is available from RPC
            await updateContactStage(result.email, result.stage, { // result.stage should be 2
                guestId: result.guest_id,
                fullName: result.full_name
            });
        } else {
            console.warn("Email not available from confirmVisit RPC, Brevo update for stage 2 skipped. GuestID:", guestId);
        }
        setConfirmed(true); // Mark this redemption attempt as successful
        setTimeout(() => { 
            // Try to close the window; may not work depending on how it was opened
            // window.close(); 
            // Alternatively, navigate or show a persistent success message
        }, 10000);
      } else {
        // Handle errors from confirmVisit, including "already recorded"
        setError(result.message || 'Failed to confirm visit. Please try again.');
        // If it's already recorded, the bartender can't re-confirm here.
        // The VoucherForm should have ideally caught this if stage >= 2.
      }
    } catch (err) {
      console.error('Error confirming visit:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };
  
  const handleInitialConfirmClick = () => {
    setShowPasswordPrompt(true);
    setError(''); 
    setPasswordError(''); 
  };

  const handlePasswordSubmit = () => {
    if (bartenderPassword === BARTENDER_ACCESS_CODE) {
      setShowPasswordPrompt(false); 
      setBartenderPassword(''); 
      processVisitConfirmation(); 
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  if (confirmed) {
    return (
      <div className="voucher-display-container"> {/* Re-using main container for consistent styling */}
        <div className="voucher-confirmation-container"> {/* Specific styling for success message */}
            <div className="success-icon">✓</div>
            <h2>hey you! get back to work!</h2>
            <p>our valued guest, {fullName || 'Guest'}, is waiting for their spicy marg.</p>
            <p>we hope you enjoy it - keep an eye on your email in the coming days for another something special from us.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="voucher-display-container">
      <div className="voucher-card">
        <div className="voucher-header">
          <h2>good for one spicy marg.</h2>
        </div>
        
        <div className="voucher-details">
          <p className="voucher-name">
            <strong>name:</strong> {fullName || "Guest (Name not provided)"}
          </p>
         
        </div>
        
        <div className="bartender-section">
          
          {/* Display error from confirmVisit if it occurs (e.g. already recorded) */}
          {error && <div className="error-message">{error}</div>} 
          {passwordError && <div className="error-message" style={{ marginBottom: '1rem' }}>{passwordError}</div>}

          {!showPasswordPrompt ? (
            <>
              
              <Button
                onClick={handleInitialConfirmClick}
                className="confirm-btn"
                variant="primary"
                disabled={isConfirming} // Disable if already confirmed this session or during API call
              >
                {isConfirming ? 'processing...' : 'show this screen to your bartender.'}
              </Button>
            </>
          ) : (
            <div className="password-prompt-section" style={{ marginTop: '1rem' }}>
              <label htmlFor="bartenderPassword" style={{display: 'block', marginBottom: '0.5rem'}}>enter access code:</label>
              <Input
                type="password"
                id="bartenderPassword"
                value={bartenderPassword}
                onChange={(e) => setBartenderPassword(e.target.value)}
                placeholder="bartender access code"
                style={{marginBottom: '0.5rem'}}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button onClick={() => { setShowPasswordPrompt(false); setBartenderPassword(''); setPasswordError(''); }} variant="secondary" disabled={isConfirming}>
                  cancel
                </Button>
                <Button onClick={handlePasswordSubmit} variant="primary" disabled={isConfirming}>
                  {isConfirming ? 'confirming...' : 'serve.'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}