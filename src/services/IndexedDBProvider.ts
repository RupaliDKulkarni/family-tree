import { openDB, IDBPDatabase } from 'idb';
import { FamilyTree, TreeListItem } from '../types';
import { StorageProvider } from './StorageProvider';

const DB_NAME = 'family-tree-db';
const DB_VERSION = 1;
const TREES_STORE = 'trees';
const SETTINGS_STORE = 'settings';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TREES_STORE)) {
          db.createObjectStore(TREES_STORE, { keyPath: 'treeId' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

async function autoSaveToFile(tree: FamilyTree): Promise<void> {
  if (tree.fileHandle && 'createWritable' in tree.fileHandle) {
    try {
      const writable = await (tree.fileHandle as FileSystemFileHandle).createWritable();
      const { fileHandle: _fh, ...treeWithoutHandle } = tree;
      await writable.write(JSON.stringify(treeWithoutHandle, null, 2));
      await writable.close();
    } catch (error) {
      console.error('Failed to auto-save to file:', error);
    }
  }
}

export const indexedDBProvider: StorageProvider = {
  async getAllTrees(): Promise<FamilyTree[]> {
    const db = await getDB();
    return db.getAll(TREES_STORE);
  },

  async listTrees(): Promise<TreeListItem[]> {
    const trees = await this.getAllTrees();
    return trees.map(t => ({
      treeId: t.treeId,
      treeName: t.treeName,
      isPublic: t.isPublic,
    }));
  },

  async getTree(treeId: string): Promise<FamilyTree | null> {
    const db = await getDB();
    const tree = await db.get(TREES_STORE, treeId);
    return tree || null;
  },

  async saveTree(tree: FamilyTree): Promise<void> {
    const db = await getDB();
    tree.modifyDate = new Date().toISOString();
    const { fileHandle, ...treeWithoutHandle } = tree;
    await db.put(TREES_STORE, treeWithoutHandle);
    await autoSaveToFile(tree);
  },

  async deleteTree(treeId: string): Promise<void> {
    const db = await getDB();
    await db.delete(TREES_STORE, treeId);
  },

  async getSetting<T = unknown>(key: string): Promise<T | null> {
    const db = await getDB();
    const entry = await db.get(SETTINGS_STORE, key);
    return entry ? entry.value : null;
  },

  async setSetting<T = unknown>(key: string, value: T): Promise<void> {
    const db = await getDB();
    await db.put(SETTINGS_STORE, { key, value });
  },

  async deleteSetting(key: string): Promise<void> {
    const db = await getDB();
    await db.delete(SETTINGS_STORE, key);
  },
};
