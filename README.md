# Finance Tracker

A minimal Expo expense tracker with rupee amounts, five categories, month-by-month browsing, monthly and all-time totals, and confirmed deletion. Expenses are dated today and saved locally on the device using AsyncStorage.

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

Data is local to this installation; clearing app data or uninstalling it removes expenses. This version has no cloud backup, editing or currency selection.

## Android APK

The standalone APK is `Finance-Tracker.apk` in this folder once built. Transfer it to an Android phone and open it to install. It runs without Expo Go or Metro.

Rebuild the generated Android project:

```sh
cd android
NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

The output is `android/app/build/outputs/apk/release/app-release.apk`. Signing files are in `.credentials/`, which is excluded from Git. Keep a private backup of that folder: future APK updates must use the same signing key. Regenerating the Android folder with `expo prebuild --clean` removes the local Gradle signing setup.

## Backups

Open **Data & backup** below the Add expense button.

- **Export JSON** saves all expenses, including previous months, into a folder you select.
- **Import JSON** opens a Finance Tracker version 1 JSON backup (INR, up to 5 MB), previews the number of new entries, and merges after confirmation. Exact duplicate IDs are skipped. Conflicting IDs, unsupported formats, and invalid entries reject the entire import before saving.
- Backups are unencrypted plain text; keep them private. Canceling a picker or import confirmation leaves expenses unchanged.

## Transaction screenshots

Tap **Scan screenshot**, choose an image of one completed payment, review the extracted amount, recipient, category, and date, then tap **Save expense**. Dates can be corrected using YYYY-MM-DD. Historical payments appear in their original month.

OCR runs on the device. The Android APK bundles the Latin-script ML Kit model, including for first use offline. No API key or server upload is used. Screenshots and raw recognized text are not saved in the expense database or backups.

This version handles common English/INR payment receipt labels, such as GPay, PhonePe, and Paytm. Recognition is a suggestion: ambiguous amounts and missing dates are left for manual entry, failed/pending/received-payment screens are flagged, and possible duplicate expenses require confirmation. Layouts, languages, and image quality can affect recognition. Use a single transaction screenshot under 20 MB and 25 megapixels.

The native OCR module requires the standalone app (it is not included in Expo Go). The generated Android app includes `com.google.mlkit:text-recognition:16.0.1`; keep that dependency if regenerating the native project.
