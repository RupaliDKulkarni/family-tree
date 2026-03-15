# Family Tree v2 — Major Upgrade Plan

## Overview

Three pillars driving this upgrade:

1. **Better Code Structure** — Context/hooks architecture, storage abstraction, folder reorganization
2. **UI Restructure** — Header bar, tabbed PersonSlider, enhanced nodes, search, export
3. **Life Events Extensibility** — Event system on Person, timeline UI, photo support, optional auth for Google integration

Each phase should be executed as a separate session and reviewed/tested before moving to the next.

---

## Phase 1: Code Structure Refactor (Foundation)

> **Must be done first.** All other phases depend on the abstractions created here.

### 1.1 State Management — Context + Hooks

**Problem:** `App.tsx` is ~500 lines. It holds all state and passes 15+ props to Canvas, 12+ to Sidebar. Every new feature bloats it further.

**Solution:** Extract state into React Contexts with custom hooks.

| Context | Hook | Responsibility |
|---------|------|---------------|
| `TreeContext` | `useTree()` | Current tree, tree list, CRUD (save/delete/import/export), default person |
| `NavigationContext` | `useNavigation()` | Main person, history stack, back/forward, show siblings/cousins/full-tree toggles |
| `UIContext` | `useUI()` | Sidebar state, modals open/close, slider open/close, mobile panel state |

**After refactor, components become self-contained:**
```tsx
// Before (prop drilling)
<Canvas tree={currentTree} mainPersonId={mainPersonId} onSetMainPerson={...} ... />

// After (context)
const Canvas = () => {
  const { currentTree } = useTree();
  const { mainPersonId, setMainPerson } = useNavigation();
  // ...
};
```

### 1.2 Storage Abstraction Layer

**Problem:** Storage is hardcoded to localStorage in `utils/storage.ts`. Adding Google Drive requires a parallel implementation.

**Solution:** `StorageProvider` interface with swappable implementations.

```typescript
interface StorageProvider {
  listTrees(): Promise<TreeListItem[]>;
  getTree(treeId: string): Promise<FamilyTree | null>;
  saveTree(tree: FamilyTree): Promise<void>;
  deleteTree(treeId: string): Promise<void>;
  exportTree(tree: FamilyTree): Promise<void>;
}
```

**Implementations:**

| Provider | When Used | Storage |
|----------|-----------|---------|
| `IndexedDBProvider` | Always (default) | Browser IndexedDB via `idb` library |
| `GoogleDriveProvider` | When logged in | Google Drive REST API |

Both providers are used together when logged in: IndexedDB for fast local access + Google Drive for cloud backup.

### 1.3 IndexedDB Migration (replaces localStorage)

**Why:** localStorage has a 5-10MB limit. With photos (base64), life events, and large trees, this will be hit quickly. IndexedDB supports hundreds of MBs.

**Library:** `idb` (~1KB gzipped, thin Promise wrapper around IndexedDB API)

**Schema:**
```
Database: "family-tree-db"
  Store: "trees"       → key: treeId, value: FamilyTree object
  Store: "photos"      → key: photoId, value: { blob, personId, treeId }
  Store: "settings"    → key: string, value: any (currentTreeId, preferences, etc.)
```

**Migration path:** On first load, check if localStorage has existing data. If yes, migrate all trees to IndexedDB, then clear localStorage entries.

### 1.4 Folder Restructure

```
src/
  auth/                    # NEW — Firebase auth provider, hooks, login UI
    AuthProvider.tsx
    LoginButton.tsx
    useAuth.ts
  components/
    Canvas/
    ConfirmModal/
    NewTreeModal/
    PersonNode/
    PersonSlider/
    Sidebar/
    TreeSlider/
  contexts/                # NEW — React contexts
    TreeContext.tsx
    NavigationContext.tsx
    UIContext.tsx
  hooks/                   # NEW — Custom hooks
    useTree.ts
    useNavigation.ts
    useUI.ts
    useStorage.ts
  services/                # NEW — Storage abstraction
    StorageProvider.ts     # Interface definition
    IndexedDBProvider.ts
    GoogleDriveProvider.ts
    GooglePhotosService.ts
    migrateLegacyStorage.ts
  types/
    index.ts               # Extended with LifeEvent, AuthUser, etc.
  utils/
    storage.ts             # Becomes thin wrapper delegating to services/
  savedtrees/              # Existing public trees (unchanged)
```

---

## Phase 2: Authentication & Cloud Storage

> **Depends on:** Phase 1 (storage abstraction layer)

### 2.1 Firebase Authentication Setup

**Package:** `firebase`

**Sign-in providers:**
- Google (Gmail) — also grants OAuth scope for Drive + Photos APIs
- Facebook

**Setup steps (manual, outside code):**
1. Create Firebase project at https://console.firebase.google.com
2. Enable Authentication → Google and Facebook sign-in providers
3. Add OAuth scopes: `https://www.googleapis.com/auth/drive.file`, `https://www.googleapis.com/auth/photoslibrary.readonly`
4. Create `.env` file with Firebase config (not committed to git)

**Environment variables (`.env`):**
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

### 2.2 Auth UI & Flow

- **Login button** in Sidebar header (desktop) / top bar (mobile)
- Opens Firebase popup for Google or Facebook sign-in
- On success: show user display name + small avatar photo
- "Sign Out" dropdown option
- **All features work identically without login** — IndexedDB local mode

```
┌─────────────────────────────────┐
│ 🌳 Family Tree    [Login]      │  ← Not logged in
├─────────────────────────────────┤
│ 🌳 Family Tree  👤 Dinesh ▾   │  ← Logged in (dropdown: Sign Out)
└─────────────────────────────────┘
```

### 2.3 Google Drive Sync

**How it works:**
- When logged in, `GoogleDriveProvider` activates alongside `IndexedDBProvider`
- App folder: creates `Family Tree App/` in user's Google Drive
- Each tree saved as `{treeName}_{treeId}.json` file in that folder

**Sync logic:**
| Action | Local (IndexedDB) | Cloud (Google Drive) |
|--------|-------------------|---------------------|
| Save tree | Write immediately | Push async in background |
| Load trees | Read from IndexedDB (fast) | Fetch from Drive on login, merge |
| Delete tree | Remove locally | Remove from Drive |
| First login | Keep local trees | Upload local trees to Drive |
| Conflict | Compare `modifyDate`, ask user which to keep |

### 2.4 Google Photos Integration

**API:** Google Photos Library API (read-only access)

**Flow:**
1. In PersonSlider "Photos" tab, click "Link from Google Photos"
2. Opens a picker/search UI showing user's Google Photos albums
3. User selects a photo
4. Photo URL/ID stored on `Person.profilePhotoUrl` or in `Person.lifeEvents[].photoUrl`
5. Photo displayed as small circle avatar on PersonNode

**Fallback for non-logged-in users:** Local photo upload (see Phase 4, section 4.4).

---

## Phase 3: Life Events System

> **Depends on:** Phase 1 (type extensions, context hooks)

### 3.1 Type Extensions

```typescript
interface LifeEvent {
  eventId: string;
  type: LifeEventType;
  title: string;
  date: string;
  endDate?: string;          // For ongoing events (job, education)
  location?: string;
  description?: string;
  linkedPersonIds?: string[]; // e.g., spouse in marriage event
  photoUrl?: string;          // Event photo (Google Photos URL or base64)
}

type LifeEventType =
  | 'birth'
  | 'marriage'
  | 'divorce'
  | 'graduation'
  | 'job'
  | 'retirement'
  | 'death'
  | 'custom';

interface Person {
  personId: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  dob: string;
  dod: string | null;
  address: string;
  notes: string;
  spouses: Spouse[];
  motherId?: string;
  fatherId?: string;
  lifeEvents: LifeEvent[];       // NEW
  profilePhotoUrl?: string;       // NEW
}
```

### 3.2 Predefined Event Types with Icons

| Type | Icon | Auto-populated from |
|------|------|-------------------|
| Birth | 👶 | `person.dob` (auto-created) |
| Marriage | 💍 | `spouse.marriageDate` (auto-created) |
| Divorce | 📋 | `spouse.divorceDate` (auto-created) |
| Graduation | 🎓 | Manual entry |
| Job | 💼 | Manual entry |
| Retirement | 🏖️ | Manual entry |
| Death | ✝ | `person.dod` (auto-created) |
| Custom | 📌 | Manual entry |

**Auto-creation:** When `dob`, `dod`, or spouse dates are set, corresponding life events are auto-generated (but editable). This ensures backward compatibility with existing data.

### 3.3 Life Events UI

- **PersonSlider** gets a new "Events" tab
- Timeline view: vertical list sorted by date, each event shows icon + title + date + description
- Add Event button → form with type dropdown, title, date, location, description, photo
- Edit/Delete existing events
- Linked persons shown as clickable names

---

## Phase 4: UI Restructure

> **Depends on:** Phase 1 (contexts), Phase 3 (life events types)

### 4.1 Header Bar (New Component)

Replace the current "Family Trees" text header in Sidebar with a proper app-wide header:

```
┌──────────────────────────────────────────────────────┐
│ 🌳 Family Tree                        👤 Login      │
│                                    (or user avatar)  │
└──────────────────────────────────────────────────────┘
│ Sidebar          │         Canvas                    │
│ (tree list,      │         (tree visualization)      │
│  members,        │                                   │
│  search)         │                                   │
```

### 4.2 PersonSlider — Tabbed Layout

Convert the current single-form slider into a tabbed interface:

| Tab | Content |
|-----|---------|
| **Details** | Current form (name, gender, DOB, DOD, parents, spouse, address, notes) |
| **Events** | Life events timeline (Phase 3) — add/edit/delete events |
| **Photos** | Photo gallery — profile photo + event photos, "Link from Google Photos" or "Upload Local" |

### 4.3 PersonNode Enhancements

- **Profile photo:** Small circle avatar (top-left of node) if `profilePhotoUrl` is set
- **Event indicator:** Small colored dot if person has life events beyond auto-generated ones
- **Birth/death years:** Optional display of `(1950-2020)` below the name (togglable in View ribbon)

### 4.4 Local Photo Upload (for non-logged-in users)

Users who don't log in should still be able to attach photos:

- "Upload Photo" button in PersonSlider Photos tab
- File picker → read image as base64 or Blob
- Store in IndexedDB `photos` store (not in the tree JSON to keep exports small)
- Reference by `photoId` in Person record
- On tree export (download JSON), optionally embed photos as base64 or skip them

### 4.5 Search / Filter Members

**Sidebar search bar:**
- Text input at the top of the Members section
- Filters member list in real-time as user types
- Simple case-insensitive substring match on `firstName` and `lastName`
- Clicking a filtered result navigates to that person on canvas

**Canvas highlight:**
- When search is active, matching nodes get a highlight glow/border
- Non-matching nodes are slightly dimmed (reduced opacity)
- "Clear search" button (or clear the input) resets the view

**Implementation:** Pure in-memory array filter, no external search library.

### 4.6 Export as PDF/Image

**Library:** `html-to-image` (lightweight, no canvas dependency issues)

**Flow:**
- New "Export" button in the Canvas ribbon (under Actions or overflow menu)
- Options: PNG, JPEG, or PDF
- Captures the current canvas viewport (or full tree if zoomed out)
- Downloads the file

### 4.7 React Router

**Library:** `react-router-dom`

**Routes:**

| Route | View |
|-------|------|
| `/` | Main app (current layout — sidebar + canvas) |
| `/tree/:treeId` | Direct link to a specific tree |
| `/tree/:treeId/person/:personId` | Deep link to a specific person |
| `/settings` | Future — app preferences, account settings |

This enables shareable URLs and browser back/forward for tree navigation.

---

## New Dependencies Summary

| Package | Size (gzipped) | Purpose |
|---------|---------------|---------|
| `firebase` | ~30KB (tree-shaken) | Auth (Google/FB login), OAuth tokens for Drive/Photos |
| `idb` | ~1KB | IndexedDB wrapper (replaces localStorage) |
| `react-router-dom` | ~12KB | Client-side routing |
| `html-to-image` | ~5KB | Canvas export to PNG/JPEG/PDF |

---

## Implementation Order

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
```

- **Phase 1** must come first (all other phases depend on contexts + storage abstraction)
- **Phase 2** depends on Phase 1's `StorageProvider` interface
- **Phase 3** can technically run in parallel with Phase 2 but shares type changes
- **Phase 4** depends on Phase 1 (contexts) and Phase 3 (life events types for the tabs)

---

## Backward Compatibility

- Existing localStorage data is auto-migrated to IndexedDB on first load after Phase 1
- Existing tree JSON format remains valid; `lifeEvents` defaults to `[]` if missing
- Public bundled trees in `savedtrees/` are unchanged
- Users who never log in experience no behavioral change (just better local storage)

---

## Files Affected (Estimated)

| Phase | New Files | Modified Files |
|-------|-----------|---------------|
| Phase 1 | ~10 (contexts, hooks, services) | ~5 (App.tsx, main.tsx, types, storage, package.json) |
| Phase 2 | ~4 (auth components, Drive/Photos services) | ~3 (contexts, Sidebar, package.json) |
| Phase 3 | ~1 (EventTimeline component) | ~3 (types, PersonSlider, PersonNode) |
| Phase 4 | ~3 (Header, SearchBar, ExportButton) | ~6 (Sidebar, Canvas, PersonSlider, PersonNode, routing, CSS files) |
