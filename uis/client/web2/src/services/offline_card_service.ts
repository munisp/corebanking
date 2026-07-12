/**
 * Offline Card Service
 * Handles storing and retrieving card data for offline access
 */

import { cardService, type Card } from './card_service';
import { dbManager } from '../utils/indexedDB';
import { encryptData, decryptData } from '../utils/encryption';

export class OfflineCardService {
  /**
   * Get user ID for encryption
   */
  private getUserId(): string {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id || user.keycloak_id || user.keycloakId || 'default';
      } catch {
        return 'default';
      }
    }
    return 'default';
  }

  /**
   * Fetch and cache cards for offline access
   */
  async cacheCards(): Promise<void> {
    try {
      const response = await cardService.getCustomerCards();
      if (response.success && response.data) {
        const userId = this.getUserId();
        const encryptedCards = await Promise.all(
          response.data.map(async (card) => {
            const cardData = JSON.stringify({
              id: card.id,
              cardNumber: card.cardNumber,
              maskedCardNumber: card.maskedCardNumber,
              expiryDate: card.expiryDate,
              cvv: card.cvv,
              cardType: card.cardType,
              status: card.status,
              nameOnCard: card.nameOnCard || card.name_on_card,
            });
            const encryptedData = await encryptData(cardData, userId);
            return {
              id: card.id,
              encryptedData,
              userId,
            };
          })
        );
        await dbManager.saveCards(encryptedCards);
      }
    } catch (error) {
      console.error('[OfflineCardService] Failed to cache cards:', error);
      throw error;
    }
  }

  /**
   * Get cached cards (decrypted)
   */
  async getCachedCards(): Promise<Card[]> {
    try {
      const userId = this.getUserId();
      const encryptedCards = await dbManager.getCards(userId);
      
      const decryptedCards = await Promise.all(
        encryptedCards.map(async (encryptedCard) => {
          try {
            const decryptedData = await decryptData(encryptedCard.encryptedData, userId);
            return JSON.parse(decryptedData) as Card;
          } catch (error) {
            console.error('[OfflineCardService] Failed to decrypt card:', error);
            return null;
          }
        })
      );

      return decryptedCards.filter((card): card is Card => card !== null);
    } catch (error) {
      console.error('[OfflineCardService] Failed to get cached cards:', error);
      return [];
    }
  }

  /**
   * Clear cached cards (call on logout)
   */
  async clearCachedCards(): Promise<void> {
    const userId = this.getUserId();
    await dbManager.clearCards(userId);
  }

  /**
   * Get cards (online or offline)
   */
  async getCards(): Promise<{ success: boolean; data?: Card[]; message?: string; fromCache?: boolean }> {
    const isOnline = navigator.onLine;
    
    if (isOnline) {
      try {
        const response = await cardService.getCustomerCards();
        if (response.success && response.data) {
          // Cache for offline use
          await this.cacheCards().catch((err) => {
            console.error('[OfflineCardService] Failed to cache after fetch:', err);
          });
        }
        return response;
      } catch (error) {
        // If online fetch fails, try cache
        const cached = await this.getCachedCards();
        if (cached.length > 0) {
          return {
            success: true,
            data: cached,
            fromCache: true,
            message: 'Using cached data',
          };
        }
        throw error;
      }
    } else {
      // Offline - use cache
      const cached = await this.getCachedCards();
      if (cached.length > 0) {
        return {
          success: true,
          data: cached,
          fromCache: true,
          message: 'Offline mode - showing cached cards',
        };
      }
      return {
        success: false,
        message: 'No cached cards available. Please connect to the internet to load your cards.',
      };
    }
  }
}

export const offlineCardService = new OfflineCardService();

