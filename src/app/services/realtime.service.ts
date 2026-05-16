import { Injectable, NgZone, inject } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface RealtimeEnvelope {
  destination: string;
  body: unknown;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly authService = inject(AuthService);
  private readonly zone = inject(NgZone);
  private socket?: WebSocket;
  private connected = false;
  private connectRequested = false;
  private reconnectAttempt = 0;
  private readonly subscriptions = new Set<string>();
  private readonly queuedFrames: string[] = [];

  readonly notifications$ = new Subject<unknown>();
  readonly unread$ = new Subject<{ roomId: string; count: number }>();
  readonly roomMessages$ = new Subject<RealtimeEnvelope>();

  isReady(): boolean {
    return this.connected && this.socket?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (this.connected || this.connectRequested || typeof WebSocket === 'undefined') {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.connectRequested = true;
    this.zone.runOutsideAngular(() => {
      const wsUrl = `${environment.websocket.protocol}//${environment.websocket.host}:${environment.websocket.port}${environment.websocket.endpoint}`;
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = () => this.sendConnect(token);
      this.socket.onmessage = event => this.handleRawMessage(String(event.data || ''));
      this.socket.onclose = () => this.handleClose();
      this.socket.onerror = () => this.socket?.close();
    });
  }

  disconnect(): void {
    this.connected = false;
    this.connectRequested = false;
    this.subscriptions.clear();
    this.queuedFrames.length = 0;
    this.socket?.close();
    this.socket = undefined;
  }

  subscribeRoom(roomId: string): void {
    if (!roomId || this.subscriptions.has(`room:${roomId}`)) {
      return;
    }
    this.subscriptions.add(`room:${roomId}`);
    this.sendFrame('SUBSCRIBE', {
      id: `room-${roomId}`,
      destination: `/topic/room/${roomId}`
    });
  }

  markRoomRead(roomId: string): void {
    this.publish('/app/chat.read', { roomId });
  }

  sendChatMessage(payload: { roomId: string; messageId: string; content: string; type?: string }): boolean {
    return this.publish('/app/chat.send', payload);
  }

  private sendConnect(token: string): void {
    this.sendRaw(this.frame('CONNECT', {
      'accept-version': '1.2',
      'heart-beat': '10000,10000',
      Authorization: `Bearer ${token}`
    }));
  }

  private handleClose(): void {
    this.connected = false;
    this.connectRequested = false;
    this.socket = undefined;

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const delay = Math.min(15000, 1000 * 2 ** this.reconnectAttempt++);
    timer(delay).subscribe(() => this.connect());
  }

  private handleRawMessage(raw: string): void {
    for (const packet of raw.split('\0').filter(Boolean)) {
      const { command, headers, body } = this.parseFrame(packet);
      if (command === 'CONNECTED') {
        this.zone.run(() => {
          this.connected = true;
          this.connectRequested = false;
          this.reconnectAttempt = 0;
          this.subscribeUserQueues();
          this.flushQueue();
        });
        continue;
      }
      if (command !== 'MESSAGE') {
        continue;
      }

      const parsedBody = this.parseBody(body);
      this.zone.run(() => {
        const destination = headers['destination'] || '';
        if (destination.includes('/queue/notifications')) {
          this.notifications$.next(parsedBody);
        } else if (destination.includes('/queue/unread')) {
          const value = parsedBody as any;
          this.unread$.next({ roomId: String(value?.roomId ?? ''), count: Number(value?.count ?? 0) });
        } else if (destination.includes('/topic/room/')) {
          this.roomMessages$.next({ destination, body: parsedBody });
        }
      });
    }
  }

  private subscribeUserQueues(): void {
    this.sendFrame('SUBSCRIBE', { id: 'user-notifications', destination: '/user/queue/notifications' });
    this.sendFrame('SUBSCRIBE', { id: 'user-messages', destination: '/user/queue/messages' });
    this.sendFrame('SUBSCRIBE', { id: 'user-unread', destination: '/user/queue/unread' });
  }

  private publish(destination: string, body: unknown): boolean {
    return this.sendFrame('SEND', {
      destination,
      'content-type': 'application/json'
    }, JSON.stringify(body));
  }

  private sendFrame(command: string, headers: Record<string, string>, body = ''): boolean {
    return this.sendRaw(this.frame(command, headers, body));
  }

  private sendRaw(payload: string): boolean {
    if (!this.connected && !payload.startsWith('CONNECT')) {
      this.queuedFrames.push(payload);
      this.connect();
      return true;
    }
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.socket.send(payload);
      return true;
    } catch {
      return false;
    }
  }

  private flushQueue(): void {
    while (this.queuedFrames.length > 0) {
      this.socket?.send(this.queuedFrames.shift()!);
    }
  }

  private frame(command: string, headers: Record<string, string>, body = ''): string {
    const lines = [command, ...Object.entries(headers).map(([key, value]) => `${key}:${value}`), '', body];
    return `${lines.join('\n')}\0`;
  }

  private parseFrame(packet: string): { command: string; headers: Record<string, string>; body: string } {
    const [headerBlock, ...bodyParts] = packet.split('\n\n');
    const [command, ...headerLines] = headerBlock.split('\n').filter(Boolean);
    const headers = headerLines.reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf(':');
      if (index > -1) {
        acc[line.slice(0, index)] = line.slice(index + 1);
      }
      return acc;
    }, {});
    return { command, headers, body: bodyParts.join('\n\n') };
  }

  private parseBody(body: string): unknown {
    if (!body) {
      return {};
    }
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
}
