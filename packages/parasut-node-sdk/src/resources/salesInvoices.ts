/**
 * Sales Invoices Resource (Satış Faturası)
 *
 * Manage sales invoices with support for archive, cancel, and payments.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

// ============================================================================
// Types
// ============================================================================

export type InvoiceItemType = 'invoice' | 'export' | 'estimate' | 'cancelled' | 'recurring_invoice' | 'recurring_estimate' | 'refund';
export type PaymentStatus = 'paid' | 'overdue' | 'unpaid' | 'partially_paid';
export type Currency = 'TRL' | 'USD' | 'EUR' | 'GBP';

export interface SalesInvoiceAttributes {
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
  readonly sharings_count?: number;
  archived?: boolean;
  invoice_no?: string;
  invoice_series?: string;
  invoice_id?: number;
  item_type?: InvoiceItemType;
  description?: string;
  issue_date: string;
  due_date?: string;
  currency?: Currency;
  exchange_rate?: number;
  withholding_rate?: number;
  vat_withholding_rate?: number;
  invoice_discount_type?: 'percentage' | 'amount';
  invoice_discount?: number;
  billing_address?: string;
  billing_phone?: string;
  billing_fax?: string;
  tax_office?: string;
  tax_number?: string;
  city?: string;
  district?: string;
  is_abroad?: boolean;
  order_no?: string;
  order_date?: string;
  shipment_addres?: string;
  shipment_included?: boolean;
}

export interface SalesInvoice extends JsonApiResource<SalesInvoiceAttributes> {
  type: 'sales_invoices';
}

export interface SalesInvoiceFilters {
  issue_date?: string;
  due_date?: string;
  contact_id?: number;
  invoice_id?: number;
  invoice_series?: string;
  item_type?: InvoiceItemType;
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

export class SalesInvoicesResource extends BaseResource<
  SalesInvoice,
  SalesInvoiceAttributes,
  SalesInvoiceFilters
> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/sales_invoices',
      resourceType: 'sales_invoices',
    });
  }

  /**
   * Archives a sales invoice.
   */
  async archive(id: string | number): Promise<JsonApiResponse<SalesInvoice>> {
    return this.transport.patch<JsonApiResponse<SalesInvoice>>(
      this.buildPath(id, '/archive')
    );
  }

  /**
   * Unarchives a sales invoice.
   */
  async unarchive(id: string | number): Promise<JsonApiResponse<SalesInvoice>> {
    return this.transport.patch<JsonApiResponse<SalesInvoice>>(
      this.buildPath(id, '/unarchive')
    );
  }

  /**
   * Cancels a sales invoice.
   */
  async cancel(id: string | number): Promise<JsonApiResponse<SalesInvoice>> {
    return this.transport.delete<JsonApiResponse<SalesInvoice>>(
      this.buildPath(id, '/cancel')
    );
  }

  /**
   * Recovers a cancelled sales invoice.
   */
  async recover(id: string | number): Promise<JsonApiResponse<SalesInvoice>> {
    return this.transport.patch<JsonApiResponse<SalesInvoice>>(
      this.buildPath(id, '/recover')
    );
  }

  /**
   * Adds a payment to a sales invoice.
   *
   * @example
   * ```typescript
   * await client.salesInvoices.pay(invoiceId, {
   *   data: {
   *     type: 'payments',
   *     attributes: {
   *       date: '2024-01-15',
   *       amount: 1000.00,
   *       notes: 'Payment received'
   *     },
   *     relationships: {
   *       account: { data: { id: '123', type: 'accounts' } }
   *     }
   *   }
   * });
   * ```
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
   * Lists overdue invoices.
   */
  async listOverdue() {
    return this.list({ filter: { payment_status: 'overdue' } });
  }

  /**
   * Lists unpaid invoices.
   */
  async listUnpaid() {
    return this.list({ filter: { payment_status: 'unpaid' } });
  }

  /**
   * Lists invoices for a specific contact.
   */
  async listByContact(contactId: number) {
    return this.list({ filter: { contact_id: contactId } });
  }
}
