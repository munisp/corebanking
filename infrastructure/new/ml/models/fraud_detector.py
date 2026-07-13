"""54Bank — Transaction Fraud Detection Model
Architecture: Multi-layer MLP with self-attention, batch normalization,
              residual connections, and dropout regularization.
Input: 14 numerical features + categorical embeddings
Output: Binary fraud probability
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class SelfAttentionBlock(nn.Module):
    """Single-head self-attention over feature dimensions."""
    def __init__(self, dim: int, dropout: float = 0.1):
        super().__init__()
        self.query = nn.Linear(dim, dim)
        self.key = nn.Linear(dim, dim)
        self.value = nn.Linear(dim, dim)
        self.dropout = nn.Dropout(dropout)
        self.norm = nn.LayerNorm(dim)
        self.scale = dim ** 0.5

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, dim) → treat each feature as a token
        q = self.query(x)
        k = self.key(x)
        v = self.value(x)
        attn = torch.softmax(q * k / self.scale, dim=-1)
        attn = self.dropout(attn)
        out = attn * v
        return self.norm(out + x)


class ResidualBlock(nn.Module):
    """Residual block with BatchNorm and dropout."""
    def __init__(self, dim: int, dropout: float = 0.3):
        super().__init__()
        self.fc1 = nn.Linear(dim, dim)
        self.fc2 = nn.Linear(dim, dim)
        self.bn1 = nn.BatchNorm1d(dim)
        self.bn2 = nn.BatchNorm1d(dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = F.gelu(self.bn1(self.fc1(x)))
        out = self.dropout(out)
        out = self.bn2(self.fc2(out))
        return F.gelu(out + residual)


class FraudDetector(nn.Module):
    """Transaction fraud detection neural network.

    Architecture:
    1. Categorical embedding layers (merchant_category: 20 cats, channel: 7 cats,
       card_type: 3 cats, state: 20 cats)
    2. Numerical feature projection
    3. Feature fusion layer
    4. Self-attention block
    5. 3x Residual blocks with BatchNorm + dropout
    6. Classification head with sigmoid output

    Input features (14 numerical):
        amount, hour, day_of_week, velocity_1h, velocity_24h,
        amount_vs_avg, geo_distance_km, device_age_days,
        is_new_beneficiary, is_international, account_age_days,
        balance_ratio
    Categorical features:
        merchant_category (20), channel (7), card_type (3), state (20)
    """

    NUM_FEATURES = 12  # numerical features
    CAT_CONFIGS = {
        "merchant_category": (20, 8),   # (num_categories, embedding_dim)
        "channel": (7, 4),
        "card_type": (3, 3),
        "state": (20, 6),
    }

    def __init__(self, hidden_dim: int = 128, n_residual_blocks: int = 3,
                 dropout: float = 0.3):
        super().__init__()

        # Categorical embeddings
        self.emb_merchant = nn.Embedding(20, 8)
        self.emb_channel = nn.Embedding(7, 4)
        self.emb_card = nn.Embedding(3, 3)
        self.emb_state = nn.Embedding(20, 6)
        total_cat_dim = 8 + 4 + 3 + 6  # 21

        # Numerical feature projection
        self.num_projection = nn.Sequential(
            nn.Linear(self.NUM_FEATURES, 64),
            nn.BatchNorm1d(64),
            nn.GELU(),
        )

        # Feature fusion
        fused_dim = 64 + total_cat_dim  # 85
        self.fusion = nn.Sequential(
            nn.Linear(fused_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # Self-attention
        self.attention = SelfAttentionBlock(hidden_dim, dropout=dropout)

        # Residual blocks
        self.residual_blocks = nn.ModuleList([
            ResidualBlock(hidden_dim, dropout=dropout)
            for _ in range(n_residual_blocks)
        ])

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.BatchNorm1d(64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 1),
        )

    def forward(self, num_features: torch.Tensor,
                merchant_cat: torch.Tensor,
                channel: torch.Tensor,
                card_type: torch.Tensor,
                state: torch.Tensor) -> torch.Tensor:
        """
        Args:
            num_features: (batch, 12) float tensor
            merchant_cat: (batch,) long tensor [0..19]
            channel: (batch,) long tensor [0..6]
            card_type: (batch,) long tensor [0..2]
            state: (batch,) long tensor [0..19]
        Returns:
            logits: (batch, 1) — raw logits (apply sigmoid for probability)
        """
        # Embed categoricals
        e_merchant = self.emb_merchant(merchant_cat)
        e_channel = self.emb_channel(channel)
        e_card = self.emb_card(card_type)
        e_state = self.emb_state(state)
        cat_features = torch.cat([e_merchant, e_channel, e_card, e_state], dim=-1)

        # Project numericals
        num_proj = self.num_projection(num_features)

        # Fuse
        fused = torch.cat([num_proj, cat_features], dim=-1)
        x = self.fusion(fused)

        # Self-attention
        x = self.attention(x)

        # Residual blocks
        for block in self.residual_blocks:
            x = block(x)

        # Classify
        logits = self.classifier(x)
        return logits

    def predict_proba(self, num_features, merchant_cat, channel, card_type, state):
        """Return fraud probability (0-1)."""
        with torch.no_grad():
            logits = self.forward(num_features, merchant_cat, channel, card_type, state)
            return torch.sigmoid(logits)
