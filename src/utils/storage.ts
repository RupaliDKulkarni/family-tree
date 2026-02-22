import { FamilyTree, TreeListItem } from '../types';

const TREES_KEY = 'familyTrees';
const CURRENT_TREE_KEY = 'currentTreeId';

export const getAllTrees = (): FamilyTree[] => {
  const data = localStorage.getItem(TREES_KEY);
  return data ? JSON.parse(data) : [];
};

export const getTreeList = (): (TreeListItem & { isPublic?: boolean })[] => {
  return getAllTrees().map(t => ({ treeId: t.treeId, treeName: t.treeName, isPublic: t.isPublic }));
};

export const getTree = (treeId: string): FamilyTree | null => {
  const trees = getAllTrees();
  return trees.find(t => t.treeId === treeId) || null;
};

export const saveTree = (tree: FamilyTree): void => {
  const trees = getAllTrees();
  const index = trees.findIndex(t => t.treeId === tree.treeId);
  tree.modifyDate = new Date().toISOString();
  
  if (index >= 0) {
    trees[index] = tree;
  } else {
    trees.push(tree);
  }
  
  localStorage.setItem(TREES_KEY, JSON.stringify(trees));
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
