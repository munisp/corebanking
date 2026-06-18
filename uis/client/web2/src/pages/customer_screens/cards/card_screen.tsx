import { useCallback, useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiCreditCard, FiEye, FiEyeOff, FiLock, FiPlus, FiWifiOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { useTenantTheme } from '../../../hooks/useTenantTheme';
import { cardService, type Card as CardType } from '../../../services/card_service';
import { offlineCardService } from '../../../services/offline_card_service';

interface CardDisplay {
  id: string;
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cvv: string;
  cardType: 'visa' | 'mastercard' | 'verve';
  status: string;
  balance: string;
}

const CardScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPrimaryBgStyle, getPrimaryHoverStyle, getPrimaryTextStyle, tenant } = useTenantTheme();
  usePageTitle('My Cards');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCard, setSelectedCard] = useState(0);
  const [cards, setCards] = useState<CardDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [cardType, setCardType] = useState('virtual');
  const [nameOnCard, setNameOnCard] = useState(user ? `${user.firstName} ${user.lastName}` : '');
  const [cardPin, setCardPin] = useState('');
  const [confirmCardPin, setConfirmCardPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('[CardScreen] showRequestModal state:', showRequestModal);
  }, [showRequestModal]);

  useEffect(() => {
    if (user && !nameOnCard) {
      setNameOnCard(`${user.firstName} ${user.lastName}`);
    }
  }, [user, nameOnCard]);

  const handlePreviousCard = useCallback(() => {
    if (cards.length <= 1) return;
    setShowDetails(false); // Hide details when switching cards for security
    setSelectedCard((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
  }, [cards.length]);

  const handleNextCard = useCallback(() => {
    if (cards.length <= 1) return;
    setShowDetails(false); // Hide details when switching cards for security
    setSelectedCard((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
  }, [cards.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (cards.length <= 1) return;
      
      if (e.key === 'ArrowLeft') {
        handlePreviousCard();
      } else if (e.key === 'ArrowRight') {
        handleNextCard();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePreviousCard, handleNextCard, cards.length]);

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Swiped left - next card
        handleNextCard();
      } else {
        // Swiped right - previous card
        handlePreviousCard();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const isOnline = useOnlineStatus();

  // Format card number with spaces every 4 digits
  const formatCardNumber = (cardNumber: string): string => {
    // Remove existing spaces
    const cleaned = cardNumber.replace(/\s/g, '');
    // Add space every 4 characters
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  // Extract last 4 digits from card number
  const getLastFourDigits = (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\s/g, '').replace(/\*/g, '');
    if (cleaned.length >= 4) {
      return cleaned.slice(-4);
    }
    return '';
  };

  // Get display card number based on visibility state
  const getDisplayCardNumber = (cardNumber: string, showDetails: boolean): string => {
    if (!showDetails) {
      // When hiding details, show only last 4 digits with asterisks
      const lastFour = getLastFourDigits(cardNumber);
      if (lastFour) {
        return `**** **** **** ${lastFour}`;
      }
      // Fallback: show all asterisks if we can't extract last 4 digits
      return '**** **** **** ****';
    } else {
      // When showing details, return the formatted number
      // This might be a masked format from the API, but we show what we have
      return formatCardNumber(cardNumber);
    }
  };

  const detectCardType = (cardNumber: string): 'visa' | 'mastercard' | 'verve' => {
    // Extract first digit from card number (handle masked numbers)
    const cleanNumber = cardNumber.replace(/\s/g, '').replace(/\*/g, '');
    if (cleanNumber.length > 0) {
      const firstDigit = cleanNumber.charAt(0);
      if (firstDigit === '4') return 'visa';
      if (firstDigit === '5') return 'mastercard';
    }
    return 'verve';
  };

  const loadCards = async () => {
    try {
      setLoading(true);
      // Use offline card service which handles both online and offline scenarios
      const response = await offlineCardService.getCards();
      
      if (response.success && response.data) {
        const formattedCards = response.data
          .map((card: CardType | Record<string, unknown>) => {
            // Handle both typed Card and raw API response
            const cardData = card as CardType & Record<string, unknown>;
            const cardNumber = cardData.maskedCardNumber || cardData.cardNumber || cardData.card_number || '**** **** **** ****';
            let expiryDate = cardData.expiryDate || cardData.expiry_date || 'MM/YY';
            // Format expiry date from YYYY-MM-DD to MM/YY
            if (typeof expiryDate === 'string' && expiryDate.match(/^\d{4}-\d{2}-\d{2}/)) {
              const [year, month] = expiryDate.split('-');
              expiryDate = `${month}/${year.slice(-2)}`;
            }
            // Get card holder name from API response
            // The service maps name_on_card, so check both snake_case and camelCase
            const cardDataRecord = cardData as Record<string, unknown>;
            const nameOnCard = (cardDataRecord.name_on_card || cardDataRecord.nameOnCard || '') as string;
            const userFullName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '';
            const cardHolder = nameOnCard || userFullName || 'Card Holder';
            
            const cardId = cardData.id || cardData.card_id;
            if (!cardId) {
              console.warn('Card missing ID:', cardData);
              return null;
            }
            
            // Format card number for consistent display
            const formattedCardNumber = formatCardNumber(String(cardNumber));
            
            return {
              id: String(cardId),
              cardNumber: formattedCardNumber,
              cardHolder: String(cardHolder),
              expiryDate: String(expiryDate),
              cvv: cardData.cvv || undefined, // Store undefined instead of '***' so we can check if CVV is available
              cardType: detectCardType(String(cardNumber)),
              status: (cardData.status || 'active').toLowerCase(),
              balance: '₦0', // Balance would come from wallet/account
            };
          })
          .filter((card): card is CardDisplay => card !== null);
        setCards(formattedCards);
        if (formattedCards.length > 0 && selectedCard >= formattedCards.length) {
          setSelectedCard(0);
        }
      } else if (!response.success && response.message) {
        console.warn('Failed to load cards:', response.message);
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleFreeze = async () => {
    if (!cards[selectedCard]) return;
    
    const currentCard = cards[selectedCard];
    const isFrozen = currentCard.status === 'frozen' || currentCard.status === 'freeze';

    try {
      setActionLoading(true);
      const response = isFrozen 
        ? await cardService.unfreezeCard(currentCard.id)
        : await cardService.freezeCard(currentCard.id);
      
      if (response.success) {
        alert(response.message);
        loadCards();
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error('Failed to freeze/unfreeze card:', error);
      alert(isFrozen ? 'Failed to unfreeze card' : 'Failed to freeze card');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestNew = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('handleRequestNew called, setting showRequestModal to true');
    setShowRequestModal(true);
    console.log('State updated, showRequestModal should be:', true);
  };

  const handleIssueCard = async () => {
    setRequestError(null);
    if (!user) {
      setRequestError('User not found. Please log in again.');
      return;
    }

    if (!nameOnCard.trim()) {
      setRequestError('Please enter the name on card');
      return;
    }

    // Validate PIN
    if (!cardPin || cardPin.length !== 4) {
      setPinError('PIN must be 4 digits');
      return;
    }

    if (cardPin !== confirmCardPin) {
      setPinError('PINs do not match');
      return;
    }

    try {
      setActionLoading(true);
      setPinError(null);
      const accountId = localStorage.getItem('account_id') || '';
      if (!accountId) {
        setRequestError('Account ID not found. Please ensure you are logged in.');
        return;
      }

      // Issue the card
      const response = await cardService.issueCard({
        accountId,
        cardType,
        nameOnCard: nameOnCard.trim(),
      });
      console.log('Card issue response:', response);
      if (response.success && response.data) {
        // Get card ID from response
        const cardData = response.data as CardType & { card_id?: string };
        const cardId = cardData.id || cardData.card_id;
        
        if (cardId) {
          // Automatically set PIN for the newly created card
          try {
            const pinResponse = await cardService.setCardPin(String(cardId), cardPin);
            console.log('Set PIN response:', pinResponse);
            if (pinResponse.success) {
              alert('Card issued and PIN set successfully!');
            } else {
              setRequestError(`Card issued, but failed to set PIN: ${pinResponse.message}`);
            }
          } catch (pinError) {
            console.error('Failed to set PIN:', pinError);
            setRequestError('Card issued, but failed to set PIN. Please set it manually later.');
          }
        } else {
          setRequestError('Card issued, but card ID not found. Please set PIN manually.');
        }
        setShowRequestModal(false);
        setNameOnCard('');
        setCardPin('');
        setConfirmCardPin('');
        loadCards();
      } else {
        setRequestError(response.message || 'Failed to issue card');
      }
    } catch (error) {
      console.error('Failed to issue card:', error);
      setRequestError('Failed to issue card. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };


  const currentCard = cards[selectedCard];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-color)] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading cards...</p>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
          <div className="px-4 pt-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-700 dark:text-gray-300 hover:text-gray-900">
              <FiArrowLeft size={24} />
            </button>
          </div>
          <div className="flex flex-col items-center justify-center px-4 py-20">
            <div className="bg-gray-200 dark:bg-gray-700 p-8 rounded-full mb-6">
              <FiCreditCard className="text-gray-400 dark:text-gray-500" size={64} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No Cards Yet</h2>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-sm">
              You don't have any cards yet. Request a new card to start making payments.
            </p>
            <button
              type="button"
              onClick={() => {
                console.log('Button clicked - Request New Card (empty state)');
                setShowRequestModal(true);
              }}
              className="text-white px-8 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2"
              style={{ ...getPrimaryBgStyle(), ...{ '--hover-bg': getPrimaryHoverStyle().backgroundColor } } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = getPrimaryHoverStyle().backgroundColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = tenant.branding.primary_color;
              }}
            >
              <FiPlus size={20} />
              Request New Card
            </button>
          </div>
        </div>
        {/* Request New Card Modal */}
        {showRequestModal ? (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
            style={{ position: 'fixed', zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRequestModal(false);
              }
            }}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              style={{ position: 'relative', zIndex: 10000, maxHeight: '90vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Request New Card</h2>
              
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Card Type
                  </label>
                <select
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="virtual">Virtual Card</option>
                  <option value="debit">Debit Card</option>
                  <option value="credit">Credit Card</option>
                </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Name on Card *
                  </label>
                  <input
                    type="text"
                    value={nameOnCard}
                    onChange={(e) => setNameOnCard(e.target.value)}
                    placeholder="Enter name as it should appear on card"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Full name: {user?.firstName} {user?.lastName}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Card PIN (4 digits) *
                  </label>
                  <input
                    type="password"
                    value={cardPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCardPin(value);
                      setPinError(null);
                    }}
                    placeholder="0000"
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Confirm PIN *
                  </label>
                  <input
                    type="password"
                    value={confirmCardPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setConfirmCardPin(value);
                      setPinError(null);
                    }}
                    placeholder="0000"
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                  />
                </div>

                {pinError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                    {pinError}
                  </div>
                )}
                {requestError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm mt-2">
                    {requestError}
                  </div>
                )}
              </div>

             {cardType != "virtual"&& <div className="bg-blue-50 dark:bg-[var(--primary-color)]/20 rounded-xl p-4 mb-6 border border-[var(--primary-color)]">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  Your new card will be delivered within 5-7 business days. You will receive a notification once it's ready for pickup or shipped.
                </p>
              </div>}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssueCard}
                  disabled={actionLoading}
                  className="flex-1 text-white px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={getPrimaryBgStyle()}
                onMouseEnter={(e) => {
                  if (!actionLoading && e.currentTarget.getAttribute('disabled') === null) {
                    e.currentTarget.style.backgroundColor = getPrimaryHoverStyle().backgroundColor;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tenant.branding.primary_color;
                }}
                >
                  {actionLoading ? 'Requesting...' : 'Request Card'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="pt-4 pb-20" style={{ background: `linear-gradient(to bottom right, ${tenant.branding.primary_color}, ${tenant.branding.primary_color})` }}>
        <div className="px-4 flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white hover:text-gray-200"
          >
            <FiArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">My Cards</h1>
              {!isOnline && (
                <FiWifiOff size={16} className="text-white/60" title="Offline mode - showing cached cards" />
              )}
            </div>
            <p className="text-sm text-white/80">
              {!isOnline ? 'Offline - Cached cards' : 'Manage your debit cards'}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRequestNew(e);
            }}
            className="text-white hover:text-gray-200"
            disabled={!isOnline}
            title={!isOnline ? 'Card requests require internet connection' : 'Request new card'}
          >
            <FiPlus size={24} />
          </button>
        </div>

        {/* Card Display */}
        <div className="px-4">
          <div 
            className="relative"
            ref={cardContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Navigation Arrows */}
            {cards.length > 1 && (
              <>
                <button
                  onClick={handlePreviousCard}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-20 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg hover:shadow-xl transition-all opacity-80 hover:opacity-100"
                  aria-label="Previous card"
                >
                  <FiChevronLeft size={24} style={getPrimaryTextStyle()} />
                </button>
                <button
                  onClick={handleNextCard}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-20 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg hover:shadow-xl transition-all opacity-80 hover:opacity-100"
                  aria-label="Next card"
                >
                  <FiChevronRight size={24} style={getPrimaryTextStyle()} />
                </button>
              </>
            )}

            {/* Card */}
            <div className="bg-linear-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-6 shadow-2xl relative">
              {/* Frozen Badge */}
              {(currentCard?.status === 'frozen' || currentCard?.status === 'freeze') && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold z-10">
                  FROZEN
                </div>
              )}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Available Balance</p>
                  <p className="text-white text-2xl font-bold">{currentCard.balance}</p>
                </div>
                <div className="text-right">
                  {currentCard.cardType === 'visa' && (
                    <div className="text-white text-2xl font-bold">VISA</div>
                  )}
                  {currentCard.cardType === 'mastercard' && (
                    <div className="flex gap-1">
                      <div className="w-8 h-8 rounded-full bg-red-500 opacity-80"></div>
                      <div className="w-8 h-8 rounded-full bg-yellow-500 opacity-80 -ml-4"></div>
                    </div>
                  )}
                  {currentCard.cardType === 'verve' && (
                    <div className="text-white text-xl font-bold">VERVE</div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-400 text-xs mb-2">Card Number</p>
                <p className="text-white text-xl tracking-wider font-mono">
                  {getDisplayCardNumber(currentCard.cardNumber, showDetails)}
                </p>
              </div>

              <div className="flex justify-between items-end gap-4">
                <div className="flex-1">
                  <p className="text-gray-400 text-xs mb-1">Card Holder</p>
                  <p className="text-white text-sm font-semibold uppercase">{currentCard.cardHolder}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs mb-1">Expires</p>
                  <p className="text-white text-sm font-semibold">{currentCard.expiryDate}</p>
                </div>
              </div>
              {showDetails && currentCard.cvv && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-xs">CVV</p>
                    <p className="text-white text-lg font-semibold font-mono tracking-widest">{currentCard.cvv}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Show/Hide Button */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="absolute -bottom-4 right-8 bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow"
            >
              {showDetails ? (
                <FiEyeOff size={20} style={getPrimaryTextStyle()} />
              ) : (
                <FiEye size={20} style={getPrimaryTextStyle()} />
              )}
            </button>
          </div>

          {/* Card Selector */}
          {cards.length > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <span className="text-white/60 text-xs">
                {selectedCard + 1} of {cards.length}
              </span>
              <div className="flex justify-center gap-2">
                {cards.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setShowDetails(false); // Hide details when switching cards for security
                      setSelectedCard(index);
                    }}
                    className={`h-2 rounded-full transition-all ${
                      index === selectedCard ? 'w-8 bg-white dark:bg-gray-200' : 'w-2 bg-white/40 dark:bg-gray-200/40'
                    }`}
                    aria-label={`Card ${index + 1}`}
                  />
                ))}
              </div>
              <span className="text-white/60 text-xs">
                Use ← → keys or swipe
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 -mt-8 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md grid grid-cols-2 gap-3">
          <button
            onClick={handleFreeze}
            disabled={actionLoading}
            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className={`p-3 rounded-full ${
              currentCard?.status === 'frozen' || currentCard?.status === 'freeze'
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-orange-100 dark:bg-orange-900/30'
            }`}>
              <FiLock 
                className={
                  currentCard?.status === 'frozen' || currentCard?.status === 'freeze'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-orange-600 dark:text-orange-400'
                } 
                size={20} 
              />
            </div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {currentCard?.status === 'frozen' || currentCard?.status === 'freeze' ? 'Unfreeze Card' : 'Freeze Card'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              console.log('Button clicked - Request New (quick actions)');
              setShowRequestModal(true);
            }}
            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <FiCreditCard className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Request New</span>
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Card Transactions</h2>
          <button 
            onClick={() => navigate('/transaction-history')}
            className="text-sm font-semibold"
            style={getPrimaryTextStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = tenant.branding.primary_color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = tenant.branding.primary_color;
            }}
          >
            See All
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <FiCreditCard className="text-gray-400 dark:text-gray-500 mx-auto mb-3" size={48} />
          <p className="text-gray-600 dark:text-gray-400">Card transactions will appear here</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Visit transaction history for all transactions</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="px-4 mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700" style={{ borderColor: `${tenant.branding.primary_color}30` }}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Card Security Tips</h3>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>• Never share your PIN or CVV with anyone</li>
            <li>• Enable transaction notifications</li>
            <li>• Report suspicious activity immediately</li>
            <li>• Freeze your card if lost or stolen</li>
          </ul>
        </div>
      </div>

      {/* Request New Card Modal */}
      {showRequestModal ? (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ position: 'fixed', zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              setShowRequestModal(false);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            style={{ position: 'relative', zIndex: 10000, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Request New Card</h2>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Card Type
                </label>
                <select
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="virtual">Virtual Card</option>
                  <option value="debit">Debit Card</option>
                  <option value="credit">Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Name on Card *
                </label>
                <input
                  type="text"
                  value={nameOnCard}
                  onChange={(e) => setNameOnCard(e.target.value)}
                  placeholder="Enter name as it should appear on card"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Full name: {user?.firstName} {user?.lastName}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Card PIN (4 digits) *
                </label>
                <input
                  type="password"
                  value={cardPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCardPin(value);
                    setPinError(null);
                  }}
                  placeholder="0000"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Confirm PIN *
                </label>
                <input
                  type="password"
                  value={confirmCardPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setConfirmCardPin(value);
                    setPinError(null);
                  }}
                  placeholder="0000"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                />
              </div>

              {pinError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm col-span-2">
                  {pinError}
                </div>
              )}
            </div>

           {cardType != "virtual"&&  <div className="bg-blue-50 dark:bg-[var(--primary-color)]/20 rounded-xl p-4 mb-6 border border-[var(--primary-color)]">
              <p className="text-sm text-gray-800 dark:text-gray-200">
                Your new card will be delivered within 5-7 business days. You will receive a notification once it's ready for pickup or shipped.
              </p>
            </div>}

            <div className="flex gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleIssueCard}
                disabled={actionLoading}
                className="flex-1 text-white px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={getPrimaryBgStyle()}
                onMouseEnter={(e) => {
                  if (!actionLoading && e.currentTarget.getAttribute('disabled') === null) {
                    e.currentTarget.style.backgroundColor = getPrimaryHoverStyle().backgroundColor;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = tenant.branding.primary_color;
                }}
              >
                {actionLoading ? 'Requesting...' : 'Request Card'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default CardScreen;
