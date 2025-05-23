# Meld

A Next.js 14 application for support, integrating Supabase, OpenAI, Twilio, and Discord for a multi-channel support experience.

## Features

- **Supabase Auth**: Email and GitHub authentication
- **Multi-channel Support**: Phone, WhatsApp, and Discord integration
- **Real-time Queue**: Helpers can see and claim support requests
- **AI Coaching**: GPT-4o integration for triage and coaching
- **WebSocket Chat**: Real-time messaging between helpers and callers
- **Edge Runtime**: Leverages Next.js Edge for optimal performance

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API routes (Edge runtime)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **AI**: OpenAI gpt-4o
- **Communication**: Twilio (Voice, SMS, WhatsApp), Discord.js
- **Deployment**: Vercel

## Environment Variables

Create a `.env.local` file with the following variables:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Twilio
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_NUMBER=+61xxxxxxxxxx

# Discord
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_PUBLIC_KEY=your-discord-public-key
DISCORD_APPLICATION_ID=your-discord-application-id
```

## Setup and Installation

1. **Install dependencies**:
   ```
   pnpm install
   ```

2. **Set up Supabase**:
   ```
   pnpm dlx supabase login
   pnpm dlx supabase init
   pnpm dlx supabase start
   pnpm dlx supabase db push
   ```

3. **Run the development server**:
   ```
   pnpm dev
   ```

4. **Open the application**:
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Webhook Configuration

### Twilio
- Voice Webhook: `https://your-domain.com/api/twilio/voice`
- WhatsApp Webhook: `https://your-domain.com/api/twilio/whatsapp`

### Discord
- Bot Configuration: Enable message content intent
- Register command with developer portal
- Interaction Endpoint URL: `https://your-domain.com/api/discord`

## Deployment

1. **Deploy to Vercel**:
   ```
   vercel
   ```

2. **Set up environment variables** in the Vercel dashboard.

3. **Deploy Supabase**:
   ```
   pnpm dlx supabase db push --db-url=your-supabase-db-url
   ```

## Troubleshooting

### "Failed to fetch requests" Error

If you encounter a "Failed to fetch requests" error in the dashboard, follow these steps:

1. **Check Environment Variables**:
   Ensure your `.env.local` file has the correct Supabase variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE=your-service-role-key
   ```

2. **Verify Supabase Service**:
   - Check if your Supabase project is active and online
   - Confirm that you have the "requests" table in your database

3. **Clear Browser Cache**:
   - Try clearing your browser cookies and local storage
   - Logout and login again to refresh your session

4. **Network Issues**:
   - Ensure you have an active internet connection
   - Check if your network has any firewall restrictions for API calls

5. **Developer Tools**:
   - Open browser developer tools (F12)
   - Check the Console and Network tabs for more specific error messages
   - Look for CORS or authentication issues in the error details

If problems persist, try restarting your development server with:
```
npm run dev
```

## License

MIT 