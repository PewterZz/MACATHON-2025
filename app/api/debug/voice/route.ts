import { NextRequest, NextResponse } from 'next/server';

// App URL for sharing
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'meld-git-main-pewterzzs-projects.vercel.app';

export async function GET(req: NextRequest) {
  try {
    // Generate a random call SID for testing
    const callSid = `CA${Math.random().toString(36).substring(2, 15)}`;
    
    // Create a valid WebSocket URL
    const wsUrl = `wss://${APP_URL}/api/voice/stream?callSid=${callSid}`;
    
    // Return HTML with a WebSocket test
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WebSocket Test</title>
      </head>
      <body>
        <h1>WebSocket Test</h1>
        <p>Testing WebSocket connection to: ${wsUrl}</p>
        <button id="connect">Connect</button>
        <button id="disconnect" disabled>Disconnect</button>
        <div id="status">Disconnected</div>
        
        <script>
          let socket;
          const connectBtn = document.getElementById('connect');
          const disconnectBtn = document.getElementById('disconnect');
          const status = document.getElementById('status');
          
          connectBtn.addEventListener('click', () => {
            try {
              status.textContent = 'Connecting...';
              
              // Connect to the WebSocket
              socket = new WebSocket('${wsUrl}');
              
              socket.onopen = () => {
                status.textContent = 'Connected';
                connectBtn.disabled = true;
                disconnectBtn.disabled = false;
              };
              
              socket.onmessage = (event) => {
                console.log('Received:', event.data);
                const p = document.createElement('p');
                p.textContent = 'Received: ' + event.data;
                document.body.appendChild(p);
              };
              
              socket.onclose = () => {
                status.textContent = 'Disconnected';
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
              };
              
              socket.onerror = (error) => {
                status.textContent = 'Error: ' + error;
                console.error('WebSocket error:', error);
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
              };
            } catch (error) {
              status.textContent = 'Error: ' + error.message;
              console.error('Error connecting:', error);
            }
          });
          
          disconnectBtn.addEventListener('click', () => {
            if (socket) {
              socket.close();
              status.textContent = 'Disconnected';
              connectBtn.disabled = false;
              disconnectBtn.disabled = true;
            }
          });
        </script>
      </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html'
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 