/**
 * Accounts Resource (Kasa ve Banka)
 *
 * Manage cash and bank accounts.
 */
import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';
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
export declare class AccountsResource extends BaseResource<Account, AccountAttributes, AccountFilters> {
    constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>);
    /**
     * Creates a debit transaction (withdrawal) on the account.
     */
    debit(accountId: string | number, payload: {
        data: {
            type: 'transactions';
            attributes: TransactionAttributes;
        };
    }): Promise<JsonApiResponse<JsonApiResource>>;
    /**
     * Creates a credit transaction (deposit) on the account.
     */
    credit(accountId: string | number, payload: {
        data: {
            type: 'transactions';
            attributes: TransactionAttributes;
        };
    }): Promise<JsonApiResponse<JsonApiResource>>;
    /**
     * Lists cash accounts.
     */
    listCashAccounts(): Promise<import("./BaseResource.js").PaginatedResponse<Account>>;
    /**
     * Lists bank accounts.
     */
    listBankAccounts(): Promise<import("./BaseResource.js").PaginatedResponse<Account>>;
    /**
     * Lists transactions for a specific account.
     */
    listTransactions(accountId: string | number, options?: {
        filter?: {
            date?: string;
        };
        page?: {
            number?: number;
            size?: number;
        };
        sort?: string;
    }): Promise<JsonApiResponse<JsonApiResource[]>>;
}
//# sourceMappingURL=accounts.d.ts.map