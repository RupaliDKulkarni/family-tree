import { FamilyTree, TreeListItem } from '../types';

export interface StorageProvider {
  listTrees(): Promise<TreeListItem[]>;
  getTree(treeId: string): Promise<FamilyTree | null>;
  saveTree(tree: FamilyTree): Promise<void>;
  deleteTree(treeId: string): Promise<void>;
  getAllTrees(): Promise<FamilyTree[]>;
  getSetting<T = unknown>(key: string): Promise<T | null>;
  setSetting<T = unknown>(key: string, value: T): Promise<void>;
  deleteSetting(key: string): Promise<void>;
}
