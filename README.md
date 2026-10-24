# Finance Tracker

A minimal Expo expense tracker with rupee amounts, five categories, monthly and all-time totals, and confirmed deletion. Expenses are dated today and saved locally on the device using AsyncStorage.

```sh
npm install
npm run android
```

To use an already running Expo server, open the project in Expo Go. Start with `npm start` otherwise.

Checks:

```sh
npm test
npx tsc --noEmit
```

Data is local to this installation; clearing app data or uninstalling it removes expenses. This version has no cloud backup, editing, backdated entries, or currency selection.

## Android APK

The standalone APK is `Finance-Tracker.apk` in this folder once built. Transfer it to an Android phone and open it to install. It runs without Expo Go or Metro.

Rebuild the generated Android project:

```sh
cd android
NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

The output is `android/app/build/outputs/apk/release/app-release.apk`. Signing files are in `.credentials/`, which is excluded from Git. Keep a private backup of that folder: future APK updates must use the same signing key. Regenerating the Android folder with `expo prebuild --clean` removes the local Gradle signing setup.
