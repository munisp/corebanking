"""54Bank — Credit Risk Scoring Model
Architecture: Deep MLP with skip connections, BatchNorm,
              feature crossing layer, and calibrated output.
Input: 15 numerical features + categorical embeddings (sector, state)
Output: Default probability + credit score (300-850)
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class FeatureCrossing(nn.Module):
    """Explicit feature interaction layer — learns pairwise feature crosses."""
    def __init__(self, input_dim: int, num_crosses: int = 32):
        super().__init__()
        self.cross_w = nn.Parameter(torch.randn(num_crosses, input_dim) * 0.01)
        self.cross_b = nn.Parameter(torch.zeros(num_crosses))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, input_dim)
        # Compute cross features: (x * w_i).sum() for each cross
        crosses = F.relu(torch.mm(x, self.cross_w.t()) + self.cross_b)
        return torch.cat([x, crosses], dim=-1)


class CreditScorer(nn.Module):
    """Credit risk neural network with calibrated probability output.

    Architecture:
    1. Categorical embeddings (sector: 10 cats, state: 20 cats)
    2. Numerical feature normalization + projection
    3. Feature crossing layer (32 explicit crosses)
    4. Deep tower: 4 layers with skip connections + BatchNorm
    5. Dual head: default probability + credit band

    Input features (15 numerical):
        age, monthly_income, total_debt, dti_ratio, employment_years,
        num_prior_loans, num_defaults, loan_amount_requested,
        loan_tenure_months, collateral_value, has_guarantor,
        account_age_months, avg_monthly_balance, num_dependents,
        collateral_to_loan_ratio
    Categorical:
        sector (10), state (20)
    """

    NUM_FEATURES = 15

    def __init__(self, hidden_dim: int = 128, dropout: float = 0.25):
        super().__init__()

        # Categorical embeddings
        self.emb_sector = nn.Embedding(10, 6)
        self.emb_state = nn.Embedding(20, 6)
        cat_dim = 12

        # Input projection
        self.input_proj = nn.Sequential(
            nn.Linear(self.NUM_FEATURES, 64),
            nn.BatchNorm1d(64),
            nn.GELU(),
        )

        # Feature crossing
        fused_dim = 64 + cat_dim  # 76
        self.feature_crossing = FeatureCrossing(fused_dim, num_crosses=32)
        crossed_dim = fused_dim + 32  # 108

        # Deep tower with skip connections
        self.layer1 = nn.Sequential(
            nn.Linear(crossed_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        self.layer2 = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        self.layer3 = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        self.layer4 = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.BatchNorm1d(64),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # Skip connection projection (for residual from layer1 to layer3)
        self.skip_proj = nn.Linear(hidden_dim, hidden_dim)

        # Default probability head
        self.default_head = nn.Sequential(
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 1),
        )

        # Credit band head (auxiliary — predicts score band for multi-task learning)
        self.band_head = nn.Sequential(
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 4),  # poor, fair, good, excellent
        )

    def forward(self, num_features: torch.Tensor,
                sector: torch.Tensor,
                state: torch.Tensor) -> dict:
        """
        Args:
            num_features: (batch, 15) float tensor
            sector: (batch,) long tensor [0..9]
            state: (batch,) long tensor [0..19]
        Returns:
            dict with 'default_logit', 'default_prob', 'credit_score', 'band_logits'
        """
        # Embed categoricals
        e_sector = self.emb_sector(sector)
        e_state = self.emb_state(state)
        cat = torch.cat([e_sector, e_state], dim=-1)

        # Project numericals
        num_proj = self.input_proj(num_features)

        # Fuse + cross
        fused = torch.cat([num_proj, cat], dim=-1)
        crossed = self.feature_crossing(fused)

        # Deep tower with skip
        h1 = self.layer1(crossed)
        h2 = self.layer2(h1)
        h3 = self.layer3(h2 + self.skip_proj(h1))  # skip connection
        h4 = self.layer4(h3)

        # Heads
        default_logit = self.default_head(h4)
        default_prob = torch.sigmoid(default_logit)
        band_logits = self.band_head(h4)

        # Convert probability to credit score (300-850 range)
        # Lower default prob → higher score
        credit_score = 300 + (1 - default_prob) * 550

        return {
            "default_logit": default_logit,
            "default_prob": default_prob,
            "credit_score": credit_score,
            "band_logits": band_logits,
        }

    def predict(self, num_features, sector, state):
        """Inference — returns credit score and default probability."""
        with torch.no_grad():
            out = self.forward(num_features, sector, state)
            return {
                "default_probability": out["default_prob"].squeeze(-1).cpu().numpy(),
                "credit_score": out["credit_score"].squeeze(-1).cpu().numpy(),
                "band": torch.argmax(out["band_logits"], dim=-1).cpu().numpy(),
            }
