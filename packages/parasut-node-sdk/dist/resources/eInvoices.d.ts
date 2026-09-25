/**
 * E-Invoices Resource (E-Fatura)
 *
 * Manage e-invoice documents with PDF generation.
 */
import { BaseResource, type ResourceConfig } from './BaseResource.js';
import { TrackableJobsResource, type PollOptions } from './trackableJobs.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';
export type EInvoiceScenario = 'basic' | 'commercial' | 'export';
export type EInvoiceStatus = 'waiting' | 'pending' | 'approved' | 'refused';
export interface EInvoiceAttributes {
    readonly uuid?: string;
    readonly vkn?: string;
    readonly invoice_number?: string;
    readonly status?: EInvoiceStatus;
    readonly printable_url?: string;
    readonly is_print_only?: boolean;
    readonly created_at?: string;
    readonly updated_at?: string;
    scenario?: EInvoiceScenario;
    to?: string;
    note?: string;
    vat_withholding_code?: string;
    vat_exemption_reason_code?: string;
    vat_exemption_reason?: string;
}
export interface EInvoice extends JsonApiResource<EInvoiceAttributes> {
    type: 'e_invoices';
}
export interface EInvoiceFilters {
    invoice_number?: string;
    status?: EInvoiceStatus;
    scenario?: EInvoiceScenario;
}
export interface PdfResult {
    url: string;
    expiresAt: Date;
}
export declare class EInvoicesResource extends BaseResource<EInvoice, EInvoiceAttributes, EInvoiceFilters> {
    private readonly trackableJobs;
    constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>, trackableJobs: TrackableJobsResource);
    /**
     * Submits an e-invoice document for creation.
     * Returns a trackable job ID that must be polled for completion.
     */
    submit(payload: {
        data: {
            type: 'e_invoices';
            attributes?: EInvoiceAttributes;
            relationships?: {
                invoice?: {
                    data: {
                        id: string;
                        type: 'sales_invoices';
                    };
                };
                sales_invoice?: {
                    data: {
                        id: string;
                        type: 'sales_invoices';
                    };
                };
                [key: string]: any;
            };
        };
    }): Promise<{
        data: {
            id: string;
            type: 'trackable_jobs';
        };
        trackableJobId: string;
    }>;
    create(payload: {
        data: {
            type: string;
            attributes: EInvoiceAttributes;
            relationships?: {
                invoice?: {
                    data: {
                        id: string;
                        type: 'sales_invoices';
                    };
                };
                sales_invoice?: {
                    data: {
                        id: string;
                        type: 'sales_invoices';
                    };
                };
                [key: string]: any;
            };
        };
    }): Promise<JsonApiResponse<EInvoice>>;
    /**
     * Submits an e-invoice and waits for completion.
     */
    submitAndWait(payload: {
        data: {
            type: 'e_invoices';
            attributes?: EInvoiceAttributes;
            relationships?: {
                invoice?: {
                    data: {
                        id: string;
                        type: 'sales_invoices';
                    };
                };
                sales_invoice?: {
                    data: {
                        id: string;
                        type: 'sales_invoices';
                    };
                };
            };
        };
    }, options?: PollOptions): Promise<JsonApiResponse<EInvoice>>;
    /**
     * Gets the PDF URL for an e-invoice.
     */
    pdf(id: string | number, options?: {
        pollInterval?: number;
        timeout?: number;
    }): Promise<PdfResult>;
    private sleep;
}
//# sourceMappingURL=eInvoices.d.ts.map