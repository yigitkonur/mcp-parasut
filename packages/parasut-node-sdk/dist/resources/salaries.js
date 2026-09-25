/**
 * Salaries Resource (Maaş)
 *
 * Manage salary records.
 */
import { BaseResource } from './BaseResource.js';
export class SalariesResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/salaries',
            resourceType: 'salaries',
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
//# sourceMappingURL=salaries.js.map