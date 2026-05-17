// Production environment configuration
// This file is used when building with `ng build --configuration production` or `ng build`

export const environment = {
  production: true,

  // Backend API Configuration
  apiBaseUrl: 'https://api.connect-hub.dev',
  apiVersion: 'v1',

  // API Endpoints
  auth: {
    baseUrl: '/api/v1/auth',
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
  },

  // Chat/Messaging Configuration
  chat: {
    baseUrl: '/api/v1/messages',
    mediaBaseUrl: '/api/v1/media',
    legacyPublicMediaUrl: '/public/media'
  },

  // WebSocket Configuration
  websocket: {
    protocol: typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:',
    host: 'api.connect-hub.dev',
    port: 443,
    endpoint: '/ws/websocket'
  },

  // Presence Tracking
  presence: {
    baseUrl: '/api/v1/presence',
    pingInterval: 30000 // 30 seconds
  },

  // Notifications & Push
  notifications: {
    baseUrl: '/api/v1/notifications',
    devicesEndpoint: '/devices'
  },

  // Payments Configuration
  payment: {
    baseUrl: '/api/v1/payments/subscription',
    razorpay: {
      checkoutUrl: 'https://checkout.razorpay.com/v1/checkout.js'
    }
  },

  // Admin APIs
  admin: {
    baseUrl: '/api/v1/admin'
  },

  // Rooms/Groups
  rooms: {
    baseUrl: '/api/v1/rooms'
  },

  // Firebase Configuration (for push notifications)
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    messagingSenderId: '',
    appId: '',
    vapidKey: ''
  }
};
