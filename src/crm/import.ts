import { parse } from 'csv-parse';
import { z } from 'zod';
import { contactService, createContactSchema } from './contacts';
import { logger } from '../index';
import type { ContactRole } from '../whatsapp/types';

/** Expected CSV columns */
const csvRowSchema = z.object({
  phone: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['tenant', 'landlord', 'agent', 'contractor']).default('tenant'),
  property_id: z.string().optional(),
  unit_id: z.string().optional(),
  tags: z.string().optional(), // Comma-separated tags
});

export interface ImportResult {
  total: number;
  created: number;
  failed: number;
  errors: Array<{ row: number; phone: string; error: string }>;
}

/**
 * Import contacts from CSV data.
 * Expects columns: phone, name, role, property_id, unit_id, tags
 *
 * POPIA Note: Contacts are imported with opted_in=false.
 * An opt-in message must be sent before any marketing communications.
 */
export async function importContactsFromCSV(
  csvData: string | Buffer,
  agencyId: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    total: 0,
    created: 0,
    failed: 0,
    errors: [],
  };

  return new Promise((resolve, reject) => {
    const parser = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM
    });

    const rows: Array<Record<string, string>> = [];

    parser.on('data', (row) => {
      rows.push(row);
    });

    parser.on('error', (error) => {
      reject(new Error(`CSV parsing error: ${error.message}`));
    });

    parser.on('end', async () => {
      result.total = rows.length;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2 for 1-indexed + header row

        try {
          const parsed = csvRowSchema.parse(row);
          const tags = parsed.tags
            ? parsed.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : [];

          await contactService.create({
            phone: parsed.phone,
            name: parsed.name,
            role: parsed.role as ContactRole,
            agency_id: agencyId,
            property_id: parsed.property_id || undefined,
            unit_id: parsed.unit_id || undefined,
            tags,
          });

          result.created++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            row: rowNum,
            phone: row.phone ?? 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          logger.warn(
            { row: rowNum, phone: row.phone, error },
            'Failed to import contact',
          );
        }
      }

      logger.info(
        { total: result.total, created: result.created, failed: result.failed },
        'CSV import completed',
      );
      resolve(result);
    });
  });
}
