"""54Bank — GNN Fraud Ring Detection Model
Architecture: Custom GraphSAGE-like message passing with attention,
              implemented in pure PyTorch (no PyG dependency).
Input: Account feature matrix + adjacency (edge index + edge features)
Output: Per-node fraud ring membership probability
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple


class GraphAttentionLayer(nn.Module):
    """Single graph attention layer (GAT-style) with edge features."""

    def __init__(self, in_dim: int, out_dim: int, edge_dim: int = 1,
                 heads: int = 4, dropout: float = 0.3, concat: bool = True):
        super().__init__()
        self.in_dim = in_dim
        self.out_dim = out_dim
        self.heads = heads
        self.concat = concat

        self.W = nn.Linear(in_dim, out_dim * heads, bias=False)
        self.a_src = nn.Parameter(torch.randn(heads, out_dim))
        self.a_dst = nn.Parameter(torch.randn(heads, out_dim))
        self.a_edge = nn.Linear(edge_dim, heads, bias=False)
        self.leaky_relu = nn.LeakyReLU(0.2)
        self.dropout = nn.Dropout(dropout)

        nn.init.xavier_uniform_(self.W.weight)
        nn.init.xavier_uniform_(self.a_src)
        nn.init.xavier_uniform_(self.a_dst)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor,
                edge_attr: torch.Tensor = None) -> torch.Tensor:
        """
        Args:
            x: (num_nodes, in_dim) node features
            edge_index: (2, num_edges) source and target indices
            edge_attr: (num_edges, edge_dim) edge features (optional)
        Returns:
            out: (num_nodes, out_dim * heads) if concat else (num_nodes, out_dim)
        """
        num_nodes = x.shape[0]
        src, dst = edge_index[0], edge_index[1]

        # Linear transform
        h = self.W(x).view(num_nodes, self.heads, self.out_dim)  # (N, H, D)

        # Attention scores
        score_src = (h * self.a_src.unsqueeze(0)).sum(dim=-1)  # (N, H)
        score_dst = (h * self.a_dst.unsqueeze(0)).sum(dim=-1)  # (N, H)

        # Edge attention: α_ij = LeakyReLU(a_src * h_i + a_dst * h_j + a_edge * e_ij)
        alpha = score_src[src] + score_dst[dst]  # (E, H)
        if edge_attr is not None:
            alpha = alpha + self.a_edge(edge_attr)  # (E, H)
        alpha = self.leaky_relu(alpha)

        # Softmax per destination node
        alpha = self._sparse_softmax(alpha, dst, num_nodes)
        alpha = self.dropout(alpha)

        # Message passing: aggregate
        msg = h[src] * alpha.unsqueeze(-1)  # (E, H, D)
        out = torch.zeros(num_nodes, self.heads, self.out_dim, device=x.device)
        out.scatter_add_(0, dst.unsqueeze(-1).unsqueeze(-1).expand_as(msg), msg)

        if self.concat:
            return out.view(num_nodes, self.heads * self.out_dim)
        else:
            return out.mean(dim=1)

    def _sparse_softmax(self, scores: torch.Tensor, index: torch.Tensor,
                        num_nodes: int) -> torch.Tensor:
        """Compute softmax grouped by destination node."""
        scores_max = torch.zeros(num_nodes, scores.shape[1], device=scores.device)
        scores_max.scatter_reduce_(0, index.unsqueeze(-1).expand_as(scores),
                                    scores, reduce="amax", include_self=False)
        scores = scores - scores_max[index]
        scores_exp = scores.exp()

        denom = torch.zeros(num_nodes, scores.shape[1], device=scores.device)
        denom.scatter_add_(0, index.unsqueeze(-1).expand_as(scores_exp), scores_exp)
        return scores_exp / (denom[index] + 1e-8)


class SAGEConvLayer(nn.Module):
    """GraphSAGE-style convolution: aggregate neighbor features + self."""

    def __init__(self, in_dim: int, out_dim: int, aggr: str = "mean"):
        super().__init__()
        self.linear_self = nn.Linear(in_dim, out_dim)
        self.linear_neigh = nn.Linear(in_dim, out_dim)
        self.norm = nn.LayerNorm(out_dim)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        num_nodes = x.shape[0]
        src, dst = edge_index[0], edge_index[1]

        # Aggregate neighbor features (mean)
        neigh_sum = torch.zeros(num_nodes, x.shape[1], device=x.device)
        neigh_sum.scatter_add_(0, dst.unsqueeze(-1).expand(-1, x.shape[1]), x[src])
        neigh_count = torch.zeros(num_nodes, 1, device=x.device)
        neigh_count.scatter_add_(0, dst.unsqueeze(-1), torch.ones(len(src), 1, device=x.device))
        neigh_mean = neigh_sum / (neigh_count + 1e-8)

        out = self.linear_self(x) + self.linear_neigh(neigh_mean)
        return self.norm(F.gelu(out))


class GNNFraudRingDetector(nn.Module):
    """Graph Neural Network for fraud ring detection.

    Architecture:
    1. Node feature projection
    2. 2x GAT layers (multi-head attention with edge features)
    3. 1x GraphSAGE layer (mean aggregation)
    4. Node-level classification head

    Node features (7):
        account_type_idx, balance (log), account_age_days,
        kyc_level, num_products, avg_incoming_amount (log),
        avg_outgoing_amount (log)

    Edge features (1):
        transaction_amount (log)

    Output: per-node fraud ring membership probability
    """

    NODE_FEATURES = 7
    EDGE_FEATURES = 1

    def __init__(self, hidden_dim: int = 64, heads: int = 4,
                 dropout: float = 0.3):
        super().__init__()

        # Node feature projection
        self.node_proj = nn.Sequential(
            nn.Linear(self.NODE_FEATURES, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
        )

        # GAT layers
        self.gat1 = GraphAttentionLayer(
            in_dim=hidden_dim, out_dim=hidden_dim // heads,
            edge_dim=self.EDGE_FEATURES, heads=heads,
            dropout=dropout, concat=True,
        )
        self.gat1_norm = nn.LayerNorm(hidden_dim)

        self.gat2 = GraphAttentionLayer(
            in_dim=hidden_dim, out_dim=hidden_dim // heads,
            edge_dim=self.EDGE_FEATURES, heads=heads,
            dropout=dropout, concat=True,
        )
        self.gat2_norm = nn.LayerNorm(hidden_dim)

        # GraphSAGE layer
        self.sage = SAGEConvLayer(hidden_dim, hidden_dim)

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
        )

        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor,
                edge_attr: torch.Tensor = None) -> dict:
        """
        Args:
            x: (num_nodes, 7) node features
            edge_index: (2, num_edges) edge connectivity
            edge_attr: (num_edges, 1) edge features (log amount)
        Returns:
            dict with 'logits', 'probabilities', 'node_embeddings'
        """
        # Project node features
        h = self.node_proj(x)

        # GAT layer 1
        h_gat1 = self.gat1(h, edge_index, edge_attr)
        h = self.gat1_norm(F.gelu(h_gat1) + h)  # residual
        h = self.dropout(h)

        # GAT layer 2
        h_gat2 = self.gat2(h, edge_index, edge_attr)
        h = self.gat2_norm(F.gelu(h_gat2) + h)  # residual
        h = self.dropout(h)

        # SAGE layer
        h = self.sage(h, edge_index)

        # Node embeddings (useful for downstream tasks)
        node_embeddings = h

        # Classify
        logits = self.classifier(h)
        probs = torch.sigmoid(logits)

        return {
            "logits": logits,
            "probabilities": probs,
            "node_embeddings": node_embeddings,
        }

    def predict(self, x, edge_index, edge_attr=None):
        """Inference — returns per-node fraud probability."""
        with torch.no_grad():
            out = self.forward(x, edge_index, edge_attr)
            return {
                "fraud_probability": out["probabilities"].squeeze(-1).cpu().numpy(),
                "embeddings": out["node_embeddings"].cpu().numpy(),
            }
