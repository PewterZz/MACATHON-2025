import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export interface TriageResult {
  summary: string;
  risk: number;
  tags: string[];
  suggestedApproach: string;
}

export interface CoachingResponse {
  suggestion: string;
  tone: 'supportive' | 'cautious' | 'urgent';
  nextSteps: string[];
}

export async function triage(text: string): Promise<TriageResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an expert mental health triage assistant. Analyze the input and provide:
          1. A concise summary of the main concern
          2. A risk assessment score between 0-1 (0 being lowest risk, 1 being highest)
          3. Relevant tags for categorization
          4. A suggested approach for the peer supporter`
      },
      { role: "user", content: text }
    ],
    functions: [
      {
        name: "process_triage",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string" },
            risk: { type: "number", minimum: 0, maximum: 1 },
            tags: { type: "array", items: { type: "string" } },
            suggestedApproach: { type: "string" }
          },
          required: ["summary", "risk", "tags", "suggestedApproach"]
        }
      }
    ],
    function_call: { name: "process_triage" }
  });

  const result = JSON.parse(response.choices[0].message.function_call?.arguments || "{}");
  return result as TriageResult;
}

export async function* streamCoach({ messages }: { messages: { sender: string; content: string }[] }): AsyncGenerator<string> {
  // Convert messages to the format expected by OpenAI
  const formattedMessages = messages.map(msg => {
    if (msg.sender === "helper") {
      return { role: "assistant" as const, content: msg.content };
    } else if (msg.sender === "caller") {
      return { role: "user" as const, content: msg.content };
    } else {
      return { role: "system" as const, content: msg.content };
    }
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an expert peer support coach. Based on the conversation, provide real-time guidance to the peer supporter.
          Focus on:
          1. Active listening techniques
          2. Appropriate responses
          3. Risk identification
          4. When to escalate
          Be concise and practical in your suggestions.`
      },
      ...formattedMessages
    ],
    stream: true
  });

  for await (const chunk of response) {
    if (chunk.choices[0]?.delta?.content) {
      yield chunk.choices[0].delta.content;
    }
  }
}

export async function analyzeConversation(messages: { sender: string; content: string }[]): Promise<CoachingResponse> {
  // Convert messages to the format expected by OpenAI
  const formattedMessages = messages.map(msg => {
    if (msg.sender === "helper") {
      return { role: "assistant" as const, content: msg.content };
    } else if (msg.sender === "caller") {
      return { role: "user" as const, content: msg.content };
    } else {
      return { role: "system" as const, content: msg.content };
    }
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an expert peer support coach. Analyze the conversation and provide:
          1. A suggestion for the peer supporter
          2. The appropriate tone to use
          3. Recommended next steps`
      },
      ...formattedMessages
    ],
    functions: [
      {
        name: "provide_coaching",
        parameters: {
          type: "object",
          properties: {
            suggestion: { type: "string" },
            tone: { type: "string", enum: ["supportive", "cautious", "urgent"] },
            nextSteps: { type: "array", items: { type: "string" } }
          },
          required: ["suggestion", "tone", "nextSteps"]
        }
      }
    ],
    function_call: { name: "provide_coaching" }
  });

  const result = JSON.parse(response.choices[0].message.function_call?.arguments || "{}");
  return result as CoachingResponse;
} 