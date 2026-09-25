/**
 * Sales Invoices Resource (Satış Faturası)
 *
 * Manage sales invoices with support for archive, cancel, and payments.
 */
import { BaseResource } from './BaseResource.js';
// ============================================================================
// Resource
// ============================================================================
export class SalesInvoicesResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/sales_invoices',
            resourceType: 'sales_invoices',
        });
    }
    /**
     * Archives a sales invoice.
     */
    async archive(id) {
        return this.transport.patch(this.buildPath(id, '/archive'));
    }
    /**
     * Unarchives a sales invoice.
     */
    async unarchive(id) {
        return this.transport.patch(this.buildPath(id, '/unarchive'));
    }
    /**
     * Cancels a sales invoice.
     */
    async cancel(id) {
        return this.transport.delete(this.buildPath(id, '/cancel'));
    }
    /**
     * Recovers a cancelled sales invoice.
     */
    async recover(id) {
        return this.transport.patch(this.buildPath(id, '/recover'));
    }
    /**
     * Adds a payment to a sales invoice.
     *
     * @example
     * ```typescript
     * await client.salesInvoices.pay(invoiceId, {
     *   data: {
     *     type: 'payments',
     *     attributes: {
     *       date: '2024-01-15',
     *       amount: 1000.00,
     *       notes: 'Payment received'
     *     },
     *     relationships: {
     *       account: { data: { id: '123', type: 'accounts' } }
     *     }
     *   }
     * });
     * ```
     */
    async pay(id, payload) {
        return this.transport.post(this.buildPath(id, '/payments'), payload);
    }
    /**
     * Lists overdue invoices.
     */
    async listOverdue() {
        return this.list({ filter: { payment_status: 'overdue' } });
    }
    /**
     * Lists unpaid invoices.
     */
    async listUnpaid() {
        return this.list({ filter: { payment_status: 'unpaid' } });
    }
    /**
     * Lists invoices for a specific contact.
     */
    async listByContact(contactId) {
        return this.list({ filter: { contact_id: contactId } });
    }
}
//# sourceMappingURL=salesInvoices.js.map