import { loadProgress, saveProgress } from './progress.js';

export function loadDiscovered(validIds) {
  return loadProgress(validIds).ids;
}

export function saveDiscovered(discovered) {
  const { codes } = loadProgress();
  saveProgress(discovered, codes);
}

export { loadProgress, saveProgress, registerEtecMissions } from './progress.js';
