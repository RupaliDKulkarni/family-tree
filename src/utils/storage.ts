import { FamilyTree, TreeListItem } from '../types';
import { indexedDBProvider } from '../services/IndexedDBProvider';
import { getPublicTrees } from '../savedtrees';

const MAIN_PERSON_KEY = 'mainPersonId_';

export const loadPublicTreesIfNeeded = async (): Promise<void> => {
  const alreadyLoaded = await indexedDBProvider.getSetting<boolean>('publicTreesLoaded');
  if (alreadyLoaded) return;

  const existingTrees = await indexedDBProvider.getAllTrees();
  const publicTrees = getPublicTrees();

  const newTrees = publicTrees.filter(
    pt => !existingTrees.some(et => et.treeId === pt.treeId)
  );

  for (const tree of newTrees) {
    tree.treeData = tree.treeData.map(p => ({
      ...p,
      lifeEvents: p.lifeEvents || [],
    }));
    await indexedDBProvider.saveTree(tree);
  }

  await indexedDBProvider.setSetting('publicTreesLoaded', true);
};

export const getAllTrees = (): Promise<FamilyTree[]> => {
  return indexedDBProvider.getAllTrees();
};

export const getTreeList = (): Promise<TreeListItem[]> => {
  return indexedDBProvider.listTrees();
};

export const getTree = (treeId: string): Promise<FamilyTree | null> => {
  return indexedDBProvider.getTree(treeId);
};

export const saveTree = (tree: FamilyTree): Promise<void> => {
  return indexedDBProvider.saveTree(tree);
};

export const deleteTree = (treeId: string): Promise<void> => {
  return indexedDBProvider.deleteTree(treeId);
};

export const getCurrentTreeId = (): Promise<string | null> => {
  return indexedDBProvider.getSetting<string>('currentTreeId');
};

export const setCurrentTreeId = async (treeId: string | null): Promise<void> => {
  if (treeId) {
    await indexedDBProvider.setSetting('currentTreeId', treeId);
  } else {
    await indexedDBProvider.deleteSetting('currentTreeId');
  }
};

export const getMainPersonId = (treeId: string): Promise<string | null> => {
  return indexedDBProvider.getSetting<string>(MAIN_PERSON_KEY + treeId);
};

export const setMainPersonId = (treeId: string, personId: string | null): Promise<void> => {
  if (personId) {
    return indexedDBProvider.setSetting(MAIN_PERSON_KEY + treeId, personId);
  }
  return indexedDBProvider.deleteSetting(MAIN_PERSON_KEY + treeId);
};

export const downloadTree = (tree: FamilyTree): void => {
  const { fileHandle: _fh, ...treeWithoutHandle } = tree;
  const json = JSON.stringify(treeWithoutHandle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tree.treeName.replace(/\s+/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateTreeId = (): string => {
  return `tree_${Date.now()}`;
};

export const generatePersonId = (): string => {
  return `p${Date.now()}`;
};

export const createEmptyTree = (name: string): FamilyTree => {
  return {
    treeId: generateTreeId(),
    treeName: name,
    creatorEmailId: 'local@familytree.app',
    createDate: new Date().toISOString(),
    modifyDate: new Date().toISOString(),
    treeData: [],
  };
};
