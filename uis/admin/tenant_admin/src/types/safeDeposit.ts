export type BoxSize = 'small' | 'medium' | 'large';
export type BoxStatus = 'occupied' | 'available' | 'maintenance';

export interface DepositBox {
  id: string;
  box_size: BoxSize;
  customer_name: string;
  customer_id?: string;
  branch: string;
  annual_rent: number;
  currency: string;
  renewal_date: string;
  status: BoxStatus;
  created_at?: string;
  updated_at?: string;
}

export interface DepositBoxListResponse {
  items: DepositBox[];
  total: number;
}

export interface DepositBoxStats {
  total_boxes: number;
  occupied: number;
  available: number;
  maintenance: number;
}

export interface CreateBoxInput {
  box_size: BoxSize;
  branch: string;
  annual_rent: number;
  currency?: string;
  customer_name?: string;
  customer_id?: string;
  renewal_date?: string;
}

export interface AssignBoxInput {
  id: string;
  customer_name: string;
  customer_id: string;
  annual_rent?: number;
  renewal_date?: string;
}

export interface UpdateBoxInput {
  id: string;
  status?: BoxStatus;
  renewal_date?: string;
  annual_rent?: number;
}

export interface VacateBoxInput {
  id: string;
}
