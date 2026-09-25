/**
 * Accounts Resource (Kasa ve Banka)
 *
 * Manage cash and bank accounts.
 */
import { BaseResource } from './BaseResource.js';
// ============================================================================
// Resource
// ============================================================================
export class AccountsResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/accounts',
            resourceType: 'accounts',
        });
    }
    /**
     * Creates a debit transaction (withdrawal) on the account.
     */
    async debit(accountId, payload) {
        return this.transport.post(this.buildPath(accountId, '/debit_transactions'), payload);
    }
    /**
     * Creates a credit transaction (deposit) on the account.
     */
    async credit(accountId, payload) {
        return this.transport.post(this.buildPath(accountId, '/credit_transactions'), payload);
    }
    /**
     * Lists cash accounts.
     */
    async listCashAccounts() {
        return this.list({ filter: { account_type: 'cash' } });
    }
    /**
     * Lists bank accounts.
     */
    async listBankAccounts() {
        return this.list({ filter: { account_type: 'bank' } });
    }
    /**
     * Lists transactions for a specific account.
     */
    async listTransactions(accountId, options) {
        const path = this.buildPath(accountId, '/transactions');
        const query = {};
        if (options?.filter?.date)
            query['filter[date]'] = options.filter.date;
        if (options?.sort)
            query['sort'] = options.sort;
        if (options?.page?.number)
            query['page[number]'] = options.page.number;
        if (options?.page?.size)
            query['page[size]'] = Math.min(options.page.size, 25);
        return this.transport.get(path, query);
    }
}
//# sourceMappingURL=accounts.js.map