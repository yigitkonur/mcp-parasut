/**
 * Transactions Resource (İşlem)
 *
 * Manage financial transactions.
 */
import { BaseResource } from './BaseResource.js';
export class TransactionsResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/transactions',
            resourceType: 'transactions',
        });
    }
    /**
     * Lists transactions for a specific account.
     * Note: Paraşüt API does not support global /transactions listing; transactions are scoped to accounts.
     */
    async listForAccount(accountId, options) {
        const path = `/${this.companyId}/accounts/${accountId}/transactions`;
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
//# sourceMappingURL=transactions.js.map