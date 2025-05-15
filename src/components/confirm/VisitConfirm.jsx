// src/components/confirm/VisitConfirm.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { confirmVisit, supabase } from '../../api/supabase';
import { updateContactStage, completeFunnel, sendFinalThanksEmail } from '../../api/brevo'; // Added sendFinalThanksEmail
import Button from '../common/Button';
import Input from '../common/Input';

export default function VisitConfirm() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const visitType = searchParams.get('type') || 'spicy-margarita';

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [guestInfo, setGuestInfo] = useState(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [bartenderPassword, setBartenderPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [alreadyRedeemed, setAlreadyRedeemed] = useState(false);

  const BARTENDER_ACCESS_CODE = 'drank';

  useEffect(() => {
    console.log('[VisitConfirm] useEffect triggered. Token:', token, 'VisitType:', visitType);
    setIsLoading(true);
    setAlreadyRedeemed(false);
    setError('');
    setGuestInfo(null); 

    let localDecodedGuestId = '';
    let localDecodedFullName = 'Guest'; 

    if (!token) {
      setError('Missing confirmation token.');
      setIsLoading(false);
      setAlreadyRedeemed(true);
      console.error('[VisitConfirm] useEffect: No token found.');
      return;
    }

    try {
      const decoded = atob(token);
      const [id, name] = decoded.split('|');
      console.log('[VisitConfirm] useEffect: Decoded token parts - id:', id, 'name:', name);

      if (id && id.trim() !== '') {
        localDecodedGuestId = id.trim();
        if (name && name.trim() !== '') localDecodedFullName = name.trim();
        setGuestInfo({ guestId: localDecodedGuestId, fullName: localDecodedFullName });
      } else {
        setError('Invalid confirmation link: Guest ID missing or empty in token.');
        setIsLoading(false);
        setAlreadyRedeemed(true);
        console.error('[VisitConfirm] useEffect: Invalid ID in token.');
        return;
      }
    } catch (err) {
      setError('Invalid confirmation link format (decoding error).');
      setIsLoading(false);
      setAlreadyRedeemed(true);
      console.error('[VisitConfirm] useEffect: Token decoding error:', err);
      return;
    }

    const checkVisitStatus = async (guestIdFromToken, currentVisitType) => {
      console.log('[VisitConfirm] checkVisitStatus called for guestId:', guestIdFromToken, 'visitType:', currentVisitType);
      if (!guestIdFromToken) {
        setError("Guest ID could not be determined.");
        setAlreadyRedeemed(true);
        setIsLoading(false);
        return;
      }

      let expectedVisitNumberForOffer;
      let stageRequiredToAccessThisOffer;

      switch (currentVisitType) {
        case 'spicy-margarita': 
          expectedVisitNumberForOffer = 1; stageRequiredToAccessThisOffer = 1; break;
        case 'icey-margarita': 
          expectedVisitNumberForOffer = 2; stageRequiredToAccessThisOffer = 2; break;
        case 'free-cocktail': 
          expectedVisitNumberForOffer = 3; stageRequiredToAccessThisOffer = 3; break;
        default:
          setError(`Unknown offer type: ${currentVisitType}.`);
          setAlreadyRedeemed(true);
          setIsLoading(false);
          console.error('[VisitConfirm] checkVisitStatus: Unknown visit type.');
          return;
      }

      try {
        const { data: guest, error: guestError } = await supabase
          .from('guests')
          .select('stage, full_name')
          .eq('id', guestIdFromToken)
          .single();

        if (guestError || !guest) {
          setError('Could not retrieve guest information to check eligibility.');
          setAlreadyRedeemed(true);
          console.error('[VisitConfirm] checkVisitStatus: Error fetching guest or guest not found:', guestError);
        } else {
          setGuestInfo(prev => ({ 
            ...(prev || {}), 
            guestId: guestIdFromToken, 
            fullName: guest.full_name || (prev ? prev.fullName : 'Guest') 
          }));
          console.log('[VisitConfirm] checkVisitStatus: Guest data fetched. Stage:', guest.stage, 'DB FullName:', guest.full_name);

          // Check if funnel already completed (guest.stage is 4 or higher)
          if (guest.stage >= 4) {
            setError(`This funnel has already been completed for ${guest.full_name || 'this guest'}.`);
            setAlreadyRedeemed(true); // Treat as redeemed/completed
          } else if (guest.stage < stageRequiredToAccessThisOffer) {
             setError(`This offer (${currentVisitType.replace(/-/g, ' ')}) is not yet available. Please complete the previous step(s). Current stage: ${guest.stage}.`);
             setAlreadyRedeemed(true); 
          } else if (guest.stage > stageRequiredToAccessThisOffer) {
              if (!(currentVisitType === 'free-cocktail' && guest.stage === 3)) { 
                   setError(`This offer (${currentVisitType.replace(/-/g, ' ')}) appears to have already been passed in the funnel. Current stage: ${guest.stage}.`);
                   setAlreadyRedeemed(true);
              }
          }
          
          if (!alreadyRedeemed) { 
              const { data: existingVisit, error: visitCheckError } = await supabase
                .from('visits')
                .select('id')
                .eq('guest_id', guestIdFromToken)
                .eq('visit_number', expectedVisitNumberForOffer)
                .maybeSingle(); 

              if (visitCheckError) {
                setError('Could not check specific visit redemption status.');
                setAlreadyRedeemed(true); 
                console.error('[VisitConfirm] checkVisitStatus: Error checking visits table:', visitCheckError);
              } else if (existingVisit) {
                setError(`This ${currentVisitType.replace(/-/g, ' ')} offer has already been redeemed (Visit ${expectedVisitNumberForOffer} recorded).`);
                setAlreadyRedeemed(true);
              }
          }
        }
      } catch(e) {
          setError("An unexpected error occurred while checking visit status.");
          setAlreadyRedeemed(true);
          console.error('[VisitConfirm] checkVisitStatus: Unexpected error:', e);
      } finally {
          setIsLoading(false);
      }
    };

    if (localDecodedGuestId) {
      checkVisitStatus(localDecodedGuestId, visitType);
    } else {
        setIsLoading(false);
    }

  }, [token, visitType, navigate]); 

  const getVisitInfoText = () => {
    switch (visitType) {
      case 'icey-margarita': return { title: 'weve invented something new. an icey margarita!', description: 'you have heard of a spicy one. this is an icey one.' };
      case 'free-cocktail': return { title: 'boom. free cocktail.', description: 'have a house cocktail on us!' };
      case 'spicy-margarita': return { title: 'spicy. spicy. marg', description: 'well arent you special.' };
      default: return { title: 'Special Offer', description: 'Please show this to your bartender.' };
    }
  };

  const { title, description } = getVisitInfoText();

  const processVisitConfirmation = async () => {
    console.log('[VisitConfirm] processVisitConfirmation called. Current guestInfo:', JSON.stringify(guestInfo), 'alreadyRedeemed:', alreadyRedeemed);
    
    if (!guestInfo || !guestInfo.guestId || typeof guestInfo.guestId !== 'string' || guestInfo.guestId.trim() === '' || alreadyRedeemed) {
      console.error('processVisitConfirmation ABORTED: guestInfo, guestInfo.guestId is invalid, or alreadyRedeemed.');
      setError('Cannot confirm visit: Essential guest information is missing or the offer is invalid/already used.');
      setIsConfirming(false);
      return;
    }

    setError(''); 
    setPasswordError(''); 
    setIsConfirming(true);

    let expectedVisitNumber;
    switch (visitType) {
        case 'spicy-margarita': expectedVisitNumber = 1; break;
        case 'icey-margarita': expectedVisitNumber = 2; break;
        case 'free-cocktail': expectedVisitNumber = 3; break;
        default:
            setError("Cannot determine expected visit number for confirmation due to unknown visit type.");
            setIsConfirming(false);
            console.error('[VisitConfirm] processVisitConfirmation: Unknown visit type for expectedVisitNumber.');
            return;
    }
    console.log('[VisitConfirm] processVisitConfirmation: Attempting to confirm visit for guestId:', guestInfo.guestId, 'expectedVisitNumber:', expectedVisitNumber);

    try {
      const result = await confirmVisit(guestInfo.guestId, expectedVisitNumber);
      console.log('[VisitConfirm] processVisitConfirmation: RPC result:', result);
      
      if (result.success) {
        if (result.email && result.guest_id && result.full_name) {
            // After any successful visit confirmation:
            if (visitType === 'free-cocktail') { 
                // This was the 3rd (final) visit
                console.log('[VisitConfirm] Funnel complete! Calling completeFunnel for Brevo. DB stage should now be 4.');
                await completeFunnel(result.email, new Date()); // Updates Brevo: FUNNEL_COMPLETED=true, STAGE=4, clears coupon paths

                console.log('[VisitConfirm] Sending final thanks email.');
                await sendFinalThanksEmail(result.email, result.full_name); // Sends transactional final email
            } else {
                // This was visit 1 or 2. Update Brevo stage and set next coupon attributes.
                // result.stage from RPC will be 2 (after visit 1) or 3 (after visit 2).
                console.log(`[VisitConfirm] Visit ${result.visit_number} confirmed. Updating Brevo stage to ${result.stage} and setting next coupon attributes.`);
                await updateContactStage(result.email, result.stage, { 
                    guestId: result.guest_id, 
                    fullName: result.full_name 
                });
            }
        } else {
            console.warn("[VisitConfirm] Email, guest_id, or full_name not available from confirmVisit RPC. Brevo update might be incomplete. GuestID from state:", guestInfo.guestId);
        }
        setConfirmed(true);
      } else {
        setError(result.message || 'Failed to confirm visit. The offer might have already been redeemed or there was an issue.');
        if (result.message && (result.message.toLowerCase().includes("already redeemed") || result.message.toLowerCase().includes("already recorded"))) {
            setAlreadyRedeemed(true); 
        }
      }
    } catch (err) {
      console.error('[VisitConfirm] processVisitConfirmation: Error during API call or Brevo update:', err);
      setError('An unexpected error occurred. Please try again or contact support.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleInitialConfirmClick = () => {
    console.log('[VisitConfirm] handleInitialConfirmClick. Current guestInfo:', JSON.stringify(guestInfo));
    if (alreadyRedeemed) {
        setError("This offer has already been processed and cannot be confirmed again.");
        return;
    }
    if (!guestInfo || !guestInfo.guestId || guestInfo.guestId.trim() === '') {
        setError("Cannot proceed: Guest details are not fully loaded or are invalid. Please refresh or check the link.");
        return;
    }
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
      setPasswordError('Incorrect access code. Please try again.');
    }
  };
  
  console.log('[VisitConfirm] Rendering. isLoading:', isLoading, 'alreadyRedeemed:', alreadyRedeemed, 'confirmed:', confirmed, 'error:', error, 'guestInfo:', JSON.stringify(guestInfo));

  if (isLoading) {
    return (
      <div className="visit-confirmation-container" style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading offer details, please wait...</p>
      </div>
    );
  }
  
  if (alreadyRedeemed && !confirmed) { 
    return (
      <div className="visit-confirmation-container confirmation-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>nice try bozo.</h2>
        <p className="error-message" style={{backgroundColor: 'transparent', border: 'none', color: '#ff6b6b', fontSize: '1.1rem', marginBottom: '1rem'}}>{error || 'This offer has already been used or is not currently available.'}</p>
        <Button onClick={() => window.close()} variant="secondary" style={{marginTop: '1rem'}}>close.</Button>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="voucher-display-container"> {/* Re-using main container for consistent styling */}
        <div className="voucher-confirmation-container"> {/* Specific styling for success message */}
            <div className="success-icon">✓</div>
            <h2>hey you! get back to work!</h2>
            <p>haven't we gone through this before?</p>
                    {visitType !== 'free-cocktail' && <p>as always, we hope you enjoy your drink! - keep an eye on your email in the coming days for another something special from us.</p>}
        {visitType === 'free-cocktail' && <p>thats all from us for now! enjoy your free house cocktail and thanks for being awesome.</p>}

        </div>
         <Button onClick={() => window.close()} variant="secondary" style={{marginTop: '2rem'}}>close.</Button>
      </div>
    );
  }

  if (error && !showPasswordPrompt && !isLoading && !alreadyRedeemed && !confirmed) {
     return (
      <div className="visit-confirmation-container confirmation-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>Error Loading Offer</h2>
        <p className="error-message" style={{backgroundColor: 'transparent', border: 'none', color: '#ff6b6b', fontSize: '1.1rem', marginBottom: '1rem'}}>{error}</p>
        <p>Please ask the customer to show their voucher again or check the link.</p>
        <Button onClick={() => window.location.reload()} variant="primary" style={{marginTop: '1rem'}}>Retry</Button>
      </div>
    );
  }

  if (!guestInfo && !isLoading) {
    return (
      <div className="visit-confirmation-container" style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Could not load guest details from the link. Please ensure the link is correct.</p>
        <Button onClick={() => window.location.reload()} variant="primary" style={{marginTop: '1rem'}}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="visit-confirmation-container">
      <div className="confirmation-card">
        <div className="confirmation-header">
          <h2>{title}</h2>
          <p className="confirmation-type">{description}</p>
        </div>

        {guestInfo && guestInfo.fullName && (
          <div className="guest-details">
            <p className="guest-name">
              <strong>full name:</strong> {guestInfo.fullName}
            </p>
          </div>
        )}

        <div className="bartender-section">
          
          {passwordError && <div className="error-message" style={{ marginBottom: '1rem' }}>{passwordError}</div>}
          {error && !passwordError && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

          {!showPasswordPrompt ? (
            <>
              
              <Button
                onClick={handleInitialConfirmClick}
                className="confirm-btn"
                disabled={isConfirming || isLoading || !guestInfo || !guestInfo.guestId}
                variant="primary"
              >
                {isConfirming ? 'processing...' : `show this to your bartender.`}
              </Button>
            </>
          ) : (
            <div className="password-prompt-section" style={{ marginTop: '1rem' }}>
              <label htmlFor="bartenderPasswordConfirm" style={{ display: 'block', marginBottom: '0.5rem' }}>enter access code:</label>
              <Input
                type="password"
                id="bartenderPasswordConfirm"
                value={bartenderPassword}
                onChange={(e) => setBartenderPassword(e.target.value)}
                placeholder="bartender access code"
                style={{ marginBottom: '0.5rem' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <Button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setBartenderPassword('');
                    setPasswordError('');
                  }}
                  variant="secondary"
                  disabled={isConfirming}
                >
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