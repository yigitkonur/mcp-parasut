/**
 * Inventory Levels Resource (Depo Stok Seviyesi)
 *
 * View inventory levels per warehouse.
 */
import { BaseResource } from './BaseResource.js';
export class InventoryLevelsResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/inventory_levels',
            resourceType: 'inventory_levels',
        });
    }
    async getForProduct(productId, options) {
        const path = `/${this.companyId}/products/${productId}/inventory_levels`;
        const query = {};
        if (options?.page?.number)
            query['page[number]'] = options.page.number;
        if (options?.page?.size)
            query['page[size]'] = Math.min(options.page.size, 25);
        return this.transport.get(path, query);
    }
    async getForWarehouse(warehouseId) {
        return this.list({ filter: { warehouse_id: warehouseId } });
    }
}
//# sourceMappingURL=inventoryLevels.js.map