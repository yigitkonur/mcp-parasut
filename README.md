unofficial type-safe Node.js SDK and MCP server for [Parasut](https://www.parasut.com/), the Turkish accounting platform. zero runtime dependencies in the SDK. 31 MCP tools for invoices, contacts, products, e-documents (GIB), inventory, and financials.

```bash
npm install @yigitkonur/parasut-node-sdk
```

or run the MCP server directly:

```bash
npx @yigitkonur/parasut-mcp-server
```

[![npm](https://img.shields.io/npm/v/@yigitkonur/parasut-node-sdk.svg?style=flat-square)](https://www.npmjs.com/package/@yigitkonur/parasut-node-sdk)
[![npm](https://img.shields.io/npm/v/@yigitkonur/parasut-mcp-server.svg?style=flat-square)](https://www.npmjs.com/package/@yigitkonur/parasut-mcp-server)
[![license](https://img.shields.io/badge/license-MIT-grey.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## what it does

a pnpm monorepo with two packages:

- **`@yigitkonur/parasut-node-sdk`** — TypeScript SDK wrapping Parasut REST API v4. handles OAuth2, rate limiting, retries, JSON:API serialization. zero runtime deps, uses native `fetch`.
- **`@yigitkonur/parasut-mcp-server`** — MCP server exposing 31 tools over stdio. plug it into Claude Desktop, Cursor, or any MCP-compatible host and manage your entire Parasut account from natural language.

not affiliated with Parasut.

## what the SDK covers

every resource gets `list`, `get`, `create`, `update`, `delete`, plus `iterate` (async generator), `listAll`, `count`, `exists`, and `first` for free.

| `client.*` | what it is |
|:---|:---|
| `contacts` | customers and suppliers |
| `salesInvoices` | full CRUD + archive, cancel, recover, pay, list overdue/unpaid |
| `salesOffers` | quotes and proposals |
| `purchaseBills` | supplier invoices and expenses |
| `eArchives` | e-arsiv documents with `submitAndWait` |
| `eInvoices` | e-fatura with `submitAndWait` |
| `eInvoiceInboxes` | GIB inbox lookup by tax number |
| `eSmms` | e-serbest meslek makbuzu (freelancer receipts) |
| `accounts` | bank and cash accounts |
| `products` | goods and services |
| `employees` | employee records |
| `salaries` | salary payments |
| `taxes` | tax payments (KDV, stopaj, SGK) |
| `bankFees` | bank service charges |
| `inventoryLevels` | stock counts per warehouse |
| `stockMovements` | inbound/outbound inventory |
| `shipmentDocuments` | delivery and waybill docs |
| `tags` | labels for organizing |
| `itemCategories` | product/expense categories |
| `transactions` | financial ledger |
| `trackableJobs` | polls async jobs until done/error |

## what the MCP server exposes

31 tools across 8 domains:

| domain | tools | notes |
|:---|:---|:---|
| contacts | `search_contacts`, `get_contact`, `create_contact`, `update_contact` | filter by name, email, tax number, city |
| invoices | `search_invoices`, `get_invoice`, `create_invoice`, `cancel_invoice`, `recover_invoice`, `invoice_pdf`, `record_invoice_payment` | all writes require `confirm=true` |
| bills | `search_bills`, `get_bill`, `create_bill`, `record_bill_payment` | supplier invoices and expenses |
| products | `search_products`, `get_product`, `create_product`, `update_product` | |
| e-documents | `check_einvoice_inbox`, `send_einvoice`, `send_earchive`, `send_esmm` | double confirmation for GIB submissions |
| financial | `list_accounts`, `search_transactions`, `create_bank_fee`, `get_financial_summary` | summary aggregates AR/AP/net across all accounts |
| inventory | `get_stock_levels`, `search_stock_movements` | |
| organization | `list_categories`, `list_tags`, `list_employees`, `create_salary`, `create_tax` | |

every write tool shows a preview first. pass `confirm=true` to execute. GIB e-document submissions additionally require `i_understand_this_is_irreversible="YES"`.

## SDK usage

```typescript
import { ParasutClient } from '@yigitkonur/parasut-node-sdk';

const client = new ParasutClient({
  companyId: 115,
  credentials: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    username: 'your@email.com',
    password: 'your-password',
  },
});

// list contacts
const contacts = await client.contacts.list({ filter: { name: 'acme' } });

// create an invoice
const invoice = await client.salesInvoices.create({
  contact_id: 123,
  item_type: 'invoice',
  description: 'consulting',
  details: [{ product_id: 456, quantity: 1 }],
});

// iterate all products (async generator, handles pagination)
for await (const product of client.products.iterate()) {
  console.log(product.attributes.name);
}

// submit e-invoice and wait for GIB response
const result = await client.eInvoices.submitAndWait(invoiceId, {
  scenario: 'basic',
  to: 'urn:mail:defaultpk@parasut.com',
});
```

## MCP server setup

### Claude Desktop

add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "parasut": {
      "command": "npx",
      "args": ["@yigitkonur/parasut-mcp-server"],
      "env": {
        "PARASUT_COMPANY_ID": "115",
        "PARASUT_CLIENT_ID": "...",
        "PARASUT_CLIENT_SECRET": "...",
        "PARASUT_USERNAME": "...",
        "PARASUT_PASSWORD": "..."
      }
    }
  }
}
```

### standalone

```bash
PARASUT_COMPANY_ID=115 \
PARASUT_CLIENT_ID=your-client-id \
PARASUT_CLIENT_SECRET=your-client-secret \
PARASUT_USERNAME=your@email.com \
PARASUT_PASSWORD=yourpassword \
npx @yigitkonur/parasut-mcp-server
```

transport is stdio. logs go to stderr.

## configuration

### required env vars (MCP server)

| variable | description |
|:---|:---|
| `PARASUT_COMPANY_ID` | your Parasut company/firma ID |
| `PARASUT_CLIENT_ID` | OAuth2 client ID |
| `PARASUT_CLIENT_SECRET` | OAuth2 client secret |
| `PARASUT_USERNAME` | login email |
| `PARASUT_PASSWORD` | password |

### optional

| variable | default | description |
|:---|:---|:---|
| `PARASUT_BASE_URL` | `https://api.parasut.com/v4` | override API endpoint |
| `DEBUG` | `false` | debug logging to stderr |

### SDK config options

| option | default | description |
|:---|:---|:---|
| `companyId` | required | |
| `credentials` or `accessToken` | required | OAuth2 creds or static token |
| `baseUrl` | `https://api.parasut.com/v4` | |
| `timeout` | `30000` | request timeout in ms |
| `rateLimit.requestsPerWindow` | `10` | token bucket limit |
| `rateLimit.windowMs` | `10000` | token bucket window |
| `retry.maxRetries` | `3` | |
| `retry.initialDelayMs` | `100` | |
| `retry.maxDelayMs` | `10000` | |
| `retry.backoffMultiplier` | `2` | |
| `retry.retryableStatuses` | `[408, 429, 500, 502, 503, 504]` | |
| `tokenStorage` | in-memory | pluggable (implement `TokenStorage` interface) |

## project structure

```
packages/parasut-node-sdk/
  src/
    index.ts                — public API barrel export
    client/
      ParasutClient.ts      — main client, lazy resource getters
      OAuth.ts              — password grant + refresh + auth code flow
      HttpTransport.ts      — native fetch wrapper with interceptors
      RateLimiter.ts        — token bucket (10 req / 10 sec)
      RetryHandler.ts       — exponential backoff with jitter
      QueryBuilder.ts       — JSON:API query param serialization
      JsonApi.ts            — JSON:API body builders and denormalizer
      errors.ts             — error hierarchy (auth, forbidden, not found, validation, rate limit)
    resources/
      BaseResource.ts       — abstract base with CRUD + iterate/listAll/count/exists/first
      contacts.ts           — customers and suppliers
      salesInvoices.ts      — invoices with archive/cancel/recover/pay
      eArchives.ts          — e-arsiv with submitAndWait
      eInvoices.ts          — e-fatura with submitAndWait
      eSmms.ts              — e-SMM with submitAndWait
      ...                   — 12 more resource files
    generated/
      types.ts              — auto-generated from swagger spec
      operations.ts         — operation metadata map

packages/parasut-mcp-server/
  src/
    index.ts                — entrypoint
    server.ts               — MCP server wiring (stdio transport)
    config.ts               — env var loading and validation
    client.ts               — singleton ParasutClient
    tools/
      contacts.ts           — 4 tools
      invoices.ts           — 7 tools
      bills.ts              — 4 tools
      products.ts           — 4 tools
      edocuments.ts         — 4 tools (double confirmation)
      financial.ts          — 4 tools
      inventory.ts          — 2 tools
      organization.ts       — 5 tools
    utils/
      response.ts           — formatters with next-step guidance
      errors.ts             — SDK error → structured MCP response mapping
```

## development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

requires Node.js 18+ and pnpm 9.

types are generated from the Parasut Swagger spec:

```bash
pnpm --filter parasut-node-sdk generate-types
```

## internals worth noting

- **confirmation pattern** — every write tool returns a preview by default. pass `confirm=true` to execute. GIB e-document tools require a second `i_understand_this_is_irreversible="YES"` field.
- **async job polling** — e-document submissions return a trackable job ID. `submitAndWait()` polls every 2 seconds up to 60 seconds until done or error.
- **token refresh dedup** — concurrent `getValidToken()` calls share a single in-flight refresh promise instead of hammering the token endpoint.
- **page size cap** — Parasut limits page size to 25. the SDK silently enforces `Math.min(size, 25)`.
- **LLM-optimized tool descriptions** — every tool uses XML-structured descriptions with `<usecase>`, `<instructions>`, `<example>`, `<returns>` tags for better model comprehension.
- **guided error responses** — errors never throw in the MCP server. they're caught and returned as structured responses with recovery steps.

## license

MIT
