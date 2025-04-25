// This code verifies that requests are coming from Discord
// Based on Discord's official verification process:
// https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization

export async function verifyDiscordRequest(
  clientPublicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(timestamp + body);
    
    const signatureBuffer = hexToUint8Array(signature);
    const publicKeyBuffer = hexToUint8Array(clientPublicKey);
    
    // Use the Web Crypto API to verify the signature
    // This needs to run in an environment with Web Crypto API support
    const verified = await crypto.subtle.verify(
      'Ed25519',
      await crypto.subtle.importKey(
        'raw',
        publicKeyBuffer,
        { name: 'Ed25519', namedCurve: 'Ed25519' },
        false,
        ['verify']
      ),
      signatureBuffer,
      messageBuffer
    );
    
    return verified;
  } catch (error) {
    console.error('Error verifying Discord request:', error);
    return false;
  }
}

// Helper function to convert hex strings to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
} 