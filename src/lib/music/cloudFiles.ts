import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';

let musicFilesInstance: Files | null = null;

export function getMusicFiles(): Files {
  if (!musicFilesInstance) {
    musicFilesInstance = new Files({ adapter: neon({ bucket: 'music' }) });
  }
  return musicFilesInstance;
}

