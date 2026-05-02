// Aura System Service Layer
// Handles all API calls and business logic for Aura management

class AuraService {
  constructor() {
    this.baseUrl = '/api/auras';
    this.transactions = [];
    this.balances = {};
  }

  /**
   * Get user's current Aura balance
   */
  async getBalance(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/balance/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch balance');
      return await response.json();
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  /**
   * Get all transactions for a user
   */
  async getTransactions(userId, filters = {}) {
    try {
      const queryParams = new URLSearchParams({
        userId,
        ...(filters.type && { type: filters.type }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.category && { category: filters.category }),
      });

      const response = await fetch(
        `${this.baseUrl}/transactions?${queryParams}`
      );
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return await response.json();
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Get farming mode status for a user
   */
  async getFarmingModeStatus(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/farming-mode/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch farming mode status');
      return await response.json();
    } catch (error) {
      console.error('Error fetching farming mode status:', error);
      throw error;
    }
  }

  /**
   * Toggle farming mode on/off for a user
   */
  async toggleFarmingMode(userId, enabled) {
    try {
      const response = await fetch(`${this.baseUrl}/farming-mode/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to update farming mode');
      return await response.json();
    } catch (error) {
      console.error('Error updating farming mode:', error);
      throw error;
    }
  }

  /**
   * Gift Auras from staff to student
   */
  async giftToStudent(fromUserId, toUserId, amount, reason) {
    try {
      const response = await fetch(`${this.baseUrl}/gift/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId,
          toUserId,
          amount,
          reason,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to gift Auras');
      return await response.json();
    } catch (error) {
      console.error('Error gifting Auras to student:', error);
      throw error;
    }
  }

  /**
   * Gift Auras from staff to staff (requires 5 month farming mode)
   */
  async giftToStaff(fromUserId, toUserId, amount, reason) {
    try {
      const response = await fetch(`${this.baseUrl}/gift/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId,
          toUserId,
          amount,
          reason,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to gift Auras to staff member');
      return await response.json();
    } catch (error) {
      console.error('Error gifting Auras to staff:', error);
      throw error;
    }
  }

  /**
   * Spend Auras for a premium feature
   */
  async spendAuras(userId, amount, category, reason, relatedId) {
    try {
      const response = await fetch(`${this.baseUrl}/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount,
          category,
          reason,
          relatedId,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to spend Auras');
      return await response.json();
    } catch (error) {
      console.error('Error spending Auras:', error);
      throw error;
    }
  }

  /**
   * Get pending staff-to-staff gift offers
   */
  async getPendingStaffGifts(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/gifts/staff/pending/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch pending gifts');
      return await response.json();
    } catch (error) {
      console.error('Error fetching pending staff gifts:', error);
      throw error;
    }
  }

  /**
   * Accept staff-to-staff gift
   */
  async acceptStaffGift(giftId) {
    try {
      const response = await fetch(`${this.baseUrl}/gifts/staff/${giftId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to accept gift');
      return await response.json();
    } catch (error) {
      console.error('Error accepting staff gift:', error);
      throw error;
    }
  }

  /**
   * Decline staff-to-staff gift
   */
  async declineStaffGift(giftId) {
    try {
      const response = await fetch(`${this.baseUrl}/gifts/staff/${giftId}/decline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to decline gift');
      return await response.json();
    } catch (error) {
      console.error('Error declining staff gift:', error);
      throw error;
    }
  }

  /**
   * Request cashout for staff
   */
  async requestCashout(userId, amount, paymentMethod, bankDetails) {
    try {
      const response = await fetch(`${this.baseUrl}/cashout/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount,
          paymentMethod,
          bankDetails,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to request cashout');
      return await response.json();
    } catch (error) {
      console.error('Error requesting cashout:', error);
      throw error;
    }
  }

  /**
   * Get cashout history for staff
   */
  async getCashoutHistory(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/cashout/history/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch cashout history');
      return await response.json();
    } catch (error) {
      console.error('Error fetching cashout history:', error);
      throw error;
    }
  }

  /**
   * Transfer Auras from parent to child (if allowed)
   */
  async transferAuresToChild(parentUserId, childUserId, amount) {
    try {
      const response = await fetch(`${this.baseUrl}/transfer/parent-to-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: parentUserId,
          toUserId: childUserId,
          amount,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to transfer Auras');
      return await response.json();
    } catch (error) {
      console.error('Error transferring Auras:', error);
      throw error;
    }
  }

  /**
   * Get analytics for Aura system (HoS / Owner)
   */
  async getAuraAnalytics(filters = {}) {
    try {
      const queryParams = new URLSearchParams({
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.role && { role: filters.role }),
      });

      const response = await fetch(
        `${this.baseUrl}/analytics?${queryParams}`
      );
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return await response.json();
    } catch (error) {
      console.error('Error fetching Aura analytics:', error);
      throw error;
    }
  }

  /**
   * Get Aura tier information
   */
  async getAuraTier(balance) {
    try {
      const response = await fetch(`${this.baseUrl}/tier/${balance}`);
      if (!response.ok) throw new Error('Failed to fetch tier information');
      return await response.json();
    } catch (error) {
      console.error('Error fetching tier information:', error);
      throw error;
    }
  }

  /**
   * Get all spending options available
   */
  async getSpendingOptions(role) {
    try {
      const response = await fetch(`${this.baseUrl}/spending-options/${role}`);
      if (!response.ok) throw new Error('Failed to fetch spending options');
      return await response.json();
    } catch (error) {
      console.error('Error fetching spending options:', error);
      throw error;
    }
  }

  /**
   * Earn Auras for a specific action
   */
  async earnAuras(userId, amount, reason, category, relatedId) {
    try {
      const response = await fetch(`${this.baseUrl}/earn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount,
          reason,
          category,
          relatedId,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to earn Auras');
      return await response.json();
    } catch (error) {
      console.error('Error earning Auras:', error);
      throw error;
    }
  }

  /**
   * Get notification about upcoming reset
   */
  async getResetNotification(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/reset-notification/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch reset notification');
      return await response.json();
    } catch (error) {
      console.error('Error fetching reset notification:', error);
      throw error;
    }
  }

  /**
   * Log ad interaction for farming mode
   */
  async logAdInteraction(userId, adId, context) {
    try {
      const response = await fetch(`${this.baseUrl}/ads/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          adId,
          context,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to log ad interaction');
      return await response.json();
    } catch (error) {
      console.error('Error logging ad interaction:', error);
      // Don't throw - ad logging shouldn't break user experience
      return { success: false };
    }
  }

  /**
   * Log earning activity (for farming mode analytics)
   */
  async logEarningActivity(userId, activity, amount, context) {
    try {
      const response = await fetch(`${this.baseUrl}/earning-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          activity,
          amount,
          context,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Failed to log earning activity');
      return await response.json();
    } catch (error) {
      console.error('Error logging earning activity:', error);
      throw error;
    }
  }
}

// Create singleton instance
const auraService = new AuraService();
export default auraService;
