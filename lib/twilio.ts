// Using a more dynamic approach to instantiate Twilio client to avoid build issues
const createTwilioClient = () => {
  try {
    const twilio = require('twilio');
    return twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  } catch (error) {
    console.error('Error initializing Twilio client:', error);
    return null;
  }
};

export const twilioNumber = process.env.TWILIO_NUMBER!;

// Helper function to send an SMS
export const sendSMS = async (to: string, body: string) => {
  try {
    const client = createTwilioClient();
    if (!client) {
      throw new Error('Failed to initialize Twilio client');
    }
    
    const message = await client.messages.create({
      body,
      from: twilioNumber,
      to
    });
    return message.sid;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

// Helper function to send a WhatsApp message
export const sendWhatsApp = async (to: string, body: string) => {
  try {
    const client = createTwilioClient();
    if (!client) {
      throw new Error('Failed to initialize Twilio client');
    }
    
    const message = await client.messages.create({
      body,
      from: `whatsapp:${twilioNumber}`,
      to: `whatsapp:${to}`
    });
    return message.sid;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
};

// Generate TwiML for voice streaming
export const generateStreamTwiML = (websocketUrl: string) => {
  return `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Welcome to Mind Meld Peer Assist. Please share what's on your mind, and we'll connect you with a peer supporter.</Say>
      <Connect>
        <Stream url="${websocketUrl}" />
      </Connect>
      <Say>Thank you for reaching out. We'll be with you soon.</Say>
    </Response>
  `.trim();
};

// Generate TwiML for standard voice response
export const generateVoiceTwiML = (message: string) => {
  return `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>${message}</Say>
    </Response>
  `.trim();
}; 