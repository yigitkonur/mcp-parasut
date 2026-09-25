/**
 * Paraşüt Client
 *
 * Main entry point for the Paraşüt SDK.
 * Provides a resource tree for accessing all API endpoints.
 */

import { HttpTransport, type TransportConfig } from './HttpTransport.js';
import { OAuthManager, type OAuthCredentials, type OAuthOptions, type TokenStorage } from './OAuth.js';
import { RateLimiter, type RateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG } from './RateLimiter.js';
import { RetryHandler, type RetryConfig, DEFAULT_RETRY_CONFIG } from './RetryHandler.js';
import { ParasutConfigError, ParasutAuthError } from './errors.js';

// Resources
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

// ============================================================================
// Configuration
// ============================================================================

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

// ============================================================================
// Client
// ============================================================================

export class ParasutClient {
  private readonly transport: HttpTransport;
  /**
   * Rate limiter instance (exposed for advanced use cases).
   */
  readonly rateLimiter: RateLimiter;
  /**
   * Retry handler instance (exposed for advanced use cases).
   */
  readonly retryHandler: RetryHandler;
  private readonly oauth?: OAuthManager | undefined;
  private readonly staticToken?: string | undefined;
  private _companyId?: number | undefined;

  // Resources (lazy-initialized)
  private _trackableJobs?: TrackableJobsResource | undefined;
  private _accounts?: AccountsResource | undefined;
  private _contacts?: ContactsResource | undefined;
  private _products?: ProductsResource | undefined;
  private _salesInvoices?: SalesInvoicesResource | undefined;
  private _salesOffers?: SalesOffersResource | undefined;
  private _purchaseBills?: PurchaseBillsResource | undefined;
  private _eArchives?: EArchivesResource | undefined;
  private _eInvoices?: EInvoicesResource | undefined;
  private _eInvoiceInboxes?: EInvoiceInboxesResource | undefined;
  private _eSmms?: ESmmsResource | undefined;
  private _bankFees?: BankFeesResource | undefined;
  private _salaries?: SalariesResource | undefined;
  private _taxes?: TaxesResource | undefined;
  private _employees?: EmployeesResource | undefined;
  private _inventoryLevels?: InventoryLevelsResource | undefined;
  private _stockMovements?: StockMovementsResource | undefined;
  private _shipmentDocuments?: ShipmentDocumentsResource | undefined;
  private _tags?: TagsResource | undefined;
  private _itemCategories?: ItemCategoriesResource | undefined;
  private _transactions?: TransactionsResource | undefined;

  constructor(config: ParasutClientConfig) {
    this._companyId = config.companyId;

    const refreshToken = config.refreshToken ?? config.credentials?.refreshToken;
    const clientId = config.credentials?.clientId;
    const clientSecret = config.credentials?.clientSecret;

    const oauthOptions: OAuthOptions = {
      ...(config.accessToken !== undefined && { accessToken: config.accessToken }),
      ...(refreshToken !== undefined && { refreshToken }),
      ...(config.tokenStorage !== undefined && { storage: config.tokenStorage }),
      ...(config.fetch !== undefined && { fetch: config.fetch }),
      ...(config.fetchOptions !== undefined && { fetchOptions: config.fetchOptions }),
    };

    // Set up authentication
    if (clientId && clientSecret && (config.credentials?.username || refreshToken)) {
      this.oauth = new OAuthManager(
        {
          ...config.credentials,
          clientId,
          clientSecret,
          ...(refreshToken !== undefined && { refreshToken }),
        },
        oauthOptions
      );
    } else if (config.accessToken !== undefined) {
      this.staticToken = config.accessToken;
    } else if (config.credentials) {
      // Delegating incomplete credentials to OAuthManager will throw appropriate ParasutConfigError
      this.oauth = new OAuthManager(config.credentials, oauthOptions);
    } else {
      throw new ParasutConfigError(
        'Either credentials, refreshToken (with clientId/clientSecret), or accessToken is required'
      );
    }

    // Set up rate limiter
    this.rateLimiter = new RateLimiter({
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...config.rateLimit,
    });

    // Set up retry handler
    this.retryHandler = new RetryHandler({
      ...DEFAULT_RETRY_CONFIG,
      ...config.retry,
    });

    // Set up transport
    const transportConfig: TransportConfig = {
      baseUrl: config.baseUrl ?? 'https://api.parasut.com/v4',
      timeout: config.timeout ?? 30_000,
      ...(config.fetch !== undefined && { fetch: config.fetch }),
      ...(config.fetchOptions !== undefined && { fetchOptions: config.fetchOptions }),
    };

    this.transport = new HttpTransport(transportConfig);

    // Add auth interceptor
    this.transport.addRequestInterceptor(async (requestConfig) => {
      const token = await this.getToken();
      return {
        ...requestConfig,
        headers: {
          ...requestConfig.headers,
          Authorization: `Bearer ${token}`,
        },
      };
    });
  }

  /**
   * Current company ID if set.
   */
  get companyId(): number | undefined {
    return this._companyId;
  }

  set companyId(value: number | undefined) {
    this._companyId = value;
    this.resetResources();
  }

  /**
   * OAuthManager instance if configured.
   */
  get oauthManager(): OAuthManager | undefined {
    return this.oauth;
  }

  /**
   * Gets a valid access token.
   */
  private async getToken(): Promise<string> {
    if (this.staticToken) {
      return this.staticToken;
    }

    if (this.oauth) {
      return this.oauth.getValidToken();
    }

    throw new ParasutAuthError([
      { title: 'No Token', detail: 'No authentication method configured' },
    ]);
  }

  /**
   * Returns the company ID if set, or throws a ParasutConfigError if not.
   */
  getCompanyId(): number {
    if (!this._companyId) {
      throw new ParasutConfigError(
        'companyId is required to access company resources. Provide companyId in config or call client.getMe() to discover and set it.'
      );
    }
    return this._companyId;
  }

  /**
   * Queries the `/me` endpoint with user roles, companies, and profile included.
   * If companyId was not provided (or is 0), automatically discovers and sets
   * this.companyId to the first available company ID.
   */
  async getMe(): Promise<any> {
    const response = await this.transport.get<any>('/me?include=user_roles,companies,profile');

    if (!this._companyId || this._companyId === 0) {
      let discoveredId: number | undefined;

      // 1. Try to find company in JSON:API included array
      if (Array.isArray(response?.included)) {
        const company = response.included.find(
          (item: any) => item.type === 'companies' && item.id !== undefined
        );
        if (company?.id) {
          discoveredId = Number(company.id);
        }
      }

      // 2. Try relationships.companies.data
      if (!discoveredId && Array.isArray(response?.data?.relationships?.companies?.data)) {
        const companyRel = response.data.relationships.companies.data.find(
          (item: any) => item.id !== undefined
        );
        if (companyRel?.id) {
          discoveredId = Number(companyRel.id);
        }
      }

      // 3. Fallback for non-JSON:API or simplified mock responses (e.g. { companies: [{ id: 123 }] })
      if (!discoveredId && Array.isArray(response?.companies) && response.companies.length > 0) {
        const firstComp = response.companies[0];
        const rawId = typeof firstComp === 'object' ? firstComp.id : firstComp;
        if (rawId) {
          discoveredId = Number(rawId);
        }
      }

      if (discoveredId && !Number.isNaN(discoveredId)) {
        this.companyId = discoveredId;
      }
    }

    return response;
  }

  /**
   * Resolves the company ID, discovering it via getMe() if not already set.
   */
  async resolveCompanyId(): Promise<number> {
    if (this._companyId && this._companyId !== 0) {
      return this._companyId;
    }

    await this.getMe();

    if (!this._companyId || this._companyId === 0) {
      throw new ParasutConfigError(
        'Could not resolve companyId: no companies found in user profile'
      );
    }

    return this._companyId;
  }

  /**
   * Resets cached resource instances when companyId changes.
   */
  private resetResources(): void {
    this._trackableJobs = undefined;
    this._accounts = undefined;
    this._contacts = undefined;
    this._products = undefined;
    this._salesInvoices = undefined;
    this._salesOffers = undefined;
    this._purchaseBills = undefined;
    this._eArchives = undefined;
    this._eInvoices = undefined;
    this._eInvoiceInboxes = undefined;
    this._eSmms = undefined;
    this._bankFees = undefined;
    this._salaries = undefined;
    this._taxes = undefined;
    this._employees = undefined;
    this._inventoryLevels = undefined;
    this._stockMovements = undefined;
    this._shipmentDocuments = undefined;
    this._tags = undefined;
    this._itemCategories = undefined;
    this._transactions = undefined;
  }

  /**
   * Creates a resource config.
   */
  private getResourceConfig() {
    return {
      transport: this.transport,
      companyId: this.getCompanyId(),
    };
  }

  // ============================================================================
  // Resource Accessors
  // ============================================================================

  /**
   * Trackable Jobs - for monitoring async operations.
   */
  get trackableJobs(): TrackableJobsResource {
    if (!this._trackableJobs) {
      this._trackableJobs = new TrackableJobsResource(this.transport, this.getCompanyId());
    }
    return this._trackableJobs;
  }

  /**
   * Accounts - cash and bank accounts.
   */
  get accounts(): AccountsResource {
    if (!this._accounts) {
      this._accounts = new AccountsResource(this.getResourceConfig());
    }
    return this._accounts;
  }

  /**
   * Contacts - customers and suppliers.
   */
  get contacts(): ContactsResource {
    if (!this._contacts) {
      this._contacts = new ContactsResource(this.getResourceConfig());
    }
    return this._contacts;
  }

  /**
   * Products - goods and services.
   */
  get products(): ProductsResource {
    if (!this._products) {
      this._products = new ProductsResource(this.getResourceConfig());
    }
    return this._products;
  }

  /**
   * Sales Invoices - manage sales invoices.
   */
  get salesInvoices(): SalesInvoicesResource {
    if (!this._salesInvoices) {
      this._salesInvoices = new SalesInvoicesResource(this.getResourceConfig());
    }
    return this._salesInvoices;
  }

  /**
   * Sales Offers - quotes and proposals.
   */
  get salesOffers(): SalesOffersResource {
    if (!this._salesOffers) {
      this._salesOffers = new SalesOffersResource(this.getResourceConfig());
    }
    return this._salesOffers;
  }

  /**
   * Purchase Bills - expenses and supplier invoices.
   */
  get purchaseBills(): PurchaseBillsResource {
    if (!this._purchaseBills) {
      this._purchaseBills = new PurchaseBillsResource(this.getResourceConfig());
    }
    return this._purchaseBills;
  }

  /**
   * E-Archives - e-archive documents.
   */
  get eArchives(): EArchivesResource {
    if (!this._eArchives) {
      this._eArchives = new EArchivesResource(this.getResourceConfig(), this.trackableJobs);
    }
    return this._eArchives;
  }

  /**
   * E-Invoices - e-invoice documents.
   */
  get eInvoices(): EInvoicesResource {
    if (!this._eInvoices) {
      this._eInvoices = new EInvoicesResource(this.getResourceConfig(), this.trackableJobs);
    }
    return this._eInvoices;
  }

  /**
   * E-Invoice Inboxes - check if contacts are e-invoice users.
   */
  get eInvoiceInboxes(): EInvoiceInboxesResource {
    if (!this._eInvoiceInboxes) {
      this._eInvoiceInboxes = new EInvoiceInboxesResource(this.getResourceConfig());
    }
    return this._eInvoiceInboxes;
  }

  /**
   * E-SMMs - freelancer receipts.
   */
  get eSmms(): ESmmsResource {
    if (!this._eSmms) {
      this._eSmms = new ESmmsResource(this.getResourceConfig(), this.trackableJobs);
    }
    return this._eSmms;
  }

  /**
   * Bank Fees - bank charges.
   */
  get bankFees(): BankFeesResource {
    if (!this._bankFees) {
      this._bankFees = new BankFeesResource(this.getResourceConfig());
    }
    return this._bankFees;
  }

  /**
   * Salaries - employee salaries.
   */
  get salaries(): SalariesResource {
    if (!this._salaries) {
      this._salaries = new SalariesResource(this.getResourceConfig());
    }
    return this._salaries;
  }

  /**
   * Taxes - tax records.
   */
  get taxes(): TaxesResource {
    if (!this._taxes) {
      this._taxes = new TaxesResource(this.getResourceConfig());
    }
    return this._taxes;
  }

  /**
   * Employees - employee records.
   */
  get employees(): EmployeesResource {
    if (!this._employees) {
      this._employees = new EmployeesResource(this.getResourceConfig());
    }
    return this._employees;
  }

  /**
   * Inventory Levels - stock levels per warehouse.
   */
  get inventoryLevels(): InventoryLevelsResource {
    if (!this._inventoryLevels) {
      this._inventoryLevels = new InventoryLevelsResource(this.getResourceConfig());
    }
    return this._inventoryLevels;
  }

  /**
   * Stock Movements - stock movement history.
   */
  get stockMovements(): StockMovementsResource {
    if (!this._stockMovements) {
      this._stockMovements = new StockMovementsResource(this.getResourceConfig());
    }
    return this._stockMovements;
  }

  /**
   * Shipment Documents - delivery notes.
   */
  get shipmentDocuments(): ShipmentDocumentsResource {
    if (!this._shipmentDocuments) {
      this._shipmentDocuments = new ShipmentDocumentsResource(this.getResourceConfig());
    }
    return this._shipmentDocuments;
  }

  /**
   * Tags - labels for organizing resources.
   */
  get tags(): TagsResource {
    if (!this._tags) {
      this._tags = new TagsResource(this.getResourceConfig());
    }
    return this._tags;
  }

  /**
   * Item Categories - categories for products and expenses.
   */
  get itemCategories(): ItemCategoriesResource {
    if (!this._itemCategories) {
      this._itemCategories = new ItemCategoriesResource(this.getResourceConfig());
    }
    return this._itemCategories;
  }

  /**
   * Transactions - financial transactions.
   */
  get transactions(): TransactionsResource {
    if (!this._transactions) {
      this._transactions = new TransactionsResource(this.getResourceConfig());
    }
    return this._transactions;
  }
}
