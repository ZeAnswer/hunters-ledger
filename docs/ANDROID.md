# Building the Android app

One-time setup on the mac:

1. Install Android Studio: `brew install --cask android-studio` (or from https://developer.android.com/studio). Open it once and let it install the SDK + platform tools. It bundles its own JDK.
2. On the phone: Settings → About phone → tap "Build number" 7× → Developer options → enable USB debugging. Or skip USB and sideload the APK file.

Build:

```sh
npm run build                      # engine typecheck + web bundle
npx --workspace packages/app cap sync android   # copies dist/ into android/ and updates plugins
npx --workspace packages/app cap open android   # opens Android Studio
```

In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s). The APK lands in
`packages/app/android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to the phone (USB, Drive, WhatsApp to self) and open it to install; allow "install from unknown sources" when asked.

Or with a phone connected over USB: Run ▶ in Android Studio installs and launches directly.

Data lives in the app's private storage (`Directory.Data`), untouched by browser cache clears; it is removed only when the app is uninstalled. Use Settings → Full backup to share a JSON copy to Drive before uninstalling or switching phones.

Updating the app later: rebuild the APK and install over the old one; data is kept.
