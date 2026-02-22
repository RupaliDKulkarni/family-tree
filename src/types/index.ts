export interface Spouse {
  spouseId: string;
  marriageDate: string;
  divorceDate: string;
}

export interface Person {
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
}

export interface FamilyTree {
  treeId: string;
  treeName: string;
  creatorEmailId: string;
  createDate: string;
  modifyDate: string;
  treeData: Person[];
  defaultPersonId?: string;
  isPublic?: boolean;
}

export interface TreeListItem {
  treeId: string;
  treeName: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface NodePosition {
  personId: string;
  position: Position;
}
