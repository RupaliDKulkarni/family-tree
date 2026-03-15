import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { FamilyTree, Person, TreeListItem } from '../types';
import {
  getTreeList,
  getTree,
  saveTree,
  deleteTree as deleteTreeStorage,
  getCurrentTreeId,
  setCurrentTreeId,
  downloadTree,
  createEmptyTree,
  generateTreeId,
  loadPublicTreesIfNeeded,
  setMainPersonId as setMainPersonIdStorage,
  getAllTrees,
} from '../utils/storage';
import { useAuth } from './AuthContext';
import {
  listDriveTreeFiles,
  downloadDriveTree,
  uploadDriveTree,
  updateDriveTree,
  deleteDriveTree,
  extractTreeIdFromFileName,
  DriveTreeFile,
} from '../services/GoogleDriveProvider';
import SyncConflictModal, { SyncConflict } from '../components/SyncConflictModal/SyncConflictModal';

interface TreeContextValue {
  trees: TreeListItem[];
  currentTree: FamilyTree | null;
  lastOpenedTreeId: string | null;
  isInitialized: boolean;
  isSyncing: boolean;
  refreshTrees: () => Promise<TreeListItem[]>;
  selectTree: (treeId: string) => Promise<void>;
  createTree: (treeName: string) => Promise<string>;
  importTree: (tree: FamilyTree) => Promise<void>;
  updateTree: (treeId: string, newName: string, isPublic: boolean) => Promise<void>;
  deleteTree: (treeId: string) => Promise<void>;
  downloadCurrentTree: () => void;
  savePerson: (person: Person, context?: { parentId: string; relation: 'child' | 'parent' | 'spouse' }) => Promise<void>;
  deletePerson: (personId: string) => Promise<void>;
  updateSpouseDates: (personId: string, spouseId: string, marriageDate: string, divorceDate: string) => Promise<void>;
  deleteSpouse: (personId: string, spouseId: string) => Promise<void>;
  linkExistingSpouse: (existingSpouseId: string, ofPersonId: string, marriageDate: string, divorceDate: string) => Promise<void>;
  setDefaultPerson: (personId: string) => Promise<void>;
}

const TreeContext = createContext<TreeContextValue | null>(null);

// Map treeId -> driveFileId for trees we know about
const driveFileMap = new Map<string, string>();

export function TreeProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isLoggedIn } = useAuth();
  const [trees, setTrees] = useState<TreeListItem[]>([]);
  const [currentTree, setCurrentTree] = useState<FamilyTree | null>(null);
  const [lastOpenedTreeId, setLastOpenedTreeId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<SyncConflict | null>(null);
  const conflictResolveRef = useRef<((choice: 'local' | 'cloud') => void) | null>(null);
  const hasSyncedRef = useRef(false);

  const refreshTrees = useCallback(async () => {
    const treeList = await getTreeList();
    setTrees(treeList);
    return treeList;
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      await loadPublicTreesIfNeeded();
      const treeList = await refreshTrees();
      const currentId = await getCurrentTreeId();
      setLastOpenedTreeId(currentId);

      if (currentId) {
        const tree = await getTree(currentId);
        if (tree) {
          setCurrentTree(tree);
        } else if (treeList.length > 0) {
          const firstTree = await getTree(treeList[0].treeId);
          if (firstTree) {
            setCurrentTree(firstTree);
            await setCurrentTreeId(firstTree.treeId);
            setLastOpenedTreeId(firstTree.treeId);
          }
        }
      } else if (treeList.length > 0) {
        const firstTree = await getTree(treeList[0].treeId);
        if (firstTree) {
          setCurrentTree(firstTree);
          await setCurrentTreeId(firstTree.treeId);
          setLastOpenedTreeId(firstTree.treeId);
        }
      }
      setIsInitialized(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync with Drive on login
  useEffect(() => {
    if (isLoggedIn && accessToken && isInitialized && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      syncWithDrive(accessToken);
    }
    if (!isLoggedIn) {
      hasSyncedRef.current = false;
      driveFileMap.clear();
    }
  }, [isLoggedIn, accessToken, isInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const waitForConflictResolution = (conflict: SyncConflict): Promise<'local' | 'cloud'> => {
    return new Promise((resolve) => {
      conflictResolveRef.current = resolve;
      setCurrentConflict(conflict);
    });
  };

  const handleKeepLocal = useCallback((conflict: SyncConflict) => {
    if (conflictResolveRef.current) {
      conflictResolveRef.current('local');
      conflictResolveRef.current = null;
    }
    setCurrentConflict(null);
    void conflict;
  }, []);

  const handleKeepCloud = useCallback((conflict: SyncConflict) => {
    if (conflictResolveRef.current) {
      conflictResolveRef.current('cloud');
      conflictResolveRef.current = null;
    }
    setCurrentConflict(null);
    void conflict;
  }, []);

  const syncWithDrive = async (token: string) => {
    setIsSyncing(true);
    try {
      const driveFiles = await listDriveTreeFiles(token);
      const localTrees = await getAllTrees();

      // Build lookup maps
      const driveByTreeId = new Map<string, DriveTreeFile>();
      for (const df of driveFiles) {
        const treeId = extractTreeIdFromFileName(df.name);
        if (treeId) {
          driveByTreeId.set(treeId, df);
          driveFileMap.set(treeId, df.fileId);
        }
      }

      const localByTreeId = new Map<string, FamilyTree>();
      for (const lt of localTrees) {
        localByTreeId.set(lt.treeId, lt);
      }

      // 1. Trees only on Drive -> download to local
      for (const [treeId, df] of driveByTreeId) {
        if (!localByTreeId.has(treeId)) {
          try {
            const cloudTree = await downloadDriveTree(token, df.fileId);
            await saveTree(cloudTree);
          } catch (err) {
            console.error(`Failed to download tree ${treeId} from Drive:`, err);
          }
        }
      }

      // 2. Trees only local (non-public) -> upload to Drive
      for (const [treeId, lt] of localByTreeId) {
        if (!driveByTreeId.has(treeId) && !lt.isPublic) {
          try {
            const fileId = await uploadDriveTree(token, lt);
            driveFileMap.set(treeId, fileId);
          } catch (err) {
            console.error(`Failed to upload tree ${treeId} to Drive:`, err);
          }
        }
      }

      // 3. Trees in both -> check for conflicts
      const conflicts: SyncConflict[] = [];
      for (const [treeId, df] of driveByTreeId) {
        const local = localByTreeId.get(treeId);
        if (local && !local.isPublic) {
          const localDate = new Date(local.modifyDate).getTime();
          const cloudDate = new Date(df.modifiedTime).getTime();
          const diff = Math.abs(localDate - cloudDate);
          // If timestamps differ by more than 2 seconds, it's a conflict
          if (diff > 2000) {
            conflicts.push({
              treeId,
              treeName: local.treeName,
              localModifyDate: local.modifyDate,
              cloudModifyDate: df.modifiedTime,
              driveFileId: df.fileId,
            });
          }
        }
      }

      // Resolve conflicts one by one
      for (const conflict of conflicts) {
        const choice = await waitForConflictResolution(conflict);
        if (choice === 'cloud') {
          try {
            const cloudTree = await downloadDriveTree(token, conflict.driveFileId);
            await saveTree(cloudTree);
          } catch (err) {
            console.error(`Failed to download conflict tree ${conflict.treeId}:`, err);
          }
        } else {
          // Keep local -> push local to Drive
          const localTree = await getTree(conflict.treeId);
          if (localTree) {
            try {
              await updateDriveTree(token, conflict.driveFileId, localTree);
            } catch (err) {
              console.error(`Failed to push local tree ${conflict.treeId} to Drive:`, err);
            }
          }
        }
      }

      await refreshTrees();
      // Refresh current tree if it was synced
      if (currentTree) {
        const refreshed = await getTree(currentTree.treeId);
        if (refreshed) setCurrentTree(refreshed);
      }
    } catch (err) {
      console.error('Drive sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Background push to Drive after saving
  const pushToDrive = useCallback(async (tree: FamilyTree) => {
    if (!accessToken || !isLoggedIn || tree.isPublic) return;
    try {
      const existingFileId = driveFileMap.get(tree.treeId);
      if (existingFileId) {
        await updateDriveTree(accessToken, existingFileId, tree);
      } else {
        const fileId = await uploadDriveTree(accessToken, tree);
        driveFileMap.set(tree.treeId, fileId);
      }
    } catch (err) {
      console.error('Background Drive push failed:', err);
    }
  }, [accessToken, isLoggedIn]);

  const deleteFromDrive = useCallback(async (treeId: string) => {
    if (!accessToken || !isLoggedIn) return;
    const fileId = driveFileMap.get(treeId);
    if (fileId) {
      try {
        await deleteDriveTree(accessToken, fileId);
        driveFileMap.delete(treeId);
      } catch (err) {
        console.error('Drive delete failed:', err);
      }
    }
  }, [accessToken, isLoggedIn]);

  const selectTree = useCallback(async (treeId: string) => {
    const tree = await getTree(treeId);
    if (tree) {
      setCurrentTree(tree);
      await setCurrentTreeId(treeId);
      setLastOpenedTreeId(treeId);
    }
  }, []);

  const createTree = useCallback(async (treeName: string): Promise<string> => {
    const newTree = createEmptyTree(treeName);

    try {
      if ('showSaveFilePicker' in window) {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${treeName.replace(/\s+/g, '_')}.json`,
          types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
        });
        newTree.fileHandle = fileHandle;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to get file handle:', err);
      }
    }

    await saveTree(newTree);
    pushToDrive(newTree);
    await refreshTrees();
    setCurrentTree(newTree);
    await setCurrentTreeId(newTree.treeId);
    setLastOpenedTreeId(newTree.treeId);
    return newTree.treeId;
  }, [refreshTrees, pushToDrive]);

  const importTree = useCallback(async (importedTree: FamilyTree) => {
    const newTree: FamilyTree = {
      ...importedTree,
      treeId: generateTreeId(),
      treeName: importedTree.treeName + ' (Imported)',
      modifyDate: new Date().toISOString(),
      treeData: importedTree.treeData.map(p => ({ ...p, lifeEvents: p.lifeEvents || [] })),
    };
    await saveTree(newTree);
    pushToDrive(newTree);
    await refreshTrees();
    setCurrentTree(newTree);
    await setCurrentTreeId(newTree.treeId);
    setLastOpenedTreeId(newTree.treeId);
  }, [refreshTrees, pushToDrive]);

  const updateTreeFn = useCallback(async (treeId: string, newName: string, isPublic: boolean) => {
    const tree = await getTree(treeId);
    if (tree) {
      tree.treeName = newName;
      tree.isPublic = isPublic;
      tree.modifyDate = new Date().toISOString();
      await saveTree(tree);
      pushToDrive(tree);
      await refreshTrees();
      if (currentTree?.treeId === treeId) {
        setCurrentTree({ ...tree });
      }
    }
  }, [currentTree, refreshTrees, pushToDrive]);

  const deleteTreeFn = useCallback(async (treeId: string) => {
    await deleteTreeStorage(treeId);
    await setMainPersonIdStorage(treeId, null);
    deleteFromDrive(treeId);
    const newList = await refreshTrees();

    if (currentTree?.treeId === treeId) {
      if (newList.length > 0) {
        const firstTree = await getTree(newList[0].treeId);
        if (firstTree) {
          setCurrentTree(firstTree);
          await setCurrentTreeId(firstTree.treeId);
          setLastOpenedTreeId(firstTree.treeId);
        }
      } else {
        setCurrentTree(null);
        await setCurrentTreeId(null);
        setLastOpenedTreeId(null);
      }
    }
  }, [currentTree, refreshTrees, deleteFromDrive]);

  const downloadCurrentTree = useCallback(() => {
    if (currentTree) {
      downloadTree(currentTree);
    }
  }, [currentTree]);

  const saveAndSync = useCallback(async (updatedTree: FamilyTree) => {
    await saveTree(updatedTree);
    setCurrentTree(updatedTree);
    pushToDrive(updatedTree);
  }, [pushToDrive]);

  const savePerson = useCallback(async (person: Person, context?: { parentId: string; relation: 'child' | 'parent' | 'spouse' }) => {
    if (!currentTree) return;

    const updatedTree = { ...currentTree, treeData: [...currentTree.treeData] };
    const existingIndex = updatedTree.treeData.findIndex(p => p.personId === person.personId);

    if (!person.lifeEvents) person.lifeEvents = [];

    if (existingIndex >= 0) {
      const oldPerson = updatedTree.treeData[existingIndex];
      const oldSpouseId = oldPerson.spouses[0]?.spouseId;
      const newSpouseId = person.spouses[0]?.spouseId;

      if (oldSpouseId && oldSpouseId !== newSpouseId) {
        updatedTree.treeData = updatedTree.treeData.map(p =>
          p.personId === oldSpouseId
            ? { ...p, spouses: p.spouses.filter(s => s.spouseId !== person.personId) }
            : p
        );
      }

      if (newSpouseId && newSpouseId !== oldSpouseId) {
        updatedTree.treeData = updatedTree.treeData.map(p => {
          if (p.personId === newSpouseId) {
            const alreadySpouse = p.spouses.some(s => s.spouseId === person.personId);
            if (!alreadySpouse) {
              return { ...p, spouses: [...p.spouses, { spouseId: person.personId, marriageDate: '', divorceDate: '' }] };
            }
          }
          return p;
        });
      }

      updatedTree.treeData[existingIndex] = person;
    } else {
      if (context) {
        const parent = updatedTree.treeData.find(p => p.personId === context.parentId);

        if (context.relation === 'child') {
          if (parent?.gender === 'male') {
            person.fatherId = context.parentId;
            const spouse = parent.spouses[0];
            if (spouse) person.motherId = spouse.spouseId;
          } else {
            person.motherId = context.parentId;
            const spouse = parent?.spouses[0];
            if (spouse) person.fatherId = spouse.spouseId;
          }
        } else if (context.relation === 'parent') {
          if (person.gender === 'male') {
            updatedTree.treeData = updatedTree.treeData.map(p =>
              p.personId === context.parentId ? { ...p, fatherId: person.personId } : p
            );
          } else {
            updatedTree.treeData = updatedTree.treeData.map(p =>
              p.personId === context.parentId ? { ...p, motherId: person.personId } : p
            );
          }
        } else if (context.relation === 'spouse' && parent) {
          if (!person.spouses.length) {
            person.spouses = [{ spouseId: context.parentId, marriageDate: '', divorceDate: '' }];
          }
          const mDate = person.spouses[0]?.marriageDate || '';
          const dDate = person.spouses[0]?.divorceDate || '';
          updatedTree.treeData = updatedTree.treeData.map(p =>
            p.personId === context.parentId
              ? { ...p, spouses: [...p.spouses, { spouseId: person.personId, marriageDate: mDate, divorceDate: dDate }] }
              : p
          );
        }
      }
      updatedTree.treeData.push(person);
    }

    await saveAndSync(updatedTree);
  }, [currentTree, saveAndSync]);

  const deletePerson = useCallback(async (personId: string) => {
    if (!currentTree) return;

    const updatedTree = { ...currentTree };
    updatedTree.treeData = updatedTree.treeData
      .filter(p => p.personId !== personId)
      .map(p => ({
        ...p,
        fatherId: p.fatherId === personId ? undefined : p.fatherId,
        motherId: p.motherId === personId ? undefined : p.motherId,
        spouses: p.spouses.filter(s => s.spouseId !== personId),
      }));

    if (updatedTree.defaultPersonId === personId) {
      updatedTree.defaultPersonId = undefined;
    }

    await saveAndSync(updatedTree);
  }, [currentTree, saveAndSync]);

  const updateSpouseDates = useCallback(async (personId: string, spouseId: string, marriageDate: string, divorceDate: string) => {
    if (!currentTree) return;
    const updatedTree = { ...currentTree };
    updatedTree.treeData = updatedTree.treeData.map(p => {
      if (p.personId === personId) {
        return { ...p, spouses: p.spouses.map(s => s.spouseId === spouseId ? { ...s, marriageDate, divorceDate } : s) };
      }
      if (p.personId === spouseId) {
        return { ...p, spouses: p.spouses.map(s => s.spouseId === personId ? { ...s, marriageDate, divorceDate } : s) };
      }
      return p;
    });
    updatedTree.modifyDate = new Date().toISOString();
    await saveAndSync(updatedTree);
  }, [currentTree, saveAndSync]);

  const deleteSpouse = useCallback(async (personId: string, spouseId: string) => {
    if (!currentTree) return;
    const updatedTree = { ...currentTree };
    updatedTree.treeData = updatedTree.treeData.map(p => {
      if (p.personId === personId) {
        return { ...p, spouses: p.spouses.filter(s => s.spouseId !== spouseId) };
      }
      if (p.personId === spouseId) {
        return { ...p, spouses: p.spouses.filter(s => s.spouseId !== personId) };
      }
      return p;
    });
    updatedTree.modifyDate = new Date().toISOString();
    await saveAndSync(updatedTree);
  }, [currentTree, saveAndSync]);

  const linkExistingSpouse = useCallback(async (existingSpouseId: string, ofPersonId: string, marriageDate: string, divorceDate: string) => {
    if (!currentTree) return;
    const updatedTree = { ...currentTree };
    updatedTree.treeData = updatedTree.treeData.map(p => {
      if (p.personId === ofPersonId) {
        const alreadySpouse = p.spouses.some(s => s.spouseId === existingSpouseId);
        if (!alreadySpouse) {
          return { ...p, spouses: [...p.spouses, { spouseId: existingSpouseId, marriageDate, divorceDate }] };
        }
      }
      if (p.personId === existingSpouseId) {
        const alreadySpouse = p.spouses.some(s => s.spouseId === ofPersonId);
        if (!alreadySpouse) {
          return { ...p, spouses: [...p.spouses, { spouseId: ofPersonId, marriageDate, divorceDate }] };
        }
      }
      return p;
    });
    updatedTree.modifyDate = new Date().toISOString();
    await saveAndSync(updatedTree);
  }, [currentTree, saveAndSync]);

  const setDefaultPerson = useCallback(async (personId: string) => {
    if (!currentTree) return;
    const updatedTree = { ...currentTree, defaultPersonId: personId };
    await saveAndSync(updatedTree);
  }, [currentTree, saveAndSync]);

  return (
    <TreeContext.Provider value={{
      trees,
      currentTree,
      lastOpenedTreeId,
      isInitialized,
      isSyncing,
      refreshTrees,
      selectTree,
      createTree,
      importTree,
      updateTree: updateTreeFn,
      deleteTree: deleteTreeFn,
      downloadCurrentTree,
      savePerson,
      deletePerson,
      updateSpouseDates,
      deleteSpouse,
      linkExistingSpouse,
      setDefaultPerson,
    }}>
      {children}
      <SyncConflictModal
        conflict={currentConflict}
        onKeepLocal={handleKeepLocal}
        onKeepCloud={handleKeepCloud}
      />
    </TreeContext.Provider>
  );
}

export function useTree(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTree must be used within TreeProvider');
  return ctx;
}
