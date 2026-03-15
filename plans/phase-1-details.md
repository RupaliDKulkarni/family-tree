# Phase 1: Code Structure Refactor — Detailed Breakdown

## Overview

Refactor the codebase foundation to support all future phases (auth, life events, UI restructure). This phase introduces:

- **React Contexts + Hooks** to eliminate prop drilling from App.tsx
- **Storage abstraction layer** with IndexedDB replacing localStorage
- **Folder reorganization** with `services/`, `contexts/`, `hooks/` directories

---

## Install

| Package | Size (gzipped) | Purpose |
|---------|---------------|---------|
| `idb` | ~1KB | Thin Promise wrapper around IndexedDB API |
| `react-router-dom` | ~12KB | Client-side routing (moved from Phase 4 — needed for landing page + tree routes) |

---

## New Files (11 files)

### Storage Abstraction (`src/services/`)

#### `src/services/StorageProvider.ts`
Interface definition for swappable storage backends.

```typescript
interface StorageProvider {
  listTrees(): Promise<TreeListItem[]>;
  getTree(treeId: string): Promise<FamilyTree | null>;
  saveTree(tree: FamilyTree): Promise<void>;
  deleteTree(treeId: string): Promise<void>;
  getSetting(key: string): Promise<any>;
  setSetting(key: string, value: any): Promise<void>;
}
```

Phase 2 will add `GoogleDriveProvider` implementing this same interface.

#### `src/services/IndexedDBProvider.ts`
Implements `StorageProvider` using `idb` library.

**Database schema:**
```
Database: "family-tree-db" (version 1)
  Object Store: "trees"    → keyPath: "treeId"  → stores FamilyTree objects
  Object Store: "settings" → keyPath: "key"     → stores { key, value } pairs
```

**Responsibilities:**
- All CRUD operations for trees
- Settings storage (currentTreeId, mainPersonId per tree, publicTreesLoaded flag)
- File System Access API auto-save logic (moved from current `utils/storage.ts`)

#### `src/services/migrateLegacyStorage.ts`
One-time migration from localStorage to IndexedDB.

**Logic:**
1. Check if localStorage has `familyTrees` key
2. If yes:
   - Read all trees from `localStorage.getItem('familyTrees')`
   - Write each tree to IndexedDB `trees` store
   - Copy `currentTreeId` to IndexedDB `settings` store
   - Copy all `mainPersonId_*` entries to IndexedDB `settings` store
   - Copy `publicTreesLoaded` to IndexedDB `settings` store
   - Set `migrated: true` flag in IndexedDB `settings`
   - Clear old localStorage keys
3. If no: skip (fresh install or already migrated)

---

### Contexts (`src/contexts/`)

#### `src/contexts/TreeContext.tsx`

**State extracted from App.tsx:**
- `trees` — list of all trees
- `currentTree` — currently selected tree

**Methods provided:**
- `loadTrees()` — fetch tree list + load current tree
- `selectTree(treeId)` — switch to a different tree
- `createTree(treeName)` — create empty tree (includes File System Access picker)
- `importTree(tree)` — import a tree from JSON
- `updateTree(treeId, newName, isPublic)` — rename / toggle public
- `deleteTree(treeId)` — remove a tree
- `downloadTree()` — export current tree as JSON file
- `savePerson(person, context?)` — add or update a person in current tree
- `deletePerson(personId)` — remove a person from current tree
- `updateSpouseDates(personId, spouseId, marriageDate, divorceDate)`
- `deleteSpouse(personId, spouseId)`
- `linkExistingSpouse(existingSpouseId, ofPersonId, marriageDate, divorceDate)`
- `setDefaultPerson(personId)`

All person/spouse mutation logic currently in App.tsx handlers (`handleSavePerson`, `handleDeletePerson`, `handleUpdateSpouseDates`, `handleDeleteSpouse`, `handleLinkExistingSpouse`) moves here.

#### `src/contexts/NavigationContext.tsx`

**State extracted from App.tsx:**
- `mainPersonId` — currently centered person on canvas
- `selectedPersonId` — person selected for floating toolbar
- `history` — navigation history stack
- `historyIndex` — current position in history
- `isLoading` — loading state during tree/person transitions

**Methods provided:**
- `setMainPerson(personId, fromHistory?)` — set center person, manage history
- `navigateBack()` — go back in history
- `navigateForward()` — go forward in history
- `selectPerson(personId | null)` — select/deselect for toolbar

**Depends on:** TreeContext (needs `currentTree` to validate person exists, save mainPersonId to settings)

**Route integration:** Uses `useParams()` from react-router to read `treeId` from URL and sync with TreeContext's `selectTree()`.

#### `src/contexts/UIContext.tsx`

**State extracted from App.tsx:**
- `sliderOpen` — PersonSlider visibility
- `editingPerson` — person being edited (null = adding new)
- `relationContext` — { parentId, relation } for add child/parent/spouse
- `newTreeModalOpen` — NewTreeModal visibility
- `showSiblings` — siblings toggle
- `showCousins` — cousins toggle
- `showFullTree` — full tree view toggle
- `closeMobilePanelRef` — ref for closing mobile panels

**Methods provided:**
- `openSlider(person?, parentId?, relation?)` — open PersonSlider
- `closeSlider()` — close PersonSlider
- `openNewTreeModal()` / `closeNewTreeModal()`
- `toggleSiblings()` / `toggleCousins()` / `toggleFullTree()`

---

### Hooks (`src/hooks/`)

Thin re-exports for clean imports throughout the app.

#### `src/hooks/useTree.ts`
```typescript
export { useTree } from '../contexts/TreeContext';
```

#### `src/hooks/useNavigation.ts`
```typescript
export { useNavigation } from '../contexts/NavigationContext';
```

#### `src/hooks/useUI.ts`
```typescript
export { useUI } from '../contexts/UIContext';
```

---

### Landing Page (`src/components/LandingPage/`)

#### `src/components/LandingPage/LandingPage.tsx`
Shown when user has no local (non-public) trees. Provides the first-time user experience.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│                                    [Login] (top) │
│                                                  │
│              🌳 Family Tree                      │
│                                                  │
│         [ + Create New Tree ]  (centered)        │
│                                                  │
│         ── or explore public trees ──            │
│                                                  │
│         • Kulkarni Family                        │
│         • Mangeshkar Family                      │
│         • Raj Kapoor Family                      │
│         • Tata Family                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Behavior:**
- Clicking "Create New Tree" opens the NewTreeModal popup, after creation navigates to `/tree/{newTreeId}`
- Clicking a public tree link navigates to `/tree/{publicTreeId}` (tree view with Sidebar + Canvas)
- Login button on top-right is a placeholder (non-functional until Phase 2, shows as disabled or "Coming soon" tooltip)

#### `src/components/LandingPage/LandingPage.css`
Centered layout styling, responsive for mobile.

---

### Route Structure

| Route | What Shows |
|-------|-----------|
| `/` | LandingPage (if no local trees) OR redirect to `/tree/{lastOpenedTreeId}` |
| `/tree/:treeId` | Main app layout (Sidebar + Canvas) for the selected tree |

**Flow on app load:**
1. Check if user has any local (non-public) trees
2. If **no local trees** → show LandingPage at `/`
3. If **has local trees** → redirect to `/tree/{lastOpenedTreeId}`
4. Selecting a tree in Sidebar navigates to `/tree/{treeId}`
5. Browser back/forward works for tree switching

---

## Modified Files (8 files)

### `package.json`
- Add `"idb": "^8.0.0"` to `dependencies`

### `src/types/index.ts`
- Add `LifeEventType` type alias
- Add `LifeEvent` interface
- Add `lifeEvents: LifeEvent[]` to `Person` interface
- Add `profilePhotoUrl?: string` to `Person` interface

```typescript
// NEW types (prepares for Phase 3)
type LifeEventType =
  | 'birth' | 'marriage' | 'divorce' | 'graduation'
  | 'job' | 'retirement' | 'death' | 'custom';

interface LifeEvent {
  eventId: string;
  type: LifeEventType;
  title: string;
  date: string;
  endDate?: string;
  location?: string;
  description?: string;
  linkedPersonIds?: string[];
  photoUrl?: string;
}

// MODIFIED: Person gets two new fields
interface Person {
  // ...all existing fields unchanged...
  lifeEvents: LifeEvent[];      // NEW — defaults to []
  profilePhotoUrl?: string;      // NEW — optional
}
```

### `src/main.tsx`
- Import and call `migrateLegacyStorage()` before render
- Wrap `<App />` with `<BrowserRouter>` + context providers:

```tsx
import { BrowserRouter } from 'react-router-dom';
import { TreeProvider } from './contexts/TreeContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { UIProvider } from './contexts/UIContext';
import { migrateLegacyStorage } from './services/migrateLegacyStorage';

migrateLegacyStorage().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename="/family-tree">
        <TreeProvider>
          <NavigationProvider>
            <UIProvider>
              <App />
            </UIProvider>
          </NavigationProvider>
        </TreeProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
});
```

Note: `basename="/family-tree"` matches the existing `base` in `vite.config.ts`.

### `src/App.tsx`
**Massive reduction: ~500 lines → ~50 lines**

- Remove all `useState` declarations (17 state variables)
- Remove all handler functions (15+ functions)
- Remove all `useEffect` and `useCallback` wrappers
- Add React Router `<Routes>` with landing page + tree view:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTree } from './hooks/useTree';
import LandingPage from './components/LandingPage/LandingPage';
import Sidebar from './components/Sidebar/Sidebar';
import Canvas from './components/Canvas/Canvas';
import PersonSlider from './components/PersonSlider/PersonSlider';
import NewTreeModal from './components/NewTreeModal/NewTreeModal';

function TreeView() {
  return (
    <div className="app-container">
      <Sidebar />
      <Canvas />
      <PersonSlider />
      <NewTreeModal />
    </div>
  );
}

function App() {
  const { trees, lastOpenedTreeId } = useTree();
  const hasLocalTrees = trees.some(t => !t.isPublic);

  return (
    <Routes>
      <Route path="/" element={
        hasLocalTrees && lastOpenedTreeId
          ? <Navigate to={`/tree/${lastOpenedTreeId}`} replace />
          : <LandingPage />
      } />
      <Route path="/tree/:treeId" element={<TreeView />} />
    </Routes>
  );
}
```

All components now receive data via context hooks internally.

### `src/components/Sidebar/Sidebar.tsx`
- Remove `SidebarProps` interface (12 props eliminated)
- Remove all props from component signature
- Add context hook calls at top of component:
  ```typescript
  const { trees, currentTree, importTree, downloadTree, deleteTree, updateTree } = useTree();
  const { mainPersonId, setMainPerson } = useNavigation();
  const { openNewTreeModal, closeMobilePanelRef } = useUI();
  const navigate = useNavigate();
  ```
- Tree selection now uses `navigate(`/tree/${treeId}`)` instead of just state change
- All internal logic and JSX rendering stays the same
- Replace `onSelectTree(...)` calls with route navigation + context update

### `src/components/Canvas/Canvas.tsx`
- Remove `CanvasProps` interface (20+ props eliminated)
- Remove all props from component signature
- Add context hook calls at top of component:
  ```typescript
  const { currentTree } = useTree();
  const { mainPersonId, selectedPersonId, selectPerson, setMainPerson,
          isLoading, history, historyIndex, navigateBack, navigateForward } = useNavigation();
  const { showSiblings, showCousins, showFullTree, toggleSiblings,
          toggleCousins, toggleFullTree, openSlider, closeMobilePanelRef } = useUI();
  ```
- Replace `tree` prop references with `currentTree`
- Replace `onSetMainPerson(...)` calls with `setMainPerson(...)`, etc.
- All layout/rendering/connection logic stays identical

### `src/components/PersonSlider/PersonSlider.tsx`
- Remove `onSave`, `onDelete`, `onLinkExistingSpouse`, `onUpdateSpouseDates`, `onDeleteSpouse` props
- Keep `isOpen`, `onClose`, `person`, `tree`, `relationContext` — OR move these to UIContext too
- Add context hook calls:
  ```typescript
  const { currentTree, savePerson, deletePerson, linkExistingSpouse,
          updateSpouseDates, deleteSpouse } = useTree();
  const { sliderOpen, editingPerson, relationContext, closeSlider } = useUI();
  ```
- Replace callback props with direct context method calls

### `src/utils/storage.ts`
- Becomes a facade delegating to `IndexedDBProvider`
- All functions become async (some already are)
- Keep utility functions that don't touch storage as-is:
  - `generateTreeId()` — unchanged
  - `generatePersonId()` — unchanged
  - `createEmptyTree()` — unchanged
  - `downloadTree()` — unchanged (creates blob + download link)
- `loadPublicTreesIfNeeded()` — updated to use IndexedDBProvider
- `getAllTrees()`, `getTree()`, `saveTree()`, `deleteTree()` — delegate to IndexedDBProvider
- `getCurrentTreeId()`, `setCurrentTreeId()` — delegate to IndexedDBProvider settings store

---

## Unchanged Files (10 files)

These stay exactly as-is (pure display components with their own props):

| File | Reason |
|------|--------|
| `src/components/PersonNode/PersonNode.tsx` | Pure display, receives data via props from Canvas (which renders it) |
| `src/components/PersonNode/PersonNode.css` | No style changes |
| `src/components/ConfirmModal/ConfirmModal.tsx` | Generic reusable modal, prop-driven |
| `src/components/ConfirmModal/ConfirmModal.css` | No style changes |
| `src/components/NewTreeModal/NewTreeModal.tsx` | Simple modal, prop-driven |
| `src/components/NewTreeModal/NewTreeModal.css` | No style changes |
| `src/components/TreeSlider/TreeSlider.tsx` | Simple slider, prop-driven |
| `src/components/TreeSlider/TreeSlider.css` | No style changes |
| `src/savedtrees/index.ts` | Public tree loader, unchanged |
| `src/savedtrees/*.json` | Static data files |

All other CSS files (`App.css`, `index.css`, `Canvas.css`, `Sidebar.css`, `PersonSlider.css`) are also unchanged — no visual changes in Phase 1.

---

## Folder Structure After Phase 1

```
src/
  contexts/                     # NEW
    TreeContext.tsx
    NavigationContext.tsx
    UIContext.tsx
  hooks/                        # NEW
    useTree.ts
    useNavigation.ts
    useUI.ts
  services/                     # NEW
    StorageProvider.ts
    IndexedDBProvider.ts
    migrateLegacyStorage.ts
  components/
    Canvas/                     # MODIFIED (Canvas.tsx uses hooks instead of props)
    ConfirmModal/               # UNCHANGED
    LandingPage/                # NEW
      LandingPage.tsx
      LandingPage.css
    NewTreeModal/               # UNCHANGED
    PersonNode/                 # UNCHANGED
    PersonSlider/               # MODIFIED (uses hooks instead of props)
    Sidebar/                    # MODIFIED (uses hooks + react-router navigate)
    TreeSlider/                 # UNCHANGED
  types/
    index.ts                    # MODIFIED (LifeEvent types added)
  utils/
    storage.ts                  # MODIFIED (delegates to IndexedDBProvider)
  savedtrees/                   # UNCHANGED
  App.tsx                       # MODIFIED (routes + massively simplified)
  App.css                       # UNCHANGED
  main.tsx                      # MODIFIED (BrowserRouter + providers + migration)
  index.css                     # UNCHANGED
  vite-env.d.ts                 # UNCHANGED
```

---

## Backward Compatibility

- Existing localStorage data is auto-migrated to IndexedDB on first load
- Existing tree JSON format remains valid — `lifeEvents` defaults to `[]` if missing
- `profilePhotoUrl` is optional, so missing field is fine
- Public bundled trees in `savedtrees/` are unchanged
- No visual or behavioral changes — app works identically after Phase 1
- File System Access API (Open File, auto-save) continues to work

---

## Verification After Phase 1

1. `npm run build` — should compile with no errors
2. `npm run dev` — app should load
3. **Landing page:** If no local trees, landing page shows "Create New Tree" + public tree links + Login placeholder
4. **Routing:** Clicking a public tree navigates to `/tree/{treeId}` and shows the tree
5. **Routing:** Creating a new tree navigates to `/tree/{newTreeId}`
6. **Routing:** URL in browser bar updates when switching trees; browser back/forward works
7. Existing localStorage data should auto-migrate to IndexedDB
8. All CRUD operations (create/edit/delete tree, add/edit/delete person) should work
9. Person navigation (back/forward, select person) should work
10. Sidebar (tree list, members, tabs) should work
11. Full tree view, siblings, cousins toggles should work
12. File System Access API (Open File, auto-save) should work
13. Mobile responsive layout should be unaffected
