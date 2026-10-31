# Finance Tracker

A minimal Expo expense tracker with rupee amounts, custom categories, month-by-month browsing, monthly and all-time totals, and confirmed deletion. Expenses and budgets are saved locally on the device using AsyncStorage.

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
- **Import JSON** opens a Finance Tracker version 1, 2 or 3 JSON backup (INR, up to 5 MB), previews the number of new entries, and merges after confirmation. Exact duplicate IDs are skipped. Existing budget amounts are kept; budgets for new months are added. Conflicting IDs, unsupported formats, and invalid entries reject the entire import before saving.
- Backups are unencrypted plain text; keep them private. Canceling a picker or import confirmation leaves expenses unchanged.

Expense dates can be entered as YYYY-MM-DD, today or earlier.

## Monthly budgets

In the Monthly view, tap **Set monthly budget**, enter a positive rupee amount, and save. Each month has its own budget. The summary shows spending, percent used, and the amount left or over budget. Edit or remove a budget without changing expenses. New backups include budgets and categories; old expense-only backups still import.

Expenses from older installations are loaded automatically. New expense and budget changes are stored together so an import saves both in one write.

## Expense details

Tap **View expenses** on the overview to open the full-screen expense list. Browse months or switch to All time. Tap **Category** to open the filter sheet. Select a category (including custom categories) and tap **Apply filter** to update the list, expense count, and summary total within the selected month or All time. **Reset** selects All categories; tap **Apply filter** to clear. Closing the sheet or using Android Back discards unapplied changes. The list and its filters scroll independently of the overview, with full descriptions, totals, and confirmed deletion. Add expense is available on both screens; Android Back or the close button returns to the overview. The overview summary scrolls on smaller displays.

The overview fills available space below the summary with the selected month’s newest expenses. It shows only complete rows, adapting to screen and system text size; View expenses opens the full list.

## Appearance

Tap **Appearance** below the header to open the theme sheet. Choose a **Light** or **Dark** preview card; the selected card has an accent border and filled radio indicator. Changes apply and save immediately. Tap **Done** to close the sheet. Your choice is saved on this device and applies to all app screens and native dialogs. Appearance is stored separately from expenses and budgets.

## Custom categories

In **Add expense**, tap **+ New** beside the category choices (or **Manage → + Create category**), enter a name (up to 30 characters), and tap **Save category**. The category is selected automatically and saved even if you cancel the expense. Blank names and duplicates (ignoring case) are rejected. Custom categories use the Other category color in both themes. Categories are included in version 3 backups, including unused ones; older backups still import. Version 3 backups require this updated app. To delete a category, open **Add expense → Manage**, tap **Delete** beside its name, and confirm. Tap **Done** to return to your expense draft. Its expenses move to **Other**, preserving all amounts and totals. **Other** cannot be deleted. Deletions are saved immediately, even if you cancel the expense form. Importing an older backup may restore deleted categories; conflicting expense IDs are rejected as before. Category renaming is not included.
