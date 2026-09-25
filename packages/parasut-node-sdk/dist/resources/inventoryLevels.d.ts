/**
 * Inventory Levels Resource (Depo Stok Seviyesi)
 *
 * View inventory levels per warehouse.
 */
import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource } from '../generated/types.js';
export interface InventoryLevelAttributes {
    readonly stock_count?: number;
    readonly created_at?: string;
    readonly updated_at?: string;
}
export interface InventoryLevel extends JsonApiResource<InventoryLevelAttributes> {
    type: 'inventory_levels';
}
export interface InventoryLevelFilters {
    product_id?: number;
    warehouse_id?: number;
}
export declare class InventoryLevelsResource extends BaseResource<InventoryLevel, InventoryLevelAttributes, InventoryLevelFilters> {
    constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>);
    getForProduct(productId: number | string, options?: {
        page?: {
            number?: number;
            size?: number;
        };
    }): Promise<{
        data: InventoryLevel[];
        included?: any[];
        meta?: any;
    }>;
    getForWarehouse(warehouseId: number): Promise<import("./BaseResource.js").PaginatedResponse<InventoryLevel>>;
}
//# sourceMappingURL=inventoryLevels.d.ts.map