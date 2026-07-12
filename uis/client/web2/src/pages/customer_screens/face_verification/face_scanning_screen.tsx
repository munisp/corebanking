import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FaceScanningScreen = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const startScan = () => {
    setScanning(true);
    // Simulate scanning progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            navigate('/face-verification-success');
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden">
      <div className="max-w-md mx-auto h-screen flex flex-col">
        {/* Header */}
        <div className="p-4 relative z-10">
          <button onClick={() => navigate(-1)} className="text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Scanning Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="relative">
            {/* Face Frame */}
            <div className="w-72 h-96 relative">
              {/* Scanning overlay */}
              <div className="absolute inset-0 border-4 border-[var(--primary-color)] rounded-full opacity-50"></div>
              
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-white rounded-tl-3xl"></div>
              <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white rounded-tr-3xl"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white rounded-bl-3xl"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-white rounded-br-3xl"></div>

              {/* Face icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-32 h-32 text-white opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              {/* Scanning line */}
              {scanning && (
                <div 
                  className="absolute left-0 right-0 h-1 bg-[var(--primary-color)] transition-all duration-300"
                  style={{ top: `${progress}%` }}
                ></div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 text-center">
            <h2 className="text-white text-xl font-semibold mb-2">
              {scanning ? 'Scanning...' : 'Position Your Face'}
            </h2>
            <p className="text-gray-300 text-sm">
              {scanning 
                ? `Processing: ${progress}%`
                : 'Make sure your face is clearly visible within the frame'
              }
            </p>
          </div>

          {/* Progress Bar */}
          {scanning && (
            <div className="w-full max-w-xs mt-6">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--primary-color)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="p-6 relative z-10">
          {!scanning && (
            <button
              onClick={startScan}
              className="w-full btn-primary py-4 rounded-xl font-semibold shadow-lg"
            >
              Start Scanning
            </button>
          )}
        </div>

        {/* Tips */}
        <div className="p-4 pb-8 space-y-2 relative z-10">
          <p className="text-gray-400 text-xs text-center">Tips:</p>
          <div className="flex items-center justify-center gap-4 text-gray-400 text-xs">
            <span>💡 Good lighting</span>
            <span>👓 Remove glasses</span>
            <span>😊 Neutral expression</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceScanningScreen;
