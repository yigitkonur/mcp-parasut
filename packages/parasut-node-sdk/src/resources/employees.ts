/**
 * Employees Resource (Çalışan)
 *
 * Manage employee records.
 */

import { BaseResource, type ResourceConfig } from './BaseResource.js';
import type { JsonApiResource, JsonApiResponse } from '../generated/types.js';

// ============================================================================
// Types
// ============================================================================

export interface EmployeeAttributes {
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly balance?: number;
  readonly trl_balance?: number;
  readonly archived?: boolean;
  name: string;
  email?: string;
  tckn?: string;
  iban?: string;
}

export interface Employee extends JsonApiResource<EmployeeAttributes> {
  type: 'employees';
}

export interface EmployeeFilters {
  name?: string;
  email?: string;
}

// ============================================================================
// Resource
// ============================================================================

export class EmployeesResource extends BaseResource<
  Employee,
  EmployeeAttributes,
  EmployeeFilters
> {
  constructor(config: Omit<ResourceConfig, 'basePath' | 'resourceType'>) {
    super({
      ...config,
      basePath: '/employees',
      resourceType: 'employees',
    });
  }

  /**
   * Archives an employee.
   */
  async archive(id: string | number): Promise<JsonApiResponse<Employee>> {
    return this.transport.patch<JsonApiResponse<Employee>>(
      this.buildPath(id, '/archive')
    );
  }

  /**
   * Unarchives an employee.
   */
  async unarchive(id: string | number): Promise<JsonApiResponse<Employee>> {
    return this.transport.patch<JsonApiResponse<Employee>>(
      this.buildPath(id, '/unarchive')
    );
  }
}
