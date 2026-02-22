import { FamilyTree } from '../types';

import Kulkarni01 from './Kulkarni_01.json';
import MangeshkarFamily from './Mangeshkar_Family.json';
import RajKapoor from './Raj_Kapoor.json';
import TataFamily from './Tata_Family.json';

export const publicTrees: FamilyTree[] = [
  Kulkarni01 as FamilyTree,
  MangeshkarFamily as FamilyTree,
  RajKapoor as FamilyTree,
  TataFamily as FamilyTree,
];

export const getPublicTrees = (): FamilyTree[] => {
  return publicTrees.map(tree => ({
    ...tree,
    isPublic: true,
  }));
};
