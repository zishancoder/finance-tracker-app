# Finance Tracker

A minimal Expo expense tracker with rupee amounts, five categories, month-by-month browsing, monthly and all-time totals, and confirmed deletion. Expenses and budgets are saved locally on the device using AsyncStorage.

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

- **Export JSON** saves all expenses and monthly budgets, including previous months, into a folder you select.
- **Import JSON** opens a Finance Tracker version 1 or 2 JSON backup (INR, up to 5 MB), previews the number of new entries, and merges after confirmation. Exact duplicate IDs are skipped. Existing budget amounts are kept; budgets for new months are added. Conflicting IDs, unsupported formats, and invalid entries reject the entire import before saving.
- Backups are unencrypted plain text; keep them private. Canceling a picker or import confirmation leaves expenses unchanged.

Expense dates can be entered as YYYY-MM-DD, today or earlier.

## Monthly budgets

In the Monthly view, tap **Set monthly budget**, enter a positive rupee amount, and save. Each month has its own budget. The summary shows spending, percent used, and the amount left or over budget. Edit or remove a budget without changing expenses. New backups include budgets; old expense-only backups still import.

Expenses from older installations are loaded automatically. New expense and budget changes are stored together so an import saves both in one write.

## Expense details

Tap **View expenses** on the overview to open the full-screen expense list. Browse months or switch to All time. The list and its filters scroll independently of the overview, with full descriptions, totals, and confirmed deletion. Add expense is available on both screens; Android Back or the back arrow returns to the overview. The overview summary scrolls on smaller displays.
