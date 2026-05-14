import { Component, OnDestroy, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/shared/toast.component';
import { AuthService } from './services/auth.service';
import { PresenceTrackerService } from './services/presence-tracker.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly presenceTracker = inject(PresenceTrackerService);
  private readonly syncPresence = effect(() => {
    const user = this.authService.currentUser();
    if (user?.id) {
      this.presenceTracker.start(String(user.id));
    } else {
      this.presenceTracker.stop();
    }
  });

  ngOnDestroy(): void {
    this.syncPresence.destroy();
    this.presenceTracker.stop();
  }
}
