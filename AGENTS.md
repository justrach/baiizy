<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## iOS app direction

If asked to convert Baiizy into an iOS app, treat the current Next app as the hosted backend plus web client first. Do not move server-only responsibilities into the iOS bundle.

- Keep `DATABASE_URL`, GrabMaps, AI Gateway/OpenAI, Better Auth, and R2 credentials on the server. The iOS app must call authenticated API routes instead of connecting directly to Postgres, Grab, AI providers, or R2.
- Prefer a Capacitor or native `WKWebView` shell for the first iOS version unless the user explicitly asks for a full React Native/Swift rebuild.
- Preserve the Next API routes as the backend boundary for auth, recommendations, friends, events, notifications, image proxying, and Grab map proxying.
- Be careful with cookie/session behavior inside iOS WebViews. If moving to a native client, design an explicit mobile auth flow rather than assuming browser cookies work the same way.
- Use native iOS bridges for device features that matter: location permission, photo picking/upload, push notifications, deep links, and safe-area handling.
- Location is sensitive. Add clear permission copy, request only when needed, avoid background location unless explicitly required, and make stale/saved/live location states visible to the user.
- Test MapLibre-heavy screens on real iPhones, not only desktop Safari. Watch WebGL support, memory pressure, vector tile loading, marker performance, and safe-area/header overlap.
- For App Store readiness, include account deletion, privacy disclosures, reporting/blocking paths for social content, and enough native value that the app is not just a thin website wrapper.
