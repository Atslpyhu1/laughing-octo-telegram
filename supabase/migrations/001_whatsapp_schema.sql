-- ProPassure WhatsApp CRM Database Schema
-- Multi-tenant architecture with Row Level Security (RLS)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- WHATSAPP CONTACTS
-- ============================================================================
CREATE TABLE whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    wa_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'tenant'
        CHECK (role IN ('tenant', 'landlord', 'agent', 'contractor')),
    agency_id UUID NOT NULL,
    property_id UUID,
    unit_id UUID,
    opted_in BOOLEAN NOT NULL DEFAULT FALSE,
    opted_in_at TIMESTAMPTZ,
    opted_out_at TIMESTAMPTZ,
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_agency ON whatsapp_contacts(agency_id);
CREATE INDEX idx_contacts_wa_id ON whatsapp_contacts(wa_id);
CREATE INDEX idx_contacts_phone ON whatsapp_contacts(phone);
CREATE INDEX idx_contacts_role ON whatsapp_contacts(agency_id, role);
CREATE INDEX idx_contacts_property ON whatsapp_contacts(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_contacts_tags ON whatsapp_contacts USING GIN(tags);
CREATE INDEX idx_contacts_opted_in ON whatsapp_contacts(agency_id, opted_in) WHERE opted_in = TRUE;

-- ============================================================================
-- WHATSAPP CONVERSATIONS
-- ============================================================================
CREATE TABLE whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'pending_agent')),
    assigned_to VARCHAR(200),
    context JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_contact ON whatsapp_conversations(contact_id);
CREATE INDEX idx_conversations_agency ON whatsapp_conversations(agency_id);
CREATE INDEX idx_conversations_status ON whatsapp_conversations(agency_id, status);
CREATE INDEX idx_conversations_assigned ON whatsapp_conversations(assigned_to)
    WHERE assigned_to IS NOT NULL;

-- ============================================================================
-- WHATSAPP MESSAGES
-- ============================================================================
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
    agency_id UUID NOT NULL,
    direction VARCHAR(10) NOT NULL
        CHECK (direction IN ('inbound', 'outbound')),
    type VARCHAR(20) NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    template_name VARCHAR(100),
    wa_message_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX idx_messages_agency ON whatsapp_messages(agency_id);
CREATE INDEX idx_messages_wa_id ON whatsapp_messages(wa_message_id)
    WHERE wa_message_id IS NOT NULL;
CREATE INDEX idx_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_messages_created ON whatsapp_messages(created_at DESC);

-- ============================================================================
-- NOTICE DELIVERIES
-- ============================================================================
CREATE TABLE notice_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_type VARCHAR(30) NOT NULL
        CHECK (notice_type IN ('section8_7day', 'section8_20day', 'pie_eviction')),
    tenant_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
    property_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    agency_id UUID NOT NULL,
    delivered_via VARCHAR(10) NOT NULL DEFAULT 'whatsapp'
        CHECK (delivered_via IN ('whatsapp', 'email', 'both')),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    legal_reference TEXT NOT NULL,
    pdf_url TEXT,
    wa_message_id VARCHAR(100),
    amount_owed DECIMAL(12, 2),
    deadline_date DATE NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notices_tenant ON notice_deliveries(tenant_id);
CREATE INDEX idx_notices_agency ON notice_deliveries(agency_id);
CREATE INDEX idx_notices_property ON notice_deliveries(property_id);
CREATE INDEX idx_notices_type ON notice_deliveries(notice_type);
CREATE INDEX idx_notices_wa_id ON notice_deliveries(wa_message_id)
    WHERE wa_message_id IS NOT NULL;
CREATE INDEX idx_notices_deadline ON notice_deliveries(deadline_date);

-- ============================================================================
-- MESSAGE TEMPLATES
-- ============================================================================
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL
        CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
    language VARCHAR(10) NOT NULL DEFAULT 'en_ZA',
    components JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('approved', 'pending', 'rejected')),
    agency_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, agency_id)
);

CREATE INDEX idx_templates_agency ON message_templates(agency_id);
CREATE INDEX idx_templates_status ON message_templates(agency_id, status);

-- ============================================================================
-- AUTOMATED FLOWS
-- ============================================================================
CREATE TABLE automated_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    agency_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flows_agency ON automated_flows(agency_id);
CREATE INDEX idx_flows_trigger ON automated_flows(trigger_type);
CREATE INDEX idx_flows_active ON automated_flows(agency_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- FLOW EXECUTIONS
-- ============================================================================
CREATE TABLE flow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID NOT NULL REFERENCES automated_flows(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'failed')),
    context JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_executions_flow ON flow_executions(flow_id);
CREATE INDEX idx_executions_contact ON flow_executions(contact_id);
CREATE INDEX idx_executions_agency ON flow_executions(agency_id);
CREATE INDEX idx_executions_status ON flow_executions(status);
CREATE INDEX idx_executions_active ON flow_executions(contact_id, flow_id, status)
    WHERE status = 'active';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies: restrict access to rows belonging to the user's agency
-- The agency_id is passed via the x-agency-id custom header or JWT claim

CREATE POLICY "Agency isolation" ON whatsapp_contacts
    FOR ALL
    USING (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id')
    WITH CHECK (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id');

CREATE POLICY "Agency isolation" ON whatsapp_conversations
    FOR ALL
    USING (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id')
    WITH CHECK (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id');

CREATE POLICY "Agency isolation" ON whatsapp_messages
    FOR ALL
    USING (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id')
    WITH CHECK (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id');

CREATE POLICY "Agency isolation" ON notice_deliveries
    FOR ALL
    USING (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id')
    WITH CHECK (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id');

CREATE POLICY "Agency isolation" ON message_templates
    FOR ALL
    USING (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id')
    WITH CHECK (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id');

CREATE POLICY "Agency isolation" ON automated_flows
    FOR ALL
    USING (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id')
    WITH CHECK (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id');

CREATE POLICY "Agency isolation" ON flow_executions
    FOR ALL
    USING (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id')
    WITH CHECK (agency_id::text = current_setting('request.headers', true)::json->>'x-agency-id');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON whatsapp_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON whatsapp_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flows_updated_at
    BEFORE UPDATE ON automated_flows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
