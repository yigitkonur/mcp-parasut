/**
 * Sales Offers Resource (Teklif)
 *
 * Manage sales offers/quotes with conversion to invoice.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

// ============================================================================
// Types
// ============================================================================

export type Currency = 'TRL' | 'USD' | 'EUR' | 'GBP';

export interface SalesOfferAttributes {
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly gross_total?: number;
  readonly net_total?: number;
  readonly total_discount?: number;
  readonly total_vat?: number;
  archived?: boolean;
  offer_no?: string;
  description?: string;
  issue_date: string;
  valid_until_date?: string;
  currency?: Currency;
  exchange_rate?: number;
  billing_address?: string;
  billing_phone?: string;
  billing_fax?: string;
  tax_office?: string;
  tax_number?: string;
  city?: string;
  district?: string;
  note?: string;
}

export interface SalesOffer extends JsonApiResource<SalesOfferAttributes> {
  type: 'sales_offers';
}

export interface SalesOfferFilters {
  issue_date?: string;
  contact_id?: number;
  offer_no?: string;
}

export interface PdfResult {
  url: string;
  expiresAt: Date;
}

// ============================================================================
// Resource
// ============================================================================

export class SalesOffersResource extends BaseResource<
  SalesOffer,
  SalesOfferAttributes,
  SalesOfferFilters
> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/sales_offers',
      resourceType: 'sales_offers',
    });
  }

  /**
   * Archives a sales offer.
   */
  async archive(id: string | number): Promise<JsonApiResponse<SalesOffer>> {
    return this.transport.patch<JsonApiResponse<SalesOffer>>(
      this.buildPath(id, '/archive')
    );
  }

  /**
   * Unarchives a sales offer.
   */
  async unarchive(id: string | number): Promise<JsonApiResponse<SalesOffer>> {
    return this.transport.patch<JsonApiResponse<SalesOffer>>(
      this.buildPath(id, '/unarchive')
    );
  }

  /**
   * Gets the PDF URL for a sales offer.
   */
  async pdf(
    id: string | number,
    options: { pollInterval?: number; timeout?: number } = {}
  ): Promise<PdfResult> {
    const { pollInterval = 2000, timeout = 60000 } = options;
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`PDF not ready after ${timeout}ms`);
      }

      const response = await this.transport.get<{
        status?: number;
        noContent?: boolean;
        data?: { attributes?: { url?: string } };
      }>(this.buildPath(id, '/pdf'));

      if (response.noContent || response.status === 204) {
        await this.sleep(pollInterval);
        continue;
      }

      const url = response.data?.attributes?.url;
      if (url) {
        return {
          url,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        };
      }

      await this.sleep(pollInterval);
    }
  }

  /**
   * Converts a sales offer to a sales invoice.
   * Returns the newly created invoice.
   */
  async convertToInvoice(
    id: string | number,
    invoiceData?: Partial<{
      issue_date: string;
      due_date: string;
      description: string;
    }>
  ): Promise<JsonApiResponse<JsonApiResource>> {
    return this.transport.post<JsonApiResponse<JsonApiResource>>(
      this.buildPath(id, '/convert_to_invoice'),
      invoiceData ? { data: { attributes: invoiceData } } : undefined
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
