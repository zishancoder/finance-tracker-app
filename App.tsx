import { useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Directory, File } from 'expo-file-system';
import { budgetSummary, readTrackerData, localDate, parseExpenseDate, categories, expenseTotal, money, parseAmount, readExpenses, expensesForMonth, shiftMonth, exportBackup, importBackup, MAX_BACKUP_SIZE } from './expenses';
import type { TrackerData, Budgets, Expense, Category } from './expenses';

const STORAGE_KEY = 'finance-tracker.data.v2';
const LEGACY_STORAGE_KEY = 'finance-tracker.expenses.v1';
const colors: Record<Category, string> = { Food: '#F5EADD', Transport: '#E3ECF5', Shopping: '#EEE5F3', Bills: '#F5E3DE', Other: '#E8ECE8' };

function Tracker() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [month, setMonth] = useState(() => shiftMonth(new Date(), 0));
  const [open, setOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const transferBusy = useRef(false);
  const [expenseDate, setExpenseDate] = useState(() => localDate());
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [error, setError] = useState('');
  const now = new Date();
  const currentMonth = shiftMonth(now, 0);
  const isCurrentMonth = month.getTime() === currentMonth.getTime();
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const visible = period === 'month' ? expensesForMonth(expenses, month) : expenses;
  const spent = expenseTotal(visible);
  const monthKey = localDate(month).slice(0, 7);
  const budget = budgets[monthKey];
  const usage = budget ? budgetSummary(spent, budget) : null;

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      let data: TrackerData;
      if (stored === null) {
        const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        data = { expenses: readExpenses(legacy), budgets: {} };
      } else {
        data = readTrackerData(stored);
      }
      setExpenses(data.expenses);
      setBudgets(data.budgets);
    }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save(next: Expense[], nextBudgets: Budgets = budgets) {
    if (busy.current || loading || loadError) return false;
    busy.current = true;
    setSaving(true);
    try {
      expenseTotal(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses: next, budgets: nextBudgets }));
      setExpenses(next);
      setBudgets(nextBudgets);
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
    const item: Expense = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), cents, category, date: date.toISOString() };
    if (await save([item, ...expenses])) {
      setMonth(shiftMonth(date, 0));
      setPeriod('month');
      setOpen(false);
    }
  }

  function remove(item: Expense) {
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
    if (await save(expenses, next)) setBudgetOpen(false);
  }

  async function transfer(action: 'export' | 'import') {
    if (transferBusy.current || busy.current) return;
    transferBusy.current = true;
    setTransferring(true);
    let output: File | undefined;
    try {
      if (action === 'export') {
        const data = exportBackup(expenses, budgets);
        const directory = await Directory.pickDirectoryAsync();
        output = directory.createFile(`finance-tracker-${Date.now()}.json`, 'application/json');
        await output.write(data);
        output = undefined;
        Alert.alert('Backup saved', `All ${expenses.length} expenses and ${Object.keys(budgets).length} monthly budgets were exported to the folder you selected.`);
      } else {
        const picked = await File.pickFileAsync(undefined, 'application/json');
        const file = Array.isArray(picked) ? picked[0] : picked;
        if (!file || file.size === null || file.size > MAX_BACKUP_SIZE) throw new Error('Choose a JSON backup up to 5 MB.');
        const next = importBackup(await file.text(), expenses, budgets);
        const added = next.expenses.length - expenses.length;
        const addedBudgets = Object.keys(next.budgets).length - Object.keys(budgets).length;
        if (added === 0 && addedBudgets === 0) { Alert.alert('Already up to date', 'No new expenses or monthly budgets were found in this backup.'); return; }
        const confirmed = await new Promise<boolean>((resolve) => Alert.alert(
          'Import backup?',
          `Add ${added} expenses and ${addedBudgets} monthly budgets? Existing expenses and budget amounts will be kept, and duplicates will be skipped.`,
          [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Import', onPress: () => resolve(true) }],
          { cancelable: true, onDismiss: () => resolve(false) },
        ));
        if (confirmed && await save(next.expenses, next.budgets)) {
          setPeriod('all');
          Alert.alert('Import complete', `${added} expenses and ${addedBudgets} monthly budgets were added.`);
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

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View><Text style={s.eyebrow}>A LITTLE CLARITY, EVERY DAY</Text><Text accessibilityRole="header" style={s.heading}>Your expenses.</Text></View>
        <Image source={require('./assets/finance-logo.png')} accessibilityLabel="Finance Tracker logo" style={s.logo} />
      </View>
      {loading ? <View style={s.center}><ActivityIndicator color="#263F34" accessibilityLabel="Loading expenses" /></View> : loadError ? (
        <View style={s.center}><Text style={s.emptyTitle}>Couldn’t load your expenses</Text><Text style={s.muted}>Your saved data hasn’t been changed.</Text><Pressable style={s.retry} onPress={load}><Text style={s.link}>Try again</Text></Pressable></View>
      ) : (
        <>
          <View style={s.summary}>
            {period === 'month' ? <View style={s.monthNavigation}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((value) => shiftMonth(value, -1))} style={s.monthArrow}><Text style={s.monthArrowText}>‹</Text></Pressable>
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.monthLabel}>{monthLabel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: month >= currentMonth }} disabled={month >= currentMonth} onPress={() => setMonth((value) => shiftMonth(value, 1))} style={[s.monthArrow, month >= currentMonth && s.disabled]}><Text style={s.monthArrowText}>›</Text></Pressable>
            </View> : <Text style={s.summaryLabel}>All time spending</Text>}
            {period === 'month' && <Text style={s.spentLabel}>Spent this month</Text>}
            <Text adjustsFontSizeToFit numberOfLines={1} style={s.total}>{money(spent)}</Text>
            <View style={s.summaryBottom}><View style={s.dot} /><Text style={s.summaryFoot}>{visible.length} {visible.length === 1 ? 'expense' : 'expenses'} recorded</Text></View>
            {period === 'month' && <View style={s.budgetSection}>
              <Pressable disabled={saving || transferring} accessibilityRole="button" accessibilityLabel={budget ? 'Edit monthly budget' : 'Set monthly budget'} onPress={() => { setBudgetAmount(budget ? (budget / 100).toFixed(2) : ''); setBudgetError(''); setBudgetOpen(true); }} style={s.budgetButton}><Text style={s.budgetLabel}>{budget ? `Budget ${money(budget)}` : 'Set monthly budget'}</Text><Text style={s.budgetEdit}>{budget ? 'Edit' : '+'}</Text></Pressable>
              {usage && <><View accessibilityRole="progressbar" accessibilityLabel="Monthly budget usage" accessibilityValue={{ min: 0, max: 100, now: Math.min(usage.percent, 100), text: `${usage.percent}% used` }} style={s.progressTrack}><View style={[s.progressFill, { width: `${usage.progress * 100}%`, backgroundColor: usage.remaining < 0 ? '#A13D32' : '#476740' }]} /></View><View style={s.budgetStats}><Text style={s.budgetStat}>{usage.percent}% used</Text><Text style={[s.budgetRemaining, usage.remaining < 0 && s.overBudget]}>{usage.remaining < 0 ? `${money(-usage.remaining)} over budget` : `${money(usage.remaining)} left`}</Text></View></>}
            </View>}
            {period === 'month' && !isCurrentMonth && <Pressable accessibilityRole="button" onPress={() => setMonth(currentMonth)} style={s.currentMonthButton}><Text style={s.currentMonthText}>Back to this month</Text></Pressable>}
          </View>
          <View style={s.sectionTop}>
            <Text style={s.sectionTitle}>Activity</Text>
            <View style={s.tabs}>{(['month', 'all'] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: period === value }} onPress={() => setPeriod(value)} style={[s.tab, period === value && s.tabActive]}><Text style={[s.tabText, period === value && s.tabTextActive]}>{value === 'month' ? 'Monthly' : 'All time'}</Text></Pressable>)}</View>
          </View>
          <FlatList data={visible} keyExtractor={(item) => item.id} contentContainerStyle={visible.length ? s.list : s.emptyList} showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={s.empty}><View style={s.emptyIcon}><Text style={s.emptyIconText}>↗</Text></View><Text style={s.emptyTitle}>{period === 'month' ? 'No expenses this month.' : 'A fresh start.'}</Text><Text style={s.emptyCopy}>{period === 'month' && !isCurrentMonth ? `Nothing recorded for ${monthLabel}.` : 'Add an expense to start tracking your spending.'}</Text></View>}
            renderItem={({ item }) => <View style={s.row}>
              <View style={[s.categoryIcon, { backgroundColor: colors[item.category] }]}><Text style={s.categoryLetter}>{item.category[0]}</Text></View>
              <View style={s.rowBody}><Text numberOfLines={1} style={s.rowTitle}>{item.title}</Text><Text style={s.rowSubtitle}>{item.category} · {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></View>
              <Text style={s.rowAmount}>{money(item.cents)}</Text>
              <Pressable disabled={saving} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} hitSlop={4} style={s.delete} onPress={() => remove(item)}><Text style={s.deleteText}>×</Text></Pressable>
            </View>}
          />
          <View style={s.footer}><Pressable disabled={saving || transferring} accessibilityRole="button" onPress={() => { setTitle(''); setAmount(''); setCategory('Food'); setExpenseDate(localDate()); setError(''); setOpen(true); }} style={({ pressed }) => [s.primary, pressed && s.pressed]}><Text style={s.plus}>+</Text><Text style={s.primaryText}>Add expense</Text></Pressable><Pressable accessibilityRole="button" disabled={saving || transferring} onPress={() => setBackupOpen(true)} style={s.backupLink}><Text style={s.link}>Data & backup</Text></Pressable></View>
        </>
      )}
      <Modal visible={budgetOpen} animationType="slide" onRequestClose={() => { if (!saving) setBudgetOpen(false); }}>
        <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.formHeader}><Text style={s.sectionTitle}>Monthly budget</Text><Pressable accessibilityRole="button" accessibilityLabel="Close budget form" disabled={saving} onPress={() => setBudgetOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
            <Text style={s.emptyTitle}>{monthLabel}</Text><Text style={s.backupCopy}>Choose how much you plan to spend. This budget applies only to this month.</Text>
            <Text style={s.label}>Budget in rupees</Text><TextInput accessibilityLabel="Monthly budget amount" value={budgetAmount} onChangeText={setBudgetAmount} editable={!saving} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#78836F" style={s.amountInput} maxLength={11} autoFocus />
            <Text style={s.backupCopy}>Already spent: {money(spent)}</Text>
            {!!budget && <Pressable accessibilityRole="button" disabled={saving} onPress={() => saveBudget(true)} style={s.backupLink}><Text style={s.overBudget}>Remove this month’s budget</Text></Pressable>}
          </ScrollView>
          <View style={s.formFooter}>{!!budgetError && <Text accessibilityRole="alert" style={[s.error, { marginTop: 0, marginBottom: 12 }]}>{budgetError}</Text>}<Pressable accessibilityRole="button" disabled={saving} onPress={() => saveBudget()} style={s.primary}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Save budget</Text>}</Pressable></View>
        </KeyboardAvoidingView></SafeAreaView>
      </Modal>
      <Modal visible={backupOpen} animationType="slide" onRequestClose={() => { if (!transferring) setBackupOpen(false); }}>
        <SafeAreaView style={s.screen}>
          <View style={s.formHeader}><Text style={s.sectionTitle}>Data & backup</Text><Pressable accessibilityRole="button" accessibilityLabel="Close backup screen" disabled={transferring} onPress={() => setBackupOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView contentContainerStyle={s.form}>
            <Text style={s.emptyTitle}>Your data, to keep.</Text>
            <Text style={s.backupCopy}>Back up your expenses and monthly budgets as a JSON file, or restore a backup from another device.</Text>
            <View style={s.backupCard}><Text style={s.sectionTitle}>Export backup</Text><Text style={s.backupCopy}>Save all {expenses.length} expenses and {Object.keys(budgets).length} monthly budgets. Choose a folder to keep your backup.</Text><Pressable accessibilityRole="button" disabled={transferring} onPress={() => transfer('export')} style={[s.primary, transferring && s.disabled]}><Text style={s.primaryText}>Export JSON</Text></Pressable></View>
            <View style={s.backupCard}><Text style={s.sectionTitle}>Import backup</Text><Text style={s.backupCopy}>Choose a Finance Tracker JSON file (up to 5 MB). Old expense-only backups also work. New expenses and budgets for new months are added; existing budget amounts are kept.</Text><Pressable accessibilityRole="button" disabled={transferring} onPress={() => transfer('import')} style={[s.primary, transferring && s.disabled]}><Text style={s.primaryText}>Import JSON</Text></Pressable></View>
            {transferring && <ActivityIndicator color="#263F34" accessibilityLabel="Working with backup" />}
            <Text style={s.backupCopy}>Backup files contain your expense details in plain text. Keep them somewhere private. Your data stays on this device unless you export it.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={open} animationType="slide" onRequestClose={() => { if (!saving) setOpen(false); }}>
        <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.formHeader}><Text style={s.sectionTitle}>New expense</Text><Pressable accessibilityRole="button" accessibilityLabel="Close form" disabled={saving} onPress={() => setOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
            <Text style={s.eyebrow}>HOW MUCH DID YOU SPEND?</Text>
            <View style={s.amountEntry}><Text style={s.currency}>₹</Text><TextInput accessibilityLabel="Amount in rupees" value={amount} onChangeText={setAmount} editable={!saving} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A9485" style={s.amountInput} maxLength={11} autoFocus /></View>
            <Text style={s.label}>Description</Text><TextInput accessibilityLabel="Expense description" style={s.input} placeholder="What was it for?" placeholderTextColor="#78836F" value={title} onChangeText={setTitle} maxLength={80} editable={!saving} />
            <Text style={s.label}>Category</Text><View style={s.categoryChoices}>{categories.map((value) => <Pressable key={value} disabled={saving} accessibilityRole="radio" accessibilityState={{ checked: value === category }} onPress={() => setCategory(value)} style={[s.chip, category === value && s.chipActive]}><Text style={[s.chipText, category === value && s.chipTextActive]}>{value}</Text></Pressable>)}</View>
            <Text style={[s.label, { marginTop: 28 }]}>Date · YYYY-MM-DD</Text><TextInput accessibilityLabel="Expense date" placeholder="YYYY-MM-DD" placeholderTextColor="#78836F" value={expenseDate} onChangeText={setExpenseDate} editable={!saving} style={s.input} maxLength={10} autoCorrect={false} autoCapitalize="none" />
          </ScrollView>
          <View style={s.formFooter}>{!!error && <Text accessibilityRole="alert" style={[s.error, { marginTop: 0, marginBottom: 12 }]}>{error}</Text>}<Pressable disabled={saving} accessibilityRole="button" onPress={add} style={({ pressed }) => [s.primary, pressed && s.pressed, saving && s.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Save expense</Text>}</Pressable></View>
        </KeyboardAvoidingView></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() { return <SafeAreaProvider><Tracker /></SafeAreaProvider>; }

const s = StyleSheet.create({
  spentLabel: { color: '#4F624A', fontSize: 12, marginTop: 12 }, budgetSection: { borderTopWidth: 1, borderTopColor: '#CDD8C0', marginTop: 16, paddingTop: 4 }, budgetButton: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, budgetLabel: { flex: 1, fontSize: 13, color: '#3A5433', fontWeight: '500' }, budgetEdit: { color: '#3A5433', fontWeight: '600', fontSize: 13 }, progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#CDD8C0', overflow: 'hidden', marginTop: 3 }, progressFill: { height: 6, borderRadius: 3 }, budgetStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 11 }, budgetStat: { fontSize: 12, color: '#52654A' }, budgetRemaining: { fontSize: 13, color: '#30492B', fontWeight: '600' }, overBudget: { color: '#A13D32', fontWeight: '600' },
  backupLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, backupCopy: { color: '#66765C', fontSize: 14, lineHeight: 22, marginVertical: 14 }, backupCard: { borderWidth: 1, borderColor: '#DDE3D6', borderRadius: 20, padding: 20, marginVertical: 10 },
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#FAFBF8' },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#626E5C' }, heading: { fontSize: 32, fontWeight: '600', letterSpacing: -1.2, color: '#202B24', marginTop: 9 },
  logo: { width: 44, height: 44, borderRadius: 14 },
  summary: { backgroundColor: '#E9EFDE', marginHorizontal: 24, padding: 24, borderRadius: 24 }, summaryLabel: { color: '#4F624A', fontSize: 14 },
  monthNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -8, marginHorizontal: -8 }, monthLabel: { flex: 1, textAlign: 'center', color: '#4F624A', fontSize: 15, fontWeight: '500' }, monthArrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#DDE7CE' }, monthArrowText: { color: '#334E2D', fontSize: 29, lineHeight: 32 }, currentMonthButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8 }, currentMonthText: { color: '#38562E', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  total: { color: '#253C2A', fontSize: 44, fontWeight: '600', letterSpacing: -1.8, marginTop: 14, marginBottom: 25 },
  summaryBottom: { flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#708760' }, summaryFoot: { color: '#54664F', fontSize: 12 },
  sectionTop: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }, sectionTitle: { fontSize: 19, fontWeight: '600', color: '#202B24' },
  tabs: { flexDirection: 'row', backgroundColor: '#EFF1EC', borderRadius: 20, padding: 3 }, tab: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 18 }, tabActive: { backgroundColor: '#FFFFFF' }, tabText: { fontSize: 12, color: '#626C5D' }, tabTextActive: { color: '#273F2E', fontWeight: '600' },
  list: { paddingHorizontal: 24, paddingBottom: 12 }, emptyList: { flexGrow: 1 }, row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#EAEDE5', gap: 10 },
  categoryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, categoryLetter: { fontSize: 16, fontWeight: '600', color: '#4D594E' }, rowBody: { flex: 1 }, rowTitle: { fontSize: 15, fontWeight: '500', color: '#26322A' }, rowSubtitle: { fontSize: 11, color: '#687461', marginTop: 5 }, rowAmount: { fontSize: 14, fontWeight: '600', color: '#29362E', flexShrink: 1 }, delete: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, deleteText: { fontSize: 23, color: '#697560' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }, emptyIcon: { width: 62, height: 62, backgroundColor: '#F0F3EB', borderRadius: 31, justifyContent: 'center', alignItems: 'center', marginBottom: 19 }, emptyIconText: { fontSize: 27, color: '#6A7D5C' }, emptyTitle: { fontSize: 20, fontWeight: '500', color: '#3E4C3F' }, emptyCopy: { color: '#68755F', fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }, primary: { backgroundColor: '#263F34', borderRadius: 18, minHeight: 58, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }, plus: { color: '#FFFFFF', fontSize: 25, lineHeight: 26, fontWeight: '300' }, pressed: { opacity: 0.8 }, disabled: { opacity: 0.6 }, localNote: { textAlign: 'center', color: '#697560', fontSize: 10, marginTop: 15 },
  formHeader: { paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1E9', borderRadius: 22 }, closeText: { fontSize: 27, color: '#52614F' }, form: { paddingHorizontal: 28, paddingTop: 44, paddingBottom: 28 }, amountEntry: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 36 }, currency: { fontSize: 38, color: '#74816C', marginRight: 10 }, amountInput: { flex: 1, color: '#263F34', fontSize: 48, fontWeight: '500', paddingVertical: 8 }, label: { fontSize: 13, fontWeight: '600', color: '#485544', marginBottom: 12 }, input: { backgroundColor: '#F0F3EB', borderRadius: 14, paddingHorizontal: 17, paddingVertical: 17, fontSize: 16, color: '#263F34', marginBottom: 30 }, categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { borderWidth: 1, borderColor: '#DDE3D6', borderRadius: 24, minHeight: 44, paddingHorizontal: 17, justifyContent: 'center' }, chipActive: { backgroundColor: '#E4ECD8', borderColor: '#9DAF8F' }, chipText: { color: '#606F57', fontSize: 13 }, chipTextActive: { color: '#2F492D', fontWeight: '600' }, dateNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E4E9DD', marginTop: 32, paddingTop: 23 }, muted: { color: '#66765C', fontSize: 13 }, dateText: { color: '#4D5C46', fontSize: 13 }, formFooter: { padding: 24 }, error: { marginTop: 24, color: '#A13D32', lineHeight: 21, fontSize: 13 }, retry: { padding: 16 }, link: { color: '#263F34', fontWeight: '600' },
});
