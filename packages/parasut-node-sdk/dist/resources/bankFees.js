/**
 * Bank Fees Resource (Banka Gideri)
 *
 * Manage bank fees and charges.
 */
import { BaseResource } from './BaseResource.js';
export class BankFeesResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/bank_fees',
            resourceType: 'bank_fees',
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
//# sourceMappingURL=bankFees.js.map