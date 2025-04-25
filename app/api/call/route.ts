import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Get the request body
    const { to, message } = await req.json();
    
    // Validate the phone number
    if (!to || typeof to !== 'string' || !to.match(/^\+[1-9]\d{1,14}$/)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must be in E.164 format (e.g. +1234567890)' },
        { status: 400 }
      );
    }
    
    // Dynamic import to avoid build issues with Twilio
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Get the host for the callback URL
    const host = headers().get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    // Create a call
    const call = await client.calls.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${baseUrl}/api/twilio/voice`,
      statusCallback: `${baseUrl}/api/twilio/voice/status`,
      statusCallbackMethod: 'POST',
      record: true
    });
    
    return NextResponse.json({
      success: true,
      callSid: call.sid,
      message: `Outbound call initiated to ${to}`
    });
    
  } catch (error: any) {
    console.error('Error initiating outbound call:', error);
    return NextResponse.json(
      { error: 'Failed to initiate call: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get('to');
    
    if (!to || !to.match(/^\+[1-9]\d{1,14}$/)) {
      return NextResponse.json(
        { error: 'Invalid or missing phone number. Use format: /api/call?to=+1234567890' },
        { status: 400 }
      );
    }
    
    // Dynamic import to avoid build issues with Twilio
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Get the host for the callback URL
    const host = headers().get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    // Create a call
    const call = await client.calls.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${baseUrl}/api/twilio/voice`,
      statusCallback: `${baseUrl}/api/twilio/voice/status`,
      statusCallbackMethod: 'POST',
      record: true
    });
    
    return NextResponse.json({
      success: true,
      callSid: call.sid,
      message: `Outbound call initiated to ${to}`
    });
    
  } catch (error: any) {
    console.error('Error initiating outbound call:', error);
    return NextResponse.json(
      { error: 'Failed to initiate call: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 