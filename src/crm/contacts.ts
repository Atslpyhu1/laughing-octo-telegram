import { z } from 'zod';
import { getSupabaseClient } from '../db/client';
import type { DBContact, ContactRole } from '../whatsapp/types';
import { logger } from '../index';

/** Validation schema for creating a contact */
export const createContactSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format. Use international format, e.g. +27821234567'),
  name: z.string().min(1).max(200),
  role: z.enum(['tenant', 'landlord', 'agent', 'contractor']),
  agency_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

/** Validation schema for updating a contact */
export const updateContactSchema = createContactSchema.partial().omit({ agency_id: true });

/** Validation schema for listing contacts */
export const listContactsSchema = z.object({
  agency_id: z.string().uuid(),
  role: z.enum(['tenant', 'landlord', 'agent', 'contractor']).optional(),
  tags: z.array(z.string()).optional(),
  opted_in: z.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsInput = z.infer<typeof listContactsSchema>;

/**
 * Contact management service for the CRM.
 * All operations are scoped to an agency_id for multi-tenancy.
 */
export class ContactService {
  private supabase = getSupabaseClient();

  /**
   * Create a new contact.
   */
  async create(input: CreateContactInput): Promise<DBContact> {
    // Normalize phone to E.164 format
    const phone = input.phone.startsWith('+') ? input.phone : `+${input.phone}`;
    const waId = phone.replace('+', '');

    const { data, error } = await this.supabase
      .from('whatsapp_contacts')
      .insert({
        phone,
        wa_id: waId,
        name: input.name,
        role: input.role,
        agency_id: input.agency_id,
        property_id: input.property_id,
        unit_id: input.unit_id,
        tags: input.tags,
        metadata: input.metadata,
        opted_in: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to create contact');
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return data as DBContact;
  }

  /**
   * Get a contact by ID.
   */
  async getById(id: string, agencyId: string): Promise<DBContact | null> {
    const { data, error } = await this.supabase
      .from('whatsapp_contacts')
      .select()
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get contact: ${error.message}`);
    }

    return data as DBContact;
  }

  /**
   * Get a contact by WhatsApp ID (phone number).
   */
  async getByWaId(waId: string): Promise<DBContact | null> {
    const { data, error } = await this.supabase
      .from('whatsapp_contacts')
      .select()
      .eq('wa_id', waId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get contact: ${error.message}`);
    }

    return data as DBContact;
  }

  /**
   * Update a contact.
   */
  async update(id: string, agencyId: string, input: UpdateContactInput): Promise<DBContact> {
    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    // Normalize phone if provided
    if (input.phone) {
      updateData.phone = input.phone.startsWith('+') ? input.phone : `+${input.phone}`;
      updateData.wa_id = (updateData.phone as string).replace('+', '');
    }

    const { data, error } = await this.supabase
      .from('whatsapp_contacts')
      .update(updateData)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return data as DBContact;
  }

  /**
   * Delete a contact (soft delete via opt-out).
   */
  async delete(id: string, agencyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('whatsapp_contacts')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) {
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
  }

  /**
   * List contacts with filtering and pagination.
   */
  async list(input: ListContactsInput): Promise<{ contacts: DBContact[]; total: number }> {
    let query = this.supabase
      .from('whatsapp_contacts')
      .select('*', { count: 'exact' })
      .eq('agency_id', input.agency_id);

    if (input.role) {
      query = query.eq('role', input.role);
    }

    if (input.opted_in !== undefined) {
      query = query.eq('opted_in', input.opted_in);
    }

    if (input.tags && input.tags.length > 0) {
      query = query.contains('tags', input.tags);
    }

    if (input.search) {
      query = query.or(`name.ilike.%${input.search}%,phone.ilike.%${input.search}%`);
    }

    const offset = (input.page - 1) * input.limit;
    query = query.range(offset, offset + input.limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list contacts: ${error.message}`);
    }

    return {
      contacts: (data ?? []) as DBContact[],
      total: count ?? 0,
    };
  }

  /**
   * Record opt-in for a contact (POPIA compliance).
   */
  async recordOptIn(id: string, agencyId: string): Promise<void> {
    await this.supabase
      .from('whatsapp_contacts')
      .update({
        opted_in: true,
        opted_in_at: new Date().toISOString(),
        opted_out_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('agency_id', agencyId);
  }

  /**
   * Record opt-out for a contact (POPIA compliance).
   */
  async recordOptOut(id: string, agencyId: string): Promise<void> {
    await this.supabase
      .from('whatsapp_contacts')
      .update({
        opted_in: false,
        opted_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('agency_id', agencyId);
  }

  /**
   * Add tags to a contact.
   */
  async addTags(id: string, agencyId: string, tags: string[]): Promise<DBContact> {
    const contact = await this.getById(id, agencyId);
    if (!contact) throw new Error('Contact not found');

    const mergedTags = [...new Set([...contact.tags, ...tags])];

    return this.update(id, agencyId, { tags: mergedTags });
  }

  /**
   * Remove tags from a contact.
   */
  async removeTags(id: string, agencyId: string, tags: string[]): Promise<DBContact> {
    const contact = await this.getById(id, agencyId);
    if (!contact) throw new Error('Contact not found');

    const filteredTags = contact.tags.filter((t) => !tags.includes(t));

    return this.update(id, agencyId, { tags: filteredTags });
  }
}

export const contactService = new ContactService();
