/**
 * Accounts Resource (Kasa ve Banka)
 *
 * Manage cash and bank accounts.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

// ============================================================================
// Types
// ============================================================================

export interface AccountAttributes {
  readonly used_for?: string;
  readonly last_used_at?: string;
  readonly balance?: number;
  readonly last_adjustment_date?: string;
  readonly bank_integration_type?: string;
  readonly associate_email?: string;
  readonly created_at?: string;
  readonly updated_at?: string;
  name: string;
  currency?: 'TRL' | 'USD' | 'EUR' | 'GBP';
  account_type?: 'cash' | 'bank' | 'sys';
  bank_name?: string;
  bank_branch?: string;
  bank_account_no?: string;
  iban?: string;
  archived?: boolean;
}

export interface Account extends JsonApiResource<AccountAttributes> {
  type: 'accounts';
}

export interface AccountFilters {
  name?: string;
  currency?: 'TRL' | 'USD' | 'EUR' | 'GBP';
  bank_name?: string;
  bank_branch?: string;
  account_type?: 'cash' | 'bank' | 'sys';
  iban?: string;
}

export interface TransactionAttributes {
  date: string;
  amount: number;
  description?: string;
}

// ============================================================================
// Resource
// ============================================================================

export class AccountsResource extends BaseResource<
  Account,
  AccountAttributes,
  AccountFilters
> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/accounts',
      resourceType: 'accounts',
    });
  }

  /**
   * Creates a debit transaction (withdrawal) on the account.
   */
  async debit(
    accountId: string | number,
    payload: { data: { type: 'transactions'; attributes: TransactionAttributes } }
  ): Promise<JsonApiResponse<JsonApiResource>> {
    return this.transport.post<JsonApiResponse<JsonApiResource>>(
      this.buildPath(accountId, '/debit_transactions'),
      payload
    );
  }

  /**
   * Creates a credit transaction (deposit) on the account.
   */
  async credit(
    accountId: string | number,
    payload: { data: { type: 'transactions'; attributes: TransactionAttributes } }
  ): Promise<JsonApiResponse<JsonApiResource>> {
    return this.transport.post<JsonApiResponse<JsonApiResource>>(
      this.buildPath(accountId, '/credit_transactions'),
      payload
    );
  }

  /**
   * Lists cash accounts.
   */
  async listCashAccounts() {
    return this.list({ filter: { account_type: 'cash' } });
  }

  /**
   * Lists bank accounts.
   */
  async listBankAccounts() {
    return this.list({ filter: { account_type: 'bank' } });
  }

  /**
   * Lists transactions for a specific account.
   */
  async listTransactions(
    accountId: string | number,
    options?: {
      filter?: { date?: string };
      page?: { number?: number; size?: number };
      sort?: string;
    }
  ): Promise<JsonApiResponse<JsonApiResource[]>> {
    const path = this.buildPath(accountId, '/transactions');
    const query: Record<string, string | number | undefined> = {};
    if (options?.filter?.date) query['filter[date]'] = options.filter.date;
    if (options?.sort) query['sort'] = options.sort;
    if (options?.page?.number) query['page[number]'] = options.page.number;
    if (options?.page?.size) query['page[size]'] = Math.min(options.page.size, 25);
    return this.transport.get<JsonApiResponse<JsonApiResource[]>>(path, query);
  }
}
