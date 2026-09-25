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
export declare class TransactionsResource extends BaseResource<Transaction, TransactionAttributes, TransactionFilters> {
    constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>);
    /**
     * Lists transactions for a specific account.
     * Note: Paraşüt API does not support global /transactions listing; transactions are scoped to accounts.
     */
    listForAccount(accountId: string | number, options?: {
        filter?: TransactionFilters;
        page?: {
            number?: number;
            size?: number;
        };
        sort?: string;
    }): Promise<{
        data: Transaction[];
        meta?: any;
        links?: any;
    }>;
}
//# sourceMappingURL=transactions.d.ts.map