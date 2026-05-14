import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { Subscription, finalize } from 'rxjs';
import { BrandLogoComponent } from '../../../components/shared/brand-logo.component';
import { AuthService } from '../../../services/auth.service';
import { ChatService, ChatUser, NotificationItem, Room } from '../../../services/chat.service';
import { PaymentService, SubscriptionResponse } from '../../../services/payment.service';
import { RealtimeService } from '../../../services/realtime.service';
import { ThemeService } from '../../../services/theme.service';
import { ToastService } from '../../../services/toast.service';

type ComposerMode = 'dm' | 'group' | null;

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BrandLogoComponent],
  template: `
    <div class="sidebar-header">
      <div class="brand-heading">
        <app-brand-logo [compact]="true"></app-brand-logo>
        <div>
          <h2 class="sidebar-title">
            Chats
            @if (totalUnread() > 0) {
              <span class="chat-count">{{ totalUnread() }}</span>
            }
          </h2>
          <p class="sidebar-subtitle">{{ currentUser()?.name || 'ConnectHub' }}</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="notification-wrap">
          <button class="icon-btn notification-btn" (click)="toggleNotifications()" title="Notifications">
            <svg class="mono-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Zm-2 1H7v-6a5 5 0 1 1 10 0v6Z"/>
            </svg>
            @if (alertCount() > 0) {
              <span class="notification-badge">{{ alertCount() }}</span>
            }
          </button>
          @if (notificationsOpen()) {
            <div class="notification-panel" @popupIn>
              <header>
                <strong>Notifications</strong>
                <button type="button" (click)="markNotificationsRead()">Mark read</button>
              </header>
              @if (displayNotifications().length === 0) {
                <p class="notification-empty">No notifications yet.</p>
              } @else {
                @for (notification of displayNotifications(); track notification.id) {
                  <button class="notification-item" [class.unread]="!notification.read" (click)="openNotification(notification)">
                    <span>{{ notification.title }}</span>
                    <small>{{ notification.message }}</small>
                  </button>
                }
              }
            </div>
          }
        </div>
        <button class="icon-btn" (click)="toggleTheme()" title="Toggle theme">
          @if (isDarkTheme()) {
            <span class="btn-icon" aria-hidden="true">&#9728;</span>
          } @else {
            <span class="btn-icon" aria-hidden="true">&#9790;</span>
          }
        </button>
        <button class="icon-btn" (click)="logout()" title="Logout">
          <span class="btn-icon" aria-hidden="true">&#9211;</span>
        </button>
      </div>
    </div>

    <div class="search-bar">
      <input type="text" [(ngModel)]="searchQuery" placeholder="Search conversations">
      @if (searchQuery) {
        <button class="search-clear" (click)="searchQuery = ''">x</button>
      }
    </div>

    <div class="actions-row">
      <button class="btn btn-primary" (click)="openComposer('dm')">New Chat</button>
      <button class="btn btn-ghost" (click)="openComposer('group')">Create Group</button>
    </div>

    @if (loading()) {
      <div class="state">Loading conversations...</div>
    } @else if (error()) {
      <div class="state">
        <p>{{ error() }}</p>
        <button class="btn btn-primary btn-sm" (click)="retryRequested.emit()">Retry</button>
      </div>
    } @else {
      <div class="rooms-list">
        @for (room of filteredRooms(); track room.id) {
          <button class="room-item" [class.active]="room.id === activeRoomId()" [class.unread]="room.unreadCount > 0" (click)="selectRoom(room.id)">
            <div class="room-avatar">
              <span class="avatar-fallback">{{ avatarText(room) }}</span>
              @if (room.avatar) {
                <img [src]="avatarUrl(room.avatar)" [alt]="room.name" (error)="hideBrokenImage($event)">
              }
            </div>
            <div class="room-content">
              <div class="room-header">
                <h3 class="room-name">{{ room.name }}</h3>
                <span class="room-time">{{ formatTime(room.lastMessage?.timestamp || room.updatedAt) }}</span>
              </div>
              <p class="room-preview">{{ room.lastMessage?.content || (room.type === 'GROUP' ? room.memberCount + ' members' : 'No messages yet') }}</p>
            </div>
            @if (room.unreadCount > 0) {
              <span class="unread-badge">{{ room.unreadCount }}</span>
            }
          </button>
        }

        @if (filteredRooms().length === 0) {
          <div class="state">
            <p>No conversations found.</p>
            <button class="btn btn-primary btn-sm" (click)="openComposer('dm')">Start a chat</button>
          </div>
        }
      </div>
    }

    <div class="sidebar-footer">
      @if (isAdmin()) {
        <a class="premium-cta admin-cta" routerLink="/admin">
          <span aria-hidden="true">&#9881;</span>
          <strong>Open Admin Panel</strong>
        </a>
      }
      @if (!isPro()) {
        <a class="premium-cta" routerLink="/premium">
          <span aria-hidden="true">&#9818;</span>
          <strong>Get Premium</strong>
        </a>
      }
      <div class="user-card">
        <button class="user-avatar profile-avatar" type="button" title="Edit profile" (click)="openProfileEditor()">
          <span class="avatar-fallback">{{ initials(currentUser()?.name) }}</span>
          @if (currentUser()?.avatar || currentUser()?.avatarUrl) {
            <img [src]="avatarUrl(currentUser()?.avatar || currentUser()?.avatarUrl)" [alt]="currentUser()?.name || 'Profile'" (error)="hideBrokenImage($event)">
          }
        </button>
        <div class="user-info">
          <p class="user-name">
            {{ currentUser()?.name }}
            @if (isPro()) {
              <button type="button" class="pro-badge pro-badge-btn" (click)="openProDetails()" title="View PRO plan details">
                PRO
              </button>
            }
          </p>
          <p class="user-handle">{{ uploadingProfilePicture() ? 'Updating photo...' : ('@' + (currentUser()?.username || currentUser()?.email)) }}</p>
        </div>
        @if (totalUnread() > 0) {
          <span class="footer-badge">{{ totalUnread() }}</span>
        }
      </div>
    </div>

    @if (composerMode()) {
      <div class="modal-backdrop" (click)="closeComposer()" @backdropIn>
        <section class="modal" (click)="$event.stopPropagation()" @popupIn>
          <header class="modal-header">
            <h3>{{ composerMode() === 'dm' ? 'New Chat' : 'Create Group' }}</h3>
            <button class="close-btn" (click)="closeComposer()">x</button>
          </header>

          @if (composerMode() === 'group') {
            <input class="field" type="text" [(ngModel)]="groupName" placeholder="Group name">
          }

          <input class="field" type="text" [(ngModel)]="userQuery" (input)="searchUsers()" placeholder="Search users">

          @if (searchingUsers()) {
            <p class="helper">Searching...</p>
          } @else if (userQuery && userResults().length === 0) {
            <p class="helper">No users found.</p>
          }

          <div class="user-results">
            @for (user of userResults(); track user.id) {
              <button class="user-result" [class.selected]="isSelected(user.id)" (click)="toggleUser(user)">
                <div class="user-avatar small">{{ initials(user.name) }}</div>
                <div>
                  <p>{{ user.name }}</p>
                  <span>{{ user.username || user.email || user.phoneNumber }}</span>
                </div>
              </button>
            }
          </div>

          @if (selectedUsers().length > 0) {
            <div class="chips">
              @for (user of selectedUsers(); track user.id) {
                <button class="chip" (click)="toggleUser(user)">{{ user.name }} x</button>
              }
            </div>
          }

          <button class="btn btn-primary submit-btn" [disabled]="creating() || selectedUsers().length === 0 || (composerMode() === 'group' && !groupName.trim())" (click)="createRoom()">
            {{ creating() ? 'Creating...' : (composerMode() === 'dm' ? 'Start Chat' : 'Create Group') }}
          </button>
        </section>
      </div>
    }

    @if (profileEditorOpen()) {
      <div class="modal-backdrop" (click)="closeProfileEditor()" @backdropIn>
        <section class="modal profile-modal" (click)="$event.stopPropagation()" @popupIn>
          <header class="modal-header">
            <h3>Edit Profile</h3>
            <button class="close-btn" (click)="closeProfileEditor()">x</button>
          </header>

          <div class="profile-preview">
            <label class="profile-photo-picker">
              <span class="avatar-fallback">{{ initials(profileName || currentUser()?.name) }}</span>
              @if (profilePreviewUrl()) {
                <img [src]="avatarUrl(profilePreviewUrl())" alt="Profile preview" (error)="hideBrokenImage($event)">
              }
              <input type="file" accept="image/*" (change)="chooseProfilePhoto($event)" hidden>
            </label>
            <button class="btn btn-ghost" type="button" (click)="openProfileFileInput(profileFileInput)">Change photo</button>
            <input #profileFileInput type="file" accept="image/*" (change)="chooseProfilePhoto($event)" hidden>
          </div>

          <label class="profile-field">
            <span>Name</span>
            <input class="field" type="text" [(ngModel)]="profileName" placeholder="Your name">
          </label>

          <label class="profile-field">
            <span>Bio</span>
            <textarea class="field bio-field" [(ngModel)]="profileBio" placeholder="Add a bio" rows="3"></textarea>
          </label>

          <button class="btn btn-primary submit-btn" [disabled]="savingProfile()" (click)="saveProfile()">
            {{ savingProfile() ? 'Saving...' : 'Save Profile' }}
          </button>
        </section>
      </div>
    }

    @if (proDetailsOpen()) {
      <div class="modal-backdrop" (click)="closeProDetails()" @backdropIn>
        <section class="modal pro-modal" (click)="$event.stopPropagation()" @popupIn>
          <header class="modal-header">
            <h3>PRO plan</h3>
            <button class="close-btn" (click)="closeProDetails()">x</button>
          </header>

          @if (proLoading()) {
            <p class="helper">Loading your subscription details...</p>
          } @else {
            <div class="pro-summary">
              <div class="pro-pill">Premium</div>
              <p class="helper">Your PRO benefits</p>
              <ul class="pro-benefits">
                <li>Higher message rate limits</li>
                <li>Premium badge and visuals</li>
                <li>Priority notifications</li>
                <li>Advanced chat controls</li>
              </ul>

              @if (subscription()) {
                <div class="pro-dates">
                  <div>
                    <span>Plan</span>
                    <strong>{{ subscription()!.plan }}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{{ subscription()!.status }}</strong>
                  </div>
                  <div>
                    <span>Start</span>
                    <strong>{{ formatDate(subscription()!.startDate) }}</strong>
                  </div>
                  <div>
                    <span>End</span>
                    <strong>{{ formatDate(subscription()!.endDate) }}</strong>
                  </div>
                </div>
              } @else {
                <p class="helper">Subscription details are not available yet.</p>
              }
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      color: var(--color-text-primary);
    }

    .sidebar-header,
    .sidebar-footer {
      flex-shrink: 0;
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--color-glass-border);
    }

    .sidebar-footer {
      border-top: 1px solid var(--color-glass-border);
      border-bottom: 0;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-md);
    }

    .brand-heading {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .sidebar-title {
      margin: 0;
      font-size: 22px;
      color: var(--color-text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sidebar-subtitle,
    .helper {
      margin: 2px 0 0;
      color: var(--color-text-muted);
      font-size: 12px;
    }

    .header-actions,
    .actions-row {
      display: flex;
      gap: var(--spacing-sm);
    }

    .notification-wrap {
      position: relative;
    }

    .notification-btn {
      position: relative;
    }

    .notification-badge {
      position: absolute;
      top: -7px;
      right: -7px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-danger);
      color: white;
      font-size: 10px;
      font-weight: 900;
    }

    .notification-panel {
      position: fixed;
      top: 74px;
      left: 16px;
      z-index: 80;
      width: min(328px, calc(100vw - 32px));
      max-height: 360px;
      overflow-y: auto;
      padding: var(--spacing-sm);
      border-radius: var(--radius-md);
      background: var(--color-glass-elevated);
      border: 1px solid var(--color-glass-border);
      box-shadow: var(--shadow-lg);
      transform-origin: top left;
    }

    .notification-panel header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
      color: var(--color-text-primary);
    }

    .notification-panel header button {
      color: var(--color-primary);
      background: transparent;
      font-size: 12px;
      font-weight: 800;
    }

    .notification-empty {
      margin: 0;
      padding: var(--spacing-md);
      color: var(--color-text-muted);
      font-size: 12px;
    }

    .notification-item {
      width: 100%;
      display: grid;
      gap: 3px;
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      background: transparent;
      text-align: left;
    }

    .notification-item.unread {
      background: var(--color-glass-light);
    }

    .notification-item span {
      font-size: 13px;
      font-weight: 800;
    }

    .notification-item small {
      color: var(--color-text-muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .icon-btn,
    .close-btn {
      width: 36px;
      min-height: 36px;
      padding: 0;
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
      color: var(--color-text-primary);
      font-size: 12px;
      display: inline-grid;
      place-items: center;
      position: relative;
    }

    .icon-btn:hover,
    .close-btn:hover,
    .btn:hover,
    .chip:hover,
    .room-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 18px rgba(14, 165, 233, 0.18);
    }

    .btn-icon {
      font-size: 17px;
      line-height: 1;
    }

    .mono-icon {
      width: 18px;
      height: 18px;
      color: currentColor;
      display: block;
    }

    .search-bar {
      position: relative;
      padding: var(--spacing-md) var(--spacing-lg) 0;
    }

    .search-bar input,
    .field {
      width: 100%;
      min-height: 42px;
      font-size: 14px;
    }

    .search-clear {
      position: absolute;
      right: 28px;
      top: 25px;
      background: transparent;
      color: var(--color-text-muted);
    }

    .actions-row {
      padding: var(--spacing-md) var(--spacing-lg);
    }

    .btn {
      min-height: 40px;
      padding: 0 14px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 700;
    }

    .btn-primary {
      background: var(--color-primary);
      color: white;
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--color-glass-border);
      color: var(--color-text-primary);
    }

    .btn-sm {
      min-height: 34px;
      font-size: 12px;
    }

    .rooms-list {
      flex: 1;
      overflow-y: auto;
    }

    .room-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-lg);
      background: transparent;
      border-bottom: 1px solid var(--color-glass-border);
      text-align: left;
      color: var(--color-text-primary);
    }

    .room-item:hover,
    .room-item.active {
      background: var(--color-glass-elevated);
    }

    .room-item.unread {
      background: var(--color-glass-highlight);
    }

    .room-item.unread .room-name {
      font-weight: 900;
    }

    .room-item.active {
      box-shadow: inset 3px 0 0 var(--color-primary);
    }

    .room-avatar,
    .user-avatar {
      position: relative;
      flex-shrink: 0;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      color: white;
      font-weight: 800;
      font-size: 13px;
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
    .user-avatar img {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-avatar {
      padding: 0;
      border: 0;
      cursor: pointer;
    }

    .profile-avatar:hover {
      outline: 2px solid var(--color-primary);
    }

    .user-avatar.small {
      width: 34px;
      height: 34px;
      font-size: 11px;
    }

    .premium-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 42px;
      margin-bottom: var(--spacing-md);
      border-radius: 999px;
      color: white;
      text-decoration: none;
      background: linear-gradient(90deg, #22c55e, #06b6d4, #8b5cf6, #f59e0b, #22c55e);
    }

    .premium-cta:hover {
      transform: translateY(-1px);
    }

    .admin-cta {
      background: linear-gradient(90deg, #2563eb, #7c3aed, #0891b2);
    }

    .room-content,
    .user-info {
      flex: 1;
      min-width: 0;
    }

    .room-header,
    .user-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    .room-header {
      justify-content: space-between;
      gap: var(--spacing-sm);
    }

    .room-name,
    .user-name {
      margin: 0;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 700;
    }

    .room-preview,
    .user-handle,
    .room-time {
      flex: 0 0 auto;
      margin: 0;
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
    }

    .unread-badge,
    .footer-badge {
      flex: 0 0 auto;
      background: var(--color-primary);
      color: white;
      border-radius: 999px;
      min-width: 24px;
      padding: 2px 7px;
      text-align: center;
      font-size: 11px;
      font-weight: 800;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .state {
      padding: var(--spacing-xl);
      text-align: center;
      color: var(--color-text-muted);
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-lg);
      background: rgba(2, 6, 23, 0.62);
      backdrop-filter: blur(8px);
    }

    .modal {
      width: min(460px, 100%);
      max-height: min(680px, 92dvh);
      overflow: auto;
      padding: var(--spacing-lg);
      border-radius: var(--radius-md);
      background: var(--color-glass-elevated);
      border: 1px solid var(--color-glass-border);
      box-shadow: var(--shadow-lg);
      transform-origin: center;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-md);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
    }

    .field {
      margin-bottom: var(--spacing-md);
    }

    textarea.field {
      resize: vertical;
      min-height: 84px;
      padding-top: 10px;
    }

    .profile-modal {
      width: min(420px, 100%);
    }

    .profile-preview {
      display: grid;
      justify-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
    }

    .profile-photo-picker {
      position: relative;
      width: 92px;
      height: 92px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      cursor: pointer;
      overflow: hidden;
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      color: white;
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
      box-shadow: var(--shadow-md);
    }

    .profile-photo-picker img {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-field {
      display: grid;
      gap: 6px;
      color: var(--color-text-primary);
      font-size: 12px;
      font-weight: 800;
    }

    .user-results {
      display: grid;
      gap: var(--spacing-sm);
      max-height: 260px;
      overflow: auto;
    }

    .user-result {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
      color: var(--color-text-primary);
      text-align: left;
    }

    .user-result.selected {
      outline: 2px solid var(--color-primary);
    }

    .user-result p {
      margin: 0;
      font-weight: 700;
      font-size: 13px;
    }

    .user-result span {
      color: var(--color-text-muted);
      font-size: 12px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
      margin: var(--spacing-md) 0;
    }

    .chip {
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--color-glass-light);
      color: var(--color-text-primary);
      border: 1px solid var(--color-glass-border);
      font-size: 12px;
    }

    .pro-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 18px;
      margin-left: 8px;
      padding: 0 7px;
      border-radius: 999px;
      background: rgba(14, 165, 233, 0.16);
      color: rgba(248, 250, 252, 0.96);
      font-size: 10px;
      font-weight: 900;
      vertical-align: middle;
      border: 1px solid rgba(14, 165, 233, 0.22);
    }

    .pro-badge-btn {
      cursor: pointer;
    }

    .pro-badge-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 18px rgba(14, 165, 233, 0.22);
    }

    .pro-modal {
      width: min(520px, 100%);
    }

    .pro-summary {
      display: grid;
      gap: var(--spacing-md);
    }

    .pro-pill {
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.16);
      border: 1px solid rgba(16, 185, 129, 0.24);
      color: var(--color-text-primary);
      font-weight: 900;
      font-size: 12px;
    }

    .pro-benefits {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: var(--color-text-secondary);
      font-size: 13px;
      line-height: 1.45;
    }

    .pro-dates {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 12px;
      border-radius: var(--radius-md);
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
    }

    .pro-dates span {
      display: block;
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 800;
    }

    .pro-dates strong {
      display: block;
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 900;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .submit-btn {
      width: 100%;
      margin-top: var(--spacing-md);
    }

    @media (max-width: 480px) {
      .sidebar-header,
      .sidebar-footer,
      .room-item {
        padding-left: var(--spacing-md);
        padding-right: var(--spacing-md);
      }

      .search-bar,
      .actions-row {
        padding-left: var(--spacing-md);
        padding-right: var(--spacing-md);
      }

      .header-actions {
        flex-direction: column;
      }
    }
  `],
  animations: [
    trigger('popupIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px) scale(0.96)' }),
        animate('180ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ])
    ]),
    trigger('backdropIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('160ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class ChatSidebarComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);
  private readonly paymentService = inject(PaymentService);

  readonly roomSelected = output<string>();
  readonly retryRequested = output<void>();
  readonly activeRoomId = input<string | undefined>();
  readonly loading = input(false);
  readonly error = input('');

  readonly rooms = this.chatService.rooms;
  readonly totalUnread = this.chatService.totalUnread;
  readonly currentUser = this.authService.currentUser;
  readonly composerMode = signal<ComposerMode>(null);
  readonly userResults = signal<ChatUser[]>([]);
  readonly selectedUsers = signal<ChatUser[]>([]);
  readonly searchingUsers = signal(false);
  readonly creating = signal(false);
  readonly uploadingProfilePicture = signal(false);
  readonly notificationsOpen = signal(false);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly notificationCount = signal(0);
  readonly profileEditorOpen = signal(false);
  readonly profilePreviewUrl = signal('');
  readonly savingProfile = signal(false);
  readonly isPro = this.authService.isPro;
  readonly isAdmin = this.authService.isAdmin;
  readonly proDetailsOpen = signal(false);
  readonly proLoading = signal(false);
  readonly subscription = signal<SubscriptionResponse | null>(null);
  readonly alertCount = computed(() => Math.max(this.notificationCount(), this.totalUnread()));
  readonly displayNotifications = computed(() => {
    const apiNotifications = this.notifications();
    const apiIds = new Set(apiNotifications.map(notification => notification.id));
    const roomNotifications = this.rooms()
      .filter(room => room.unreadCount > 0)
      .map(room => ({
        id: `room-${room.id}`,
        type: 'MESSAGE',
        title: room.name,
        message: `${room.unreadCount} unread message${room.unreadCount === 1 ? '' : 's'}${room.lastMessage?.content ? ': ' + room.lastMessage.content : ''}`,
        roomId: room.id,
        read: false,
        createdAt: room.lastMessage?.timestamp || room.updatedAt || room.createdAt
      } satisfies NotificationItem))
      .filter(notification => !apiIds.has(notification.id));

    return [...roomNotifications, ...apiNotifications]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });
  readonly filteredRooms = computed(() => {
    const query = this.searchQuery.trim().toLowerCase();
    return query ? this.rooms().filter(room => room.name.toLowerCase().includes(query)) : this.rooms();
  });

  searchQuery = '';
  userQuery = '';
  groupName = '';
  profileName = '';
  profileBio = '';
  private selectedProfilePhoto?: File;
  private notificationTimer?: number;
  private realtimeNotificationSub?: Subscription;

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user?.id) {
      this.authService.fetchProfile(user.id).subscribe({ error: () => undefined });
    }
    this.realtimeService.connect();
    this.realtimeNotificationSub = this.realtimeService.notifications$.subscribe(notification => this.handleRealtimeNotification(notification));
    this.loadNotifications();
    this.notificationTimer = window.setInterval(() => this.refreshNotifications(), 5000);
  }

  ngOnDestroy(): void {
    if (this.notificationTimer) {
      window.clearInterval(this.notificationTimer);
    }
    this.realtimeNotificationSub?.unsubscribe();
  }

  selectRoom(roomId: string): void {
    this.realtimeService.subscribeRoom(roomId);
    this.realtimeService.markRoomRead(roomId);
    this.roomSelected.emit(roomId);
  }

  openComposer(mode: Exclude<ComposerMode, null>): void {
    this.composerMode.set(mode);
    this.userQuery = '';
    this.groupName = '';
    this.userResults.set([]);
    this.selectedUsers.set([]);
  }

  closeComposer(): void {
    this.composerMode.set(null);
  }

  searchUsers(): void {
    this.searchingUsers.set(true);
    this.chatService.searchUsers(this.userQuery).pipe(
      finalize(() => this.searchingUsers.set(false))
    ).subscribe({
      next: users => this.userResults.set(users.filter(user => user.id !== this.currentUser()?.id)),
      error: () => this.toastService.error('Could not search users.')
    });
  }

  toggleUser(user: ChatUser): void {
    if (this.composerMode() === 'dm') {
      this.selectedUsers.set(this.isSelected(user.id) ? [] : [user]);
      return;
    }

    this.selectedUsers.update(users => this.isSelected(user.id)
      ? users.filter(item => item.id !== user.id)
      : [...users, user]
    );
  }

  isSelected(userId: string): boolean {
    return this.selectedUsers().some(user => user.id === userId);
  }

  createRoom(): void {
    const selected = this.selectedUsers();
    if (selected.length === 0) return;

    const mode = this.composerMode();
    this.creating.set(true);
    this.chatService.createRoom({
      type: mode === 'group' ? 'GROUP' : 'DM',
      name: mode === 'group' ? this.groupName.trim() : selected[0].name,
      memberIds: selected.map(user => user.id)
    }).pipe(
      finalize(() => this.creating.set(false))
    ).subscribe({
      next: room => {
        this.toastService.success(mode === 'group' ? 'Group created.' : 'Chat created.');
        this.roomSelected.emit(room.id);
        this.closeComposer();
      },
      error: () => this.toastService.error('Could not create conversation.')
    });
  }

  uploadProfilePicture(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingProfilePicture.set(true);
    this.chatService.uploadMedia(this.currentUser()?.id || 'profile', file).pipe(
      finalize(() => {
        this.uploadingProfilePicture.set(false);
        input.value = '';
      })
    ).subscribe({
      next: media => {
        if (!media.url) {
          this.toastService.error('Uploaded image is missing a URL.');
          return;
        }

        this.authService.updateProfile({ avatarUrl: media.url }).subscribe({
          next: user => {
            this.chatService.refreshUserReferences(user.id);
            this.toastService.success('Profile picture updated.');
          },
          error: error => this.toastService.error(this.uploadErrorMessage(error, 'Could not update profile picture.'))
        });
      },
      error: error => this.toastService.error(this.uploadErrorMessage(error, 'Could not upload profile picture.'))
    });
  }

  openProfileEditor(): void {
    const user = this.currentUser();
    this.profileName = user?.fullName || user?.name || '';
    this.profileBio = user?.bio || '';
    this.selectedProfilePhoto = undefined;
    this.profilePreviewUrl.set(user?.avatar || user?.avatarUrl || '');
    this.profileEditorOpen.set(true);
  }

  closeProfileEditor(): void {
    if (this.savingProfile()) return;
    this.profileEditorOpen.set(false);
    this.selectedProfilePhoto = undefined;
  }

  openProfileFileInput(input: HTMLInputElement): void {
    input.click();
  }

  chooseProfilePhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedProfilePhoto = file;
    this.profilePreviewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  saveProfile(): void {
    const fullName = this.profileName.trim();
    if (!fullName) {
      this.toastService.error('Name is required.');
      return;
    }

    const finishUpdate = (avatarUrl?: string) => {
      this.authService.updateProfile({
        fullName,
        bio: this.profileBio.trim(),
        ...(avatarUrl ? { avatarUrl } : {})
      }).pipe(
        finalize(() => this.savingProfile.set(false))
      ).subscribe({
        next: () => {
          this.authService.fetchProfile().subscribe({
            next: user => this.chatService.refreshUserReferences(user.id),
            error: () => this.chatService.refreshUserReferences(this.currentUser()?.id)
          });
          this.toastService.success('Profile updated.');
          this.profileEditorOpen.set(false);
          this.selectedProfilePhoto = undefined;
        },
        error: error => {
          this.toastService.error(this.uploadErrorMessage(error, 'Could not update profile.'));
        }
      });
    };

    this.savingProfile.set(true);
    if (this.selectedProfilePhoto) {
      this.chatService.uploadMedia(this.currentUser()?.id || 'profile', this.selectedProfilePhoto).subscribe({
        next: media => finishUpdate(media.previewUrl || media.thumbnailUrl || media.url),
        error: error => {
          this.savingProfile.set(false);
          this.toastService.error(this.uploadErrorMessage(error, 'Could not upload profile picture.'));
        }
      });
      return;
    }

    finishUpdate();
  }

  toggleNotifications(): void {
    this.notificationsOpen.update(open => !open);
    if (this.notificationsOpen()) {
      this.chatService.loadRooms().subscribe({ error: () => undefined });
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.chatService.loadNotifications().subscribe({
      next: notifications => {
        this.notifications.set(notifications);
        this.notificationCount.set(notifications.filter(notification => !notification.read).length);
      },
      error: () => undefined
    });
  }

  loadNotificationCount(): void {
    this.chatService.loadUnreadNotificationCount().subscribe({
      next: count => this.notificationCount.set(count),
      error: () => undefined
    });
  }

  refreshNotifications(): void {
    if (this.notificationsOpen()) {
      this.loadNotifications();
      return;
    }
    this.loadNotificationCount();
  }

  markNotificationsRead(): void {
    this.chatService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notificationCount.set(0);
        this.notifications.set([]);
        const unreadRooms = this.rooms().filter(room => room.unreadCount > 0);
        unreadRooms.forEach(room => {
          this.chatService.markRoomAsRead(room.id).subscribe({ error: () => undefined });
        });
        this.chatService.loadRooms().subscribe({ error: () => undefined });
      },
      error: () => undefined
    });
  }

  openNotification(notification: NotificationItem): void {
    if (notification.roomId) {
      this.selectRoom(notification.roomId);
    }
    this.markNotificationsRead();
    this.notificationsOpen.set(false);
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  isDarkTheme(): boolean {
    return this.themeService.isDark();
  }

  openProDetails(): void {
    this.proDetailsOpen.set(true);
    this.proLoading.set(true);
    this.paymentService.status().subscribe({
      next: subscription => {
        this.subscription.set(subscription);
        this.proLoading.set(false);
      },
      error: () => {
        this.subscription.set(null);
        this.proLoading.set(false);
      }
    });
  }

  closeProDetails(): void {
    if (this.proLoading()) return;
    this.proDetailsOpen.set(false);
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }

  avatarText(room: Room): string {
    return this.initials(room.name);
  }

  avatarUrl(value?: string): string {
    return this.chatService.assetUrl(value);
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
  }

  private uploadErrorMessage(error: unknown, fallback: string): string {
    const body = (error as any)?.error;
    const message = typeof body === 'string'
      ? body
      : body?.error || body?.message || body?.details;
    return message ? `Upload failed: ${message}` : fallback;
  }

  private handleRealtimeNotification(raw: unknown): void {
    const notification = this.normalizeRealtimeNotification(raw);
    this.notifications.update(items => {
      const withoutDuplicate = items.filter(item => item.id !== notification.id);
      return [notification, ...withoutDuplicate].slice(0, 40);
    });
    this.notificationCount.update(count => count + (notification.read ? 0 : 1));
    this.chatService.loadRooms().subscribe({ error: () => undefined });
    this.playNotificationTone();
  }

  private normalizeRealtimeNotification(raw: unknown): NotificationItem {
    const value = raw as any;
    return {
      id: String(value?.id ?? value?.notificationId ?? value?.messageId ?? `live-${Date.now()}`),
      recipientId: value?.recipientId ? String(value.recipientId) : undefined,
      actorId: value?.actorId ? String(value.actorId) : undefined,
      type: String(value?.type ?? 'MESSAGE'),
      title: String(value?.title ?? value?.roomName ?? 'New message'),
      message: String(value?.message ?? value?.content ?? 'You have a new message.'),
      roomId: value?.roomId ? String(value.roomId) : undefined,
      messageId: value?.messageId ? String(value.messageId) : undefined,
      read: Boolean(value?.read ?? value?.isRead),
      createdAt: value?.createdAt ? new Date(value.createdAt) : new Date()
    };
  }

  private playNotificationTone(): void {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 720;
      gain.gain.value = 0.025;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
    } catch {
      // Browsers may block audio until the first user gesture.
    }
  }

  initials(name?: string): string {
    return (name || 'CH').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  formatTime(date?: Date): string {
    if (!date) return '';
    const now = new Date();
    const value = new Date(date);
    const diff = now.getTime() - value.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return value.toLocaleDateString();
  }
}
