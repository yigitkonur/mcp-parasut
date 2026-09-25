/**
 * Taxes Resource (Vergi)
 *
 * Manage tax records.
 */
import { BaseResource } from './BaseResource.js';
export class TaxesResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/taxes',
            resourceType: 'taxes',
        });
    }
    async archive(id) {
        return this.transport.patch(this.buildPath(id, '/archive'));
    }
    async unarchive(id) {
        return this.transport.patch(this.buildPath(id, '/unarchive'));
    }
    async pay(id, payload) {
        return this.transport.post(this.buildPath(id, '/payments'), payload);
    }
}
//# sourceMappingURL=taxes.js.map