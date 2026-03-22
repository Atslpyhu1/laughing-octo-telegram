# ProPassure WhatsApp Communication Engine

WhatsApp-first tenant communication platform for South African property management. Handles pre-legal notices (Section 8, PIE Act), automated payment reminder flows, tenant screening, and POPIA-compliant contact management.

## Features

- **WhatsApp Business API Integration** — Send and receive messages via Meta Cloud API
- **Pre-Legal Notice Generation** — Section 8(1) 7-day, Section 8(1)(a) 20 business day, and PIE Act eviction notices with PDF generation
- **Automated Flows** — Payment reminders, tenant onboarding, screening intake, maintenance tracking
- **CRM** — Contact management, segmentation, tagging, CSV import, opt-in/opt-out (POPIA compliant)
- **SA Business Day Calculator** — Excludes weekends and all South African public holidays (2024-2026)
- **Multi-Tenant Architecture** — Row Level Security via Supabase for agency isolation
- **Rate Limiting** — Token-bucket rate limiter respecting WhatsApp's 80 msg/sec limit

## Tech Stack

- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Validation:** Zod
- **Queue:** BullMQ with Redis
- **PDF Generation:** PDFKit

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run migrate

# Development
npm run dev

# Production build
npm run build
npm start
```

## Environment Variables

See `.env.example` for all required configuration. Key variables:

| Variable | Description |
|----------|-------------|
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API access token |
| `WHATSAPP_VERIFY_TOKEN` | Custom token for webhook verification |
| `WHATSAPP_APP_SECRET` | Meta app secret for signature verification |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## API Endpoints

### Messaging
- `POST /api/send` — Send a text message
- `POST /api/send/template` — Send a template message
- `POST /api/send/bulk` — Bulk send with segmentation

### Conversations
- `GET /api/conversations` — List conversations
- `GET /api/conversations/:id` — Get conversation with messages
- `POST /api/conversations/:id/close` — Close a conversation
- `POST /api/conversations/:id/assign` — Assign to agent

### Pre-Legal Notices
- `POST /api/notices/section8-7day` — Generate and send Section 8(1) 7-day notice
- `POST /api/notices/section8-20day` — Generate and send Section 8(1)(a) 20 business day notice
- `POST /api/notices/pie-eviction` — Generate and send PIE Act eviction notice
- `GET /api/notices/:id/status` — Get delivery status
- `GET /api/notices/tenant/:tenantId` — Get all notices for a tenant
- `GET /api/notices/tenant/:tenantId/evidence` — Generate evidence report

### Contacts
- `POST /api/contacts` — Create contact
- `GET /api/contacts` — List contacts
- `GET /api/contacts/:id` — Get contact
- `PUT /api/contacts/:id` — Update contact
- `DELETE /api/contacts/:id` — Delete contact
- `POST /api/contacts/:id/opt-in` — Record POPIA opt-in
- `POST /api/contacts/:id/opt-out` — Record POPIA opt-out
- `POST /api/contacts/import` — CSV import

### Automated Flows
- `POST /api/flows/:flowId/trigger` — Trigger a flow
- `POST /api/flows/executions/:id/resume` — Resume paused flow
- `GET /api/flows` — List flows
- `GET /api/flows/executions/:id` — Get execution status

### Templates
- `GET /api/templates` — List all templates
- `GET /api/templates/:name` — Get template details

### Webhook
- `GET /webhook` — Meta verification endpoint
- `POST /webhook` — Receive messages and status updates

## Legal Notice Templates

All notice templates use legally accurate South African language:

- **Section 8(1) Rental Housing Act** — 7 calendar day breach notice for non-payment
- **Section 14(2)(b) Consumer Protection Act** — 20 business day notice (read with Section 8(1)(a) RHA)
- **PIE Act Section 4** — Eviction notice with tenant rights information and Legal Aid SA details

## Docker

```bash
docker build -t propassure-whatsapp .
docker run -p 3000:3000 --env-file .env propassure-whatsapp
```

## Testing

```bash
npm test
```

## License

See LICENSE file.
