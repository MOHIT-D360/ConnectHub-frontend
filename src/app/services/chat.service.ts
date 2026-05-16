import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';

const MEDIA_API_PATH = '/api/v1/media';
const LEGACY_PUBLIC_MEDIA_API_PATH = MEDIA_API_PATH.replace('/media', '/public/media');

export type RoomType = 'DM' | 'GROUP';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface ChatUser {
  id: string;
  userId?: number | string;
  username?: string;
  fullName?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  avatar?: string;
  bio?: string;
  status?: string;
  role?: string;
  subscriptionTier?: string;
  online?: boolean;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'video' | 'audio';
  name: string;
  url: string;
  size: number;
  contentType?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  previewUrl?: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  reactions: Record<string, number>;
  replyTo?: Message;
  edited?: boolean;
  deleted?: boolean;
  attachments: Attachment[];
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  avatar?: string;
  bio?: string;
  lastMessage?: Message;
  unreadCount: number;
  memberCount: number;
  members: string[];
  createdAt: Date;
  updatedAt?: Date;
  description?: string;
  maxMembers?: number;
  ownerId?: string;
  pinnedMessageId?: string;
}

export interface RoomMember {
  userId: string;
  username?: string;
  name: string;
  avatar?: string;
  bio?: string;
  role: MemberRole;
  muted?: boolean;
  joinedAt?: Date;
}

export interface MediaItem {
  id: string;
  roomId?: string;
  messageId?: string;
  fileName: string;
  url?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  previewUrl?: string;
  contentType?: string;
  size?: number;
  uploadedBy?: string;
  createdAt?: Date;
}

export interface NotificationItem {
  id: string;
  recipientId?: string;
  actorId?: string;
  type: string;
  title: string;
  message: string;
  roomId?: string;
  messageId?: string;
  read: boolean;
  createdAt: Date;
}

export interface CreateRoomRequest {
  name?: string;
  type: RoomType;
  memberIds: string[];
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly apiUrl = environment.apiBaseUrl;

  private readonly roomsSignal = signal<Room[]>([]);
  private readonly messagesSignal = signal<Map<string, Message[]>>(new Map());
  private readonly activeRoomSignal = signal<Room | null>(null);
  private readonly pendingMessageResolvers = new Map<string, { resolve: (value: Message) => void; reject: (error: unknown) => void; timeout: number }>();

  private readonly roomMembersSignal = signal<Map<string, RoomMember[]>>(new Map());
  private readonly mediaSignal = signal<Map<string, MediaItem[]>>(new Map());
  private readonly userCache = new Map<string, ChatUser>();

  readonly rooms = this.roomsSignal.asReadonly();
  readonly activeRoom = this.activeRoomSignal.asReadonly();
  readonly totalUnread = computed(() => this.roomsSignal().reduce((sum, room) => sum + room.unreadCount, 0));

  assetUrl(value?: string): string {
    return this.resolveMediaSource(value, 'view');
  }

  loadRooms(userId = this.currentUserId()): Observable<Room[]> {
    if (!userId) {
      this.roomsSignal.set([]);
      this.activeRoomSignal.set(null);
      return of([]);
    }

    return this.http.get<unknown[]>(`${this.apiUrl}/api/v1/rooms/user/${encodeURIComponent(userId)}`).pipe(
      map(response => this.asArray(response).map(room => this.normalizeRoom(room))),
      switchMap(rooms => this.applyCachedMembers(rooms)),
      switchMap(rooms => this.loadUnreadCounts(userId).pipe(
        map(counts => rooms.map(room => ({
          ...room,
          unreadCount: room.id === this.getActiveRoomId() ? 0 : (counts.get(room.id) ?? room.unreadCount)
        }))),
        catchError(() => of(rooms))
      )),
      switchMap(rooms => this.applyLatestMessages(rooms)),
      tap(rooms => {
        this.roomsSignal.set(this.sortRooms(rooms));
        const active = this.activeRoomSignal();
        if (active && !rooms.some(room => room.id === active.id)) {
          this.activeRoomSignal.set(null);
        } else if (active) {
          const refreshedActive = rooms.find(room => room.id === active.id);
          if (refreshedActive) {
            this.activeRoomSignal.set({ ...refreshedActive, unreadCount: 0 });
          }
        }
      })
    );
  }

  refreshActiveRoom(roomId: string): Observable<Room> {
    return this.http.get<unknown>(`${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}`).pipe(
      map(room => this.normalizeRoom(room)),
      tap(room => this.upsertRoom(room))
    );
  }

  setActiveRoom(roomId: string): Room | undefined {
    const room = this.roomsSignal().find(item => item.id === roomId);
    if (room) {
      this.activeRoomSignal.set({ ...room, unreadCount: 0 });
      this.markRoomAsRead(roomId).subscribe({ error: () => undefined });
    }
    return room;
  }

  clearActiveRoom(): void {
    this.activeRoomSignal.set(null);
  }

  loadMessages(roomId: string, before?: Date, limit = 50): Observable<Message[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (before) {
      params = params.set('before', before.toISOString());
    }

    return this.http.get<unknown[]>(`${this.apiUrl}/api/v1/messages/room/${encodeURIComponent(roomId)}`, { params }).pipe(
      map(response => this.sortMessages(this.asArray(response).map(message => this.normalizeMessage(message, roomId)))),
      switchMap(messages => this.enrichMessages(messages)),
      tap(messages => {
        const current = new Map(this.messagesSignal());
        current.set(roomId, messages);
        this.messagesSignal.set(current);
      })
    );
  }

  messagesFor(roomId: string): Message[] {
    return this.messagesSignal().get(roomId) || [];
  }

  getActiveRoomId(): string {
    return this.activeRoomSignal()?.id || '';
  }

  sendMessage(roomId: string, content: string, attachmentIds: string[] = []): Observable<Message> {
    if (attachmentIds.length > 0) {
      // Attachments are handled via media-service; the message itself is still sent via websocket.
    }
    return this.sendViaRealtime(roomId, content, 'TEXT');
  }

  sendMediaMessage(roomId: string, media: MediaItem): Observable<Message> {
    const mediaPayload = this.encodeMediaContent(media);
    return this.sendViaRealtime(roomId, mediaPayload, 'MEDIA');
  }

  sendViaRealtime(roomId: string, content: string, type: string): Observable<Message> {
    const messageId = this.newMessageId();
    const dispatched = this.realtimeService.sendChatMessage({ roomId, messageId, content, type });
    if (!dispatched) {
      return throwError(() => new Error('Realtime connection is not available'));
    }

    const optimisticMessage = this.buildOptimisticMessage(roomId, messageId, content);
    this.addMessageToCache(roomId, optimisticMessage);
    return of(optimisticMessage);
  }

  handleRealtimeRoomMessage(destination: string, body: unknown): void {
    const roomIdMatch = destination.match(/\/topic\/room\/([^/]+)/);
    const roomId = roomIdMatch?.[1] ? decodeURIComponent(roomIdMatch[1]) : '';
    if (!roomId) return;

    const message = this.normalizeMessage(body as any, roomId);
    this.enrichMessages([message]).subscribe({
      next: (messages) => {
        const enriched = messages[0];
        this.addMessageToCache(roomId, enriched);

        const pending = this.pendingMessageResolvers.get(enriched.id);
        if (pending) {
          this.pendingMessageResolvers.delete(enriched.id);
          pending.resolve(enriched);
        }
      },
      error: () => {
        this.addMessageToCache(roomId, message);
        const pending = this.pendingMessageResolvers.get(message.id);
        if (pending) {
          this.pendingMessageResolvers.delete(message.id);
          pending.resolve(message);
        }
      }
    });
  }

  applyUnreadUpdate(roomId: string, count: number): void {
    if (!roomId) return;
    const activeId = this.getActiveRoomId();
    this.roomsSignal.update(rooms => rooms.map(room => {
      if (room.id !== roomId) return room;
      return { ...room, unreadCount: roomId === activeId ? 0 : Math.max(0, Number(count || 0)) };
    }));
    const active = this.activeRoomSignal();
    if (active?.id === roomId) {
      this.activeRoomSignal.set({ ...active, unreadCount: 0 });
    }
  }

  private newMessageId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  updateMessage(messageId: string, content: string): Observable<Message> {
    return this.http.put<unknown>(`${this.apiUrl}/api/v1/messages/${encodeURIComponent(messageId)}`, { content }).pipe(
      map(response => this.normalizeMessage(response)),
      tap(message => this.replaceMessageInCache(message))
    );
  }

  updateMessageStatus(messageId: string, status: MessageStatus): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/api/v1/messages/${encodeURIComponent(messageId)}/status`, { status });
  }

  deleteMessage(roomId: string, messageId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/messages/${encodeURIComponent(messageId)}`).pipe(
      tap(() => {
        const current = new Map(this.messagesSignal());
        current.set(
          roomId,
          (current.get(roomId) || []).map(message => message.id === messageId ? { ...message, deleted: true, content: '' } : message)
        );
        this.messagesSignal.set(current);
      })
    );
  }

  addReaction(roomId: string, messageId: string, emoji: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/api/v1/messages/${encodeURIComponent(messageId)}/reactions`, { emoji }).pipe(
      tap(() => {
        const current = new Map(this.messagesSignal());
        const messages = (current.get(roomId) || []).map(message => {
          if (message.id !== messageId) {
            return message;
          }
          const reactions = { ...message.reactions, [emoji]: (message.reactions[emoji] || 0) + 1 };
          return { ...message, reactions };
        });
        current.set(roomId, messages);
        this.messagesSignal.set(current);
      })
    );
  }

  loadReactions(roomId: string, messageId: string): Observable<Record<string, number>> {
    return this.http.get<unknown>(`${this.apiUrl}/api/v1/messages/${encodeURIComponent(messageId)}/reactions`).pipe(
      map(response => this.normalizeReactions(response)),
      tap(reactions => {
        const current = new Map(this.messagesSignal());
        current.set(
          roomId,
          (current.get(roomId) || []).map(message => message.id === messageId ? { ...message, reactions } : message)
        );
        this.messagesSignal.set(current);
      })
    );
  }

  searchUsers(query: string): Observable<ChatUser[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return of([]);
    }

    return this.http.get<unknown[]>(`${this.apiUrl}/api/v1/auth/search`, {
      params: new HttpParams().set('q', trimmed)
    }).pipe(
      map(response => this.asArray(response).map(user => this.normalizeUser(user)))
    );
  }

  createRoom(request: CreateRoomRequest): Observable<Room> {
    const body = {
      ...request,
      createdBy: this.currentUserId()
    };

    return this.http.post<unknown>(`${this.apiUrl}/api/v1/rooms`, body).pipe(
      map(response => this.normalizeRoom(response)),
      switchMap(room => this.loadMembers(room.id).pipe(
        map(members => this.withMemberDisplay(room, members)),
        catchError(() => of(room))
      )),
      tap(room => this.upsertRoom(room))
    );
  }

  updateRoom(roomId: string, updates: Partial<Pick<Room, 'name' | 'description'> & { avatarUrl: string }>): Observable<Room> {
    return this.http.put<unknown>(`${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}`, updates).pipe(
      map(response => this.normalizeRoom(response)),
      switchMap(room => this.loadMembers(room.id).pipe(
        map(members => this.withMemberDisplay(room, members)),
        catchError(() => of(room))
      )),
      tap(room => this.upsertRoom(room))
    );
  }

  deleteRoom(roomId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}`).pipe(
      tap(() => {
        this.roomsSignal.update(rooms => rooms.filter(room => room.id !== roomId));
        if (this.activeRoomSignal()?.id === roomId) {
          this.activeRoomSignal.set(null);
        }
      })
    );
  }

  loadMembers(roomId: string): Observable<RoomMember[]> {
    return this.http.get<unknown[]>(`${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}/members`).pipe(
      map(response => this.asArray(response).map(member => this.normalizeMember(member))),
      switchMap(members => this.enrichMembers(members)),
      tap(members => {
        const current = new Map(this.roomMembersSignal());
        current.set(roomId, members);
        this.roomMembersSignal.set(current);

        const applyMembers = (room: Room) => room.id === roomId ? this.withMemberDisplay(room, members) : room;
        this.roomsSignal.update(rooms => rooms.map(applyMembers));
        const active = this.activeRoomSignal();
        if (active?.id === roomId) {
          this.activeRoomSignal.set(applyMembers(active));
        }
      })
    );
  }

  membersFor(roomId: string): RoomMember[] {
    return this.roomMembersSignal().get(roomId) || [];
  }

  addMember(roomId: string, userId: string, role: MemberRole = 'MEMBER'): Observable<RoomMember[]> {
    return this.http.post<void>(
      `${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`,
      {},
      { params: new HttpParams().set('role', role) }
    ).pipe(
      map(() => [] as RoomMember[]),
      tap(() => this.loadMembers(roomId).subscribe({ error: () => undefined }))
    );
  }

  removeMember(roomId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`).pipe(
      tap(() => {
        const current = new Map(this.roomMembersSignal());
        current.set(roomId, (current.get(roomId) || []).filter(member => member.userId !== userId));
        this.roomMembersSignal.set(current);
      })
    );
  }

  changeMemberRole(roomId: string, userId: string, role: MemberRole): Observable<RoomMember[]> {
    return this.http.put<void>(
      `${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/role`,
      { role }
    ).pipe(
      map(() => [] as RoomMember[]),
      tap(() => this.loadMembers(roomId).subscribe({ error: () => undefined }))
    );
  }

  uploadMedia(roomId: string, file: File): Observable<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);

    return this.http.post<unknown>(`${this.apiUrl}/api/v1/media/upload`, formData).pipe(
      map(response => this.normalizeMedia(response, roomId)),
      tap(media => {
        const current = new Map(this.mediaSignal());
        current.set(roomId, [media, ...(current.get(roomId) || [])]);
        this.mediaSignal.set(current);
      })
    );
  }

  loadMedia(roomId: string): Observable<MediaItem[]> {
    return this.http.get<unknown[]>(`${this.apiUrl}/api/v1/media/room/${encodeURIComponent(roomId)}`).pipe(
      map(response => this.asArray(response).map(item => this.normalizeMedia(item, roomId))),
      tap(media => {
        const current = new Map(this.mediaSignal());
        current.set(roomId, media);
        this.mediaSignal.set(current);
      })
    );
  }

  mediaFor(roomId: string): MediaItem[] {
    return this.mediaSignal().get(roomId) || [];
  }

  refreshUserReferences(userId?: string): void {
    if (userId) {
      this.userCache.delete(String(userId));
    } else {
      this.userCache.clear();
    }

    const activeRoomId = this.activeRoomSignal()?.id;
    if (activeRoomId) {
      this.loadMembers(activeRoomId).subscribe({ error: () => undefined });
      this.loadMessages(activeRoomId).subscribe({ error: () => undefined });
    }
    this.loadRooms().subscribe({ error: () => undefined });
  }

  hydrateRoomDetails(roomId: string): Observable<[RoomMember[], MediaItem[]]> {
    return forkJoin([this.loadMembers(roomId), this.loadMedia(roomId)]);
  }

  loadNotifications(userId = this.currentUserId()): Observable<NotificationItem[]> {
    if (!userId) {
      return of([]);
    }

    return this.http.get<unknown[]>(`${this.apiUrl}/api/v1/notifications/user/${encodeURIComponent(userId)}`).pipe(
      map(response => this.asArray(response).map(item => this.normalizeNotification(item)))
    );
  }

  loadUnreadNotificationCount(userId = this.currentUserId()): Observable<number> {
    if (!userId) {
      return of(0);
    }

    return this.http.get<number>(`${this.apiUrl}/api/v1/notifications/user/${encodeURIComponent(userId)}/unread-count`);
  }

  loadUnreadCounts(userId = this.currentUserId()): Observable<Map<string, number>> {
    if (!userId) {
      return of(new Map());
    }

    return this.http.get<Record<string, number>>(`${this.apiUrl}/api/v1/ws/unread/${encodeURIComponent(userId)}`).pipe(
      map(response => new Map(Object.entries(response || {}).map(([roomId, count]) => [String(roomId), Number(count || 0)])))
    );
  }

  markAllNotificationsRead(userId = this.currentUserId()): Observable<void> {
    if (!userId) {
      return of(void 0);
    }

    return this.http.put<void>(`${this.apiUrl}/api/v1/notifications/user/${encodeURIComponent(userId)}/read-all`, {});
  }

  markRoomAsRead(roomId: string): Observable<void> {
    const userId = this.currentUserId();
    if (!userId) {
      return of(void 0);
    }

    return this.http.put<void>(`${this.apiUrl}/api/v1/rooms/${encodeURIComponent(roomId)}/read/${encodeURIComponent(userId)}`, {}).pipe(
      tap(() => {
        this.roomsSignal.update(rooms => rooms.map(room => room.id === roomId ? { ...room, unreadCount: 0 } : room));
      })
    );
  }

  private currentUserId(): string {
    return this.authService.getCurrentUser()?.id || '';
  }

  private addMessageToCache(roomId: string, message: Message): void {
    const current = new Map(this.messagesSignal());
    const existing = current.get(roomId) || [];
    const messages = this.sortMessages(
      existing.some(item => item.id === message.id)
        ? existing.map(item => item.id === message.id ? message : item)
        : [...existing, message]
    );
    current.set(roomId, messages);
    this.messagesSignal.set(current);
    this.roomsSignal.update(rooms => this.sortRooms(rooms.map(room => room.id === roomId ? { ...room, lastMessage: message, updatedAt: message.timestamp } : room)));
  }

  private buildOptimisticMessage(roomId: string, messageId: string, content: string): Message {
    const currentUser = this.authService.getCurrentUser();
    const media = this.decodeMediaContent(content);
    return {
      id: messageId,
      roomId,
      senderId: String(currentUser?.id ?? currentUser?.userId ?? ''),
      senderName: String(currentUser?.name ?? currentUser?.fullName ?? currentUser?.username ?? 'You'),
      senderAvatar: this.assetUrl(currentUser?.avatar ?? currentUser?.avatarUrl ?? ''),
      content: media ? media.fileName : content,
      timestamp: new Date(),
      status: 'SENT',
      reactions: {},
      attachments: media ? [this.normalizeAttachment(media)] : []
    };
  }

  private replaceMessageInCache(message: Message): void {
    const current = new Map(this.messagesSignal());
    const messages = current.get(message.roomId) || [];
    current.set(message.roomId, messages.map(item => item.id === message.id ? message : item));
    this.messagesSignal.set(current);
  }

  private upsertRoom(room: Room): void {
    this.roomsSignal.update(rooms => {
      const exists = rooms.some(item => item.id === room.id);
      return this.sortRooms(exists ? rooms.map(item => item.id === room.id ? room : item) : [room, ...rooms]);
    });
    if (this.activeRoomSignal()?.id === room.id) {
      this.activeRoomSignal.set(room);
    }
  }

  private normalizeRoom(raw: any): Room {
    const id = String(raw?.id ?? raw?.roomId ?? raw?._id ?? '');
    const type = String(raw?.type ?? raw?.roomType ?? 'DM').toUpperCase() === 'GROUP' ? 'GROUP' : 'DM';
    const members = this.asArray(raw?.members ?? raw?.memberIds).map(member => String(member?.userId ?? member?.id ?? member));
    const lastMessage = raw?.lastMessage ? this.normalizeMessage(raw.lastMessage, id) : undefined;

    return {
      id,
      name: String(raw?.name ?? raw?.roomName ?? raw?.title ?? (type === 'DM' ? 'Direct message' : 'Group')),
      type,
      avatar: this.assetUrl(raw?.avatarUrl ?? raw?.avatar ?? ''),
      lastMessage,
      unreadCount: Number(raw?.unreadCount ?? raw?.unread ?? 0),
      memberCount: Number(raw?.memberCount ?? raw?.membersCount ?? members.length ?? 0),
      members,
      createdAt: this.toDate(raw?.createdAt ?? raw?.createdDate),
      updatedAt: raw?.updatedAt || raw?.lastActivityAt ? this.toDate(raw?.updatedAt ?? raw?.lastActivityAt) : undefined,
      description: raw?.description,
      maxMembers: raw?.maxMembers,
      ownerId: raw?.ownerId ? String(raw.ownerId) : undefined,
      pinnedMessageId: raw?.pinnedMessageId ? String(raw.pinnedMessageId) : undefined
    };
  }

  private normalizeMessage(raw: any, fallbackRoomId = ''): Message {
    const sender = raw?.sender ?? raw?.user ?? {};
    const content = this.decodeHtmlEntities(String(raw?.content ?? raw?.text ?? raw?.message ?? ''));
    const encodedMedia = this.decodeMediaContent(content);
    const mediaAttachment = encodedMedia ? [this.normalizeAttachment(encodedMedia)] : (raw?.mediaUrl || raw?.thumbnailUrl ? [this.normalizeAttachment(raw)] : []);
    return {
      id: String(raw?.id ?? raw?.messageId ?? raw?._id ?? ''),
      roomId: String(raw?.roomId ?? raw?.room?.id ?? fallbackRoomId),
      senderId: String(raw?.senderId ?? sender?.userId ?? sender?.id ?? ''),
      senderName: String(raw?.senderName ?? sender?.fullName ?? sender?.username ?? 'Unknown user'),
      senderAvatar: this.assetUrl(raw?.senderAvatar ?? sender?.avatarUrl ?? sender?.avatar ?? ''),
      content: encodedMedia ? encodedMedia.fileName : content,
      timestamp: this.toDate(raw?.timestamp ?? raw?.createdAt ?? raw?.sentAt),
      status: this.normalizeStatus(raw?.status ?? raw?.deliveryStatus),
      reactions: this.normalizeReactions(raw?.reactions),
      replyTo: raw?.replyTo ? this.normalizeMessage(raw.replyTo, fallbackRoomId) : undefined,
      edited: Boolean(raw?.edited ?? raw?.isEdited),
      deleted: Boolean(raw?.deleted ?? raw?.isDeleted),
      attachments: [
        ...this.asArray(raw?.attachments ?? raw?.media).map(item => this.normalizeAttachment(item)),
        ...mediaAttachment
      ]
    };
  }

  private normalizeAttachment(raw: any): Attachment {
    const id = String(raw?.id ?? raw?.mediaId ?? '');
    const rawDownload = String(raw?.downloadUrl ?? raw?.url ?? raw?.mediaUrl ?? '');
    const rawPreview = String(raw?.previewUrl ?? raw?.thumbnailUrl ?? raw?.url ?? raw?.mediaUrl ?? rawDownload);
    const downloadUrl = id ? this.mediaDownloadUrl(id) : this.resolveMediaSource(rawDownload, 'download');
    const previewUrl = id ? this.mediaViewUrl(id) : this.resolveMediaSource(rawPreview, 'view');

    return {
      id,
      type: this.attachmentType(raw?.contentType ?? raw?.mimeType ?? raw?.type),
      name: String(raw?.name ?? raw?.fileName ?? raw?.originalName ?? raw?.content ?? 'Attachment'),
      url: downloadUrl,
      size: Number(raw?.size ?? raw?.sizeKb ?? 0),
      contentType: raw?.contentType ?? raw?.mimeType,
      thumbnailUrl: previewUrl,
      downloadUrl,
      previewUrl
    };
  }

  private normalizeMember(raw: any): RoomMember {
    const user = raw?.user ?? raw?.profile ?? raw;
    return {
      userId: String(raw?.userId ?? user?.userId ?? user?.id ?? ''),
      username: user?.username,
      name: String(user?.fullName ?? user?.name ?? user?.username ?? raw?.name ?? 'Unknown user'),
      avatar: this.assetUrl(user?.avatarUrl ?? user?.avatar),
      bio: user?.bio,
      role: this.normalizeRole(raw?.role),
      muted: Boolean(raw?.muted),
      joinedAt: raw?.joinedAt ? this.toDate(raw.joinedAt) : undefined
    };
  }

  private normalizeUser(raw: any): ChatUser {
    return {
      ...raw,
      id: String(raw?.id ?? raw?.userId ?? ''),
      name: String(raw?.name ?? raw?.fullName ?? raw?.username ?? 'Unknown user'),
      avatar: this.assetUrl(raw?.avatar ?? raw?.avatarUrl),
      avatarUrl: this.assetUrl(raw?.avatarUrl ?? raw?.avatar),
      bio: raw?.bio,
      online: Boolean(raw?.online)
    };
  }

  private normalizeMedia(raw: any, fallbackRoomId = ''): MediaItem {
    const id = String(raw?.id ?? raw?.mediaId ?? '');
    const rawDownload = raw?.downloadUrl ?? raw?.url ?? raw?.mediaUrl;
    const rawPreview = raw?.previewUrl ?? raw?.thumbnailUrl ?? raw?.url ?? raw?.mediaUrl ?? rawDownload;
    const downloadUrl = id ? this.mediaDownloadUrl(id) : this.resolveMediaSource(rawDownload, 'download');
    const previewUrl = id ? this.mediaViewUrl(id) : this.resolveMediaSource(rawPreview, 'view');

    return {
      id,
      roomId: String(raw?.roomId ?? fallbackRoomId),
      messageId: raw?.messageId ? String(raw.messageId) : undefined,
      fileName: String(raw?.fileName ?? raw?.name ?? raw?.originalName ?? 'Media'),
      url: downloadUrl,
      thumbnailUrl: previewUrl,
      downloadUrl,
      previewUrl,
      contentType: raw?.contentType ?? raw?.mimeType,
      size: Number(raw?.size ?? raw?.sizeKb ?? 0),
      uploadedBy: raw?.uploadedBy ?? raw?.uploaderId ? String(raw?.uploadedBy ?? raw?.uploaderId) : undefined,
      createdAt: raw?.createdAt || raw?.uploadedAt ? this.toDate(raw?.createdAt ?? raw?.uploadedAt) : undefined
    };
  }

  private normalizeNotification(raw: any): NotificationItem {
    return {
      id: String(raw?.id ?? raw?.notificationId ?? ''),
      recipientId: raw?.recipientId ? String(raw.recipientId) : undefined,
      actorId: raw?.actorId ? String(raw.actorId) : undefined,
      type: String(raw?.type ?? 'NOTIFICATION'),
      title: String(raw?.title ?? 'Notification'),
      message: String(raw?.message ?? ''),
      roomId: raw?.roomId ? String(raw.roomId) : undefined,
      messageId: raw?.messageId ? String(raw.messageId) : undefined,
      read: Boolean(raw?.read ?? raw?.isRead),
      createdAt: this.toDate(raw?.createdAt)
    };
  }

  private encodeMediaContent(media: MediaItem): string {
    return `__CONNECTHUB_MEDIA__${JSON.stringify({
      id: media.id,
      fileName: media.fileName,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      downloadUrl: media.downloadUrl,
      previewUrl: media.previewUrl,
      contentType: media.contentType,
      size: media.size
    })}`;
  }

  private decodeMediaContent(content: string): MediaItem | null {
    const marker = '__CONNECTHUB_MEDIA__';
    if (!content.startsWith(marker)) {
      return null;
    }

    try {
      const media = JSON.parse(content.slice(marker.length));
      return this.normalizeMedia(media);
    } catch {
      return null;
    }
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private withMemberDisplay(room: Room, members: RoomMember[]): Room {
    if (room.type === 'DM') {
      const currentUserId = this.currentUserId();
      const other = members.find(member => member.userId !== currentUserId) || members[0];
      return {
        ...room,
        name: other?.name || room.name,
        avatar: other?.avatar || room.avatar,
        memberCount: members.length,
        members: members.map(member => member.userId)
      };
    }

    return {
      ...room,
      memberCount: members.length,
      members: members.map(member => member.userId)
    };
  }

  private applyCachedMembers(rooms: Room[]): Observable<Room[]> {
    if (rooms.length === 0) {
      return of([]);
    }

    const roomsNeedingMembers = rooms.filter(room => !this.roomMembersSignal().has(room.id));
    if (roomsNeedingMembers.length === 0) {
      return of(this.sortRooms(rooms.map(room => this.withMemberDisplay(room, this.membersFor(room.id)))));
    }

    return forkJoin(roomsNeedingMembers.map(room =>
      this.loadMembers(room.id).pipe(
        map(members => ({ roomId: room.id, members })),
        catchError(() => of({ roomId: room.id, members: [] as RoomMember[] }))
      )
    )).pipe(
      map(results => {
        const freshMembers = new Map(results.map(result => [result.roomId, result.members]));
        return this.sortRooms(rooms.map(room => {
          const members = freshMembers.get(room.id) || this.membersFor(room.id);
          return members.length > 0 ? this.withMemberDisplay(room, members) : room;
        }));
      })
    );
  }

  private applyLatestMessages(rooms: Room[]): Observable<Room[]> {
    if (rooms.length === 0) {
      return of([]);
    }

    return forkJoin(rooms.map(room => this.loadLatestMessage(room.id).pipe(
      map(message => ({ roomId: room.id, message })),
      catchError(() => of({ roomId: room.id, message: undefined as Message | undefined }))
    ))).pipe(
      map(results => {
        const latest = new Map(results.filter(item => item.message).map(item => [item.roomId, item.message as Message]));
        return this.sortRooms(rooms.map(room => {
          const message = latest.get(room.id);
          return message
            ? { ...room, lastMessage: message, updatedAt: message.timestamp }
            : { ...room, lastMessage: undefined };
        }));
      })
    );
  }

  private loadLatestMessage(roomId: string): Observable<Message | undefined> {
    const params = new HttpParams().set('limit', '1');
    return this.http.get<unknown[]>(`${this.apiUrl}/api/v1/messages/room/${encodeURIComponent(roomId)}`, { params }).pipe(
      map(response => this.asArray(response).map(message => this.normalizeMessage(message, roomId))),
      switchMap(messages => {
        const latest = this.sortMessages(messages).at(-1);
        return latest ? this.enrichMessages([latest]).pipe(map(items => items[0])) : of(undefined);
      })
    );
  }

  private enrichMembers(members: RoomMember[]): Observable<RoomMember[]> {
    const ids = members.map(member => Number(member.userId)).filter(id => Number.isFinite(id));
    if (ids.length === 0) {
      return of(members);
    }

    return this.fetchUsersByIds(ids).pipe(
      map(users => {
        const profiles = new Map(users.map(user => [user.id, user]));
        return members.map(member => {
          const profile = profiles.get(member.userId);
          return profile ? {
            ...member,
            username: profile.username,
            name: profile.name,
            avatar: this.assetUrl(profile.avatar || profile.avatarUrl || member.avatar),
            bio: profile.bio || member.bio
          } : member;
        });
      }),
      catchError(() => of(members))
    );
  }

  private enrichMessages(messages: Message[]): Observable<Message[]> {
    const ids = [...new Set(messages.map(message => Number(message.senderId)).filter(id => Number.isFinite(id)))];
    if (ids.length === 0) {
      return of(this.sortMessages(messages));
    }

    return this.fetchUsersByIds(ids).pipe(
      map(users => {
        const profiles = new Map(users.map(user => [user.id, user]));
        return this.sortMessages(messages.map(message => {
          const sender = profiles.get(message.senderId);
          return sender ? {
            ...message,
            senderName: sender.name,
            senderAvatar: this.assetUrl(sender.avatar || sender.avatarUrl || message.senderAvatar)
          } : message;
        }));
      }),
      catchError(() => of(this.sortMessages(messages)))
    );
  }

  private fetchUsersByIds(ids: number[]): Observable<ChatUser[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return of([]);
    }

    const cached = uniqueIds
      .map(id => this.userCache.get(String(id)))
      .filter((user): user is ChatUser => Boolean(user));
    const missing = uniqueIds.filter(id => !this.userCache.has(String(id)));

    if (missing.length === 0) {
      return of(cached);
    }

    return this.http.post<unknown[]>(`${this.apiUrl}/api/v1/auth/users/batch`, missing).pipe(
      map(response => this.asArray(response).map(user => this.normalizeUser(user))),
      tap(users => users.forEach(user => this.userCache.set(user.id, user))),
      map(users => [...cached, ...users]),
      catchError(() => of(cached))
    );
  }

  private sortMessages(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private sortRooms(rooms: Room[]): Room[] {
    return [...rooms].sort((a, b) => this.roomActivityTime(b) - this.roomActivityTime(a));
  }

  private mediaDownloadUrl(id: string): string {
    return `${this.apiUrl}${MEDIA_API_PATH}/${encodeURIComponent(id)}/download`;
  }

  private mediaViewUrl(id: string): string {
    return `${this.apiUrl}${MEDIA_API_PATH}/${encodeURIComponent(id)}/view`;
  }

  private resolveMediaSource(value: unknown, mode: 'view' | 'download'): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }
    if (raw.startsWith('blob:') || raw.startsWith('data:')) {
      return raw;
    }

    const mediaPathMatch = raw.match(/\/api\/v1\/(?:public\/)?media\/([^/?#]+)\/(?:view|download|view-url|download-url)/);
    if (mediaPathMatch?.[1]) {
      return mode === 'download' ? this.mediaDownloadUrl(mediaPathMatch[1]) : this.mediaViewUrl(mediaPathMatch[1]);
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
      return mode === 'download' ? this.mediaDownloadUrl(raw) : this.mediaViewUrl(raw);
    }

    try {
      const parsed = new URL(raw, this.apiUrl);
      if (parsed.pathname.startsWith(`${MEDIA_API_PATH}/`)) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const mediaId = parts[3];
        return mediaId ? (mode === 'download' ? this.mediaDownloadUrl(mediaId) : this.mediaViewUrl(mediaId)) : raw;
      }
      if (parsed.pathname.startsWith(`${LEGACY_PUBLIC_MEDIA_API_PATH}/`)) {
        parsed.pathname = parsed.pathname.replace(`${LEGACY_PUBLIC_MEDIA_API_PATH}/`, `${MEDIA_API_PATH}/`);
        return parsed.href;
      }
      if (parsed.hostname.includes('.s3.') || parsed.hostname === 's3.amazonaws.com' || parsed.hostname.startsWith('s3.')) {
        return `${this.apiUrl}${MEDIA_API_PATH}/by-url/${mode}?url=${encodeURIComponent(parsed.href)}`;
      }
    } catch {
      return raw;
    }

    return raw;
  }

  private roomActivityTime(room: Room): number {
    return (room.lastMessage?.timestamp ?? room.updatedAt ?? room.createdAt).getTime();
  }

  private normalizeReactions(raw: any): Record<string, number> {
    if (!raw) {
      return {};
    }
    if (!Array.isArray(raw)) {
      return Object.entries(raw).reduce<Record<string, number>>((acc, [emoji, value]) => {
        acc[emoji] = Number(value);
        return acc;
      }, {});
    }
    return raw.reduce<Record<string, number>>((acc, item) => {
      const emoji = String(item?.emoji ?? item);
      acc[emoji] = Number(item?.count ?? acc[emoji] ?? 0) + (item?.count ? 0 : 1);
      return acc;
    }, {});
  }

  private normalizeStatus(raw: unknown): MessageStatus {
    const value = String(raw ?? 'SENT').toUpperCase();
    return value === 'READ' || value === 'DELIVERED' ? value : 'SENT';
  }

  private normalizeRole(raw: unknown): MemberRole {
    const value = String(raw ?? 'MEMBER').toUpperCase();
    return value === 'OWNER' || value === 'ADMIN' ? value : 'MEMBER';
  }

  private attachmentType(raw: unknown): Attachment['type'] {
    const value = String(raw ?? '').toLowerCase();
    if (value.includes('image')) return 'image';
    if (value.includes('video')) return 'video';
    if (value.includes('audio')) return 'audio';
    return 'file';
  }

  private toDate(value: unknown): Date {
    const date = value ? new Date(String(value)) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  private asArray<T = any>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return value as T[];
    }
    const wrapped = value as any;
    if (Array.isArray(wrapped?.data)) return wrapped.data;
    if (Array.isArray(wrapped?.result)) return wrapped.result;
    if (Array.isArray(wrapped?.content)) return wrapped.content;
    if (Array.isArray(wrapped?.items)) return wrapped.items;
    return [];
  }
}
