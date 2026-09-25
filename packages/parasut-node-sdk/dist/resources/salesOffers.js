/**
 * Sales Offers Resource (Teklif)
 *
 * Manage sales offers/quotes with conversion to invoice.
 */
import { BaseResource } from './BaseResource.js';
// ============================================================================
// Resource
// ============================================================================
export class SalesOffersResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/sales_offers',
            resourceType: 'sales_offers',
        });
    }
    /**
     * Archives a sales offer.
     */
    async archive(id) {
        return this.transport.patch(this.buildPath(id, '/archive'));
    }
    /**
     * Unarchives a sales offer.
     */
    async unarchive(id) {
        return this.transport.patch(this.buildPath(id, '/unarchive'));
    }
    /**
     * Gets the PDF URL for a sales offer.
     */
    async pdf(id, options = {}) {
        const { pollInterval = 2000, timeout = 60000 } = options;
        const startTime = Date.now();
        while (true) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`PDF not ready after ${timeout}ms`);
            }
            const response = await this.transport.get(this.buildPath(id, '/pdf'));
            if (response.noContent || response.status === 204) {
                await this.sleep(pollInterval);
                continue;
            }
            const url = response.data?.attributes?.url;
            if (url) {
                return {
                    url,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                };
            }
            await this.sleep(pollInterval);
        }
    }
    /**
     * Converts a sales offer to a sales invoice.
     * Returns the newly created invoice.
     */
    async convertToInvoice(id, invoiceData) {
        return this.transport.post(this.buildPath(id, '/convert_to_invoice'), invoiceData ? { data: { attributes: invoiceData } } : undefined);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=salesOffers.js.map