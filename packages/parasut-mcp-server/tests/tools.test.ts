import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeClient, resetClient } from '../src/client.js';
import { handleCreateInvoice, handleSearchInvoices } from '../src/tools/invoices.js';
import { handleCreateBill } from '../src/tools/bills.js';
import { handleGetFinancialSummary, handleSearchTransactions } from '../src/tools/financial.js';

describe('Tool Bugfixes Verification', () => {
  let createdSalesInvoicePayload: any = null;
  let searchedSalesInvoiceParams: any = null;
  let createdPurchaseBillPayload: any = null;
  let financialSalesInvoiceParams: any = null;
  let listTransactionsParams: any = null;

  beforeEach(() => {
    resetClient();
    createdSalesInvoicePayload = null;
    searchedSalesInvoiceParams = null;
    createdPurchaseBillPayload = null;
    financialSalesInvoiceParams = null;
    listTransactionsParams = null;

    // Initialize client with mock methods
    const client = initializeClient({
      companyId: 12345,
      accessToken: 'dummy-token',
    });

    // Mock salesInvoices.create
    client.salesInvoices.create = (async (payload: any) => {
      createdSalesInvoicePayload = payload;
      return {
        data: {
          id: 'inv-123',
          type: 'sales_invoices',
          attributes: {
            invoice_no: 'INV-001',
            issue_date: '2025-01-01',
            net_total: 100,
            currency: 'TRL',
            payment_status: 'unpaid',
          },
        },
      };
    }) as any;

    // Mock salesInvoices.list
    client.salesInvoices.list = (async (params: any) => {
      searchedSalesInvoiceParams = params;
      financialSalesInvoiceParams = params;
      return {
        data: [
          {
            id: 'inv-123',
            type: 'sales_invoices',
            attributes: {
              invoice_no: 'INV-001',
              issue_date: '2025-01-01',
              net_total: 100,
              currency: 'TRL',
              payment_status: 'unpaid',
              remaining: 100,
            },
          },
        ],
        meta: {
          total_count: 1,
          total_pages: 1,
          current_page: 1,
        },
      };
    }) as any;

    // Mock purchaseBills.create
    client.purchaseBills.create = (async (payload: any) => {
      createdPurchaseBillPayload = payload;
      return {
        data: {
          id: 'bill-123',
          type: 'purchase_bills',
          attributes: {
            invoice_no: 'BILL-001',
          },
        },
      };
    }) as any;

    // Mock purchaseBills.list
    client.purchaseBills.list = (async () => {
      return {
        data: [
          {
            id: 'bill-123',
            attributes: { remaining: 50 },
          },
        ],
        meta: { total_count: 1 },
      };
    }) as any;

    // Mock accounts.list
    client.accounts.list = (async () => {
      return {
        data: [
          {
            id: 'acc-1',
            attributes: { name: 'Main Bank Account', currency: 'TRL', balance: '500.00' },
          },
        ],
      };
    }) as any;

    // Mock accounts.listTransactions
    client.accounts.listTransactions = (async (accId: any, params: any) => {
      listTransactionsParams = { accId, params };
      return {
        data: [
          {
            id: 'tx-1',
            type: 'transactions',
            attributes: {
              date: '2025-01-01',
              transaction_type: 'initial_account_balance',
              debit_amount: '100.50',
              debit_currency: 'TRL',
              description: 'Initial deposit',
              is_reconciled: true,
            },
          },
        ],
        meta: { total_count: 1, current_page: 1, total_pages: 1 },
      };
    }) as any;
  });

  it('handleCreateInvoice preserves details attributes and relationships', async () => {
    const res = await handleCreateInvoice({
      contact_id: 'contact-1',
      confirm: true,
      currency: 'TRL',
      lines: [
        {
          product_id: 'prod-456',
          description: 'Widget A',
          quantity: 2,
          unit_price: 50,
          vat_rate: 20,
        },
      ],
    });

    assert.equal(res.isError, undefined);
    assert.ok(createdSalesInvoicePayload);

    const detailsData = createdSalesInvoicePayload.data.relationships.details.data;
    assert.equal(detailsData.length, 1);
    assert.equal(detailsData[0].type, 'sales_invoice_details');
    assert.deepEqual(detailsData[0].attributes, {
      quantity: 2,
      unit_price: 50,
      vat_rate: 20,
      description: 'Widget A',
    });
    assert.deepEqual(detailsData[0].relationships, {
      product: {
        data: { id: 'prod-456', type: 'products' },
      },
    });
  });

  it('handleSearchInvoices maps status to payment_status and never sets invoice_status', async () => {
    await handleSearchInvoices({
      status: 'paid',
    });

    assert.ok(searchedSalesInvoiceParams);
    assert.equal(searchedSalesInvoiceParams.filter.payment_status, 'paid');
    assert.equal(searchedSalesInvoiceParams.filter.invoice_status, undefined);

    await handleSearchInvoices({
      status: 'open',
    });
    assert.equal(searchedSalesInvoiceParams.filter.payment_status, 'not_due');
    assert.equal(searchedSalesInvoiceParams.filter.invoice_status, undefined);

    await handleSearchInvoices({
      payment_status: 'overdue',
    });
    assert.equal(searchedSalesInvoiceParams.filter.payment_status, 'overdue');
    assert.equal(searchedSalesInvoiceParams.filter.invoice_status, undefined);
  });

  it('handleCreateBill sends relationships.details.data with purchase_bill_details and attributes', async () => {
    const res = await handleCreateBill({
      supplier_id: 'supplier-99',
      confirm: true,
      lines: [
        {
          description: 'Hosting Expense',
          quantity: 1,
          unit_price: 250,
          vat_rate: 20,
        },
      ],
    });

    assert.equal(res.isError, undefined);
    assert.ok(createdPurchaseBillPayload);

    const detailsData = createdPurchaseBillPayload.data.relationships.details.data;
    assert.ok(Array.isArray(detailsData));
    assert.equal(detailsData.length, 1);
    assert.equal(detailsData[0].type, 'purchase_bill_details');
    assert.deepEqual(detailsData[0].attributes, {
      description: 'Hosting Expense',
      quantity: 1,
      unit_price: 250,
      vat_rate: 20,
    });
  });

  it('handleGetFinancialSummary uses payment_status: not_due and not invoice_status: open', async () => {
    const res = await handleGetFinancialSummary({});

    assert.equal(res.isError, undefined);
    assert.ok(financialSalesInvoiceParams);
    assert.equal(financialSalesInvoiceParams.filter.payment_status, 'not_due');
    assert.equal(financialSalesInvoiceParams.filter.invoice_status, undefined);

    // Verify balances parsed cleanly as numbers, not NaN
    assert.match(res.content[0].text, /"TRL":\s*500/);
    assert.match(res.content[0].text, /"total":\s*100/);
    assert.match(res.content[0].text, /"total":\s*50/);
  });

  it('handleSearchTransactions resolves default account when omitted', async () => {
    const res = await handleSearchTransactions({});

    assert.equal(res.isError, undefined);
    assert.ok(listTransactionsParams);
    assert.equal(listTransactionsParams.accId, 'acc-1');
    assert.equal(listTransactionsParams.params.page.size, 25);

    assert.match(res.content[0].text, /"id":\s*"tx-1"/);
    assert.match(res.content[0].text, /"debit_amount":\s*100\.5/);
  });

  it('handleSearchTransactions uses specified account_id and filters', async () => {
    const res = await handleSearchTransactions({
      account_id: 'acc-999',
      date_start: '2025-01-01',
      limit: 10,
    });

    assert.equal(res.isError, undefined);
    assert.ok(listTransactionsParams);
    assert.equal(listTransactionsParams.accId, 'acc-999');
    assert.equal(listTransactionsParams.params.filter.date, '2025-01-01');
    assert.equal(listTransactionsParams.params.page.size, 10);
  });
});

