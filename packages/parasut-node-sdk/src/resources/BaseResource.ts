/**
 * Base Resource
 *
 * Abstract base class for all API resources.
 * Provides common CRUD operations and pagination helpers.
 */

import type { HttpTransport } from '../client/HttpTransport.js';
import type {
  ListQueryParams,
  ShowQueryParams,
} from '../client/QueryBuilder.js';
import { buildListQuery, buildShowQuery } from '../client/QueryBuilder.js';
import type {
  JsonApiResource,
  JsonApiResponse,
  JsonApiListResponse,
  ListMeta,
} from '../generated/types.js';

// ============================================================================
// Types
// ============================================================================

export interface ResourceConfig {
  transport: HttpTransport;
  companyId: number;
  basePath: string;
  resourceType: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: ListMeta;
  included?: JsonApiResource[];
}

export interface IterateOptions {
  pageSize?: number;
  maxPages?: number;
}

// ============================================================================
// Base Resource
// ============================================================================

export abstract class BaseResource<
  TResource extends JsonApiResource = JsonApiResource,
  TAttributes = object,
  TFilters extends object = object
> {
  protected readonly transport: HttpTransport;
  protected readonly companyId: number;
  protected readonly basePath: string;
  protected readonly resourceType: string;

  constructor(config: ResourceConfig) {
    this.transport = config.transport;
    this.companyId = config.companyId;
    this.basePath = config.basePath;
    this.resourceType = config.resourceType;
  }

  /**
   * Builds the full path for a resource.
   */
  protected buildPath(id?: string | number, suffix?: string): string {
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
  async list(
    params: ListQueryParams<TFilters> = {}
  ): Promise<PaginatedResponse<TResource>> {
    const query = buildListQuery(params);
    const response = await this.transport.get<JsonApiListResponse<TResource>>(
      this.buildPath(),
      query
    );

    return {
      data: response.data,
      meta: response.meta,
      ...(response.included !== undefined && { included: response.included }),
    };
  }

  /**
   * Gets a single resource by ID.
   */
  async get(
    id: string | number,
    params: ShowQueryParams = {}
  ): Promise<JsonApiResponse<TResource>> {
    const query = buildShowQuery(params);
    return this.transport.get<JsonApiResponse<TResource>>(
      this.buildPath(id),
      query
    );
  }

  /**
   * Creates a new resource.
   */
  async create(
    payload: { data: { type: string; attributes: TAttributes; relationships?: Record<string, unknown> } }
  ): Promise<JsonApiResponse<TResource>> {
    return this.transport.post<JsonApiResponse<TResource>>(
      this.buildPath(),
      payload
    );
  }

  /**
   * Updates an existing resource.
   */
  async update(
    id: string | number,
    payload: { data: { id: string; type: string; attributes?: Partial<TAttributes>; relationships?: Record<string, unknown> } }
  ): Promise<JsonApiResponse<TResource>> {
    return this.transport.put<JsonApiResponse<TResource>>(
      this.buildPath(id),
      payload
    );
  }

  /**
   * Deletes a resource.
   */
  async delete(id: string | number): Promise<void> {
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
  async *iterate(
    params: ListQueryParams<TFilters> & IterateOptions = {}
  ): AsyncGenerator<TResource, void, undefined> {
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
  async listAll(
    params: ListQueryParams<TFilters> & IterateOptions = {}
  ): Promise<TResource[]> {
    const results: TResource[] = [];

    for await (const item of this.iterate(params)) {
      results.push(item);
    }

    return results;
  }

  /**
   * Counts resources matching the query.
   * Makes a single request to get the total_count from meta.
   */
  async count(params: Omit<ListQueryParams<TFilters>, 'page'> = {}): Promise<number> {
    const response = await this.list({
      ...params,
      page: { number: 1, size: 1 }, // Minimize data transfer
    });
    return response.meta.total_count;
  }

  /**
   * Checks if any resources exist matching the query.
   */
  async exists(params: Omit<ListQueryParams<TFilters>, 'page'> = {}): Promise<boolean> {
    const count = await this.count(params);
    return count > 0;
  }

  /**
   * Gets the first resource matching the query.
   */
  async first(
    params: Omit<ListQueryParams<TFilters>, 'page'> = {}
  ): Promise<TResource | null> {
    const response = await this.list({
      ...params,
      page: { number: 1, size: 1 },
    });
    return response.data[0] ?? null;
  }
}

// ============================================================================
// Mixins for special actions
// ============================================================================

/**
 * Mixin for resources that support archive/unarchive.
 */
export interface Archivable<T> {
  archive(id: string | number): Promise<JsonApiResponse<T>>;
  unarchive(id: string | number): Promise<JsonApiResponse<T>>;
}

/**
 * Mixin for resources that support cancel/recover.
 */
export interface Cancellable<T> {
  cancel(id: string | number): Promise<JsonApiResponse<T>>;
  recover(id: string | number): Promise<JsonApiResponse<T>>;
}

/**
 * Mixin for resources that support payments.
 */
export interface Payable<T> {
  pay(
    id: string | number,
    payload: { data: { type: string; attributes: Record<string, unknown> } }
  ): Promise<JsonApiResponse<T>>;
}

/**
 * Mixin for resources that have PDF endpoints.
 */
export interface HasPdf {
  pdf(
    id: string | number,
    options?: { pollInterval?: number; timeout?: number }
  ): Promise<{ url: string; expiresAt: Date }>;
}

// Note: Resources implement Archivable, Cancellable, Payable, and HasPdf directly
// rather than using mixin functions, for better type inference and clarity.
