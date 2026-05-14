import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

export interface AdminDashboardAnalytics {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  totalMessages: number;
  messagesPerDay: number;
  totalRooms: number;
  activeWebsocketConnections: number;
  totalMediaUploads: number;
  premiumUsersCount: number;
  revenue: number;
  growthChart: Array<{ label: string; value: number }>;
  peakActivityTiming: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  online: boolean;
  premiumPlan?: string;
}

export interface AdminUserDetails extends AdminUserSummary {
  loginHistory: Array<{ at: string; ip?: string; status?: string }>;
  sessions: Array<{ device?: string; browser?: string; lastSeen?: string; active?: boolean }>;
  premiumSubscription?: { plan?: string; status?: string; startDate?: string; endDate?: string };
}

export interface AdminRoomSummary {
  id: string;
  name: string;
  type: string;
  memberCount: number;
  messageCount: number;
  reportedCount: number;
}

export interface AdminMonitoringSnapshot {
  realtimeActiveUsers: number;
  liveWebsocketConnections: number;
  trafficRpm: number;
  apiCallsPerMinute: number;
  errorRate: number;
  serverHealth: string;
  notificationDeliveryStatus: string;
}

export interface AdminSubscriptionSummary {
  id: string;
  userId: string;
  username?: string;
  plan: string;
  status: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1';

  dashboardAnalytics(): Observable<AdminDashboardAnalytics> {
    return forkJoin({
      auth: this.http.get<any>(`${this.apiUrl}/auth/admin/analytics`).pipe(catchError(() => of({}))),
      rooms: this.http.get<any>(`${this.apiUrl}/rooms/admin/analytics`).pipe(catchError(() => of({}))),
      messages: this.http.get<any>(`${this.apiUrl}/messages/admin/analytics`).pipe(catchError(() => of({}))),
      presence: this.http.get<number>(`${this.apiUrl}/presence/online/count`).pipe(catchError(() => of(0))),
      ws: this.http.get<any>(`${this.apiUrl}/ws/admin/connections`).pipe(catchError(() => of({})))
    }).pipe(
      map(({ auth, rooms, messages, presence, ws }) => ({
        totalUsers: Number(auth?.totalUsers || 0),
        activeUsers: Number(auth?.activeUsers || 0),
        onlineUsers: Number(auth?.onlineUsers || presence || 0),
        totalMessages: Number(messages?.totalMessages || 0),
        messagesPerDay: Number(messages?.messagesPerDay || 0),
        totalRooms: Number(rooms?.totalRooms || rooms?.totalGroups || 0),
        activeWebsocketConnections: Number(ws?.activeConnections || 0),
        totalMediaUploads: Number(messages?.totalMediaUploads || 0),
        premiumUsersCount: Number(auth?.premiumUsers || 0),
        revenue: Number(auth?.premiumUsers || 0) * 199,
        growthChart: [],
        peakActivityTiming: String(messages?.peakActivityTiming || 'N/A')
      }))
    );
  }

  listUsers(query = '', status = '', role = ''): Observable<AdminUserSummary[]> {
    return this.http.get<any[]>(`${this.apiUrl}/auth/admin/users`).pipe(
      catchError(() => of([])),
      switchMap(users => {
        if (!users.length) {
          return of([] as AdminUserSummary[]);
        }
        const checks = users.map(user => {
          const id = String(user?.userId ?? user?.id ?? '');
          if (!id) {
            return of(false);
          }
          return this.http.get<boolean>(`${this.apiUrl}/presence/${encodeURIComponent(id)}/check`).pipe(
            catchError(() => of(String(user?.status || '').toUpperCase() === 'ONLINE'))
          );
        });
        return forkJoin(checks).pipe(
          map(onlineFlags => users.map((user, index) => this.mapAdminUser(user, onlineFlags[index])))
        );
      }),
      map(users => users.filter(user => {
        const queryOk = !query.trim()
          || user.username?.toLowerCase().includes(query.trim().toLowerCase())
          || user.fullName?.toLowerCase().includes(query.trim().toLowerCase())
          || user.email?.toLowerCase().includes(query.trim().toLowerCase());
        const statusOk = !status.trim() || user.status?.toUpperCase() === status.trim().toUpperCase();
        const roleOk = !role.trim() || user.role?.toUpperCase() === role.trim().toUpperCase();
        return queryOk && statusOk && roleOk;
      })),
      catchError(() => of([]))
    );
  }

  userDetails(userId: string): Observable<AdminUserDetails> {
    return this.listUsers().pipe(
      map(users => users.find(user => user.id === userId)),
      map(user => ({
        ...(user || {
          id: userId,
          username: `user-${userId}`,
          fullName: 'Unknown user',
          email: '',
          role: 'USER',
          status: 'UNKNOWN',
          online: false
        }),
        loginHistory: [],
        sessions: [],
        premiumSubscription: undefined
      }))
    );
  }

  banUser(userId: string): Observable<void> {
    return this.suspendUser(userId);
  }

  suspendUser(userId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/auth/admin/users/${encodeURIComponent(userId)}/suspend`, {});
  }

  reactivateUser(userId: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/auth/admin/users/${encodeURIComponent(userId)}/reactivate`, {});
  }

  forceLogoutUser(userId: string): Observable<void> {
    return of(void 0);
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/auth/admin/users/${encodeURIComponent(userId)}`);
  }

  setAdmin(userId: string, makeAdmin: boolean): Observable<void> {
    return of(void 0);
  }

  listRooms(): Observable<AdminRoomSummary[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rooms`).pipe(
      map(rooms => rooms.map((room, index) => ({
        id: String(room.id ?? room.roomId ?? `${room.name || 'room'}-${index}`),
        name: String(room.name || 'Room'),
        type: String(room.type || 'GROUP'),
        memberCount: Number(room.memberCount || room.members?.length || 0),
        messageCount: Number(room.messageCount || 0),
        reportedCount: Number(room.reportedCount || 0)
      })))
    );
  }

  deleteRoom(roomId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/rooms/${encodeURIComponent(roomId)}`);
  }

  deleteMessage(messageId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/messages/${encodeURIComponent(messageId)}`);
  }

  clearRoomHistory(roomId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/messages/room/${encodeURIComponent(roomId)}/clear`);
  }

  muteUser(roomId: string, userId: string, mute: boolean): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/mute`, null, {
      params: new HttpParams().set('muted', String(mute))
    });
  }

  pinAnnouncement(roomId: string, message: string): Observable<void> {
    return of(void 0);
  }

  reportedContent(): Observable<Array<{ id: string; type: string; reason: string; targetId: string; roomId?: string }>> {
    return of([]);
  }

  monitoringSnapshot(): Observable<AdminMonitoringSnapshot> {
    return forkJoin({
      presence: this.http.get<number>(`${this.apiUrl}/presence/online/count`).pipe(catchError(() => of(0))),
      ws: this.http.get<any>(`${this.apiUrl}/ws/admin/connections`).pipe(catchError(() => of({})))
    }).pipe(
      map(({ presence, ws }) => ({
        realtimeActiveUsers: Number(presence || ws?.activeUsers || 0),
        liveWebsocketConnections: Number(ws?.activeConnections || 0),
        trafficRpm: 0,
        apiCallsPerMinute: 0,
        errorRate: 0,
        serverHealth: 'AVAILABLE',
        notificationDeliveryStatus: 'UNKNOWN'
      }))
    );
  }

  subscriptions(): Observable<AdminSubscriptionSummary[]> {
    return this.listUsers().pipe(
      map(users => users
        .filter(user => (user.premiumPlan || '').toUpperCase() === 'PRO')
        .map((user, index) => ({
          id: `derived-${index}-${user.id}`,
          userId: user.id,
          username: user.username,
          plan: user.premiumPlan || 'PRO',
          status: 'ACTIVE'
        })))
    );
  }

  paymentHistory(): Observable<Array<{ id: string; userId: string; amount: number; status: string; at: string }>> {
    return this.subscriptions().pipe(
      map(items => items.map(item => ({
        id: `premium-${item.userId}-${item.id}`,
        userId: item.userId,
        amount: Number(item.amount || 199),
        status: item.status || 'PAID',
        at: item.startDate || new Date().toISOString()
      })))
    );
  }

  private mapAdminUser(user: any, isOnline = false): AdminUserSummary {
    const status = String(user.status || 'ACTIVE');
    return {
      id: String(user.userId ?? user.id ?? ''),
      username: String(user.username || ''),
      fullName: String(user.fullName || user.name || user.username || ''),
      email: String(user.email || ''),
      role: String(user.role || 'USER'),
      status,
      online: isOnline || status.toUpperCase() === 'ONLINE',
      premiumPlan: String(user.subscriptionTier || user.plan || 'FREE')
    };
  }
}
