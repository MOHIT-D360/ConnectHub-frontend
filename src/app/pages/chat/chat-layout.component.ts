import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AnimatedBackgroundComponent } from '../../components/shared/animated-background.component';
import { BrandLogoComponent } from '../../components/shared/brand-logo.component';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { RealtimeService } from '../../services/realtime.service';
import { PushTokenService } from '../../services/push-token.service';
import { ChatAreaComponent } from './components/chat-area.component';
import { ChatInfoPanelComponent } from './components/chat-info-panel.component';
import { ChatSidebarComponent } from './components/chat-sidebar.component';

@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AnimatedBackgroundComponent,
    BrandLogoComponent,
    ChatSidebarComponent,
    ChatAreaComponent,
    ChatInfoPanelComponent
  ],
  template: `
    <app-animated-background></app-animated-background>

    <div class="chat-layout" [class.mobile-chat-open]="activeRoom()" [class.premium-user]="isPro()">
      <aside class="sidebar">
        <app-chat-sidebar
          [activeRoomId]="activeRoom()?.id"
          [loading]="loading()"
          [error]="error()"
          (roomSelected)="selectRoom($event)"
          (retryRequested)="loadRooms()">
        </app-chat-sidebar>
      </aside>

      <main class="chat-area">
        @if (activeRoom()) {
          <app-chat-area
            [room]="activeRoom()!"
            (backRequested)="backToList()"
            (detailsRequested)="toggleInfoPanel()">
          </app-chat-area>
        } @else {
          <div class="no-room-selected">
            <div class="empty-state">
              <app-brand-logo class="empty-icon"></app-brand-logo>
              <h2>Select a conversation</h2>
              <p>Pick a room and keep the conversation moving in real time.</p>
            </div>
          </div>
        }
      </main>

      @if (activeRoom() && infoPanelOpen()) {
        <aside class="info-panel">
          <app-chat-info-panel
            [room]="activeRoom()!"
            (closed)="infoPanelOpen.set(false)">
          </app-chat-info-panel>
        </aside>
      }
    </div>
  `,
  styles: [`
    .chat-layout {
      display: grid;
      grid-template-columns: minmax(300px, 360px) minmax(0, 1fr) minmax(280px, 340px);
      height: 100dvh;
      background: var(--color-glass-border);
      position: relative;
      z-index: 1;
      overflow: hidden;
    }

    .chat-layout.premium-user {
      background:
        linear-gradient(120deg, rgba(255, 214, 98, 0.72), rgba(66, 32, 87, 0.58)),
        var(--color-glass-border);
    }

    .chat-layout.premium-user .sidebar,
    .chat-layout.premium-user .chat-area,
    .chat-layout.premium-user .info-panel {
      border-color: rgba(255, 214, 98, 0.42);
      box-shadow: inset 0 0 0 1px rgba(255, 214, 98, 0.12);
    }

    .sidebar,
    .chat-area,
    .info-panel {
      background: var(--color-glass-light);
      backdrop-filter: blur(20px) saturate(180%);
      border-right: 1px solid var(--color-glass-border);
      min-width: 0;
      overflow: hidden;
    }

    .chat-area {
      display: flex;
      flex-direction: column;
    }

    .no-room-selected {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xl);
    }

    .empty-state {
      text-align: center;
      max-width: 340px;
      color: var(--color-text-secondary);
    }

    .empty-icon {
      width: 72px;
      height: 72px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--spacing-lg);
      box-shadow: 0 0 34px rgba(14, 165, 233, 0.24);
      animation: breathe 2.8s ease-in-out infinite;
    }

    .empty-state h2 {
      color: var(--color-text-primary);
      font-size: 22px;
      margin-bottom: var(--spacing-sm);
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
    }

    @keyframes breathe {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 28px rgba(14, 165, 233, 0.18);
      }
      50% {
        transform: scale(1.04);
        box-shadow: 0 0 42px rgba(139, 92, 246, 0.28);
      }
    }

    @media (max-width: 1180px) {
      .chat-layout {
        grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
      }

      .info-panel {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(360px, 100vw);
        z-index: 20;
        box-shadow: var(--shadow-lg);
      }
    }

    @media (max-width: 768px) {
      .chat-layout {
        display: block;
      }

      .sidebar,
      .chat-area {
        position: absolute;
        inset: 0;
      }

      .chat-area {
        transform: translateX(100%);
        transition: transform var(--transition-base);
      }

      .chat-layout.mobile-chat-open .chat-area {
        transform: translateX(0);
      }

      .chat-layout.mobile-chat-open .sidebar {
        visibility: hidden;
      }
    }
  `]
})
export class ChatLayoutComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly pushTokenService = inject(PushTokenService);

  readonly activeRoom = this.chatService.activeRoom;
  readonly isPro = this.authService.isPro;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly infoPanelOpen = signal(false);
  private refreshTimer?: number;
  private realtimeRoomSub?: any;
  private realtimeUnreadSub?: any;

  ngOnInit(): void {
    this.realtimeService.connect();
    this.pushTokenService.init();
    this.loadRooms();
    this.refreshTimer = window.setInterval(() => this.refreshRoomsQuietly(), 5000);

    this.realtimeRoomSub = this.realtimeService.roomMessages$.subscribe(envelope => {
      this.chatService.handleRealtimeRoomMessage(envelope.destination, envelope.body);
    });
    this.realtimeUnreadSub = this.realtimeService.unread$.subscribe(update => {
      this.chatService.applyUnreadUpdate(update.roomId, update.count);
    });
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }
    this.realtimeRoomSub?.unsubscribe?.();
    this.realtimeUnreadSub?.unsubscribe?.();
  }

  loadRooms(): void {
    this.loading.set(true);
    this.error.set('');
    this.chatService.loadRooms().pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: rooms => {
        const firstUnread = rooms.find(room => room.unreadCount > 0);
        if (!this.activeRoom() && rooms.length > 0 && !firstUnread && window.innerWidth > 768) {
          this.selectRoom(rooms[0].id);
        }
      },
      error: error => {
        this.error.set('Could not load conversations.');
        this.toastService.error('Could not load conversations.');
        console.error(error);
      }
    });
  }

  private refreshRoomsQuietly(): void {
    if (!this.activeRoom() || document.visibilityState !== 'visible') {
      return;
    }
    this.chatService.loadRooms().subscribe({ error: () => undefined });
  }

  selectRoom(roomId: string): void {
    this.realtimeService.subscribeRoom(roomId);
    this.realtimeService.markRoomRead(roomId);
    this.chatService.setActiveRoom(roomId);
    this.infoPanelOpen.set(false);
  }

  backToList(): void {
    this.chatService.clearActiveRoom();
    this.infoPanelOpen.set(false);
  }

  toggleInfoPanel(): void {
    this.infoPanelOpen.update(value => !value);
  }
}
