/** WhatsApp Cloud API types */

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: InboundMessage[];
  statuses?: MessageStatus[];
  errors?: WebhookError[];
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface InboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: MessageType;
  text?: { body: string };
  image?: MediaMessage;
  document?: MediaMessage;
  location?: LocationMessage;
  interactive?: InteractiveResponse;
  button?: { text: string; payload: string };
  context?: { from: string; id: string };
}

export type MessageType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'sticker'
  | 'reaction'
  | 'unknown';

export interface MediaMessage {
  id: string;
  mime_type: string;
  sha256: string;
  caption?: string;
}

export interface LocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface InteractiveResponse {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface MessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: WebhookError[];
}

export interface WebhookError {
  code: number;
  title: string;
  message: string;
  error_data?: { details: string };
}

// Outbound message types

export interface SendTextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { preview_url?: boolean; body: string };
}

export interface SendTemplateMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename: string };
}

export interface SendInteractiveMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button' | 'list';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: InteractiveAction;
  };
}

export interface InteractiveAction {
  buttons?: Array<{ type: 'reply'; reply: { id: string; title: string } }>;
  button?: string;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface SendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export type OutboundMessage = SendTextMessage | SendTemplateMessage | SendInteractiveMessage;

// Database model types

export type ContactRole = 'tenant' | 'landlord' | 'agent' | 'contractor';
export type ConversationStatus = 'active' | 'closed' | 'pending_agent';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
export type NoticeType = 'section8_7day' | 'section8_20day' | 'pie_eviction';
export type TemplateStatus = 'approved' | 'pending' | 'rejected';
export type FlowStatus = 'active' | 'paused' | 'completed' | 'failed';

export interface DBContact {
  id: string;
  phone: string;
  wa_id: string;
  name: string;
  role: ContactRole;
  agency_id: string;
  property_id?: string;
  unit_id?: string;
  opted_in: boolean;
  opted_in_at?: string;
  opted_out_at?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DBConversation {
  id: string;
  contact_id: string;
  agency_id: string;
  status: ConversationStatus;
  assigned_to?: string;
  context: Record<string, unknown>;
  started_at: string;
  closed_at?: string;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  agency_id: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  template_name?: string;
  wa_message_id?: string;
  status: MessageDeliveryStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DBNoticeDelivery {
  id: string;
  notice_type: NoticeType;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  agency_id: string;
  delivered_via: 'whatsapp' | 'email' | 'both';
  delivered_at?: string;
  read_at?: string;
  legal_reference: string;
  pdf_url?: string;
  wa_message_id?: string;
  amount_owed?: number;
  deadline_date: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DBMessageTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  components: Record<string, unknown>;
  status: TemplateStatus;
  agency_id: string;
  created_at: string;
  updated_at: string;
}

export interface DBAutomatedFlow {
  id: string;
  name: string;
  trigger_type: string;
  steps: FlowStep[];
  agency_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlowStep {
  id: string;
  type: 'send_template' | 'send_text' | 'wait' | 'condition' | 'assign_agent';
  config: Record<string, unknown>;
  next_step_id?: string;
  on_failure_step_id?: string;
}

export interface DBFlowExecution {
  id: string;
  flow_id: string;
  contact_id: string;
  agency_id: string;
  current_step: string;
  status: FlowStatus;
  context: Record<string, unknown>;
  started_at: string;
  completed_at?: string;
}
