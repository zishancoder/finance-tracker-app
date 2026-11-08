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

Open **Settings → Data & backup** from the bottom navigation.

- **Export JSON** saves all expenses and monthly budgets, including previous months, into a folder you select.
- **Import JSON** opens a Finance Tracker version 1, 2, 3, 4 or 5 JSON backup (INR, up to 5 MB), previews the number of new entries, and merges after confirmation. Exact duplicate IDs are skipped. Existing budget amounts and carry-forward settings are kept; budgets for new months are added. Conflicting IDs, unsupported formats, and invalid entries reject the entire import before saving.
- Backups are unencrypted plain text; keep them private. Canceling a picker or import confirmation leaves expenses unchanged.

Expense dates can be entered as YYYY-MM-DD, today or earlier.

## Monthly budgets

In the Monthly view, tap **Set monthly budget**, enter a positive rupee amount, and save. Each month has its own budget. The compact budget section shows Monthly budget, a Set up or Edit action, a progress bar, percent used, and spending against the available budget. Before setup it shows an empty bar and an unset total (—). Overspending is highlighted with the amount over budget. Edit or remove a budget without changing expenses. New backups include budgets and categories; old expense-only backups still import.

Enable **Carry unused budget to next month** in a month’s budget form and tap **Save budget** to roll its positive remaining allowance into the next month. This is off by default for each month. For example, a ₹10,000 budget with ₹6,000 spent carries ₹4,000 into the next month, in addition to that month’s own budget. The summary shows the carried amount separately. Carried funds can roll onward when the next month also has a budget with carry-forward enabled. No new base budget is created automatically, and overspending never carries forward.

Turn the switch off and save to stop that month’s carry-forward; removing its budget also stops it. Changing an older budget, expense or switch recalculates later allowances. Version 4 backups include these settings and require this updated app to import; versions 1–3 remain supported.

Expenses from older installations are loaded automatically. New expense and budget changes are stored together so an import saves both in one write.

## Expense details

Tap **Expenses** in the bottom navigation  to open the full-screen expense list. Browse months or switch to All time. Tap **Category** to open the filter sheet. Select a category (including custom categories) and tap **Apply filter** to update the list, expense count, and summary total within the selected month or All time. **Reset** selects All categories; tap **Apply filter** to clear. Closing the sheet or using Android Back discards unapplied changes. The list and its filters scroll independently of the overview, with full descriptions, totals, and confirmed deletion. The bottom navigation and centered plus action stay visible on Home, Expenses, Wallet and Settings. Tabs replace the page directly without a bottom-up drawer animation. The centered green plus opens Add expense with a bottom-to-top drawer transition. Appearance, Data & backup, the budget form, and Cash wallet opened from its overview card slide in from the right as full pages and slide back out to their originating page. The Wallet tab still switches directly; reduced-motion settings disable those transitions. Android Back closes the category filter first, then returns to Home. Add expense is available on every page; Android Back or the close button returns to the overview. The overview summary scrolls on smaller displays.

The overview fills available space below the budget and wallet cards with the selected month’s newest expenses. It shows only complete rows, adapting to screen and system text size; View expenses opens the full list.

## Appearance

Tap **Settings → Appearance** to open the theme sheet. Choose a **Light** or **Dark** preview card; the selected card has an accent border and filled radio indicator. Changes apply and save immediately. Tap **Done** to close the sheet. Your choice is saved on this device and applies to all app screens and native dialogs. Appearance is stored separately from expenses and budgets.

## Custom categories

In **Add expense**, tap **+ New** beside the category choices (or **Manage → + Create category**), enter a name (up to 30 characters), and tap **Save category**. The category is selected automatically and saved even if you cancel the expense. Blank names and duplicates (ignoring case) are rejected. Custom categories use the Other category color in both themes. Categories are included in version 3 backups, including unused ones; older backups still import. Version 3 backups require this updated app. To delete a category, open **Add expense → Manage**, tap **Delete** beside its name, and confirm. Tap **Done** to return to your expense draft. Its expenses move to **Other**, preserving all amounts and totals. **Other** cannot be deleted. Deletions are saved immediately, even if you cancel the expense form. Importing an older backup may restore deleted categories; conflicting expense IDs are rejected as before. Category renaming is not included.

## Cash wallet

Open **Cash wallet** on the overview. Record your current cash with **Add money**, then add further deposits as you receive them. Enter a description for each entry. In **Add expense**, choose **Cash wallet** under **Pay from** to deduct that expense; **Unassigned** leaves the wallet unchanged. Existing expenses stay unassigned.

The wallet shows its all-time balance, total added, total spent, and activity. Monthly budgets still count all expenses. Money added is not spending and does not change budget allowances. Negative balances are allowed so you can record spending before recording missing deposits. Delete an activity entry after confirmation to recalculate the balance; deleting a wallet expense also removes it from the expense list and budget totals.

Wallet activity is saved locally with your expenses and included in version 5 backups. Importing merges deposits by ID, skips duplicates and rejects conflicts. Versions 1–4 still import and keep existing wallet entries. Version 5 backups require this updated app. This version supports one cash wallet with manual entries; bank connections, transfers and multiple wallets are not included.

## Overview navigation

The overview follows the green card layout, with today’s date, a compact monthly spending card with a calendar badge, expense-count pill, wallet illustration and budget, cash wallet balance, recent expenses and a plus-only Add expense button centered in the bottom navigation. Use the bottom navigation for Home, Expenses, Wallet and Settings. Settings contains Appearance and Data & backup. New installations start in dark mode, while an existing saved appearance is preserved. Both light and dark modes use the new layout.
