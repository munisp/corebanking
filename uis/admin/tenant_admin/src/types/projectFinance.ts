export type ProjectSector = 'infrastructure' | 'manufacturing' | 'transport' | 'energy' | 'agriculture' | 'technology';
export type ProjectStatus = 'feasibility' | 'pre_construction' | 'construction' | 'operational' | 'closed';

export interface ProjectDeal {
  id: string;
  project_name: string;
  sponsor: string;
  sector: ProjectSector | string;
  total_cost: number;
  debt_equity_ratio: string;
  currency: string;
  tenor: string;
  dscr: number;
  status: ProjectStatus | string;
}

export interface ProjectFinanceStats {
  total_projects: number;
  total_investment: number;
}

export interface ProjectDealListResponse { items: ProjectDeal[]; total: number; }
