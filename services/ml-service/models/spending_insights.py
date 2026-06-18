"""
54link-dev Spending Insights Engine
Personalized financial insights and recommendations

Features:
- Spending pattern analysis
- Budget recommendations
- Savings opportunities detection
- Financial health scoring
- Predictive cash flow
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import math
import logging
from .transaction_categorization import TransactionCategory, CategorizedTransaction

logger = logging.getLogger(__name__)


class InsightType(Enum):
    SPENDING_ALERT = "spending_alert"
    SAVINGS_OPPORTUNITY = "savings_opportunity"
    BUDGET_RECOMMENDATION = "budget_recommendation"
    INCOME_INSIGHT = "income_insight"
    RECURRING_DETECTION = "recurring_detection"
    UNUSUAL_ACTIVITY = "unusual_activity"
    GOAL_PROGRESS = "goal_progress"
    FINANCIAL_TIP = "financial_tip"
    CASH_FLOW_PREDICTION = "cash_flow_prediction"


class InsightPriority(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Insight:
    insight_id: str
    type: InsightType
    priority: InsightPriority
    title: str
    description: str
    amount: Optional[float] = None
    category: Optional[TransactionCategory] = None
    action_text: Optional[str] = None
    action_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    metadata: Dict = field(default_factory=dict)


@dataclass
class SpendingAnalysis:
    period_start: datetime
    period_end: datetime
    total_income: float
    total_expenses: float
    net_cash_flow: float
    savings_rate: float
    category_breakdown: Dict[str, Dict]
    top_merchants: List[Dict]
    insights: List[Insight]
    financial_health_score: int
    predicted_end_of_month_balance: float


@dataclass
class BudgetRecommendation:
    category: TransactionCategory
    current_spending: float
    recommended_budget: float
    potential_savings: float
    reasoning: str


class SpendingInsightsEngine:
    """
    Spending insights engine providing:
    1. Spending pattern analysis
    2. Personalized recommendations
    3. Financial health scoring
    4. Predictive analytics
    """

    def __init__(self):
        # Ideal budget allocation (50/30/20 rule adapted for Nigeria)
        self.ideal_allocation = {
            'essential': 0.50,  # Rent, utilities, groceries, healthcare
            'discretionary': 0.30,  # Entertainment, dining, shopping
            'savings': 0.20,  # Savings and investments
        }
        
        # Category groupings
        self.essential_categories = {
            TransactionCategory.RENT,
            TransactionCategory.UTILITIES,
            TransactionCategory.GROCERIES,
            TransactionCategory.HEALTHCARE,
            TransactionCategory.INSURANCE,
            TransactionCategory.EDUCATION,
            TransactionCategory.PHONE_BILL,
            TransactionCategory.INTERNET,
            TransactionCategory.FUEL,
            TransactionCategory.PUBLIC_TRANSPORT,
        }
        
        self.discretionary_categories = {
            TransactionCategory.RESTAURANTS,
            TransactionCategory.FAST_FOOD,
            TransactionCategory.FOOD_DELIVERY,
            TransactionCategory.COFFEE_SHOPS,
            TransactionCategory.STREAMING,
            TransactionCategory.GAMING,
            TransactionCategory.MOVIES,
            TransactionCategory.EVENTS,
            TransactionCategory.CLOTHING,
            TransactionCategory.ELECTRONICS,
            TransactionCategory.ONLINE_SHOPPING,
            TransactionCategory.TRAVEL,
            TransactionCategory.GIFTS,
        }
        
        self.income_categories = {
            TransactionCategory.SALARY,
            TransactionCategory.FREELANCE,
            TransactionCategory.INVESTMENT_INCOME,
            TransactionCategory.REFUND,
            TransactionCategory.GIFT_RECEIVED,
            TransactionCategory.OTHER_INCOME,
            TransactionCategory.TRANSFER_IN,
        }

    def analyze_spending(self,
                         user_id: str,
                         transactions: List[CategorizedTransaction],
                         amounts: Dict[str, float],  # transaction_id -> amount
                         current_balance: float,
                         period_days: int = 30) -> SpendingAnalysis:
        """
        Comprehensive spending analysis for a user
        """
        now = datetime.now()
        period_start = now - timedelta(days=period_days)
        
        # Calculate totals
        total_income = 0.0
        total_expenses = 0.0
        category_totals: Dict[str, float] = {}
        merchant_totals: Dict[str, float] = {}
        
        for txn in transactions:
            amount = amounts.get(txn.transaction_id, 0)
            
            if txn.category in self.income_categories:
                total_income += amount
            else:
                total_expenses += amount
            
            # Category breakdown
            cat_key = txn.category.value
            category_totals[cat_key] = category_totals.get(cat_key, 0) + amount
            
            # Merchant breakdown
            merchant_totals[txn.normalized_merchant] = merchant_totals.get(txn.normalized_merchant, 0) + amount
        
        # Calculate metrics
        net_cash_flow = total_income - total_expenses
        savings_rate = (net_cash_flow / total_income * 100) if total_income > 0 else 0
        
        # Category breakdown with percentages
        category_breakdown = {}
        for cat, total in category_totals.items():
            category_breakdown[cat] = {
                'total': total,
                'percentage': (total / total_expenses * 100) if total_expenses > 0 else 0,
                'transaction_count': sum(1 for t in transactions if t.category.value == cat),
            }
        
        # Top merchants
        top_merchants = sorted(
            [{'name': k, 'total': v} for k, v in merchant_totals.items()],
            key=lambda x: x['total'],
            reverse=True
        )[:10]
        
        # Generate insights
        insights = self._generate_insights(
            user_id, transactions, amounts, category_totals,
            total_income, total_expenses, current_balance
        )
        
        # Calculate financial health score
        health_score = self._calculate_health_score(
            total_income, total_expenses, savings_rate, current_balance
        )
        
        # Predict end of month balance
        days_remaining = self._days_until_month_end()
        daily_expense_rate = total_expenses / period_days if period_days > 0 else 0
        predicted_expenses = daily_expense_rate * days_remaining
        predicted_balance = current_balance - predicted_expenses
        
        return SpendingAnalysis(
            period_start=period_start,
            period_end=now,
            total_income=total_income,
            total_expenses=total_expenses,
            net_cash_flow=net_cash_flow,
            savings_rate=savings_rate,
            category_breakdown=category_breakdown,
            top_merchants=top_merchants,
            insights=insights,
            financial_health_score=health_score,
            predicted_end_of_month_balance=predicted_balance,
        )

    def _generate_insights(self,
                           user_id: str,
                           transactions: List[CategorizedTransaction],
                           amounts: Dict[str, float],
                           category_totals: Dict[str, float],
                           total_income: float,
                           total_expenses: float,
                           current_balance: float) -> List[Insight]:
        """Generate personalized insights"""
        insights = []
        insight_counter = 0
        
        def make_id():
            nonlocal insight_counter
            insight_counter += 1
            return f"insight_{user_id}_{insight_counter}"
        
        # 1. Overspending alerts
        if total_expenses > total_income * 0.9:
            insights.append(Insight(
                insight_id=make_id(),
                type=InsightType.SPENDING_ALERT,
                priority=InsightPriority.HIGH,
                title="Spending Alert",
                description=f"You've spent {total_expenses/total_income*100:.0f}% of your income this month. Consider reducing discretionary spending.",
                amount=total_expenses - total_income * 0.8,
                action_text="View Budget Tips",
                action_url="/budget-tips",
            ))
        
        # 2. Category-specific insights
        for cat, total in category_totals.items():
            percentage = (total / total_expenses * 100) if total_expenses > 0 else 0
            
            # Food delivery spending
            if cat == TransactionCategory.FOOD_DELIVERY.value and percentage > 10:
                potential_savings = total * 0.5
                insights.append(Insight(
                    insight_id=make_id(),
                    type=InsightType.SAVINGS_OPPORTUNITY,
                    priority=InsightPriority.MEDIUM,
                    title="Food Delivery Spending",
                    description=f"You spent {total:,.0f} NGN on food delivery. Cooking at home could save you up to {potential_savings:,.0f} NGN.",
                    amount=potential_savings,
                    category=TransactionCategory.FOOD_DELIVERY,
                    action_text="See Alternatives",
                ))
            
            # Streaming subscriptions
            if cat == TransactionCategory.STREAMING.value and total > 10000:
                insights.append(Insight(
                    insight_id=make_id(),
                    type=InsightType.SAVINGS_OPPORTUNITY,
                    priority=InsightPriority.LOW,
                    title="Multiple Streaming Services",
                    description=f"You're spending {total:,.0f} NGN on streaming. Consider consolidating to save money.",
                    amount=total * 0.3,
                    category=TransactionCategory.STREAMING,
                ))
            
            # High entertainment spending
            if cat in [TransactionCategory.GAMING.value, TransactionCategory.MOVIES.value, TransactionCategory.EVENTS.value]:
                if percentage > 15:
                    insights.append(Insight(
                        insight_id=make_id(),
                        type=InsightType.SPENDING_ALERT,
                        priority=InsightPriority.MEDIUM,
                        title="Entertainment Spending",
                        description=f"Entertainment is {percentage:.0f}% of your spending. The recommended limit is 10%.",
                        amount=total,
                        action_text="Set Budget",
                    ))
        
        # 3. Recurring transaction detection
        recurring_txns = [t for t in transactions if t.is_recurring]
        if recurring_txns:
            recurring_total = sum(amounts.get(t.transaction_id, 0) for t in recurring_txns)
            insights.append(Insight(
                insight_id=make_id(),
                type=InsightType.RECURRING_DETECTION,
                priority=InsightPriority.LOW,
                title="Recurring Payments",
                description=f"You have {len(recurring_txns)} recurring payments totaling {recurring_total:,.0f} NGN/month.",
                amount=recurring_total,
                action_text="Manage Subscriptions",
                action_url="/subscriptions",
            ))
        
        # 4. Low balance warning
        if current_balance < total_expenses * 0.25:
            insights.append(Insight(
                insight_id=make_id(),
                type=InsightType.SPENDING_ALERT,
                priority=InsightPriority.HIGH,
                title="Low Balance Alert",
                description="Your balance is running low. Consider reducing spending or transferring funds.",
                amount=current_balance,
                action_text="Add Funds",
                action_url="/transfer",
            ))
        
        # 5. Savings opportunity
        if total_income > 0:
            savings_rate = (total_income - total_expenses) / total_income
            if savings_rate < 0.1:
                target_savings = total_income * 0.2
                current_savings = total_income - total_expenses
                gap = target_savings - current_savings
                insights.append(Insight(
                    insight_id=make_id(),
                    type=InsightType.BUDGET_RECOMMENDATION,
                    priority=InsightPriority.MEDIUM,
                    title="Savings Goal",
                    description=f"Aim to save 20% of income ({target_savings:,.0f} NGN). You're {gap:,.0f} NGN short.",
                    amount=gap,
                    action_text="Start Saving",
                    action_url="/savings",
                ))
            elif savings_rate > 0.3:
                insights.append(Insight(
                    insight_id=make_id(),
                    type=InsightType.FINANCIAL_TIP,
                    priority=InsightPriority.LOW,
                    title="Great Savings Rate!",
                    description=f"You're saving {savings_rate*100:.0f}% of your income. Consider investing the surplus.",
                    action_text="Explore Investments",
                    action_url="/investments",
                ))
        
        # 6. Income insight
        salary_income = category_totals.get(TransactionCategory.SALARY.value, 0)
        other_income = total_income - salary_income
        if other_income > salary_income * 0.2:
            insights.append(Insight(
                insight_id=make_id(),
                type=InsightType.INCOME_INSIGHT,
                priority=InsightPriority.LOW,
                title="Diversified Income",
                description=f"You have {other_income:,.0f} NGN in additional income sources. Great job diversifying!",
                amount=other_income,
            ))
        
        # 7. Cash flow prediction
        days_remaining = self._days_until_month_end()
        if days_remaining > 0:
            daily_rate = total_expenses / 30
            predicted_additional = daily_rate * days_remaining
            if current_balance < predicted_additional:
                shortfall = predicted_additional - current_balance
                insights.append(Insight(
                    insight_id=make_id(),
                    type=InsightType.CASH_FLOW_PREDICTION,
                    priority=InsightPriority.HIGH,
                    title="Cash Flow Warning",
                    description=f"At current spending rate, you may be short {shortfall:,.0f} NGN by month end.",
                    amount=shortfall,
                    action_text="Adjust Budget",
                ))
        
        # Sort by priority
        priority_order = {InsightPriority.HIGH: 0, InsightPriority.MEDIUM: 1, InsightPriority.LOW: 2}
        insights.sort(key=lambda x: priority_order[x.priority])
        
        return insights[:10]  # Max 10 insights

    def _calculate_health_score(self,
                                total_income: float,
                                total_expenses: float,
                                savings_rate: float,
                                current_balance: float) -> int:
        """Calculate financial health score (0-100)"""
        score = 50  # Base score
        
        # Savings rate impact (up to +30)
        if savings_rate >= 20:
            score += 30
        elif savings_rate >= 10:
            score += 20
        elif savings_rate >= 5:
            score += 10
        elif savings_rate < 0:
            score -= 20
        
        # Expense ratio impact (up to +20)
        if total_income > 0:
            expense_ratio = total_expenses / total_income
            if expense_ratio <= 0.7:
                score += 20
            elif expense_ratio <= 0.8:
                score += 10
            elif expense_ratio > 1.0:
                score -= 15
        
        # Balance cushion impact (up to +20)
        if total_expenses > 0:
            months_cushion = current_balance / total_expenses
            if months_cushion >= 3:
                score += 20
            elif months_cushion >= 1:
                score += 10
            elif months_cushion < 0.5:
                score -= 10
        
        return max(0, min(100, score))

    def _days_until_month_end(self) -> int:
        """Calculate days until end of current month"""
        now = datetime.now()
        if now.month == 12:
            next_month = datetime(now.year + 1, 1, 1)
        else:
            next_month = datetime(now.year, now.month + 1, 1)
        return (next_month - now).days

    def get_budget_recommendations(self,
                                   total_income: float,
                                   category_totals: Dict[str, float]) -> List[BudgetRecommendation]:
        """Generate budget recommendations based on income"""
        recommendations = []
        
        # Calculate ideal budgets
        essential_budget = total_income * self.ideal_allocation['essential']
        discretionary_budget = total_income * self.ideal_allocation['discretionary']
        
        # Essential categories
        essential_spending = sum(
            category_totals.get(cat.value, 0)
            for cat in self.essential_categories
        )
        
        if essential_spending > essential_budget * 1.2:
            recommendations.append(BudgetRecommendation(
                category=TransactionCategory.UTILITIES,
                current_spending=essential_spending,
                recommended_budget=essential_budget,
                potential_savings=essential_spending - essential_budget,
                reasoning="Essential spending exceeds 50% of income. Review utility and grocery costs.",
            ))
        
        # Discretionary categories
        discretionary_spending = sum(
            category_totals.get(cat.value, 0)
            for cat in self.discretionary_categories
        )
        
        if discretionary_spending > discretionary_budget:
            recommendations.append(BudgetRecommendation(
                category=TransactionCategory.RESTAURANTS,
                current_spending=discretionary_spending,
                recommended_budget=discretionary_budget,
                potential_savings=discretionary_spending - discretionary_budget,
                reasoning="Discretionary spending exceeds 30% of income. Consider cutting back on dining out and entertainment.",
            ))
        
        # Specific category recommendations
        food_delivery = category_totals.get(TransactionCategory.FOOD_DELIVERY.value, 0)
        if food_delivery > total_income * 0.05:
            recommendations.append(BudgetRecommendation(
                category=TransactionCategory.FOOD_DELIVERY,
                current_spending=food_delivery,
                recommended_budget=total_income * 0.03,
                potential_savings=food_delivery - total_income * 0.03,
                reasoning="Food delivery should be under 3% of income. Try meal prepping.",
            ))
        
        streaming = category_totals.get(TransactionCategory.STREAMING.value, 0)
        if streaming > 15000:  # More than 15k NGN on streaming
            recommendations.append(BudgetRecommendation(
                category=TransactionCategory.STREAMING,
                current_spending=streaming,
                recommended_budget=10000,
                potential_savings=streaming - 10000,
                reasoning="Consider consolidating streaming services or using family plans.",
            ))
        
        return recommendations

    def get_spending_trends(self,
                            monthly_data: List[Dict]) -> Dict:
        """Analyze spending trends over multiple months"""
        if len(monthly_data) < 2:
            return {'trend': 'insufficient_data'}
        
        # Calculate month-over-month changes
        changes = []
        for i in range(1, len(monthly_data)):
            prev = monthly_data[i-1]['total_expenses']
            curr = monthly_data[i]['total_expenses']
            if prev > 0:
                change = (curr - prev) / prev * 100
                changes.append(change)
        
        avg_change = sum(changes) / len(changes) if changes else 0
        
        # Determine trend
        if avg_change > 10:
            trend = 'increasing'
            trend_description = f"Spending increased by {avg_change:.1f}% on average"
        elif avg_change < -10:
            trend = 'decreasing'
            trend_description = f"Spending decreased by {abs(avg_change):.1f}% on average"
        else:
            trend = 'stable'
            trend_description = "Spending has been relatively stable"
        
        return {
            'trend': trend,
            'description': trend_description,
            'average_change_percent': avg_change,
            'monthly_changes': changes,
        }


# Singleton instance
_insights_engine: Optional[SpendingInsightsEngine] = None


def get_insights_engine() -> SpendingInsightsEngine:
    """Get singleton insights engine"""
    global _insights_engine
    if _insights_engine is None:
        _insights_engine = SpendingInsightsEngine()
    return _insights_engine
