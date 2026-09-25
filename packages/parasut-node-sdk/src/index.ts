/**
 * Paraşüt Node.js SDK
 *
 * A type-safe TypeScript SDK for the Paraşüt API v4.
 *
 * @example
 * ```typescript
 * import { ParasutClient } from '@yigitkonur/parasut-node-sdk';
 *
 * const client = new ParasutClient({
 *   companyId: 115,
 *   credentials: {
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret',
 *     username: 'your-username',
 *     password: 'your-password',
 *   },
 * });
 *
 * // List contacts
 * const { data, meta } = await client.contacts.list({
 *   filter: { name: 'Acme' },
 *   page: { number: 1, size: 25 },
 * });
 *
 * // Iterate all pages
 * for await (const contact of client.contacts.iterate()) {
 *   console.log(contact.attributes.name);
 * }
 *
 * // Create a sales invoice
 * const invoice = await client.salesInvoices.create({
 *   data: {
 *     type: 'sales_invoices',
 *     attributes: { ... },
 *   },
 * });
 * ```
 */

// ============================================================================
// Main Client
// ============================================================================

export { ParasutClient, type ParasutClientConfig } from './client/ParasutClient.js';

// ============================================================================
// Authentication
// ============================================================================

export {
  OAuthManager,
  AuthCodeManager,
  MemoryTokenStorage,
  type OAuthCredentials,
  type OAuthOptions,
  type OAuthToken,
  type TokenStorage,
  type AuthCodeConfig,
} from './client/OAuth.js';

// ============================================================================
// Transport
// ============================================================================

export {
  HttpTransport,
  getProxyUrl,
  type RequestConfig,
  type TransportConfig,
  type RequestInterceptor,
  type ResponseInterceptor,
  type ErrorInterceptor,
} from './client/HttpTransport.js';

// ============================================================================
// Errors
// ============================================================================

export {
  ParasutError,
  ParasutApiError,
  ParasutAuthError,
  ParasutForbiddenError,
  ParasutNotFoundError,
  ParasutValidationError,
  ParasutRateLimitError,
  ParasutNetworkError,
  ParasutTimeoutError,
  ParasutConfigError,
  type ApiErrorDetail,
} from './client/errors.js';

// ============================================================================
// Configuration Types
// ============================================================================

export { type RateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG } from './client/RateLimiter.js';
export { type RetryConfig, DEFAULT_RETRY_CONFIG } from './client/RetryHandler.js';

// ============================================================================
// Query Building
// ============================================================================

export {
  QueryBuilder,
  buildListQuery,
  type ListQueryParams,
  type PageParams,
} from './client/QueryBuilder.js';

// ============================================================================
// JSON:API Helpers
// ============================================================================

export {
  buildResource,
  buildUpdateResource,
  rel,
  relMany,
  relNull,
  extractData,
  extractListData,
  findIncluded,
  findAllIncluded,
  getRelated,
  type ResourceIdentifier,
  type CreateResourceInput,
  type UpdateResourceInput,
  type RelationshipInput,
} from './client/JsonApi.js';

// ============================================================================
// Resources
// ============================================================================

export {
  // Base
  BaseResource,
  type ResourceConfig,
  type PaginatedResponse,
  type IterateOptions,
  // Trackable Jobs
  TrackableJobsResource,
  TrackableJobError,
  TrackableJobTimeoutError,
  type PollOptions,
  // Core resources
  AccountsResource,
  type Account,
  type AccountAttributes,
  type AccountFilters,
  ContactsResource,
  type Contact,
  type ContactAttributes,
  type ContactFilters,
  ProductsResource,
  type Product,
  type ProductAttributes,
  type ProductFilters,
  // Sales
  SalesInvoicesResource,
  type SalesInvoice,
  type SalesInvoiceAttributes,
  type SalesInvoiceFilters,
  SalesOffersResource,
  type SalesOffer,
  type SalesOfferAttributes,
  type SalesOfferFilters,
  // Purchases
  PurchaseBillsResource,
  type PurchaseBill,
  type PurchaseBillAttributes,
  type PurchaseBillFilters,
  // E-Documents
  EArchivesResource,
  type EArchive,
  type EArchiveAttributes,
  type EArchiveFilters,
  EInvoicesResource,
  type EInvoice,
  type EInvoiceAttributes,
  type EInvoiceFilters,
  EInvoiceInboxesResource,
  type EInvoiceInbox,
  type EInvoiceInboxAttributes,
  type EInvoiceInboxFilters,
  ESmmsResource,
  type ESmm,
  type ESmmAttributes,
  type ESmmFilters,
  // Expenses
  BankFeesResource,
  type BankFee,
  type BankFeeAttributes,
  type BankFeeFilters,
  SalariesResource,
  type Salary,
  type SalaryAttributes,
  type SalaryFilters,
  TaxesResource,
  type Tax,
  type TaxAttributes,
  type TaxFilters,
  // HR
  EmployeesResource,
  type Employee,
  type EmployeeAttributes,
  type EmployeeFilters,
  // Inventory
  InventoryLevelsResource,
  type InventoryLevel,
  type InventoryLevelAttributes,
  type InventoryLevelFilters,
  StockMovementsResource,
  type StockMovement,
  type StockMovementAttributes,
  type StockMovementFilters,
  ShipmentDocumentsResource,
  type ShipmentDocument,
  type ShipmentDocumentAttributes,
  type ShipmentDocumentFilters,
  // Settings
  TagsResource,
  type Tag,
  type TagAttributes,
  type TagFilters,
  ItemCategoriesResource,
  type ItemCategory,
  type ItemCategoryAttributes,
  type ItemCategoryFilters,
  // Financial
  TransactionsResource,
  type Transaction,
  type TransactionAttributes,
  type TransactionFilters,
} from './resources/index.js';

// ============================================================================
// Generated Types (re-export commonly used types)
// ============================================================================

export type {
  JsonApiResource,
  JsonApiResponse,
  JsonApiListResponse,
  ListMeta,
  Relationship,
  RelationshipMany,
} from './generated/types.js';
