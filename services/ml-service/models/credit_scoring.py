"""
54link-dev Credit Scoring Model
Advanced credit scoring using alternative data and machine learning

Features:
- Traditional credit factors (payment history, utilization)
- Alternative data (transaction patterns, income stability)
- Behavioral scoring (app usage, savings patterns)
- Social/network scoring (optional)
"""

import numpy as np
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import math
import logging

logger = logging.getLogger(__name__)


class CreditTier(Enum):
    EXCELLENT = "excellent"  # 750-850
    GOOD = "good"  # 700-749
    FAIR = "fair"  # 650-699
    POOR = "poor"  # 550-649
    VERY_POOR = "very_poor"  # 300-549


@dataclass
class CustomerProfile:
    customer_id: str
    age: int
    employment_status: str  # employed, self_employed, unemployed, student, retired
    monthly_income: float
    account_age_months: int
    
    # Transaction data
    avg_monthly_inflow: float = 0
    avg_monthly_outflow: float = 0
    transaction_count_30d: int = 0
    unique_merchants_30d: int = 0
    
    # Account data
    current_balance: float = 0
    avg_balance_30d: float = 0
    min_balance_30d: float = 0
    overdraft_count_12m: int = 0
    
    # Loan history
    active_loans: int = 0
    total_loan_amount: float = 0
    loans_paid_on_time: int = 0
    loans_paid_late: int = 0
    loans_defaulted: int = 0
    
    # Bill payments
    bills_paid_on_time_12m: int = 0
    bills_paid_late_12m: int = 0
    bills_missed_12m: int = 0
    
    # Savings behavior
    has_savings_account: bool = False
    savings_balance: float = 0
    regular_savings: bool = False  # Consistent monthly savings
    
    # App engagement
    app_logins_30d: int = 0
    features_used: List[str] = field(default_factory=list)


@dataclass
class CreditScore:
    score: int  # 300-850
    tier: CreditTier
    factors: Dict[str, Dict]  # Factor name -> {score, weight, impact}
    recommendations: List[str]
    max_loan_amount: float
    recommended_interest_rate: float
    confidence: float


class CreditScoringModel:
    """
    Credit scoring model using multiple data sources:
    1. Payment history (35%)
    2. Credit utilization / Debt burden (30%)
    3. Account age / History length (15%)
    4. Income stability (10%)
    5. Behavioral factors (10%)
    """

    def __init__(self):
        # Score weights
        self.weights = {
            'payment_history': 0.35,
            'debt_burden': 0.30,
            'account_history': 0.15,
            'income_stability': 0.10,
            'behavioral': 0.10,
        }
        
        # Base parameters
        self.min_score = 300
        self.max_score = 850
        
        # Loan parameters
        self.base_interest_rate = 0.18  # 18% base rate
        self.min_interest_rate = 0.12  # 12% minimum
        self.max_interest_rate = 0.36  # 36% maximum
        
        # Income multipliers for max loan
        self.loan_multipliers = {
            CreditTier.EXCELLENT: 6.0,
            CreditTier.GOOD: 4.0,
            CreditTier.FAIR: 2.5,
            CreditTier.POOR: 1.5,
            CreditTier.VERY_POOR: 0.5,
        }

    def calculate_score(self, profile: CustomerProfile) -> CreditScore:
        """
        Calculate credit score for a customer
        """
        factors = {}
        
        # 1. Payment History Score (0-100)
        payment_score, payment_details = self._score_payment_history(profile)
        factors['payment_history'] = {
            'score': payment_score,
            'weight': self.weights['payment_history'],
            'impact': self._get_impact(payment_score),
            'details': payment_details,
        }
        
        # 2. Debt Burden Score (0-100)
        debt_score, debt_details = self._score_debt_burden(profile)
        factors['debt_burden'] = {
            'score': debt_score,
            'weight': self.weights['debt_burden'],
            'impact': self._get_impact(debt_score),
            'details': debt_details,
        }
        
        # 3. Account History Score (0-100)
        history_score, history_details = self._score_account_history(profile)
        factors['account_history'] = {
            'score': history_score,
            'weight': self.weights['account_history'],
            'impact': self._get_impact(history_score),
            'details': history_details,
        }
        
        # 4. Income Stability Score (0-100)
        income_score, income_details = self._score_income_stability(profile)
        factors['income_stability'] = {
            'score': income_score,
            'weight': self.weights['income_stability'],
            'impact': self._get_impact(income_score),
            'details': income_details,
        }
        
        # 5. Behavioral Score (0-100)
        behavioral_score, behavioral_details = self._score_behavioral(profile)
        factors['behavioral'] = {
            'score': behavioral_score,
            'weight': self.weights['behavioral'],
            'impact': self._get_impact(behavioral_score),
            'details': behavioral_details,
        }
        
        # Calculate weighted score (0-100)
        weighted_score = sum(
            factors[key]['score'] * factors[key]['weight']
            for key in factors
        )
        
        # Convert to 300-850 scale
        final_score = int(self.min_score + (weighted_score / 100) * (self.max_score - self.min_score))
        final_score = max(self.min_score, min(self.max_score, final_score))
        
        # Determine tier
        tier = self._get_tier(final_score)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(factors, profile)
        
        # Calculate loan parameters
        max_loan = self._calculate_max_loan(profile, tier)
        interest_rate = self._calculate_interest_rate(final_score)
        
        # Calculate confidence
        confidence = self._calculate_confidence(profile)
        
        return CreditScore(
            score=final_score,
            tier=tier,
            factors=factors,
            recommendations=recommendations,
            max_loan_amount=max_loan,
            recommended_interest_rate=interest_rate,
            confidence=confidence,
        )

    def _score_payment_history(self, profile: CustomerProfile) -> Tuple[float, Dict]:
        """Score based on payment history"""
        score = 100.0
        details = {}
        
        # Loan payment history
        total_loans = profile.loans_paid_on_time + profile.loans_paid_late + profile.loans_defaulted
        if total_loans > 0:
            on_time_ratio = profile.loans_paid_on_time / total_loans
            details['loan_on_time_ratio'] = on_time_ratio
            
            # Defaults are heavily penalized
            if profile.loans_defaulted > 0:
                score -= 40 * min(profile.loans_defaulted, 3)
            
            # Late payments
            if profile.loans_paid_late > 0:
                score -= 10 * min(profile.loans_paid_late, 5)
        else:
            # No loan history - neutral
            score = 70
            details['no_loan_history'] = True
        
        # Bill payment history
        total_bills = profile.bills_paid_on_time_12m + profile.bills_paid_late_12m + profile.bills_missed_12m
        if total_bills > 0:
            bill_on_time_ratio = profile.bills_paid_on_time_12m / total_bills
            details['bill_on_time_ratio'] = bill_on_time_ratio
            
            if profile.bills_missed_12m > 0:
                score -= 5 * min(profile.bills_missed_12m, 6)
            
            if profile.bills_paid_late_12m > 0:
                score -= 2 * min(profile.bills_paid_late_12m, 10)
        
        # Overdrafts
        if profile.overdraft_count_12m > 0:
            score -= 5 * min(profile.overdraft_count_12m, 6)
            details['overdraft_count'] = profile.overdraft_count_12m
        
        return max(0, min(100, score)), details

    def _score_debt_burden(self, profile: CustomerProfile) -> Tuple[float, Dict]:
        """Score based on debt-to-income ratio"""
        score = 100.0
        details = {}
        
        if profile.monthly_income <= 0:
            return 50, {'no_income_data': True}
        
        # Calculate debt-to-income ratio
        monthly_debt = profile.total_loan_amount / 12 if profile.active_loans > 0 else 0
        dti_ratio = monthly_debt / profile.monthly_income
        details['dti_ratio'] = dti_ratio
        
        # Score based on DTI
        if dti_ratio <= 0.1:
            score = 100
        elif dti_ratio <= 0.2:
            score = 90
        elif dti_ratio <= 0.3:
            score = 80
        elif dti_ratio <= 0.4:
            score = 65
        elif dti_ratio <= 0.5:
            score = 50
        else:
            score = max(20, 50 - (dti_ratio - 0.5) * 100)
        
        # Bonus for savings
        if profile.savings_balance > 0:
            savings_ratio = profile.savings_balance / profile.monthly_income
            details['savings_ratio'] = savings_ratio
            if savings_ratio >= 3:
                score += 10
            elif savings_ratio >= 1:
                score += 5
        
        # Balance health
        if profile.avg_balance_30d > 0:
            balance_ratio = profile.avg_balance_30d / profile.monthly_income
            details['balance_ratio'] = balance_ratio
            if balance_ratio >= 0.5:
                score += 5
            elif profile.min_balance_30d < 0:
                score -= 10
        
        return max(0, min(100, score)), details

    def _score_account_history(self, profile: CustomerProfile) -> Tuple[float, Dict]:
        """Score based on account age and history"""
        score = 50.0  # Base score for new accounts
        details = {}
        
        # Account age scoring
        age_months = profile.account_age_months
        details['account_age_months'] = age_months
        
        if age_months >= 60:  # 5+ years
            score = 100
        elif age_months >= 36:  # 3+ years
            score = 90
        elif age_months >= 24:  # 2+ years
            score = 80
        elif age_months >= 12:  # 1+ year
            score = 70
        elif age_months >= 6:  # 6+ months
            score = 60
        else:
            score = 50
        
        # Transaction activity bonus
        if profile.transaction_count_30d >= 30:
            score += 5
            details['active_account'] = True
        
        # Merchant diversity bonus
        if profile.unique_merchants_30d >= 10:
            score += 5
            details['diverse_spending'] = True
        
        return max(0, min(100, score)), details

    def _score_income_stability(self, profile: CustomerProfile) -> Tuple[float, Dict]:
        """Score based on income stability"""
        score = 50.0
        details = {}
        
        # Employment status
        employment_scores = {
            'employed': 90,
            'self_employed': 75,
            'retired': 70,
            'student': 50,
            'unemployed': 30,
        }
        score = employment_scores.get(profile.employment_status, 50)
        details['employment_status'] = profile.employment_status
        
        # Income level adjustment
        if profile.monthly_income > 0:
            details['monthly_income'] = profile.monthly_income
            
            # Higher income = slight bonus
            if profile.monthly_income >= 500000:
                score += 10
            elif profile.monthly_income >= 200000:
                score += 5
            elif profile.monthly_income < 50000:
                score -= 10
        
        # Income consistency (inflow vs stated income)
        if profile.avg_monthly_inflow > 0 and profile.monthly_income > 0:
            income_ratio = profile.avg_monthly_inflow / profile.monthly_income
            details['income_verification_ratio'] = income_ratio
            
            if income_ratio >= 0.9:
                score += 10  # Income verified
            elif income_ratio < 0.5:
                score -= 15  # Income may be overstated
        
        return max(0, min(100, score)), details

    def _score_behavioral(self, profile: CustomerProfile) -> Tuple[float, Dict]:
        """Score based on behavioral factors"""
        score = 50.0
        details = {}
        
        # App engagement
        if profile.app_logins_30d >= 20:
            score += 15
            details['high_engagement'] = True
        elif profile.app_logins_30d >= 10:
            score += 10
        elif profile.app_logins_30d >= 5:
            score += 5
        
        # Feature usage
        valuable_features = {'savings', 'investments', 'budgeting', 'goals'}
        used_valuable = set(profile.features_used) & valuable_features
        if used_valuable:
            score += 5 * len(used_valuable)
            details['valuable_features_used'] = list(used_valuable)
        
        # Savings behavior
        if profile.has_savings_account:
            score += 10
            details['has_savings'] = True
            
            if profile.regular_savings:
                score += 10
                details['regular_saver'] = True
        
        # Age factor (slight adjustment)
        if 25 <= profile.age <= 55:
            score += 5
        elif profile.age < 21:
            score -= 10
        
        details['age'] = profile.age
        
        return max(0, min(100, score)), details

    def _get_impact(self, score: float) -> str:
        """Get impact description for a factor score"""
        if score >= 80:
            return "positive"
        elif score >= 60:
            return "neutral"
        elif score >= 40:
            return "negative"
        else:
            return "very_negative"

    def _get_tier(self, score: int) -> CreditTier:
        """Convert score to credit tier"""
        if score >= 750:
            return CreditTier.EXCELLENT
        elif score >= 700:
            return CreditTier.GOOD
        elif score >= 650:
            return CreditTier.FAIR
        elif score >= 550:
            return CreditTier.POOR
        else:
            return CreditTier.VERY_POOR

    def _generate_recommendations(self, factors: Dict, profile: CustomerProfile) -> List[str]:
        """Generate personalized recommendations to improve score"""
        recommendations = []
        
        # Payment history recommendations
        if factors['payment_history']['score'] < 70:
            if profile.loans_defaulted > 0:
                recommendations.append("Work on clearing defaulted loans to significantly improve your score")
            if profile.bills_missed_12m > 0:
                recommendations.append("Set up automatic bill payments to avoid missed payments")
            if profile.overdraft_count_12m > 0:
                recommendations.append("Maintain a buffer in your account to avoid overdrafts")
        
        # Debt burden recommendations
        if factors['debt_burden']['score'] < 70:
            recommendations.append("Focus on paying down existing debt before taking new loans")
            if not profile.has_savings_account:
                recommendations.append("Open a savings account and start building an emergency fund")
        
        # Account history recommendations
        if factors['account_history']['score'] < 70:
            if profile.account_age_months < 12:
                recommendations.append("Keep your account active - longer history improves your score")
            if profile.transaction_count_30d < 10:
                recommendations.append("Use your account regularly for transactions")
        
        # Income stability recommendations
        if factors['income_stability']['score'] < 70:
            if profile.employment_status == 'unemployed':
                recommendations.append("Stable employment significantly improves creditworthiness")
        
        # Behavioral recommendations
        if factors['behavioral']['score'] < 70:
            if not profile.regular_savings:
                recommendations.append("Set up regular automatic savings to demonstrate financial discipline")
            if profile.app_logins_30d < 5:
                recommendations.append("Engage more with the app to access better financial tools")
        
        # General positive recommendations
        if not recommendations:
            recommendations.append("Maintain your excellent financial habits")
            recommendations.append("Consider diversifying your savings into investments")
        
        return recommendations[:5]  # Max 5 recommendations

    def _calculate_max_loan(self, profile: CustomerProfile, tier: CreditTier) -> float:
        """Calculate maximum loan amount based on income and credit tier"""
        if profile.monthly_income <= 0:
            return 0
        
        multiplier = self.loan_multipliers[tier]
        max_loan = profile.monthly_income * multiplier
        
        # Adjust for existing debt
        if profile.active_loans > 0:
            max_loan -= profile.total_loan_amount * 0.5
        
        # Minimum loan amount
        max_loan = max(0, max_loan)
        
        # Cap at reasonable amount
        max_loan = min(max_loan, 10000000)  # 10M NGN cap
        
        return round(max_loan, -3)  # Round to nearest 1000

    def _calculate_interest_rate(self, score: int) -> float:
        """Calculate recommended interest rate based on score"""
        # Linear interpolation between min and max rates
        score_range = self.max_score - self.min_score
        score_normalized = (score - self.min_score) / score_range
        
        # Higher score = lower rate
        rate = self.max_interest_rate - score_normalized * (self.max_interest_rate - self.min_interest_rate)
        
        return round(rate, 4)

    def _calculate_confidence(self, profile: CustomerProfile) -> float:
        """Calculate confidence in the score"""
        confidence = 0.5
        
        # More data = higher confidence
        if profile.account_age_months >= 12:
            confidence += 0.15
        
        if profile.transaction_count_30d >= 20:
            confidence += 0.1
        
        total_loans = profile.loans_paid_on_time + profile.loans_paid_late + profile.loans_defaulted
        if total_loans >= 3:
            confidence += 0.15
        
        if profile.monthly_income > 0 and profile.avg_monthly_inflow > 0:
            confidence += 0.1
        
        return min(confidence, 1.0)


# Singleton instance
_credit_model: Optional[CreditScoringModel] = None


def get_credit_model() -> CreditScoringModel:
    """Get singleton credit scoring model"""
    global _credit_model
    if _credit_model is None:
        _credit_model = CreditScoringModel()
    return _credit_model
