import { AppDataSource } from "../database/dataSource";
import { Tenant } from "../models/Tenant";

export const tenantRepository = {
  repo: () => AppDataSource.getRepository(Tenant),

  async findOne(query: any): Promise<Tenant | null> {
    return this.repo().findOne(query);
  },

  async save(tenant: Partial<Tenant>): Promise<Tenant> {
    return this.repo().save(tenant);
  },
};
