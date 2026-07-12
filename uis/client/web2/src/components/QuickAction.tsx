interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

export const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center p-4 rounded-xl bg-white dark:bg-gray-800 shadow hover:shadow-md transition ${color}`}
    >
      <div className="p-3 rounded-lg mb-2 bg-opacity-20 dark:bg-opacity-30 flex items-center justify-center">{icon}</div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
    </button>
  );
};