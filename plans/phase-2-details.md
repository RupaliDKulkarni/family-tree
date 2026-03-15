# Phase 2: Authentication & Google Drive Sync — Detailed Breakdown

## Overview

Add optional Google sign-in via Firebase Auth and Google Drive sync for tree storage. All features continue to work without login (IndexedDB-only mode).

**Scope:**
- Firebase Auth with Google sign-in (Facebook deferred)
- Google Drive sync (save/load trees as JSON files)
- Google Photos deferred to later phase
- Conflict dialog when local and Drive trees have different versions

---

## Install

| Package | Size (gzipped) | Purpose |
|---------|---------------|---------|
| `firebase` | ~30KB (tree-shaken) | Auth SDK (Google sign-in, token management) |

---

## New Files (7)

### `src/services/firebase.ts`
Firebase app initialization from environment variables.

### `src/services/GoogleDriveProvider.ts`
Implements the `StorageProvider` interface for Google Drive.
- Uses REST API with OAuth access token from Firebase
- App folder: `Family Tree App/` in user's Google Drive
- Each tree stored as `{treeName}_{treeId}.json`
- Operations: `files.list`, `files.get`, `files.create`, `files.update`, `files.delete`

### `src/contexts/AuthContext.tsx`
Auth state management.
- `user` — Firebase user object (displayName, email, photoURL)
- `isLoggedIn` — boolean
- `accessToken` — Google OAuth access token (for Drive API)
- `signIn()` — trigger Google sign-in popup
- `signOut()` — sign out and clear token
- `isAuthLoading` — loading state during auth check

### `src/hooks/useAuth.ts`
Thin re-export: `export { useAuth } from '../contexts/AuthContext';`

### `src/components/LoginButton/LoginButton.tsx`
- Logged out: shows "Sign in with Google" button
- Logged in: shows user avatar + name, dropdown with "Sign Out"
- Works on both LandingPage and Sidebar header

### `src/components/LoginButton/LoginButton.css`
Styling for login button and user dropdown.

### `src/components/SyncConflictModal/SyncConflictModal.tsx`
Modal for resolving Drive sync conflicts.
- Shows tree name, local modifyDate vs cloud modifyDate
- Buttons: "Keep Local" | "Keep Cloud"
- Handles multiple conflicts sequentially

---

## Modified Files (6)

### `.env.example` (new file)
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-app-id
```

### `.gitignore`
Add `.env` and `.env.local` entries.

### `src/main.tsx`
Wrap app with `<AuthProvider>` (inside BrowserRouter, outside TreeProvider).

### `src/contexts/TreeContext.tsx`
- On login detected: trigger `syncWithDrive()` — merge local + cloud trees
- On save: write to IndexedDB first, then push to Drive in background if logged in
- On delete: remove from both IndexedDB and Drive if logged in
- New method: `syncWithDrive()` — called on login

### `src/components/LandingPage/LandingPage.tsx`
Replace disabled Login button with working `<LoginButton />`.

### `src/components/Sidebar/Sidebar.tsx`
Add `<LoginButton />` in sidebar header area.

---

## Auth Flow

1. User clicks "Sign in with Google" (LandingPage or Sidebar header)
2. Firebase popup opens, user authorizes with Google
3. Firebase returns user profile + OAuth access token (with `drive.file` scope)
4. AuthContext stores user info + token, persists across page refreshes
5. Display user name + avatar in LoginButton, show "Sign Out" option
6. All features continue working without login (IndexedDB-only mode)

---

## Google Drive Sync Flow

1. **On login**: Fetch tree list from Drive `Family Tree App/` folder, compare with local
2. **New on Drive only**: Download and add to local IndexedDB
3. **New locally only**: Upload to Drive
4. **Exists in both, same modifyDate**: Skip (in sync)
5. **Exists in both, different modifyDate**: Show SyncConflictModal per tree
6. **On every save**: IndexedDB first (instant), then Drive in background (async)
7. **On delete**: Remove from both IndexedDB and Drive
8. **Offline**: Works with IndexedDB, syncs on next login

---

## Firebase Setup Steps (manual)

1. Go to https://console.firebase.google.com
2. Create new project (free Spark plan)
3. Authentication > Sign-in method > Enable Google
4. Project Settings > General > copy config values to `.env`
5. APIs & Services (Google Cloud Console) > Enable "Google Drive API"
6. OAuth consent screen > Add scope `https://www.googleapis.com/auth/drive.file`

---

## Verification After Phase 2

1. `npm run build` — compiles with no errors
2. App works identically without login (no regressions)
3. Login button appears on LandingPage and Sidebar header
4. Google sign-in popup works (when Firebase project configured)
5. After login, user name + avatar displayed
6. Trees sync to/from Google Drive on login
7. Conflict modal shown when local vs cloud trees differ
8. Save/delete operations write to both IndexedDB and Drive
9. Sign out clears auth state, app reverts to IndexedDB-only mode
