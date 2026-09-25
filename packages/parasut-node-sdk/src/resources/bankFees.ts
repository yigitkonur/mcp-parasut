/**
 * Bank Fees Resource (Banka Gideri)
 *
 * Manage bank fees and charges.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

export interface BankFeeAttributes {
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly total_paid?: number;
  readonly archived?: boolean;
  readonly remaining?: number;
  readonly remaining_in_trl?: number;
  description: string;
  currency: 'TRL' | 'USD' | 'EUR' | 'GBP';
  issue_date: string;
  due_date: string;
  exchange_rate?: number;
  net_total: number;
}

export interface BankFee extends JsonApiResource<BankFeeAttributes> {
  type: 'bank_fees';
}

export interface BankFeeFilters {
  issue_date?: string;
  due_date?: string;
}

export class BankFeesResource extends BaseResource<
  BankFee,
  BankFeeAttributes,
  BankFeeFilters
> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/bank_fees',
      resourceType: 'bank_fees',
    });
  }

  async archive(id: string | number): Promise<JsonApiResponse<BankFee>> {
    return this.transport.patch<JsonApiResponse<BankFee>>(
      this.buildPath(id, '/archive')
    );
  }

  async unarchive(id: string | number): Promise<JsonApiResponse<BankFee>> {
    return this.transport.patch<JsonApiResponse<BankFee>>(
      this.buildPath(id, '/unarchive')
    );
  }

  async pay(
    id: string | number,
    payload: {
      data: {
        type: 'payments';
        attributes: {
          date: string;
          amount: number;
          description?: string;
          notes?: string;
          account_id?: number;
        };
        relationships?: { account?: { data: { id: string; type: 'accounts' } } };
      };
    }
  ): Promise<JsonApiResponse<JsonApiResource>> {
    return this.transport.post<JsonApiResponse<JsonApiResource>>(
      this.buildPath(id, '/payments'),
      payload
    );
  }
}
