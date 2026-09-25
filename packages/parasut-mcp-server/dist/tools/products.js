/**
 * Product Tools
 *
 * Tools for managing products and services.
 */
import { z } from 'zod';
import { getClient } from '../client.js';
import { formatSuccess, formatList, formatCreated, formatNotFound, formatProductSummary, } from '../utils/response.js';
import { handleError } from '../utils/errors.js';
// ============================================================================
// Schemas
// ============================================================================
const SearchProductsSchema = z.object({
    query: z.string().optional().describe('Search by name or code'),
    category_id: z.string().optional().describe('Filter by category'),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(25).default(25),
});
const GetProductSchema = z.object({
    id: z.string().describe('Product ID'),
});
const CreateProductSchema = z.object({
    name: z.string().min(1).describe('Product name'),
    code: z.string().optional().describe('Product code/SKU'),
    unit: z.string().default('Adet').describe('Unit (Adet, Kg, Lt, etc.)'),
    list_price: z.number().optional().describe('List price'),
    currency: z.enum(['TRL', 'USD', 'EUR', 'GBP']).default('TRL'),
    vat_rate: z.number().min(0).max(100).default(20),
    category_id: z.string().optional().describe('Category ID'),
    barcode: z.string().optional().describe('Barcode'),
});
const UpdateProductSchema = z.object({
    id: z.string().describe('Product ID'),
    name: z.string().optional(),
    code: z.string().optional(),
    list_price: z.number().optional(),
    vat_rate: z.number().optional(),
});
// ============================================================================
// Tool Definitions
// ============================================================================
export const productTools = [
    {
        name: 'search_products',
        description: `
<usecase>
Search for products and services.
Use when: Finding products by name, code, or category for use in invoices.
Do NOT use when: You have the product ID (use get_product instead).
</usecase>

<example>
search_products(query="laptop")
search_products(category_id="123")
</example>

<returns>
List of products with: id, name, code, list_price, currency, vat_rate, unit.
Use the ID in create_invoice lines.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search by name or code' },
                category_id: { type: 'string', description: 'Filter by category' },
                page: { type: 'number', default: 1 },
                limit: { type: 'number', default: 25 },
            },
        },
    },
    {
        name: 'get_product',
        description: `
<usecase>
Get detailed information about a product including inventory levels.
Use when: You have a product ID and need full details or stock info.
Do NOT use when: You don't have the ID yet (use search_products first).
</usecase>

<example>
get_product(id="12345")
</example>

<returns>
Full product: id, name, code, list_price, currency, vat_rate, unit, initial_stock_count, barcode.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Product ID' },
            },
            required: ['id'],
        },
    },
    {
        name: 'create_product',
        description: `
<usecase>
Create a new product or service.
Use when: Adding a new product that can be reused across invoices.
Do NOT use when: One-time line item (add directly to invoice lines instead).
</usecase>

<instructions>
- name: Product name (required)
- list_price: Default selling price
- unit: Measurement unit (Adet, Kg, Lt, etc.)
- vat_rate: VAT percentage
- currency: Must be TRL, USD, EUR, or GBP
</instructions>

<example>
create_product(name="Consulting Hour", list_price=500, unit="Saat", vat_rate=20)
</example>

<returns>
Created product with: id, name, code.
Use the ID in create_invoice lines for faster invoicing.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                code: { type: 'string' },
                unit: { type: 'string', default: 'Adet' },
                list_price: { type: 'number' },
                currency: { type: 'string', enum: ['TRL', 'USD', 'EUR', 'GBP'], description: 'Currency. MUST be one of: TRL, USD, EUR, GBP' },
                vat_rate: { type: 'number', default: 20 },
                category_id: { type: 'string' },
                barcode: { type: 'string' },
            },
            required: ['name'],
        },
    },
    {
        name: 'update_product',
        description: `
<usecase>
Update an existing product's information.
Use when: Changing price, name, or other product details.
Do NOT use when: Creating a new product (use create_product instead).
</usecase>

<example>
update_product(id="12345", list_price=600)
</example>

<returns>
Updated product with: id, name, and list of updated_fields.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                code: { type: 'string' },
                list_price: { type: 'number' },
                vat_rate: { type: 'number' },
            },
            required: ['id'],
        },
    },
];
// ============================================================================
// Handlers
// ============================================================================
export async function handleSearchProducts(args) {
    try {
        const params = SearchProductsSchema.parse(args);
        const client = getClient();
        const filter = {};
        if (params.query)
            filter['name'] = params.query;
        if (params.category_id)
            filter['category_id'] = params.category_id;
        const response = await client.products.list({
            filter,
            page: { number: params.page, size: params.limit },
        });
        return formatList(response.data, {
            totalCount: response.meta.total_count,
            currentPage: response.meta.current_page,
            totalPages: response.meta.total_pages,
        }, {
            itemFormatter: formatProductSummary,
            nextSteps: [
                { action: 'Get product details', example: 'get_product(id="<id>")' },
                { action: 'Use in invoice', example: 'create_invoice(..., lines=[{product_id="<id>", ...}])' },
            ],
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Search products', resourceType: 'Product' });
    }
}
export async function handleGetProduct(args) {
    try {
        const params = GetProductSchema.parse(args);
        const client = getClient();
        const response = await client.products.get(params.id, {
            include: ['category', 'inventory_levels'],
        });
        if (!response.data) {
            return formatNotFound('Product', params.id, [
                { action: 'Search products', example: 'search_products()' },
            ]);
        }
        const product = response.data;
        return formatSuccess({
            id: product.id,
            name: product.attributes.name,
            code: product.attributes.code,
            list_price: product.attributes.list_price,
            currency: product.attributes.currency,
            vat_rate: product.attributes.vat_rate,
            unit: product.attributes.unit,
            initial_stock_count: product.attributes.initial_stock_count,
            barcode: product.attributes.barcode,
        }, {
            summary: `Product: ${product.attributes.name}`,
            nextSteps: [
                { action: 'Check stock levels', example: `get_stock_levels(product_id="${product.id}")` },
            ],
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Get product', resourceType: 'Product' });
    }
}
export async function handleCreateProduct(args) {
    try {
        const params = CreateProductSchema.parse(args);
        const client = getClient();
        const response = await client.products.create({
            data: {
                type: 'products',
                attributes: {
                    name: params.name,
                    ...(params.code !== undefined && { code: params.code }),
                    unit: params.unit,
                    ...(params.list_price !== undefined && { list_price: params.list_price }),
                    currency: params.currency,
                    vat_rate: params.vat_rate,
                    ...(params.barcode !== undefined && { barcode: params.barcode }),
                },
                ...(params.category_id !== undefined && {
                    relationships: {
                        category: { data: { id: params.category_id, type: 'item_categories' } }
                    }
                }),
            },
        });
        return formatCreated('Product', {
            id: response.data.id,
            name: response.data.attributes.name,
            code: response.data.attributes.code,
        }, [
            { action: 'Use in invoice', example: `create_invoice(..., lines=[{product_id="${response.data.id}", ...}])` },
        ]);
    }
    catch (error) {
        return handleError(error, { operation: 'Create product', resourceType: 'Product' });
    }
}
export async function handleUpdateProduct(args) {
    try {
        const params = UpdateProductSchema.parse(args);
        const client = getClient();
        const attributes = {};
        if (params.name !== undefined)
            attributes['name'] = params.name;
        if (params.code !== undefined)
            attributes['code'] = params.code;
        if (params.list_price !== undefined)
            attributes['list_price'] = params.list_price;
        if (params.vat_rate !== undefined)
            attributes['vat_rate'] = params.vat_rate;
        const response = await client.products.update(params.id, {
            data: {
                id: params.id,
                type: 'products',
                attributes,
            },
        });
        return formatSuccess({
            id: response.data.id,
            name: response.data.attributes.name,
            updated_fields: Object.keys(attributes),
        }, { summary: 'Product updated' });
    }
    catch (error) {
        return handleError(error, { operation: 'Update product', resourceType: 'Product' });
    }
}
//# sourceMappingURL=products.js.map