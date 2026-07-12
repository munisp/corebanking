"""
54link-dev Transaction Categorization Model
Automatic categorization of transactions using ML and rule-based approaches

Features:
- Merchant name recognition
- Category inference from transaction patterns
- Custom category learning
- Spending insights generation
"""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class TransactionCategory(Enum):
    # Income
    SALARY = "salary"
    FREELANCE = "freelance"
    INVESTMENT_INCOME = "investment_income"
    REFUND = "refund"
    GIFT_RECEIVED = "gift_received"
    OTHER_INCOME = "other_income"
    
    # Essential Expenses
    RENT = "rent"
    UTILITIES = "utilities"
    GROCERIES = "groceries"
    HEALTHCARE = "healthcare"
    INSURANCE = "insurance"
    EDUCATION = "education"
    
    # Transportation
    FUEL = "fuel"
    PUBLIC_TRANSPORT = "public_transport"
    RIDE_HAILING = "ride_hailing"
    VEHICLE_MAINTENANCE = "vehicle_maintenance"
    
    # Food & Dining
    RESTAURANTS = "restaurants"
    FAST_FOOD = "fast_food"
    FOOD_DELIVERY = "food_delivery"
    COFFEE_SHOPS = "coffee_shops"
    
    # Shopping
    CLOTHING = "clothing"
    ELECTRONICS = "electronics"
    HOME_GOODS = "home_goods"
    PERSONAL_CARE = "personal_care"
    ONLINE_SHOPPING = "online_shopping"
    
    # Entertainment
    STREAMING = "streaming"
    GAMING = "gaming"
    MOVIES = "movies"
    EVENTS = "events"
    SPORTS = "sports"
    
    # Bills & Subscriptions
    PHONE_BILL = "phone_bill"
    INTERNET = "internet"
    CABLE_TV = "cable_tv"
    SUBSCRIPTIONS = "subscriptions"
    
    # Financial
    TRANSFER_OUT = "transfer_out"
    TRANSFER_IN = "transfer_in"
    LOAN_PAYMENT = "loan_payment"
    SAVINGS = "savings"
    INVESTMENT = "investment"
    FEES = "fees"
    ATM_WITHDRAWAL = "atm_withdrawal"
    
    # Other
    CHARITY = "charity"
    GIFTS = "gifts"
    TRAVEL = "travel"
    UNCATEGORIZED = "uncategorized"


@dataclass
class CategorizedTransaction:
    transaction_id: str
    category: TransactionCategory
    subcategory: Optional[str]
    confidence: float
    merchant_name: str
    normalized_merchant: str
    is_recurring: bool
    tags: List[str]


class TransactionCategorizationModel:
    """
    Transaction categorization using:
    1. Merchant name matching (rule-based)
    2. Pattern recognition
    3. User feedback learning
    """

    def __init__(self):
        # Merchant patterns for categorization
        self.merchant_patterns = self._build_merchant_patterns()
        
        # Amount-based hints
        self.amount_hints = {
            (50000, 500000): [TransactionCategory.RENT, TransactionCategory.SALARY],
            (10000, 50000): [TransactionCategory.UTILITIES, TransactionCategory.GROCERIES],
            (1000, 10000): [TransactionCategory.RESTAURANTS, TransactionCategory.FUEL],
        }
        
        # Recurring transaction detection
        self.user_recurring: Dict[str, List[Dict]] = {}
        
        # User category overrides
        self.user_overrides: Dict[str, Dict[str, TransactionCategory]] = {}
        
        # Merchant normalization cache
        self.merchant_cache: Dict[str, str] = {}

    def _build_merchant_patterns(self) -> Dict[TransactionCategory, List[str]]:
        """Build regex patterns for merchant matching"""
        return {
            # Income
            TransactionCategory.SALARY: [
                r'salary', r'payroll', r'wage', r'stipend', r'pension',
            ],
            TransactionCategory.FREELANCE: [
                r'upwork', r'fiverr', r'freelanc', r'contract\s*pay',
            ],
            
            # Utilities
            TransactionCategory.UTILITIES: [
                r'ekedc', r'ikedc', r'aedc', r'phed', r'nepa', r'electric',
                r'phcn', r'disco', r'power', r'water\s*board', r'lawma',
            ],
            TransactionCategory.PHONE_BILL: [
                r'mtn', r'airtel', r'glo', r'9mobile', r'etisalat', r'airtime',
                r'data\s*bundle', r'recharge',
            ],
            TransactionCategory.INTERNET: [
                r'spectranet', r'smile', r'swift', r'ipnx', r'cobranet',
                r'internet', r'wifi', r'broadband',
            ],
            TransactionCategory.CABLE_TV: [
                r'dstv', r'gotv', r'startimes', r'showmax', r'multichoice',
            ],
            
            # Streaming
            TransactionCategory.STREAMING: [
                r'netflix', r'spotify', r'apple\s*music', r'youtube\s*premium',
                r'amazon\s*prime', r'disney', r'hbo', r'hulu',
            ],
            
            # Food & Dining
            TransactionCategory.RESTAURANTS: [
                r'restaurant', r'eatery', r'kitchen', r'grill', r'bistro',
                r'cafe', r'diner', r'suya', r'amala', r'buka',
            ],
            TransactionCategory.FAST_FOOD: [
                r'chicken\s*republic', r'kfc', r'domino', r'pizza\s*hut',
                r'burger\s*king', r'mcdonald', r'tantalizer', r'mr\s*bigg',
            ],
            TransactionCategory.FOOD_DELIVERY: [
                r'jumia\s*food', r'chowdeck', r'glovo', r'bolt\s*food',
                r'uber\s*eats', r'food\s*delivery',
            ],
            TransactionCategory.COFFEE_SHOPS: [
                r'starbucks', r'coffee', r'cafe\s*neo', r'artcaffe',
            ],
            
            # Transportation
            TransactionCategory.FUEL: [
                r'total', r'mobil', r'oando', r'conoil', r'ardova', r'nnpc',
                r'petrol', r'filling\s*station', r'fuel', r'gas\s*station',
            ],
            TransactionCategory.RIDE_HAILING: [
                r'uber', r'bolt', r'taxify', r'indrive', r'rida',
            ],
            TransactionCategory.PUBLIC_TRANSPORT: [
                r'bus', r'brt', r'metro', r'train', r'ferry',
            ],
            
            # Shopping
            TransactionCategory.GROCERIES: [
                r'shoprite', r'spar', r'justrite', r'market\s*square',
                r'hubmart', r'grocery', r'supermarket', r'foodco',
            ],
            TransactionCategory.ONLINE_SHOPPING: [
                r'jumia', r'konga', r'jiji', r'amazon', r'aliexpress',
                r'paypal', r'ebay', r'alibaba',
            ],
            TransactionCategory.CLOTHING: [
                r'zara', r'h&m', r'primark', r'fashion', r'boutique',
                r'clothing', r'apparel', r'wear',
            ],
            TransactionCategory.ELECTRONICS: [
                r'slot', r'pointek', r'3c\s*hub', r'computer\s*village',
                r'apple\s*store', r'samsung', r'lg\s*store',
            ],
            
            # Healthcare
            TransactionCategory.HEALTHCARE: [
                r'hospital', r'clinic', r'pharmacy', r'medplus', r'healthplus',
                r'doctor', r'medical', r'dental', r'optician', r'lab',
            ],
            
            # Education
            TransactionCategory.EDUCATION: [
                r'school', r'university', r'college', r'tuition', r'course',
                r'udemy', r'coursera', r'skillshare', r'masterclass',
            ],
            
            # Financial
            TransactionCategory.ATM_WITHDRAWAL: [
                r'atm', r'cash\s*withdrawal', r'pos\s*withdrawal',
            ],
            TransactionCategory.FEES: [
                r'charge', r'fee', r'commission', r'vat', r'stamp\s*duty',
            ],
            TransactionCategory.LOAN_PAYMENT: [
                r'loan\s*repay', r'emi', r'installment', r'credit\s*pay',
            ],
            
            # Entertainment
            TransactionCategory.GAMING: [
                r'playstation', r'xbox', r'steam', r'epic\s*games',
                r'bet9ja', r'sportybet', r'betway', r'1xbet', r'nairabet',
            ],
            TransactionCategory.MOVIES: [
                r'cinema', r'filmhouse', r'genesis\s*cinema', r'silverbird',
            ],
            
            # Travel
            TransactionCategory.TRAVEL: [
                r'hotel', r'airbnb', r'booking\.com', r'flight', r'airline',
                r'wakanow', r'travelstart', r'kiwi', r'expedia',
            ],
            
            # Insurance
            TransactionCategory.INSURANCE: [
                r'insurance', r'axa', r'leadway', r'aiico', r'custodian',
                r'nhis', r'hmo',
            ],
        }

    def categorize(self, 
                   transaction_id: str,
                   user_id: str,
                   merchant_name: str,
                   amount: float,
                   transaction_type: str,  # credit, debit
                   narration: str = "",
                   timestamp: datetime = None) -> CategorizedTransaction:
        """
        Categorize a single transaction
        """
        # Normalize merchant name
        normalized_merchant = self._normalize_merchant(merchant_name)
        
        # Check user overrides first
        if user_id in self.user_overrides:
            if normalized_merchant in self.user_overrides[user_id]:
                category = self.user_overrides[user_id][normalized_merchant]
                return CategorizedTransaction(
                    transaction_id=transaction_id,
                    category=category,
                    subcategory=None,
                    confidence=1.0,
                    merchant_name=merchant_name,
                    normalized_merchant=normalized_merchant,
                    is_recurring=self._is_recurring(user_id, normalized_merchant, amount),
                    tags=self._generate_tags(category, amount, transaction_type),
                )
        
        # Pattern matching
        category, confidence = self._match_patterns(normalized_merchant, narration)
        
        # If no match, try amount-based hints
        if category == TransactionCategory.UNCATEGORIZED:
            category, confidence = self._infer_from_amount(amount, transaction_type)
        
        # Check if it's a transfer
        if category == TransactionCategory.UNCATEGORIZED:
            if transaction_type == 'credit':
                category = TransactionCategory.TRANSFER_IN
                confidence = 0.6
            elif transaction_type == 'debit':
                category = TransactionCategory.TRANSFER_OUT
                confidence = 0.6
        
        # Check for recurring
        is_recurring = self._is_recurring(user_id, normalized_merchant, amount)
        
        # Generate tags
        tags = self._generate_tags(category, amount, transaction_type)
        
        return CategorizedTransaction(
            transaction_id=transaction_id,
            category=category,
            subcategory=None,
            confidence=confidence,
            merchant_name=merchant_name,
            normalized_merchant=normalized_merchant,
            is_recurring=is_recurring,
            tags=tags,
        )

    def _normalize_merchant(self, merchant_name: str) -> str:
        """Normalize merchant name for matching"""
        if merchant_name in self.merchant_cache:
            return self.merchant_cache[merchant_name]
        
        # Lowercase and remove special characters
        normalized = merchant_name.lower()
        normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        # Remove common suffixes
        suffixes = ['limited', 'ltd', 'plc', 'inc', 'llc', 'nigeria', 'ng']
        for suffix in suffixes:
            normalized = re.sub(rf'\b{suffix}\b', '', normalized).strip()
        
        self.merchant_cache[merchant_name] = normalized
        return normalized

    def _match_patterns(self, merchant: str, narration: str) -> Tuple[TransactionCategory, float]:
        """Match merchant against patterns"""
        combined_text = f"{merchant} {narration}".lower()
        
        best_match = TransactionCategory.UNCATEGORIZED
        best_confidence = 0.0
        
        for category, patterns in self.merchant_patterns.items():
            for pattern in patterns:
                if re.search(pattern, combined_text):
                    # Calculate confidence based on match quality
                    confidence = 0.9 if re.search(rf'\b{pattern}\b', combined_text) else 0.7
                    if confidence > best_confidence:
                        best_match = category
                        best_confidence = confidence
        
        return best_match, best_confidence

    def _infer_from_amount(self, amount: float, transaction_type: str) -> Tuple[TransactionCategory, float]:
        """Infer category from amount patterns"""
        # This is a weak signal, so low confidence
        for (min_amt, max_amt), categories in self.amount_hints.items():
            if min_amt <= amount <= max_amt:
                if transaction_type == 'credit' and TransactionCategory.SALARY in categories:
                    return TransactionCategory.SALARY, 0.3
        
        return TransactionCategory.UNCATEGORIZED, 0.0

    def _is_recurring(self, user_id: str, merchant: str, amount: float) -> bool:
        """Check if transaction appears to be recurring"""
        if user_id not in self.user_recurring:
            self.user_recurring[user_id] = []
        
        # Check for similar transactions
        similar_count = 0
        for txn in self.user_recurring[user_id]:
            if txn['merchant'] == merchant:
                # Allow 10% variance in amount
                if abs(txn['amount'] - amount) / max(amount, 1) < 0.1:
                    similar_count += 1
        
        # Add current transaction
        self.user_recurring[user_id].append({
            'merchant': merchant,
            'amount': amount,
            'timestamp': datetime.now(),
        })
        
        # Keep only last 100 transactions per user
        if len(self.user_recurring[user_id]) > 100:
            self.user_recurring[user_id] = self.user_recurring[user_id][-100:]
        
        return similar_count >= 2

    def _generate_tags(self, category: TransactionCategory, amount: float, transaction_type: str) -> List[str]:
        """Generate tags for the transaction"""
        tags = []
        
        # Category-based tags
        essential_categories = {
            TransactionCategory.RENT, TransactionCategory.UTILITIES,
            TransactionCategory.GROCERIES, TransactionCategory.HEALTHCARE,
            TransactionCategory.INSURANCE, TransactionCategory.EDUCATION,
        }
        
        discretionary_categories = {
            TransactionCategory.RESTAURANTS, TransactionCategory.FAST_FOOD,
            TransactionCategory.STREAMING, TransactionCategory.GAMING,
            TransactionCategory.MOVIES, TransactionCategory.EVENTS,
        }
        
        if category in essential_categories:
            tags.append('essential')
        elif category in discretionary_categories:
            tags.append('discretionary')
        
        # Amount-based tags
        if amount >= 100000:
            tags.append('large_transaction')
        elif amount <= 1000:
            tags.append('small_transaction')
        
        # Type-based tags
        if transaction_type == 'credit':
            tags.append('income')
        else:
            tags.append('expense')
        
        return tags

    def set_user_override(self, user_id: str, merchant: str, category: TransactionCategory):
        """Set user-specific category override"""
        if user_id not in self.user_overrides:
            self.user_overrides[user_id] = {}
        
        normalized = self._normalize_merchant(merchant)
        self.user_overrides[user_id][normalized] = category
        logger.info(f"Set override for user {user_id}: {normalized} -> {category.value}")

    def get_category_summary(self, transactions: List[CategorizedTransaction]) -> Dict:
        """Get summary of categorized transactions"""
        summary = {
            'by_category': {},
            'total_income': 0,
            'total_expenses': 0,
            'recurring_count': 0,
            'uncategorized_count': 0,
        }
        
        for txn in transactions:
            cat = txn.category.value
            if cat not in summary['by_category']:
                summary['by_category'][cat] = {
                    'count': 0,
                    'total': 0,
                }
            summary['by_category'][cat]['count'] += 1
            
            if txn.is_recurring:
                summary['recurring_count'] += 1
            
            if txn.category == TransactionCategory.UNCATEGORIZED:
                summary['uncategorized_count'] += 1
        
        return summary


# Singleton instance
_categorization_model: Optional[TransactionCategorizationModel] = None


def get_categorization_model() -> TransactionCategorizationModel:
    """Get singleton categorization model"""
    global _categorization_model
    if _categorization_model is None:
        _categorization_model = TransactionCategorizationModel()
    return _categorization_model
