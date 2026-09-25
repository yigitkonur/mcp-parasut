/**
 * Employees Resource (Çalışan)
 *
 * Manage employee records.
 */
import { BaseResource } from './BaseResource.js';
// ============================================================================
// Resource
// ============================================================================
export class EmployeesResource extends BaseResource {
    constructor(config) {
        super({
            ...config,
            basePath: '/employees',
            resourceType: 'employees',
        });
    }
    /**
     * Archives an employee.
     */
    async archive(id) {
        return this.transport.patch(this.buildPath(id, '/archive'));
    }
    /**
     * Unarchives an employee.
     */
    async unarchive(id) {
        return this.transport.patch(this.buildPath(id, '/unarchive'));
    }
}
//# sourceMappingURL=employees.js.map