// AI Copilot for Human Support Agents
// Powered by Gemini / LLM with intelligent fallback for instant local execution

import { Message } from '@/types/crm';

export interface AISuggestionResponse {
  suggestedReplies: string[];
  tone: 'professional' | 'empathetic' | 'sales_focused';
  quickAction?: string;
}

export interface AISummaryResponse {
  summary: string;
  bulletPoints: string[];
  recommendedNextStep: string;
  customerSentiment: 'Positive' | 'Neutral' | 'Frustrated';
}

export class AICopilotService {
  /**
   * Generates intelligent reply suggestions based on the last messages in the conversation
   */
  static async suggestReplies(
    messages: Message[],
    contactName: string,
    apiKey?: string
  ): Promise<AISuggestionResponse> {
    const recentMessages = messages.slice(-5);
    const lastCustomerMsg = [...recentMessages].reverse().find((m) => m.senderType === 'contact')?.content || '';

    // If Gemini/OpenAI API key is provided, we can call the LLM API
    if (apiKey) {
      try {
        const prompt = `You are an elite customer success agent on WhatsApp. 
The customer is ${contactName}.
Their last message was: "${lastCustomerMsg}".
Recent chat history:
${recentMessages.map((m) => `${m.senderName || m.senderType}: ${m.content}`).join('\n')}

Provide 3 distinct, concise, high-converting WhatsApp replies:
1. Direct, helpful answer
2. Action-oriented next step
3. Friendly reassurance`;

        // Direct fetch to Gemini endpoint if GEMINI_API_KEY is configured
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            const lines = generatedText
              .split('\n')
              .map((l: string) => l.replace(/^[\d.-]+\s*|\*+/g, '').trim())
              .filter((l: string) => l.length > 10)
              .slice(0, 3);

            if (lines.length > 0) {
              return {
                suggestedReplies: lines,
                tone: 'professional',
                quickAction: 'Send Verified Quote',
              };
            }
          }
        }
      } catch (err) {
        console.warn('AI API Call failed, falling back to smart rule suggestions:', err);
      }
    }

    // High quality contextual offline heuristics
    const lower = lastCustomerMsg.toLowerCase();
    if (lower.includes('delay') || lower.includes('shipping') || lower.includes('customs') || lower.includes('order')) {
      return {
        suggestedReplies: [
          `Hi ${contactName}, I apologize for the delay. I have escalated this with our dispatch courier and am pulling up your live tracking details right now.`,
          `Checking your shipment status immediately, ${contactName}. We guarantee priority resolution and will update you here within 30 minutes.`,
          `Thank you for flagging this, ${contactName}. Could you verify your preferred delivery address while I coordinate with customs clearance?`,
        ],
        tone: 'empathetic',
        quickAction: 'Track Logistics',
      };
    } else if (lower.includes('price') || lower.includes('discount') || lower.includes('quote') || lower.includes('units')) {
      return {
        suggestedReplies: [
          `Hi ${contactName}, thank you for your interest! For volume orders, we offer an tiered incentive of up to 25% off. I can prepare a custom invoice for you today.`,
          `Great news ${contactName}! We have special wholesale pricing active for this tier. Would you like me to send over our itemized quotation PDF?`,
          `I would love to help customize this package for your team. What is your estimated delivery timeframe?`,
        ],
        tone: 'sales_focused',
        quickAction: 'Generate Quote',
      };
    } else {
      return {
        suggestedReplies: [
          `Hi ${contactName}, thank you for reaching out! Let me check this for you right away.`,
          `Hello ${contactName}! I have reviewed your request and am happy to assist you with this.`,
          `Could you provide a few more details so I can ensure we get this resolved for you promptly?`,
        ],
        tone: 'professional',
      };
    }
  }

  /**
   * Summarizes conversation history into actionable bullets for agent handoffs
   */
  static summarizeConversation(messages: Message[], contactName: string): AISummaryResponse {
    const customerMessages = messages.filter((m) => m.senderType === 'contact');
    const isUrgent = messages.some((m) =>
      /urgent|delay|broken|refund|complaint|cancel/i.test(m.content)
    );

    return {
      summary: `Interaction with ${contactName} regarding account inquiries and active requests. Total messages exchanged: ${messages.length}.`,
      bulletPoints: [
        `Customer initiated conversation with ${customerMessages.length} inquiries.`,
        `Identified key topics: ${isUrgent ? 'Operational / Delivery Resolution Needed' : 'Commercial Expansion & Product Clarification'}.`,
        `Latest status: Awaiting final confirmation or verification from support team.`,
      ],
      recommendedNextStep: isUrgent
        ? 'Escalate to Tier 2 Support with tracking reference'
        : 'Send formal proposal or follow-up confirmation within 2 hours',
      customerSentiment: isUrgent ? 'Frustrated' : 'Positive',
    };
  }
}
