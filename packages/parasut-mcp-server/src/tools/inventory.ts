/**
 * Inventory Tools
 *
 * Tools for stock levels and inventory tracking.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient } from '../client.js';
import { formatList, type ToolResponse } from '../utils/response.js';
import { handleError } from '../utils/errors.js';

// ============================================================================
// Schemas
// ============================================================================

const GetStockLevelsSchema = z.object({
  product_id: z.string().optional().describe('Filter by product ID'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(25).default(25),
});

const SearchStockMovementsSchema = z.object({
  product_id: z.string().optional().describe('Filter by product ID'),
  date_start: z.string().optional().describe('Start date'),
  date_end: z.string().optional().describe('End date'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(25).default(25),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const inventoryTools: Tool[] = [
  {
    name: 'get_stock_levels',
    description: `
<usecase>
Get current stock levels for products.
Use when: Checking inventory quantities, verifying stock before invoicing.
Do NOT use when: Looking for stock history (use search_stock_movements instead).
</usecase>

<example>
get_stock_levels()
get_stock_levels(product_id="12345")
</example>

<returns>
Stock levels with: id, stock_count per warehouse.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Filter by product ID' },
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 25 },
      },
    },
  },
  {
    name: 'search_stock_movements',
    description: `
<usecase>
Search for stock movement history.
Use when: Viewing inbound/outbound inventory changes, tracking stock history.
Do NOT use when: Just checking current levels (use get_stock_levels instead).
</usecase>

<example>
search_stock_movements(product_id="12345")
search_stock_movements(date_start="2024-01-01")
</example>

<returns>
List of stock movements showing quantity changes and timestamps.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Filter by product ID' },
        date_start: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_end: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 25 },
      },
    },
  },
];

// ============================================================================
// Handlers
// ============================================================================

export async function handleGetStockLevels(args: unknown): Promise<ToolResponse> {
  try {
    const params = GetStockLevelsSchema.parse(args);
    const client = getClient();

    if (params.product_id) {
      const response = await client.inventoryLevels.getForProduct(params.product_id, {
        page: { number: params.page, size: params.limit },
      });

      const warehouseMap = new Map<string, string>();
      if (Array.isArray(response.included)) {
        for (const item of response.included) {
          if (item.type === 'warehouses' && item.attributes?.name) {
            warehouseMap.set(item.id, item.attributes.name);
          }
        }
      }

      const levels = (response.data ?? []).map((level: any) => {
        const warehouseId = level.relationships?.warehouse?.data?.id;
        const warehouseName = warehouseId ? warehouseMap.get(warehouseId) : undefined;
        return {
          id: level.id,
          warehouse_id: warehouseId,
          warehouse_name: warehouseName,
          stock_count: level.attributes?.stock_count,
          total_inventory: level.attributes?.total_inventory,
        };
      });

      return formatList(levels, {
        totalCount: response.meta?.total_count ?? levels.length,
        currentPage: response.meta?.current_page ?? params.page,
        totalPages: response.meta?.total_pages ?? 1,
      }, {
        nextSteps: [
          { action: 'View movement history', example: `search_stock_movements(product_id="${params.product_id}")` },
        ],
      });
    }

    // When product_id is not specified, list products with their stock info
    const productsResponse = await client.products.list({
      page: { number: params.page, size: params.limit },
    });

    const products = productsResponse.data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      code: p.attributes.code,
      stock_count: (p.attributes as any).stock_count ?? (p.attributes as any).initial_stock_count ?? '0.0',
    }));

    return formatList(products, {
      totalCount: productsResponse.meta.total_count,
      currentPage: productsResponse.meta.current_page,
      totalPages: productsResponse.meta.total_pages,
    }, {
      nextSteps: [
        { action: 'Get detailed stock levels for product', example: 'get_stock_levels(product_id="<id>")' },
      ],
    });
  } catch (error) {
    return handleError(error, { operation: 'Get stock levels' });
  }
}

export async function handleSearchStockMovements(args: unknown): Promise<ToolResponse> {
  try {
    const params = SearchStockMovementsSchema.parse(args);
    const client = getClient();

    const filter: Record<string, string> = {};
    if (params.product_id) filter['product_id'] = params.product_id;
    if (params.date_start) filter['date'] = params.date_start;

    const response = await client.stockMovements.list({
      filter,
      page: { number: params.page, size: params.limit },
    });

    return formatList(response.data, {
      totalCount: response.meta.total_count,
      currentPage: response.meta.current_page,
      totalPages: response.meta.total_pages,
    });
  } catch (error) {
    return handleError(error, { operation: 'Search stock movements' });
  }
}
