/**
 * E-Archives Resource (E-Arşiv)
 *
 * Manage e-archive documents with PDF generation.
 */
import { BaseResource } from './BaseResource.js';
// ============================================================================
// Resource
// ============================================================================
export class EArchivesResource extends BaseResource {
    trackableJobs;
    constructor(config, trackableJobs) {
        super({
            ...config,
            basePath: '/e_archives',
            resourceType: 'e_archives',
        });
        this.trackableJobs = trackableJobs;
    }
    /**
     * Creates an e-archive document.
     * Returns a trackable job ID that must be polled for completion.
     *
     * @example
     * ```typescript
     * const result = await client.eArchives.create({
     *   data: {
     *     type: 'e_archives',
     *     relationships: {
     *       sales_invoice: { data: { id: '123', type: 'sales_invoices' } }
     *     }
     *   }
     * });
     *
     * // Poll for completion
     * const job = await client.trackableJobs.poll(result.trackableJobId);
     * ```
     */
    async submit(payload) {
        const response = await this.transport.post(this.buildPath(), payload);
        return {
            data: response.data,
            trackableJobId: response.data.id,
        };
    }
    /**
     * Creates an e-archive and waits for completion.
     */
    async submitAndWait(payload, options) {
        const createResult = await this.submit(payload);
        await this.trackableJobs.poll(createResult.trackableJobId, options);
        // Get the created e-archive from the sales invoice active_e_document
        const invoiceId = payload.data.relationships?.sales_invoice?.data.id;
        if (invoiceId) {
            const invResponse = await this.transport.get(`/${this.companyId}/sales_invoices/${invoiceId}?include=active_e_document`);
            const includedDoc = invResponse.included?.find((item) => item.type === 'e_archives');
            if (includedDoc) {
                return { data: includedDoc };
            }
            const activeDoc = invResponse.data?.relationships?.active_e_document?.data;
            if (activeDoc?.id) {
                return this.get(activeDoc.id);
            }
        }
        throw new Error('E-archive created but active_e_document could not be retrieved from the sales invoice');
    }
    /**
     * Gets the PDF URL for an e-archive.
     * The PDF may not be immediately available after creation.
     * Returns 204 No Content if not ready yet.
     *
     * @example
     * ```typescript
     * const { url } = await client.eArchives.pdf(eArchiveId);
     * // Download the PDF from url before it expires
     * ```
     */
    async pdf(id, options = {}) {
        const { pollInterval = 2000, timeout = 60000 } = options;
        const startTime = Date.now();
        while (true) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`PDF not ready after ${timeout}ms`);
            }
            const response = await this.transport.get(this.buildPath(id, '/pdf'));
            // 204 No Content means PDF not ready yet
            if (response.noContent || response.status === 204) {
                await this.sleep(pollInterval);
                continue;
            }
            // PDF is ready
            const url = response.data?.attributes?.url;
            if (url) {
                return {
                    url,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
                };
            }
            await this.sleep(pollInterval);
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=eArchives.js.map