import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

type TriageResult = {
  summary: string;
  risk: number; // 0-1 scale
}

type TriageFunction = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: {
      summary: {
        type: string;
        description: string;
      };
      risk: {
        type: string;
        description: string;
      };
    };
    required: string[];
  };
}

const triageFunction: TriageFunction = {
  name: 'triage',
  description: 'Analyze the incoming message to determine risk level and create a summary',
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'A concise summary of the key issues the person is experiencing (max 200 chars)',
      },
      risk: {
        type: 'number',
        description: 'Risk assessment on a scale of 0 to 1, where 0 is no risk and 1 is severe risk. Values >= 0.6 indicate urgent need for help. Be more sensitive to life-threatening situations - anything potentially life-threatening should be rated at least 0.7 (high) or 0.9+ (critical).',
      },
    },
    required: ['summary', 'risk'],
  },
};

export const triage = async (text: string): Promise<TriageResult> => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a mental health triage assistant. Your job is to analyze incoming messages, 
          identify key concerns, assess risk levels, and create a brief summary. 
          Focus on identifying indicators of self-harm, suicidal ideation, crisis, 
          or severe distress which would be rated >= 0.6 risk.
          
          IMPORTANT: Be especially sensitive to potentially life-threatening situations.
          If someone mentions anything that could possibly indicate danger to themselves or others,
          such as suicidal thoughts, self-harm, violence, or extreme distress, you must rate this
          as high risk (>=0.7) or critical risk (>=0.9). Even subtle or indirect references to 
          self-harm or suicidal thoughts should be considered high risk.
          
          Examples of high/critical risk (>=0.7):
          - Mentions of wanting to die, end their life, or not being around anymore
          - Discussions about methods of harm or suicide
          - Mentions of having a plan to hurt themselves
          - Severe hopelessness or feeling trapped
          - Giving away possessions or saying goodbyes
          - Comments about being a burden to others
          - References to having access to means of self-harm
          
          When in doubt about whether something is potentially life-threatening, err on the side of 
          caution and rate it higher.`,
        },
        { role: 'user', content: text },
      ],
      functions: [triageFunction],
      function_call: { name: 'triage' },
    });

    const functionCall = response.choices[0]?.message?.function_call;
    
    if (functionCall?.name === 'triage' && functionCall.arguments) {
      const args = JSON.parse(functionCall.arguments);
      return {
        summary: args.summary,
        risk: args.risk,
      };
    }

    throw new Error('Failed to get proper triage function response');
  } catch (error) {
    console.error('Triage error:', error);
    // Fallback with conservative values
    return {
      summary: 'Failed to analyze content. Please review manually.',
      risk: 0.7, // High risk as a precaution
    };
  }
};

export const coach = async (
  context: { messages: { sender: string; content: string }[] }
): Promise<string> => {
  try {
    const messagesForAI = context.messages.map(msg => ({
      role: msg.sender === 'caller' ? 'user' as const : 
            msg.sender === 'helper' ? 'assistant' as const : 
            'system' as const,
      content: msg.content,
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert peer support coach observing a conversation between 
          someone seeking help (user) and a peer supporter (assistant). 
          Your job is to provide brief coaching suggestions to the peer supporter
          about how to best help the person. Focus on empathetic listening techniques,
          validation strategies, and appropriate resources to suggest. 
          Keep your suggestions concise, practical and actionable.`,
        },
        ...messagesForAI,
        {
          role: 'user',
          content: 'What would be a helpful suggestion for the peer supporter at this moment?',
        },
      ],
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content || 'No coaching suggestion available';
  } catch (error) {
    console.error('Coaching error:', error);
    return 'Unable to provide coaching at this time. Focus on active listening and validation.';
  }
};

export const streamCoach = async function* (
  context: { messages: { sender: string; content: string }[] }
) {
  try {
    const messagesForAI = context.messages.map(msg => ({
      role: msg.sender === 'caller' ? 'user' as const : 
            msg.sender === 'helper' ? 'assistant' as const : 
            'system' as const,
      content: msg.content,
    }));

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert peer support coach observing a conversation between 
          someone seeking help (user) and a peer supporter (assistant). 
          Your job is to provide brief coaching suggestions to the peer supporter
          about how to best help the person. Focus on empathetic listening techniques,
          validation strategies, and appropriate resources to suggest. 
          Keep your suggestions concise, practical and actionable.`,
        },
        ...messagesForAI,
        {
          role: 'user',
          content: 'What would be a helpful suggestion for the peer supporter at this moment?',
        },
      ],
      max_tokens: 200,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  } catch (error) {
    console.error('Streaming coach error:', error);
    yield 'Unable to provide coaching at this time. Focus on active listening and validation.';
  }
}; 