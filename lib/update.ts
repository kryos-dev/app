import { Platform } from 'react-native';

export interface UpdateInfo {
  latest: number;
  current: number;
  url: string;
}

const REPO = 'https://github.com/kryos-dev/app/releases/latest';
let cached: Promise<UpdateInfo | null> | undefined;

export const currentBuild = Number(process.env.EXPO_PUBLIC_BUILD ?? 0);

// Compares the newest GitHub Release tag (build-<n>) with this build's number.
// Native only, cached for the session, never throws.
export function checkForUpdate(): Promise<UpdateInfo | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  cached ??= (async () => {
    try {
      const r = await fetch('https://api.github.com/repos/kryos-dev/app/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      const latest = Number(/^build-(\d+)$/.exec((await r.json()).tag_name)?.[1]);
      return latest > currentBuild ? { latest, current: currentBuild, url: `${REPO}/download/kryos.apk` } : null;
    } catch {
      return null;
    }
  })();
  return cached;
}
