export interface Spouse {
  spouseId: string;
  marriageDate: string;
  divorceDate: string;
}

export type LifeEventType =
  | 'birth'
  | 'marriage'
  | 'divorce'
  | 'graduation'
  | 'job'
  | 'retirement'
  | 'death'
  | 'custom';

export interface LifeEvent {
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
  lifeEvents: LifeEvent[];
  profilePhotoUrl?: string;
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
  fileHandle?: any;
}

export interface TreeListItem {
  treeId: string;
  treeName: string;
  isPublic?: boolean;
  fileHandle?: any;
}

export interface Position {
  x: number;
  y: number;
}

export interface NodePosition {
  personId: string;
  position: Position;
}
