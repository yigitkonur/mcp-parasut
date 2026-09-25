/**
 * E-Document Tools
 *
 * Tools for Turkish electronic invoicing (e-fatura, e-arşiv, e-SMM).
 */
import { z } from 'zod';
import { getClient } from '../client.js';
import { formatSuccess, formatNotFound } from '../utils/response.js';
import { handleError } from '../utils/errors.js';
// ============================================================================
// Schemas
// ============================================================================
const CheckEInvoiceInboxSchema = z.object({
    tax_number: z.string().describe('Tax number (VKN/TCKN) to check'),
});
const SendEInvoiceSchema = z.object({
    invoice_id: z.string().describe('Sales invoice ID'),
    scenario: z
        .enum(['basic', 'commercial'])
        .default('basic')
        .describe('e-Invoice scenario'),
    note: z.string().optional().describe('Invoice note'),
    confirm: z.boolean().optional().describe('🚨 First confirmation: Set to true to proceed'),
    i_understand_this_is_irreversible: z.string().optional().describe('🚨 Second confirmation: Must be exactly "YES" to submit to GİB'),
});
const SendEArchiveSchema = z.object({
    invoice_id: z.string().describe('Sales invoice ID'),
    internet_sale: z
        .object({
        url: z.string().optional(),
        payment_type: z.enum(['KREDIKARTI/BANKAKARTI', 'EFT/HAVALE', 'KAPIDAODEME', 'ODEMEARACISI']).optional(),
        payment_platform: z.string().optional(),
        payment_date: z.string().optional(),
    })
        .optional()
        .describe('Internet sale details (required for e-commerce)'),
    confirm: z.boolean().optional().describe('🚨 First confirmation: Set to true to proceed'),
    i_understand_this_is_irreversible: z.string().optional().describe('🚨 Second confirmation: Must be exactly "YES" to submit to GİB'),
});
const SendESmmSchema = z.object({
    invoice_id: z.string().describe('Sales invoice ID'),
    note: z.string().optional().describe('Receipt note'),
    confirm: z.boolean().optional().describe('🚨 First confirmation: Set to true to proceed'),
    i_understand_this_is_irreversible: z.string().optional().describe('🚨 Second confirmation: Must be exactly "YES" to submit to GİB'),
});
// ============================================================================
// Tool Definitions
// ============================================================================
export const edocumentTools = [
    {
        name: 'check_einvoice_inbox',
        description: `
<usecase>
Check if a contact (by tax number) is registered for e-Invoice (e-fatura).
Use when: Before sending an e-invoice to verify the recipient can receive it.
Do NOT use when: Sending to a consumer or non-registered entity (use send_earchive).
</usecase>

<instructions>
- tax_number: The VKN (corporate) or TCKN (individual) to check
</instructions>

<example>
check_einvoice_inbox(tax_number="1234567890")
</example>

<returns>
- registered: true/false
- If registered: inbox alias and name
- If not registered: suggestion to use send_earchive
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                tax_number: { type: 'string', description: 'Tax number (VKN/TCKN) to check' },
            },
            required: ['tax_number'],
        },
    },
    {
        name: 'send_einvoice',
        description: `
<usecase>
🚨🚨🚨 IRREVERSIBLE OPERATION - SUBMITS TO GİB (TAX AUTHORITY) 🚨🚨🚨
Send an invoice as e-Invoice (e-fatura) to the GİB system.
Use when: Recipient is registered for e-invoice (check with check_einvoice_inbox first).
Do NOT use when: Recipient is NOT registered (use send_earchive instead).
</usecase>

<instructions>
⛔ DOUBLE CONFIRMATION REQUIRED - THIS CANNOT BE UNDONE:
1. First: Set confirm=true
2. Second: Set i_understand_this_is_irreversible="YES"

Without BOTH confirmations, returns preview only.

- invoice_id: The sales invoice ID to send
- scenario: Must be "basic" (default) or "commercial"
- First use check_einvoice_inbox to verify the recipient
</instructions>

<example>
send_einvoice(invoice_id="12345")                                                           # Preview only
send_einvoice(invoice_id="12345", confirm=true)                                              # Still preview
send_einvoice(invoice_id="12345", confirm=true, i_understand_this_is_irreversible="YES")     # SUBMITS TO GİB
</example>

<returns>
Without full confirmation: Preview of e-invoice to be submitted.
With both confirmations: Submission confirmation with e_invoice_id.
</returns>

<notes>
⚠️ WARNING: Once submitted to GİB, this CANNOT be reversed!
- Official tax document - mistakes require formal cancellation process
- Use get_invoice to check the final status
</notes>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                invoice_id: { type: 'string' },
                scenario: { type: 'string', enum: ['basic', 'commercial'], description: 'e-Invoice scenario. MUST be one of: basic, commercial', default: 'basic' },
                note: { type: 'string' },
                confirm: { type: 'boolean', description: '🚨 First confirmation: Set to true' },
                i_understand_this_is_irreversible: { type: 'string', description: '🚨 Second confirmation: Must be exactly "YES"' },
            },
            required: ['invoice_id'],
        },
    },
    {
        name: 'send_earchive',
        description: `
<usecase>
🚨🚨🚨 IRREVERSIBLE OPERATION - SUBMITS TO GİB (TAX AUTHORITY) 🚨🚨🚨
Send an invoice as e-Archive (e-arşiv fatura).
Use when: Recipient is NOT registered for e-invoice (consumers, unregistered businesses).
Do NOT use when: Recipient IS registered for e-invoice (use send_einvoice instead).
</usecase>

<instructions>
⛔ DOUBLE CONFIRMATION REQUIRED - THIS CANNOT BE UNDONE:
1. First: Set confirm=true
2. Second: Set i_understand_this_is_irreversible="YES"

Without BOTH confirmations, returns preview only.

- invoice_id: The sales invoice ID to send
- internet_sale: Required for e-commerce sales
</instructions>

<example>
send_earchive(invoice_id="12345")                                                           # Preview only
send_earchive(invoice_id="12345", confirm=true)                                              # Still preview
send_earchive(invoice_id="12345", confirm=true, i_understand_this_is_irreversible="YES")     # SUBMITS TO GİB
</example>

<returns>
Without full confirmation: Preview of e-archive to be submitted.
With both confirmations: Submission confirmation with e_archive_id.
</returns>

<notes>
⚠️ WARNING: Once submitted to GİB, this CANNOT be reversed!
- Official tax document - mistakes require formal cancellation
- PDF will be available via invoice_pdf after submission
</notes>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                invoice_id: { type: 'string' },
                internet_sale: {
                    type: 'object',
                    properties: {
                        url: { type: 'string' },
                        payment_type: {
                            type: 'string',
                            enum: ['KREDIKARTI/BANKAKARTI', 'EFT/HAVALE', 'KAPIDAODEME', 'ODEMEARACISI'],
                            description: 'Payment type. MUST be one of: KREDIKARTI/BANKAKARTI, EFT/HAVALE, KAPIDAODEME, ODEMEARACISI',
                        },
                        payment_platform: { type: 'string' },
                        payment_date: { type: 'string' },
                    },
                },
                confirm: { type: 'boolean', description: '🚨 First confirmation: Set to true' },
                i_understand_this_is_irreversible: { type: 'string', description: '🚨 Second confirmation: Must be exactly "YES"' },
            },
            required: ['invoice_id'],
        },
    },
    {
        name: 'send_esmm',
        description: `
<usecase>
🚨🚨🚨 IRREVERSIBLE OPERATION - SUBMITS TO GİB (TAX AUTHORITY) 🚨🚨🚨
Send an invoice as e-SMM (e-Serbest Meslek Makbuzu / Freelancer Receipt).
Use when: Issuing a freelancer/professional service receipt.
Do NOT use when: Your business is not registered for e-SMM, or it's a standard invoice.
</usecase>

<instructions>
⛔ DOUBLE CONFIRMATION REQUIRED - THIS CANNOT BE UNDONE:
1. First: Set confirm=true
2. Second: Set i_understand_this_is_irreversible="YES"

Without BOTH confirmations, returns preview only.

- invoice_id: The sales invoice ID to convert to e-SMM
</instructions>

<example>
send_esmm(invoice_id="12345")                                                           # Preview only
send_esmm(invoice_id="12345", confirm=true)                                              # Still preview
send_esmm(invoice_id="12345", confirm=true, i_understand_this_is_irreversible="YES")     # SUBMITS TO GİB
</example>

<returns>
Without full confirmation: Preview of e-SMM to be submitted.
With both confirmations: Submission confirmation with e_smm_id.
</returns>

<notes>
⚠️ WARNING: Once submitted to GİB, this CANNOT be reversed!
- Your account must be registered for e-SMM
- Official tax document - mistakes require formal cancellation
</notes>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                invoice_id: { type: 'string' },
                note: { type: 'string' },
                confirm: { type: 'boolean', description: '🚨 First confirmation: Set to true' },
                i_understand_this_is_irreversible: { type: 'string', description: '🚨 Second confirmation: Must be exactly "YES"' },
            },
            required: ['invoice_id'],
        },
    },
];
// ============================================================================
// Handlers
// ============================================================================
export async function handleCheckEInvoiceInbox(args) {
    try {
        const params = CheckEInvoiceInboxSchema.parse(args);
        const client = getClient();
        const response = await client.eInvoiceInboxes.list({
            filter: { vkn: params.tax_number },
        });
        const inboxes = response.data;
        if (inboxes.length === 0) {
            return formatSuccess({
                tax_number: params.tax_number,
                registered: false,
                inboxes: [],
            }, {
                summary: `Tax number ${params.tax_number} is NOT registered for e-invoice`,
                nextSteps: [
                    { action: 'Send as e-archive instead', example: `send_earchive(invoice_id="<id>")` },
                ],
                notes: [
                    'This contact cannot receive e-invoices',
                    'Use e-archive (e-arşiv) for non-registered contacts',
                ],
            });
        }
        return formatSuccess({
            tax_number: params.tax_number,
            registered: true,
            inboxes: inboxes.map((inbox) => ({
                alias: inbox.attributes.e_invoice_address,
                name: inbox.attributes.name,
                inbox_type: inbox.attributes.inbox_type,
            })),
        }, {
            summary: `Tax number ${params.tax_number} IS registered for e-invoice`,
            nextSteps: [
                { action: 'Send e-invoice', example: `send_einvoice(invoice_id="<id>")` },
            ],
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Check e-invoice inbox' });
    }
}
export async function handleSendEInvoice(args) {
    try {
        const params = SendEInvoiceSchema.parse(args);
        const client = getClient();
        // DOUBLE CONFIRMATION CHECK - e-documents are IRREVERSIBLE
        const hasFirstConfirmation = params.confirm === true;
        const hasSecondConfirmation = params.i_understand_this_is_irreversible === 'YES';
        if (!hasFirstConfirmation || !hasSecondConfirmation) {
            // Get invoice info for preview
            const invoice = await client.salesInvoices.get(params.invoice_id, {
                include: ['contact'],
            });
            if (!invoice.data) {
                return formatNotFound('Invoice', params.invoice_id, [
                    { action: 'Search invoices', example: 'search_invoices()' },
                ]);
            }
            const attr = invoice.data.attributes;
            const missingConfirmations = [];
            if (!hasFirstConfirmation)
                missingConfirmations.push('confirm=true');
            if (!hasSecondConfirmation)
                missingConfirmations.push('i_understand_this_is_irreversible="YES"');
            return formatSuccess({
                preview: true,
                e_invoice_to_submit: {
                    invoice_id: params.invoice_id,
                    invoice_no: attr.invoice_no,
                    net_total: attr.net_total,
                    currency: attr.currency,
                    scenario: params.scenario,
                },
                missing_confirmations: missingConfirmations,
                warning: '🚨🚨🚨 THIS IS AN IRREVERSIBLE OPERATION! 🚨🚨🚨',
                danger: 'Once submitted to GİB (Turkey Tax Authority), this e-invoice CANNOT be undone. Mistakes require a formal cancellation process with the tax authority.',
            }, {
                summary: `⚠️ Preview: e-Invoice for #${attr.invoice_no} (${attr.net_total} ${attr.currency})`,
                nextSteps: [
                    { action: '⛔ Submit to GİB (IRREVERSIBLE)', example: `send_einvoice(invoice_id="${params.invoice_id}", confirm=true, i_understand_this_is_irreversible="YES")` },
                ],
                notes: [
                    '🚨 BOTH confirmations required: confirm=true AND i_understand_this_is_irreversible="YES"',
                    '⚠️ This will create an official tax document with GİB',
                ],
            });
        }
        const result = await client.eInvoices.submitAndWait({
            data: {
                type: 'e_invoices',
                attributes: {
                    scenario: params.scenario,
                    ...(params.note !== undefined && { note: params.note }),
                },
                relationships: {
                    invoice: {
                        data: { id: params.invoice_id, type: 'sales_invoices' },
                    },
                },
            },
        });
        return formatSuccess({
            e_invoice_id: result.data?.id,
            invoice_id: params.invoice_id,
            status: 'submitted',
        }, {
            summary: '✅ e-Invoice submitted to GİB successfully',
            nextSteps: [
                { action: 'Check invoice status', example: `get_invoice(id="${params.invoice_id}")` },
            ],
            notes: [
                'The e-invoice has been queued for processing by GİB',
                'Final status will be updated when GİB processes the document',
            ],
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Send e-invoice' });
    }
}
export async function handleSendEArchive(args) {
    try {
        const params = SendEArchiveSchema.parse(args);
        const client = getClient();
        // DOUBLE CONFIRMATION CHECK - e-documents are IRREVERSIBLE
        const hasFirstConfirmation = params.confirm === true;
        const hasSecondConfirmation = params.i_understand_this_is_irreversible === 'YES';
        if (!hasFirstConfirmation || !hasSecondConfirmation) {
            // Get invoice info for preview
            const invoice = await client.salesInvoices.get(params.invoice_id, {
                include: ['contact'],
            });
            if (!invoice.data) {
                return formatNotFound('Invoice', params.invoice_id, [
                    { action: 'Search invoices', example: 'search_invoices()' },
                ]);
            }
            const attr = invoice.data.attributes;
            const missingConfirmations = [];
            if (!hasFirstConfirmation)
                missingConfirmations.push('confirm=true');
            if (!hasSecondConfirmation)
                missingConfirmations.push('i_understand_this_is_irreversible="YES"');
            return formatSuccess({
                preview: true,
                e_archive_to_submit: {
                    invoice_id: params.invoice_id,
                    invoice_no: attr.invoice_no,
                    net_total: attr.net_total,
                    currency: attr.currency,
                    internet_sale: params.internet_sale ?? null,
                },
                missing_confirmations: missingConfirmations,
                warning: '🚨🚨🚨 THIS IS AN IRREVERSIBLE OPERATION! 🚨🚨🚨',
                danger: 'Once submitted to GİB (Turkey Tax Authority), this e-archive CANNOT be undone. Mistakes require a formal cancellation process with the tax authority.',
            }, {
                summary: `⚠️ Preview: e-Archive for #${attr.invoice_no} (${attr.net_total} ${attr.currency})`,
                nextSteps: [
                    { action: '⛔ Submit to GİB (IRREVERSIBLE)', example: `send_earchive(invoice_id="${params.invoice_id}", confirm=true, i_understand_this_is_irreversible="YES")` },
                ],
                notes: [
                    '🚨 BOTH confirmations required: confirm=true AND i_understand_this_is_irreversible="YES"',
                    '⚠️ This will create an official tax document with GİB',
                ],
            });
        }
        const attributes = {};
        if (params.internet_sale) {
            attributes['internet_sale'] = params.internet_sale;
        }
        const result = await client.eArchives.submitAndWait({
            data: {
                type: 'e_archives',
                attributes,
                relationships: {
                    sales_invoice: {
                        data: { id: params.invoice_id, type: 'sales_invoices' },
                    },
                },
            },
        });
        return formatSuccess({
            e_archive_id: result.data?.id,
            invoice_id: params.invoice_id,
            status: 'submitted',
        }, {
            summary: '✅ e-Archive submitted to GİB successfully',
            nextSteps: [
                { action: 'Check invoice status', example: `get_invoice(id="${params.invoice_id}")` },
                { action: 'Get PDF', example: `invoice_pdf(id="${params.invoice_id}")` },
            ],
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Send e-archive' });
    }
}
export async function handleSendESmm(args) {
    try {
        const params = SendESmmSchema.parse(args);
        const client = getClient();
        // DOUBLE CONFIRMATION CHECK - e-documents are IRREVERSIBLE
        const hasFirstConfirmation = params.confirm === true;
        const hasSecondConfirmation = params.i_understand_this_is_irreversible === 'YES';
        if (!hasFirstConfirmation || !hasSecondConfirmation) {
            // Get invoice info for preview
            const invoice = await client.salesInvoices.get(params.invoice_id, {
                include: ['contact'],
            });
            if (!invoice.data) {
                return formatNotFound('Invoice', params.invoice_id, [
                    { action: 'Search invoices', example: 'search_invoices()' },
                ]);
            }
            const attr = invoice.data.attributes;
            const missingConfirmations = [];
            if (!hasFirstConfirmation)
                missingConfirmations.push('confirm=true');
            if (!hasSecondConfirmation)
                missingConfirmations.push('i_understand_this_is_irreversible="YES"');
            return formatSuccess({
                preview: true,
                e_smm_to_submit: {
                    invoice_id: params.invoice_id,
                    invoice_no: attr.invoice_no,
                    net_total: attr.net_total,
                    currency: attr.currency,
                },
                missing_confirmations: missingConfirmations,
                warning: '🚨🚨🚨 THIS IS AN IRREVERSIBLE OPERATION! 🚨🚨🚨',
                danger: 'Once submitted to GİB (Turkey Tax Authority), this e-SMM CANNOT be undone. Mistakes require a formal cancellation process with the tax authority.',
            }, {
                summary: `⚠️ Preview: e-SMM for #${attr.invoice_no} (${attr.net_total} ${attr.currency})`,
                nextSteps: [
                    { action: '⛔ Submit to GİB (IRREVERSIBLE)', example: `send_esmm(invoice_id="${params.invoice_id}", confirm=true, i_understand_this_is_irreversible="YES")` },
                ],
                notes: [
                    '🚨 BOTH confirmations required: confirm=true AND i_understand_this_is_irreversible="YES"',
                    '⚠️ This will create an official tax document with GİB',
                ],
            });
        }
        const result = await client.eSmms.submitAndWait({
            data: {
                type: 'e_smms',
                attributes: {
                    ...(params.note !== undefined && { note: params.note }),
                },
                relationships: {
                    sales_invoice: {
                        data: { id: params.invoice_id, type: 'sales_invoices' },
                    },
                },
            },
        });
        return formatSuccess({
            e_smm_id: result.data?.id,
            invoice_id: params.invoice_id,
            status: 'submitted',
        }, {
            summary: '✅ e-SMM submitted to GİB successfully',
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Send e-SMM' });
    }
}
//# sourceMappingURL=edocuments.js.map