import { z } from 'zod';
import { getSupabaseClient } from '../db/client';
import type { DBContact, ContactRole } from '../whatsapp/types';

/**
 * Segment definition for filtering contacts.
 */
export const segmentSchema = z.object({
  agency_id: z.string().uuid(),
  role: z.enum(['tenant', 'landlord', 'agent', 'contractor']).optional(),
  tags_include: z.array(z.string()).optional(),
  tags_exclude: z.array(z.string()).optional(),
  property_id: z.string().uuid().optional(),
  opted_in_only: z.boolean().default(true),
});

export type SegmentFilter = z.infer<typeof segmentSchema>;

/**
 * Contact segmentation service for targeted messaging.
 * Respects POPIA opt-in status by default.
 */
export class SegmentService {
  private supabase = getSupabaseClient();

  /**
   * Get contacts matching a segment filter.
   */
  async getSegmentContacts(filter: SegmentFilter): Promise<DBContact[]> {
    let query = this.supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('agency_id', filter.agency_id);

    if (filter.opted_in_only) {
      query = query.eq('opted_in', true);
    }

    if (filter.role) {
      query = query.eq('role', filter.role);
    }

    if (filter.property_id) {
      query = query.eq('property_id', filter.property_id);
    }

    if (filter.tags_include && filter.tags_include.length > 0) {
      query = query.contains('tags', filter.tags_include);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get segment contacts: ${error.message}`);
    }

    let contacts = (data ?? []) as DBContact[];

    // Post-filter for tag exclusion (Supabase doesn't support NOT contains natively)
    if (filter.tags_exclude && filter.tags_exclude.length > 0) {
      contacts = contacts.filter(
        (c) => !c.tags.some((tag) => filter.tags_exclude!.includes(tag)),
      );
    }

    return contacts;
  }

  /**
   * Count contacts matching a segment filter (useful for estimating bulk send size).
   */
  async countSegmentContacts(filter: SegmentFilter): Promise<number> {
    const contacts = await this.getSegmentContacts(filter);
    return contacts.length;
  }

  /**
   * Get pre-defined segments for common use cases.
   */
  getPreDefinedSegments(agencyId: string): Record<string, SegmentFilter> {
    return {
      all_tenants: {
        agency_id: agencyId,
        role: 'tenant',
        opted_in_only: true,
      },
      all_landlords: {
        agency_id: agencyId,
        role: 'landlord',
        opted_in_only: true,
      },
      overdue_tenants: {
        agency_id: agencyId,
        role: 'tenant',
        tags_include: ['payment_overdue'],
        opted_in_only: true,
      },
      new_tenants: {
        agency_id: agencyId,
        role: 'tenant',
        tags_include: ['new_tenant'],
        opted_in_only: true,
      },
      expiring_leases: {
        agency_id: agencyId,
        role: 'tenant',
        tags_include: ['lease_expiring'],
        opted_in_only: true,
      },
    };
  }
}

export const segmentService = new SegmentService();
