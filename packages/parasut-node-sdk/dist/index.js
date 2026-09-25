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
export { ParasutClient } from './client/ParasutClient.js';
// ============================================================================
// Authentication
// ============================================================================
export { OAuthManager, AuthCodeManager, MemoryTokenStorage, } from './client/OAuth.js';
// ============================================================================
// Transport
// ============================================================================
export { HttpTransport, getProxyUrl, } from './client/HttpTransport.js';
// ============================================================================
// Errors
// ============================================================================
export { ParasutError, ParasutApiError, ParasutAuthError, ParasutForbiddenError, ParasutNotFoundError, ParasutValidationError, ParasutRateLimitError, ParasutNetworkError, ParasutTimeoutError, ParasutConfigError, } from './client/errors.js';
// ============================================================================
// Configuration Types
// ============================================================================
export { DEFAULT_RATE_LIMIT_CONFIG } from './client/RateLimiter.js';
export { DEFAULT_RETRY_CONFIG } from './client/RetryHandler.js';
// ============================================================================
// Query Building
// ============================================================================
export { QueryBuilder, buildListQuery, } from './client/QueryBuilder.js';
// ============================================================================
// JSON:API Helpers
// ============================================================================
export { buildResource, buildUpdateResource, rel, relMany, relNull, extractData, extractListData, findIncluded, findAllIncluded, getRelated, } from './client/JsonApi.js';
// ============================================================================
// Resources
// ============================================================================
export { 
// Base
BaseResource, 
// Trackable Jobs
TrackableJobsResource, TrackableJobError, TrackableJobTimeoutError, 
// Core resources
AccountsResource, ContactsResource, ProductsResource, 
// Sales
SalesInvoicesResource, SalesOffersResource, 
// Purchases
PurchaseBillsResource, 
// E-Documents
EArchivesResource, EInvoicesResource, EInvoiceInboxesResource, ESmmsResource, 
// Expenses
BankFeesResource, SalariesResource, TaxesResource, 
// HR
EmployeesResource, 
// Inventory
InventoryLevelsResource, StockMovementsResource, ShipmentDocumentsResource, 
// Settings
TagsResource, ItemCategoriesResource, 
// Financial
TransactionsResource, } from './resources/index.js';
//# sourceMappingURL=index.js.map