/**
 * Response Formatting Utilities
 *
 * Formats tool responses with guided next steps.
 * Every response should help the LLM understand what to do next.
 */
export interface ToolResponse {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
    [key: string]: unknown;
}
export interface NextStep {
    action: string;
    example?: string;
}
export interface FormatOptions {
    summary?: string;
    nextSteps?: NextStep[];
    notes?: string[];
}
/**
 * Formats a successful tool response with data and guidance.
 */
export declare function formatSuccess<T>(data: T, options?: FormatOptions): ToolResponse;
/**
 * Formats a list response with pagination info.
 */
export declare function formatList<T>(items: T[], meta: {
    totalCount: number;
    currentPage: number;
    totalPages: number;
}, options?: FormatOptions & {
    itemFormatter?: (item: T) => string;
    pageSize?: number;
}): ToolResponse;
/**
 * Formats a "not found" response with suggestions.
 */
export declare function formatNotFound(resourceType: string, identifier: string, suggestions?: NextStep[]): ToolResponse;
/**
 * Formats a created resource response.
 */
export declare function formatCreated<T extends {
    id?: string;
}>(resourceType: string, data: T, nextSteps?: NextStep[]): ToolResponse;
/**
 * Formats an action confirmation response (delete, cancel, etc.)
 */
export declare function formatActionConfirmation(action: string, resourceType: string, id: string, additionalInfo?: Record<string, unknown>): ToolResponse;
/**
 * Formats contact information in a human-readable way.
 */
export declare function formatContactSummary(contact: {
    id?: string;
    attributes?: {
        name?: string;
        email?: string;
        tax_number?: string;
        account_type?: string;
        balance?: string | number;
    };
}): string;
/**
 * Formats invoice information in a human-readable way.
 */
export declare function formatInvoiceSummary(invoice: {
    id?: string;
    attributes?: {
        issue_date?: string;
        invoice_no?: string | number;
        net_total?: string | number;
        remaining?: string | number;
        invoice_status?: string;
        payment_status?: string;
        status?: string;
    };
}): string;
/**
 * Formats product information in a human-readable way.
 */
export declare function formatProductSummary(product: {
    id?: string;
    attributes?: {
        name?: string;
        code?: string;
        list_price?: string | number;
        currency?: string;
        stock_count?: number;
        inventory_tracking?: boolean;
    };
}): string;
//# sourceMappingURL=response.d.ts.map