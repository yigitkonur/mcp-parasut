/**
 * E-Archives Resource (E-Arşiv)
 *
 * Manage e-archive documents with PDF generation.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import { TrackableJobsResource, type PollOptions } from './trackableJobs.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

// ============================================================================
// Types
// ============================================================================

export interface EArchiveAttributes {
  readonly uuid?: string;
  readonly vkn?: string;
  readonly invoice_number?: string;
  readonly status?: 'waiting' | 'pending' | 'approved' | 'refused';
  readonly printable_url?: string;
  readonly created_at?: string;
  readonly updated_at?: string;
  vat_withholding_code?: string;
  vat_exemption_reason_code?: string;
  vat_exemption_reason?: string;
  note?: string;
  is_for_abroad?: boolean;
  is_internet_sale?: boolean;
  internet_sale?: {
    url?: string;
    payment_type?: string;
    payment_platform?: string;
    payment_date?: string;
    send_date?: string;
  };
}

export interface EArchive extends JsonApiResource<EArchiveAttributes> {
  type: 'e_archives';
}

export interface EArchiveFilters {
  invoice_number?: string;
  status?: 'waiting' | 'pending' | 'approved' | 'refused';
}

export interface PdfResult {
  /**
   * Temporary URL to the PDF (valid for 1 hour).
   * Do not share directly with customers.
   */
  url: string;

  /**
   * When the URL expires.
   */
  expiresAt: Date;
}

// ============================================================================
// Resource
// ============================================================================

export class EArchivesResource extends BaseResource<
  EArchive,
  EArchiveAttributes,
  EArchiveFilters
> {
  private readonly trackableJobs: TrackableJobsResource;

  constructor(
    config: Omit<ResourceConfig, 'basePath' | 'resourceType'>,
    trackableJobs: TrackableJobsResource
  ) {
    super({
      ...config,
      basePath: '/e_archives',
      resourceType: 'e_archives',
    });
    this.trackableJobs = trackableJobs;
  }

  /**
   * Creates an e-archive document.
   * Returns a trackable job ID that must be polled for completion.
   *
   * @example
   * ```typescript
   * const result = await client.eArchives.create({
   *   data: {
   *     type: 'e_archives',
   *     relationships: {
   *       sales_invoice: { data: { id: '123', type: 'sales_invoices' } }
   *     }
   *   }
   * });
   *
   * // Poll for completion
   * const job = await client.trackableJobs.poll(result.trackableJobId);
   * ```
   */
  async submit(
    payload: {
      data: {
        type: 'e_archives';
        attributes?: EArchiveAttributes;
        relationships?: {
          sales_invoice?: { data: { id: string; type: 'sales_invoices' } };
        };
      };
    }
  ): Promise<{ data: { id: string; type: 'trackable_jobs' }; trackableJobId: string }> {
    const response = await this.transport.post<{
      data: { id: string; type: 'trackable_jobs' };
    }>(this.buildPath(), payload);

    return {
      data: response.data,
      trackableJobId: response.data.id,
    };
  }

  /**
   * Creates an e-archive and waits for completion.
   */
  async submitAndWait(
    payload: {
      data: {
        type: 'e_archives';
        attributes?: EArchiveAttributes;
        relationships?: {
          sales_invoice?: { data: { id: string; type: 'sales_invoices' } };
        };
      };
    },
    options?: PollOptions
  ): Promise<JsonApiResponse<EArchive>> {
    const createResult = await this.submit(payload);
    await this.trackableJobs.poll(createResult.trackableJobId, options);

    // Get the created e-archive from the sales invoice active_e_document
    const invoiceId = payload.data.relationships?.sales_invoice?.data.id;
    if (invoiceId) {
      const invResponse = await this.transport.get<{
        data?: { relationships?: { active_e_document?: { data?: { id: string; type: string } } } };
        included?: Array<JsonApiResource<EArchiveAttributes>>;
      }>(`/${this.companyId}/sales_invoices/${invoiceId}?include=active_e_document`);

      const includedDoc = invResponse.included?.find((item) => item.type === 'e_archives');
      if (includedDoc) {
        return { data: includedDoc as EArchive };
      }
      const activeDoc = invResponse.data?.relationships?.active_e_document?.data;
      if (activeDoc?.id) {
        return this.get(activeDoc.id);
      }
    }

    throw new Error('E-archive created but active_e_document could not be retrieved from the sales invoice');
  }

  /**
   * Gets the PDF URL for an e-archive.
   * The PDF may not be immediately available after creation.
   * Returns 204 No Content if not ready yet.
   *
   * @example
   * ```typescript
   * const { url } = await client.eArchives.pdf(eArchiveId);
   * // Download the PDF from url before it expires
   * ```
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

      // 204 No Content means PDF not ready yet
      if (response.noContent || response.status === 204) {
        await this.sleep(pollInterval);
        continue;
      }

      // PDF is ready
      const url = response.data?.attributes?.url;
      if (url) {
        return {
          url,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        };
      }

      await this.sleep(pollInterval);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
