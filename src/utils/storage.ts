import { FamilyTree, TreeListItem } from '../types';
import { getPublicTrees } from '../savedtrees';

const TREES_KEY = 'familyTrees';
const CURRENT_TREE_KEY = 'currentTreeId';
const PUBLIC_TREES_LOADED_KEY = 'publicTreesLoaded';

export const getAllTrees = (): FamilyTree[] => {
  const data = localStorage.getItem(TREES_KEY);
  return data ? JSON.parse(data) : [];
};

export const loadPublicTreesIfNeeded = (): void => {
  const alreadyLoaded = localStorage.getItem(PUBLIC_TREES_LOADED_KEY);
  if (alreadyLoaded) return;

  const existingTrees = getAllTrees();
  const publicTrees = getPublicTrees();
  
  const newTrees = publicTrees.filter(
    pt => !existingTrees.some(et => et.treeId === pt.treeId)
  );

  if (newTrees.length > 0) {
    const allTrees = [...existingTrees, ...newTrees];
    localStorage.setItem(TREES_KEY, JSON.stringify(allTrees));
  }
  
  localStorage.setItem(PUBLIC_TREES_LOADED_KEY, 'true');
};

export const getTreeList = (): (TreeListItem & { isPublic?: boolean })[] => {
  return getAllTrees().map(t => ({ treeId: t.treeId, treeName: t.treeName, isPublic: t.isPublic }));
};

export const getTree = (treeId: string): FamilyTree | null => {
  const trees = getAllTrees();
  return trees.find(t => t.treeId === treeId) || null;
};

export const saveTree = async (tree: FamilyTree): Promise<void> => {
  const trees = getAllTrees();
  const index = trees.findIndex(t => t.treeId === tree.treeId);
  tree.modifyDate = new Date().toISOString();
  
  if (index >= 0) {
    trees[index] = tree;
  } else {
    trees.push(tree);
  }
  
  // We don't want to store fileHandles in localStorage as they are not serializable
  const treesToSave = trees.map(({ fileHandle, ...rest }) => rest);
  localStorage.setItem(TREES_KEY, JSON.stringify(treesToSave));

  // If we have a file handle, save it to the file system automatically
  if (tree.fileHandle && 'createWritable' in tree.fileHandle) {
    try {
      const writable = await (tree.fileHandle as FileSystemFileHandle).createWritable();
      const treeToSaveToFile = { ...tree };
      delete treeToSaveToFile.fileHandle; // Don't save the handle in the json itself
      await writable.write(JSON.stringify(treeToSaveToFile, null, 2));
      await writable.close();
      console.log('Successfully auto-saved to file');
    } catch (error) {
      console.error('Failed to auto-save to file:', error);
      // In a real app we might want to alert the user here if saving fails
    }
  }
};

export const deleteTree = (treeId: string): void => {
  const trees = getAllTrees().filter(t => t.treeId !== treeId);
  localStorage.setItem(TREES_KEY, JSON.stringify(trees));
};

export const getCurrentTreeId = (): string | null => {
  return localStorage.getItem(CURRENT_TREE_KEY);
};

export const setCurrentTreeId = (treeId: string | null): void => {
  if (treeId) {
    localStorage.setItem(CURRENT_TREE_KEY, treeId);
  } else {
    localStorage.removeItem(CURRENT_TREE_KEY);
  }
};

export const downloadTree = (tree: FamilyTree): void => {
  const json = JSON.stringify(tree, null, 2);
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
    treeData: []
  };
};
