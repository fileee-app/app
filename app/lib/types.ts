// What the server's app API returns. Dates arrive as ISO strings.

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  disabledAt: string | null;
  createdAt: string;
}

export type Provider =
  | "s3"
  | "r2"
  | "b2"
  | "wasabi"
  | "tigris"
  | "spaces"
  | "hetzner"
  | "scaleway"
  | "linode"
  | "vultr"
  | "ovh"
  | "minio"
  | "other";

export interface StorageInfo {
  id: string;
  name: string;
  provider: Provider;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  forcePathStyle: boolean;
  status: string;
  lastCheckedAt: string | null;
  cdnBaseUrl: string | null;
  publicBucket: string | null;
  publicPrefix: string | null;
  accessKeyHint: string | null;
}

export interface Folder {
  id: string;
  storageId: string;
  parentId: string | null;
  name: string;
  trashedAt: string | null;
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  modifiedAt: string;
  starred: boolean;
  storageId: string;
  folderId: string;
  status?: "pending" | "ready" | "missing" | "purging";
  thumbnailUrl?: string | null;
  storageName?: string;
}

export interface FileDetails extends FileItem {
  uploaderName: string | null;
  previewKind: PreviewKind;
  createdAt: string;
  metadata: Record<string, string | number | boolean> | null;
}

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "none";

export interface Page<T, C = string> {
  items: T[];
  nextCursor?: C;
}

export interface ShareLink {
  id: string;
  url: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  downloadCount: number;
  createdAt: string;
}

export interface TrashFile {
  id: string;
  name: string;
  size: number;
  trashedAt: string;
  storageId: string;
  storageName: string;
}

export interface TrashFolder {
  id: string;
  name: string;
  trashedAt: string;
  storageId: string;
  storageName: string;
}
