import type { InboundMessage } from '../whatsapp/types';
import type { ConversationState } from './manager';

export interface RouteResult {
  response?: string | {
    type: 'interactive';
    body: string;
    buttons: Array<{ id: string; title: string }>;
  };
  newState?: ConversationState;
  data?: Record<string, unknown>;
  escalate?: boolean;
  escalateReason?: string;
}

/**
 * Routes incoming messages to the appropriate handler based on
 * conversation state and message content.
 */
class MessageRouter {
  async route(
    message: InboundMessage,
    context: { state: ConversationState; data: Record<string, unknown> },
    contactId: string,
    _agencyId: string,
    _conversationId: string,
  ): Promise<RouteResult> {
    const text = this.extractText(message).toLowerCase().trim();

    // Handle interactive button replies
    const buttonReplyId = message.interactive?.button_reply?.id;
    if (buttonReplyId) {
      return this.handleButtonReply(buttonReplyId, context);
    }

    // Global commands — available regardless of state
    if (text === 'stop' || text === 'opt-out' || text === 'unsubscribe') {
      return {
        response: 'You have been unsubscribed. You will no longer receive messages from us. To re-subscribe, send "START".',
        newState: 'idle',
        data: { opted_out: true },
      };
    }

    if (text === 'start' || text === 'opt-in' || text === 'subscribe') {
      return {
        response: 'Welcome! You have been subscribed to ProPassure notifications. You can opt out at any time by sending "STOP".',
        newState: 'idle',
        data: { opted_out: false },
      };
    }

    if (text === 'agent' || text === 'human' || text === 'help') {
      return {
        response: 'Your message has been forwarded to an agent. Someone will respond shortly during business hours (Mon-Fri, 08:00-17:00 SAST).',
        escalate: true,
        escalateReason: 'Requested by tenant',
      };
    }

    // Route based on current conversation state
    switch (context.state) {
      case 'idle':
        return this.handleIdleState(text, contactId);
      case 'onboarding':
        return this.handleOnboardingState(text, context);
      case 'payment_collection':
        return this.handlePaymentState(text, context);
      case 'complaint_handling':
        return this.handleComplaintState(text, context);
      case 'maintenance_report':
        return this.handleMaintenanceState(text, context, message);
      case 'screening':
        return this.handleScreeningState(text, context);
      case 'awaiting_agent':
        return {
          response: 'An agent has been notified and will respond shortly. Thank you for your patience.',
        };
      default:
        return this.handleIdleState(text, contactId);
    }
  }

  private extractText(message: InboundMessage): string {
    return (
      message.text?.body ??
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      message.button?.text ??
      ''
    );
  }

  private handleButtonReply(
    buttonId: string,
    context: { state: ConversationState; data: Record<string, unknown> },
  ): RouteResult {
    switch (buttonId) {
      case 'arrange_payment':
      case 'payment_made':
        return {
          response: 'Thank you. Please provide your proof of payment (screenshot or reference number) and we will update your account.',
          newState: 'payment_collection',
        };

      case 'dispute_notice':
        return {
          response: 'Your dispute has been noted. An agent will contact you within 24 hours to discuss this matter. Please have your lease agreement and any supporting documents ready.',
          escalate: true,
          escalateReason: 'Tenant disputing notice',
        };

      case 'contact_agent':
        return {
          response: 'Your request has been forwarded to an agent. Someone will respond shortly during business hours (Mon-Fri, 08:00-17:00 SAST).',
          escalate: true,
          escalateReason: 'Tenant requested agent contact',
        };

      case 'need_extension':
      case 'request_arrangement':
        return {
          response: 'We understand. Please provide details of the payment arrangement you would like to propose (amount and dates). An agent will review and respond.',
          newState: 'payment_collection',
          data: { arrangement_requested: true },
        };

      case 'report_maintenance':
        return {
          response: 'Please describe the maintenance issue in detail. Include:\n1. What is the problem?\n2. Where in the unit is it located?\n3. How urgent is it? (Emergency / Urgent / Routine)',
          newState: 'maintenance_report',
        };

      case 'issue_resolved':
        return {
          response: 'Great to hear the issue has been resolved! Thank you for letting us know. The maintenance request will be closed.',
          newState: 'idle',
          data: { maintenance_resolved: true },
        };

      case 'still_an_issue':
        return {
          response: 'We apologise for the inconvenience. An agent has been notified and will follow up on your maintenance request.',
          escalate: true,
          escalateReason: 'Maintenance issue not resolved',
        };

      case 'renew_lease':
        return {
          response: 'Thank you for choosing to renew! An agent will prepare the renewal documentation and send it to you within 5 business days.',
          newState: 'idle',
          data: { lease_renewal_accepted: true },
        };

      case 'discuss_terms':
        return {
          response: 'An agent will contact you to discuss the lease renewal terms. Please indicate any specific concerns you may have.',
          escalate: true,
          escalateReason: 'Tenant wants to discuss lease renewal terms',
        };

      case 'not_renewing':
        return {
          response: 'We\'re sorry to see you go. Please note that in terms of the CPA, you are required to give 20 business days\' written notice. An agent will contact you regarding the move-out process.',
          escalate: true,
          escalateReason: 'Tenant not renewing lease',
        };

      case 'start_application':
        return {
          response: 'Please follow the application link sent previously to begin your screening application. If you need a new link, please reply with "NEW LINK".',
          newState: 'screening',
        };

      case 'request_legal_aid_info':
        return {
          response: 'Legal Aid South Africa provides free legal assistance to qualifying individuals.\n\nContact: 0800 110 110\nWebsite: www.legal-aid.co.za\n\nYou may also contact the Rental Housing Tribunal in your province for assistance with rental disputes.',
          newState: 'idle',
        };

      default:
        return {
          response: 'Thank you for your response. How can we assist you today?',
        };
    }
  }

  private handleIdleState(text: string, _contactId: string): RouteResult {
    // Detect intent from freeform text
    if (text.startsWith('maintenance') || text.includes('broken') || text.includes('leak') || text.includes('repair')) {
      return {
        response: 'Please describe the maintenance issue in detail. Include:\n1. What is the problem?\n2. Where in the unit is it located?\n3. How urgent is it? (Emergency / Urgent / Routine)',
        newState: 'maintenance_report',
      };
    }

    if (text.includes('payment') || text.includes('pay') || text.includes('rent') || text.includes('amount')) {
      return {
        response: {
          type: 'interactive',
          body: 'How can we help you with your payment?',
          buttons: [
            { id: 'payment_made', title: 'I\'ve Paid' },
            { id: 'need_extension', title: 'Need Extension' },
            { id: 'contact_agent', title: 'Contact Agent' },
          ],
        },
        newState: 'payment_collection',
      };
    }

    if (text.includes('complaint') || text.includes('unhappy') || text.includes('problem') || text.includes('issue')) {
      return {
        response: 'We\'re sorry to hear you\'re having an issue. Please describe your complaint and we will assist you.',
        newState: 'complaint_handling',
      };
    }

    if (text.includes('lease') || text.includes('contract') || text.includes('renew')) {
      return {
        response: 'For lease-related enquiries, an agent will assist you. Your request has been forwarded.',
        escalate: true,
        escalateReason: 'Lease enquiry',
      };
    }

    if (text === 'hi' || text === 'hello' || text === 'hey' || text === 'good morning' || text === 'good afternoon') {
      return {
        response: {
          type: 'interactive',
          body: 'Hello! Welcome to ProPassure. How can we assist you today?',
          buttons: [
            { id: 'report_maintenance', title: 'Maintenance' },
            { id: 'payment_made', title: 'Payment Query' },
            { id: 'contact_agent', title: 'Contact Agent' },
          ],
        },
      };
    }

    // Default: offer menu
    return {
      response: {
        type: 'interactive',
        body: 'Thank you for your message. Please select how we can help you:',
        buttons: [
          { id: 'report_maintenance', title: 'Maintenance' },
          { id: 'payment_made', title: 'Payment Query' },
          { id: 'contact_agent', title: 'Speak to Agent' },
        ],
      },
    };
  }

  private handleOnboardingState(
    text: string,
    context: { data: Record<string, unknown> },
  ): RouteResult {
    const step = (context.data.onboarding_step as number) ?? 0;

    switch (step) {
      case 0:
        return {
          response: 'Welcome to your new home! Let\'s get you set up. What is your full name as it appears on your lease?',
          data: { onboarding_step: 1 },
        };
      case 1:
        return {
          response: `Thank you, ${text}. Your profile has been updated. You will receive important notifications about your tenancy via this number.\n\nReply "STOP" at any time to opt out.`,
          newState: 'idle',
          data: { onboarding_step: 2, tenant_name: text },
        };
      default:
        return { newState: 'idle' };
    }
  }

  private handlePaymentState(
    text: string,
    _context: { data: Record<string, unknown> },
  ): RouteResult {
    if (text.includes('proof') || text.includes('reference') || text.includes('ref')) {
      return {
        response: 'Thank you. Your proof of payment has been recorded and will be verified by our accounts department. You will receive confirmation once processed.',
        newState: 'idle',
        data: { payment_proof_submitted: true },
      };
    }

    // If they provide what looks like a payment arrangement
    if (text.includes('r') && (text.includes('per month') || text.includes('on the'))) {
      return {
        response: 'Your proposed payment arrangement has been noted. An agent will review and respond within 2 business days.',
        escalate: true,
        escalateReason: 'Payment arrangement proposal',
        newState: 'awaiting_agent',
      };
    }

    return {
      response: 'Please provide your proof of payment (screenshot or reference number), or describe the payment arrangement you would like to propose.',
    };
  }

  private handleComplaintState(
    text: string,
    _context: { data: Record<string, unknown> },
  ): RouteResult {
    if (text.length > 10) {
      return {
        response: 'Thank you for providing details about your complaint. This has been logged and forwarded to the relevant department. You will receive a response within 48 hours.\n\nComplaint reference will be sent shortly.',
        escalate: true,
        escalateReason: `Tenant complaint: ${text.substring(0, 100)}`,
        newState: 'awaiting_agent',
        data: { complaint_text: text },
      };
    }

    return {
      response: 'Could you please provide more details about your complaint so we can assist you effectively?',
    };
  }

  private handleMaintenanceState(
    text: string,
    context: { data: Record<string, unknown> },
    message: InboundMessage,
  ): RouteResult {
    const step = (context.data.maintenance_step as number) ?? 0;

    if (step === 0) {
      // First message — the description
      const hasImage = message.type === 'image';
      return {
        response: hasImage
          ? 'Thank you for the photo. Your maintenance request has been logged. A contractor will be assigned and you will receive updates on the progress.'
          : 'Thank you. Your maintenance request has been logged.\n\nIf possible, please send a photo of the issue. Otherwise, reply "DONE" to submit.',
        newState: hasImage ? 'idle' : 'maintenance_report',
        data: {
          maintenance_step: 1,
          maintenance_description: text,
          maintenance_has_photo: hasImage,
        },
        ...(hasImage ? { escalate: true, escalateReason: `Maintenance request with photo: ${text}` } : {}),
      };
    }

    if (step === 1) {
      const isDone = text === 'done' || text === 'no photo' || message.type === 'image';
      if (isDone) {
        return {
          response: 'Your maintenance request has been submitted. You will receive a reference number and updates on the progress.',
          newState: 'idle',
          escalate: true,
          escalateReason: `Maintenance request: ${context.data.maintenance_description}`,
        };
      }

      return {
        response: 'Please send a photo of the issue or reply "DONE" to submit your request without a photo.',
      };
    }

    return { newState: 'idle' };
  }

  private handleScreeningState(
    text: string,
    _context: { data: Record<string, unknown> },
  ): RouteResult {
    if (text === 'new link' || text.includes('new link')) {
      return {
        response: 'A new application link will be sent to you shortly.',
        escalate: true,
        escalateReason: 'Screening applicant requesting new link',
      };
    }

    if (text.includes('status') || text.includes('update') || text.includes('progress')) {
      return {
        response: 'Your application is currently being processed. You will receive a notification once a decision has been made. This typically takes 3-5 business days.',
      };
    }

    return {
      response: 'For screening-related queries, please reply with:\n- "STATUS" to check your application status\n- "NEW LINK" to request a new application link\n- "AGENT" to speak to someone',
    };
  }
}

export const messageRouter = new MessageRouter();
