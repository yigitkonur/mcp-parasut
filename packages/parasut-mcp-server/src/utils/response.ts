/**
 * Response Formatting Utilities
 *
 * Formats tool responses with guided next steps.
 * Every response should help the LLM understand what to do next.
 */

export interface ToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;  // Index signature for CallToolResult compatibility
}

export interface NextStep {
  action: string;
  example?: string;
}

export interface FormatOptions {
  summary?: string;
  nextSteps?: NextStep[];
  notes?: string[];
}

/**
 * Formats a successful tool response with data and guidance.
 */
export function formatSuccess<T>(
  data: T,
  options: FormatOptions = {}
): ToolResponse {
  const parts: string[] = [];

  // Success indicator + summary
  if (options.summary) {
    parts.push(`✓ ${options.summary}\n`);
  }

  // Data (formatted JSON)
  parts.push(JSON.stringify(data, null, 2));

  // Next steps
  if (options.nextSteps?.length) {
    parts.push('\n\nNext steps:');
    for (const step of options.nextSteps) {
      if (step.example) {
        parts.push(`- ${step.action}: ${step.example}`);
      } else {
        parts.push(`- ${step.action}`);
      }
    }
  }

  // Notes
  if (options.notes?.length) {
    parts.push('\n\nNotes:');
    for (const note of options.notes) {
      parts.push(`- ${note}`);
    }
  }

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}

/**
 * Formats a list response with pagination info.
 */
export function formatList<T>(
  items: T[],
  meta: { totalCount: number; currentPage: number; totalPages: number },
  options: FormatOptions & { itemFormatter?: (item: T) => string; pageSize?: number } = {}
): ToolResponse {
  const parts: string[] = [];

  // Summary
  const showing = items.length;
  const total = meta.totalCount;
  parts.push(
    `✓ Found ${total} item(s), showing ${showing} (page ${meta.currentPage}/${meta.totalPages})\n`
  );

  // Items
  if (items.length === 0) {
    parts.push('No items found.');
  } else if (options.itemFormatter) {
    parts.push(items.map(options.itemFormatter).join('\n'));
  } else {
    parts.push(JSON.stringify(items, null, 2));
  }

  // Enhanced pagination hints
  if (meta.currentPage < meta.totalPages) {
    const pageSize = options.pageSize ?? showing;
    const remaining = meta.totalCount - (meta.currentPage * pageSize);
    parts.push(`\n📄 Showing ${showing} of ${meta.totalCount} (${remaining} more available)`);
    parts.push(`More results: use page=${meta.currentPage + 1}`);
  }

  // Next steps
  if (options.nextSteps?.length) {
    parts.push('\n\nNext steps:');
    for (const step of options.nextSteps) {
      if (step.example) {
        parts.push(`- ${step.action}: ${step.example}`);
      } else {
        parts.push(`- ${step.action}`);
      }
    }
  }

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}

/**
 * Formats a "not found" response with suggestions.
 */
export function formatNotFound(
  resourceType: string,
  identifier: string,
  suggestions: NextStep[] = []
): ToolResponse {
  const parts: string[] = [];

  parts.push(`⚠ ${resourceType} not found: "${identifier}"\n`);
  parts.push('Possible causes:');
  parts.push('- The ID may be incorrect or misspelled');
  parts.push('- The resource may have been deleted');
  parts.push('- You may not have access to this resource');

  if (suggestions.length > 0) {
    parts.push('\n\nTry:');
    for (const step of suggestions) {
      if (step.example) {
        parts.push(`- ${step.action}: ${step.example}`);
      } else {
        parts.push(`- ${step.action}`);
      }
    }
  }

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
    isError: true,
  };
}

/**
 * Formats a created resource response.
 */
export function formatCreated<T extends { id?: string }>(
  resourceType: string,
  data: T,
  nextSteps: NextStep[] = []
): ToolResponse {
  const parts: string[] = [];

  parts.push(`✓ ${resourceType} created successfully.\n`);
  parts.push('Details:');
  parts.push(JSON.stringify(data, null, 2));

  if (nextSteps.length > 0) {
    parts.push('\n\nNext steps:');
    for (const step of nextSteps) {
      if (step.example) {
        parts.push(`- ${step.action}: ${step.example}`);
      } else {
        parts.push(`- ${step.action}`);
      }
    }
  }

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}

/**
 * Formats an action confirmation response (delete, cancel, etc.)
 */
export function formatActionConfirmation(
  action: string,
  resourceType: string,
  id: string,
  additionalInfo?: Record<string, unknown>
): ToolResponse {
  const parts: string[] = [];

  parts.push(`✓ ${action} completed for ${resourceType} (ID: ${id})`);

  if (additionalInfo) {
    parts.push('\n\nDetails:');
    parts.push(JSON.stringify(additionalInfo, null, 2));
  }

  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}

/**
 * Formats contact information in a human-readable way.
 */
export function formatContactSummary(contact: {
  id?: string;
  attributes?: {
    name?: string;
    email?: string;
    tax_number?: string;
    account_type?: string;
    balance?: string | number;
  };
}): string {
  const attr = contact.attributes ?? {};
  const parts = [
    `- ${attr.name ?? 'Unknown'} (ID: ${contact.id ?? 'N/A'})`,
  ];

  if (attr.email) parts.push(`  Email: ${attr.email}`);
  if (attr.tax_number) parts.push(`  Tax Number: ${attr.tax_number}`);
  if (attr.account_type) parts.push(`  Type: ${attr.account_type}`);
  if (attr.balance !== undefined) parts.push(`  Balance: ${attr.balance} TRY`);

  return parts.join('\n');
}

/**
 * Formats invoice information in a human-readable way.
 */
export function formatInvoiceSummary(invoice: {
  id?: string;
  attributes?: {
    issue_date?: string;
    invoice_no?: string | number;
    net_total?: string | number;
    remaining?: string | number;
    invoice_status?: string;
    payment_status?: string;
    status?: string;
  };
}): string {
  const attr = invoice.attributes ?? {};
  const invNo = attr.invoice_no ? `#${attr.invoice_no} ` : '';
  const parts = [
    `- Invoice ${invNo}(ID: ${invoice.id ?? 'N/A'})`.replace(/\s+/g, ' '),
    `  Date: ${attr.issue_date ?? 'N/A'}`,
    `  Total: ${attr.net_total ?? '0'} TRY`,
    `  Remaining: ${attr.remaining ?? '0'} TRY`,
    `  Status: ${attr.payment_status ?? attr.invoice_status ?? attr.status ?? 'unknown'}`,
  ];

  return parts.join('\n');
}

/**
 * Formats product information in a human-readable way.
 */
export function formatProductSummary(product: {
  id?: string;
  attributes?: {
    name?: string;
    code?: string;
    list_price?: string | number;
    currency?: string;
    stock_count?: number;
    inventory_tracking?: boolean;
  };
}): string {
  const attr = product.attributes ?? {};
  const parts = [
    `- ${attr.name ?? 'Unknown'} (ID: ${product.id ?? 'N/A'})`,
  ];

  if (attr.code) parts.push(`  Code: ${attr.code}`);
  if (attr.list_price !== undefined) parts.push(`  Price: ${attr.list_price} ${attr.currency ?? 'TRY'}`);
  if (attr.stock_count !== undefined) parts.push(`  Stock: ${attr.stock_count}`);

  return parts.join('\n');
}
