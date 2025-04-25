import { NextResponse } from "next/server"

// Set Node.js runtime
export const runtime = 'nodejs';

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const applicationSid = process.env.TWILIO_TWIML_APP_SID

export async function GET() {
  try {
    if (!accountSid || !authToken || !applicationSid) {
      throw new Error("Missing required Twilio credentials")
    }

    // Dynamic import to avoid build issues
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken)
    const capability = new twilio.jwt.ClientCapability({
      accountSid: accountSid,
      authToken: authToken,
      ttl: 3600,
    })

    // Allow the client-side application to make outgoing calls
    capability.addScope(
      new twilio.jwt.ClientCapability.OutgoingClientScope({
        applicationSid: applicationSid
      })
    )

    // Generate the token
    const token = capability.toJwt()

    return NextResponse.json({ token })
  } catch (error: any) {
    console.error("Error generating Twilio token:", error)
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    )
  }
} 