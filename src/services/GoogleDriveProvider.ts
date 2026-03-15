import { FamilyTree } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER_NAME = 'Family Tree App';

let cachedFolderId: string | null = null;

async function driveRequest(path: string, token: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }
  return res;
}

async function getOrCreateAppFolder(token: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const query = `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    token
  );
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    cachedFolderId = data.files[0].id;
    return cachedFolderId!;
  }

  const createRes = await driveRequest(`${DRIVE_API}/files`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json();
  cachedFolderId = folder.id;
  return cachedFolderId!;
}

function treeFileName(tree: FamilyTree): string {
  return `${tree.treeName.replace(/[^a-zA-Z0-9_\- ]/g, '')}_${tree.treeId}.json`;
}

export interface DriveTreeFile {
  fileId: string;
  name: string;
  modifiedTime: string;
}

export async function listDriveTreeFiles(token: string): Promise<DriveTreeFile[]> {
  const folderId = await getOrCreateAppFolder(token);
  const query = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=drive&pageSize=1000`,
    token
  );
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    fileId: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
  }));
}

export async function downloadDriveTree(token: string, fileId: string): Promise<FamilyTree> {
  const res = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`, token);
  const tree = await res.json();
  tree.treeData = (tree.treeData || []).map((p: any) => ({
    ...p,
    lifeEvents: p.lifeEvents || [],
  }));
  return tree;
}

export async function uploadDriveTree(token: string, tree: FamilyTree): Promise<string> {
  const folderId = await getOrCreateAppFolder(token);
  const { fileHandle: _fh, ...treeData } = tree;
  const content = JSON.stringify(treeData, null, 2);
  const fileName = treeFileName(tree);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.id;
}

export async function updateDriveTree(token: string, fileId: string, tree: FamilyTree): Promise<void> {
  const { fileHandle: _fh, ...treeData } = tree;
  const content = JSON.stringify(treeData, null, 2);
  const fileName = treeFileName(tree);

  const metadata = { name: fileName };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  const res = await fetch(`${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive update error ${res.status}: ${text}`);
  }
}

export async function deleteDriveTree(token: string, fileId: string): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function extractTreeIdFromFileName(fileName: string): string | null {
  const match = fileName.match(/_?(tree_\d+)\.json$/);
  return match ? match[1] : null;
}

export function clearFolderCache(): void {
  cachedFolderId = null;
}
