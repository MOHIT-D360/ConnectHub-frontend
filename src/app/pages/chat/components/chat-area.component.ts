import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnChanges, OnDestroy, OnInit, ViewChild, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { Attachment, ChatService, MediaItem, Message, Room } from '../../../services/chat.service';
import { RealtimeService } from '../../../services/realtime.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="chat-area-container">
      <div class="chat-header">
        <div class="header-left">
          <button class="icon-btn mobile-only" (click)="backRequested.emit()" title="Back">
            <span aria-hidden="true">&#8592;</span>
          </button>
          <div class="room-avatar">
            <span class="avatar-fallback">{{ initials(room().name) }}</span>
            @if (room().avatar) {
              <img [src]="assetUrl(room().avatar)" [alt]="room().name" (error)="hideBrokenImage($event)">
            }
          </div>
          <div class="room-copy">
            <h3 class="room-title">{{ room().name }}</h3>
            <p class="room-subtitle">{{ room().type === 'GROUP' ? room().memberCount + ' members' : 'Direct message' }}</p>
          </div>
        </div>

        <div class="header-right">
          <button class="icon-btn" (click)="detailsRequested.emit()" title="Room details">
            <span aria-hidden="true">&#8505;</span>
          </button>
        </div>
      </div>

      <div #messagesContainer class="messages-container">
        @if (loading()) {
          <div class="state">Loading messages...</div>
        } @else if (error()) {
          <div class="state">
            <p>{{ error() }}</p>
            <button class="btn btn-primary btn-sm" (click)="loadMessages()">Retry</button>
          </div>
        } @else if (messages().length === 0) {
          <div class="state">
            <h3>No messages yet</h3>
            <p>Send the first message in this conversation.</p>
          </div>
        }

        @for (message of messages(); track message.id) {
          <div class="message-row" [class.own]="isOwnMessage(message)" [@messageIn]>
            @if (!isOwnMessage(message)) {
              <div class="message-avatar">
                <span class="avatar-fallback">{{ initials(message.senderName) }}</span>
                @if (message.senderAvatar) {
                  <img [src]="assetUrl(message.senderAvatar)" [alt]="message.senderName" (error)="hideBrokenImage($event)">
                }
              </div>
            }

            <div class="message-stack">
              <div class="message-bubble">
                @if (!isOwnMessage(message)) {
                  <p class="message-sender">{{ message.senderName }}</p>
                }

                @if (message.deleted) {
                  <p class="message-deleted">This message was deleted</p>
                } @else {
                  @if (message.content && message.attachments.length === 0) {
                    <p class="message-content">{{ message.content }}</p>
                  }
                  @if (message.attachments.length > 0) {
                    <div class="attachments">
                      @for (attachment of message.attachments; track attachment.id || attachment.url) {
                        <div class="attachment-card" [class.image-card]="attachment.type === 'image'">
                          @if (attachment.type === 'image') {
                            <a class="image-preview" [href]="attachment.downloadUrl || attachment.url" target="_blank" rel="noreferrer">
                              <img [src]="attachment.previewUrl || attachment.thumbnailUrl || attachment.url" [alt]="attachment.name" (error)="handlePreviewError($event)">
                            </a>
                          } @else {
                            <div class="attachment-thumb">{{ fileIcon(attachment) }}</div>
                          }
                          <div class="attachment-copy">
                            <p>{{ attachment.name }}</p>
                            <span>{{ attachment.contentType || 'File' }}{{ attachment.size ? ' - ' + formatSize(attachment.size) : '' }}</span>
                          </div>
                          <a class="download-btn" [href]="attachment.downloadUrl || attachment.url" target="_blank" rel="noreferrer" download title="Save">
                            <span aria-hidden="true">&#8681;</span>
                          </a>
                        </div>
                      }
                    </div>
                  }
                }

                @if ((message.reactions | keyvalue).length > 0) {
                  <div class="reactions">
                    @for (item of message.reactions | keyvalue; track item.key) {
                      <button class="reaction" (click)="react(message, item.key)">{{ item.key }} {{ item.value }}</button>
                    }
                  </div>
                }

                <div class="message-footer">
                  <span>{{ formatTime(message.timestamp) }}</span>
                  @if (isOwnMessage(message)) {
                    <span class="tick-status" [class.read]="message.status === 'READ'">{{ deliveryTicks(message) }}</span>
                  }
                </div>
              </div>

              <div class="quick-reactions">
                @for (emoji of reactionChoices; track emoji) {
                  <button class="reaction-choice" (click)="react(message, emoji)">{{ emoji }}</button>
                }
              </div>
            </div>
          </div>
        }
      </div>

      <div class="input-area">
        @if (uploading()) {
          <p class="upload-state">Uploading attachment...</p>
        }
        @if (pendingAttachment()) {
          <div class="pending-attachment" [class.pending-image]="isImageMedia(pendingAttachment()!)">
            @if (isImageMedia(pendingAttachment()!)) {
              <img [src]="pendingAttachment()!.previewUrl || pendingAttachment()!.thumbnailUrl || pendingAttachment()!.url" [alt]="pendingAttachment()!.fileName" (error)="hideBrokenImage($event)">
            }
            <div>
              <span>{{ pendingAttachment()!.fileName }}</span>
              <small>{{ pendingAttachment()!.contentType || 'File' }}{{ pendingAttachment()!.size ? ' - ' + formatSize(pendingAttachment()!.size!) : '' }}</small>
            </div>
            <button type="button" (click)="clearPendingAttachment()">Remove</button>
          </div>
        }
        <div class="input-container">
          <div class="emoji-wrap">
            <button class="input-action-btn icon-only" (click)="toggleEmojiPanel()" title="Add emoji">
              <svg class="mono-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-18a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-3 7a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 9 11Zm6 0a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 15 11Zm-8 2h2a3 3 0 0 0 6 0h2a5 5 0 0 1-10 0Z"/>
              </svg>
            </button>
            @if (emojiPanelOpen()) {
              <div class="emoji-panel" @panelIn>
                <emoji-picker class="emoji-picker" (emoji-click)="handleEmojiPick($event)"></emoji-picker>
              </div>
            }
          </div>
          <label class="input-action-btn icon-only file-label" title="Attach file">
            <svg class="mono-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M16.5 6.5 9.7 13.3a2.5 2.5 0 1 0 3.5 3.5l7.1-7.1a4 4 0 0 0-5.7-5.7L7.5 14.1a5.5 5.5 0 0 0 7.8 7.8l6.7-6.7 1.4 1.4-6.7 6.7A7.5 7.5 0 0 1 6.1 12.7l7.1-7.1a6 6 0 1 1 8.5 8.5l-7.1 7.1a4.5 4.5 0 0 1-6.4-6.4l6.8-6.8 1.5 1.5Z"/>
            </svg>
            <input type="file" (change)="uploadFile($event)" hidden>
          </label>
          <textarea
            #messageInput
            [(ngModel)]="inputMessage"
            placeholder="Type a message"
            rows="1"
            [disabled]="sending()"
            (keydown.enter)="handleEnter($event)">
          </textarea>
          <button class="send-btn" [disabled]="sending() || uploading() || (!inputMessage.trim() && !pendingAttachment())" (click)="sendMessage()">
            {{ sending() ? '...' : '➤' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host,
    .chat-area-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-width: 0;
      overflow: hidden;
    }

    .chat-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-lg);
      border-bottom: 1px solid var(--color-glass-border);
      background: var(--color-glass-light);
    }

    .header-left,
    .header-right,
    .input-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      min-width: 0;
    }

    .room-avatar,
    .message-avatar {
      position: relative;
      flex-shrink: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      color: white;
      font-weight: 800;
      text-transform: uppercase;
      overflow: hidden;
    }

    .avatar-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .room-avatar img,
    .message-avatar img {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .room-avatar {
      width: 42px;
      height: 42px;
      font-size: 13px;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      font-size: 11px;
    }

    .room-copy {
      min-width: 0;
    }

    .room-title {
      margin: 0;
      font-size: 16px;
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .room-subtitle {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 12px;
    }

    .icon-btn,
    .input-action-btn,
    .send-btn,
    .btn {
      min-height: 38px;
      padding: 0 12px;
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 700;
    }

    .mobile-only {
      display: none;
    }

    .icon-btn,
    .input-action-btn.icon-only,
    .send-btn,
    .download-btn {
      width: 40px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      font-size: 18px;
      line-height: 1;
    }

    .icon-btn:hover,
    .input-action-btn:hover,
    .send-btn:hover,
    .download-btn:hover,
    .reaction-choice:hover,
    .emoji-option:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 18px rgba(14, 165, 233, 0.22);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-lg);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .state {
      margin: auto;
      max-width: 320px;
      text-align: center;
      color: var(--color-text-muted);
    }

    .state h3 {
      color: var(--color-text-primary);
      font-size: 18px;
      margin-bottom: var(--spacing-sm);
    }

    .message-row {
      display: flex;
      align-items: flex-end;
      gap: var(--spacing-sm);
    }

    .message-row.own {
      justify-content: flex-end;
    }

    .message-stack {
      max-width: min(680px, 72%);
    }

    .message-bubble {
      padding: 10px 12px;
      border-radius: var(--radius-md);
      background: var(--color-glass-elevated);
      border: 1px solid var(--color-glass-border);
      color: var(--color-text-primary);
      overflow-wrap: anywhere;
      box-shadow: var(--shadow-sm);
    }

    .message-row.own .message-bubble {
      background: var(--color-primary);
      color: white;
      border-color: transparent;
      box-shadow: 0 10px 30px rgba(14, 165, 233, 0.2);
    }

    .message-sender {
      margin: 0 0 4px;
      color: var(--color-primary);
      font-size: 12px;
      font-weight: 800;
    }

    .message-content,
    .message-deleted {
      margin: 0;
      white-space: pre-wrap;
      font-size: 14px;
    }

    .message-deleted {
      color: var(--color-text-muted);
      font-style: italic;
    }

    .message-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
      margin-top: 5px;
      font-size: 11px;
      opacity: 0.78;
    }

    .tick-status {
      font-weight: 900;
      letter-spacing: 0;
    }

    .tick-status.read {
      color: #38bdf8;
    }

    .attachments {
      display: grid;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-sm);
    }

    .attachment-card,
    .pending-attachment {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: 8px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.12);
    }

    .attachment-card.image-card {
      display: grid;
      width: min(320px, 72vw);
      padding: 6px;
    }

    .image-preview {
      display: block;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: rgba(255, 255, 255, 0.14);
    }

    .image-preview img {
      display: block;
      width: 100%;
      max-height: 260px;
      object-fit: cover;
    }

    .image-preview.failed-preview {
      min-height: 120px;
      display: grid;
      place-items: center;
      color: inherit;
      opacity: 0.86;
      text-decoration: none;
    }

    .image-preview.failed-preview::after {
      content: 'Preview unavailable';
      font-size: 13px;
      font-weight: 800;
    }

    .attachment-card.image-card .attachment-copy {
      padding: 4px 2px 0;
    }

    .pending-attachment {
      margin-bottom: var(--spacing-sm);
      color: var(--color-text-primary);
    }

    .pending-attachment.pending-image {
      align-items: flex-start;
    }

    .pending-attachment.pending-image img {
      width: 84px;
      height: 84px;
      flex-shrink: 0;
      border-radius: var(--radius-sm);
      object-fit: cover;
    }

    .pending-attachment div {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .pending-attachment span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 800;
    }

    .pending-attachment small {
      color: var(--color-text-muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .attachment-thumb {
      width: 42px;
      height: 42px;
      flex-shrink: 0;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.18);
      font-size: 12px;
      font-weight: 800;
    }

    .attachment-thumb.image {
      object-fit: cover;
    }

    .attachment-copy {
      min-width: 0;
      flex: 1;
    }

    .attachment-copy p {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .attachment-copy span {
      display: block;
      font-size: 11px;
      opacity: 0.78;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .download-btn,
    .pending-attachment button {
      flex-shrink: 0;
      min-height: 30px;
      padding: 0 10px;
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
      color: inherit;
      text-decoration: none;
      font-size: 12px;
      font-weight: 800;
    }

    .reactions,
    .quick-reactions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 7px;
    }

    .quick-reactions {
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .message-row:hover .quick-reactions {
      opacity: 1;
    }

    .reaction,
    .reaction-choice {
      border-radius: 999px;
      background: var(--color-glass-light);
      color: var(--color-text-primary);
      border: 1px solid var(--color-glass-border);
      padding: 2px 8px;
      font-size: 12px;
    }

    .input-area {
      flex-shrink: 0;
      padding: var(--spacing-md) var(--spacing-lg);
      border-top: 1px solid var(--color-glass-border);
      background: var(--color-glass-light);
    }

    .emoji-wrap {
      position: relative;
    }

    .emoji-panel {
      position: absolute;
      left: 0;
      bottom: calc(100% + 10px);
      z-index: 10;
      width: 280px;
      max-height: 220px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
      padding: 10px;
      border-radius: var(--radius-md);
      background: var(--color-glass-elevated);
      border: 1px solid var(--color-glass-border);
      box-shadow: var(--shadow-lg);
      transform-origin: bottom left;
    }

    .emoji-picker {
      width: 100%;
      height: 100%;
      --background: transparent;
    }

    .mono-icon {
      width: 18px;
      height: 18px;
      color: currentColor;
      display: block;
    }

    textarea {
      flex: 1;
      min-height: 42px;
      max-height: 120px;
      resize: none;
      font-size: 14px;
      min-width: 0;
    }

    .send-btn,
    .btn-primary {
      background: var(--color-primary);
      color: white;
    }

    .upload-state {
      margin: 0 0 var(--spacing-sm);
      color: var(--color-text-muted);
      font-size: 12px;
    }

    @media (max-width: 768px) {
      .mobile-only {
        display: inline-flex;
      }

      .chat-header,
      .messages-container,
      .input-area {
        padding-left: var(--spacing-md);
        padding-right: var(--spacing-md);
      }

      .message-stack {
        max-width: 84%;
      }

      .input-container {
        gap: var(--spacing-sm);
      }

      .input-action-btn {
        padding: 0 8px;
      }
    }
  `],
  animations: [
    trigger('messageIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('panelIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px) scale(0.96)' }),
        animate('170ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ])
    ])
  ]
})
export class ChatAreaComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly realtimeService = inject(RealtimeService);

  readonly room = input.required<Room>();
  readonly backRequested = output<void>();
  readonly detailsRequested = output<void>();
  readonly messages = signal<Message[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly emojiPanelOpen = signal(false);
  readonly pendingAttachment = signal<MediaItem | null>(null);
  readonly currentUser = this.authService.currentUser;
  readonly reactionChoices = ['👍', '❤️', '😂', '🙏', '🎉'];
  // emoji-picker-element provides the full set; we keep quick reactions above.

  inputMessage = '';
  private lastLoadedRoomId = '';
  private shouldScroll = false;
  private messageTimer?: number;
  private firstLoad = true;
  private realtimeRoomSub?: any;

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLElement>;
  @ViewChild('messageInput') messageInput?: ElementRef<HTMLTextAreaElement>;

  ngOnInit(): void {
    this.realtimeService.connect();
    this.realtimeRoomSub = this.realtimeService.roomMessages$.subscribe(envelope => {
      const roomId = this.room().id;
      if (!envelope.destination.includes(`/topic/room/${roomId}`)) {
        return;
      }
      // ChatService cache is updated by ChatLayout realtime listener.
      this.messages.set(this.chatService.messagesFor(roomId));
      this.shouldScroll = true;
    });
  }

  ngOnChanges(): void {
    if (this.room().id !== this.lastLoadedRoomId) {
      this.lastLoadedRoomId = this.room().id;
      this.pendingAttachment.set(null);
      this.inputMessage = '';
      this.loadMessages();
      this.startMessagePolling();
    }
  }

  ngOnDestroy(): void {
    if (this.messageTimer) {
      window.clearInterval(this.messageTimer);
    }
    this.realtimeRoomSub?.unsubscribe?.();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.shouldScroll = false;
      const element = this.messagesContainer?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }
  }

  loadMessages(): void {
    this.loading.set(true);
    this.error.set('');
    this.chatService.loadMessages(this.room().id).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: messages => {
        const previousLastId = this.messages().at(-1)?.id;
        this.messages.set(messages);
        this.markMessagesRead(messages);
        this.shouldScroll = this.firstLoad || previousLastId !== messages.at(-1)?.id;
        this.firstLoad = false;
      },
      error: error => {
        this.error.set('Could not load messages.');
        console.error(error);
      }
    });
  }

  private refreshMessagesQuietly(): void {
    // Polling is kept as a safety-net, but realtime is the primary source of updates.
    // This avoids stale UI if a websocket reconnect is in progress.
    const roomId = this.room().id;
    this.chatService.loadMessages(roomId).subscribe({ error: () => undefined });
  }

  private startMessagePolling(): void {
    if (this.messageTimer) {
      window.clearInterval(this.messageTimer);
    }
    this.firstLoad = true;
    this.messageTimer = window.setInterval(() => this.refreshMessagesQuietly(), 3000);
  }

  private markMessagesRead(messages: Message[]): void {
    for (const message of messages) {
      if (!this.isOwnMessage(message) && message.status !== 'READ') {
        this.chatService.updateMessageStatus(message.id, 'READ').subscribe({ error: () => undefined });
      }
    }
  }

  sendMessage(): void {
    if (this.sending()) return;

    const content = this.inputMessage.trim();
    const attachment = this.pendingAttachment();
    if (!content && !attachment) return;

    this.sending.set(true);
    const request = attachment
      ? this.chatService.sendMediaMessage(this.room().id, { ...attachment, fileName: content || attachment.fileName })
      : this.chatService.sendMessage(this.room().id, content);

    request.pipe(
      finalize(() => this.sending.set(false))
    ).subscribe({
      next: message => {
        this.messages.update(messages => {
          const next = messages.some(item => item.id === message.id)
            ? messages.map(item => item.id === message.id ? message : item)
            : [...messages, message];
          return next.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
        this.resetComposer();
        this.shouldScroll = true;
      },
      error: () => this.toastService.error('Could not send message.')
    });
  }

  private resetComposer(): void {
    this.inputMessage = '';
    this.pendingAttachment.set(null);
    const input = this.messageInput?.nativeElement;
    if (input) {
      input.value = '';
      input.style.height = '';
      input.blur();
    }
  }

  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.chatService.uploadMedia(this.room().id, file).pipe(
      finalize(() => {
        this.uploading.set(false);
        input.value = '';
      })
    ).subscribe({
      next: media => {
        this.toastService.success('Attachment uploaded.');
        this.pendingAttachment.set(media);
      },
      error: error => this.toastService.error(this.uploadErrorMessage(error, 'Could not upload attachment.'))
    });
  }

  react(message: Message, emoji: string): void {
    this.chatService.addReaction(this.room().id, message.id, emoji).subscribe({
      next: () => this.messages.set(this.chatService.messagesFor(this.room().id)),
      error: () => this.toastService.error('Could not add reaction.')
    });
  }

  appendEmoji(emoji: string): void {
    this.inputMessage = `${this.inputMessage}${emoji}`;
    this.emojiPanelOpen.set(false);
  }

  handleEmojiPick(event: Event): void {
    const anyEvent = event as any;
    const emoji = anyEvent?.detail?.emoji?.unicode;
    if (typeof emoji === 'string' && emoji) {
      this.appendEmoji(emoji);
    }
  }

  toggleEmojiPanel(): void {
    this.emojiPanelOpen.update(open => !open);
  }

  clearPendingAttachment(): void {
    this.pendingAttachment.set(null);
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      if (!this.sending()) {
        this.sendMessage();
      }
    }
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.currentUser()?.id;
  }

  assetUrl(value?: string): string {
    return this.chatService.assetUrl(value);
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
  }

  handlePreviewError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
    image.parentElement?.classList.add('failed-preview');
  }

  private uploadErrorMessage(error: unknown, fallback: string): string {
    const body = (error as any)?.error;
    const message = typeof body === 'string'
      ? body
      : body?.error || body?.message || body?.details;
    return message ? `Upload failed: ${message}` : fallback;
  }

  initials(name?: string): string {
    return (name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  fileIcon(attachment: Attachment): string {
    if (attachment.contentType?.includes('pdf')) return 'PDF';
    if (attachment.contentType?.includes('word')) return 'DOC';
    if (attachment.contentType?.includes('zip')) return 'ZIP';
    return 'FILE';
  }

  isImageMedia(media: MediaItem): boolean {
    return Boolean(media.contentType?.startsWith('image/') || media.previewUrl || media.thumbnailUrl);
  }

  formatSize(size: number): string {
    const bytes = size > 0 && size < 100000 ? size * 1024 : size;
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  deliveryTicks(message: Message): string {
    if (message.status === 'READ') return '✓✓';
    if (message.status === 'DELIVERED') return '✓✓';
    return '✓';
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
}
