"""54Bank — Customer Churn Prediction Model
Architecture: Bidirectional GRU with temporal attention mechanism.
Input: Sequence of monthly customer activity features (12 months × 8 features)
Output: Churn probability
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class TemporalAttention(nn.Module):
    """Attention mechanism over GRU hidden states to focus on critical months."""
    def __init__(self, hidden_dim: int):
        super().__init__()
        self.attention = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.Tanh(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, gru_output: torch.Tensor) -> tuple:
        """
        Args:
            gru_output: (batch, seq_len, hidden_dim)
        Returns:
            context: (batch, hidden_dim) — attention-weighted sum
            weights: (batch, seq_len) — attention weights
        """
        scores = self.attention(gru_output).squeeze(-1)  # (batch, seq_len)
        weights = F.softmax(scores, dim=-1)  # (batch, seq_len)
        context = torch.bmm(weights.unsqueeze(1), gru_output).squeeze(1)  # (batch, hidden_dim)
        return context, weights


class ChurnPredictor(nn.Module):
    """Customer churn prediction using bidirectional GRU + temporal attention.

    Architecture:
    1. Input projection: per-timestep feature projection
    2. Bidirectional GRU (2 layers)
    3. Temporal attention over all timesteps
    4. Classification head

    Input: (batch, seq_len=12, features=8)
        Per-month features:
            transaction_count, total_amount, avg_balance,
            product_count, complaint_count, login_count,
            channel_diversity, nps_score

    Output: churn probability
    """

    INPUT_FEATURES = 8
    SEQ_LENGTH = 12

    def __init__(self, hidden_dim: int = 64, num_layers: int = 2,
                 dropout: float = 0.3, bidirectional: bool = True):
        super().__init__()

        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1

        # Per-timestep feature projection
        self.feature_proj = nn.Sequential(
            nn.Linear(self.INPUT_FEATURES, 32),
            nn.LayerNorm(32),
            nn.GELU(),
        )

        # Bidirectional GRU
        self.gru = nn.GRU(
            input_size=32,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )

        # Temporal attention
        gru_output_dim = hidden_dim * self.num_directions
        self.temporal_attention = TemporalAttention(gru_output_dim)

        # Trend features (computed from input sequence)
        trend_dim = 3  # trend slope, volatility, last-vs-first ratio

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(gru_output_dim + trend_dim, 64),
            nn.BatchNorm1d(64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
        )

    def compute_trend_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extract trend features from the input sequence.
        Args:
            x: (batch, seq_len, features)
        Returns:
            trends: (batch, 3) — activity_trend, volatility, last_vs_first
        """
        # Use transaction_count (feature 0) as the main activity indicator
        activity = x[:, :, 0]  # (batch, seq_len)

        # Trend slope: simple linear regression coefficient
        seq_len = activity.shape[1]
        t = torch.arange(seq_len, dtype=torch.float32, device=x.device)
        t_mean = t.mean()
        t_centered = t - t_mean
        activity_mean = activity.mean(dim=1, keepdim=True)
        activity_centered = activity - activity_mean

        slope = (activity_centered * t_centered.unsqueeze(0)).sum(dim=1) / (t_centered.pow(2).sum() + 1e-8)

        # Volatility: std of activity
        volatility = activity.std(dim=1)

        # Last vs first ratio
        first_half = activity[:, :seq_len // 2].mean(dim=1)
        second_half = activity[:, seq_len // 2:].mean(dim=1)
        ratio = second_half / (first_half + 1e-8)

        return torch.stack([slope, volatility, ratio], dim=1)

    def forward(self, x: torch.Tensor) -> dict:
        """
        Args:
            x: (batch, seq_len, 8) float tensor
        Returns:
            dict with 'logit', 'probability', 'attention_weights'
        """
        batch_size = x.shape[0]

        # Compute trend features before projection
        trends = self.compute_trend_features(x)

        # Project features per timestep
        x_proj = self.feature_proj(x)  # (batch, seq_len, 32)

        # GRU
        gru_out, _ = self.gru(x_proj)  # (batch, seq_len, hidden_dim * num_directions)

        # Temporal attention
        context, attn_weights = self.temporal_attention(gru_out)

        # Combine with trend features
        combined = torch.cat([context, trends], dim=-1)

        # Classify
        logit = self.classifier(combined)
        prob = torch.sigmoid(logit)

        return {
            "logit": logit,
            "probability": prob,
            "attention_weights": attn_weights,
        }

    def predict(self, x: torch.Tensor) -> dict:
        """Inference — returns churn probability and attention weights."""
        with torch.no_grad():
            out = self.forward(x)
            return {
                "churn_probability": out["probability"].squeeze(-1).cpu().numpy(),
                "attention_weights": out["attention_weights"].cpu().numpy(),
            }
