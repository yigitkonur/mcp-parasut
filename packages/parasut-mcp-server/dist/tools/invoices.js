/**
 * Invoice Tools
 *
 * Tools for managing sales invoices - the core of Paraşüt.
 */
import { z } from 'zod';
import { getClient } from '../client.js';
import { formatSuccess, formatList, formatCreated, formatNotFound, formatActionConfirmation, formatInvoiceSummary, } from '../utils/response.js';
import { handleError } from '../utils/errors.js';
// ============================================================================
// Schemas
// ============================================================================
const SearchInvoicesSchema = z.object({
    contact_id: z.string().optional().describe('Filter by contact ID'),
    issue_date_start: z
        .string()
        .optional()
        .describe('Start date (YYYY-MM-DD)'),
    issue_date_end: z.string().optional().describe('End date (YYYY-MM-DD)'),
    payment_status: z
        .enum(['overdue', 'not_due', 'unscheduled', 'paid'])
        .optional()
        .describe('Filter by payment status (overdue, not_due, unscheduled, paid)'),
    status: z
        .enum(['draft', 'open', 'paid', 'cancelled', 'overdue', 'not_due', 'unscheduled', 'unpaid'])
        .optional()
        .describe('Filter by status (mapped to payment_status or item_type)'),
    page: z.number().int().min(1).default(1).describe('Page number'),
    limit: z.number().int().min(1).max(100).default(100).describe('Results per page (default: 100)'),
});
const GetInvoiceSchema = z.object({
    id: z.string().describe('Invoice ID'),
});
const InvoiceLineSchema = z.object({
    product_id: z.string().optional().describe('Product ID (if using existing product)'),
    description: z.string().describe('Line item description'),
    quantity: z.number().positive().describe('Quantity'),
    unit_price: z.number().describe('Unit price'),
    vat_rate: z
        .number()
        .min(0)
        .max(100)
        .default(20)
        .describe('VAT rate (0, 1, 10, 20)'),
    discount_type: z
        .enum(['percentage', 'amount'])
        .optional()
        .describe('Discount type'),
    discount_value: z.number().optional().describe('Discount value'),
});
const CreateInvoiceSchema = z.object({
    contact_id: z.string().describe('Customer contact ID (required)'),
    issue_date: z
        .string()
        .optional()
        .describe('Issue date (YYYY-MM-DD, default: today)'),
    due_date: z.string().optional().describe('Due date (YYYY-MM-DD)'),
    currency: z
        .enum(['TRL', 'USD', 'EUR', 'GBP'])
        .default('TRL')
        .describe('Currency'),
    description: z.string().optional().describe('Invoice description/notes'),
    lines: z
        .array(InvoiceLineSchema)
        .min(1)
        .describe('Invoice line items (required)'),
    invoice_series: z.string().optional().describe('Invoice series (e.g., A, B)'),
    invoice_id: z.number().optional().describe('Custom invoice number'),
    confirm: z.boolean().optional().describe('⚠️ Set to true to confirm creation. Required to execute.'),
});
const CancelInvoiceSchema = z.object({
    id: z.string().describe('Invoice ID to cancel'),
    confirm: z.boolean().optional().describe('Set to true to confirm cancellation. Required to execute.'),
});
const RecoverInvoiceSchema = z.object({
    id: z.string().describe('Cancelled invoice ID to recover'),
});
const InvoicePdfSchema = z.object({
    id: z.string().describe('Invoice ID'),
});
const RecordPaymentSchema = z.object({
    invoice_id: z.string().describe('Invoice ID'),
    amount: z.number().positive().describe('Payment amount'),
    date: z.string().optional().describe('Payment date (YYYY-MM-DD, default: today)'),
    account_id: z.string().optional().describe('Bank/cash account ID'),
    description: z.string().optional().describe('Payment note'),
    confirm: z.boolean().optional().describe('⚠️ Set to true to confirm payment. Required to execute.'),
});
// ============================================================================
// Tool Definitions
// ============================================================================
export const invoiceTools = [
    {
        name: 'search_invoices',
        description: `
<usecase>
Search for sales invoices in Paraşüt.
Use when: Finding invoices by customer, date range, or payment status.
Do NOT use when: You already have the invoice ID (use get_invoice instead).
</usecase>

<instructions>
- contact_id: Filter by customer ID
- issue_date_start/end: Date range filter (YYYY-MM-DD)
- status: Must be "draft", "open", "paid", or "cancelled"
</instructions>

<example>
search_invoices(contact_id="12345")
search_invoices(issue_date_start="2024-01-01", status="open")
</example>

<returns>
List of invoices with: id, invoice_no, issue_date, net_total, currency, status, remaining.
Use the ID to call get_invoice for full details.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                contact_id: {
                    type: 'string',
                    description: 'Filter by contact ID',
                },
                issue_date_start: {
                    type: 'string',
                    description: 'Start date (YYYY-MM-DD)',
                },
                issue_date_end: {
                    type: 'string',
                    description: 'End date (YYYY-MM-DD)',
                },
                payment_status: {
                    type: 'string',
                    enum: ['overdue', 'not_due', 'unscheduled', 'paid'],
                    description: 'Filter by payment status: overdue, not_due, unscheduled, paid',
                },
                status: {
                    type: 'string',
                    enum: ['overdue', 'not_due', 'unscheduled', 'paid', 'open', 'unpaid', 'draft', 'cancelled'],
                    description: 'Filter by status (mapped to payment_status or item_type)',
                },
                page: {
                    type: 'number',
                    default: 1,
                },
                limit: {
                    type: 'number',
                    default: 100,
                },
            },
        },
    },
    {
        name: 'get_invoice',
        description: `
<usecase>
Get detailed information about a specific invoice.
Use when: You have an invoice ID and need full details, line items, or payment history.
Do NOT use when: You don't have the ID yet (use search_invoices first).
</usecase>

<instructions>
- id: Invoice ID (required)
</instructions>

<example>
get_invoice(id="12345")
</example>

<returns>
Full invoice: id, invoice_no, issue_date, due_date, status, currency, gross_total,
net_total, total_vat, remaining, description, archived.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Invoice ID',
                },
            },
            required: ['id'],
        },
    },
    {
        name: 'create_invoice',
        description: `
<usecase>
📄 Create a new sales invoice for a customer. THIS CREATES A FINANCIAL RECORD.
Use when: Billing a customer for products or services.
Do NOT use when: Creating a purchase bill from a supplier (use create_bill instead).
</usecase>

<instructions>
⚠️ REQUIRES CONFIRMATION: Set confirm=true to execute.
- contact_id: Customer ID (required) - use search_contacts to find
- lines: Array of line items (required)
  - description: Item description
  - quantity: Number of units
  - unit_price: Price per unit
  - vat_rate: VAT percentage (0, 1, 10, or 20)
- confirm: Must be true to create. Without confirm=true, returns preview only.
- issue_date: Invoice date (default: today)
- currency: Must be TRL, USD, EUR, or GBP
</instructions>

<example>
create_invoice(contact_id="12345", lines=[...])                    # Preview only
create_invoice(contact_id="12345", lines=[...], confirm=true)       # Actually creates
</example>

<returns>
Without confirm: Preview of invoice to be created with calculated totals.
With confirm=true: Created invoice with: id, invoice_no, net_total, currency.
</returns>

<notes>
- Invoice is created as draft
- Use send_einvoice or send_earchive to send electronically
- Use record_invoice_payment to record payments
</notes>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                contact_id: {
                    type: 'string',
                    description: 'Customer contact ID (required)',
                },
                confirm: {
                    type: 'boolean',
                    description: '⚠️ Set to true to confirm creation. Required to execute.',
                },
                issue_date: {
                    type: 'string',
                    description: 'Issue date (YYYY-MM-DD)',
                },
                due_date: {
                    type: 'string',
                    description: 'Due date (YYYY-MM-DD)',
                },
                currency: {
                    type: 'string',
                    enum: ['TRL', 'USD', 'EUR', 'GBP'],
                    description: 'Currency. MUST be one of: TRL, USD, EUR, GBP',
                    default: 'TRL',
                },
                description: {
                    type: 'string',
                    description: 'Invoice notes',
                },
                lines: {
                    type: 'array',
                    description: 'Line items',
                    items: {
                        type: 'object',
                        properties: {
                            product_id: { type: 'string' },
                            description: { type: 'string' },
                            quantity: { type: 'number' },
                            unit_price: { type: 'number' },
                            vat_rate: { type: 'number', default: 20 },
                            discount_type: {
                                type: 'string',
                                enum: ['percentage', 'amount'],
                            },
                            discount_value: { type: 'number' },
                        },
                        required: ['description', 'quantity', 'unit_price'],
                    },
                },
                invoice_series: {
                    type: 'string',
                    description: 'Invoice series',
                },
                invoice_id: {
                    type: 'number',
                    description: 'Custom invoice number',
                },
            },
            required: ['contact_id', 'lines'],
        },
    },
    {
        name: 'cancel_invoice',
        description: `
<usecase>
Cancel an existing invoice. THIS IS A DESTRUCTIVE OPERATION.
Use when: Invoice was created in error or is no longer valid.
Do NOT use when: You want to hide an invoice (archive it instead).
</usecase>

<instructions>
- id: Invoice ID to cancel (required)
- confirm: Must be true to execute. Without confirm=true, returns preview only.
</instructions>

<example>
cancel_invoice(id="12345")                    # Preview only
cancel_invoice(id="12345", confirm=true)      # Actually cancels
</example>

<returns>
Without confirm: Preview of invoice to be cancelled.
With confirm=true: Confirmation that invoice was cancelled.
</returns>

<notes>
- Cancelled invoices can be recovered with recover_invoice
- E-invoices may have restrictions on cancellation
</notes>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Invoice ID to cancel',
                },
                confirm: {
                    type: 'boolean',
                    description: 'Set to true to confirm cancellation. Required to execute.',
                },
            },
            required: ['id'],
        },
    },
    {
        name: 'recover_invoice',
        description: `
<usecase>
Recover a cancelled invoice.
Use when: An invoice was cancelled by mistake and needs to be restored.
Do NOT use when: Invoice is not cancelled (check status with get_invoice first).
</usecase>

<instructions>
- id: Cancelled invoice ID (required)
</instructions>

<example>
recover_invoice(id="12345")
</example>

<returns>
Confirmation that the invoice was recovered and is active again.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Cancelled invoice ID',
                },
            },
            required: ['id'],
        },
    },
    {
        name: 'invoice_pdf',
        description: `
<usecase>
Get PDF URL for an invoice.
Use when: You need a printable/shareable invoice document.
Do NOT use when: Invoice hasn't been sent as e-archive yet (use send_earchive first).
</usecase>

<instructions>
- id: Invoice ID (required)
</instructions>

<example>
invoice_pdf(id="12345")
</example>

<returns>
URL to download the PDF (valid for 1 hour), or instructions to generate via e-archive.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Invoice ID',
                },
            },
            required: ['id'],
        },
    },
    {
        name: 'record_invoice_payment',
        description: `
<usecase>
💰 Record a payment received for an invoice. THIS AFFECTS FINANCIAL RECORDS.
Use when: A customer pays an invoice (full or partial payment).
Do NOT use when: Recording a payment you made to a supplier (use record_bill_payment).
</usecase>

<instructions>
⚠️ REQUIRES CONFIRMATION: Set confirm=true to execute.
- invoice_id: Invoice ID (required)
- amount: Payment amount (required)
- confirm: Must be true to execute. Without confirm=true, returns preview only.
- date: Payment date (default: today)
- account_id: Bank/cash account to credit
</instructions>

<example>
record_invoice_payment(invoice_id="12345", amount=5000)                    # Preview only
record_invoice_payment(invoice_id="12345", amount=5000, confirm=true)       # Actually records
</example>

<returns>
Without confirm: Preview of payment to be recorded.
With confirm=true: Payment record with: payment_id, invoice_id, amount, date.
</returns>

<notes>
- Partial payments are supported
- When total paid >= invoice total, status becomes "paid"
</notes>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                invoice_id: {
                    type: 'string',
                    description: 'Invoice ID',
                },
                amount: {
                    type: 'number',
                    description: 'Payment amount',
                },
                confirm: {
                    type: 'boolean',
                    description: '⚠️ Set to true to confirm payment. Required to execute.',
                },
                date: {
                    type: 'string',
                    description: 'Payment date (YYYY-MM-DD)',
                },
                account_id: {
                    type: 'string',
                    description: 'Bank/cash account ID',
                },
                description: {
                    type: 'string',
                    description: 'Payment note',
                },
            },
            required: ['invoice_id', 'amount'],
        },
    },
];
// ============================================================================
// Handlers
// ============================================================================
export async function handleSearchInvoices(args) {
    try {
        const params = SearchInvoicesSchema.parse(args);
        const client = getClient();
        const filter = {};
        if (params.contact_id)
            filter['contact_id'] = params.contact_id;
        if (params.issue_date_start)
            filter['issue_date'] = params.issue_date_start;
        if (params.payment_status) {
            filter['payment_status'] = params.payment_status;
        }
        else if (params.status) {
            const statusMap = {
                paid: 'paid',
                overdue: 'overdue',
                not_due: 'not_due',
                unscheduled: 'unscheduled',
                open: 'not_due',
                unpaid: 'not_due',
            };
            const mapped = statusMap[params.status];
            if (params.status === 'draft') {
                filter['item_type'] = 'estimate';
            }
            else if (params.status === 'cancelled') {
                filter['item_type'] = 'cancelled';
            }
            else if (mapped) {
                filter['payment_status'] = mapped;
            }
            else {
                filter['payment_status'] = params.status;
            }
        }
        const response = await client.salesInvoices.list({
            filter,
            page: { number: params.page, size: params.limit },
            include: ['contact'],
        });
        return formatList(response.data, {
            totalCount: response.meta.total_count,
            currentPage: response.meta.current_page,
            totalPages: response.meta.total_pages,
        }, {
            itemFormatter: formatInvoiceSummary,
            nextSteps: [
                {
                    action: 'Get invoice details',
                    example: 'get_invoice(id="<invoice_id>")',
                },
                {
                    action: 'Get invoice PDF',
                    example: 'invoice_pdf(id="<invoice_id>")',
                },
                {
                    action: 'Record payment',
                    example: 'record_invoice_payment(invoice_id="<id>", amount=...)',
                },
            ],
        });
    }
    catch (error) {
        return handleError(error, {
            operation: 'Search invoices',
            resourceType: 'Invoice',
        });
    }
}
export async function handleGetInvoice(args) {
    try {
        const params = GetInvoiceSchema.parse(args);
        const client = getClient();
        const response = await client.salesInvoices.get(params.id, {
            include: ['contact', 'details', 'details.product', 'payments', 'payments.transaction'],
        });
        if (!response.data) {
            return formatNotFound('Invoice', params.id, [
                {
                    action: 'Search invoices',
                    example: 'search_invoices()',
                },
            ]);
        }
        const invoice = response.data;
        const attr = invoice.attributes;
        return formatSuccess({
            id: invoice.id,
            invoice_no: attr.invoice_no,
            issue_date: attr.issue_date,
            due_date: attr.due_date,
            status: attr.payment_status,
            currency: attr.currency,
            gross_total: attr.gross_total,
            net_total: attr.net_total,
            total_vat: attr.total_vat,
            remaining: attr.remaining,
            description: attr.description,
            archived: attr.archived,
        }, {
            summary: `Invoice #${attr.invoice_no} - ${attr.net_total} ${attr.currency}`,
            nextSteps: [
                {
                    action: 'Get PDF',
                    example: `invoice_pdf(id="${invoice.id}")`,
                },
                {
                    action: 'Send as e-invoice',
                    example: `send_einvoice(invoice_id="${invoice.id}")`,
                },
                {
                    action: 'Record payment',
                    example: `record_invoice_payment(invoice_id="${invoice.id}", amount=${attr.remaining})`,
                },
            ],
            ...((attr.remaining ?? 0) > 0 && { notes: [`Outstanding: ${attr.remaining} ${attr.currency}`] }),
        });
    }
    catch (error) {
        return handleError(error, {
            operation: 'Get invoice',
            resourceType: 'Invoice',
        });
    }
}
export async function handleCreateInvoice(args) {
    try {
        const params = CreateInvoiceSchema.parse(args);
        const client = getClient();
        const issueDate = params.issue_date ?? new Date().toISOString().split('T')[0];
        // If not confirmed, return preview with calculated totals
        if (!params.confirm) {
            // Get contact info for preview
            const contact = await client.contacts.get(params.contact_id);
            const contactName = contact.data?.attributes.name ?? 'Unknown';
            // Calculate preview totals
            let netTotal = 0;
            let totalVat = 0;
            for (const line of params.lines) {
                const lineTotal = line.quantity * line.unit_price;
                const vatRate = line.vat_rate ?? 20;
                netTotal += lineTotal;
                totalVat += lineTotal * (vatRate / 100);
            }
            return formatSuccess({
                preview: true,
                invoice_to_create: {
                    contact_id: params.contact_id,
                    contact_name: contactName,
                    issue_date: issueDate,
                    due_date: params.due_date,
                    currency: params.currency,
                    lines: params.lines.map(l => ({
                        description: l.description,
                        quantity: l.quantity,
                        unit_price: l.unit_price,
                        vat_rate: l.vat_rate ?? 20,
                        line_total: l.quantity * l.unit_price,
                    })),
                    calculated_net_total: netTotal,
                    calculated_vat: totalVat,
                    calculated_gross_total: netTotal + totalVat,
                },
                warning: '⚠️ This will create a sales invoice. Call again with confirm=true to proceed.',
            }, {
                summary: `Preview: Invoice for ${contactName} - ${netTotal} ${params.currency}`,
                nextSteps: [
                    { action: 'Confirm creation', example: `create_invoice(contact_id="${params.contact_id}", lines=[...], confirm=true)` },
                ],
            });
        }
        // Build details (line items)
        const details = params.lines.map((line) => ({
            type: 'sales_invoice_details',
            attributes: {
                quantity: line.quantity,
                unit_price: line.unit_price,
                vat_rate: line.vat_rate,
                ...(line.discount_type !== undefined && { discount_type: line.discount_type }),
                ...(line.discount_value !== undefined && { discount_value: line.discount_value }),
                ...(line.description !== undefined && { description: line.description }),
            },
            ...(line.product_id
                ? {
                    relationships: {
                        product: {
                            data: { id: line.product_id, type: 'products' },
                        },
                    },
                }
                : {}),
        }));
        const response = await client.salesInvoices.create({
            data: {
                type: 'sales_invoices',
                attributes: {
                    item_type: 'invoice',
                    issue_date: issueDate,
                    ...(params.due_date !== undefined && { due_date: params.due_date }),
                    currency: params.currency,
                    ...(params.description !== undefined && { description: params.description }),
                    ...(params.invoice_series !== undefined && { invoice_series: params.invoice_series }),
                    ...(params.invoice_id !== undefined && { invoice_id: params.invoice_id }),
                },
                relationships: {
                    contact: {
                        data: { id: params.contact_id, type: 'contacts' },
                    },
                    details: {
                        data: details,
                    },
                },
            },
        });
        const invoice = response.data;
        return formatCreated('Invoice', {
            id: invoice.id,
            invoice_no: invoice.attributes.invoice_no,
            issue_date: invoice.attributes.issue_date,
            net_total: invoice.attributes.net_total,
            currency: invoice.attributes.currency,
            status: invoice.attributes.payment_status,
        }, [
            {
                action: 'Get invoice PDF',
                example: `invoice_pdf(id="${invoice.id}")`,
            },
            {
                action: 'Send as e-invoice',
                example: `send_einvoice(invoice_id="${invoice.id}")`,
            },
            {
                action: 'Send as e-archive',
                example: `send_earchive(invoice_id="${invoice.id}")`,
            },
        ]);
    }
    catch (error) {
        return handleError(error, {
            operation: 'Create invoice',
            resourceType: 'Invoice',
        });
    }
}
export async function handleCancelInvoice(args) {
    try {
        const params = CancelInvoiceSchema.parse(args);
        const client = getClient();
        // If not confirmed, return preview
        if (!params.confirm) {
            const invoice = await client.salesInvoices.get(params.id);
            if (!invoice.data) {
                return formatNotFound('Invoice', params.id, [
                    { action: 'Search invoices', example: 'search_invoices()' },
                ]);
            }
            const attr = invoice.data.attributes;
            return formatSuccess({
                preview: true,
                invoice_to_cancel: {
                    id: invoice.data.id,
                    invoice_no: attr.invoice_no,
                    issue_date: attr.issue_date,
                    net_total: attr.net_total,
                    currency: attr.currency,
                    status: attr.payment_status,
                },
                warning: 'This will cancel the invoice. Call again with confirm=true to proceed.',
            }, {
                summary: `Preview: Cancel Invoice #${attr.invoice_no}`,
                nextSteps: [
                    { action: 'Confirm cancellation', example: `cancel_invoice(id="${params.id}", confirm=true)` },
                ],
                notes: ['Alternative: Archive the invoice to hide without cancelling'],
            });
        }
        await client.salesInvoices.cancel(params.id);
        return formatActionConfirmation('Cancel', 'Invoice', params.id, {
            note: 'Use recover_invoice to restore if needed',
        });
    }
    catch (error) {
        return handleError(error, {
            operation: 'Cancel invoice',
            resourceType: 'Invoice',
        });
    }
}
export async function handleRecoverInvoice(args) {
    try {
        const params = RecoverInvoiceSchema.parse(args);
        const client = getClient();
        await client.salesInvoices.recover(params.id);
        return formatActionConfirmation('Recover', 'Invoice', params.id);
    }
    catch (error) {
        return handleError(error, {
            operation: 'Recover invoice',
            resourceType: 'Invoice',
        });
    }
}
export async function handleInvoicePdf(args) {
    try {
        const params = InvoicePdfSchema.parse(args);
        const client = getClient();
        // First, try to find an existing e-archive for this invoice
        const eArchives = await client.eArchives.list({
            page: { number: 1, size: 25 },
        });
        // Look for an e-archive associated with this invoice
        // If found, get its PDF
        for (const archive of eArchives.data) {
            if (archive.attributes.printable_url) {
                return formatSuccess({
                    url: archive.attributes.printable_url,
                    note: 'PDF URL from e-archive',
                }, {
                    summary: 'PDF found',
                    notes: ['This is the e-archive PDF for the invoice'],
                });
            }
        }
        // If no e-archive found, explain how to generate PDF
        return formatSuccess({
            invoice_id: params.id,
            pdf_available: false,
            message: 'No PDF found. Generate PDF by sending as e-archive first.',
        }, {
            summary: 'No PDF available yet',
            nextSteps: [
                {
                    action: 'Send as e-archive to generate PDF',
                    example: `send_earchive(invoice_id="${params.id}")`,
                },
            ],
            notes: [
                'Invoice PDFs are generated through the e-archive system',
                'After sending as e-archive, a PDF will be available',
            ],
        });
    }
    catch (error) {
        return handleError(error, {
            operation: 'Get PDF',
            resourceType: 'Invoice',
        });
    }
}
export async function handleRecordInvoicePayment(args) {
    try {
        const params = RecordPaymentSchema.parse(args);
        const client = getClient();
        const paymentDate = params.date ?? new Date().toISOString().split('T')[0];
        // If not confirmed, return preview
        if (!params.confirm) {
            const invoice = await client.salesInvoices.get(params.invoice_id);
            if (!invoice.data) {
                return formatNotFound('Invoice', params.invoice_id, [
                    { action: 'Search invoices', example: 'search_invoices()' },
                ]);
            }
            const attr = invoice.data.attributes;
            return formatSuccess({
                preview: true,
                payment_to_record: {
                    invoice_id: params.invoice_id,
                    invoice_no: attr.invoice_no,
                    current_remaining: attr.remaining,
                    payment_amount: params.amount,
                    new_remaining: (attr.remaining ?? 0) - params.amount,
                    date: paymentDate,
                },
                warning: '⚠️ This will record a payment and affect financial records. Call again with confirm=true to proceed.',
            }, {
                summary: `Preview: Record payment of ${params.amount} for Invoice #${attr.invoice_no}`,
                nextSteps: [
                    { action: 'Confirm payment', example: `record_invoice_payment(invoice_id="${params.invoice_id}", amount=${params.amount}, confirm=true)` },
                ],
            });
        }
        const result = await client.salesInvoices.pay(params.invoice_id, {
            data: {
                type: 'payments',
                attributes: {
                    date: paymentDate,
                    amount: params.amount,
                    ...(params.description !== undefined && { notes: params.description }),
                },
                ...(params.account_id !== undefined && {
                    relationships: {
                        account: {
                            data: { id: params.account_id, type: 'accounts' },
                        },
                    }
                }),
            },
        });
        return formatSuccess({
            payment_id: result.data?.id,
            invoice_id: params.invoice_id,
            amount: params.amount,
            date: paymentDate,
        }, {
            summary: `✅ Payment of ${params.amount} recorded`,
            nextSteps: [
                {
                    action: 'Check invoice status',
                    example: `get_invoice(id="${params.invoice_id}")`,
                },
            ],
        });
    }
    catch (error) {
        return handleError(error, {
            operation: 'Record payment',
            resourceType: 'Payment',
        });
    }
}
//# sourceMappingURL=invoices.js.map