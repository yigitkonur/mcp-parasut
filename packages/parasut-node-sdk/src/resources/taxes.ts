/**
 * Taxes Resource (Vergi)
 *
 * Manage tax records.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

export interface TaxAttributes {
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly total_paid?: number;
  readonly archived?: boolean;
  readonly remaining?: number;
  description: string;
  issue_date: string;
  due_date: string;
  net_total: number;
  currency?: 'TRL' | 'USD' | 'EUR' | 'GBP';
}

export interface Tax extends JsonApiResource<TaxAttributes> {
  type: 'taxes';
}

export interface TaxFilters {
  issue_date?: string;
  due_date?: string;
}

export class TaxesResource extends BaseResource<Tax, TaxAttributes, TaxFilters> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/taxes',
      resourceType: 'taxes',
    });
  }

  async archive(id: string | number): Promise<JsonApiResponse<Tax>> {
    return this.transport.patch<JsonApiResponse<Tax>>(
      this.buildPath(id, '/archive')
    );
  }

  async unarchive(id: string | number): Promise<JsonApiResponse<Tax>> {
    return this.transport.patch<JsonApiResponse<Tax>>(
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
