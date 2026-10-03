import type { ExpoConfig } from 'expo/config';

// app.json stays the source of truth; only the Android versionCode follows the
// CI build number so each release APK installs as an upgrade.
export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  android: { ...config.android, versionCode: Number(process.env.EXPO_PUBLIC_BUILD ?? 1) },
});
