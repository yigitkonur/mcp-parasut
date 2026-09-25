/**
 * Paraşüt Client
 *
 * Main entry point for the Paraşüt SDK.
 * Provides a resource tree for accessing all API endpoints.
 */
import { OAuthManager, type OAuthCredentials, type TokenStorage } from './OAuth.js';
import { RateLimiter, type RateLimitConfig } from './RateLimiter.js';
import { RetryHandler, type RetryConfig } from './RetryHandler.js';
import { TrackableJobsResource } from '../resources/trackableJobs.js';
import { AccountsResource } from '../resources/accounts.js';
import { ContactsResource } from '../resources/contacts.js';
import { ProductsResource } from '../resources/products.js';
import { SalesInvoicesResource } from '../resources/salesInvoices.js';
import { SalesOffersResource } from '../resources/salesOffers.js';
import { PurchaseBillsResource } from '../resources/purchaseBills.js';
import { EArchivesResource } from '../resources/eArchives.js';
import { EInvoicesResource } from '../resources/eInvoices.js';
import { EInvoiceInboxesResource } from '../resources/eInvoiceInboxes.js';
import { ESmmsResource } from '../resources/eSmms.js';
import { BankFeesResource } from '../resources/bankFees.js';
import { SalariesResource } from '../resources/salaries.js';
import { TaxesResource } from '../resources/taxes.js';
import { EmployeesResource } from '../resources/employees.js';
import { InventoryLevelsResource } from '../resources/inventoryLevels.js';
import { StockMovementsResource } from '../resources/stockMovements.js';
import { ShipmentDocumentsResource } from '../resources/shipmentDocuments.js';
import { TagsResource } from '../resources/tags.js';
import { ItemCategoriesResource } from '../resources/itemCategories.js';
import { TransactionsResource } from '../resources/transactions.js';
export interface ParasutClientConfig {
    /**
     * Company ID (Firma ID) to use for API requests.
     * Optional initially; can be resolved via getMe() or resolveCompanyId().
     */
    companyId?: number | undefined;
    /**
     * OAuth credentials for authentication.
     * Required unless accessToken or refreshToken is provided.
     */
    credentials?: OAuthCredentials | undefined;
    /**
     * Static access token or initial access token.
     * Use this for testing, when you manage tokens yourself, or with refreshToken.
     */
    accessToken?: string | undefined;
    /**
     * Refresh token for OAuth2 token refresh.
     * When provided along with credentials (clientId & clientSecret),
     * OAuthManager will automatically refresh expired tokens.
     */
    refreshToken?: string | undefined;
    /**
     * Base URL for the API.
     * @default 'https://api.parasut.com/v4'
     */
    baseUrl?: string | undefined;
    /**
     * Request timeout in milliseconds.
     * @default 30000
     */
    timeout?: number | undefined;
    /**
     * Custom token storage for persisting OAuth tokens.
     * Defaults to in-memory storage.
     */
    tokenStorage?: TokenStorage | undefined;
    /**
     * Rate limiting configuration.
     */
    rateLimit?: Partial<RateLimitConfig> | undefined;
    /**
     * Retry configuration.
     */
    retry?: Partial<RetryConfig> | undefined;
    /**
     * Custom fetch function (e.g. for proxy support, mocking, or environment polyfills).
     */
    fetch?: typeof fetch | undefined;
    /**
     * Custom fetch options merged into every request (e.g. dispatcher, agent).
     */
    fetchOptions?: (RequestInit & Record<string, any>) | undefined;
}
export declare class ParasutClient {
    private readonly transport;
    /**
     * Rate limiter instance (exposed for advanced use cases).
     */
    readonly rateLimiter: RateLimiter;
    /**
     * Retry handler instance (exposed for advanced use cases).
     */
    readonly retryHandler: RetryHandler;
    private readonly oauth?;
    private readonly staticToken?;
    private _companyId?;
    private _trackableJobs?;
    private _accounts?;
    private _contacts?;
    private _products?;
    private _salesInvoices?;
    private _salesOffers?;
    private _purchaseBills?;
    private _eArchives?;
    private _eInvoices?;
    private _eInvoiceInboxes?;
    private _eSmms?;
    private _bankFees?;
    private _salaries?;
    private _taxes?;
    private _employees?;
    private _inventoryLevels?;
    private _stockMovements?;
    private _shipmentDocuments?;
    private _tags?;
    private _itemCategories?;
    private _transactions?;
    constructor(config: ParasutClientConfig);
    /**
     * Current company ID if set.
     */
    get companyId(): number | undefined;
    set companyId(value: number | undefined);
    /**
     * OAuthManager instance if configured.
     */
    get oauthManager(): OAuthManager | undefined;
    /**
     * Gets a valid access token.
     */
    private getToken;
    /**
     * Returns the company ID if set, or throws a ParasutConfigError if not.
     */
    getCompanyId(): number;
    /**
     * Queries the `/me` endpoint with user roles, companies, and profile included.
     * If companyId was not provided (or is 0), automatically discovers and sets
     * this.companyId to the first available company ID.
     */
    getMe(): Promise<any>;
    /**
     * Resolves the company ID, discovering it via getMe() if not already set.
     */
    resolveCompanyId(): Promise<number>;
    /**
     * Resets cached resource instances when companyId changes.
     */
    private resetResources;
    /**
     * Creates a resource config.
     */
    private getResourceConfig;
    /**
     * Trackable Jobs - for monitoring async operations.
     */
    get trackableJobs(): TrackableJobsResource;
    /**
     * Accounts - cash and bank accounts.
     */
    get accounts(): AccountsResource;
    /**
     * Contacts - customers and suppliers.
     */
    get contacts(): ContactsResource;
    /**
     * Products - goods and services.
     */
    get products(): ProductsResource;
    /**
     * Sales Invoices - manage sales invoices.
     */
    get salesInvoices(): SalesInvoicesResource;
    /**
     * Sales Offers - quotes and proposals.
     */
    get salesOffers(): SalesOffersResource;
    /**
     * Purchase Bills - expenses and supplier invoices.
     */
    get purchaseBills(): PurchaseBillsResource;
    /**
     * E-Archives - e-archive documents.
     */
    get eArchives(): EArchivesResource;
    /**
     * E-Invoices - e-invoice documents.
     */
    get eInvoices(): EInvoicesResource;
    /**
     * E-Invoice Inboxes - check if contacts are e-invoice users.
     */
    get eInvoiceInboxes(): EInvoiceInboxesResource;
    /**
     * E-SMMs - freelancer receipts.
     */
    get eSmms(): ESmmsResource;
    /**
     * Bank Fees - bank charges.
     */
    get bankFees(): BankFeesResource;
    /**
     * Salaries - employee salaries.
     */
    get salaries(): SalariesResource;
    /**
     * Taxes - tax records.
     */
    get taxes(): TaxesResource;
    /**
     * Employees - employee records.
     */
    get employees(): EmployeesResource;
    /**
     * Inventory Levels - stock levels per warehouse.
     */
    get inventoryLevels(): InventoryLevelsResource;
    /**
     * Stock Movements - stock movement history.
     */
    get stockMovements(): StockMovementsResource;
    /**
     * Shipment Documents - delivery notes.
     */
    get shipmentDocuments(): ShipmentDocumentsResource;
    /**
     * Tags - labels for organizing resources.
     */
    get tags(): TagsResource;
    /**
     * Item Categories - categories for products and expenses.
     */
    get itemCategories(): ItemCategoriesResource;
    /**
     * Transactions - financial transactions.
     */
    get transactions(): TransactionsResource;
}
//# sourceMappingURL=ParasutClient.d.ts.map