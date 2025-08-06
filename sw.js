// sw.js - Service Worker

// This service worker is intentionally kept simple. Its main purpose is to
// keep the browser's service worker process alive for the app, which helps
// prevent the browser from throttling or suspending the app's main thread
// when it's in the background, thus preventing audio playback interruptions.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // The skipWaiting() method allows this service worker to activate
  // as soon as it's finished installing.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // The clients.claim() method allows an active service worker to set
  // itself as the controller for all clients within its scope.
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We are not adding any offline caching or fetch interception logic here.
  // The primary goal is just to have an active service worker.
  // We simply let the request go to the network.
  event.respondWith(fetch(event.request));
});