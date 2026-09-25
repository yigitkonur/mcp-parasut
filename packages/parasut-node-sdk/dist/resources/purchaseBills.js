/**
 * Purchase Bills Resource (Fiş / Fatura)
 *
 * Manage purchase bills and expenses with support for archive, cancel, and payments.
 */
import { BaseResource } from './BaseResource.js';
// ============================================================================
// Resource
// ============================================================================
export class PurchaseBillsResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/purchase_bills',
            resourceType: 'purchase_bills',
        });
    }
    /**
     * Archives a purchase bill.
     */
    async archive(id) {
        return this.transport.patch(this.buildPath(id, '/archive'));
    }
    /**
     * Unarchives a purchase bill.
     */
    async unarchive(id) {
        return this.transport.patch(this.buildPath(id, '/unarchive'));
    }
    /**
     * Cancels a purchase bill.
     */
    async cancel(id) {
        return this.transport.delete(this.buildPath(id, '/cancel'));
    }
    /**
     * Recovers a cancelled purchase bill.
     */
    async recover(id) {
        return this.transport.patch(this.buildPath(id, '/recover'));
    }
    /**
     * Adds a payment to a purchase bill.
     */
    async pay(id, payload) {
        return this.transport.post(this.buildPath(id, '/payments'), payload);
    }
    /**
     * Lists overdue bills.
     */
    async listOverdue() {
        return this.list({ filter: { payment_status: 'overdue' } });
    }
    /**
     * Lists unpaid bills.
     */
    async listUnpaid() {
        return this.list({ filter: { payment_status: 'unpaid' } });
    }
    /**
     * Lists bills for a specific supplier.
     */
    async listBySupplier(contactId) {
        return this.list({ filter: { contact_id: contactId } });
    }
}
//# sourceMappingURL=purchaseBills.js.map