/**
 * Africa's Talking Integration Service
 * Handles SMS, USSD, and WhatsApp communication through Africa's Talking API
 */

const AFRICAS_TALKING_CONFIG = {
  sandbox: {
    sms: "https://api.sandbox.africastalking.com/version1/messaging",
    ussd: "https://api.sandbox.africastalking.com/version1/messaging",
    whatsapp: "https://chat.sandbox.africastalking.com/whatsapp/message/send",
    template: "https://chat.sandbox.africastalking.com/whatsapp/template/send",
  },
  live: {
    sms: "https://api.africastalking.com/version1/messaging",
    ussd: "https://api.africastalking.com/version1/messaging",
    whatsapp: "https://chat.africastalking.com/whatsapp/message/send",
    template: "https://chat.africastalking.com/whatsapp/template/send",
  },
};

interface AfricasTalkingCredentials {
  username: string;
  apiKey: string;
  environment: "sandbox" | "live";
  senderId?: string; // For SMS
  shortCode?: string; // For USSD
  waNumber?: string; // For WhatsApp
}

interface SMSPayload {
  to: string[];
  message: string;
  from?: string;
  enqueue?: boolean;
}

interface WhatsAppPayload {
  phoneNumber: string;
  message?: string;
  mediaType?: "Image" | "Video" | "Audio" | "Voice";
  url?: string;
  caption?: string;
  buttons?: Array<{ id: string; title: string }>;
}

interface USSDRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
  networkCode: string;
}

class AfricasTalkingService {
  private credentials: AfricasTalkingCredentials | null = null;

  /**
   * Initialize Africa's Talking service with credentials
   */
  initialize(credentials: AfricasTalkingCredentials) {
    this.credentials = credentials;
  }

  /**
   * Get the base URL for a specific service
   */
  private getBaseUrl(
    service: "sms" | "ussd" | "whatsapp" | "template",
  ): string {
    if (!this.credentials) {
      throw new Error(
        "Africa's Talking service not initialized. Call initialize() first.",
      );
    }
    return AFRICAS_TALKING_CONFIG[this.credentials.environment][service];
  }

  /**
   * Get standard request headers
   */
  private getHeaders(
    contentType: string = "application/x-www-form-urlencoded",
  ): HeadersInit {
    if (!this.credentials) {
      throw new Error("Africa's Talking service not initialized");
    }

    return {
      apiKey: this.credentials.apiKey,
      "Content-Type": contentType,
      Accept: "application/json",
    };
  }

  /**
   * Send SMS
   */
  async sendSMS(payload: SMSPayload): Promise<any> {
    if (!this.credentials) {
      throw new Error("Africa's Talking service not initialized");
    }

    const url = this.getBaseUrl("sms");

    const formData = new URLSearchParams();
    formData.append("username", this.credentials.username);
    formData.append("to", payload.to.join(","));
    formData.append("message", payload.message);

    if (payload.from || this.credentials.senderId) {
      formData.append("from", payload.from || this.credentials.senderId || "");
    }

    if (payload.enqueue !== undefined) {
      formData.append("enqueue", payload.enqueue ? "1" : "0");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SMS failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Fetch SMS messages
   */
  async fetchSMS(lastReceivedId: number = 0): Promise<any> {
    if (!this.credentials) {
      throw new Error("Africa's Talking service not initialized");
    }

    const url = `${this.getBaseUrl("sms")}?username=${this.credentials.username}&lastReceivedId=${lastReceivedId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fetch SMS failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(payload: WhatsAppPayload): Promise<any> {
    if (!this.credentials) {
      throw new Error("Africa's Talking service not initialized");
    }

    if (!this.credentials.waNumber) {
      throw new Error("WhatsApp number (waNumber) not configured");
    }

    const url = this.getBaseUrl("whatsapp");

    const body: any = {
      username: this.credentials.username,
      waNumber: this.credentials.waNumber,
      phoneNumber: payload.phoneNumber,
      body: {},
    };

    // Simple text message
    if (payload.message && !payload.mediaType) {
      body.body.message = payload.message;
    }
    // Media message
    else if (payload.mediaType && payload.url) {
      body.body.mediaType = payload.mediaType;
      body.body.url = payload.url;
      if (payload.caption) {
        body.body.caption = payload.caption;
      }
    }
    // Interactive buttons
    else if (payload.buttons) {
      body.body.header = { text: payload.message || "Please select an option" };
      body.body.action = { buttons: payload.buttons };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders("application/json"),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp send failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Create WhatsApp template
   */
  async createWhatsAppTemplate(template: {
    name: string;
    language: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
    components: any;
  }): Promise<any> {
    if (!this.credentials) {
      throw new Error("Africa's Talking service not initialized");
    }

    if (!this.credentials.waNumber) {
      throw new Error("WhatsApp number (waNumber) not configured");
    }

    const url = this.getBaseUrl("template");

    const body = {
      username: this.credentials.username,
      waNumber: this.credentials.waNumber,
      ...template,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders("application/json"),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp template creation failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Process USSD request (to be used in your USSD callback endpoint)
   */
  processUSSDRequest(request: USSDRequest): {
    sessionId: string;
    phoneNumber: string;
    text: string;
    serviceCode: string;
    networkCode: string;
  } {
    return {
      sessionId: request.sessionId,
      phoneNumber: request.phoneNumber,
      text: request.text,
      serviceCode: request.serviceCode,
      networkCode: request.networkCode,
    };
  }

  /**
   * Create USSD response
   */
  createUSSDResponse(
    message: string,
    continueSession: boolean = false,
  ): string {
    const prefix = continueSession ? "CON" : "END";
    return `${prefix} ${message}`;
  }

  /**
   * Get network name from network code
   */
  getNetworkName(networkCode: string): string {
    const networks: Record<string, string> = {
      "62006": "AirtelTigo Ghana",
      "62002": "Vodafone Ghana",
      "62001": "MTN Ghana",
      "62120": "Airtel Nigeria",
      "62130": "MTN Nigeria",
      "62150": "Glo Nigeria",
      "62160": "Etisalat Nigeria",
      "63510": "MTN Rwanda",
      "63513": "Tigo Rwanda",
      "63514": "Airtel Rwanda",
      "63601": "EthioTelecom Ethiopia",
      "63902": "Safaricom Kenya",
      "63903": "Airtel Kenya",
      "63907": "Orange Kenya",
      "63999": "Equitel Kenya",
      "64002": "Tigo Tanzania",
      "64004": "Vodacom Tanzania",
      "64005": "Airtel Tanzania",
      "64101": "Airtel Uganda",
      "64110": "MTN Uganda",
      "64114": "Africell Uganda",
      "64501": "Airtel Zambia",
      "64502": "MTN Zambia",
      "65001": "TNM Malawi",
      "65010": "Airtel Malawi",
      "65501": "Vodacom South Africa",
      "65502": "Telkom South Africa",
      "65507": "CellC South Africa",
      "65510": "MTN South Africa",
      "99999": "Sandbox",
    };

    return networks[networkCode] || "Unknown Network";
  }
}

// Export singleton instance
export const africasTalkingService = new AfricasTalkingService();
export default africasTalkingService;
