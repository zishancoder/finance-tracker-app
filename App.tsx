import { useEffect, useRef, useState } from 'react';
import { Alert, Appearance, ActivityIndicator, BackHandler, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PageModal } from './PageModal';
import { recentExpensesForSpace } from './recentExpenses';
import { themes } from './theme';
import type { Theme } from './theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Directory, File } from 'expo-file-system';
import { walletSummary, readWalletDeposits, monthlyBudget, budgetSummary, readTrackerData, localDate, parseExpenseDate, categoryName, deleteCategory, categories, expenseTotal, money, parseAmount, readExpenses, expensesForCategory, expensesForMonth, shiftMonth, exportBackup, importBackup, MAX_BACKUP_SIZE } from './expenses';
import type { WalletDeposit, TrackerData, Budgets, Expense, Category } from './expenses';

const STORAGE_KEY = 'finance-tracker.data.v2';
const LEGACY_STORAGE_KEY = 'finance-tracker.expenses.v1';
const THEME_KEY = 'finance-tracker.theme';

function Tracker() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [themeBusy, setThemeBusy] = useState(true);
  const [page, setPage] = useState<'Home' | 'Expenses' | 'Wallet' | 'Settings'>('Home');
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const theme = themes[mode];
  const s = styles[mode];
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setMode(saved);
    }).catch(() => Alert.alert('Couldn’t load appearance', 'You can choose your preferred mode again.'))
      .finally(() => setThemeBusy(false));
  }, []);
  useEffect(() => { Appearance.setColorScheme(mode); }, [mode]);

  async function chooseTheme(next: 'light' | 'dark') {
    if (themeBusy || next === mode) return;
    setThemeBusy(true);
    try {
      await AsyncStorage.setItem(THEME_KEY, next);
      setMode(next);
    } catch { Alert.alert('Couldn’t save appearance', 'Please try again.'); }
    finally { setThemeBusy(false); }
  }

  const { fontScale } = useWindowDimensions();
  const [recentHeight, setRecentHeight] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [walletDeposits, setWalletDeposits] = useState<WalletDeposit[]>([]);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletTitle, setWalletTitle] = useState('');
  const [walletError, setWalletError] = useState('');
  const [payFromWallet, setPayFromWallet] = useState(false);
  const wallet = walletSummary(expenses, walletDeposits);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [carryForwardMonths, setCarryForwardMonths] = useState<string[]>([]);
  const [budgetCarryForward, setBudgetCarryForward] = useState(false);
  const [walletCardOpen, setWalletCardOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [month, setMonth] = useState(() => shiftMonth(new Date(), 0));
  const [open, setOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const transferBusy = useRef(false);
  const [expenseDate, setExpenseDate] = useState(() => localDate());
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [savedCategories, setSavedCategories] = useState<string[]>([...categories]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [error, setError] = useState('');
  const now = new Date();
  const currentMonth = shiftMonth(now, 0);
  const isCurrentMonth = month.getTime() === currentMonth.getTime();
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthlyExpenses = expensesForMonth(expenses, month);
  const visible = expensesForCategory(period === 'month' ? monthlyExpenses : expenses, categoryFilter);
  const recent = recentExpensesForSpace(monthlyExpenses, recentHeight, fontScale);
  const spent = expenseTotal(monthlyExpenses);
  const monthKey = localDate(month).slice(0, 7);
  const budget = budgets[monthKey];
  const availableBudget = monthlyBudget(expenses, budgets, carryForwardMonths, monthKey);
  const usage = availableBudget.total ? budgetSummary(spent, availableBudget.total) : null;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'Home') return false;
      if (saving || transferring) return true;
      if (filterOpen) setFilterOpen(false);
      else setPage('Home');
      return true;
    });
    return () => subscription.remove();
  }, [page, filterOpen, saving, transferring]);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      let data: TrackerData;
      if (stored === null) {
        const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        data = { expenses: readExpenses(legacy), budgets: {}, categories: [...categories] };
      } else {
        data = readTrackerData(stored);
      }
      setExpenses(data.expenses);
      setWalletDeposits(data.walletDeposits ?? []);
      setBudgets(data.budgets);
      setCarryForwardMonths(data.carryForwardMonths ?? []);
      setSavedCategories(data.categories);
    }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save(next: Expense[], nextBudgets: Budgets = budgets, nextCategories: string[] = savedCategories, nextCarryForward: string[] = carryForwardMonths, nextDeposits: WalletDeposit[] = walletDeposits) {
    if (busy.current || loading || loadError) return false;
    busy.current = true;
    setSaving(true);
    try {
      walletSummary(next, readWalletDeposits(nextDeposits));
      expenseTotal(next);
      monthlyBudget(next, nextBudgets, nextCarryForward, '9999-12');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses: next, budgets: nextBudgets, categories: nextCategories, carryForwardMonths: nextCarryForward, walletDeposits: nextDeposits }));
      setExpenses(next);
      setWalletDeposits(nextDeposits);
      setBudgets(nextBudgets);
      setCarryForwardMonths(nextCarryForward);
      setSavedCategories(nextCategories);
      if (categoryFilter !== null && !nextCategories.includes(categoryFilter)) setCategoryFilter(null);
      return true;
    } catch {
      Alert.alert('Couldn’t save', 'Your data has not changed. Please try again.');
      return false;
    } finally { busy.current = false; setSaving(false); }
  }

  async function add() {
    const cents = parseAmount(amount);
    if (!cents) { setError('Enter an amount greater than zero, with up to 2 decimal places.'); return; }
    if (!title.trim()) { setError('Add a short description for this expense.'); return; }
    const date = parseExpenseDate(expenseDate);
    if (!date || expenseDate > localDate()) { setError('Enter a valid date as YYYY-MM-DD, today or earlier.'); return; }
    const item: Expense = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), cents, category, date: date.toISOString(), ...(payFromWallet ? { wallet: true } : {}) };
    if (await save([item, ...expenses])) {
      setMonth(shiftMonth(date, 0));
      setPeriod('month');
      setOpen(false);
    }
  }

  async function addWalletMoney() {
    const cents = parseAmount(walletAmount);
    if (!cents) { setWalletError('Enter an amount greater than zero, with up to 2 decimal places.'); return; }
    if (!walletTitle.trim()) { setWalletError('Add a short description for this money.'); return; }
    const deposit: WalletDeposit = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: walletTitle.trim(), cents, date: new Date().toISOString() };
    if (await save(expenses, budgets, savedCategories, carryForwardMonths, [deposit, ...walletDeposits])) {
      setWalletAmount(''); setWalletTitle(''); setWalletError('');
    }
  }

  function removeDeposit(item: WalletDeposit) {
    Alert.alert('Delete money added?', `${item.title} · ${money(item.cents)}. Your wallet balance will be recalculated.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void save(expenses, budgets, savedCategories, carryForwardMonths, walletDeposits.filter((deposit) => deposit.id !== item.id)); } },
    ]);
  }

  async function createCategory() {
    let name: string;
    try { name = categoryName(newCategory, savedCategories); }
    catch (failure) { setCategoryError((failure as Error).message); return; }
    if (await save(expenses, budgets, [...savedCategories, name])) {
      setCategory(name);
      setManagingCategories(false);
      setCreatingCategory(false);
      setNewCategory('');
      setCategoryError('');
    }
  }

  function removeCategory(name: string) {
    const count = expenses.filter((expense) => expense.category === name).length;
    Alert.alert('Delete category?', `Delete “${name}”? ${count} ${count === 1 ? 'expense will' : 'expenses will'} move to Other. Your expenses and spending totals will be kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const next = deleteCategory({ expenses, budgets, categories: savedCategories }, name);
        if (await save(next.expenses, next.budgets, next.categories) && category === name) setCategory('Other');
      } },
    ]);
  }

  function remove(item: Pick<Expense, 'id' | 'title' | 'cents'>) {
    Alert.alert('Delete expense?', `${item.title} · ${money(item.cents)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void save(expenses.filter((expense) => expense.id !== item.id)); } },
    ]);
  }

  async function saveBudget(remove = false) {
    const amount = parseAmount(budgetAmount);
    if (!remove && !amount) { setBudgetError('Enter a budget greater than zero, with up to 2 decimal places.'); return; }
    const next = { ...budgets };
    if (remove) delete next[monthKey];
    else next[monthKey] = amount!;
    const nextCarry = carryForwardMonths.filter((key) => key !== monthKey);
    if (!remove && budgetCarryForward) nextCarry.push(monthKey);
    if (await save(expenses, next, savedCategories, nextCarry)) setBudgetOpen(false);
  }

  async function transfer(action: 'export' | 'import') {
    if (transferBusy.current || busy.current) return;
    transferBusy.current = true;
    setTransferring(true);
    let output: File | undefined;
    try {
      if (action === 'export') {
        const data = exportBackup(expenses, budgets, savedCategories, carryForwardMonths, walletDeposits);
        const directory = await Directory.pickDirectoryAsync();
        output = directory.createFile(`finance-tracker-${Date.now()}.json`, 'application/json');
        await output.write(data);
        output = undefined;
        Alert.alert('Backup saved', `All ${expenses.length} expenses and ${Object.keys(budgets).length} monthly budgets, plus all categories, wallet activity and carry-forward settings, were exported to the folder you selected.`);
      } else {
        const picked = await File.pickFileAsync(undefined, 'application/json');
        const file = Array.isArray(picked) ? picked[0] : picked;
        if (!file || file.size === null || file.size > MAX_BACKUP_SIZE) throw new Error('Choose a JSON backup up to 5 MB.');
        const next = importBackup(await file.text(), expenses, budgets, savedCategories, carryForwardMonths, walletDeposits);
        const addedDeposits = (next.walletDeposits ?? []).length - walletDeposits.length;
        const added = next.expenses.length - expenses.length;
        const addedBudgets = Object.keys(next.budgets).length - Object.keys(budgets).length;
        const addedCategories = next.categories.length - savedCategories.length;
        if (added === 0 && addedBudgets === 0 && addedCategories === 0 && addedDeposits === 0) { Alert.alert('Already up to date', 'No new wallet deposits, expenses, categories or monthly budgets were found in this backup.'); return; }
        const confirmed = await new Promise<boolean>((resolve) => Alert.alert(
          'Import backup?',
          `Add ${addedDeposits} wallet deposits, ${added} expenses, ${addedBudgets} monthly budgets and ${addedCategories} categories? Existing expenses, budget amounts and carry-forward settings will be kept, and duplicates will be skipped.`,
          [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Import', onPress: () => resolve(true) }],
          { cancelable: true, onDismiss: () => resolve(false) },
        ));
        if (confirmed && await save(next.expenses, next.budgets, next.categories, next.carryForwardMonths ?? [], next.walletDeposits ?? [])) {
          setPeriod('all');
          Alert.alert('Import complete', `${addedDeposits} wallet deposits, ${added} expenses, ${addedBudgets} monthly budgets and ${addedCategories} categories were added.`, [{ text: 'View expenses', onPress: () => { setBackupOpen(false); setPage('Expenses'); } }]);
        }
      }
    } catch (failure) {
      if (output) { try { output.delete(); } catch { /* The system may already have removed a failed file. */ } }
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : '';
      if (code !== 'ERR_PICKER_CANCELLED' && code !== 'ERR_PICKER_CANCELED') {
        Alert.alert(action === 'export' ? 'Couldn’t export' : 'Couldn’t import', failure instanceof Error ? failure.message : 'Please try again.');
      }
    } finally { transferBusy.current = false; setTransferring(false); }
  }

  function startExpense() {
    setManagingCategories(false); setCreatingCategory(false); setNewCategory(''); setCategoryError('');
    setPayFromWallet(false); setTitle(''); setAmount(''); setCategory(savedCategories.includes('Food') ? 'Food' : 'Other'); setExpenseDate(localDate()); setError(''); setOpen(true);
  }

  const monthNavigation = (
    <View style={s.monthNavigation}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((value) => shiftMonth(value, -1))} style={s.monthArrow}><Text style={s.monthArrowText}>‹</Text></Pressable>
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.monthLabel}>{monthLabel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: month >= currentMonth }} disabled={month >= currentMonth} onPress={() => setMonth((value) => shiftMonth(value, 1))} style={[s.monthArrow, month >= currentMonth && s.disabled]}><Text style={s.monthArrowText}>›</Text></Pressable>
            </View>
  );

  const walletContent = (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.formHeader}><Text accessibilityRole="header" style={s.sectionTitle}>Cash wallet</Text><Pressable accessibilityRole="button" accessibilityLabel="Close wallet" disabled={saving} onPress={() => { if (walletCardOpen) setWalletCardOpen(false); else setPage('Home'); }} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <FlatList style={s.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}
            data={[...walletDeposits.map((item) => ({ ...item, deposit: true })), ...expenses.filter((item) => item.wallet).map((item) => ({ ...item, deposit: false }))].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))}
            keyExtractor={(item) => `${item.deposit ? 'deposit' : 'expense'}-${item.id}`}
            ListHeaderComponent={<>
              <View style={s.filteredSummary}><Text style={s.filteredCategory}>Available balance · all time</Text><Text accessibilityLiveRegion="polite" adjustsFontSizeToFit numberOfLines={1} style={s.filteredTotal}>{money(wallet.balance)}</Text><Text style={s.filteredScope}>Added {money(wallet.added)} · Spent {money(wallet.spent)}</Text></View>
              <Text style={s.backupCopy}>Record cash you have or money you receive. Choose Cash wallet when adding an expense to deduct it here. Existing expenses stay unassigned.</Text>
              {wallet.balance < 0 && <Text style={s.overBudget}>Recorded spending exceeds money added by {money(-wallet.balance)}.</Text>}
              <Text style={s.label}>Add money · rupees</Text><TextInput accessibilityLabel="Money to add in rupees" keyboardType="decimal-pad" value={walletAmount} onChangeText={setWalletAmount} editable={!saving} placeholder="0.00" placeholderTextColor={theme.placeholder} maxLength={11} style={s.input} />
              <Text style={s.label}>Description</Text><TextInput accessibilityLabel="Money added description" value={walletTitle} onChangeText={setWalletTitle} editable={!saving} placeholder="e.g. Opening cash or salary" placeholderTextColor={theme.placeholder} maxLength={80} style={s.input} />
              {!!walletError && <Text accessibilityRole="alert" style={s.error}>{walletError}</Text>}
              <Pressable accessibilityRole="button" disabled={saving} onPress={addWalletMoney} style={[s.primary, saving && s.disabled]}><Text style={s.primaryText}>{saving ? 'Saving…' : 'Add money'}</Text></Pressable>
              <Text accessibilityRole="header" style={[s.sectionTitle, { marginTop: 28, marginBottom: 12 }]}>Wallet activity</Text>
            </>}
            ListEmptyComponent={<Text style={s.backupCopy}>No wallet activity yet.</Text>}
            renderItem={({ item }) => <View style={s.row}><View style={s.rowBody}><Text style={s.rowTitle}>{item.title}</Text><Text style={s.rowSubtitle}>{item.deposit ? 'Money added' : 'Expense'} · {new Date(item.date).toLocaleDateString('en-IN')}</Text><Text style={s.rowAmount}>{item.deposit ? '+' : '−'}{money(item.cents)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} disabled={saving} style={s.delete} onPress={() => item.deposit ? removeDeposit(item) : remove(item)}><Text style={s.deleteText}>×</Text></Pressable></View>}
          />
        </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {page === 'Home' && <>
      <View style={s.header}>
        <View style={s.headerText}><Text accessibilityRole="header" style={s.heading}>Overview</Text><Text style={s.eyebrow}>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</Text></View>
      </View>
      {loading ? <View style={s.center}><ActivityIndicator color={theme.accent} accessibilityLabel="Loading expenses" /></View> : loadError ? (
        <View style={s.center}><Text style={s.emptyTitle}>Couldn’t load your expenses</Text><Text style={s.muted}>Your saved data hasn’t been changed.</Text><Pressable style={s.retry} onPress={load}><Text style={s.link}>Try again</Text></Pressable></View>
      ) : (
        <>
          <ScrollView style={s.flex} contentContainerStyle={s.overviewContent}>
          <View style={s.summary}>
            <View style={s.overviewMonth}><View style={s.calendarBadge}><Ionicons accessible={false} importantForAccessibility="no" name="calendar-outline" size={17} color={theme.summaryText} /></View><Text style={[s.budgetLabel, { fontSize: 14, fontWeight: '600' }]}>{monthLabel}</Text><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((value) => shiftMonth(value, -1))} style={s.overviewArrow}><Ionicons accessible={false} importantForAccessibility="no" name="chevron-back" size={18} color={theme.summaryText} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={month >= currentMonth} onPress={() => setMonth((value) => shiftMonth(value, 1))} style={[s.overviewArrow, month >= currentMonth && s.disabled]}><Ionicons accessible={false} importantForAccessibility="no" name="chevron-forward" size={18} color={theme.summaryText} /></Pressable></View>
            <View style={s.spendingRow}>
              <View style={s.rowBody}>
                <Text style={s.spentLabel}>Total spent</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={s.total}>{money(spent)}</Text>
                <View style={s.summaryBottom}><Text style={s.summaryFoot}>{monthlyExpenses.length ? `${monthlyExpenses.length} ${monthlyExpenses.length === 1 ? 'expense' : 'expenses'} recorded` : 'No expenses yet this month'}</Text></View>
              </View>
              <Image source={require('./assets/spending-wallet.png')} accessible={false} importantForAccessibility="no" style={s.spendingIllustration} resizeMode="contain" />
            </View>
            <View style={s.budgetSection}>
              <Pressable disabled={saving || transferring} accessibilityRole="button" accessibilityLabel={budget ? 'Edit monthly budget' : 'Set monthly budget'} onPress={() => { setBudgetAmount(budget ? (budget / 100).toFixed(2) : ''); setBudgetCarryForward(carryForwardMonths.includes(monthKey)); setBudgetError(''); setBudgetOpen(true); }} style={s.budgetButton}><Text style={s.budgetLabel}>Monthly budget</Text><View style={s.budgetAction}><Text style={s.budgetEdit}>{budget ? 'Edit' : 'Set up'}</Text><Ionicons accessible={false} importantForAccessibility="no" name="chevron-forward" size={14} color={theme.link} /></View></Pressable>
              {availableBudget.carried > 0 && <Text style={s.budgetStat}>{money(availableBudget.carried)} carried from last month</Text>}
              <View accessibilityRole="progressbar" accessibilityLabel="Monthly budget usage" accessibilityValue={{ min: 0, max: 100, now: Math.min(usage?.percent ?? 0, 100), text: usage ? `${usage.percent}% used` : 'No monthly budget set' }} style={s.progressTrack}><View style={[s.progressFill, { width: `${(usage?.progress ?? 0) * 100}%`, backgroundColor: usage && usage.remaining < 0 ? theme.danger : theme.progress }]} /></View>
              <View style={s.budgetStats}><Text style={s.budgetStat}>{usage?.percent ?? 0}% used</Text><Text style={[s.budgetRemaining, usage && usage.remaining < 0 && s.overBudget]}>{money(spent)} of {usage ? money(availableBudget.total) : '—'}</Text></View>
              {usage && usage.remaining < 0 && <Text style={[s.budgetStat, s.overBudget]}>{money(-usage.remaining)} over budget</Text>}
            </View>
            {!isCurrentMonth && <Pressable accessibilityRole="button" onPress={() => setMonth(currentMonth)} style={s.currentMonthButton}><Text style={s.currentMonthText}>Back to this month</Text></Pressable>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Cash wallet, balance ${money(wallet.balance)}`} disabled={saving || transferring} onPress={() => { setWalletError(''); setWalletCardOpen(true); }} style={s.walletCard}>
            <View style={s.walletIcon}><Ionicons accessible={false} importantForAccessibility="no" name="wallet-outline" size={22} color={theme.link} /></View>
            <View style={s.rowBody}><Text style={s.walletTitle}>Cash wallet</Text><Text style={s.walletCaption}>Available balance</Text></View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={s.walletBalance}>{money(wallet.balance)}</Text>
            <Ionicons accessible={false} importantForAccessibility="no" name="chevron-forward" size={18} color={theme.muted} />
          </Pressable>
          <View style={s.recentSpace} onLayout={({ nativeEvent }) => setRecentHeight(nativeEvent.layout.height)}>
            <View style={[s.recentHeader, { height: recent.headerHeight }]}><Text accessibilityRole="header" style={s.walletTitle}>Recent expenses</Text></View>
            {!monthlyExpenses.length && <View style={s.overviewEmpty}><Ionicons accessible={false} importantForAccessibility="no" name="receipt-outline" size={26} color={theme.muted} /><Text style={s.overviewEmptyTitle}>No expenses yet</Text><Text style={s.emptyCopy}>Add your first expense to start tracking.</Text></View>}
            {!!recent.items.length && <>
              {recent.items.map((item) => <View key={item.id} style={[s.recentRow, { height: recent.rowHeight }]}>
                <View style={[s.recentIcon, { backgroundColor: theme.categories[categories.find((name) => name === item.category) ?? 'Other'] }]}><Text style={s.categoryLetter}>{item.category[0]}</Text></View>
                <View style={s.rowBody}><Text numberOfLines={1} style={s.recentTitle}>{item.title}</Text><Text numberOfLines={1} style={s.recentMeta}>{item.category}{item.wallet ? ' · Cash wallet' : ''} · {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={s.recentAmount}>{money(item.cents)}</Text>
              </View>)}
            </>}
          </View>
          </ScrollView>

        </>
      )}
      </>}
      {page === 'Settings' && (
        <View style={s.flex}>
          <View style={s.formHeader}><Text accessibilityRole="header" style={s.sectionTitle}>Settings</Text><Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={() => setPage('Home')} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView contentContainerStyle={s.form}>
            <Pressable accessibilityRole="button" onPress={() => { setAppearanceOpen(true); }} style={s.settingsRow}><Ionicons accessible={false} importantForAccessibility="no" name="color-palette-outline" size={22} color={theme.link} /><View style={s.rowBody}><Text style={s.rowTitle}>Appearance</Text><Text style={s.rowSubtitle}>{mode === 'dark' ? 'Dark' : 'Light'} mode</Text></View><Ionicons accessible={false} importantForAccessibility="no" name="chevron-forward" size={18} color={theme.muted} /></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setBackupOpen(true); }} style={s.settingsRow}><Ionicons accessible={false} importantForAccessibility="no" name="cloud-download-outline" size={22} color={theme.link} /><View style={s.rowBody}><Text style={s.rowTitle}>Data & backup</Text><Text style={s.rowSubtitle}>Export or restore your data</Text></View><Ionicons accessible={false} importantForAccessibility="no" name="chevron-forward" size={18} color={theme.muted} /></Pressable>
            <Text style={s.backupCopy}>Your expenses and wallet activity are saved on this device.</Text>
          </ScrollView>
        </View>
      )}
      <PageModal visible={appearanceOpen} onRequestClose={() => { if (!themeBusy) setAppearanceOpen(false); }}>
        <SafeAreaView style={s.screen}>
          <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
          <View style={s.formHeader}><Text accessibilityRole="header" style={s.sectionTitle}>Appearance</Text><Pressable accessibilityRole="button" accessibilityLabel="Close appearance settings" disabled={themeBusy} onPress={() => setAppearanceOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
            <ScrollView contentContainerStyle={s.form}>
              <Text style={s.appearanceSubtitle}>Preview and choose your theme.</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Color theme" style={s.themeCards}>
                {(['light', 'dark'] as const).map((value) => {
                  const preview = themes[value];
                  return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value === 'light' ? 'Light' : 'Dark'} mode`} accessibilityHint="Applies and saves this theme" accessibilityState={{ checked: mode === value, disabled: themeBusy }} disabled={themeBusy} onPress={() => chooseTheme(value)} style={({ pressed }) => [s.themeCard, mode === value && s.themeCardSelected, pressed && s.pressed]}>
                    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.themePreview, { backgroundColor: preview.background, borderColor: preview.border }]}>
                      <View style={s.previewHeader}><View style={[s.previewLine, { width: '55%', backgroundColor: preview.text }]} /><View style={[s.previewLogo, { backgroundColor: preview.accent }]} /></View>
                      <View style={[s.previewSummary, { backgroundColor: preview.summary }]}><View style={[s.previewLine, { width: '45%', backgroundColor: preview.summaryMuted }]} /><View style={[s.previewAmount, { backgroundColor: preview.summaryText }]} /><View style={[s.previewLine, { width: '60%', backgroundColor: preview.summaryBorder }]} /></View>
                      <View style={s.previewRow}><View style={[s.previewDot, { backgroundColor: preview.categories.Food }]} /><View style={[s.previewLine, { flex: 1, backgroundColor: preview.border }]} /></View>
                      <View style={[s.previewButton, { backgroundColor: preview.accent }]} />
                    </View>
                    <View style={s.themeCardFooter}><Text style={s.themeCardLabel}>{value === 'light' ? 'Light' : 'Dark'}</Text><View style={[s.themeRadio, mode === value && s.themeRadioSelected]}>{mode === value && <View style={s.themeRadioDot} />}</View></View>
                  </Pressable>;
                })}
              </View>
              <Text style={s.themeSaveNote}>Your choice is saved automatically.</Text>
              <Pressable accessibilityRole="button" disabled={themeBusy} onPress={() => setAppearanceOpen(false)} style={({ pressed }) => [s.primary, pressed && s.pressed, themeBusy && s.disabled]}><Text style={s.primaryText}>Done</Text></Pressable>
            </ScrollView>
        </SafeAreaView>
      </PageModal>
      {page === 'Expenses' && (
        <View style={s.flex}>
          <View style={s.flex} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'}>
          <View style={s.formHeader}><Text accessibilityRole="header" style={[s.sectionTitle, s.flex]}>Expense details</Text><Pressable accessibilityRole="button" accessibilityLabel="Close expense details" onPress={() => setPage('Home')} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <FlatList key={JSON.stringify([period, monthKey, categoryFilter])} style={s.flex} data={visible} keyExtractor={(item) => item.id} contentContainerStyle={[s.list, !visible.length && s.emptyList]} showsVerticalScrollIndicator={true}
            ListHeaderComponent={<View style={s.detailsControls}>
              <View style={s.detailsTabs}><View style={s.tabs}>{(['month', 'all'] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: period === value }} onPress={() => setPeriod(value)} style={[s.tab, period === value && s.tabActive]}><Text style={[s.tabText, period === value && s.tabTextActive]}>{value === 'month' ? 'Monthly' : 'All time'}</Text></Pressable>)}</View></View>
              {period === 'month' && monthNavigation}
              <Pressable accessibilityRole="button" accessibilityLabel={`Filter category: ${categoryFilter ?? 'All categories'}`} accessibilityHint="Opens category filters" onPress={() => { setPendingCategory(categoryFilter); setFilterOpen(true); }} style={({ pressed }) => [s.categoryFilterButton, categoryFilter !== null && s.categoryFilterActive, pressed && s.pressed]}><Text style={s.muted}>Category</Text><View style={s.filterValue}><Text style={s.filterValueText}>{categoryFilter ?? 'All categories'}</Text><Text style={s.link}>›</Text></View></Pressable>
              <View style={s.filteredSummary}>
                <Text accessibilityLiveRegion="polite" style={s.filteredCategory}>{categoryFilter ?? 'All categories'}</Text>
                <Text accessibilityLabel={`Total spending: ${money(expenseTotal(visible))}`} accessibilityLiveRegion="polite" adjustsFontSizeToFit numberOfLines={1} style={s.filteredTotal}>{money(expenseTotal(visible))}</Text>
                <View style={s.filteredSummaryFoot}><Text style={s.filteredScope}>{period === 'month' ? monthLabel : 'All time'}</Text><Text style={s.filteredScope}>{visible.length} {visible.length === 1 ? 'expense' : 'expenses'}</Text></View>
              </View>
              {period === 'month' && !isCurrentMonth && <Pressable accessibilityRole="button" onPress={() => setMonth(currentMonth)} style={s.currentMonthButton}><Text style={s.currentMonthText}>Back to this month</Text></Pressable>}
            </View>}
            ListEmptyComponent={<View style={s.empty}><View style={s.emptyIcon}><Text style={s.emptyIconText}>↗</Text></View><Text style={s.emptyTitle}>{categoryFilter !== null ? 'No matching expenses.' : period === 'month' ? 'No expenses this month.' : 'A fresh start.'}</Text><Text style={s.emptyCopy}>{categoryFilter !== null ? `No spending in ${categoryFilter} ${period === 'month' ? `for ${monthLabel}` : 'yet'}. Try another category or reset the filter.` : period === 'month' && !isCurrentMonth ? `Nothing recorded for ${monthLabel}.` : 'Add an expense to start tracking your spending.'}</Text></View>}
            renderItem={({ item }) => <View style={s.row}>
              <View style={[s.categoryIcon, { backgroundColor: theme.categories[categories.find((name) => name === item.category) ?? 'Other'] }]}><Text style={s.categoryLetter}>{item.category[0]}</Text></View>
              <View style={s.rowBody}><Text style={s.rowTitle}>{item.title}</Text><View style={s.expenseMeta}><Text style={s.rowSubtitle}>{item.category}{item.wallet ? ' · Cash wallet' : ''} · {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.rowAmount}>{money(item.cents)}</Text></View></View>
              <Pressable disabled={saving} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} hitSlop={4} style={s.delete} onPress={() => remove(item)}><Text style={s.deleteText}>×</Text></Pressable>
            </View>}
          />
          </View>
          {filterOpen && <View style={[StyleSheet.absoluteFill, s.appearanceOverlay]} accessibilityViewIsModal>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel category filter" onPress={() => setFilterOpen(false)} style={StyleSheet.absoluteFill} />
            <View style={s.appearanceSheet}>
              <View style={s.filterSheetHeader}><Text accessibilityRole="header" style={[s.sectionTitle, s.flex]}>Filter expenses</Text><Pressable accessibilityRole="button" onPress={() => setPendingCategory(null)} style={s.retry}><Text style={s.link}>Reset</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Close category filter" onPress={() => setFilterOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
              <ScrollView contentContainerStyle={s.filterSheetContent}>
                <Text style={s.muted}>{period === 'month' ? monthLabel : 'All time'}</Text>
                <Text style={s.filterLabel}>CATEGORY</Text>
                <View accessibilityRole="radiogroup" accessibilityLabel="Category filter" style={s.categoryChoices}>
                  {([null, ...savedCategories]).map((value) => <Pressable key={value === null ? 'all' : `category-${value}`} accessibilityRole="radio" accessibilityLabel={value === null ? 'All categories' : `Filter by ${value}`} accessibilityState={{ checked: pendingCategory === value }} onPress={() => setPendingCategory(value)} style={({ pressed }) => [s.chip, pendingCategory === value && s.chipActive, pressed && s.pressed]}><Text style={[s.chipText, pendingCategory === value && s.chipTextActive]}>{value ?? 'All categories'}</Text></Pressable>)}
                </View>
              </ScrollView>
              <View style={s.formFooter}><Pressable accessibilityRole="button" onPress={() => { setCategoryFilter(pendingCategory); setFilterOpen(false); }} style={({ pressed }) => [s.primary, pressed && s.pressed]}><Text style={s.primaryText}>Apply filter</Text></Pressable></View>
            </View>
          </View>}
        </View>
      )}
      {page === 'Wallet' && <View style={s.flex}>{walletContent}</View>}
      <PageModal visible={walletCardOpen} onRequestClose={() => { if (!saving) setWalletCardOpen(false); }}>
        <SafeAreaView style={s.screen}>{walletContent}</SafeAreaView>
      </PageModal>
      {!loading && !loadError && <View style={s.footer} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'}>
            <View accessibilityRole="tablist" style={s.bottomNav}>
              {([{ label: 'Home', icon: 'home-outline', activeIcon: 'home', action: () => setPage('Home') }, { label: 'Expenses', icon: 'list-outline', activeIcon: 'list', action: () => { setPeriod('month'); setPage('Expenses'); } }, { label: 'Add expense', icon: 'add', action: startExpense }, { label: 'Wallet', icon: 'wallet-outline', activeIcon: 'wallet', action: () => { setWalletError(''); setPage('Wallet'); } }, { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings', action: () => setPage('Settings') }] as const).map((tab) => tab.label === 'Add expense' ? <Pressable key={tab.label} accessibilityRole="button" accessibilityLabel="Add expense" accessibilityState={{ disabled: saving || transferring || filterOpen }} disabled={saving || transferring || filterOpen} onPress={startExpense} style={({ pressed }) => [s.navAdd, pressed && s.pressed, (saving || transferring) && s.disabled]}><Ionicons accessible={false} importantForAccessibility="no" name="add" size={38} color={theme.onButton} /></Pressable> : <Pressable key={tab.label} accessibilityLabel={tab.label} accessibilityRole="tab" accessibilityState={{ selected: tab.label === page, disabled: saving || transferring || filterOpen }} disabled={saving || transferring || filterOpen} onPress={() => { Keyboard.dismiss(); tab.action(); }} style={s.navItem}><View style={[s.navIcon, tab.label === page && s.navIconActive]}><Ionicons accessible={false} importantForAccessibility="no" name={tab.label === page ? tab.activeIcon : tab.icon} size={22} color={tab.label === page ? theme.text : theme.muted} /></View><Text style={[s.navLabel, tab.label === page && s.navLabelActive]}>{tab.label}</Text></Pressable>)}
            </View>
          </View>}
      <PageModal visible={budgetOpen} onRequestClose={() => { if (!saving) setBudgetOpen(false); }}>
        <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.formHeader}><Text style={s.sectionTitle}>Monthly budget</Text><Pressable accessibilityRole="button" accessibilityLabel="Close budget form" disabled={saving} onPress={() => setBudgetOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
            <Text style={s.emptyTitle}>{monthLabel}</Text><Text style={s.backupCopy}>Choose this month’s base budget. Any amount carried from last month is added separately.</Text>
            <Text style={s.label}>Budget in rupees</Text><TextInput accessibilityLabel="Monthly budget amount" value={budgetAmount} onChangeText={setBudgetAmount} editable={!saving} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.placeholder} style={s.amountInput} maxLength={11} autoFocus />
            <Text style={s.backupCopy}>Already spent: {money(spent)}{availableBudget.carried > 0 ? ` · Carried from last month: ${money(availableBudget.carried)}` : ''}</Text>
            <View style={s.carryForwardRow}><Text style={[s.sectionTitle, s.flex]}>Carry unused budget to next month</Text><Switch accessibilityLabel="Carry unused budget to next month" value={budgetCarryForward} onValueChange={setBudgetCarryForward} disabled={saving} trackColor={{ true: theme.accent }} /></View>
            <Text style={s.backupCopy}>Only a positive amount left rolls into next month, including any carried funds. Turn this off to stop this month’s carry-forward and recalculate later months. Save budget to apply.</Text>
            {!!budget && <Pressable accessibilityRole="button" disabled={saving} onPress={() => saveBudget(true)} style={s.backupLink}><Text style={s.overBudget}>Remove this month’s budget</Text></Pressable>}
          <View style={s.inlineFormFooter}>{!!budgetError && <Text accessibilityRole="alert" style={[s.error, { marginTop: 0, marginBottom: 12 }]}>{budgetError}</Text>}<Pressable accessibilityRole="button" disabled={saving} onPress={() => saveBudget()} style={s.primary}>{saving ? <ActivityIndicator color={theme.onButton} /> : <Text style={s.primaryText}>Save budget</Text>}</Pressable></View>
          </ScrollView>
        </KeyboardAvoidingView></SafeAreaView>
      </PageModal>
      <PageModal visible={backupOpen} onRequestClose={() => { if (!transferring) setBackupOpen(false); }}>
        <SafeAreaView style={s.screen}>
          <View style={s.formHeader}><Text style={s.sectionTitle}>Data & backup</Text><Pressable accessibilityRole="button" accessibilityLabel="Close backup screen" disabled={transferring} onPress={() => setBackupOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView contentContainerStyle={s.form}>
            <Text style={s.emptyTitle}>Your data, to keep.</Text>
            <Text style={s.backupCopy}>Back up your expenses, categories, monthly budgets, wallet activity and carry-forward settings as a JSON file, or restore a backup from another device.</Text>
            <View style={s.backupCard}><Text style={s.sectionTitle}>Export backup</Text><Text style={s.backupCopy}>Save all {expenses.length} expenses and {Object.keys(budgets).length} monthly budgets. All categories and wallet activity are included. Choose a folder to keep your backup.</Text><Pressable accessibilityRole="button" disabled={transferring} onPress={() => transfer('export')} style={[s.primary, transferring && s.disabled]}><Text style={s.primaryText}>Export JSON</Text></Pressable></View>
            <View style={s.backupCard}><Text style={s.sectionTitle}>Import backup</Text><Text style={s.backupCopy}>Choose a Finance Tracker JSON file (up to 5 MB). Old expense-only backups also work. New wallet deposits, categories, expenses and budgets for new months are added; existing budget amounts are kept.</Text><Pressable accessibilityRole="button" disabled={transferring} onPress={() => transfer('import')} style={[s.primary, transferring && s.disabled]}><Text style={s.primaryText}>Import JSON</Text></Pressable></View>
            {transferring && <ActivityIndicator color={theme.accent} accessibilityLabel="Working with backup" />}
            <Text style={s.backupCopy}>Backup files contain your expense details in plain text. Keep them somewhere private. Your data stays on this device unless you export it.</Text>
          </ScrollView>
        </SafeAreaView>
      </PageModal>
      <Modal visible={open} animationType="slide" onRequestClose={() => { if (!saving) { if (managingCategories) setManagingCategories(false); else setOpen(false); } }}>
        <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {managingCategories ? <>
            <View style={s.formHeader}><Text accessibilityRole="header" style={s.sectionTitle}>{creatingCategory ? 'New category' : 'Categories'}</Text><Pressable accessibilityRole="button" disabled={saving} onPress={() => { if (creatingCategory) setCreatingCategory(false); else setManagingCategories(false); }} style={({ pressed }) => [s.manageCategoriesButton, pressed && s.pressed]}><Text style={s.link}>{creatingCategory ? 'Cancel' : 'Done'}</Text></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.categoryManager}>
              {!creatingCategory && <><Text style={s.eyebrow}>YOUR CATEGORIES</Text>
              <View style={s.categoryList}>{savedCategories.map((value, index) => <View key={value} style={[s.categoryRow, index > 0 && s.categoryRowDivider]}>
                <View style={[s.recentIcon, { backgroundColor: theme.categories[categories.find((name) => name === value) ?? 'Other'] }]}><Text style={s.categoryLetter}>{value[0]}</Text></View>
                <Text style={s.categoryName}>{value}</Text>
                {value === 'Other' ? <Text style={s.muted}>Default</Text> : <Pressable accessibilityRole="button" accessibilityLabel={`Delete category ${value}`} disabled={saving} onPress={() => removeCategory(value)} style={({ pressed }) => [s.deleteCategoryButton, pressed && s.pressed, saving && s.disabled]}><Text style={s.overBudget}>Delete</Text></Pressable>}
              </View>)}</View>
              <Text style={s.categoryHelp}>Deleted categories move their expenses to Other.</Text></>}
            {creatingCategory ? <View style={{ marginTop: 20 }}>
              <Text style={s.label}>New category</Text>
              <TextInput accessibilityLabel="New category name" style={[s.input, { marginBottom: 12 }]} placeholder="e.g. Health" placeholderTextColor={theme.placeholder} value={newCategory} onChangeText={(value) => { setNewCategory(value); setCategoryError(''); }} maxLength={30} editable={!saving} autoFocus onSubmitEditing={createCategory} returnKeyType="done" />
              {!!categoryError && <Text accessibilityRole="alert" style={[s.error, { marginTop: 0, marginBottom: 12 }]}>{categoryError}</Text>}
              <Pressable accessibilityRole="button" disabled={saving} onPress={createCategory} style={[s.primary, saving && s.disabled]}><Text style={s.primaryText}>{saving ? 'Saving…' : 'Save category'}</Text></Pressable>
            </View> : <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setCategoryError(''); setCreatingCategory(true); }} style={({ pressed }) => [s.newCategoryButton, pressed && s.pressed, saving && s.disabled]}><Text style={s.link}>+ Create category</Text></Pressable>}
            </ScrollView>
          </> : <>
          <View style={s.formHeader}><Text style={s.sectionTitle}>New expense</Text><Pressable accessibilityRole="button" accessibilityLabel="Close form" disabled={saving} onPress={() => setOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
            <Text style={s.eyebrow}>HOW MUCH DID YOU SPEND?</Text>
            <View style={s.amountEntry}><Text style={s.currency}>₹</Text><TextInput accessibilityLabel="Amount in rupees" value={amount} onChangeText={setAmount} editable={!saving} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.placeholder} style={s.amountInput} maxLength={11} autoFocus /></View>
            <Text style={s.label}>Description</Text><TextInput accessibilityLabel="Expense description" style={s.input} placeholder="What was it for?" placeholderTextColor={theme.placeholder} value={title} onChangeText={setTitle} maxLength={80} editable={!saving} />
            <View style={s.categoryHeading}><Text style={[s.label, { marginBottom: 0 }]}>Category</Text><Pressable accessibilityRole="button" disabled={saving} onPress={() => { setCreatingCategory(false); setManagingCategories(true); }} style={({ pressed }) => [s.manageCategoriesButton, pressed && s.pressed]}><Text style={s.link}>Manage</Text></Pressable></View>
            <View style={s.categoryChoices}>{savedCategories.map((value) => <Pressable key={value} disabled={saving} accessibilityRole="radio" accessibilityState={{ checked: value === category }} onPress={() => setCategory(value)} style={({ pressed }) => [s.chip, category === value && s.chipActive, pressed && s.pressed]}><Text style={[s.chipText, category === value && s.chipTextActive]}>{category === value ? '✓  ' : ''}{value}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Create category" disabled={saving} onPress={() => { setNewCategory(''); setCategoryError(''); setCreatingCategory(true); setManagingCategories(true); }} style={({ pressed }) => [s.chip, s.newCategoryChip, pressed && s.pressed]}><Text style={s.link}>+ New</Text></Pressable></View>
            <Text style={[s.label, { marginTop: 28 }]}>Pay from</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Payment source" style={s.categoryChoices}>{[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="radio" accessibilityState={{ checked: payFromWallet === value }} disabled={saving} onPress={() => setPayFromWallet(value)} style={[s.chip, payFromWallet === value && s.chipActive]}><Text style={[s.chipText, payFromWallet === value && s.chipTextActive]}>{value ? 'Cash wallet' : 'Unassigned'}</Text></Pressable>)}</View>
            {payFromWallet && <Text style={s.backupCopy}>Balance {money(wallet.balance)}. This expense will reduce your wallet balance.</Text>}
            <Text style={[s.label, { marginTop: 28 }]}>Date · YYYY-MM-DD</Text><TextInput accessibilityLabel="Expense date" placeholder="YYYY-MM-DD" placeholderTextColor={theme.placeholder} value={expenseDate} onChangeText={setExpenseDate} editable={!saving} style={s.input} maxLength={10} autoCorrect={false} autoCapitalize="none" />
          <View style={s.inlineFormFooter}>{!!error && <Text accessibilityRole="alert" style={[s.error, { marginTop: 0, marginBottom: 12 }]}>{error}</Text>}<Pressable disabled={saving} accessibilityRole="button" onPress={add} style={({ pressed }) => [s.primary, pressed && s.pressed, saving && s.disabled]}>{saving ? <ActivityIndicator color={theme.onButton} /> : <Text style={s.primaryText}>Save expense</Text>}</Pressable></View>
          </ScrollView>
          </>}
        </KeyboardAvoidingView></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() { return <SafeAreaProvider><Tracker /></SafeAreaProvider>; }

const createStyles = (theme: Theme) => StyleSheet.create({
  overviewMonth: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calendarBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: theme.summaryControl, alignItems: 'center', justifyContent: 'center' },
  spendingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 16 },
  spendingIllustration: { width: 100, height: 96 },
  overviewArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  walletIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: theme.selected, alignItems: 'center', justifyContent: 'center' },
  walletTitle: { color: theme.text, fontSize: 14, fontWeight: '600' },
  walletCaption: { color: theme.summaryMuted, fontSize: 11, marginTop: 4 },
  overviewEmpty: { flex: 1, minHeight: 132, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  overviewEmptyTitle: { color: theme.text, fontSize: 14, marginTop: 12 },
  bottomNav: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, paddingBottom: 6 },
  navAdd: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.button, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 56 },
  navIcon: { width: 48, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: theme.selected },
  navLabel: { color: theme.muted, fontSize: 10 },
  navLabelActive: { color: theme.text, fontWeight: '700' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: theme.surface, borderRadius: 18, marginBottom: 12, minHeight: 76 },
  walletCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80, marginHorizontal: 20, marginTop: 12, padding: 16, backgroundColor: theme.summary, borderWidth: 1, borderColor: theme.summaryBorder, borderRadius: 18 },
  walletBalance: { fontSize: 22, fontWeight: '700', color: theme.summaryText, maxWidth: '40%', flexShrink: 1, textAlign: 'right' },
  filterLabel: { color: theme.text, fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 12 },
  categoryFilterButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, marginTop: 18, borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surface },
  categoryFilterActive: { borderColor: theme.selectedBorder },
  filterValue: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  filterValueText: { color: theme.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  filteredSummary: { backgroundColor: theme.summary, borderRadius: 24, padding: 22, marginTop: 16, marginBottom: 8 },
  filteredCategory: { color: theme.summaryMuted, fontSize: 14, fontWeight: '500' },
  filteredTotal: { color: theme.summaryText, fontSize: 38, fontWeight: '600', letterSpacing: -1.2, marginTop: 12, marginBottom: 20 },
  filteredSummaryFoot: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  filteredScope: { color: theme.summaryMuted, fontSize: 12 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 24, paddingRight: 16, paddingTop: 20, paddingBottom: 8 },
  filterSheetContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  categoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  manageCategoriesButton: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  newCategoryChip: { borderStyle: 'dashed', backgroundColor: theme.surface },
  categoryManager: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 28 },
  categoryList: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, backgroundColor: theme.surface, paddingHorizontal: 16, marginTop: 16 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 72 },
  categoryRowDivider: { borderTopWidth: 1, borderTopColor: theme.border },
  categoryName: { flex: 1, color: theme.text, fontSize: 15, fontWeight: '500' },
  categoryHelp: { color: theme.muted, fontSize: 13, lineHeight: 21, marginTop: 14, marginBottom: 24 },
  newCategoryButton: { borderWidth: 1, borderColor: theme.selectedBorder, borderRadius: 14, minHeight: 52, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.selected },
  deleteCategoryButton: { borderWidth: 1, borderColor: theme.danger, borderRadius: 12, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  appearanceTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginHorizontal: 24, marginTop: -10, marginBottom: 24, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  appearanceLabel: { color: theme.muted, fontSize: 13, fontWeight: '500', flexShrink: 1 },
  appearanceValue: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appearanceText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  appearanceSwatch: { width: 12, height: 12, borderRadius: 6 },
  appearanceOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay },
  appearanceSheet: { maxHeight: '90%', backgroundColor: theme.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  appearanceContent: { paddingHorizontal: 24, paddingBottom: 24 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginTop: 12, marginBottom: 28 },
  appearanceTitle: { color: theme.text, fontSize: 26, fontWeight: '600', letterSpacing: -0.6 },
  appearanceSubtitle: { color: theme.muted, fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  themeCards: { flexDirection: 'row', gap: 14 },
  themeCard: { flex: 1, minWidth: 0, padding: 10, borderWidth: 2, borderColor: theme.border, borderRadius: 20, backgroundColor: theme.surface },
  themeCardSelected: { borderColor: theme.accent },
  themePreview: { height: 164, borderRadius: 12, borderWidth: 1, padding: 12 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  previewLine: { height: 4, borderRadius: 2 },
  previewLogo: { width: 12, height: 12, borderRadius: 4 },
  previewSummary: { borderRadius: 8, padding: 10, gap: 9 },
  previewAmount: { height: 10, width: '65%', borderRadius: 3 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 10 },
  previewDot: { width: 12, height: 12, borderRadius: 4 },
  previewButton: { height: 15, borderRadius: 5, marginTop: 'auto' },
  themeCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, paddingHorizontal: 2, paddingTop: 8 },
  themeCardLabel: { color: theme.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  themeRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: theme.muted, alignItems: 'center', justifyContent: 'center' },
  themeRadioSelected: { borderColor: theme.accent, backgroundColor: theme.accent },
  themeRadioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.onAccent },
  themeSaveNote: { color: theme.muted, fontSize: 12, textAlign: 'center', marginVertical: 20 },
  inlineFormFooter: { paddingTop: 12, paddingBottom: 8 },
  expenseMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  headerText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }, footerAction: { flex: 1 }, footerLinkText: { color: theme.accent, fontWeight: '600', textAlign: 'center' },
  carryForwardRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, minHeight: 48 },
  recentSpace: { flex: 1, minHeight: 180, marginHorizontal: 20, overflow: 'hidden' },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.divider },
  recentIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recentTitle: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: theme.text },
  recentMeta: { fontSize: 11, lineHeight: 18, color: theme.muted },
  recentAmount: { maxWidth: '40%', fontSize: 14, fontWeight: '600', color: theme.text },
  overviewContent: { flexGrow: 1, paddingBottom: 12 }, footerLinks: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 }, detailsControls: { paddingTop: 4, paddingBottom: 12 }, detailsTabs: { alignItems: 'flex-start', marginBottom: 22 }, detailsTotalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 18, paddingBottom: 8 }, detailsTotal: { color: theme.summaryText, fontSize: 28, fontWeight: '600', flexShrink: 1 },
  spentLabel: { color: theme.summaryMuted, fontSize: 11 }, budgetSection: { borderTopWidth: 1, borderTopColor: theme.summaryBorder, paddingTop: 2 }, budgetButton: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, budgetLabel: { flex: 1, fontSize: 13, color: theme.summaryText, fontWeight: '500' }, budgetAction: { flexDirection: 'row', alignItems: 'center', gap: 3 }, budgetEdit: { color: theme.link, fontWeight: '600', fontSize: 12 }, progressTrack: { height: 9, borderRadius: 5, backgroundColor: theme.summaryControl, overflow: 'hidden', borderWidth: 1, borderColor: theme.summaryBorder }, progressFill: { height: '100%', borderRadius: 4 }, budgetStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 8 }, budgetStat: { fontSize: 11, color: theme.summaryMuted }, budgetRemaining: { fontSize: 11, color: theme.summaryMuted }, overBudget: { color: theme.danger, fontWeight: '600' },
  backupLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, backupCopy: { color: theme.muted, fontSize: 14, lineHeight: 22, marginVertical: 14 }, backupCard: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, padding: 20, marginVertical: 10 },
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '400', letterSpacing: 0, color: theme.muted }, heading: { fontSize: 29, fontWeight: '600', letterSpacing: -0.5, color: theme.text },
  logo: { width: 44, height: 44, borderRadius: 14 },
  summary: { backgroundColor: theme.summary, marginHorizontal: 20, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.summaryBorder }, summaryLabel: { color: theme.summaryMuted, fontSize: 14 },
  monthNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -8, marginHorizontal: 0 }, monthLabel: { flex: 1, textAlign: 'center', color: theme.summaryMuted, fontSize: 15, fontWeight: '500' }, monthArrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: theme.summaryControl }, monthArrowText: { color: theme.summaryText, fontSize: 29, lineHeight: 32 }, currentMonthButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8 }, currentMonthText: { color: theme.link, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  total: { color: theme.summaryText, fontSize: 34, fontWeight: '700', letterSpacing: -0.8, marginTop: 2, marginBottom: 4 },
  summaryBottom: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.summaryControl }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.progress }, summaryFoot: { color: theme.summaryMuted, fontSize: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '600', color: theme.text },
  tabs: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 20, padding: 3 }, tab: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 18 }, tabActive: { backgroundColor: theme.activeTab }, tabText: { fontSize: 12, color: theme.muted }, tabTextActive: { color: theme.text, fontWeight: '600' },
  list: { paddingHorizontal: 24, paddingBottom: 12 }, emptyList: { flexGrow: 1 }, row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: theme.divider, gap: 10 },
  categoryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, categoryLetter: { fontSize: 16, fontWeight: '600', color: theme.categoryText }, rowBody: { flex: 1 }, rowTitle: { fontSize: 15, fontWeight: '500', color: theme.text }, rowSubtitle: { fontSize: 11, color: theme.muted }, rowAmount: { fontSize: 14, fontWeight: '600', color: theme.text, flexShrink: 1 }, delete: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, deleteText: { fontSize: 23, color: theme.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }, emptyIcon: { width: 62, height: 62, backgroundColor: theme.surface, borderRadius: 31, justifyContent: 'center', alignItems: 'center', marginBottom: 19 }, emptyIconText: { fontSize: 27, color: theme.muted }, emptyTitle: { fontSize: 20, fontWeight: '500', color: theme.text }, emptyCopy: { color: theme.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 0 }, primary: { backgroundColor: theme.button, borderRadius: 28, minHeight: 48, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, primaryText: { color: theme.onButton, fontSize: 14, fontWeight: '600' }, plus: { color: theme.onAccent, fontSize: 25, lineHeight: 26, fontWeight: '300' }, pressed: { opacity: 0.8 }, disabled: { opacity: 0.6 }, localNote: { textAlign: 'center', color: theme.muted, fontSize: 10, marginTop: 15 },
  formHeader: { paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderRadius: 22 }, closeText: { fontSize: 27, color: theme.muted }, form: { paddingHorizontal: 28, paddingTop: 44, paddingBottom: 28 }, amountEntry: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 36 }, currency: { fontSize: 38, color: theme.muted, marginRight: 10 }, amountInput: { flex: 1, color: theme.accent, fontSize: 48, fontWeight: '500', paddingVertical: 8 }, label: { fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 12 }, input: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 17, paddingVertical: 17, fontSize: 16, color: theme.accent, marginBottom: 30 }, categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 24, minHeight: 44, paddingHorizontal: 17, justifyContent: 'center' }, chipActive: { backgroundColor: theme.selected, borderColor: theme.selectedBorder }, chipText: { color: theme.muted, fontSize: 13 }, chipTextActive: { color: theme.text, fontWeight: '600' }, dateNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border, marginTop: 32, paddingTop: 23 }, muted: { color: theme.muted, fontSize: 13 }, dateText: { color: theme.muted, fontSize: 13 }, formFooter: { padding: 24 }, error: { marginTop: 24, color: theme.danger, lineHeight: 21, fontSize: 13 }, retry: { padding: 16 }, link: { color: theme.accent, fontWeight: '600' },
});

const styles = { light: createStyles(themes.light), dark: createStyles(themes.dark) };
