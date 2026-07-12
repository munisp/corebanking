import { toSnakeCase } from '../utils/textCaseUtils';
import { AppConfig } from '../config/app_config';
import type { AgricultureLoan, AgricultureStats, CropBreakdown, RiskAlert } from '../models/agriculture';
import { apiService } from './api_service';

// Extended interfaces to match mobile app
export interface Farmer {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  location: string;
  farmSize: number;
  cropType: string;
  status: 'active' | 'inactive' | 'pending_verification';
  kycVerified: boolean;
  creditScore?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Farm {
  id: string;
  farmerId: string;
  farmName: string;
  location: string;
  size: number;
  cropTypes: string[];
  soilType?: string;
  irrigationType?: string;
  status: 'active' | 'inactive' | 'under_verification';
  coordinates?: { latitude: number; longitude: number };
  verified: boolean;
  createdAt: Date;
}

export interface InsurancePolicy {
  id: string;
  farmerId: string;
  farmerName: string;
  policyNumber: string;
  cropType: string;
  coverageAmount: number;
  premium: number;
  status: 'active' | 'expired' | 'pending' | 'claimed';
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface Partner {
  id: string;
  name: string;
  type: string;
  category: string;
  contactPerson?: string;
  phoneNumber: string;
  email?: string;
  location: string;
  services: string[];
  status: 'active' | 'inactive';
}

export interface FarmerProduct {
  id: string;
  farmerId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  quality: string;
  harvestDate: Date;
  status: 'available' | 'sold' | 'reserved';
}

export interface ImpactMetrics {
  totalFarmersSupported: number;
  totalLandCultivated: number;
  totalLoansAmount: number;
  averageYieldIncrease: number;
  jobsCreated: number;
  incomeIncrease: number;
  environmentalImpact: {
    carbonSequestration: number;
    waterSaved: number;
    chemicalsReduced: number;
  };
}

export interface AgTechDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  price: number;
  features: string[];
  status: 'available' | 'out_of_stock' | 'discontinued';
}

export interface DeviceOrder {
  id: string;
  farmerId: string;
  deviceId: string;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: Date;
  deliveryDate?: Date;
}

class AgricultureService {
  private readonly agriBasePath = '/agricultural/api/v1/agriculture';
  private readonly agtechBasePath = '/agricultural/api/v1/agtech';
  private readonly farmerIdsKey = 'agriculture_v2_farmer_ids';
  private readonly farmIdsKey = 'agriculture_v2_farm_ids';
  private readonly loanIdsKey = 'agriculture_v2_loan_ids';

  private getStoredIds(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private storeId(key: string, id: string): void {
    if (!id) return;
    const current = this.getStoredIds(key);
    if (current.includes(id)) return;
    localStorage.setItem(key, JSON.stringify([id, ...current].slice(0, 200)));
  }

  private getTenantId(): string {
    const configured = localStorage.getItem('tenant_id') || localStorage.getItem('x-tenant-id');
    if (configured) return configured;
    return AppConfig.DEFAULT_TENANT_ID;
  }

  // =================== STATISTICS & DASHBOARD ===================
  
  async getStats(): Promise<AgricultureStats> {
    try {
      const [portfolioRes] = await Promise.all([
        apiService.get(`${this.agriBasePath}/analytics/portfolio`).catch(() => ({ data: {} })),
      ]);

      const portfolio = portfolioRes.data as Record<string, unknown>;

      const totalDisbursed = Number(portfolio.total_disbursed || 0);
      const totalRepaid = Number(portfolio.total_repaid || 0);
      const totalLoansOutstanding = Number(portfolio.total_outstanding || Math.max(0, totalDisbursed - totalRepaid));
      const totalActiveFarmers = Number(portfolio.total_active_farmers || this.getStoredIds(this.farmerIdsKey).length);
      const nplRatio = Number(portfolio.npl_ratio || 0);
      const portfolioHealth = Number(portfolio.portfolio_health || Math.max(0, 100 - nplRatio));

      return {
        totalLoansOutstanding,
        totalActiveFarmers,
        totalCropValue: Number(portfolio.total_crop_value || 0),
        portfolioHealth,
        nplRatio,
        avgLoanSize: Number(portfolio.avg_loan_size || 0),
        totalDisbursed,
        totalRepaid,
      };
    } catch (error) {
      console.error('Error fetching agriculture stats:', error);
      throw error;
    }
  }

  async getCropBreakdown(): Promise<CropBreakdown[]> {
    try {
      const response = await apiService.get(`${AppConfig.agricultureEndpoint}/crops`);
      if (response.status === 200) {
        return response.data as CropBreakdown[];
      }
      throw new Error('Failed to fetch crop breakdown');
    } catch (error) {
      console.error('Error fetching crop breakdown:', error);
      throw error;
    }
  }

  async getFarmsCount(): Promise<number> {
    try {
      return this.getStoredIds(this.farmIdsKey).length;
    } catch (error) {
      console.error('Error fetching farms count:', error);
      return 0;
    }
  }

  async getFarmersCount(): Promise<number> {
    try {
      return this.getStoredIds(this.farmerIdsKey).length;
    } catch (error) {
      console.error('Error fetching farmers count:', error);
      return 0;
    }
  }

  // =================== FARMERS MANAGEMENT ===================
  
  async getFarmers(params?: { status?: string; page?: number; pageSize?: number }): Promise<Farmer[]> {
    try {
      const ids = this.getStoredIds(this.farmerIdsKey);
      const farmers = await Promise.all(
        ids.map(async (id) => {
          try {
            return await this.getFarmer(id);
          } catch {
            return null;
          }
        }),
      );

      const filtered = farmers.filter((f): f is Farmer => Boolean(f));
      if (!params?.status) return filtered;
      return filtered.filter((f) => f.status === params.status);
    } catch (error) {
      console.error('Error fetching farmers:', error);
      return [];
    }
  }

  async getFarmer(farmerId: string): Promise<Farmer> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/farmers/${farmerId}`);
      return this.parseFarmer(response.data as Record<string, unknown>);
    } catch (error) {
      console.error(`Error fetching farmer ${farmerId}:`, error);
      throw error;
    }
  }

  async registerFarmer(farmerData: Partial<Farmer> & Record<string, unknown>): Promise<Farmer> {
    try {
      const payload = this.toSnakeCase({
        ...farmerData,
        tenant_id: farmerData.tenant_id || this.getTenantId(),
      });
      const response = await apiService.post(`${this.agriBasePath}/farmers`, payload);
      const farmer = this.parseFarmer(response.data as Record<string, unknown>);
      this.storeId(this.farmerIdsKey, farmer.id);
      return farmer;
    } catch (error) {
      console.error('Error registering farmer:', error);
      throw error;
    }
  }

  async updateFarmer(farmerId: string, updateData: Partial<Farmer>): Promise<void> {
    try {
      // v2 currently exposes create and get operations for farmers.
      await apiService.post(`${this.agriBasePath}/farmers/${farmerId}`, updateData);
    } catch (error) {
      console.error(`Error updating farmer ${farmerId}:`, error);
      throw error;
    }
  }

  // =================== FARMS MANAGEMENT ===================
  
  async getFarms(params?: { farmerId?: string; status?: string }): Promise<Farm[]> {
    try {
      if (params?.farmerId) {
        const response = await apiService.get(`${this.agriBasePath}/farmers/${params.farmerId}/farms`);
        const data = response.data as Record<string, unknown>;
        const itemsRaw = data?.farms || [];
        const farms = Array.isArray(itemsRaw) ? itemsRaw.map((item: unknown) => this.parseFarm(item)) : [];
        farms.forEach((farm) => this.storeId(this.farmIdsKey, farm.id));
        return params.status ? farms.filter((f) => f.status === params.status) : farms;
      }

      const ids = this.getStoredIds(this.farmIdsKey);
      const farms = await Promise.all(
        ids.map(async (id) => {
          try {
            return await this.getFarm(id);
          } catch {
            return null;
          }
        }),
      );
      const filtered = farms.filter((f): f is Farm => Boolean(f));
      return params?.status ? filtered.filter((f) => f.status === params.status) : filtered;
    } catch (error) {
      console.error('Error fetching farms:', error);
      return [];
    }
  }

  async getFarm(farmId: string): Promise<Farm> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/farms/${farmId}`);
      return this.parseFarm(response.data as Record<string, unknown>);
    } catch (error) {
      console.error(`Error fetching farm ${farmId}:`, error);
      throw error;
    }
  }

  async registerFarm(farmData: Partial<Farm> & Record<string, unknown>): Promise<Farm> {
    try {
      const payload = this.toSnakeCase({
        ...farmData,
        tenant_id: farmData.tenant_id || this.getTenantId(),
      });
      const response = await apiService.post(`${this.agriBasePath}/farms`, payload);
      const farm = this.parseFarm(response.data as Record<string, unknown>);
      this.storeId(this.farmIdsKey, farm.id);
      return farm;
    } catch (error) {
      console.error('Error registering farm:', error);
      throw error;
    }
  }

  async verifyFarm(farmId: string, verifyData: Record<string, unknown>): Promise<void> {
    try {
      await apiService.post(`${this.agriBasePath}/farms/${farmId}/verify`, verifyData);
    } catch (error) {
      console.error(`Error verifying farm ${farmId}:`, error);
      throw error;
    }
  }

  // =================== LOANS MANAGEMENT ===================
  
  async getLoans(params?: { status?: string; farmerId?: string; page?: number; pageSize?: number }): Promise<AgricultureLoan[]> {
    try {
      const ids = this.getStoredIds(this.loanIdsKey);
      const loans = await Promise.all(
        ids.map(async (id) => {
          try {
            return await this.getLoan(id);
          } catch {
            return null;
          }
        }),
      );
      let filtered = loans.filter((l): l is AgricultureLoan => Boolean(l));
      if (params?.status) filtered = filtered.filter((l) => l.status === params.status);
      if (params?.farmerId) {
        filtered = filtered.filter((l) => String((l as unknown as Record<string, unknown>).farmerId || '') === params.farmerId);
      }
      return filtered;
    } catch (error) {
      console.error('Error fetching agriculture loans:', error);
      return [];
    }
  }

  async getLoan(loanId: string): Promise<AgricultureLoan> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/loans/${loanId}`);
      return this.parseLoan(response.data as Record<string, unknown>);
    } catch (error) {
      console.error(`Error fetching loan ${loanId}:`, error);
      throw error;
    }
  }

  async assessLoan(assessData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/loans/assess`, assessData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      console.error('Error assessing loan:', error);
      throw error;
    }
  }

  async createLoan(loanData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      // Convert to snake_case
      const snakeCaseData = this.toSnakeCase({
        ...loanData,
        tenant_id: loanData.tenant_id || this.getTenantId(),
      });
      const response = await apiService.post(`${this.agriBasePath}/loans/apply`, snakeCaseData);
      const created = response.data as Record<string, unknown>;
      const id = String(created.id || created.loan_id || '');
      this.storeId(this.loanIdsKey, id);
      return created;
    } catch (error) {
      console.error('Error creating loan:', error);
      throw error;
    }
  }

  async disburseLoan(loanId: string): Promise<void> {
    try {
      const loan = await this.getLoan(loanId);
      await apiService.post(`${this.agriBasePath}/loans/${loanId}/disburse`, {
        amount: loan.loanAmount,
      });
    } catch (error) {
      console.error(`Error disbursing loan ${loanId}:`, error);
      throw error;
    }
  }

  async processRepayment(loanId: string, repaymentData: Record<string, unknown>): Promise<void> {
    try {
      await apiService.post(`${this.agriBasePath}/loans/${loanId}/repay`, repaymentData);
    } catch (error) {
      console.error(`Error processing repayment for loan ${loanId}:`, error);
      throw error;
    }
  }

  // =================== RISK MANAGEMENT ===================
  
  async getRiskAlerts(params?: { severity?: string; acknowledged?: boolean; page?: number; pageSize?: number }): Promise<RiskAlert[]> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/analytics/risk`);
      const data = response.data as Record<string, unknown>;
      const distribution = Array.isArray(data?.risk_distribution)
        ? (data.risk_distribution as Array<Record<string, unknown>>)
        : [];

      const mapped = distribution.map((entry, idx) => this.parseRiskAlert({
        id: `risk-${idx + 1}`,
        severity: String(entry.risk_level || 'low'),
        message: `Current exposure: NGN ${Number(entry.exposure || 0).toLocaleString()}`,
        crop_type: 'portfolio',
        created_at: new Date().toISOString(),
        acknowledged: false,
      }));

      if (!params?.severity) return mapped;
      return mapped.filter((item) => item.severity === params.severity);
    } catch (error) {
      console.error('Error fetching risk alerts:', error);
      return [];
    }
  }

  async acknowledgeRiskAlert(alertId: string): Promise<RiskAlert> {
    try {
      return this.parseRiskAlert({ id: alertId, acknowledged: true });
    } catch (error) {
      console.error(`Error acknowledging alert ${alertId}:`, error);
      throw error;
    }
  }

  async calculateRisk(riskData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/risk/pricing`, riskData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      console.error('Error calculating risk:', error);
      throw error;
    }
  }

  async getProactiveRiskData(): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/analytics/risk`);
      return (response.data as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Error fetching proactive risk data:', error);
      return {};
    }
  }

  // =================== INSURANCE MANAGEMENT ===================
  
  async getInsurancePolicies(params?: { status?: string; farmerId?: string; page?: number; pageSize?: number }): Promise<InsurancePolicy[]> {
    try {
      const queryParams: Record<string, string | number> = {};
      if (params?.status) queryParams.status = params.status;
      if (params?.farmerId) queryParams.farmer_id = params.farmerId;
      if (params?.page) queryParams.page = params.page;
      if (params?.pageSize) queryParams.limit = params.pageSize;

      const response = await apiService.get(`${this.agriBasePath}/insurance/policies`, { params: queryParams });
      const data = response.data as Record<string, unknown>;
      const itemsRaw = data?.data || response.data || [];
      return Array.isArray(itemsRaw) ? itemsRaw.map((item: unknown) => this.parseInsurancePolicy(item)) : [];
    } catch (error) {
      console.error('Error fetching insurance policies:', error);
      return [];
    }
  }

  async getInsuranceQuote(quoteData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/insurance/quote`, quoteData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      console.error('Error getting insurance quote:', error);
      throw error;
    }
  }

  async purchaseInsurance(purchaseData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/insurance/purchase`, purchaseData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      console.error('Error purchasing insurance:', error);
      throw error;
    }
  }

  // =================== VALUE CHAIN & PARTNERS ===================
  
  async getPartners(params?: { type?: string; category?: string; page?: number; pageSize?: number }): Promise<Partner[]> {
    try {
      const queryParams: Record<string, string | number> = {};
      if (params?.type) queryParams.type = params.type;
      if (params?.category) queryParams.category = params.category;
      if (params?.page) queryParams.page = params.page;
      if (params?.pageSize) queryParams.limit = params.pageSize;

      const response = await apiService.get(`${this.agriBasePath}/partners`, { params: queryParams });
      const data = response.data as Record<string, unknown>;
      const itemsRaw = data?.data || response.data || [];
      return Array.isArray(itemsRaw) ? itemsRaw.map((item: unknown) => this.parsePartner(item)) : [];
    } catch (error) {
      console.error('Error fetching partners:', error);
      return [];
    }
  }

  async getProducts(params?: { category?: string; activeOnly?: boolean }): Promise<FarmerProduct[]> {
    try {
      const queryParams: Record<string, string> = {};
      if (params?.category) queryParams.category = params.category;
      if (params?.activeOnly) queryParams.active = 'true';

      const response = await apiService.get(`${AppConfig.agricultureEndpoint}/products`, { params: queryParams });
      const data = response.data as Record<string, unknown>;
      const itemsRaw = data?.data || response.data || [];
      return Array.isArray(itemsRaw) ? itemsRaw.map((item: unknown) => this.parseFarmerProduct(item)) : [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  // =================== PRICING & MARKET DATA ===================
  
  async getCropPrice(cropType: string, location?: string): Promise<Record<string, unknown>> {
    try {
      const queryParams: Record<string, string> = {};
      if (location) queryParams.location = location;

      const response = await apiService.get(`${this.agriBasePath}/prices/${cropType}`, { params: queryParams });
      return response.data as Record<string, unknown>;
    } catch (error) {
      console.error(`Error fetching price for ${cropType}:`, error);
      throw error;
    }
  }

  async getCropPriceHistory(cropType: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/prices/${cropType}/history`);
      return response.data as Record<string, unknown>;
    } catch (error) {
      console.error(`Error fetching price history for ${cropType}:`, error);
      throw error;
    }
  }

  // =================== AGTECH & DEVICES ===================
  
  async getAgTechDevices(): Promise<AgTechDevice[]> {
    try {
      const response = await apiService.get(`${this.agtechBasePath}/sensors`);
      const data = response.data as Record<string, unknown>;
      const itemsRaw = data?.sensors || response.data || [];
      return Array.isArray(itemsRaw) ? itemsRaw.map((item: unknown) => this.parseAgTechDevice(item)) : [];
    } catch (error) {
      console.error('Error fetching AgTech devices:', error);
      return [];
    }
  }

  async getAgTechDevice(deviceId: string): Promise<AgTechDevice> {
    try {
      const response = await apiService.get(`${this.agtechBasePath}/sensors/${deviceId}`);
      return this.parseAgTechDevice(response.data);
    } catch (error) {
      console.error(`Error fetching device ${deviceId}:`, error);
      throw error;
    }
  }

  async createAgTechDevice(deviceData: Partial<AgTechDevice>): Promise<void> {
    try {
      await apiService.post(`${this.agtechBasePath}/sensors`, this.toSnakeCase(deviceData as Record<string, unknown>));
    } catch (error) {
      console.error('Error creating AgTech device:', error);
      throw error;
    }
  }

  async updateAgTechDevice(deviceId: string, updateData: Partial<AgTechDevice>): Promise<void> {
    try {
      await apiService.put(`${this.agtechBasePath}/sensors/${deviceId}`, this.toSnakeCase(updateData as Record<string, unknown>));
    } catch (error) {
      console.error(`Error updating device ${deviceId}:`, error);
      throw error;
    }
  }

  async deleteAgTechDevice(deviceId: string): Promise<void> {
    try {
      await apiService.delete(`${this.agtechBasePath}/sensors/${deviceId}`);
    } catch (error) {
      console.error(`Error deleting device ${deviceId}:`, error);
      throw error;
    }
  }

  async getDeviceOrders(): Promise<DeviceOrder[]> {
    try {
      const response = await apiService.get(`${this.agtechBasePath}/alerts`);
      const data = response.data as Record<string, unknown>;
      const itemsRaw = data?.alerts || [];
      return Array.isArray(itemsRaw)
        ? itemsRaw.map((item: unknown, index: number) => this.parseDeviceOrder({
            id: `alert-order-${index + 1}`,
            status: 'pending',
            quantity: 1,
            total_price: 0,
            ...((item || {}) as Record<string, unknown>),
          }))
        : [];
    } catch (error) {
      console.error('Error fetching device orders:', error);
      return [];
    }
  }

  async createDeviceOrder(orderData: Partial<DeviceOrder>): Promise<void> {
    try {
      const sensors = await this.getAgTechDevices();
      const selectedSensor = sensors.find((sensor) => sensor.id === orderData.deviceId);
      if (!selectedSensor) {
        throw new Error('Selected device is not available');
      }

      // Sensor registration is currently the closest supported action for device onboarding in v2 AgTech APIs.
      await apiService.post(`${this.agtechBasePath}/sensors`, {
        sensor_id: `ORD-${Date.now()}`,
        sensor_type: selectedSensor.deviceType || 'iot',
        farm_id: orderData.farmerId || 'unknown',
      });
    } catch (error) {
      console.error('Error creating device order:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, statusData: Record<string, unknown>): Promise<void> {
    try {
      await apiService.post(`${this.agtechBasePath}/alerts/${orderId}/resolve`, statusData);
    } catch (error) {
      console.error(`Error updating order status ${orderId}:`, error);
      throw error;
    }
  }

  async getDeviceInstallations(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiService.get(`${this.agtechBasePath}/polygons`);
      const data = response.data as Record<string, unknown>;
      const itemsRaw = data?.polygons || response.data || [];
      return Array.isArray(itemsRaw) ? itemsRaw : [];
    } catch (error) {
      console.error('Error fetching device installations:', error);
      return [];
    }
  }

  async recordDeviceInstallation(installData: Record<string, unknown>): Promise<void> {
    try {
      await apiService.post(`${this.agtechBasePath}/polygons`, installData);
    } catch (error) {
      console.error('Error recording device installation:', error);
      throw error;
    }
  }

  async getDeviceReadings(): Promise<Record<string, unknown>[]> {
    try {
      const sensors = await this.getAgTechDevices();
      const readings = await Promise.all(
        sensors.map(async (sensor) => {
          try {
            const response = await apiService.get(`${this.agtechBasePath}/sensors/${sensor.id}/readings`);
            const data = response.data as Record<string, unknown>;
            const items = Array.isArray(data?.readings) ? data.readings : [];
            return items;
          } catch {
            return [];
          }
        }),
      );
      return readings.flat();
    } catch (error) {
      console.error('Error fetching device readings:', error);
      return [];
    }
  }

  async recordDeviceReading(readingData: Record<string, unknown>): Promise<void> {
    try {
      const sensorId = String(readingData.sensor_id || readingData.sensorId || '');
      if (!sensorId) {
        throw new Error('sensor_id is required to submit a reading');
      }
      await apiService.post(`${this.agtechBasePath}/sensors/${sensorId}/readings`, readingData);
    } catch (error) {
      console.error('Error recording device reading:', error);
      throw error;
    }
  }

  async getAgTechData(): Promise<Record<string, unknown>> {
    try {
      const [sensorsRes, polygonsRes, alertsRes] = await Promise.all([
        apiService.get(`${this.agtechBasePath}/sensors`).catch(() => ({ data: {} })),
        apiService.get(`${this.agtechBasePath}/polygons`).catch(() => ({ data: {} })),
        apiService.get(`${this.agtechBasePath}/alerts`).catch(() => ({ data: {} })),
      ]);

      const sensors = (sensorsRes.data as Record<string, unknown>)?.sensors;
      const polygons = (polygonsRes.data as Record<string, unknown>)?.polygons;
      const alerts = (alertsRes.data as Record<string, unknown>)?.alerts;

      return {
        TotalDevices: Array.isArray(sensors) ? sensors.length : 0,
        TotalInstallations: Array.isArray(polygons) ? polygons.length : 0,
        TotalOrders: Array.isArray(alerts) ? alerts.length : 0,
      };
    } catch (error) {
      console.error('Error fetching AgTech data:', error);
      return {};
    }
  }

  // =================== METRICS & REPORTING ===================
  
  async getImpactMetrics(): Promise<ImpactMetrics> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/analytics/portfolio`);
      return this.parseImpactMetrics(response.data as Record<string, unknown>);
    } catch (error) {
      console.error('Error fetching impact metrics:', error);
      throw error;
    }
  }

  async getInclusiveAccessStats(): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/analytics/portfolio`);
      return (response.data as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Error fetching inclusive access stats:', error);
      return {};
    }
  }

  async getRegulatoryData(): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/reports/regulator`);
      return (response.data as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Error fetching regulatory data:', error);
      return {};
    }
  }

  // =================== PARSING HELPERS ===================
  
  private parseFarmer(data: unknown): Farmer {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.farmer_id || ''),
      name: String(d.name || d.full_name || ''),
      phoneNumber: String(d.phone_number || d.phoneNumber || ''),
      email: d.email ? String(d.email) : undefined,
      location: String(d.location || d.farm_location || ''),
      farmSize: Number(d.farm_size || d.farmSize || 0),
      cropType: String(d.crop_type || d.cropType || d.primary_crop || ''),
      status: (d.status || 'pending_verification') as Farmer['status'],
      kycVerified: Boolean(d.kyc_verified || d.kycVerified),
      creditScore: d.credit_score || d.creditScore ? Number(d.credit_score || d.creditScore) : undefined,
      createdAt: d.created_at || d.createdAt ? new Date(d.created_at as string || d.createdAt as string) : new Date(),
      updatedAt: d.updated_at || d.updatedAt ? new Date(d.updated_at as string || d.updatedAt as string) : undefined,
    };
  }

  private parseFarm(data: unknown): Farm {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.farm_id || ''),
      farmerId: String(d.farmer_id || d.farmerId || ''),
      farmName: String(d.farm_name || d.farmName || ''),
      location: String(d.location || ''),
      size: Number(d.size || 0),
      cropTypes: Array.isArray(d.crop_types || d.cropTypes)
        ? (d.crop_types || d.cropTypes) as string[]
        : (d.current_crop ? [String(d.current_crop)] : []),
      soilType: d.soil_type || d.soilType ? String(d.soil_type || d.soilType) : undefined,
      irrigationType: d.irrigation_type || d.irrigationType ? String(d.irrigation_type || d.irrigationType) : undefined,
      status: (d.status || 'under_verification') as Farm['status'],
      coordinates: d.coordinates ? {
        latitude: Number((d.coordinates as Record<string, unknown>).latitude),
        longitude: Number((d.coordinates as Record<string, unknown>).longitude),
      } : undefined,
      verified: Boolean(d.verified),
      createdAt: d.created_at || d.createdAt ? new Date(d.created_at as string || d.createdAt as string) : new Date(),
    };
  }

  private parseRiskAlert(data: unknown): RiskAlert {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || ''),
      severity: (d.severity || 'low') as RiskAlert['severity'],
      message: String(d.message || ''),
      farmerId: String(d.farmerId || d.farmer_id || ''),
      farmerName: String(d.farmerName || d.farmer_name || ''),
      cropType: String(d.cropType || d.crop_type || ''),
      loanAmount: Number(d.loanAmount || d.loan_amount || 0),
      createdAt: d.createdAt || d.created_at ? new Date(d.createdAt as string || d.created_at as string) : new Date(),
      acknowledged: Boolean(d.acknowledged),
    };
  }

  private parseLoan(data: unknown): AgricultureLoan {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.loan_id || ''),
      farmerName: String(d.farmerName || d.farmer_name || ''),
      farmSize: Number(d.farmSize || d.farm_size || 0),
      cropType: String(d.cropType || d.crop_type || ''),
      loanAmount: Number(d.loanAmount || d.loan_amount || 0),
      purpose: String(d.purpose || d.loan_purpose || ''),
      term: Number(d.term || d.tenor_days || 0),
      interestRate: Number(d.interestRate || d.interest_rate || 0),
      status: String(d.status || 'pending'),
      disbursementDate: d.disbursementDate || d.disbursement_date ? new Date(d.disbursementDate as string || d.disbursement_date as string) : undefined,
      applicationDate: d.applicationDate || d.application_date ? new Date(d.applicationDate as string || d.application_date as string) : new Date(),
    };
  }

  private parseInsurancePolicy(data: unknown): InsurancePolicy {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.policy_id || ''),
      farmerId: String(d.farmer_id || d.farmerId || ''),
      farmerName: String(d.farmer_name || d.farmerName || ''),
      policyNumber: String(d.policy_number || d.policyNumber || ''),
      cropType: String(d.crop_type || d.cropType || ''),
      coverageAmount: Number(d.coverage_amount || d.coverageAmount || 0),
      premium: Number(d.premium || 0),
      status: (d.status || 'pending') as InsurancePolicy['status'],
      startDate: d.start_date || d.startDate ? new Date(d.start_date as string || d.startDate as string) : new Date(),
      endDate: d.end_date || d.endDate ? new Date(d.end_date as string || d.endDate as string) : new Date(),
      createdAt: d.created_at || d.createdAt ? new Date(d.created_at as string || d.createdAt as string) : new Date(),
    };
  }

  private parsePartner(data: unknown): Partner {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.partner_id || ''),
      name: String(d.name || ''),
      type: String(d.type || ''),
      category: String(d.category || ''),
      contactPerson: d.contact_person || d.contactPerson ? String(d.contact_person || d.contactPerson) : undefined,
      phoneNumber: String(d.phone_number || d.phoneNumber || ''),
      email: d.email ? String(d.email) : undefined,
      location: String(d.location || ''),
      services: Array.isArray(d.services) ? d.services as string[] : [],
      status: (d.status || 'active') as Partner['status'],
    };
  }

  private parseFarmerProduct(data: unknown): FarmerProduct {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.product_id || ''),
      farmerId: String(d.farmer_id || d.farmerId || ''),
      productName: String(d.product_name || d.productName || ''),
      category: String(d.category || ''),
      quantity: Number(d.quantity || 0),
      unit: String(d.unit || ''),
      pricePerUnit: Number(d.price_per_unit || d.pricePerUnit || 0),
      quality: String(d.quality || ''),
      harvestDate: d.harvest_date || d.harvestDate ? new Date(d.harvest_date as string || d.harvestDate as string) : new Date(),
      status: (d.status || 'available') as FarmerProduct['status'],
    };
  }

  private parseAgTechDevice(data: unknown): AgTechDevice {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.device_id || d.sensor_id || ''),
      deviceName: String(d.device_name || d.deviceName || d.name || d.sensor_type || 'Sensor Device'),
      deviceType: String(d.device_type || d.deviceType || d.sensor_type || ''),
      manufacturer: String(d.manufacturer || d.vendor || ''),
      model: String(d.model || d.sensor_model || ''),
      price: Number(d.price || d.unit_price || 0),
      features: Array.isArray(d.features) ? d.features as string[] : [],
      status: (d.status || 'available') as AgTechDevice['status'],
    };
  }

  private parseDeviceOrder(data: unknown): DeviceOrder {
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id || d.order_id || ''),
      farmerId: String(d.farmer_id || d.farmerId || ''),
      deviceId: String(d.device_id || d.deviceId || ''),
      quantity: Number(d.quantity || 0),
      totalPrice: Number(d.total_price || d.totalPrice || 0),
      status: (d.status || 'pending') as DeviceOrder['status'],
      orderDate: d.order_date || d.orderDate ? new Date(d.order_date as string || d.orderDate as string) : new Date(),
      deliveryDate: d.delivery_date || d.deliveryDate ? new Date(d.delivery_date as string || d.deliveryDate as string) : undefined,
    };
  }

  private parseImpactMetrics(data: unknown): ImpactMetrics {
    const d = data as Record<string, unknown>;
    const envImpact = (d.environmental_impact || d.environmentalImpact || {}) as Record<string, unknown>;
    return {
      totalFarmersSupported: Number(d.total_farmers_supported || d.totalFarmersSupported || this.getStoredIds(this.farmerIdsKey).length),
      totalLandCultivated: Number(d.total_land_cultivated || d.totalLandCultivated || this.getStoredIds(this.farmIdsKey).length),
      totalLoansAmount: Number(d.total_loans_amount || d.totalLoansAmount || d.total_disbursed || 0),
      averageYieldIncrease: Number(d.average_yield_increase || d.averageYieldIncrease || 0),
      jobsCreated: Number(d.jobs_created || d.jobsCreated || 0),
      incomeIncrease: Number(d.income_increase || d.incomeIncrease || 0),
      environmentalImpact: {
        carbonSequestration: Number(envImpact.carbon_sequestration || envImpact.carbonSequestration || 0),
        waterSaved: Number(envImpact.water_saved || envImpact.waterSaved || 0),
        chemicalsReduced: Number(envImpact.chemicals_reduced || envImpact.chemicalsReduced || 0),
      },
    };
  }

  // =================== WEATHER & COMMODITY PRICES ===================

  async getWeatherForecast(location: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/weather/forecast?location=${encodeURIComponent(location)}`).catch(() => apiService.get(`${this.agriBasePath}/weather/${encodeURIComponent(location)}`));
      return response.data as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async getWeatherRisk(location: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/weather/risk?location=${encodeURIComponent(location)}`).catch(() => ({ data: {} }));
      return response.data as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async getCommodityPrices(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiService.get('/agricultural/api/v1/integrations/commodity/prices').catch(() => ({ data: { prices: [] } }));
      const data = response.data as Record<string, unknown>;
      return (data.prices as Record<string, unknown>[]) || [];
    } catch {
      return [];
    }
  }

  async getCommodityPriceByType(commodity: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/prices/${encodeURIComponent(commodity)}`).catch(() => ({ data: {} }));
      return response.data as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // =================== FARMER-FIRST PRODUCTS ===================

  async getCropCalendars(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/crop-calendars`).catch(() => ({ data: { calendars: [] } }));
      const data = response.data as Record<string, unknown>;
      return (data.calendars as Record<string, unknown>[]) || (Array.isArray(response.data) ? response.data as Record<string, unknown>[] : []);
    } catch {
      return [];
    }
  }

  async createSeasonAlignedLoan(loanData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/season-aligned-loans`, loanData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw error;
    }
  }

  async createInputVoucher(voucherData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/input-vouchers`, voucherData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw error;
    }
  }

  async redeemInputVoucher(redemptionData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/input-vouchers/redeem`, redemptionData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw error;
    }
  }

  async createWarehouseReceiptLoan(loanData: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/warehouse-receipt-loans`, loanData);
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw error;
    }
  }

  async getFarmerCreditHistory(farmerId: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/farmer-credit-history?farmer_id=${farmerId}`).catch(() => ({ data: {} }));
      return response.data as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // =================== FARMER IMPACT ===================

  async getFarmerAchievements(farmerId: string): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/achievements?farmer_id=${farmerId}`).catch(() => ({ data: { achievements: [] } }));
      const data = response.data as Record<string, unknown>;
      return (data.achievements as Record<string, unknown>[]) || [];
    } catch {
      return [];
    }
  }

  async getImpactCertificate(farmerId: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/certificate?farmer_id=${farmerId}`).catch(() => ({ data: {} }));
      return response.data as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async getFarmerDashboard(farmerId: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/dashboard/farmer?farmer_id=${farmerId}`).catch(() => ({ data: {} }));
      return response.data as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // =================== GOVERNMENT PROGRAMS ===================

  async getGovernmentPrograms(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/programs`).catch(() => ({ data: { programs: [] } }));
      const data = response.data as Record<string, unknown>;
      return (data.programs as Record<string, unknown>[]) || [];
    } catch {
      return [];
    }
  }

  async checkProgramEligibility(programCode: string, loanId: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/programs/check-eligibility`, { program_code: programCode, loan_id: loanId });
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw error;
    }
  }

  async enrollInProgram(programCode: string, loanId: string): Promise<Record<string, unknown>> {
    try {
      const response = await apiService.post(`${this.agriBasePath}/programs/enroll`, { program_code: programCode, loan_id: loanId });
      return response.data as Record<string, unknown>;
    } catch (error) {
      throw error;
    }
  }

  // =================== INSURANCE PRODUCTS ===================

  async getInsuranceProducts(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiService.get(`${this.agriBasePath}/insurance/products`).catch(() => ({ data: { products: [] } }));
      const data = response.data as Record<string, unknown>;
      return (data.products as Record<string, unknown>[]) || [];
    } catch {
      return [];
    }
  }

  // =================== MERGED DOMAIN SERVICES ===================

  private readonly mergedBase = '/agricultural/api/v1';

  async getAnimalTraceabilityRecords(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/animal-id-traceability/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createAnimalTraceabilityRecord(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/animal-id-traceability/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getAnimalTraceabilityStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/animal-id-traceability/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getAreaYieldIndexRecords(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/area-yield-index-insurance/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createAreaYieldIndexRecord(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/area-yield-index-insurance/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getAreaYieldIndexStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/area-yield-index-insurance/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getCropYieldPredictions(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/crop-yield-prediction/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createCropYieldPrediction(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/crop-yield-prediction/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getCropYieldPredictionStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/crop-yield-prediction/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getFarmBoundaryMappings(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/farm-boundary-mapping/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createFarmBoundaryMapping(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/farm-boundary-mapping/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getFarmBoundaryMappingStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/farm-boundary-mapping/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getLivestockFinanceLoans(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/livestock-finance/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createLivestockFinanceLoan(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/livestock-finance/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getLivestockFinanceStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/livestock-finance/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getFisheriesAquacultureFacilities(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/fisheries-aquaculture/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createFisheriesAquacultureFacility(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/fisheries-aquaculture/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getFisheriesAquacultureStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/fisheries-aquaculture/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getLivestockInsurancePolicies(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/livestock-insurance/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createLivestockInsurancePolicy(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/livestock-insurance/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getLivestockInsuranceStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/livestock-insurance/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getLivestockHerds(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/livestock-management/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createLivestockHerd(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/livestock-management/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getLivestockManagementStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/livestock-management/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getSatelliteCropMonitorReadings(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/satellite-crop-monitor/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createSatelliteCropMonitorScan(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/satellite-crop-monitor/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getSatelliteCropMonitorStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/satellite-crop-monitor/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  async getSoilAnalysisReports(): Promise<Record<string, unknown>[]> {
    try {
      const res = await apiService.get(`${this.mergedBase}/soil-analysis/list`).catch(() => ({ data: { records: [] } }));
      const data = res.data as Record<string, unknown>;
      return (data.records as Record<string, unknown>[]) || [];
    } catch { return []; }
  }

  async createSoilAnalysisReport(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await apiService.post(`${this.mergedBase}/soil-analysis/create`, payload);
    return res.data as Record<string, unknown>;
  }

  async getSoilAnalysisStats(): Promise<Record<string, unknown>> {
    const res = await apiService.get(`${this.mergedBase}/soil-analysis/stats`).catch(() => ({ data: {} }));
    return res.data as Record<string, unknown>;
  }

  // =================== UTILITY METHODS ===================

  private toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
    const snakeCaseObj: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
      const snakeKey = toSnakeCase(key);
      snakeCaseObj[snakeKey] = obj[key];
    });
    return snakeCaseObj;
  }
}

export const agricultureService = new AgricultureService();
