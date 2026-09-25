/**
 * Purchase Bills Resource (Fiş / Fatura)
 *
 * Manage purchase bills and expenses with support for archive, cancel, and payments.
 */
import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';
export type BillItemType = 'purchase_bill' | 'invoice' | 'cancelled' | 'recurring_purchase_bill' | 'refund';
export type PaymentStatus = 'paid' | 'overdue' | 'unpaid' | 'partially_paid' | 'not_due' | 'unscheduled';
export type Currency = 'TRL' | 'USD' | 'EUR' | 'GBP';
export interface PurchaseBillAttributes {
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly total_paid?: number;
    readonly gross_total?: number;
    readonly total_excise_duty?: number;
    readonly total_communications_tax?: number;
    readonly total_vat?: number;
    readonly total_discount?: number;
    readonly total_invoice_discount?: number;
    readonly net_total?: number;
    readonly remaining?: number;
    readonly remaining_in_trl?: number;
    readonly payment_status?: PaymentStatus;
    archived?: boolean;
    invoice_no?: string;
    invoice_id?: number;
    item_type?: BillItemType;
    description?: string;
    issue_date: string;
    due_date?: string;
    currency?: Currency;
    exchange_rate?: number;
    withholding_rate?: number;
    vat_withholding_rate?: number;
    invoice_discount_type?: 'percentage' | 'amount';
    invoice_discount?: number;
}
export interface PurchaseBill extends JsonApiResource<PurchaseBillAttributes> {
    type: 'purchase_bills';
}
export interface PurchaseBillFilters {
    issue_date?: string;
    due_date?: string;
    contact_id?: number;
    invoice_id?: number;
    item_type?: BillItemType;
    payment_status?: PaymentStatus;
}
export interface PaymentAttributes {
    date: string;
    amount: number;
    description?: string;
    notes?: string;
    account_id?: number;
    exchange_rate?: number;
    payment_method_id?: number;
}
export declare class PurchaseBillsResource extends BaseResource<PurchaseBill, PurchaseBillAttributes, PurchaseBillFilters> {
    constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>);
    /**
     * Archives a purchase bill.
     */
    archive(id: string | number): Promise<JsonApiResponse<PurchaseBill>>;
    /**
     * Unarchives a purchase bill.
     */
    unarchive(id: string | number): Promise<JsonApiResponse<PurchaseBill>>;
    /**
     * Cancels a purchase bill.
     */
    cancel(id: string | number): Promise<JsonApiResponse<PurchaseBill>>;
    /**
     * Recovers a cancelled purchase bill.
     */
    recover(id: string | number): Promise<JsonApiResponse<PurchaseBill>>;
    /**
     * Adds a payment to a purchase bill.
     */
    pay(id: string | number, payload: {
        data: {
            type: 'payments';
            attributes: PaymentAttributes;
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
    /**
     * Lists overdue bills.
     */
    listOverdue(): Promise<import("./BaseResource.js").PaginatedResponse<PurchaseBill>>;
    /**
     * Lists unpaid bills.
     */
    listUnpaid(): Promise<import("./BaseResource.js").PaginatedResponse<PurchaseBill>>;
    /**
     * Lists bills for a specific supplier.
     */
    listBySupplier(contactId: number): Promise<import("./BaseResource.js").PaginatedResponse<PurchaseBill>>;
}
//# sourceMappingURL=purchaseBills.d.ts.map