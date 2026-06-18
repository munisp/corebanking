import { FiCheckCircle } from 'react-icons/fi';

interface SuccessScreenProps {
  title: string;
  message: string;
  onContinue: () => void;
  buttonText?: string;
}

const SuccessScreen = ({ title, message, onContinue, buttonText = 'Continue' }: SuccessScreenProps) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="text-center">
          {/* Success Icon with Animation */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full mb-6 animate-bounce">
            <FiCheckCircle size={56} className="text-green-600" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{title}</h2>

          {/* Message */}
          <p className="text-gray-600 dark:text-gray-400 mb-8">{message}</p>

          {/* Button */}
          <button
            onClick={onContinue}
            className="w-full bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white py-3 rounded-xl font-semibold transition-colors shadow-lg"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessScreen;
