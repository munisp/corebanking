"""54Bank — Transaction Anomaly Detection via Variational Autoencoder
Architecture: VAE with encoder-decoder, reparameterization trick,
              KL divergence regularization. Anomaly score = reconstruction error.
Input: 11 transaction features (numerical)
Output: Reconstruction + anomaly score
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class TransactionVAE(nn.Module):
    """Variational Autoencoder for transaction anomaly detection.

    Trained on normal transactions only. At inference time,
    transactions with high reconstruction error are flagged as anomalies.

    Architecture:
        Encoder: input(11) → 64 → 32 → (μ, logσ²) of dim 16
        Decoder: 16 → 32 → 64 → 11
        Loss: MSE reconstruction + β * KL divergence

    Input features (11):
        amount_log, hour_sin, hour_cos, day_sin, day_cos,
        velocity_1h, velocity_24h, amount_vs_avg, balance_ratio,
        merchant_cat_idx (embedded to 8), channel_idx (embedded to 4)
    """

    def __init__(self, input_dim: int = 11, latent_dim: int = 16,
                 hidden_dims: list = None, beta: float = 0.5):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [64, 32]

        self.input_dim = input_dim
        self.latent_dim = latent_dim
        self.beta = beta

        # Merchant + channel embeddings (applied before encoder)
        self.emb_merchant = nn.Embedding(20, 8)
        self.emb_channel = nn.Embedding(7, 4)
        # raw numerical dims = 9, + 8 + 4 = 21
        actual_input = 9 + 8 + 4  # 21

        # Encoder
        encoder_layers = []
        prev_dim = actual_input
        for h_dim in hidden_dims:
            encoder_layers.extend([
                nn.Linear(prev_dim, h_dim),
                nn.BatchNorm1d(h_dim),
                nn.LeakyReLU(0.2),
            ])
            prev_dim = h_dim

        self.encoder = nn.Sequential(*encoder_layers)
        self.fc_mu = nn.Linear(hidden_dims[-1], latent_dim)
        self.fc_logvar = nn.Linear(hidden_dims[-1], latent_dim)

        # Decoder
        decoder_layers = []
        prev_dim = latent_dim
        for h_dim in reversed(hidden_dims):
            decoder_layers.extend([
                nn.Linear(prev_dim, h_dim),
                nn.BatchNorm1d(h_dim),
                nn.LeakyReLU(0.2),
            ])
            prev_dim = h_dim

        decoder_layers.append(nn.Linear(prev_dim, actual_input))
        self.decoder = nn.Sequential(*decoder_layers)

    def encode(self, x: torch.Tensor) -> tuple:
        h = self.encoder(x)
        mu = self.fc_mu(h)
        logvar = self.fc_logvar(h)
        return mu, logvar

    def reparameterize(self, mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
        if self.training:
            std = torch.exp(0.5 * logvar)
            eps = torch.randn_like(std)
            return mu + eps * std
        return mu

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        return self.decoder(z)

    def forward(self, num_features: torch.Tensor,
                merchant_idx: torch.Tensor,
                channel_idx: torch.Tensor) -> dict:
        """
        Args:
            num_features: (batch, 9) float — amount_log through balance_ratio
            merchant_idx: (batch,) long [0..19]
            channel_idx: (batch,) long [0..6]
        Returns:
            dict with 'reconstruction', 'mu', 'logvar', 'z'
        """
        e_merchant = self.emb_merchant(merchant_idx)
        e_channel = self.emb_channel(channel_idx)
        x = torch.cat([num_features, e_merchant, e_channel], dim=-1)

        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        reconstruction = self.decode(z)

        return {
            "input": x,
            "reconstruction": reconstruction,
            "mu": mu,
            "logvar": logvar,
            "z": z,
        }

    def loss_function(self, output: dict) -> dict:
        """Compute VAE loss = reconstruction + β * KL divergence."""
        x = output["input"]
        recon = output["reconstruction"]
        mu = output["mu"]
        logvar = output["logvar"]

        recon_loss = F.mse_loss(recon, x, reduction="mean")
        kl_loss = -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())
        total_loss = recon_loss + self.beta * kl_loss

        return {
            "loss": total_loss,
            "recon_loss": recon_loss,
            "kl_loss": kl_loss,
        }

    def anomaly_score(self, num_features: torch.Tensor,
                      merchant_idx: torch.Tensor,
                      channel_idx: torch.Tensor) -> torch.Tensor:
        """Compute anomaly score (reconstruction error) for each sample."""
        with torch.no_grad():
            output = self.forward(num_features, merchant_idx, channel_idx)
            # Per-sample reconstruction error
            recon_error = (output["input"] - output["reconstruction"]).pow(2).mean(dim=-1)
            return recon_error
