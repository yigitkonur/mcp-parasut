/**
 * Base Resource
 *
 * Abstract base class for all API resources.
 * Provides common CRUD operations and pagination helpers.
 */
import { buildListQuery, buildShowQuery } from '../client/QueryBuilder.js';
// ============================================================================
// Base Resource
// ============================================================================
export class BaseResource {
    transport;
    companyId;
    basePath;
    resourceType;
    constructor(config) {
        this.transport = config.transport;
        this.companyId = config.companyId;
        this.basePath = config.basePath;
        this.resourceType = config.resourceType;
    }
    /**
     * Builds the full path for a resource.
     */
    buildPath(id, suffix) {
        let path = `/${this.companyId}${this.basePath}`;
        if (id !== undefined) {
            path += `/${id}`;
        }
        if (suffix) {
            path += suffix;
        }
        return path;
    }
    /**
     * Lists resources with pagination and filtering.
     */
    async list(params = {}) {
        const query = buildListQuery(params);
        const response = await this.transport.get(this.buildPath(), query);
        return {
            data: response.data,
            meta: response.meta,
            ...(response.included !== undefined && { included: response.included }),
        };
    }
    /**
     * Gets a single resource by ID.
     */
    async get(id, params = {}) {
        const query = buildShowQuery(params);
        return this.transport.get(this.buildPath(id), query);
    }
    /**
     * Creates a new resource.
     */
    async create(payload) {
        return this.transport.post(this.buildPath(), payload);
    }
    /**
     * Updates an existing resource.
     */
    async update(id, payload) {
        return this.transport.put(this.buildPath(id), payload);
    }
    /**
     * Deletes a resource.
     */
    async delete(id) {
        await this.transport.delete(this.buildPath(id));
    }
    /**
     * Async iterator for paginating through all resources.
     * Yields individual resources one at a time.
     *
     * @example
     * ```typescript
     * for await (const contact of client.contacts.iterate({ pageSize: 25 })) {
     *   console.log(contact.attributes.name);
     * }
     * ```
     */
    async *iterate(params = {}) {
        const { pageSize = 25, maxPages, ...queryParams } = params;
        let currentPage = 1;
        let totalPages = 1;
        while (currentPage <= totalPages && (!maxPages || currentPage <= maxPages)) {
            const response = await this.list({
                ...queryParams,
                page: { number: currentPage, size: pageSize },
            });
            for (const item of response.data) {
                yield item;
            }
            totalPages = response.meta.total_pages;
            currentPage++;
        }
    }
    /**
     * Fetches all resources matching the query.
     * Use with caution for large datasets.
     *
     * @example
     * ```typescript
     * const allContacts = await client.contacts.listAll({
     *   filter: { account_type: 'customer' }
     * });
     * ```
     */
    async listAll(params = {}) {
        const results = [];
        for await (const item of this.iterate(params)) {
            results.push(item);
        }
        return results;
    }
    /**
     * Counts resources matching the query.
     * Makes a single request to get the total_count from meta.
     */
    async count(params = {}) {
        const response = await this.list({
            ...params,
            page: { number: 1, size: 1 }, // Minimize data transfer
        });
        return response.meta.total_count;
    }
    /**
     * Checks if any resources exist matching the query.
     */
    async exists(params = {}) {
        const count = await this.count(params);
        return count > 0;
    }
    /**
     * Gets the first resource matching the query.
     */
    async first(params = {}) {
        const response = await this.list({
            ...params,
            page: { number: 1, size: 1 },
        });
        return response.data[0] ?? null;
    }
}
// Note: Resources implement Archivable, Cancellable, Payable, and HasPdf directly
// rather than using mixin functions, for better type inference and clarity.
//# sourceMappingURL=BaseResource.js.map