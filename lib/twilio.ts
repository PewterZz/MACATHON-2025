// Mark this file as server-only to prevent client-side inclusion
import 'server-only'
import { randomUUID } from 'crypto';

// Using a more dynamic approach to instantiate Twilio client to avoid build issues
const createTwilioClient = () => {
  try {
    // Check if we're in a server environment
    if (typeof window !== 'undefined') {
      console.error('Twilio client should not be initialized on the client side');
      return null;
    }
    
    // Check for required environment variables
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('Missing Twilio credentials in environment variables');
      return null;
    }
    
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

// Only access these variables on the server
export const twilioNumber = process.env.TWILIO_NUMBER || '';

// Validate that we have a Twilio number
if (!twilioNumber) {
  console.warn('TWILIO_NUMBER environment variable is not set');
}

// Generate a unique reference code
export const generateReferenceCode = () => {
  // Generate a 6-character alphanumeric code
  return randomUUID().substring(0, 6).toUpperCase();
};

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
export const generateStreamTwiML = (websocketUrl: string, referenceCode?: string) => {
  const welcomeMessage = referenceCode 
    ? `Welcome to Mind Meld Peer Assist. Your reference code is ${referenceCode.split('').join(' ')}. Please share what's on your mind, and we'll connect you with a peer supporter.`
    : `Welcome to Mind Meld Peer Assist. Please share what's on your mind, and we'll connect you with a peer supporter.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${welcomeMessage}</Say>
  <Connect>
    <Stream url="${websocketUrl}" />
  </Connect>
  <Say>Thank you for reaching out. We'll be with you soon.</Say>
</Response>`;
};

// Generate TwiML for standard voice response
export const generateVoiceTwiML = (message: string) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
</Response>`;
}; 