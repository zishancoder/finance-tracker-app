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
