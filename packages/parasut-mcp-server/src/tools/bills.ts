/**
 * Purchase Bill Tools
 *
 * Tools for managing expenses and purchase bills.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient } from '../client.js';
import {
  formatSuccess,
  formatList,
  formatCreated,
  formatNotFound,
  type ToolResponse,
} from '../utils/response.js';
import { handleError } from '../utils/errors.js';

// ============================================================================
// Schemas
// ============================================================================

const SearchBillsSchema = z.object({
  supplier_id: z.string().optional().describe('Filter by supplier ID'),
  issue_date_start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  issue_date_end: z.string().optional().describe('End date (YYYY-MM-DD)'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(25).default(25),
});

const GetBillSchema = z.object({
  id: z.string().describe('Bill ID'),
});

const BillLineSchema = z.object({
  description: z.string().describe('Line item description'),
  quantity: z.number().positive().default(1),
  unit_price: z.number().describe('Unit price'),
  vat_rate: z.number().min(0).max(100).default(20),
  category_id: z.string().optional().describe('Expense category ID'),
  product_id: z.string().optional().describe('Product ID (optional)'),
});

const CreateBillSchema = z.object({
  supplier_id: z.string().describe('Supplier contact ID'),
  issue_date: z.string().optional().describe('Bill date (YYYY-MM-DD)'),
  due_date: z.string().optional().describe('Due date'),
  invoice_no: z.string().optional().describe('Supplier invoice number'),
  currency: z.enum(['TRL', 'USD', 'EUR', 'GBP']).default('TRL'),
  lines: z.array(BillLineSchema).min(1).describe('Bill line items'),
  confirm: z.boolean().optional().describe('⚠️ Set to true to confirm creation. Required to execute.'),
});

const RecordBillPaymentSchema = z.object({
  bill_id: z.string().describe('Bill ID'),
  amount: z.number().positive().describe('Payment amount'),
  date: z.string().optional().describe('Payment date'),
  account_id: z.string().optional().describe('Account ID'),
  description: z.string().optional().describe('Payment description / note'),
  confirm: z.boolean().optional().describe('⚠️ Set to true to confirm payment. Required to execute.'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const billTools: Tool[] = [
  {
    name: 'search_bills',
    description: `
<usecase>
Search for purchase bills (expenses/supplier invoices).
Use when: Finding bills by supplier, date range, or browsing expenses.
Do NOT use when: You have the bill ID (use get_bill instead).
</usecase>

<example>
search_bills(supplier_id="12345")
search_bills(issue_date_start="2024-01-01")
</example>

<returns>
List of bills with: id, invoice_no, issue_date, net_total, remaining, currency.
Use the ID to call get_bill for full details.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string', description: 'Filter by supplier ID' },
        issue_date_start: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        issue_date_end: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 25 },
      },
    },
  },
  {
    name: 'get_bill',
    description: `
<usecase>
Get detailed information about a purchase bill.
Use when: You have a bill ID and need full details, line items, or payment history.
Do NOT use when: You don't have the ID yet (use search_bills first).
</usecase>

<example>
get_bill(id="12345")
</example>

<returns>
Full bill: id, invoice_no, issue_date, net_total, remaining, currency.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Bill ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_bill',
    description: `
<usecase>
📋 Create a new purchase bill (expense). THIS CREATES A FINANCIAL RECORD.
Use when: Recording an expense or supplier invoice.
Do NOT use when: Creating a sales invoice to a customer (use create_invoice instead).
</usecase>

<instructions>
⚠️ REQUIRES CONFIRMATION: Set confirm=true to execute.
- supplier_id: Supplier contact ID (required)
- lines: Expense line items (required)
- category_id in lines: Expense category for accounting
- currency: Must be TRL, USD, EUR, or GBP
- confirm: Must be true to execute. Without confirm=true, returns preview only.
</instructions>

<example>
create_bill(supplier_id="12345", lines=[...])                    # Preview only
create_bill(supplier_id="12345", lines=[...], confirm=true)       # Actually creates
</example>

<returns>
Without confirm: Preview of bill to be created with calculated totals.
With confirm=true: Created bill with: id, invoice_no.
Use the ID for record_bill_payment.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string' },
        issue_date: { type: 'string' },
        due_date: { type: 'string' },
        invoice_no: { type: 'string' },
        currency: { type: 'string', enum: ['TRL', 'USD', 'EUR', 'GBP'], description: 'Currency. MUST be one of: TRL, USD, EUR, GBP' },
        confirm: { type: 'boolean', description: '⚠️ Set to true to confirm creation. Required to execute.' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' },
              vat_rate: { type: 'number' },
              category_id: { type: 'string' },
              product_id: { type: 'string' },
            },
            required: ['description', 'unit_price'],
          },
        },
      },
      required: ['supplier_id', 'lines'],
    },
  },
  {
    name: 'record_bill_payment',
    description: `
<usecase>
💸 Record a payment made for a purchase bill. THIS AFFECTS FINANCIAL RECORDS.
Use when: Paying a supplier for an outstanding bill.
Do NOT use when: Recording a payment received from a customer (use record_invoice_payment).
</usecase>

<instructions>
⚠️ REQUIRES CONFIRMATION: Set confirm=true to execute.
- bill_id: Bill ID (required)
- amount: Payment amount (required)
- confirm: Must be true to execute. Without confirm=true, returns preview only.
</instructions>

<example>
record_bill_payment(bill_id="12345", amount=5000)                    # Preview only
record_bill_payment(bill_id="12345", amount=5000, confirm=true)       # Actually records
</example>

<returns>
Without confirm: Preview of payment to be recorded.
With confirm=true: Payment record with: payment_id, amount.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        bill_id: { type: 'string' },
        amount: { type: 'number' },
        confirm: { type: 'boolean', description: '⚠️ Set to true to confirm payment. Required to execute.' },
        date: { type: 'string', description: 'Payment date (YYYY-MM-DD)' },
        account_id: { type: 'string', description: 'Bank/cash account ID' },
        description: { type: 'string', description: 'Payment description / note' },
      },
      required: ['bill_id', 'amount'],
    },
  },
];

// ============================================================================
// Handlers
// ============================================================================

export async function handleSearchBills(args: unknown): Promise<ToolResponse> {
  try {
    const params = SearchBillsSchema.parse(args);
    const client = getClient();

    const filter: Record<string, string> = {};
    if (params.supplier_id) filter['supplier_id'] = params.supplier_id;
    if (params.issue_date_start) filter['issue_date'] = params.issue_date_start;

    const response = await client.purchaseBills.list({
      filter,
      page: { number: params.page, size: params.limit },
    });

    return formatList(response.data, {
      totalCount: response.meta.total_count,
      currentPage: response.meta.current_page,
      totalPages: response.meta.total_pages,
    }, {
      nextSteps: [
        { action: 'Get bill details', example: 'get_bill(id="<id>")' },
        { action: 'Record payment', example: 'record_bill_payment(bill_id="<id>", amount=...)' },
      ],
    });
  } catch (error) {
    return handleError(error, { operation: 'Search bills', resourceType: 'Bill' });
  }
}

export async function handleGetBill(args: unknown): Promise<ToolResponse> {
  try {
    const params = GetBillSchema.parse(args);
    const client = getClient();

    const response = await client.purchaseBills.get(params.id, {
      include: ['supplier', 'details', 'payments'],
    });

    if (!response.data) {
      return formatNotFound('Bill', params.id, [
        { action: 'Search bills', example: 'search_bills()' },
      ]);
    }

    const bill = response.data;
    return formatSuccess({
      id: bill.id,
      invoice_no: bill.attributes.invoice_no,
      issue_date: bill.attributes.issue_date,
      net_total: bill.attributes.net_total,
      remaining: bill.attributes.remaining,
      currency: bill.attributes.currency,
    }, {
      summary: `Bill #${bill.attributes.invoice_no}`,
    });
  } catch (error) {
    return handleError(error, { operation: 'Get bill', resourceType: 'Bill' });
  }
}

export async function handleCreateBill(args: unknown): Promise<ToolResponse> {
  try {
    const params = CreateBillSchema.parse(args);
    const client = getClient();

    const issueDate = params.issue_date ?? new Date().toISOString().split('T')[0]!;

    // If not confirmed, return preview
    if (!params.confirm) {
      // Try to get supplier info for preview
      let supplierName = 'Unknown';
      try {
        const supplier = await client.contacts.get(params.supplier_id);
        supplierName = supplier.data?.attributes.name ?? 'Unknown';
      } catch {
        // Supplier lookup failed, continue with unknown
      }

      // Calculate totals for preview
      let netTotal = 0;
      let totalVat = 0;
      for (const line of params.lines) {
        const lineTotal = (line.quantity ?? 1) * line.unit_price;
        const vatRate = line.vat_rate ?? 20;
        netTotal += lineTotal;
        totalVat += lineTotal * (vatRate / 100);
      }

      return formatSuccess({
        preview: true,
        bill_to_create: {
          supplier_id: params.supplier_id,
          supplier_name: supplierName,
          issue_date: issueDate,
          due_date: params.due_date,
          invoice_no: params.invoice_no,
          currency: params.currency,
          line_count: params.lines.length,
          net_total: netTotal,
          vat_total: totalVat,
          gross_total: netTotal + totalVat,
        },
        warning: '⚠️ This will create a purchase bill (expense). Call again with confirm=true to proceed.',
      }, {
        summary: `Preview: Create bill for ${supplierName} - ${netTotal.toFixed(2)} ${params.currency}`,
        nextSteps: [
          { action: 'Confirm creation', example: `create_bill(supplier_id="${params.supplier_id}", lines=[...], confirm=true)` },
        ],
      });
    }

    const details = params.lines.map((line) => ({
      type: 'purchase_bill_details' as const,
      attributes: {
        description: line.description,
        quantity: line.quantity ?? 1,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate ?? 20,
      },
      ...(line.product_id
        ? {
            relationships: {
              product: {
                data: { id: line.product_id, type: 'products' as const },
              },
            },
          }
        : {}),
    }));

    const response = await client.purchaseBills.create({
      data: {
        type: 'purchase_bills',
        attributes: {
          item_type: 'purchase_bill',
          issue_date: issueDate,
          due_date: params.due_date ?? issueDate,
          ...(params.invoice_no !== undefined && { invoice_no: params.invoice_no }),
          currency: params.currency,
        },
        relationships: {
          supplier: { data: { id: params.supplier_id, type: 'contacts' } },
          details: {
            data: details,
          },
        },
      },
    });

    return formatCreated('Bill', {
      id: response.data.id,
      invoice_no: response.data.attributes.invoice_no,
    }, [
      { action: 'Record payment', example: `record_bill_payment(bill_id="${response.data.id}", amount=...)` },
    ]);
  } catch (error) {
    return handleError(error, { operation: 'Create bill', resourceType: 'Bill' });
  }
}

export async function handleRecordBillPayment(args: unknown): Promise<ToolResponse> {
  try {
    const params = RecordBillPaymentSchema.parse(args);
    const client = getClient();

    const paymentDate = params.date ?? new Date().toISOString().split('T')[0]!;

    // If not confirmed, return preview
    if (!params.confirm) {
      const bill = await client.purchaseBills.get(params.bill_id);
      if (!bill.data) {
        return formatNotFound('Bill', params.bill_id, [
          { action: 'Search bills', example: 'search_bills()' },
        ]);
      }
      const attr = bill.data.attributes;
      return formatSuccess({
        preview: true,
        payment_to_record: {
          bill_id: params.bill_id,
          invoice_no: attr.invoice_no,
          current_remaining: attr.remaining,
          payment_amount: params.amount,
          new_remaining: (attr.remaining ?? 0) - params.amount,
          date: paymentDate,
        },
        warning: '⚠️ This will record a supplier payment and affect financial records. Call again with confirm=true to proceed.',
      }, {
        summary: `Preview: Record payment of ${params.amount} for Bill #${attr.invoice_no}`,
        nextSteps: [
          { action: 'Confirm payment', example: `record_bill_payment(bill_id="${params.bill_id}", amount=${params.amount}, confirm=true)` },
        ],
      });
    }

    const result = await client.purchaseBills.pay(params.bill_id, {
      data: {
        type: 'payments',
        attributes: {
          date: paymentDate,
          amount: params.amount,
          ...(params.description !== undefined && { description: params.description, notes: params.description }),
          ...(params.account_id !== undefined && !isNaN(Number(params.account_id)) && { account_id: Number(params.account_id) }),
        },
        ...(params.account_id !== undefined && {
          relationships: {
            account: { data: { id: params.account_id, type: 'accounts' } }
          }
        }),
      },
    });

    return formatSuccess({
      payment_id: result.data?.id,
      amount: params.amount,
    }, { summary: `✅ Payment of ${params.amount} recorded` });
  } catch (error) {
    return handleError(error, { operation: 'Record payment', resourceType: 'Payment' });
  }
}
