/**
 * Financial Tools
 *
 * Tools for accounts, transactions, and financial overview.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient } from '../client.js';
import { formatSuccess, formatList, formatCreated, type ToolResponse } from '../utils/response.js';
import { handleError } from '../utils/errors.js';

// ============================================================================
// Schemas
// ============================================================================

const ListAccountsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(25).default(25),
});

const SearchTransactionsSchema = z.object({
  account_id: z.string().optional().describe('Filter by account ID. If omitted, the first account is used.'),
  date_start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  date_end: z.string().optional().describe('End date (YYYY-MM-DD)'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(25).default(25),
});

const CreateBankFeeSchema = z.object({
  account_id: z.string().describe('Bank account ID'),
  amount: z.number().positive().describe('Fee amount'),
  date: z.string().optional().describe('Transaction date'),
  description: z.string().optional().describe('Fee description'),
  confirm: z.boolean().optional().describe('⚠️ Set to true to confirm bank fee. Required to execute.'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const financialTools: Tool[] = [
  {
    name: 'list_accounts',
    description: `
<usecase>
List all cash and bank accounts with their current balances.
Use when: Checking available funds, selecting account for payments.
Do NOT use when: Looking for transactions (use search_transactions instead).
</usecase>

<example>
list_accounts()
</example>

<returns>
List of accounts with: id, name, account_type, currency, balance, bank_name, iban.
Use the ID for record_invoice_payment or record_bill_payment.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 25 },
      },
    },
  },
  {
    name: 'search_transactions',
    description: `
<usecase>
Search for financial transactions.
Use when: Viewing payment history, account movements, or reconciliation.
Do NOT use when: Checking account balances (use list_accounts instead).
</usecase>

<example>
search_transactions(account_id="12345")
search_transactions(date_start="2024-01-01", date_end="2024-12-31")
</example>

<returns>
List of transactions with payment/transfer details.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Filter by account ID. If omitted, the first active account is used.' },
        date_start: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_end: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 25 },
      },
    },
  },
  {
    name: 'create_bank_fee',
    description: `
<usecase>
🏦 Record a bank fee or charge. THIS AFFECTS FINANCIAL RECORDS.
Use when: Recording bank service charges, transfer fees, or other bank expenses.
Do NOT use when: Recording supplier expenses (use create_bill instead).
</usecase>

<instructions>
⚠️ REQUIRES CONFIRMATION: Set confirm=true to execute.
- account_id: Bank account ID (required)
- amount: Fee amount (required)
- confirm: Must be true to execute. Without confirm=true, returns preview only.
</instructions>

<example>
create_bank_fee(account_id="12345", amount=25.50)                    # Preview only
create_bank_fee(account_id="12345", amount=25.50, confirm=true)       # Actually records
</example>

<returns>
Without confirm: Preview of bank fee to be recorded.
With confirm=true: Created bank fee record with: id, amount.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Bank account ID' },
        amount: { type: 'number', description: 'Fee amount' },
        confirm: { type: 'boolean', description: '⚠️ Set to true to confirm bank fee. Required to execute.' },
        date: { type: 'string', description: 'Transaction date (YYYY-MM-DD)' },
        description: { type: 'string', description: 'Fee description' },
      },
      required: ['account_id', 'amount'],
    },
  },
  {
    name: 'get_financial_summary',
    description: `
<usecase>
Get a financial summary including outstanding receivables and payables.
Use when: Getting a quick overview of financial position.
Do NOT use when: Need detailed invoice/bill lists (use search_invoices/search_bills).
</usecase>

<example>
get_financial_summary()
</example>

<returns>
- accounts_receivable: total owed by customers, open invoice count
- accounts_payable: total owed to suppliers, open bill count
- account_balances: balances by currency
- net_position: receivables minus payables
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Handlers
// ============================================================================

export async function handleListAccounts(args: unknown): Promise<ToolResponse> {
  try {
    const params = ListAccountsSchema.parse(args);
    const client = getClient();

    const response = await client.accounts.list({
      page: { number: params.page, size: params.limit },
    });

    const accounts = response.data.map((account) => ({
      id: account.id,
      name: account.attributes.name,
      account_type: account.attributes.account_type,
      currency: account.attributes.currency,
      balance: account.attributes.balance,
      bank_name: account.attributes.bank_name,
      iban: account.attributes.iban,
    }));

    return formatList(accounts, {
      totalCount: response.meta.total_count,
      currentPage: response.meta.current_page,
      totalPages: response.meta.total_pages,
    }, {
      nextSteps: [
        { action: 'View transactions', example: 'search_transactions(account_id="<id>")' },
        { action: 'Record bank fee', example: 'create_bank_fee(account_id="<id>", amount=...)' },
      ],
    });
  } catch (error) {
    return handleError(error, { operation: 'List accounts' });
  }
}

export async function handleSearchTransactions(args: unknown): Promise<ToolResponse> {
  try {
    const params = SearchTransactionsSchema.parse(args);
    const client = getClient();

    let accountId = params.account_id;
    let accountName: string | undefined;

    if (!accountId) {
      const accounts = await client.accounts.list({ page: { number: 1, size: 25 } });
      if (!accounts.data.length) {
        return formatSuccess([], {
          summary: 'No accounts found to search transactions for.',
        });
      }
      accountId = accounts.data[0]!.id;
      accountName = accounts.data[0]!.attributes.name;
    }

    const filter: Record<string, string> = {};
    if (params.date_start) filter['date'] = params.date_start;

    const response = await client.accounts.listTransactions(accountId, {
      filter,
      page: { number: params.page, size: params.limit },
    });

    const transactions = (response.data ?? []).map((t: any) => ({
      id: t.id,
      date: t.attributes?.date,
      transaction_type: t.attributes?.transaction_type,
      debit_amount: t.attributes?.debit_amount ? Number(t.attributes.debit_amount) : undefined,
      debit_currency: t.attributes?.debit_currency,
      credit_amount: t.attributes?.credit_amount ? Number(t.attributes.credit_amount) : undefined,
      credit_currency: t.attributes?.credit_currency,
      description: t.attributes?.description || t.attributes?.auto_description,
      is_reconciled: t.attributes?.is_reconciled,
    }));

    return formatList(transactions, {
      totalCount: (response as any).meta?.total_count ?? transactions.length,
      currentPage: (response as any).meta?.current_page ?? params.page,
      totalPages: (response as any).meta?.total_pages ?? 1,
    }, {
      ...(accountName ? { summary: `Showing transactions for account "${accountName}" (ID: ${accountId})` } : {}),
      nextSteps: [
        { action: 'Search another account', example: 'search_transactions(account_id="<id>")' },
      ],
    });
  } catch (error) {
    return handleError(error, { operation: 'Search transactions' });
  }
}

export async function handleCreateBankFee(args: unknown): Promise<ToolResponse> {
  try {
    const params = CreateBankFeeSchema.parse(args);
    const client = getClient();

    const issueDate = params.date ?? new Date().toISOString().split('T')[0]!;

    // If not confirmed, return preview
    if (!params.confirm) {
      // Try to get account info for preview
      const accounts = await client.accounts.list({ page: { number: 1, size: 25 } });
      const account = accounts.data.find(a => a.id === params.account_id);

      return formatSuccess({
        preview: true,
        bank_fee_to_record: {
          account_id: params.account_id,
          account_name: account?.attributes.name ?? 'Unknown',
          amount: params.amount,
          date: issueDate,
          description: params.description ?? 'Bank fee',
        },
        warning: '⚠️ This will record a bank fee and affect financial records. Call again with confirm=true to proceed.',
      }, {
        summary: `Preview: Record bank fee of ${params.amount} for ${account?.attributes.name ?? 'account'}`,
        nextSteps: [
          { action: 'Confirm bank fee', example: `create_bank_fee(account_id="${params.account_id}", amount=${params.amount}, confirm=true)` },
        ],
      });
    }

    const response = await client.bankFees.create({
      data: {
        type: 'bank_fees',
        attributes: {
          issue_date: issueDate,
          due_date: issueDate,
          currency: 'TRL',
          description: params.description ?? 'Bank fee',
          net_total: params.amount,
        },
      },
    });

    if (params.account_id && response.data?.id) {
      await client.bankFees.pay(response.data.id, {
        data: {
          type: 'payments',
          attributes: {
            date: issueDate,
            amount: params.amount,
            description: params.description ?? 'Bank fee',
            account_id: Number(params.account_id),
          },
          relationships: {
            account: {
              data: { id: params.account_id, type: 'accounts' },
            },
          },
        },
      });
    }

    return formatCreated('Bank Fee', {
      id: response.data.id,
      amount: params.amount,
    });
  } catch (error) {
    return handleError(error, { operation: 'Create bank fee' });
  }
}

export async function handleGetFinancialSummary(_args: unknown): Promise<ToolResponse> {
  try {
    const client = getClient();

    // Fetch accounts for balances
    const accountsResponse = await client.accounts.list({
      page: { number: 1, size: 25 },
    });

    // Calculate totals by currency
    const balances: Record<string, number> = {};
    for (const account of accountsResponse.data) {
      const currency = account.attributes.currency ?? 'TRL';
      const balance = Number(account.attributes.balance ?? 0) || 0;
      balances[currency] = (balances[currency] ?? 0) + balance;
    }

    // Fetch open invoices for receivables
    const receivablesResponse = await client.salesInvoices.list({
      filter: { payment_status: 'not_due' },
      page: { number: 1, size: 25 },
    });

    let totalReceivables = 0;
    for (const invoice of receivablesResponse.data) {
      totalReceivables += Number(invoice.attributes.remaining ?? 0) || 0;
    }

    // Fetch open bills for payables
    const payablesResponse = await client.purchaseBills.list({
      page: { number: 1, size: 25 },
    });

    let totalPayables = 0;
    for (const bill of payablesResponse.data) {
      totalPayables += Number(bill.attributes.remaining ?? 0) || 0;
    }

    return formatSuccess({
      accounts_receivable: {
        total: totalReceivables,
        currency: 'TRL',
        open_invoices: receivablesResponse.meta.total_count,
      },
      accounts_payable: {
        total: totalPayables,
        currency: 'TRL',
        open_bills: payablesResponse.meta.total_count,
      },
      account_balances: balances,
      net_position: totalReceivables - totalPayables,
    }, {
      summary: 'Financial Summary',
      notes: [
        `Receivables: ${totalReceivables.toFixed(2)} TRY (${receivablesResponse.meta.total_count} open invoices)`,
        `Payables: ${totalPayables.toFixed(2)} TRY (${payablesResponse.meta.total_count} open bills)`,
        `Net Position: ${(totalReceivables - totalPayables).toFixed(2)} TRY`,
      ],
    });
  } catch (error) {
    return handleError(error, { operation: 'Get financial summary' });
  }
}
