import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { BrandLogoComponent } from '../../components/shared/brand-logo.component';
import {
  AdminDashboardAnalytics,
  AdminMonitoringSnapshot,
  AdminRoomSummary,
  AdminService,
  AdminSubscriptionSummary,
  AdminUserDetails,
  AdminUserSummary
} from '../../services/admin.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BrandLogoComponent],
  template: `
    <main class="admin-shell">
      <header class="admin-header">
        <div class="brand-wrap">
          <app-brand-logo [compact]="true"></app-brand-logo>
          <div>
            <h1>Admin Panel</h1>
            <p>System-wide analytics, moderation, and subscriptions control.</p>
          </div>
        </div>
        <a routerLink="/chat" class="back-link">Back to chat</a>
      </header>

      <section class="panel-grid">
        <article class="card">
          <h2>Dashboard Analytics</h2>
          <div class="stat-grid">
            <div><span>Total users</span><strong>{{ analytics()?.totalUsers ?? 0 }}</strong></div>
            <div><span>Active users</span><strong>{{ analytics()?.activeUsers ?? 0 }}</strong></div>
            <div><span>Online users</span><strong>{{ analytics()?.onlineUsers ?? 0 }}</strong></div>
            <div><span>Total messages</span><strong>{{ analytics()?.totalMessages ?? 0 }}</strong></div>
            <div><span>Messages per day</span><strong>{{ analytics()?.messagesPerDay ?? 0 }}</strong></div>
            <div><span>Total rooms/groups</span><strong>{{ analytics()?.totalRooms ?? 0 }}</strong></div>
            <div><span>Active WebSocket connections</span><strong>{{ analytics()?.activeWebsocketConnections ?? 0 }}</strong></div>
            <div><span>Total media/files uploaded</span><strong>{{ analytics()?.totalMediaUploads ?? 0 }}</strong></div>
            <div><span>Premium users count</span><strong>{{ analytics()?.premiumUsersCount ?? 0 }}</strong></div>
            <div><span>Revenue analytics</span><strong>{{ formatMoney(derivedRevenue()) }}</strong></div>
            <div><span>Growth charts points</span><strong>{{ analytics()?.growthChart?.length ?? 0 }}</strong></div>
            <div><span>Peak activity timing</span><strong>{{ analytics()?.peakActivityTiming || '—' }}</strong></div>
          </div>
        </article>

        <article class="card">
          <h2>User Management</h2>
          <div class="filters">
            <input [(ngModel)]="userQuery" placeholder="Search users">
            <input [(ngModel)]="userStatus" placeholder="Status">
            <input [(ngModel)]="userRole" placeholder="Role">
            <button (click)="loadUsers()">Search</button>
          </div>
          <div class="list">
            @for (user of users(); track (user.id || user.email || user.username || 'user') + '-' + $index) {
              <div class="item">
                <div class="meta">
                  <strong>{{ user.fullName || user.username }}</strong>
                  <small>{{ user.email }} • {{ user.role }} • {{ user.status }}</small>
                </div>
                <div class="actions">
                  <button (click)="loadUserDetails(user)">Details</button>
                  <button (click)="setUserStatus(user, 'BAN')">Ban</button>
                  <button (click)="setUserStatus(user, 'SUSPEND')">Suspend</button>
                  <button (click)="setUserStatus(user, 'REACTIVATE')">Reactivate</button>
                  <button class="danger" (click)="deleteUser(user)">Delete</button>
                </div>
              </div>
            }
          </div>
          @if (selectedUser()) {
            <div class="detail">
              <h3>User profile details</h3>
              <p>User id: {{ selectedUser()!.id }}</p>
              <p>Role: {{ selectedUser()!.role }}</p>
              <p>Status: {{ selectedUser()!.status }}</p>
              <p>Login history: {{ selectedUser()!.loginHistory.length }}</p>
              <p>Device/session info: {{ selectedUser()!.sessions.length }}</p>
              <p>Premium subscription details: {{ selectedUser()!.premiumSubscription?.plan || selectedUser()!.premiumPlan || 'No active plan' }}</p>
            </div>
          }
        </article>

        <article class="card">
          <h2>Room & Chat Moderation</h2>
          <div class="list">
            @for (room of rooms(); track (room.id || room.name || 'room') + '-' + $index) {
              <div class="item">
                <div class="meta">
                  <strong>{{ room.name }}</strong>
                  <small>{{ room.type }} • {{ room.memberCount }} members • {{ room.messageCount }} messages</small>
                </div>
                <div class="actions">
                  <button (click)="clearRoomHistory(room)">Clear history</button>
                  <button (click)="pinAnnouncement(room)">Pin announcement</button>
                  <button class="danger" (click)="deleteRoom(room)">Delete room</button>
                </div>
              </div>
            }
          </div>
          <div class="filters inline">
            <input [(ngModel)]="messageIdToDelete" placeholder="Message id to delete">
            <button (click)="deleteMessage()">Delete message</button>
          </div>
          <div class="filters inline">
            <input [(ngModel)]="muteRoomId" placeholder="Room id">
            <input [(ngModel)]="muteUserId" placeholder="User id">
            <button (click)="muteUser(true)">Mute</button>
            <button (click)="muteUser(false)">Unmute</button>
          </div>
          <p class="helper">Reported/spam content monitored: {{ reportedContentCount() }}</p>
        </article>

        <article class="card">
          <h2>Real-Time Monitoring</h2>
          <div class="stat-grid">
            <div><span>Real-time active users</span><strong>{{ monitoring()?.realtimeActiveUsers ?? 0 }}</strong></div>
            <div><span>Live WebSocket tracking</span><strong>{{ monitoring()?.liveWebsocketConnections ?? 0 }}</strong></div>
            <div><span>Traffic analytics (RPM)</span><strong>{{ monitoring()?.trafficRpm ?? 0 }}</strong></div>
            <div><span>API usage monitoring</span><strong>{{ monitoring()?.apiCallsPerMinute ?? 0 }}</strong></div>
            <div><span>Error logs rate</span><strong>{{ monitoring()?.errorRate ?? 0 }}%</strong></div>
            <div><span>Server health status</span><strong>{{ monitoring()?.serverHealth || '—' }}</strong></div>
            <div><span>Notification delivery status</span><strong>{{ monitoring()?.notificationDeliveryStatus || '—' }}</strong></div>
          </div>
        </article>

        <article class="card">
          <h2>Premium & Payment Management</h2>
          <div class="stat-grid">
            <div><span>View all subscriptions</span><strong>{{ subscriptions().length }}</strong></div>
            <div><span>View premium users</span><strong>{{ premiumCount() }}</strong></div>
            <div><span>Revenue statistics</span><strong>{{ formatMoney(totalRevenue()) }}</strong></div>
            <div><span>Subscription expiry tracking</span><strong>{{ expiringSoonCount() }}</strong></div>
            <div><span>Payment history</span><strong>{{ paymentHistoryCount() }}</strong></div>
          </div>
        </article>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; height: 100dvh; overflow-y: auto; overflow-x: hidden; background: var(--color-bg-primary); color: var(--color-text-primary); }
    .admin-shell { width: min(1200px, calc(100% - 32px)); margin: 0 auto; min-height: 100dvh; padding: 20px 0 32px; }
    .admin-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
    .brand-wrap { display: flex; align-items: center; gap: 12px; }
    h1 { margin: 0; font-size: 26px; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    p { margin: 0; color: var(--color-text-muted); }
    .back-link { color: var(--color-text-primary); text-decoration: none; font-weight: 800; border: 1px solid var(--color-glass-border); border-radius: 999px; padding: 10px 14px; }
    .panel-grid { display: grid; gap: 14px; }
    .card { padding: 16px; border: 1px solid var(--color-glass-border); border-radius: var(--radius-md); background: var(--color-glass-light); }
    .stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .stat-grid div { padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-glass-border); background: var(--color-glass-elevated); }
    .stat-grid span { display: block; color: var(--color-text-muted); font-size: 12px; }
    .stat-grid strong { font-size: 16px; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .filters.inline { margin-top: 8px; }
    input, button { min-height: 38px; border-radius: var(--radius-sm); }
    input { padding: 0 10px; border: 1px solid var(--color-glass-border); background: var(--color-glass-elevated); color: var(--color-text-primary); }
    button { padding: 0 12px; font-weight: 700; background: var(--color-primary); color: white; }
    button.danger { background: #dc2626; }
    .list { display: grid; gap: 8px; }
    .item { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--color-glass-border); border-radius: var(--radius-sm); }
    .meta { min-width: 0; }
    .meta strong, .meta small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .actions button { min-height: 32px; font-size: 12px; }
    .detail { margin-top: 10px; padding: 10px; border-radius: var(--radius-sm); background: var(--color-glass-elevated); }
    .helper { margin-top: 8px; font-size: 12px; }
    @media (max-width: 980px) { .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .stat-grid { grid-template-columns: 1fr; } .admin-header { flex-direction: column; align-items: flex-start; } .item { flex-direction: column; align-items: flex-start; } }
  `]
})
export class AdminComponent implements OnInit, OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly analytics = signal<AdminDashboardAnalytics | null>(null);
  readonly users = signal<AdminUserSummary[]>([]);
  readonly selectedUser = signal<AdminUserDetails | null>(null);
  readonly rooms = signal<AdminRoomSummary[]>([]);
  readonly monitoring = signal<AdminMonitoringSnapshot | null>(null);
  readonly subscriptions = signal<AdminSubscriptionSummary[]>([]);
  readonly paymentHistory = signal<Array<{ id: string; userId: string; amount: number; status: string; at: string }>>([]);
  readonly reportedContentCount = signal(0);
  readonly premiumCount = computed(() => this.subscriptions().filter(item => item.plan?.toUpperCase() === 'PRO').length);
  readonly totalRevenue = computed(() => this.paymentHistory().reduce((sum, item) => sum + Number(item.amount || 0), 0));
  readonly derivedRevenue = computed(() => {
    const fromPayments = this.totalRevenue();
    if (fromPayments > 0) {
      return fromPayments;
    }
    return this.premiumCount() * 199;
  });
  readonly paymentHistoryCount = computed(() => this.paymentHistory().length);
  readonly expiringSoonCount = computed(() => {
    const now = Date.now();
    const in7days = now + 7 * 24 * 60 * 60 * 1000;
    return this.subscriptions().filter(item => {
      if (!item.endDate) return false;
      const at = new Date(item.endDate).getTime();
      return at >= now && at <= in7days;
    }).length;
  });

  userQuery = '';
  userStatus = '';
  userRole = '';
  messageIdToDelete = '';
  muteRoomId = '';
  muteUserId = '';
  private refreshTimer?: number;

  ngOnInit(): void {
    this.refreshAll();
    this.refreshTimer = window.setInterval(() => {
      this.loadUsers();
      this.adminService.monitoringSnapshot().subscribe({ next: value => this.monitoring.set(value), error: () => undefined });
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }
  }

  refreshAll(): void {
    this.loading.set(true);
    this.adminService.dashboardAnalytics().subscribe({ next: value => this.analytics.set(value), error: () => undefined });
    this.loadUsers();
    this.adminService.listRooms().subscribe({ next: value => this.rooms.set(value), error: () => undefined });
    this.adminService.monitoringSnapshot().subscribe({ next: value => this.monitoring.set(value), error: () => undefined });
    this.adminService.subscriptions().subscribe({ next: value => this.subscriptions.set(value), error: () => undefined });
    this.adminService.paymentHistory().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: value => this.paymentHistory.set(value),
      error: () => this.toastService.error('Could not load payment history.')
    });
    this.adminService.reportedContent().subscribe({ next: value => this.reportedContentCount.set(value.length), error: () => undefined });
  }

  loadUsers(): void {
    this.adminService.listUsers(this.userQuery, this.userStatus, this.userRole).subscribe({
      next: value => this.users.set(value),
      error: () => this.toastService.error('Could not load users.')
    });
  }

  loadUserDetails(user: AdminUserSummary): void {
    this.selectedUser.set({
      ...user,
      loginHistory: [],
      sessions: [],
      premiumSubscription: user.premiumPlan?.toUpperCase() === 'PRO'
        ? { plan: 'PRO', status: 'ACTIVE' }
        : undefined
    });
    this.adminService.userDetails(user.id).subscribe({
      next: value => this.selectedUser.set(value),
      error: () => this.toastService.error('Could not load user details.')
    });
  }

  setUserStatus(user: AdminUserSummary, action: 'BAN' | 'SUSPEND' | 'REACTIVATE'): void {
    const request = action === 'BAN'
      ? this.adminService.banUser(user.id)
      : action === 'SUSPEND'
        ? this.adminService.suspendUser(user.id)
        : this.adminService.reactivateUser(user.id);
    request.subscribe({
      next: () => {
        this.toastService.success(`User ${action.toLowerCase()} action applied.`);
        this.loadUsers();
      },
      error: () => this.toastService.error(`Could not ${action.toLowerCase()} user.`)
    });
  }

  deleteUser(user: AdminUserSummary): void {
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.toastService.success('User deleted.');
        this.loadUsers();
      },
      error: () => this.toastService.error('Could not delete user.')
    });
  }

  deleteRoom(room: AdminRoomSummary): void {
    this.adminService.deleteRoom(room.id).subscribe({
      next: () => {
        this.toastService.success('Room deleted.');
        this.adminService.listRooms().subscribe({ next: value => this.rooms.set(value), error: () => undefined });
      },
      error: () => this.toastService.error('Could not delete room.')
    });
  }

  clearRoomHistory(room: AdminRoomSummary): void {
    this.adminService.clearRoomHistory(room.id).subscribe({
      next: () => this.toastService.success('Room history cleared.'),
      error: () => this.toastService.error('Could not clear room history.')
    });
  }

  pinAnnouncement(room: AdminRoomSummary): void {
    this.adminService.pinAnnouncement(room.id, 'Important admin announcement').subscribe({
      next: () => this.toastService.success('Announcement pinned.'),
      error: () => this.toastService.error('Could not pin announcement.')
    });
  }

  muteUser(mute: boolean): void {
    const roomId = this.muteRoomId.trim();
    const userId = this.muteUserId.trim();
    if (!roomId || !userId) {
      this.toastService.error('Room id and user id are required.');
      return;
    }
    this.adminService.muteUser(roomId, userId, mute).subscribe({
      next: () => this.toastService.success(mute ? 'User muted.' : 'User unmuted.'),
      error: () => this.toastService.error(mute ? 'Could not mute user.' : 'Could not unmute user.')
    });
  }

  deleteMessage(): void {
    const messageId = this.messageIdToDelete.trim();
    if (!messageId) {
      this.toastService.error('Message id is required.');
      return;
    }
    this.adminService.deleteMessage(messageId).subscribe({
      next: () => {
        this.toastService.success('Message deleted.');
        this.messageIdToDelete = '';
      },
      error: () => this.toastService.error('Could not delete message.')
    });
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
  }
}
