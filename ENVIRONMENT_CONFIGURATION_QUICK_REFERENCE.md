# Environment Configuration Quick Reference

## Files Created
```
src/environments/
├── environment.ts          # Development environment
└── environment.prod.ts     # Production environment
```

## Files Modified
- `angular.json` - Added fileReplacements for production builds
- `src/app/core/services/auth.service.ts`
- `src/app/core/interceptors/auth.interceptor.ts`
- `src/app/services/admin.service.ts`
- `src/app/services/payment.service.ts`
- `src/app/services/chat.service.ts`
- `src/app/services/presence-tracker.service.ts`
- `src/app/services/push-token.service.ts`
- `src/app/services/realtime.service.ts`

## All Hardcoded URLs Replaced

### ✅ Before & After

| Service | Before | After |
|---------|--------|-------|
| Auth | `'http://localhost:8080'` | `environment.apiBaseUrl` |
| Admin | `'http://localhost:8080/api/v1'` | `${environment.apiBaseUrl}${environment.admin.baseUrl}` |
| Payment | `'http://localhost:8080/api/v1/payments/subscription'` | `${environment.apiBaseUrl}${environment.payment.baseUrl}` |
| Chat | `'http://localhost:8080'` | `environment.apiBaseUrl` |
| Presence | `'http://localhost:8080/api/v1/presence'` | `${environment.apiBaseUrl}${environment.presence.baseUrl}` |
| Push Token | `'http://localhost:8080'` | `${environment.apiBaseUrl}${environment.notifications.baseUrl}` |
| Interceptor | `'http://localhost:8080'` check | `environment.apiBaseUrl` check |
| WebSocket | `ws://localhost:8080/ws/websocket` | Dynamic from environment config |
| Razorpay | `'https://checkout.razorpay.com/v1/checkout.js'` | `environment.payment.razorpay.checkoutUrl` |

## Environment Variables Structure

### Development (localhost:8080)
```typescript
environment {
  production: false
  apiBaseUrl: 'http://localhost:8080'
  websocket.host: window.location.hostname
  websocket.port: 8080
}
```

### Production (16.170.239.157:8080)
```typescript
environment {
  production: true
  apiBaseUrl: 'http://16.170.239.157:8080'
  websocket.host: '16.170.239.157'
  websocket.port: 8080
}
```

## Key Configuration Objects

### Auth Endpoints
```typescript
auth: {
  baseUrl: '/api/v1/auth'
  endpoints: {
    login: '/login',
    register: '/register',
    refresh: '/refresh',
    logout: '/logout',
    verify: '/verify',
    resetPassword: '/reset-password',
    oauthCallback: '/oauth/callback',
    oauthGoogle: '/oauth/google',
    oauthGithub: '/oauth/github'
  }
}
```

### WebSocket Config
```typescript
websocket: {
  protocol: 'ws:' | 'wss:',  // Auto-detected from window.location
  host: 'localhost' | '16.170.239.157',
  port: 8080,
  endpoint: '/ws/websocket'
}
```

### API Endpoints
```typescript
admin: { baseUrl: '/api/v1/admin' }
chat: {
  baseUrl: '/api/v1/messages',
  mediaBaseUrl: '/api/v1/media'
}
presence: { baseUrl: '/api/v1/presence' }
notifications: { baseUrl: '/api/v1/notifications' }
payment: { baseUrl: '/api/v1/payments/subscription' }
rooms: { baseUrl: '/api/v1/rooms' }
```

## Build & Serve Commands

### Development (Uses localhost:8080)
```bash
npm start
# or
ng serve
# or
ng serve --configuration development
```

### Production (Uses 16.170.239.157:8080)
```bash
npm run build
# or
ng build
# or
ng build --configuration production
```

## How It Works

1. **Development Build**
   - Angular serves the app with `src/environments/environment.ts`
   - All API calls go to `localhost:8080`

2. **Production Build**
   - Angular's build process replaces `environment.ts` with `environment.prod.ts`
   - All API calls go to `16.170.239.157:8080`
   - WebSocket connects to `16.170.239.157:8080`

## Adding a New Service with Environment URLs

Example:
```typescript
import { environment } from '../../environments/environment';

export class MyService {
  private readonly apiUrl = `${environment.apiBaseUrl}${environment.myService.baseUrl}`;
  
  fetchData() {
    return this.http.get(`${this.apiUrl}/endpoint`);
  }
}
```

Then add to environment.ts and environment.prod.ts:
```typescript
myService: {
  baseUrl: '/api/v1/my-service'
}
```

## Adding a New Environment (e.g., Staging)

1. Create `src/environments/environment.staging.ts`
2. Update `angular.json`:
   ```json
   "configurations": {
     "staging": {
       "fileReplacements": [{
         "replace": "src/environments/environment.ts",
         "with": "src/environments/environment.staging.ts"
       }]
     }
   }
   ```
3. Build: `ng build --configuration staging`

## Verification Commands

### Check Development Environment
```bash
ng serve
# Network tab should show requests to localhost:8080
```

### Check Production Build
```bash
ng build --configuration production
# Check the dist/*/main.*.js file
# grep -r "16.170.239.157:8080" dist/
```

## Troubleshooting

### Issue: API calls still going to localhost in production
- **Solution**: Ensure you ran `ng build --configuration production`
- Check `angular.json` has fileReplacements configured

### Issue: WebSocket not connecting
- **Solution**: Check `environment.websocket.host` and `environment.websocket.port`
- Verify the backend WebSocket server is running on the correct host/port

### Issue: Firebase not configured
- **Solution**: Add Firebase config to both `environment.ts` and `environment.prod.ts`
```typescript
firebase: {
  apiKey: 'your-api-key',
  authDomain: 'your-auth-domain',
  projectId: 'your-project-id',
  messagingSenderId: 'your-messaging-sender-id',
  appId: 'your-app-id',
  vapidKey: 'your-vapid-key'
}
```

## Security Notes

- Never commit sensitive data to environment files
- For production, consider using environment variables via build tools
- Use secure secret management for Firebase keys, Razorpay keys, etc.
- Consider loading sensitive configs at runtime from a secure source

## Documentation Reference
- Full report: `ENVIRONMENT_REFACTORING_REPORT.md`
- This file: `ENVIRONMENT_CONFIGURATION_QUICK_REFERENCE.md`
