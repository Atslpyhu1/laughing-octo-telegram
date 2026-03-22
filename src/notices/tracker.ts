import { getSupabaseClient } from '../db/client';
import { logger } from '../index';
import type { NoticeType, DBNoticeDelivery } from '../whatsapp/types';

export interface TrackNoticeInput {
  notice_type: NoticeType;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  agency_id: string;
  wa_message_id?: string;
  pdf_url?: string;
  amount_owed?: number;
  deadline_date: string;
  legal_reference: string;
}

/**
 * Tracks notice delivery, read receipts, and stores evidence
 * for legal proceedings. All timestamps are recorded for
 * evidentiary purposes in compliance with the Electronic
 * Communications and Transactions Act 25 of 2002.
 */
class NoticeTracker {
  private supabase = getSupabaseClient();

  /**
   * Record a notice delivery in the database.
   */
  async trackNotice(input: TrackNoticeInput): Promise<DBNoticeDelivery> {
    const { data, error } = await this.supabase
      .from('notice_deliveries')
      .insert({
        notice_type: input.notice_type,
        tenant_id: input.tenant_id,
        property_id: input.property_id,
        unit_id: input.unit_id,
        agency_id: input.agency_id,
        delivered_via: 'whatsapp',
        wa_message_id: input.wa_message_id,
        pdf_url: input.pdf_url,
        amount_owed: input.amount_owed,
        deadline_date: input.deadline_date,
        legal_reference: input.legal_reference,
        metadata: {
          generated_at: new Date().toISOString(),
          platform: 'propassure_whatsapp_engine',
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error({ error, input }, 'Failed to track notice delivery');
      throw new Error(`Failed to track notice: ${error.message}`);
    }

    return data as DBNoticeDelivery;
  }

  /**
   * Get delivery status for a specific notice.
   */
  async getDeliveryStatus(deliveryId: string, agencyId: string): Promise<DBNoticeDelivery | null> {
    const { data, error } = await this.supabase
      .from('notice_deliveries')
      .select()
      .eq('id', deliveryId)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get delivery status: ${error.message}`);
    }

    return data as DBNoticeDelivery;
  }

  /**
   * Get all notices for a tenant (for legal evidence trail).
   */
  async getTenantNotices(
    tenantId: string,
    agencyId: string,
  ): Promise<DBNoticeDelivery[]> {
    const { data, error } = await this.supabase
      .from('notice_deliveries')
      .select()
      .eq('tenant_id', tenantId)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get tenant notices: ${error.message}`);
    }

    return (data ?? []) as DBNoticeDelivery[];
  }

  /**
   * Get all notices for a property.
   */
  async getPropertyNotices(
    propertyId: string,
    agencyId: string,
  ): Promise<DBNoticeDelivery[]> {
    const { data, error } = await this.supabase
      .from('notice_deliveries')
      .select()
      .eq('property_id', propertyId)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get property notices: ${error.message}`);
    }

    return (data ?? []) as DBNoticeDelivery[];
  }

  /**
   * Generate an evidence report for a tenant's notice history.
   * Useful for court proceedings.
   */
  async generateEvidenceReport(
    tenantId: string,
    agencyId: string,
  ): Promise<{
    tenant_id: string;
    notices: Array<{
      type: NoticeType;
      delivered_at: string | undefined;
      read_at: string | undefined;
      legal_reference: string;
      pdf_url: string | undefined;
      deadline_date: string;
    }>;
    generated_at: string;
  }> {
    const notices = await this.getTenantNotices(tenantId, agencyId);

    return {
      tenant_id: tenantId,
      notices: notices.map((n) => ({
        type: n.notice_type,
        delivered_at: n.delivered_at,
        read_at: n.read_at,
        legal_reference: n.legal_reference,
        pdf_url: n.pdf_url,
        deadline_date: n.deadline_date,
      })),
      generated_at: new Date().toISOString(),
    };
  }
}

export const noticeTracker = new NoticeTracker();
