import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpTransport } from '../../client/HttpTransport.js';
import { SalesInvoicesResource } from '../salesInvoices.js';
import { EInvoicesResource } from '../eInvoices.js';
import { ContactsResource } from '../contacts.js';

describe('Resource HTTP Methods and Payload Normalization', () => {
  let mockTransport: HttpTransport;

  beforeEach(() => {
    mockTransport = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as HttpTransport;
  });

  describe('BaseResource update HTTP method', () => {
    it('uses PUT instead of PATCH for update()', async () => {
      const contacts = new ContactsResource({ transport: mockTransport, companyId: 12345 });
      vi.mocked(mockTransport.put).mockResolvedValue({
        data: { id: 'contact-1', type: 'contacts', attributes: { name: 'Acme Updated' } },
      } as any);

      await contacts.update('contact-1', {
        data: {
          id: 'contact-1',
          type: 'contacts',
          attributes: { name: 'Acme Updated' },
        },
      });

      expect(mockTransport.put).toHaveBeenCalledTimes(1);
      expect(mockTransport.patch).toHaveBeenCalledTimes(0);
      expect(mockTransport.put).toHaveBeenCalledWith(
        '/12345/contacts/contact-1',
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'contact-1',
            type: 'contacts',
          }),
        })
      );
    });
  });

  describe('Lifecycle State Transitions', () => {
    it('uses PATCH for archive()', async () => {
      const invoices = new SalesInvoicesResource({ transport: mockTransport, companyId: 12345 });
      vi.mocked(mockTransport.patch).mockResolvedValue({
        data: { id: 'inv-1', type: 'sales_invoices', attributes: {} },
      } as any);

      await invoices.archive('inv-1');

      expect(mockTransport.patch).toHaveBeenCalledTimes(1);
      expect(mockTransport.post).toHaveBeenCalledTimes(0);
      expect(mockTransport.patch).toHaveBeenCalledWith('/12345/sales_invoices/inv-1/archive');
    });

    it('uses PATCH for unarchive()', async () => {
      const invoices = new SalesInvoicesResource({ transport: mockTransport, companyId: 12345 });
      vi.mocked(mockTransport.patch).mockResolvedValue({
        data: { id: 'inv-1', type: 'sales_invoices', attributes: {} },
      } as any);

      await invoices.unarchive('inv-1');

      expect(mockTransport.patch).toHaveBeenCalledTimes(1);
      expect(mockTransport.post).toHaveBeenCalledTimes(0);
      expect(mockTransport.patch).toHaveBeenCalledWith('/12345/sales_invoices/inv-1/unarchive');
    });
  });

  describe('e-Invoice Submission Relationship Normalization', () => {
    it('normalizes relationships.sales_invoice to relationships.invoice for e_invoices', async () => {
      const eInvoices = new EInvoicesResource({ transport: mockTransport, companyId: 12345 }, {} as any);
      vi.mocked(mockTransport.post).mockResolvedValue({
        data: { id: 'einv-1', type: 'e_invoices', attributes: {} },
      } as any);

      await eInvoices.create({
        data: {
          type: 'e_invoices',
          attributes: {
            scenario: 'commercial',
            to_who: 'taxpayer',
          },
          relationships: {
            sales_invoice: {
              data: { id: 'inv-99', type: 'sales_invoices' },
            },
          },
        } as any,
      });

      expect(mockTransport.post).toHaveBeenCalledTimes(1);
      const calls = vi.mocked(mockTransport.post).mock.calls;
      const firstCall = calls[0];
      expect(firstCall).toBeDefined();
      const postPayload = (firstCall as unknown[])[1] as any;
      expect(postPayload.data.relationships.invoice).toEqual({
        data: { id: 'inv-99', type: 'sales_invoices' },
      });
      expect(postPayload.data.relationships.sales_invoice).toBeUndefined();
    });
  });
});
