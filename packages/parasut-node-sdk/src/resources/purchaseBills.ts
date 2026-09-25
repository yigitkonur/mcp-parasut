/**
 * Purchase Bills Resource (Fiş / Fatura)
 *
 * Manage purchase bills and expenses with support for archive, cancel, and payments.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Resource
// ============================================================================

export class PurchaseBillsResource extends BaseResource<
  PurchaseBill,
  PurchaseBillAttributes,
  PurchaseBillFilters
> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/purchase_bills',
      resourceType: 'purchase_bills',
    });
  }

  /**
   * Archives a purchase bill.
   */
  async archive(id: string | number): Promise<JsonApiResponse<PurchaseBill>> {
    return this.transport.patch<JsonApiResponse<PurchaseBill>>(
      this.buildPath(id, '/archive')
    );
  }

  /**
   * Unarchives a purchase bill.
   */
  async unarchive(id: string | number): Promise<JsonApiResponse<PurchaseBill>> {
    return this.transport.patch<JsonApiResponse<PurchaseBill>>(
      this.buildPath(id, '/unarchive')
    );
  }

  /**
   * Cancels a purchase bill.
   */
  async cancel(id: string | number): Promise<JsonApiResponse<PurchaseBill>> {
    return this.transport.delete<JsonApiResponse<PurchaseBill>>(
      this.buildPath(id, '/cancel')
    );
  }

  /**
   * Recovers a cancelled purchase bill.
   */
  async recover(id: string | number): Promise<JsonApiResponse<PurchaseBill>> {
    return this.transport.patch<JsonApiResponse<PurchaseBill>>(
      this.buildPath(id, '/recover')
    );
  }

  /**
   * Adds a payment to a purchase bill.
   */
  async pay(
    id: string | number,
    payload: {
      data: {
        type: 'payments';
        attributes: PaymentAttributes;
        relationships?: {
          account?: { data: { id: string; type: 'accounts' } };
        };
      };
    }
  ): Promise<JsonApiResponse<JsonApiResource>> {
    return this.transport.post<JsonApiResponse<JsonApiResource>>(
      this.buildPath(id, '/payments'),
      payload
    );
  }

  /**
   * Lists overdue bills.
   */
  async listOverdue() {
    return this.list({ filter: { payment_status: 'overdue' } });
  }

  /**
   * Lists unpaid bills.
   */
  async listUnpaid() {
    return this.list({ filter: { payment_status: 'unpaid' } });
  }

  /**
   * Lists bills for a specific supplier.
   */
  async listBySupplier(contactId: number) {
    return this.list({ filter: { contact_id: contactId } });
  }
}
