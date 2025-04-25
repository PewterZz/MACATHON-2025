import { createSupabaseClient } from "@/lib/supabase"

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate'
  sender: string
  requestId: string
  payload: any
}

export class SignalingService {
  private supabase = createSupabaseClient()
  private userId: string
  private requestId: string
  private channel: any
  private onMessageCallback: ((message: SignalingMessage) => void) | null = null

  constructor(userId: string, requestId: string) {
    this.userId = userId
    this.requestId = requestId
  }

  public async connect() {
    // Initialize the realtime channel
    this.channel = this.supabase
      .channel(`signaling:${this.requestId}`)
      .on(
        'broadcast',
        { event: 'message' },
        (payload) => {
          const message = payload.payload as SignalingMessage
          // Ignore messages from self
          if (message.sender !== this.userId && this.onMessageCallback) {
            this.onMessageCallback(message)
          }
        }
      )
      .subscribe()
    
    return this
  }

  public onMessage(callback: (message: SignalingMessage) => void) {
    this.onMessageCallback = callback
    return this
  }

  public async sendOffer(offer: RTCSessionDescriptionInit) {
    await this.channel.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        type: 'offer',
        sender: this.userId,
        requestId: this.requestId,
        payload: offer
      }
    })
  }

  public async sendAnswer(answer: RTCSessionDescriptionInit) {
    await this.channel.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        type: 'answer',
        sender: this.userId,
        requestId: this.requestId,
        payload: answer
      }
    })
  }

  public async sendIceCandidate(candidate: RTCIceCandidate) {
    await this.channel.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        type: 'ice-candidate',
        sender: this.userId,
        requestId: this.requestId,
        payload: candidate
      }
    })
  }

  public disconnect() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel)
    }
  }
} 