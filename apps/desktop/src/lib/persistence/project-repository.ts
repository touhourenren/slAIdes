import { invoke } from '@tauri-apps/api/core';

export interface BinaryEntry {
  path: string;
  bytes: number[];
}

export interface SaveProjectRequest {
  path: string;
  documentJson: string;
  metadataJson: string;
  assets: BinaryEntry[];
  thumbnails: BinaryEntry[];
}

export interface OpenProjectResult {
  documentJson: string;
  metadataJson: string;
  assets: BinaryEntry[];
  warnings: string[];
}

export interface StageAssetRequest {
  tabId: string;
  hash: string;
  extension: string;
  bytes: number[];
}

export interface ProjectRepository {
  open(path: string): Promise<OpenProjectResult>;
  saveAtomic(request: SaveProjectRequest): Promise<void>;
  writeRecovery(request: SaveProjectRequest): Promise<void>;
  inspectRecovery(path: string): Promise<OpenProjectResult>;
  discardRecovery(path: string): Promise<void>;
  stageAsset(request: StageAssetRequest): Promise<string>;
  readAsset(path: string): Promise<number[]>;
  discardStagedAssets(tabId: string): Promise<void>;
}

export const projectRepository: ProjectRepository = {
  open: (path) => invoke('open_project', { path }),
  saveAtomic: (request) => invoke('save_project_atomic', { request }),
  writeRecovery: (request) => invoke('write_recovery', { request }),
  inspectRecovery: (path) => invoke('inspect_recovery', { path }),
  discardRecovery: (path) => invoke('discard_recovery', { path }),
  stageAsset: (request) => invoke('stage_asset', { request }),
  readAsset: (path) => invoke('read_asset', { path }),
  discardStagedAssets: (tabId) => invoke('discard_staged_assets', { tabId })
};
