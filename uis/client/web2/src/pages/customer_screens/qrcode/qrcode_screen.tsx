import jsQR from "jsqr";
import React, { useRef, useState } from "react";
import { FiArrowLeft, FiCamera, FiCopy, FiShare2, FiUpload } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useWallet } from "../../../contexts/WalletContext";
import { PaymentService } from "../../../services/payment_service";

const paymentService = new PaymentService();

export default function QRCodePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wallet } = useWallet();
  const [tab, setTab] = useState<"my" | "scan">("my");
  const [accountId, setAccountId] = useState<string>("");

  // Get account details from wallet and account ID
  const accountName = user ? `${user.firstName} ${user.lastName}` : "User";
  const accountNumber = wallet?.accountNumber || "N/A";

  // Load account ID from localStorage on mount
  React.useEffect(() => {
    const loadAccountId = () => {
      try {
        // Get from localStorage - try multiple keys
        // const storedAccount = localStorage.getItem('account');
        // if (storedAccount) {
        //   const account = JSON.parse(storedAccount);
        //   if (account.id) {
        //     setAccountId(String(account.id));
        //     return;
        //   }
        // }

        // Try account_id key directly
        const accountIdFromStorage = localStorage.getItem('account_id');
        if (accountIdFromStorage) {
          setAccountId(accountIdFromStorage);
          return;
        }

        // Try from user object
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.account_id) {
            setAccountId(String(user.account_id));
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load account ID from localStorage:', error);
      }
    };
    loadAccountId();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          >
            <FiArrowLeft size={20} className="dark:text-white" />
          </button>
          <h1 className="text-xl font-semibold dark:text-white">QR Code</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <button
          className={`flex-1 py-3 text-center font-semibold transition ${
            tab === "my"
              ? "text-[var(--primary-color)] dark:text-[var(--primary-color)] border-b-2 border-[var(--primary-color)] dark:border-[var(--primary-color)]"
              : "text-gray-500 dark:text-gray-400"
          }`}
          onClick={() => setTab("my")}
        >
          My QR Code
        </button>

        <button
          className={`flex-1 py-3 text-center font-semibold transition ${
            tab === "scan"
              ? "text-[var(--primary-color)] dark:text-[var(--primary-color)] border-b-2 border-[var(--primary-color)] dark:border-[var(--primary-color)]"
              : "text-gray-500 dark:text-gray-400"
          }`}
          onClick={() => setTab("scan")}
        >
          Scan QR
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {tab === "my" ? (
          <MyQRCodeTab accountName={accountName} accountNumber={accountNumber} accountId={accountId} />
        ) : (
          <ScanQRTab />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- My QR Tab ------------------------------ */

function MyQRCodeTab({
  accountName,
  accountNumber,
  accountId,
}: {
  accountName: string;
  accountNumber: string;
  accountId: string;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [note, setNote] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null); // Base64 image data
  const [qrCodeData, setQrCodeData] = useState<{
    recipient: string;
    amount: string;
    currency: string;
    note: string;
  } | null>(null); // Store original request data for display
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrRef = useRef<HTMLDivElement | null>(null);

  const generateQRCode = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!accountId) {
      setError("Account ID not available. Please wait a moment and try again.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await paymentService.generateQR(
        accountId,
        parseFloat(amount),
        currency,
        note || undefined
      );

      if (result.success && result.qrCodeData) {
        // API returns base64 encoded image in qr_code_data
        // Store the base64 image data for display
        setQrCodeImage(result.qrCodeData);
        
        // Store the request data for display purposes
        setQrCodeData({
          recipient: accountId,
          amount: String(amount),
          currency: currency,
          note: note || '',
        });
      } else {
        setError(result.message || "Failed to generate QR code");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generating QR code");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  const downloadQR = () => {
    if (!qrCodeImage) return;

    // Convert base64 to blob
    const byteCharacters = atob(qrCodeImage);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `payment-qr-${Date.now()}.png`;
    link.click();
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const shareDetails = async () => {
    const text = qrCodeImage
      ? `Payment Request:\nAmount: ${currency} ${amount}\nNote: ${note || "N/A"}\nAccount: ${accountNumber}\nRecipient: ${accountName}`
      : `My Account Details:\nAccount: ${accountNumber}\nName: ${accountName}\nBank: 54link-dev`;

    if (navigator.share && qrCodeImage) {
      // Convert base64 to blob for sharing
      const byteCharacters = atob(qrCodeImage);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const file = new File([blob], 'qr-code.png', { type: 'image/png' });

      try {
        await navigator.share({ 
          text,
          files: [file]
        });
      } catch {
        // Fallback to text only
        await navigator.share({ text });
      }
    } else {
      copyToClipboard(text);
      alert("Details copied to clipboard!");
    }
  };

  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mt-4 dark:text-white">Generate Payment QR Code</h2>
      <p className="text-gray-600 dark:text-gray-400 mt-1">Create a QR code for payment requests</p>

      {/* Payment Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 mt-6 w-full">
        <div className="space-y-4">
          {/* Recipient Information */}
          <div className="bg-blue-50 dark:bg-[var(--primary-color)]/20 border border-[var(--primary-color)] dark:border-[var(--primary-color)] rounded-xl p-4 mb-2">
            <label className="block text-sm font-semibold text-[var(--primary-color)] dark:text-[var(--primary-color)] mb-2">
              Payment Recipient
            </label>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--primary-color)] dark:text-[var(--primary-color)]">Name:</span>
                <span className="text-sm font-semibold text-[var(--primary-color)] dark:text-[var(--primary-color)]">{accountName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--primary-color)] dark:text-[var(--primary-color)]">Account Number:</span>
                <span className="text-sm font-mono font-semibold text-[var(--primary-color)] dark:text-[var(--primary-color)]">{accountNumber}</span>
              </div>
              {accountId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--primary-color)] dark:text-[var(--primary-color)]">Account ID:</span>
                  <span className="text-sm font-mono font-semibold text-[var(--primary-color)] dark:text-[var(--primary-color)]">{accountId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Amount *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] dark:bg-gray-700 dark:text-white"
              min="0"
              step="0.01"
            />
          </div>

          {/* Currency Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Currency *
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] dark:bg-gray-700 dark:text-white"
            >
              <option value="NGN">NGN - Nigerian Naira</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Note (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for this payment..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] dark:bg-gray-700 dark:text-white resize-none"
              rows={2}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Account ID Warning */}
          {!accountId && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-xl text-sm">
              Account ID is loading. Please wait a moment before generating QR code.
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateQRCode}
            disabled={isGenerating || !accountId}
            className="w-full bg-[var(--primary-color)] hover:bg-[var(--primary-color)] disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition"
          >
            {isGenerating ? "Generating..." : "Generate QR Code"}
          </button>
        </div>
      </div>

      {/* Generated QR Code Display */}
      {qrCodeImage && qrCodeData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 mt-6 w-full">
          <h3 className="text-xl font-bold text-center dark:text-white mb-4">Your Payment QR Code</h3>

          {/* QR Card with gradient border */}
          <div className="p-4 bg-linear-to-br from-blue-500 to-purple-500 rounded-xl">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center" ref={qrRef}>
              <img 
                src={`data:image/png;base64,${qrCodeImage}`}
                alt="Payment QR Code"
                className="w-[200px] h-[200px]"
              />
            </div>
          </div>

          {/* Payment Details */}
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Amount:</span>
              <span className="font-bold text-lg dark:text-white">{qrCodeData.currency || currency} {qrCodeData.amount || amount}</span>
            </div>

            {qrCodeData.note && (
              <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Note:</span>
                <span className="text-gray-800 dark:text-gray-200 text-right max-w-[60%]">{qrCodeData.note}</span>
              </div>
            )}

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Recipient Name:</span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">{accountName}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Account Number:</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-800 dark:text-gray-200 font-mono">{accountNumber}</span>
                <button
                  onClick={() => copyToClipboard(accountNumber)}
                  className="text-[var(--primary-color)] dark:text-[var(--primary-color)] hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)]"
                  title="Copy account number"
                >
                  <FiCopy size={16} />
                </button>
              </div>
            </div>

            {qrCodeData.recipient && (
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Account ID (Recipient):</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-800 dark:text-gray-200 font-mono text-sm">{qrCodeData.recipient}</span>
                  <button
                    onClick={() => copyToClipboard(qrCodeData.recipient)}
                    className="text-[var(--primary-color)] dark:text-[var(--primary-color)] hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)]"
                    title="Copy account ID"
                  >
                    <FiCopy size={16} />
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              className="flex-1 border border-[var(--primary-color)] text-[var(--primary-color)] dark:border-[var(--primary-color)] dark:text-[var(--primary-color)] font-semibold py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-[var(--primary-color)]/20 transition"
              onClick={downloadQR}
            >
              Save QR
            </button>

            <button
              className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white font-semibold py-3 rounded-xl transition"
              onClick={shareDetails}
            >
              <FiShare2 className="inline mr-2" />
              Share
            </button>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-[var(--primary-color)]/20 border border-[var(--primary-color)] dark:border-[var(--primary-color)] mt-4 p-4 rounded-xl text-[var(--primary-color)] dark:text-[var(--primary-color)] text-sm">
            <p className="font-semibold mb-1">⚡ Payment Request Generated</p>
            <p>Share this QR code with the payer. They can scan it to complete the payment.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Scan Tab ------------------------------ */

function ScanQRTab() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [qrDetected, setQrDetected] = useState(false);
  const [qrLocation, setQrLocation] = useState<{
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  } | null>(null);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    data?: {
      recipient?: string;
      amount?: string;
      currency?: string;
      [key: string]: unknown;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsedQRData, setParsedQRData] = useState<{
    recipient: string;
    amount: string;
    currency: string;
    note?: string;
    expiry?: string;
    signature?: string;
    tenant?: string;
    ledger?: number;
  } | null>(null);

  const parseQRCode = (qrString: string) => {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(qrString);
      
      // Validate required fields
      if (!parsed.recipient || !parsed.amount || !parsed.currency) {
        throw new Error("Invalid QR code format: missing required fields");
      }

      return parsed;
    } catch {
      throw new Error("Invalid QR code format. Please scan a valid payment QR code.");
    }
  };

  const processQRData = async (qrDataString: string) => {
    setIsValidating(true);
    setError(null);
    setValidationResult(null);

    try {
      // Parse the QR code data
      const qrData = parseQRCode(qrDataString);
      setParsedQRData(qrData);

      // Validate with API
      const result = await paymentService.validateQR(qrData);

      setValidationResult(result);

      if (result.success) {
        // Navigate to transfer screen with pre-filled data
        setTimeout(() => {
          navigate('/transfer', {
            state: {
              recipientAccountId: qrData.recipient,
              amount: qrData.amount,
              note: qrData.note || '',
            },
          });
        }, 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to validate QR code");
    } finally {
      setIsValidating(false);
    }
  };

  const decodeQRFromImage = (image: HTMLImageElement | HTMLVideoElement | ImageBitmap) => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Set canvas size to match image
    canvas.width = image.width;
    canvas.height = image.height;

    // Draw image on canvas
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Decode QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    return code;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setValidationResult(null);
    setParsedQRData(null);
    setIsValidating(true);

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setError("Please upload an image file");
      setIsValidating(false);
      return;
    }

    try {
      // Create image element
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        // Decode QR code from image
        const code = decodeQRFromImage(img);
        
        if (code && code.data) {
          setScannedImage(objectUrl);
          // Process the QR code data
          processQRData(code.data);
        } else {
          setError("No QR code found in the image. Please try another image.");
          setIsValidating(false);
        }
        
        URL.revokeObjectURL(objectUrl);
      };

      img.onerror = () => {
        setError("Failed to load image. Please try another file.");
        setIsValidating(false);
        URL.revokeObjectURL(objectUrl);
      };

      img.src = objectUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process image");
      setIsValidating(false);
    }
  };

  const startCameraScan = async () => {
    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // For iOS
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to access camera. Please check permissions.");
    }
  };

  const stopCameraScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setQrDetected(false);
    setQrLocation(null);
  };

  React.useEffect(() => {
    if (!isScanning || !videoRef.current) return;

    let animationFrameId: number;
    let lastDetectionTime = 0;
    
    const scanLoop = () => {
      if (!videoRef.current || !isScanning) return;

      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const code = decodeQRFromImage(videoRef.current);
        
        if (code && code.data) {
          // Show detected state
          setQrDetected(true);
          
          // Calculate QR code location relative to video element
          if (videoRef.current && code.location) {
            const videoRect = videoRef.current.getBoundingClientRect();
            const scaleX = videoRect.width / videoRef.current.videoWidth;
            const scaleY = videoRect.height / videoRef.current.videoHeight;
            
            setQrLocation({
              topLeft: {
                x: code.location.topLeftCorner.x * scaleX,
                y: code.location.topLeftCorner.y * scaleY,
              },
              topRight: {
                x: code.location.topRightCorner.x * scaleX,
                y: code.location.topRightCorner.y * scaleY,
              },
              bottomLeft: {
                x: code.location.bottomLeftCorner.x * scaleX,
                y: code.location.bottomLeftCorner.y * scaleY,
              },
              bottomRight: {
                x: code.location.bottomRightCorner.x * scaleX,
                y: code.location.bottomRightCorner.y * scaleY,
              },
            });
          }
          
          // Wait a bit before processing to show feedback
          const now = Date.now();
          if (now - lastDetectionTime > 500) { // Process after 500ms of stable detection
            lastDetectionTime = now;
            setTimeout(() => {
              stopCameraScan();
              processQRData(code.data).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Failed to process QR code");
              });
            }, 300);
          } else {
            animationFrameId = requestAnimationFrame(scanLoop);
          }
        } else {
          setQrDetected(false);
          setQrLocation(null);
          animationFrameId = requestAnimationFrame(scanLoop);
        }
      } else {
        animationFrameId = requestAnimationFrame(scanLoop);
      }
    };

    animationFrameId = requestAnimationFrame(scanLoop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setQrDetected(false);
      setQrLocation(null);
      stopCameraScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  return (
    <div className="flex flex-col items-center mt-10 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold dark:text-white mb-2">Scan Payment QR Code</h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Scan QR code from image or use camera to pay</p>

      {/* Hidden canvas for QR code processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* CSS Animation for scanning line */}
      <style>{`
        @keyframes scanLine {
          0% { transform: translateY(-50%); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(50%); opacity: 0.3; }
        }
      `}</style>

      {/* Camera View */}
      {isScanning && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 w-full mb-6">
          <div className="relative bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-auto max-h-[500px] object-cover"
              autoPlay
              playsInline
              muted
            />
            
            {/* Scanning Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Scanning Frame */}
              <div className={`relative w-64 h-64 transition-all duration-300 ${
                qrDetected 
                  ? 'border-4 border-green-500 shadow-lg shadow-green-500/50' 
                  : 'border-4 border-[var(--primary-color)]'
              } rounded-xl`}>
                {/* Corner markers */}
                <div className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 ${
                  qrDetected ? 'border-green-500' : 'border-[var(--primary-color)]'
                } rounded-tl-lg`}></div>
                <div className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 ${
                  qrDetected ? 'border-green-500' : 'border-[var(--primary-color)]'
                } rounded-tr-lg`}></div>
                <div className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 ${
                  qrDetected ? 'border-green-500' : 'border-[var(--primary-color)]'
                } rounded-bl-lg`}></div>
                <div className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 ${
                  qrDetected ? 'border-green-500' : 'border-[var(--primary-color)]'
                } rounded-br-lg`}></div>
                
                {/* Scanning line animation */}
                {!qrDetected && (
                  <div className="absolute inset-0 overflow-hidden rounded-xl">
                    <div 
                      className="absolute left-0 right-0 h-0.5 bg-[var(--primary-color)]" 
                      style={{
                        top: '50%',
                        transform: 'translateY(-50%)',
                        animation: 'scanLine 2s linear infinite',
                      }}
                    ></div>
                  </div>
                )}
              </div>
              
              {/* QR Code Detection Highlight */}
              {qrLocation && qrDetected && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <polygon
                    points={`${qrLocation.topLeft.x},${qrLocation.topLeft.y} ${qrLocation.topRight.x},${qrLocation.topRight.y} ${qrLocation.bottomRight.x},${qrLocation.bottomRight.y} ${qrLocation.bottomLeft.x},${qrLocation.bottomLeft.y}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    className="animate-pulse"
                  />
                  {/* Corner highlights */}
                  <circle cx={qrLocation.topLeft.x} cy={qrLocation.topLeft.y} r="8" fill="#10b981" className="animate-pulse" />
                  <circle cx={qrLocation.topRight.x} cy={qrLocation.topRight.y} r="8" fill="#10b981" className="animate-pulse" />
                  <circle cx={qrLocation.bottomLeft.x} cy={qrLocation.bottomLeft.y} r="8" fill="#10b981" className="animate-pulse" />
                  <circle cx={qrLocation.bottomRight.x} cy={qrLocation.bottomRight.y} r="8" fill="#10b981" className="animate-pulse" />
                </svg>
              )}
            </div>
            
            {/* Darkened overlay outside scanning area */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-64 h-64 bg-transparent"></div>
              </div>
            </div>
            
            {/* Status indicator */}
            <div className={`absolute top-4 left-4 px-4 py-2 rounded-lg font-semibold text-sm ${
              qrDetected 
                ? 'bg-green-500 text-white' 
                : 'bg-[var(--primary-color)]/80 text-white'
            } transition-all duration-300`}>
              {qrDetected ? '✓ QR Code Detected!' : 'Scanning...'}
            </div>
            
            <button
              onClick={stopCameraScan}
              className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold z-10"
            >
              Stop
            </button>
          </div>
          <p className={`text-center mt-4 font-semibold transition-colors ${
            qrDetected 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-gray-600 dark:text-gray-400'
          }`}>
            {qrDetected 
              ? 'QR Code detected! Processing...' 
              : 'Position the QR code within the frame'}
          </p>
        </div>
      )}

      {/* Scanned Image Preview */}
      {scannedImage && !isScanning && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 w-full mb-6">
          <h3 className="font-semibold dark:text-white mb-2">Scanned QR Code</h3>
          <img 
            src={scannedImage} 
            alt="Scanned QR Code" 
            className="w-full max-w-xs mx-auto rounded-xl"
          />
        </div>
      )}

      {/* Action Buttons */}
      {!isScanning && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 w-full mb-6">
          <div className="space-y-4">
            <button
              onClick={startCameraScan}
              className="w-full bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <FiCamera size={20} />
              Scan with Camera
            </button>

            <label className="w-full border-2 border-[var(--primary-color)] text-[var(--primary-color)] dark:border-[var(--primary-color)] dark:text-[var(--primary-color)] font-semibold py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-[var(--primary-color)]/20 transition flex items-center justify-center gap-2 cursor-pointer">
              <FiUpload size={20} />
              Upload QR Code Image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* QR Code Input (Manual Entry) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 w-full">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Or Paste QR Code Data Manually
            </label>
            <textarea
              placeholder='Paste QR code JSON here, e.g., {"recipient":"35","amount":"100","currency":"NGN","note":"test qr",...}'
              onChange={(e) => {
                const value = e.target.value.trim();
                if (value) {
                  processQRData(value);
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
              rows={4}
            />
          </div>

          {isValidating && (
            <div className="bg-blue-50 dark:bg-[var(--primary-color)]/20 border border-[var(--primary-color)] dark:border-[var(--primary-color)] text-[var(--primary-color)] dark:text-[var(--primary-color)] px-4 py-3 rounded-xl text-sm">
              Validating QR code...
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {validationResult && (
            <div className={`${
              validationResult.success 
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
            } border px-4 py-3 rounded-xl text-sm`}>
              <p className="font-semibold">{validationResult.success ? "✓ Valid QR Code" : "✗ Validation Failed"}</p>
              <p className="mt-1">{validationResult.message}</p>
            </div>
          )}

          {parsedQRData && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-2">
              <p className="font-semibold text-gray-900 dark:text-white mb-2">QR Code Details:</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Recipient:</span>
                <span className="text-gray-900 dark:text-white font-mono">{parsedQRData.recipient}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                <span className="text-gray-900 dark:text-white font-bold">{parsedQRData.currency} {parsedQRData.amount}</span>
              </div>
              {parsedQRData.note && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Note:</span>
                  <span className="text-gray-900 dark:text-white">{parsedQRData.note}</span>
                </div>
              )}
              {parsedQRData.expiry && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Expires:</span>
                  <span className="text-gray-900 dark:text-white text-xs">
                    {new Date(parsedQRData.expiry).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Upload from File */}
      <label className="mt-6 text-[var(--primary-color)] dark:text-[var(--primary-color)] flex items-center gap-2 cursor-pointer hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)] transition">
        <FiUpload size={20} />
        <span className="font-semibold">Upload QR Code File (JSON)</span>
        <input
          type="file"
          accept=".json,text/plain,image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-[var(--primary-color)]/20 border border-[var(--primary-color)] dark:border-[var(--primary-color)] mt-6 p-4 rounded-xl text-[var(--primary-color)] dark:text-[var(--primary-color)] text-sm w-full">
        <p className="font-semibold mb-1">📱 How to use:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Scan a payment QR code using a QR scanner app</li>
          <li>Copy the JSON data from the scanned QR code</li>
          <li>Paste it in the input field above</li>
          <li>Click "Validate QR Code" to verify and proceed to payment</li>
        </ol>
      </div>
    </div>
  );
}
