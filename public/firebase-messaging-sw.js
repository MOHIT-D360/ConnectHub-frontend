/* eslint-disable no-undef */
// Firebase Messaging Service Worker (Web Push)
// This file is served from the app origin root via the "public/" assets config in angular.json.

importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

// These placeholders should be replaced at build-time or by injecting config at runtime.
// For local dev, you can hardcode your Firebase config here temporarily.
firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY || '',
  authDomain: self.FIREBASE_AUTH_DOMAIN || '',
  projectId: self.FIREBASE_PROJECT_ID || '',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: self.FIREBASE_APP_ID || ''
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'ConnectHub';
  const options = {
    body: payload?.notification?.body || '',
    data: payload?.data || {}
  };
  self.registration.showNotification(title, options);
});

