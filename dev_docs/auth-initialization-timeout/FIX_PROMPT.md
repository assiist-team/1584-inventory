Fix: Blank spinner after tab return

Observed behavior: After signing in, navigating to business inventory, clicking an item, navigating away for 2+ minutes, then returning to the tab, the page shows a blank spinner with no content.

Observed logs:
- Realtime subscriptions active (projects channel, business inventory channel, transactions channel)
- [LISTENER 2] onAuthStateChange event fires with SIGNED_IN, hasSession: true, hasAccessToken: true
- [LISTENER 2] Handling SIGNED_IN event. Ensuring user document is up to date
- Missing logs: No [LOADING RESOLVED], no createOrUpdateUserDocument completed, no Updated app user after auth state change

Location: src/contexts/AuthContext.tsx - auth listener handler

What to investigate:
- Why does the listener handler stop executing after "Handling SIGNED_IN event" log?
- Why are the completion logs for createOrUpdateUserDocument() and getCurrentUserWithData() not appearing?
- What is the state of loading and userLoading when this happens?
- Is ProtectedRoute showing spinner because loading=true or userLoading=true?

Test: Sign in, navigate to business inventory, click item, navigate away for 2+ minutes, return to tab. Reproduce the blank spinner and capture full console logs and component state.

Related: See INFINITE_SPINNER_INVESTIGATION.md section "Fix Did Not Fully Resolve Issue" for full context and logs.

FULL LOGS OF THIS TEST:

[AuthContext] [EFFECT MOUNT] instanceId=auth-k8ohajg, strictMode might cause double-invoke undefined
AuthContext.tsx:45 [AuthContext] [BOOT PREFLIGHT] Object
AuthContext.tsx:45 [AuthContext] [INIT START] instanceId=auth-k8ohajg timestamp=2025-11-08T20:57:03.874Z undefined
AuthContext.tsx:45 [AuthContext] [SUBSCRIPTION] Created listener 1 for instanceId=auth-k8ohajg undefined
AuthContext.tsx:45 [AuthContext] [GET_SESSION] Starting getSession() call for instanceId=auth-k8ohajg undefined
AuthContext.tsx:45 [AuthContext] [EFFECT CLEANUP] Unsubscribed from auth listener instanceId=auth-k8ohajg undefined
AuthContext.tsx:45 [AuthContext] [EFFECT CLEANUP] Cleanup after 1ms hasResolvedAuthRef=false instanceId=auth-k8ohajg undefined
AuthContext.tsx:45 [AuthContext] [EFFECT MOUNT] instanceId=auth-k8ohajg, strictMode might cause double-invoke undefined
AuthContext.tsx:45 [AuthContext] [BOOT PREFLIGHT] Object
AuthContext.tsx:45 [AuthContext] [INIT START] instanceId=auth-k8ohajg timestamp=2025-11-08T20:57:03.875Z undefined
AuthContext.tsx:45 [AuthContext] [SUBSCRIPTION] Created listener 2 for instanceId=auth-k8ohajg undefined
AuthContext.tsx:45 [AuthContext] [GET_SESSION] Starting getSession() call for instanceId=auth-k8ohajg undefined
supabase.ts:57 [AuthFetch] Object
AuthContext.tsx:45 [AuthContext] [LISTENER 2] onAuthStateChange event Object
AuthContext.tsx:45 [AuthContext] [LOADING RESOLVED] source=listener_2_SIGNED_IN_auth_established elapsedMs=765 instanceId=auth-k8ohajg supabaseUser={"id":"4ef35958-597c-4aea-b99e-1ef62352a72d","email":"team@1584design.com","lastSignInAt":"2025-11-08T20:57:03.778175Z"} appUser=null undefined
AuthContext.tsx:45 [AuthContext] [LISTENER 2] Handling SIGNED_IN event. Ensuring user document is up to date Object
AuthContext.tsx:45 [AuthContext] [GET_SESSION] Initial session response after 773ms Object
AuthContext.tsx:45 [AuthContext] [LISTENER 2] onAuthStateChange event Object
supabase.ts:57 [AuthFetch] Object
supabase.ts:404 Supabase user UID: 4ef35958-597c-4aea-b99e-1ef62352a72d
supabase.ts:405 Supabase user email: team@1584design.com
AuthContext.tsx:45 [AuthContext] [GET_SESSION] Initial session response after 905ms Object
supabase.ts:57 [AuthFetch] Object
supabase.ts:404 Supabase user UID: 4ef35958-597c-4aea-b99e-1ef62352a72d
supabase.ts:405 Supabase user email: team@1584design.com
supabase.ts:408 App user data: Object
AuthContext.tsx:45 [AuthContext] [LISTENER 2] Updated app user after auth state change Object
Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: true currentAccountId: null isLoading: true
Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: true currentAccountId: null
Projects.tsx:70 🔍 Projects - Account still loading, waiting...
Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: true currentAccountId: null isLoading: true
Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: true currentAccountId: null
Projects.tsx:70 🔍 Projects - Account still loading, waiting...
Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: false currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94 isLoading: false
Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: false currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
Projects.tsx:75 🔍 Projects - Loading projects for account: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
supabase.ts:408 App user data: Object
AuthContext.tsx:45 [AuthContext] [GET_SESSION] Loaded initial app user after 1231ms Object
Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: true currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94 isLoading: true
Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: true currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
Projects.tsx:70 🔍 Projects - Account still loading, waiting...
AuthContext.tsx:45 [AuthContext] [LISTENER 2] createOrUpdateUserDocument completed in 1386ms undefined
Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: false currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94 isLoading: true
Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: false currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
Projects.tsx:75 🔍 Projects - Loading projects for account: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
supabase.ts:57 [AuthFetch] Object
supabase.ts:404 Supabase user UID: 4ef35958-597c-4aea-b99e-1ef62352a72d
supabase.ts:405 Supabase user email: team@1584design.com
Projects.tsx:79 🔍 Projects - Loaded 1 projects
supabase.ts:408 App user data: Object
AuthContext.tsx:45 [AuthContext] [LISTENER 2] Updated app user after auth state change Object
Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: true currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94 isLoading: true
Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: true currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
Projects.tsx:70 🔍 Projects - Account still loading, waiting...
Projects.tsx:79 🔍 Projects - Loaded 1 projects
Projects.tsx:23 🔍 Projects - useEffect triggered. accountLoading: false currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94 isLoading: true
Projects.tsx:65 🔍 Projects - loadInitialData called. accountLoading: false currentAccountId: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
Projects.tsx:75 🔍 Projects - Loading projects for account: 1dd4fd75-8eea-4f7a-98e7-bf45b987ae94
Projects.tsx:79 🔍 Projects - Loaded 1 projects
inventoryService.ts:277 Error subscribing to projects channel: Error: mismatch between server and client bindings for postgres changes
    at Object.callback (@supabase_supabase-js.js?v=621f9df8:2683:117)
    at @supabase_supabase-js.js?v=621f9df8:2320:71
    at Array.forEach (<anonymous>)
    at Push._matchReceive (@supabase_supabase-js.js?v=621f9df8:2320:54)
    at Object.callback (@supabase_supabase-js.js?v=621f9df8:2294:12)
    at @supabase_supabase-js.js?v=621f9df8:2981:14
    at Array.map (<anonymous>)
    at _RealtimeChannel._trigger (@supabase_supabase-js.js?v=621f9df8:2966:10)
    at Object.callback (@supabase_supabase-js.js?v=621f9df8:2630:12)
    at @supabase_supabase-js.js?v=621f9df8:2981:14
(anonymous) @ inventoryService.ts:277Understand this error
inventoryService.ts:274 Subscribed to projects channel
inventoryService.ts:1291 Subscribed to business inventory channel
inventoryService.ts:823 Subscribed to all transactions channel
inventoryService.ts:1291 Subscribed to business inventory channel
