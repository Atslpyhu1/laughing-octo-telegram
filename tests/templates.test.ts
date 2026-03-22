import { templateRegistry, getTemplate, interpolateTemplate } from '../src/templates';

describe('Template Registry', () => {
  test('should have all required templates registered', () => {
    const requiredTemplates = [
      'section8_7day_notice',
      'section8_20day_notice',
      'payment_reminder',
      'payment_overdue',
      'lease_renewal',
      'screening_invite',
      'screening_result',
      'maintenance_update',
      'eviction_notice',
      'welcome_tenant',
    ];

    for (const name of requiredTemplates) {
      expect(templateRegistry[name]).toBeDefined();
      expect(templateRegistry[name].name).toBe(name);
      expect(templateRegistry[name].language).toBe('en_ZA');
    }
  });

  test('getTemplate should return template by name', () => {
    const template = getTemplate('payment_reminder');
    expect(template).toBeDefined();
    expect(template?.name).toBe('payment_reminder');
    expect(template?.category).toBe('UTILITY');
  });

  test('getTemplate should return undefined for unknown template', () => {
    expect(getTemplate('nonexistent_template')).toBeUndefined();
  });

  test('all templates should have en_ZA language', () => {
    for (const [name, template] of Object.entries(templateRegistry)) {
      expect(template.language).toBe('en_ZA');
    }
  });

  test('notice templates should contain proper legal references', () => {
    const s8_7day = getTemplate('section8_7day_notice')!;
    const bodyText = s8_7day.components.find((c) => c.type === 'BODY')?.text ?? '';
    expect(bodyText).toContain('Section 8(1)');
    expect(bodyText).toContain('Rental Housing Act');

    const s8_20day = getTemplate('section8_20day_notice')!;
    const bodyText20 = s8_20day.components.find((c) => c.type === 'BODY')?.text ?? '';
    expect(bodyText20).toContain('Consumer Protection Act');
    expect(bodyText20).toContain('Section 14(2)(b)');
  });

  test('templates should have variables defined', () => {
    for (const [name, template] of Object.entries(templateRegistry)) {
      expect(template.variables.length).toBeGreaterThan(0);
    }
  });
});

describe('Template Interpolation', () => {
  test('should replace numbered placeholders with values', () => {
    const text = 'Dear {{1}}, your balance is R{{2}}';
    const result = interpolateTemplate(text, {
      name: 'John',
      amount: '5000',
    }, ['name', 'amount']);
    expect(result).toBe('Dear John, your balance is R5000');
  });

  test('should leave placeholders when values are missing', () => {
    const text = 'Dear {{1}}, your balance is R{{2}}';
    const result = interpolateTemplate(text, {
      name: 'John',
    }, ['name', 'amount']);
    expect(result).toBe('Dear John, your balance is R{{2}}');
  });
});
