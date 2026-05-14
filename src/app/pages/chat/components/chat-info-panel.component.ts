import { CommonModule } from '@angular/common';
import { Component, OnChanges, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ChatService, ChatUser, MemberRole, MediaItem, Room, RoomMember } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-chat-info-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="info-container">
      <header class="info-header">
        <h3>Details</h3>
        <button class="icon-btn" (click)="closed.emit()">Close</button>
      </header>

      <section class="room-card">
        <div class="room-avatar">
          <span class="avatar-fallback">{{ initials(room().name) }}</span>
          @if (room().avatar) {
            <img [src]="assetUrl(room().avatar)" [alt]="room().name" (error)="hideBrokenImage($event)">
          }
        </div>
        <h2>{{ room().name }}</h2>
        <p>{{ room().type === 'GROUP' ? room().memberCount + ' members' : 'Direct message' }}</p>
        @if (room().type === 'GROUP' && canManageMembers()) {
          <label class="avatar-update-btn" title="Change group photo">
            <span aria-hidden="true">&#128247;</span>
            <input type="file" accept="image/*" (change)="changeGroupPhoto($event)" hidden>
          </label>
          @if (uploadingGroupPhoto()) {
            <small class="muted">Updating group photo...</small>
          }
        }
      </section>

      @if (loading()) {
        <div class="state">Loading details...</div>
      } @else if (error()) {
        <div class="state">
          <p>{{ error() }}</p>
          <button class="btn btn-primary" (click)="loadDetails()">Retry</button>
        </div>
      } @else {
        @if (room().type === 'GROUP') {
          <section class="section">
            <div class="section-header">
              <h4>Members</h4>
              @if (canManageMembers()) {
                <button class="btn btn-ghost" (click)="toggleAddingMember()">Add</button>
              }
            </div>

            @if (addingMember()) {
              <div class="add-member">
                <input type="text" [(ngModel)]="userQuery" (input)="searchUsers()" placeholder="Search users">
                <div class="user-results">
                  @for (user of userResults(); track user.id) {
                    <button class="user-result" (click)="addMember(user)">
                      <span class="avatar small">{{ initials(user.name) }}</span>
                      <span>{{ user.name }}</span>
                    </button>
                  }
                </div>
              </div>
            }

            <div class="members-list">
              @for (member of members(); track member.userId) {
                <button class="member-item" type="button" (click)="openMemberProfile(member)">
                  <div class="avatar small">
                    <span class="avatar-fallback">{{ initials(member.name) }}</span>
                    @if (member.avatar) {
                      <img [src]="assetUrl(member.avatar)" [alt]="member.name" (error)="hideBrokenImage($event)">
                    }
                  </div>
                  <div class="member-copy">
                    <p>{{ member.name }}</p>
                    <span>{{ member.role }}</span>
                  </div>
                  @if (canManageMembers() && member.userId !== currentUser()?.id) {
                    <select [ngModel]="member.role" (click)="$event.stopPropagation()" (ngModelChange)="changeRole(member, $event)">
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button class="danger-link" (click)="$event.stopPropagation(); removeMember(member)">Remove</button>
                  }
                </button>
              }
            </div>
          </section>
        }

        <section class="section">
          <h4>Shared Media</h4>
          @if (media().length === 0) {
            <p class="muted">No shared media yet.</p>
          } @else {
            <div class="media-list">
              @for (item of media(); track item.id) {
                <a class="media-item" [href]="item.downloadUrl || item.url" target="_blank" rel="noreferrer">{{ item.fileName }}</a>
              }
            </div>
          }
        </section>

        @if (room().type === 'GROUP' && canManageMembers()) {
          <section class="section danger-section">
            <h4>Group</h4>
            <button class="btn btn-danger" (click)="deleteGroup()">Delete Group</button>
          </section>
        }
      }
    </div>

    @if (profileMember()) {
      <div class="profile-backdrop" (click)="closeMemberProfile()">
        <section class="profile-dialog" (click)="$event.stopPropagation()">
          <button class="profile-close" (click)="closeMemberProfile()">x</button>
          <div class="profile-avatar">
            <span class="avatar-fallback">{{ initials(profileMember()!.name) }}</span>
            @if (profileMember()!.avatar) {
              <img [src]="assetUrl(profileMember()!.avatar)" [alt]="profileMember()!.name" (error)="hideBrokenImage($event)">
            }
          </div>
          <h3>{{ profileMember()!.name }}</h3>
          <p class="profile-username">{{ profileMember()!.username ? '@' + profileMember()!.username : profileMember()!.role }}</p>
          <p class="profile-bio">{{ profileMember()!.bio || 'No bio added.' }}</p>
        </section>
      </div>
    }
  `,
  styles: [`
    :host,
    .info-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      color: var(--color-text-primary);
    }

    .info-container {
      overflow-y: auto;
    }

    .info-header,
    .section-header,
    .member-item,
    .user-result {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    .info-header {
      justify-content: space-between;
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--color-glass-border);
    }

    .info-header h3,
    .section h4,
    .room-card h2,
    .member-copy p {
      margin: 0;
    }

    .room-card,
    .section,
    .state {
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--color-glass-border);
    }

    .room-card {
      text-align: center;
      position: relative;
    }

    .room-avatar,
    .avatar {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      color: white;
      font-weight: 800;
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
    .avatar img {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .room-avatar {
      width: 76px;
      height: 76px;
      margin-bottom: var(--spacing-md);
      box-shadow: 0 0 28px rgba(14, 165, 233, 0.18);
    }

    .avatar-update-btn {
      width: 38px;
      height: 38px;
      display: inline-grid;
      place-items: center;
      margin-top: var(--spacing-sm);
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--color-text-primary);
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
      transition: all var(--transition-base);
    }

    .avatar-update-btn:hover,
    .btn:hover,
    .icon-btn:hover,
    .member-item:hover,
    .media-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 18px rgba(14, 165, 233, 0.2);
    }

    .avatar.small {
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      font-size: 11px;
    }

    .room-card p,
    .muted,
    .member-copy span {
      color: var(--color-text-muted);
      font-size: 12px;
    }

    .section-header {
      justify-content: space-between;
      margin-bottom: var(--spacing-md);
    }

    .members-list,
    .media-list,
    .user-results {
      display: grid;
      gap: var(--spacing-sm);
    }

    .member-item,
    .user-result,
    .media-item {
      width: 100%;
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
      color: var(--color-text-primary);
      text-decoration: none;
      border: 1px solid var(--color-glass-border);
      text-align: left;
    }

    .member-copy {
      flex: 1;
      min-width: 0;
    }

    select,
    input {
      min-height: 36px;
      background: var(--color-glass-light);
      color: var(--color-text-primary);
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-sm);
    }

    input {
      width: 100%;
      margin-bottom: var(--spacing-sm);
    }

    .btn,
    .icon-btn,
    .danger-link {
      min-height: 36px;
      padding: 0 12px;
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
      color: var(--color-text-primary);
      font-size: 12px;
      font-weight: 800;
    }

    .btn-primary {
      background: var(--color-primary);
      color: white;
    }

    .btn-danger,
    .danger-link {
      background: var(--color-danger);
      color: white;
      border-color: transparent;
    }

    .danger-section {
      background: rgba(239, 68, 68, 0.08);
    }

    .profile-backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: grid;
      place-items: center;
      padding: var(--spacing-lg);
      background: rgba(2, 6, 23, 0.62);
    }

    .profile-dialog {
      position: relative;
      width: min(360px, 100%);
      padding: var(--spacing-xl) var(--spacing-lg);
      border-radius: var(--radius-md);
      background: var(--color-glass-elevated);
      border: 1px solid var(--color-glass-border);
      box-shadow: var(--shadow-lg);
      text-align: center;
      color: var(--color-text-primary);
    }

    .profile-close {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
      color: var(--color-text-primary);
      border: 1px solid var(--color-glass-border);
    }

    .profile-avatar {
      position: relative;
      width: 92px;
      height: 92px;
      margin: 0 auto var(--spacing-md);
      border-radius: 50%;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      color: white;
      font-size: 24px;
      font-weight: 900;
    }

    .profile-avatar img {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-dialog h3 {
      margin: 0;
      font-size: 20px;
    }

    .profile-username,
    .profile-bio {
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .profile-bio {
      margin-bottom: 0;
      white-space: pre-wrap;
    }

    @media (max-width: 480px) {
      .member-item {
        align-items: flex-start;
        flex-wrap: wrap;
      }
    }
  `]
})
export class ChatInfoPanelComponent implements OnChanges {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly room = input.required<Room>();
  readonly closed = output<void>();
  readonly members = signal<RoomMember[]>([]);
  readonly media = signal<MediaItem[]>([]);
  readonly userResults = signal<ChatUser[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly addingMember = signal(false);
  readonly profileMember = signal<RoomMember | null>(null);
  readonly uploadingGroupPhoto = signal(false);
  readonly currentUser = this.authService.currentUser;

  userQuery = '';
  private loadedRoomId = '';

  ngOnChanges(): void {
    if (this.room().id !== this.loadedRoomId) {
      this.loadedRoomId = this.room().id;
      this.loadDetails();
    }
  }

  loadDetails(): void {
    this.loading.set(true);
    this.error.set('');
    this.chatService.hydrateRoomDetails(this.room().id).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: ([members, media]) => {
        this.members.set(members);
        this.media.set(media);
      },
      error: error => {
        this.error.set('Could not load room details.');
        console.error(error);
      }
    });
  }

  searchUsers(): void {
    this.chatService.searchUsers(this.userQuery).subscribe({
      next: users => {
        const existing = new Set(this.members().map(member => member.userId));
        this.userResults.set(users.filter(user => !existing.has(user.id)));
      },
      error: () => this.toastService.error('Could not search users.')
    });
  }

  toggleAddingMember(): void {
    this.addingMember.update(value => !value);
  }

  addMember(user: ChatUser): void {
    this.chatService.addMember(this.room().id, user.id).subscribe({
      next: () => {
        this.toastService.success('Member added.');
        this.userQuery = '';
        this.userResults.set([]);
        this.refreshMembers();
      },
      error: () => this.toastService.error('Could not add member.')
    });
  }

  removeMember(member: RoomMember): void {
    this.chatService.removeMember(this.room().id, member.userId).subscribe({
      next: () => {
        this.toastService.success('Member removed.');
        this.refreshMembers();
      },
      error: () => this.toastService.error('Could not remove member.')
    });
  }

  changeRole(member: RoomMember, role: MemberRole): void {
    this.chatService.changeMemberRole(this.room().id, member.userId, role).subscribe({
      next: () => {
        this.toastService.success('Role updated.');
        this.refreshMembers();
      },
      error: () => this.toastService.error('Could not update role.')
    });
  }

  deleteGroup(): void {
    if (!confirm('Delete this group?')) {
      return;
    }

    this.chatService.deleteRoom(this.room().id).subscribe({
      next: () => {
        this.toastService.success('Group deleted.');
        this.closed.emit();
      },
      error: () => this.toastService.error('Could not delete group.')
    });
  }

  changeGroupPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingGroupPhoto.set(true);
    this.chatService.uploadMedia(this.room().id, file).pipe(
      finalize(() => {
        this.uploadingGroupPhoto.set(false);
        input.value = '';
      })
    ).subscribe({
      next: media => {
        const avatarUrl = media.previewUrl || media.thumbnailUrl || media.url;
        if (!avatarUrl) {
          this.toastService.error('Uploaded image is missing a URL.');
          return;
        }
        this.chatService.updateRoom(this.room().id, { avatarUrl }).subscribe({
          next: () => this.toastService.success('Group photo updated.'),
          error: error => this.toastService.error(this.uploadErrorMessage(error, 'Could not update group photo.'))
        });
      },
      error: error => this.toastService.error(this.uploadErrorMessage(error, 'Could not upload group photo.'))
    });
  }

  openMemberProfile(member: RoomMember): void {
    this.profileMember.set(member);
  }

  closeMemberProfile(): void {
    this.profileMember.set(null);
  }

  canManageMembers(): boolean {
    const userId = this.currentUser()?.id;
    const role = this.members().find(member => member.userId === userId)?.role;
    return this.currentUser()?.role?.toUpperCase() === 'ADMIN' || role === 'OWNER' || role === 'ADMIN';
  }

  initials(name?: string): string {
    return (name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  avatarText(room: Room): string {
    return this.initials(room.name);
  }

  assetUrl(value?: string): string {
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

  private refreshMembers(): void {
    this.chatService.loadMembers(this.room().id).subscribe({
      next: members => this.members.set(members),
      error: () => undefined
    });
  }
}
