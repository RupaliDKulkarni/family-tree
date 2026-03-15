import { FamilyTree } from '../types';
import { indexedDBProvider } from './IndexedDBProvider';

const TREES_KEY = 'familyTrees';
const CURRENT_TREE_KEY = 'currentTreeId';
const PUBLIC_TREES_LOADED_KEY = 'publicTreesLoaded';
const MAIN_PERSON_PREFIX = 'mainPersonId_';
const MIGRATED_KEY = 'idb_migrated';

export async function migrateLegacyStorage(): Promise<void> {
  const alreadyMigrated = await indexedDBProvider.getSetting<boolean>(MIGRATED_KEY);
  if (alreadyMigrated) return;

  const rawTrees = localStorage.getItem(TREES_KEY);
  if (!rawTrees) {
    await indexedDBProvider.setSetting(MIGRATED_KEY, true);
    return;
  }

  try {
    const trees: FamilyTree[] = JSON.parse(rawTrees);
    for (const tree of trees) {
      // Ensure lifeEvents field exists on all persons
      tree.treeData = tree.treeData.map(p => ({
        ...p,
        lifeEvents: p.lifeEvents || [],
      }));
      await indexedDBProvider.saveTree(tree);
    }

    const currentTreeId = localStorage.getItem(CURRENT_TREE_KEY);
    if (currentTreeId) {
      await indexedDBProvider.setSetting('currentTreeId', currentTreeId);
    }

    const publicLoaded = localStorage.getItem(PUBLIC_TREES_LOADED_KEY);
    if (publicLoaded) {
      await indexedDBProvider.setSetting('publicTreesLoaded', true);
    }

    // Migrate mainPersonId entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MAIN_PERSON_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          await indexedDBProvider.setSetting(key, value);
        }
      }
    }

    // Clear legacy keys
    localStorage.removeItem(TREES_KEY);
    localStorage.removeItem(CURRENT_TREE_KEY);
    localStorage.removeItem(PUBLIC_TREES_LOADED_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MAIN_PERSON_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    await indexedDBProvider.setSetting(MIGRATED_KEY, true);
  } catch (error) {
    console.error('Failed to migrate legacy storage:', error);
  }
}
