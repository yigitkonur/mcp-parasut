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
export declare class TaxesResource extends BaseResource<Tax, TaxAttributes, TaxFilters> {
    constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>);
    archive(id: string | number): Promise<JsonApiResponse<Tax>>;
    unarchive(id: string | number): Promise<JsonApiResponse<Tax>>;
    pay(id: string | number, payload: {
        data: {
            type: 'payments';
            attributes: {
                date: string;
                amount: number;
                description?: string;
                notes?: string;
                account_id?: number;
            };
            relationships?: {
                account?: {
                    data: {
                        id: string;
                        type: 'accounts';
                    };
                };
            };
        };
    }): Promise<JsonApiResponse<JsonApiResource>>;
}
//# sourceMappingURL=taxes.d.ts.map