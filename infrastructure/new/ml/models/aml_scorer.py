"""54Bank — AML (Anti-Money Laundering) Risk Scoring Model
Architecture: Wide-and-Deep network with cross-network for feature interactions.
Input: 14 profile features (numerical + categorical)
Output: Suspicious activity probability + risk tier
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class CrossNetwork(nn.Module):
    """Cross network for explicit feature interactions (DCN-v2 style)."""

    def __init__(self, input_dim: int, num_layers: int = 3):
        super().__init__()
        self.num_layers = num_layers
        self.cross_weights = nn.ParameterList([
            nn.Parameter(torch.randn(input_dim, input_dim) * 0.01)
            for _ in range(num_layers)
        ])
        self.cross_biases = nn.ParameterList([
            nn.Parameter(torch.zeros(input_dim))
            for _ in range(num_layers)
        ])

    def forward(self, x0: torch.Tensor) -> torch.Tensor:
        x = x0
        for i in range(self.num_layers):
            xw = torch.mm(x, self.cross_weights[i])
            x = x0 * xw + self.cross_biases[i] + x
        return x


class AMLRiskScorer(nn.Module):
    """AML suspicious activity detection using Wide-and-Deep architecture.

    Wide path: CrossNetwork for memorizing feature combinations
    Deep path: MLP for generalization
    Combined: concatenate + classify

    Input features (10 numerical):
        transaction_count_30d, unique_counterparties_30d,
        cash_ratio, international_ratio, avg_transaction_amount (log),
        max_transaction_amount (log), round_amount_ratio,
        night_ratio, structuring_score, days_since_last_kyc_update
    Categorical:
        pep_flag (2), high_risk_country (2), account_type (5), kyc_level (3)
    """

    NUM_FEATURES = 10

    def __init__(self, hidden_dim: int = 96, cross_layers: int = 3,
                 dropout: float = 0.25):
        super().__init__()

        # Categorical embeddings
        self.emb_account_type = nn.Embedding(5, 4)
        self.emb_kyc_level = nn.Embedding(3, 3)
        cat_dim = 4 + 3 + 2  # account_type + kyc_level + pep_flag + high_risk

        total_input = self.NUM_FEATURES + cat_dim  # 19

        # Wide path: Cross Network
        self.cross_network = CrossNetwork(total_input, num_layers=cross_layers)

        # Deep path: MLP
        self.deep = nn.Sequential(
            nn.Linear(total_input, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.BatchNorm1d(hidden_dim // 2),
            nn.GELU(),
        )

        # Combination layer
        combined_dim = total_input + hidden_dim // 2
        self.classifier = nn.Sequential(
            nn.Linear(combined_dim, 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

        # Risk tier head (auxiliary task)
        self.tier_head = nn.Sequential(
            nn.Linear(combined_dim, 32),
            nn.GELU(),
            nn.Linear(32, 4),  # low, medium, high, critical
        )

    def forward(self, num_features: torch.Tensor,
                pep_flag: torch.Tensor,
                high_risk: torch.Tensor,
                account_type: torch.Tensor,
                kyc_level: torch.Tensor) -> dict:
        """
        Args:
            num_features: (batch, 10) float
            pep_flag: (batch,) long [0, 1]
            high_risk: (batch,) long [0, 1]
            account_type: (batch,) long [0..4]
            kyc_level: (batch,) long [0..2]
        Returns:
            dict with 'suspicious_logit', 'suspicious_prob', 'risk_tier_logits'
        """
        e_account = self.emb_account_type(account_type)
        e_kyc = self.emb_kyc_level(kyc_level)
        pep_onehot = F.one_hot(pep_flag, 2).float()

        cat = torch.cat([e_account, e_kyc, pep_onehot], dim=-1)
        x = torch.cat([num_features, cat], dim=-1)

        # Wide path
        wide_out = self.cross_network(x)

        # Deep path
        deep_out = self.deep(x)

        # Combine
        combined = torch.cat([wide_out, deep_out], dim=-1)

        suspicious_logit = self.classifier(combined)
        suspicious_prob = torch.sigmoid(suspicious_logit)
        risk_tier_logits = self.tier_head(combined)

        return {
            "suspicious_logit": suspicious_logit,
            "suspicious_prob": suspicious_prob,
            "risk_tier_logits": risk_tier_logits,
        }

    def predict(self, num_features, pep_flag, high_risk, account_type, kyc_level):
        """Inference — returns suspicious probability and risk tier."""
        with torch.no_grad():
            out = self.forward(num_features, pep_flag, high_risk, account_type, kyc_level)
            return {
                "suspicious_probability": out["suspicious_prob"].squeeze(-1).cpu().numpy(),
                "risk_tier": torch.argmax(out["risk_tier_logits"], dim=-1).cpu().numpy(),
            }
