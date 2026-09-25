/**
 * Transactions Resource (İşlem)
 *
 * Manage financial transactions.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource } from '../generated/types.js';

export interface TransactionAttributes {
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly date?: string;
  readonly amount?: number;
  readonly currency?: 'TRL' | 'USD' | 'EUR' | 'GBP';
  readonly amount_in_trl?: number;
  readonly description?: string;
}

export interface Transaction extends JsonApiResource<TransactionAttributes> {
  type: 'transactions';
}

export interface TransactionFilters {
  date?: string;
}

export class TransactionsResource extends BaseResource<
  Transaction,
  TransactionAttributes,
  TransactionFilters
> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/transactions',
      resourceType: 'transactions',
    });
  }

  /**
   * Lists transactions for a specific account.
   * Note: Paraşüt API does not support global /transactions listing; transactions are scoped to accounts.
   */
  async listForAccount(
    accountId: string | number,
    options?: {
      filter?: TransactionFilters;
      page?: { number?: number; size?: number };
      sort?: string;
    }
  ): Promise<{
    data: Transaction[];
    meta?: any;
    links?: any;
  }> {
    const path = `/${this.companyId}/accounts/${accountId}/transactions`;
    const query: Record<string, string | number | undefined> = {};
    if (options?.filter?.date) query['filter[date]'] = options.filter.date;
    if (options?.sort) query['sort'] = options.sort;
    if (options?.page?.number) query['page[number]'] = options.page.number;
    if (options?.page?.size) query['page[size]'] = Math.min(options.page.size, 25);
    return this.transport.get(path, query);
  }
}
