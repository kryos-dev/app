# Kryos

Client for a self-hosted agent. One Expo (SDK 57 / React Native 0.86) codebase, shipped as an Android APK and a static web export.

## Run

```
npm install && npx expo start
```

## Android APK

The `release` workflow runs on every push to `main`: typecheck, `expo prebuild`, Gradle `assembleRelease`, then publishes `kryos.apk` as a GitHub Release. The newest build is always at
https://github.com/kryos-dev/app/releases/latest/download/kryos.apk

## Web

`npx expo export -p web` writes a static site to `dist/`. The web build ships as `ghcr.io/kryos-dev/app/web` and is served at https://app.kryos.dev by the infra repo (`apps/app`). It is same-origin with the Hermes dashboard and gateway, which is why it is not on Vercel (the dashboard allows only localhost CORS and uses SameSite cookies).

## Signing key

Expo's generated Gradle config signs the release APK with the debug keystore. Without a stored key, every CI build gets a fresh throwaway signature and the phone rejects updates until you uninstall. To keep one signature, generate a keystore once:

```
keytool -genkeypair -v -keystore debug.keystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Kryos"
```

then store it, base64-encoded on one line (`base64 -w0 debug.keystore`), as the `ANDROID_DEBUG_KEYSTORE_B64` repository secret. Keep the file itself out of git.
