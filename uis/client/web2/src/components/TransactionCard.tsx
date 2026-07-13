import { format } from 'date-fns';

interface TransactionCardProps {
  transaction: Transaction;
}

interface Transaction {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  date: Date;
  isCredit: boolean;
  status: string;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ transaction }) => {
  const { title, subtitle, amount, date, isCredit } = transaction;

  return (
    <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow dark:border dark:border-gray-700">
      <div className="flex items-center">
        <div
          className={`p-3 rounded-lg mr-3 ${isCredit ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}
        >
          {isCredit ? '↓' : '↑'}
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{amount}</p>
        <p className="text-xs text-gray-400">{format(new Date(date), 'MMM dd')}</p>
      </div>
    </div>
  );
};
