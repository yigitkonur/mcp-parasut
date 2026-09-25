/**
 * Contact Tools
 *
 * Tools for managing customers and suppliers.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient } from '../client.js';
import {
  formatSuccess,
  formatList,
  formatCreated,
  formatNotFound,
  formatContactSummary,
  type ToolResponse,
} from '../utils/response.js';
import { handleError } from '../utils/errors.js';

// ============================================================================
// Schemas
// ============================================================================

const SearchContactsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Search by name, email, or tax number'),
  account_type: z
    .enum(['customer', 'supplier'])
    .optional()
    .describe('Filter by type: customer or supplier'),
  city: z.string().optional().describe('Filter by city'),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('Page number (default: 1)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(25)
    .describe('Results per page (1-25, default: 25)'),
});

const GetContactSchema = z.object({
  id: z.string().describe('Contact ID'),
  include_invoices: z
    .boolean()
    .default(false)
    .describe('Include recent invoices in response'),
});

const CreateContactSchema = z.object({
  name: z.string().min(1).describe('Contact name (required)'),
  account_type: z
    .enum(['customer', 'supplier'])
    .describe('Type: customer or supplier (required)'),
  email: z.string().email().optional().describe('Email address'),
  phone: z.string().optional().describe('Phone number'),
  tax_number: z.string().optional().describe('Tax number (Vergi No)'),
  tax_office: z.string().optional().describe('Tax office (Vergi Dairesi)'),
  city: z.string().optional().describe('City'),
  district: z.string().optional().describe('District'),
  address: z.string().optional().describe('Full address'),
});

const UpdateContactSchema = z.object({
  id: z.string().describe('Contact ID to update'),
  name: z.string().optional().describe('Updated name'),
  email: z.string().email().optional().describe('Updated email'),
  phone: z.string().optional().describe('Updated phone'),
  tax_number: z.string().optional().describe('Updated tax number'),
  tax_office: z.string().optional().describe('Updated tax office'),
  city: z.string().optional().describe('Updated city'),
  district: z.string().optional().describe('Updated district'),
  address: z.string().optional().describe('Updated address'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const contactTools: Tool[] = [
  {
    name: 'search_contacts',
    description: `
<usecase>
Search for customers or suppliers in your Paraşüt account.
Use when: Finding contacts by name, email, tax number, or filtering by type.
Do NOT use when: You already have the contact ID (use get_contact instead).
</usecase>

<instructions>
- query: Search term (name, email, or tax number)
- account_type: Must be "customer" or "supplier"
- city: Filter by city name
- page/limit: Pagination controls
</instructions>

<example>
search_contacts(query="Acme", account_type="customer")
search_contacts(query="11111111111", account_type="supplier")
</example>

<returns>
List of contacts with: id, name, email, tax_number, account_type, balance.
Use the ID to call get_contact for full details or create_invoice for invoicing.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search by name, email, or tax number',
        },
        account_type: {
          type: 'string',
          enum: ['customer', 'supplier'],
          description: 'Filter by type. MUST be one of: customer, supplier',
        },
        city: {
          type: 'string',
          description: 'Filter by city',
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)',
          default: 1,
        },
        limit: {
          type: 'number',
          description: 'Results per page (1-25, default: 25)',
          default: 25,
        },
      },
    },
  },
  {
    name: 'get_contact',
    description: `
<usecase>
Get detailed information about a specific contact (customer or supplier).
Use when: You have a contact ID and need full details, balance, or related data.
Do NOT use when: You don't have the ID yet (use search_contacts first).
</usecase>

<instructions>
- id: The contact ID (required)
- include_invoices: Set to true to also get recent invoices
</instructions>

<example>
get_contact(id="12345")
get_contact(id="12345", include_invoices=true)
</example>

<returns>
Full contact details: id, name, account_type, email, phone, tax_number, tax_office,
city, district, address, balance (TRL/USD/EUR), created_at.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Contact ID',
        },
        include_invoices: {
          type: 'boolean',
          description: 'Include recent invoices in response',
          default: false,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_contact',
    description: `
<usecase>
Create a new customer or supplier in Paraşüt.
Use when: Adding a new contact for invoicing that doesn't exist yet.
Do NOT use when: Contact already exists (use search_contacts to check first).
</usecase>

<instructions>
- name: Contact name (required)
- account_type: Must be "customer" or "supplier" (required)
- Other fields are optional but recommended for invoicing
</instructions>

<example>
create_contact(name="Acme Corp", account_type="customer", email="info@acme.com")
create_contact(name="ABC Supplier", account_type="supplier", tax_number="1234567890")
</example>

<returns>
Created contact with: id, name, account_type, email, tax_number.
Use the returned ID for create_invoice.
</returns>

<notes>
- Tax number is required for official invoices in Turkey
- E-invoice contacts need valid tax number and tax office
</notes>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Contact name (required)',
        },
        account_type: {
          type: 'string',
          enum: ['customer', 'supplier'],
          description: 'Type. MUST be one of: customer, supplier (required)',
        },
        email: {
          type: 'string',
          description: 'Email address',
        },
        phone: {
          type: 'string',
          description: 'Phone number',
        },
        tax_number: {
          type: 'string',
          description: 'Tax number (Vergi No)',
        },
        tax_office: {
          type: 'string',
          description: 'Tax office (Vergi Dairesi)',
        },
        city: {
          type: 'string',
          description: 'City',
        },
        district: {
          type: 'string',
          description: 'District',
        },
        address: {
          type: 'string',
          description: 'Full address',
        },
      },
      required: ['name', 'account_type'],
    },
  },
  {
    name: 'update_contact',
    description: `
<usecase>
Update an existing contact's information.
Use when: Correcting or updating contact details for an existing contact.
Do NOT use when: Creating a new contact (use create_contact instead).
</usecase>

<instructions>
- id: Contact ID to update (required)
- Only provide fields you want to change
</instructions>

<example>
update_contact(id="12345", email="new@email.com")
update_contact(id="12345", city="Istanbul", address="New address")
</example>

<returns>
Updated contact with: id, name, email, and list of updated_fields.
</returns>
    `.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Contact ID to update',
        },
        name: {
          type: 'string',
          description: 'Updated name',
        },
        email: {
          type: 'string',
          description: 'Updated email',
        },
        phone: {
          type: 'string',
          description: 'Updated phone',
        },
        tax_number: {
          type: 'string',
          description: 'Updated tax number',
        },
        tax_office: {
          type: 'string',
          description: 'Updated tax office',
        },
        city: {
          type: 'string',
          description: 'Updated city',
        },
        district: {
          type: 'string',
          description: 'Updated district',
        },
        address: {
          type: 'string',
          description: 'Updated address',
        },
      },
      required: ['id'],
    },
  },
];

// ============================================================================
// Handlers
// ============================================================================

export async function handleSearchContacts(
  args: unknown
): Promise<ToolResponse> {
  try {
    const params = SearchContactsSchema.parse(args);
    const client = getClient();

    const filter: Record<string, string> = {};
    if (params.query) filter['name'] = params.query;
    if (params.account_type) filter['account_type'] = params.account_type;
    if (params.city) filter['city'] = params.city;

    const response = await client.contacts.list({
      filter,
      page: { number: params.page, size: params.limit },
    });

    return formatList(response.data, {
      totalCount: response.meta.total_count,
      currentPage: response.meta.current_page,
      totalPages: response.meta.total_pages,
    }, {
      itemFormatter: formatContactSummary,
      nextSteps: [
        {
          action: 'Get contact details',
          example: 'get_contact(id="<contact_id>")',
        },
        {
          action: 'Create invoice for contact',
          example: 'create_invoice(contact_id="<contact_id>", ...)',
        },
      ],
    });
  } catch (error) {
    return handleError(error, {
      operation: 'Search contacts',
      resourceType: 'Contact',
    });
  }
}

export async function handleGetContact(args: unknown): Promise<ToolResponse> {
  try {
    const params = GetContactSchema.parse(args);
    const client = getClient();

    const include: string[] = ['category', 'contact_portal'];
    if (params.include_invoices) {
      include.push('contact_people');
    }

    const response = await client.contacts.get(params.id, { include });

    if (!response.data) {
      return formatNotFound('Contact', params.id, [
        {
          action: 'Search for the contact',
          example: 'search_contacts(query="<name or tax number>")',
        },
      ]);
    }

    const contact = response.data;
    const attr = contact.attributes;

    // Build context response
    const contextData = {
      id: contact.id,
      name: attr.name,
      account_type: attr.account_type,
      email: attr.email,
      phone: attr.phone,
      tax_number: attr.tax_number,
      tax_office: attr.tax_office,
      city: attr.city,
      district: attr.district,
      address: attr.address,
      balance: attr.balance,
      trl_balance: attr.trl_balance,
      usd_balance: attr.usd_balance,
      eur_balance: attr.eur_balance,
      created_at: attr.created_at,
    };

    return formatSuccess(contextData, {
      summary: `Found contact: ${attr.name}`,
      nextSteps: [
        {
          action: 'Create invoice',
          example: `create_invoice(contact_id="${contact.id}", ...)`,
        },
        {
          action: 'Search invoices for this contact',
          example: `search_invoices(contact_id="${contact.id}")`,
        },
        {
          action: 'Check if e-invoice user',
          example: `check_einvoice_inbox(tax_number="${attr.tax_number ?? ''}")`,
        },
      ],
    });
  } catch (error) {
    return handleError(error, {
      operation: 'Get contact',
      resourceType: 'Contact',
      suggestions: [
        {
          action: 'Search for contacts',
          example: 'search_contacts(query="...")',
        },
      ],
    });
  }
}

export async function handleCreateContact(
  args: unknown
): Promise<ToolResponse> {
  try {
    const params = CreateContactSchema.parse(args);
    const client = getClient();

    const response = await client.contacts.create({
      data: {
        type: 'contacts',
        attributes: {
          name: params.name,
          account_type: params.account_type,
          ...(params.email !== undefined && { email: params.email }),
          ...(params.phone !== undefined && { phone: params.phone }),
          ...(params.tax_number !== undefined && { tax_number: params.tax_number }),
          ...(params.tax_office !== undefined && { tax_office: params.tax_office }),
          ...(params.city !== undefined && { city: params.city }),
          ...(params.district !== undefined && { district: params.district }),
          ...(params.address !== undefined && { address: params.address }),
        },
      },
    });

    const contact = response.data;

    return formatCreated('Contact', {
      id: contact.id,
      name: contact.attributes.name,
      account_type: contact.attributes.account_type,
      email: contact.attributes.email,
      tax_number: contact.attributes.tax_number,
    }, [
      {
        action: 'Create invoice for this contact',
        example: `create_invoice(contact_id="${contact.id}", ...)`,
      },
      {
        action: 'View contact details',
        example: `get_contact(id="${contact.id}")`,
      },
    ]);
  } catch (error) {
    return handleError(error, {
      operation: 'Create contact',
      resourceType: 'Contact',
    });
  }
}

export async function handleUpdateContact(
  args: unknown
): Promise<ToolResponse> {
  try {
    const params = UpdateContactSchema.parse(args);
    const client = getClient();

    // Build attributes object with only provided fields
    const attributes: Record<string, string | undefined> = {};
    if (params.name !== undefined) attributes['name'] = params.name;
    if (params.email !== undefined) attributes['email'] = params.email;
    if (params.phone !== undefined) attributes['phone'] = params.phone;
    if (params.tax_number !== undefined) attributes['tax_number'] = params.tax_number;
    if (params.tax_office !== undefined) attributes['tax_office'] = params.tax_office;
    if (params.city !== undefined) attributes['city'] = params.city;
    if (params.district !== undefined) attributes['district'] = params.district;
    if (params.address !== undefined) attributes['address'] = params.address;

    const response = await client.contacts.update(params.id, {
      data: {
        id: params.id,
        type: 'contacts',
        attributes,
      },
    });

    const contact = response.data;

    return formatSuccess({
      id: contact.id,
      name: contact.attributes.name,
      email: contact.attributes.email,
      updated_fields: Object.keys(attributes),
    }, {
      summary: `Contact updated: ${contact.attributes.name}`,
      nextSteps: [
        {
          action: 'View updated contact',
          example: `get_contact(id="${contact.id}")`,
        },
      ],
    });
  } catch (error) {
    return handleError(error, {
      operation: 'Update contact',
      resourceType: 'Contact',
      suggestions: [
        {
          action: 'Get current contact data',
          example: `get_contact(id="<id>")`,
        },
      ],
    });
  }
}
