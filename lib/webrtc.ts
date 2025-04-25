import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PeerConnection {
  pc: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  stream?: MediaStream;
}

const peerConnections = new Map<string, PeerConnection>();

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const initializePeerConnection = async (requestId: string, isHelper: boolean) => {
  const pc = new RTCPeerConnection(iceServers);
  const connection: PeerConnection = { pc };
  peerConnections.set(requestId, connection);

  // Set up data channel for text chat
  if (isHelper) {
    const dataChannel = pc.createDataChannel('chat');
    setupDataChannel(dataChannel, requestId);
    connection.dataChannel = dataChannel;
  } else {
    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel, requestId);
      connection.dataChannel = event.channel;
    };
  }

  // Handle ICE candidates
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await supabase.from('rtc_signaling').insert({
        request_id: requestId,
        type: 'ice-candidate',
        data: event.candidate,
        from_helper: isHelper,
      });
    }
  };

  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    console.log(`Connection state: ${pc.connectionState}`);
  };

  return pc;
};

export const setupDataChannel = (channel: RTCDataChannel, requestId: string) => {
  channel.onopen = () => {
    console.log('Data channel opened');
  };

  channel.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    // Store message in Supabase
    await supabase.from('messages').insert({
      request_id: requestId,
      sender: message.sender,
      content: message.content,
    });
  };

  channel.onclose = () => {
    console.log('Data channel closed');
  };
};

export const startVoiceCall = async (requestId: string) => {
  const connection = peerConnections.get(requestId);
  if (!connection) throw new Error('No peer connection found');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    connection.stream = stream;
    stream.getTracks().forEach(track => {
      connection.pc.addTrack(track, stream);
    });
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw error;
  }
};

export const handleSignalingMessage = async (
  requestId: string,
  isHelper: boolean,
  message: any
) => {
  let connection = peerConnections.get(requestId);
  
  if (!connection) {
    connection = { pc: await initializePeerConnection(requestId, isHelper) };
    peerConnections.set(requestId, connection);
  }

  const { pc } = connection;

  switch (message.type) {
    case 'offer':
      await pc.setRemoteDescription(new RTCSessionDescription(message.data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await supabase.from('rtc_signaling').insert({
        request_id: requestId,
        type: 'answer',
        data: answer,
        from_helper: isHelper,
      });
      break;

    case 'answer':
      await pc.setRemoteDescription(new RTCSessionDescription(message.data));
      break;

    case 'ice-candidate':
      if (message.data) {
        await pc.addIceCandidate(new RTCIceCandidate(message.data));
      }
      break;
  }
};

export const sendMessage = (requestId: string, content: string, sender: string) => {
  const connection = peerConnections.get(requestId);
  if (!connection?.dataChannel) throw new Error('No data channel available');

  const message = { content, sender };
  connection.dataChannel.send(JSON.stringify(message));
};

export const closeConnection = (requestId: string) => {
  const connection = peerConnections.get(requestId);
  if (connection) {
    connection.stream?.getTracks().forEach(track => track.stop());
    connection.dataChannel?.close();
    connection.pc.close();
    peerConnections.delete(requestId);
  }
}; 