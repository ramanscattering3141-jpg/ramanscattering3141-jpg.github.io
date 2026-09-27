// Site-wide configuration.
//
// Cesium ion access token used by default for everyone who opens the site
// (Bing aerial imagery and Google Photorealistic 3D Tiles). Browser tokens are
// public by nature — restrict this one in ion.cesium.com (Allowed URLs =
// the GitHub Pages domain, scope assets:read). A build-time VITE_CESIUM_ION_TOKEN
// overrides it, and a token entered in Settings → Imagery overrides both.
export const DEFAULT_ION_TOKEN: string =
  (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImFORHY5bXY2MzU5TGswUlAiLCJqdGkiOiJmMGI3MzFiYS0wMWU3LTQ1NmYtOGE1Zi0wYWM5ZWEzYzQ4NjgiLCJpZCI6NTA5OTAzLCJzdWIiOiJSYW1hblNjYXQiLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiVW50aXRsZWQiLCJpYXQiOjE3OTA1NDQwOTJ9.eCEzO-diFIWAHr3cIZ8xPb6GoO1HQ7OOSDZnOCSxEqI';

export const ionToken = (userToken: string) => userToken.trim() || DEFAULT_ION_TOKEN;
