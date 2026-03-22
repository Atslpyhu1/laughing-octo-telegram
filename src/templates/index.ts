import { noticeTemplates } from './notices';
import { paymentTemplates } from './payments';
import { screeningTemplates } from './screening';
import { generalTemplates } from './general';

/**
 * Represents a WhatsApp message template as registered with Meta.
 */
export interface MessageTemplate {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  components: TemplateDefinitionComponent[];
  /** Variable names that must be provided when sending */
  variables: string[];
}

export interface TemplateDefinitionComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

/**
 * Complete registry of all ProPassure WhatsApp templates.
 */
export const templateRegistry: Record<string, MessageTemplate> = {
  ...noticeTemplates,
  ...paymentTemplates,
  ...screeningTemplates,
  ...generalTemplates,
};

/**
 * Get a template by name.
 */
export function getTemplate(name: string): MessageTemplate | undefined {
  return templateRegistry[name];
}

/**
 * Interpolate template body text with provided variables.
 * Replaces {{1}}, {{2}}, etc. with the corresponding values.
 */
export function interpolateTemplate(
  templateText: string,
  variables: Record<string, string>,
  variableNames: string[],
): string {
  let result = templateText;
  variableNames.forEach((varName, index) => {
    const placeholder = `{{${index + 1}}}`;
    result = result.replace(placeholder, variables[varName] ?? placeholder);
  });
  return result;
}

/**
 * Build WhatsApp API template components from variable values.
 */
export function buildTemplateComponents(
  template: MessageTemplate,
  variables: Record<string, string>,
) {
  const components: Array<{
    type: 'header' | 'body';
    parameters: Array<{ type: 'text'; text: string }>;
  }> = [];

  // Check if header has variables
  const headerComponent = template.components.find((c) => c.type === 'HEADER');
  if (headerComponent?.text?.includes('{{')) {
    const headerVarCount = (headerComponent.text.match(/\{\{/g) || []).length;
    const headerParams = template.variables.slice(0, headerVarCount).map((v) => ({
      type: 'text' as const,
      text: variables[v] ?? '',
    }));
    components.push({ type: 'header', parameters: headerParams });
  }

  // Body variables
  const bodyComponent = template.components.find((c) => c.type === 'BODY');
  if (bodyComponent?.text?.includes('{{')) {
    const bodyVarCount = (bodyComponent.text.match(/\{\{/g) || []).length;
    const headerVarCount =
      headerComponent?.text?.includes('{{')
        ? (headerComponent.text.match(/\{\{/g) || []).length
        : 0;
    const bodyVarNames = template.variables.slice(headerVarCount, headerVarCount + bodyVarCount);
    const bodyParams = bodyVarNames.map((v) => ({
      type: 'text' as const,
      text: variables[v] ?? '',
    }));
    components.push({ type: 'body', parameters: bodyParams });
  }

  return components;
}
