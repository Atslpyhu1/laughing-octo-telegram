import PDFDocument from 'pdfkit';
import { getSupabaseClient } from '../db/client';
import { config } from '../config';
import { logger } from '../index';
import type { NoticeType } from '../whatsapp/types';

export interface NoticeData {
  tenant_name: string;
  tenant_id_number?: string;
  property_address: string;
  unit_number: string;
  lease_date: string;
  amount_owed: number;
  arrears_period: string;
  compliance_deadline: string;
  account_holder: string;
  bank_name: string;
  account_number: string;
  payment_reference: string;
  landlord_name?: string;
  agent_name?: string;
  agent_company?: string;
}

export interface GeneratedNotice {
  pdfBuffer: Buffer;
  pdfUrl: string;
  noticeText: string;
}

/**
 * Generates PDF documents for legal notices.
 * All notices follow South African legal formatting requirements.
 */
export class NoticeGenerator {
  /**
   * Generate a PDF notice document.
   */
  async generatePDF(
    noticeType: NoticeType,
    data: NoticeData,
    agencyId: string,
  ): Promise<GeneratedNotice> {
    const noticeText = this.getNoticeText(noticeType, data);
    const pdfBuffer = await this.createPDF(noticeType, data, noticeText);
    const pdfUrl = await this.uploadPDF(pdfBuffer, noticeType, data, agencyId);

    return { pdfBuffer, pdfUrl, noticeText };
  }

  private getNoticeText(noticeType: NoticeType, data: NoticeData): string {
    switch (noticeType) {
      case 'section8_7day':
        return this.getSection8SevenDayText(data);
      case 'section8_20day':
        return this.getSection8TwentyDayText(data);
      case 'pie_eviction':
        return this.getPIEEvictionText(data);
      default:
        throw new Error(`Unknown notice type: ${noticeType}`);
    }
  }

  private getSection8SevenDayText(data: NoticeData): string {
    return [
      'NOTICE OF BREACH',
      'IN TERMS OF SECTION 8(1) OF THE RENTAL HOUSING ACT 50 OF 1999',
      '',
      `Date: ${new Date().toLocaleDateString('en-ZA')}`,
      '',
      `To: ${data.tenant_name}`,
      `Property: ${data.property_address}, Unit ${data.unit_number}`,
      `Lease Agreement dated: ${data.lease_date}`,
      '',
      'Dear Sir/Madam,',
      '',
      '1. You are hereby notified that you are in breach of the above lease agreement by reason of your failure to pay rental in terms thereof.',
      '',
      `2. The total outstanding rental amount is R${data.amount_owed.toFixed(2)} for the period ${data.arrears_period}.`,
      '',
      '3. In terms of Section 8(1) of the Rental Housing Act 50 of 1999, as amended, you are required to remedy this breach within 7 (seven) calendar days of receipt of this notice.',
      '',
      `4. The compliance deadline is ${data.compliance_deadline}.`,
      '',
      '5. Should you fail to remedy this breach within the stipulated period, the landlord shall be entitled to:',
      '   (a) Cancel the lease agreement; and',
      '   (b) Institute proceedings for your eviction in terms of the Prevention of Illegal Eviction from and Unlawful Occupation of Land Act 19 of 1998 (PIE Act).',
      '',
      '6. Payment must be made into the following account:',
      `   Account Holder: ${data.account_holder}`,
      `   Bank: ${data.bank_name}`,
      `   Account Number: ${data.account_number}`,
      `   Reference: ${data.payment_reference}`,
      '',
      '7. This notice is served without prejudice to any other rights the landlord may have in terms of the lease agreement or at law, including the right to claim damages and costs.',
      '',
      '8. Should you wish to dispute this notice, you are entitled to approach the Rental Housing Tribunal in your province.',
      '',
      'Yours faithfully,',
      '',
      data.agent_name ?? data.landlord_name ?? 'The Managing Agent',
      data.agent_company ?? '',
      'On behalf of the Landlord',
    ].join('\n');
  }

  private getSection8TwentyDayText(data: NoticeData): string {
    return [
      'NOTICE OF BREACH',
      'IN TERMS OF SECTION 14(2)(b)(i)(bb) OF THE CONSUMER PROTECTION ACT 68 OF 2008',
      'READ WITH SECTION 8(1)(a) OF THE RENTAL HOUSING ACT 50 OF 1999',
      '',
      `Date: ${new Date().toLocaleDateString('en-ZA')}`,
      '',
      `To: ${data.tenant_name}`,
      `Property: ${data.property_address}, Unit ${data.unit_number}`,
      `Lease Agreement dated: ${data.lease_date}`,
      '',
      'Dear Sir/Madam,',
      '',
      '1. NOTICE OF MATERIAL BREACH',
      '',
      'You are hereby placed on notice that you are in material breach of the above lease agreement as a result of your failure to pay rental as and when due.',
      '',
      `2. The total outstanding amount is R${data.amount_owed.toFixed(2)} for the period ${data.arrears_period}.`,
      '',
      '3. NOTICE PERIOD',
      '',
      'In terms of Section 14(2)(b)(i)(bb) of the Consumer Protection Act 68 of 2008, read with Regulation 5(1), you are hereby granted 20 (twenty) business days from the date of receipt of this notice to remedy the breach.',
      '',
      `4. The compliance deadline is ${data.compliance_deadline}.`,
      '',
      '5. CONSEQUENCES OF FAILURE TO COMPLY',
      '',
      'Should you fail to remedy the breach within the stipulated period:',
      '   (a) The landlord shall be entitled to cancel the lease agreement in terms of Section 14(2)(b)(i)(cc) of the Consumer Protection Act;',
      '   (b) The cancellation of the lease shall not extinguish your liability for any arrear rental, damages, or costs;',
      '   (c) The landlord shall thereafter be entitled to institute eviction proceedings in terms of the PIE Act.',
      '',
      '6. PAYMENT DETAILS',
      `   Account Holder: ${data.account_holder}`,
      `   Bank: ${data.bank_name}`,
      `   Account Number: ${data.account_number}`,
      `   Reference: ${data.payment_reference}`,
      '',
      '7. YOUR RIGHTS',
      '   You are entitled to:',
      '   (a) Remedy the breach within the notice period;',
      '   (b) Approach the Rental Housing Tribunal for dispute resolution;',
      '   (c) Seek legal advice or apply for legal aid (Legal Aid South Africa: 0800 110 110).',
      '',
      '8. This notice is served without prejudice to any other rights the landlord may have.',
      '',
      'Yours faithfully,',
      '',
      data.agent_name ?? data.landlord_name ?? 'The Managing Agent',
      data.agent_company ?? '',
      'On behalf of the Landlord',
    ].join('\n');
  }

  private getPIEEvictionText(data: NoticeData): string {
    return [
      'NOTICE OF INTENTION TO INSTITUTE EVICTION PROCEEDINGS',
      'IN TERMS OF SECTION 4 OF THE PREVENTION OF ILLEGAL EVICTION FROM',
      'AND UNLAWFUL OCCUPATION OF LAND ACT 19 OF 1998',
      '',
      `Date: ${new Date().toLocaleDateString('en-ZA')}`,
      '',
      `To: ${data.tenant_name}`,
      `Property: ${data.property_address}, Unit ${data.unit_number}`,
      '',
      'Dear Sir/Madam,',
      '',
      '1. NOTICE',
      '',
      'You are hereby notified that, having failed to remedy the breach of your lease agreement as set out in previous notices served upon you, the landlord intends to apply to the competent court for an order for your eviction from the above-mentioned premises.',
      '',
      '2. LEGAL BASIS',
      '',
      'This notice is served in terms of Section 4 of the Prevention of Illegal Eviction from and Unlawful Occupation of Land Act 19 of 1998 ("the PIE Act").',
      '',
      '3. YOUR RIGHTS',
      '',
      'In terms of Section 4(2) and 4(5) of the PIE Act, you are hereby advised that:',
      '',
      '   (a) You have the right to appear before the court on the date of the hearing and to oppose the eviction application;',
      '   (b) You have the right to legal representation;',
      '   (c) You may apply for legal aid from Legal Aid South Africa (toll-free: 0800 110 110, website: www.legal-aid.co.za);',
      '   (d) The court will consider all relevant circumstances before granting an eviction order, including:',
      '       (i) the rights and needs of the elderly, children, disabled persons and households headed by women;',
      '       (ii) whether alternative accommodation is available;',
      '       (iii) the duration of your occupation.',
      '',
      '4. IMPORTANT INFORMATION',
      '',
      'The court will not grant an eviction order unless it is satisfied that:',
      '   (a) The procedural requirements of the PIE Act have been complied with;',
      '   (b) It is just and equitable to grant such an order, having regard to all relevant circumstances.',
      '',
      '5. You are strongly advised to seek legal assistance immediately.',
      '',
      '6. This notice is served without prejudice to any other rights the landlord may have.',
      '',
      'Yours faithfully,',
      '',
      data.agent_name ?? data.landlord_name ?? 'The Managing Agent',
      data.agent_company ?? '',
      'On behalf of the Landlord',
    ].join('\n');
  }

  private async createPDF(
    noticeType: NoticeType,
    data: NoticeData,
    noticeText: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('CONFIDENTIAL — LEGAL NOTICE', { align: 'right' })
        .moveDown(0.5);

      doc
        .fontSize(8)
        .text(`Reference: ${data.payment_reference}`, { align: 'right' })
        .text(`Date: ${new Date().toLocaleDateString('en-ZA')}`, { align: 'right' })
        .moveDown(1);

      // Horizontal rule
      doc
        .moveTo(72, doc.y)
        .lineTo(523, doc.y)
        .stroke()
        .moveDown(0.5);

      // Title
      const titles: Record<string, string> = {
        section8_7day: 'NOTICE OF BREACH — Section 8(1) Rental Housing Act',
        section8_20day: 'NOTICE OF BREACH — Section 14(2)(b)(i)(bb) Consumer Protection Act',
        pie_eviction: 'NOTICE — PIE Act Eviction Proceedings',
      };

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(titles[noticeType] ?? 'LEGAL NOTICE', { align: 'center' })
        .moveDown(1);

      // Body
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(noticeText, {
          align: 'left',
          lineGap: 2,
        });

      // Footer
      doc
        .moveDown(2)
        .fontSize(8)
        .fillColor('#666666')
        .text(
          'This notice was generated by ProPassure Property Management. Delivery confirmation and read receipts are recorded for evidentiary purposes.',
          { align: 'center' },
        );

      doc.end();
    });
  }

  /**
   * Upload the generated PDF to Supabase Storage.
   */
  private async uploadPDF(
    pdfBuffer: Buffer,
    noticeType: NoticeType,
    data: NoticeData,
    agencyId: string,
  ): Promise<string> {
    const supabase = getSupabaseClient();
    const timestamp = Date.now();
    const sanitizedName = data.tenant_name.replace(/[^a-zA-Z0-9]/g, '_');
    const filePath = `${agencyId}/${noticeType}/${sanitizedName}_${timestamp}.pdf`;

    const { error } = await supabase.storage
      .from(config.STORAGE_BUCKET)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      logger.error({ error, filePath }, 'Failed to upload notice PDF');
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(config.STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }
}

export const noticeGenerator = new NoticeGenerator();
