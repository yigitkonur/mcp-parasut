/**
 * Organization Tools
 *
 * Tools for categories, tags, employees, salaries, and taxes.
 */
import { z } from 'zod';
import { getClient } from '../client.js';
import { formatSuccess, formatList, formatCreated } from '../utils/response.js';
import { handleError } from '../utils/errors.js';
// ============================================================================
// Schemas
// ============================================================================
const ListCategoriesSchema = z.object({
    category_type: z
        .enum(['Product', 'Contact', 'Employee', 'Salary', 'Tax', 'BankFee', 'PurchaseBill'])
        .optional()
        .describe('Filter by category type'),
});
const ListTagsSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(25).default(25),
});
const ListEmployeesSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(25).default(25),
});
const CreateSalarySchema = z.object({
    employee_id: z.string().describe('Employee ID'),
    amount: z.number().positive().describe('Salary amount'),
    date: z.string().optional().describe('Salary date'),
    description: z.string().optional().describe('Description'),
    confirm: z.boolean().optional().describe('⚠️ Set to true to confirm salary payment. Required to execute.'),
});
const CreateTaxSchema = z.object({
    amount: z.number().positive().describe('Tax amount'),
    date: z.string().optional().describe('Tax date'),
    tax_type: z
        .enum(['kdv', 'stopaj', 'sgk', 'other'])
        .default('other')
        .describe('Tax type'),
    description: z.string().optional().describe('Description'),
    confirm: z.boolean().optional().describe('⚠️ Set to true to confirm tax payment. Required to execute.'),
});
// ============================================================================
// Tool Definitions
// ============================================================================
export const organizationTools = [
    {
        name: 'list_categories',
        description: `
<usecase>
List item categories for organization.
Use when: Finding category IDs for products, contacts, or expenses.
Do NOT use when: Looking for tags (use list_tags instead).
</usecase>

<example>
list_categories()
list_categories(category_type="Product")
</example>

<returns>
List of categories with: id, name, category_type, bg_color.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                category_type: {
                    type: 'string',
                    enum: ['Product', 'Contact', 'Employee', 'Salary', 'Tax', 'BankFee', 'PurchaseBill'],
                    description: 'Filter by type. MUST be one of: Product, Contact, Employee, Salary, Tax, BankFee, PurchaseBill',
                },
            },
        },
    },
    {
        name: 'list_tags',
        description: `
<usecase>
List all tags used for organizing resources.
Use when: Finding tag IDs for filtering or applying to contacts/invoices.
Do NOT use when: Looking for categories (use list_categories instead).
</usecase>

<example>
list_tags()
</example>

<returns>
List of tags with: id, name.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                page: { type: 'number', default: 1 },
                limit: { type: 'number', default: 25 },
            },
        },
    },
    {
        name: 'list_employees',
        description: `
<usecase>
List all employees in the organization.
Use when: Finding employee IDs for salary payments.
Do NOT use when: Looking for contacts/customers (use search_contacts instead).
</usecase>

<example>
list_employees()
</example>

<returns>
List of employees with: id, name, email, iban.
Use the ID for create_salary.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                page: { type: 'number', default: 1 },
                limit: { type: 'number', default: 25 },
            },
        },
    },
    {
        name: 'create_salary',
        description: `
<usecase>
💵 Record a salary payment for an employee. THIS AFFECTS FINANCIAL RECORDS.
Use when: Recording payroll or salary payments.
Do NOT use when: Recording supplier payments (use record_bill_payment instead).
</usecase>

<instructions>
⚠️ REQUIRES CONFIRMATION: Set confirm=true to execute.
- employee_id: Employee ID (required)
- amount: Salary amount (required)
- confirm: Must be true to execute. Without confirm=true, returns preview only.
</instructions>

<example>
create_salary(employee_id="12345", amount=15000)                    # Preview only
create_salary(employee_id="12345", amount=15000, confirm=true)       # Actually records
</example>

<returns>
Without confirm: Preview of salary to be recorded.
With confirm=true: Created salary record with: id, amount.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                employee_id: { type: 'string', description: 'Employee ID (from list_employees)' },
                amount: { type: 'number', description: 'Salary amount' },
                confirm: { type: 'boolean', description: '⚠️ Set to true to confirm salary. Required to execute.' },
                date: { type: 'string', description: 'Salary date (YYYY-MM-DD)' },
                description: { type: 'string', description: 'Description' },
            },
            required: ['employee_id', 'amount'],
        },
    },
    {
        name: 'create_tax',
        description: `
<usecase>
🏛️ Record a tax payment. THIS AFFECTS FINANCIAL RECORDS.
Use when: Recording KDV, Stopaj, SGK, or other tax payments.
Do NOT use when: Recording bank fees (use create_bank_fee instead).
</usecase>

<instructions>
⚠️ REQUIRES CONFIRMATION: Set confirm=true to execute.
- amount: Tax amount (required)
- tax_type: Must be kdv, stopaj, sgk, or other
- confirm: Must be true to execute. Without confirm=true, returns preview only.
</instructions>

<example>
create_tax(amount=5000, tax_type="kdv")                    # Preview only
create_tax(amount=5000, tax_type="kdv", confirm=true)       # Actually records
</example>

<returns>
Without confirm: Preview of tax payment to be recorded.
With confirm=true: Created tax payment with: id, amount, type.
</returns>
    `.trim(),
        inputSchema: {
            type: 'object',
            properties: {
                amount: { type: 'number', description: 'Tax amount' },
                confirm: { type: 'boolean', description: '⚠️ Set to true to confirm tax payment. Required to execute.' },
                date: { type: 'string', description: 'Tax date (YYYY-MM-DD)' },
                tax_type: { type: 'string', enum: ['kdv', 'stopaj', 'sgk', 'other'], description: 'Tax type. MUST be one of: kdv, stopaj, sgk, other' },
                description: { type: 'string', description: 'Description' },
            },
            required: ['amount'],
        },
    },
];
// ============================================================================
// Handlers
// ============================================================================
export async function handleListCategories(args) {
    try {
        const params = ListCategoriesSchema.parse(args);
        const client = getClient();
        const filter = {};
        if (params.category_type)
            filter['category_type'] = params.category_type;
        const response = await client.itemCategories.list({
            filter,
            page: { number: 1, size: 25 },
        });
        const categories = response.data.map((cat) => ({
            id: cat.id,
            name: cat.attributes.name,
            category_type: cat.attributes.category_type,
            bg_color: cat.attributes.bg_color,
        }));
        return formatSuccess({ categories }, {
            summary: `Found ${categories.length} categories`,
        });
    }
    catch (error) {
        return handleError(error, { operation: 'List categories' });
    }
}
export async function handleListTags(args) {
    try {
        const params = ListTagsSchema.parse(args);
        const client = getClient();
        const response = await client.tags.list({
            page: { number: params.page, size: params.limit },
        });
        const tags = response.data.map((tag) => ({
            id: tag.id,
            name: tag.attributes.name,
        }));
        return formatList(tags, {
            totalCount: response.meta.total_count,
            currentPage: response.meta.current_page,
            totalPages: response.meta.total_pages,
        });
    }
    catch (error) {
        return handleError(error, { operation: 'List tags' });
    }
}
export async function handleListEmployees(args) {
    try {
        const params = ListEmployeesSchema.parse(args);
        const client = getClient();
        const response = await client.employees.list({
            page: { number: params.page, size: params.limit },
        });
        const employees = response.data.map((emp) => ({
            id: emp.id,
            name: emp.attributes.name,
            email: emp.attributes.email,
            iban: emp.attributes.iban,
        }));
        return formatList(employees, {
            totalCount: response.meta.total_count,
            currentPage: response.meta.current_page,
            totalPages: response.meta.total_pages,
        }, {
            nextSteps: [
                { action: 'Record salary', example: 'create_salary(employee_id="<id>", amount=...)' },
            ],
        });
    }
    catch (error) {
        return handleError(error, { operation: 'List employees' });
    }
}
export async function handleCreateSalary(args) {
    try {
        const params = CreateSalarySchema.parse(args);
        const client = getClient();
        const issueDate = params.date ?? new Date().toISOString().split('T')[0];
        // If not confirmed, return preview
        if (!params.confirm) {
            // Try to get employee info for preview
            const employees = await client.employees.list({ page: { number: 1, size: 25 } });
            const employee = employees.data.find(e => e.id === params.employee_id);
            return formatSuccess({
                preview: true,
                salary_to_record: {
                    employee_id: params.employee_id,
                    employee_name: employee?.attributes.name ?? 'Unknown',
                    amount: params.amount,
                    date: issueDate,
                    description: params.description ?? 'Salary',
                },
                warning: '⚠️ This will record a salary payment and affect financial records. Call again with confirm=true to proceed.',
            }, {
                summary: `Preview: Record salary of ${params.amount} for ${employee?.attributes.name ?? 'employee'}`,
                nextSteps: [
                    { action: 'Confirm salary', example: `create_salary(employee_id="${params.employee_id}", amount=${params.amount}, confirm=true)` },
                ],
            });
        }
        const response = await client.salaries.create({
            data: {
                type: 'salaries',
                attributes: {
                    issue_date: issueDate,
                    due_date: issueDate,
                    currency: 'TRL',
                    description: params.description ?? 'Salary',
                    net_total: params.amount,
                },
                relationships: {
                    employee: {
                        data: { id: params.employee_id, type: 'employees' },
                    },
                },
            },
        });
        return formatCreated('Salary', {
            id: response.data.id,
            amount: params.amount,
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Create salary' });
    }
}
export async function handleCreateTax(args) {
    try {
        const params = CreateTaxSchema.parse(args);
        const client = getClient();
        const issueDate = params.date ?? new Date().toISOString().split('T')[0];
        // If not confirmed, return preview
        if (!params.confirm) {
            return formatSuccess({
                preview: true,
                tax_to_record: {
                    amount: params.amount,
                    tax_type: params.tax_type,
                    date: issueDate,
                    description: params.description ?? `${params.tax_type} payment`,
                },
                warning: '⚠️ This will record a tax payment and affect financial records. Call again with confirm=true to proceed.',
            }, {
                summary: `Preview: Record ${params.tax_type.toUpperCase()} tax payment of ${params.amount}`,
                nextSteps: [
                    { action: 'Confirm tax payment', example: `create_tax(amount=${params.amount}, tax_type="${params.tax_type}", confirm=true)` },
                ],
            });
        }
        const response = await client.taxes.create({
            data: {
                type: 'taxes',
                attributes: {
                    issue_date: issueDate,
                    due_date: issueDate,
                    description: params.description ?? `${params.tax_type} payment`,
                    net_total: params.amount,
                },
            },
        });
        return formatCreated('Tax Payment', {
            id: response.data.id,
            amount: params.amount,
            type: params.tax_type,
        });
    }
    catch (error) {
        return handleError(error, { operation: 'Create tax' });
    }
}
//# sourceMappingURL=organization.js.map