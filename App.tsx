import { useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { categories, expenseTotal, money, parseAmount, readExpenses, thisMonth } from './expenses';
import type { Expense, Category } from './expenses';

const STORAGE_KEY = 'finance-tracker.expenses.v1';
const colors: Record<Category, string> = { Food: '#F5EADD', Transport: '#E3ECF5', Shopping: '#EEE5F3', Bills: '#F5E3DE', Other: '#E8ECE8' };

function Tracker() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [error, setError] = useState('');
  const now = new Date();
  const visible = period === 'month' ? thisMonth(expenses, now) : expenses;

  async function load() {
    setLoading(true);
    setLoadError(false);
    try { setExpenses(readExpenses(await AsyncStorage.getItem(STORAGE_KEY))); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save(next: Expense[]) {
    if (busy.current || loading || loadError) return false;
    busy.current = true;
    setSaving(true);
    try {
      expenseTotal(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setExpenses(next);
      return true;
    } catch {
      Alert.alert('Couldn’t save', 'Your expenses have not changed. Please try again.');
      return false;
    } finally { busy.current = false; setSaving(false); }
  }

  async function add() {
    const cents = parseAmount(amount);
    if (!cents) { setError('Enter an amount greater than zero, with up to 2 decimal places.'); return; }
    if (!title.trim()) { setError('Add a short description for this expense.'); return; }
    const item: Expense = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), cents, category, date: new Date().toISOString() };
    if (await save([item, ...expenses])) setOpen(false);
  }

  function remove(item: Expense) {
    Alert.alert('Delete expense?', `${item.title} · ${money(item.cents)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void save(expenses.filter((expense) => expense.id !== item.id)); } },
    ]);
  }

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View><Text style={s.eyebrow}>A LITTLE CLARITY, EVERY DAY</Text><Text accessibilityRole="header" style={s.heading}>Your expenses.</Text></View>
        <View style={s.logo}><Text style={s.logoText}>₹</Text></View>
      </View>
      {loading ? <View style={s.center}><ActivityIndicator color="#263F34" accessibilityLabel="Loading expenses" /></View> : loadError ? (
        <View style={s.center}><Text style={s.emptyTitle}>Couldn’t load your expenses</Text><Text style={s.muted}>Your saved data hasn’t been changed.</Text><Pressable style={s.retry} onPress={load}><Text style={s.link}>Try again</Text></Pressable></View>
      ) : (
        <>
          <View style={s.summary}>
            <Text style={s.summaryLabel}>{period === 'month' ? now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'All time'} spending</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={s.total}>{money(expenseTotal(visible))}</Text>
            <View style={s.summaryBottom}><View style={s.dot} /><Text style={s.summaryFoot}>{visible.length} {visible.length === 1 ? 'expense' : 'expenses'} recorded</Text></View>
          </View>
          <View style={s.sectionTop}>
            <Text style={s.sectionTitle}>Activity</Text>
            <View style={s.tabs}>{(['month', 'all'] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: period === value }} onPress={() => setPeriod(value)} style={[s.tab, period === value && s.tabActive]}><Text style={[s.tabText, period === value && s.tabTextActive]}>{value === 'month' ? 'This month' : 'All time'}</Text></Pressable>)}</View>
          </View>
          <FlatList data={visible} keyExtractor={(item) => item.id} contentContainerStyle={visible.length ? s.list : s.emptyList} showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={s.empty}><View style={s.emptyIcon}><Text style={s.emptyIconText}>↗</Text></View><Text style={s.emptyTitle}>A fresh start.</Text><Text style={s.emptyCopy}>Add your first expense and make{'\n'}room for a little more clarity.</Text></View>}
            renderItem={({ item }) => <View style={s.row}>
              <View style={[s.categoryIcon, { backgroundColor: colors[item.category] }]}><Text style={s.categoryLetter}>{item.category[0]}</Text></View>
              <View style={s.rowBody}><Text numberOfLines={1} style={s.rowTitle}>{item.title}</Text><Text style={s.rowSubtitle}>{item.category} · {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></View>
              <Text style={s.rowAmount}>{money(item.cents)}</Text>
              <Pressable disabled={saving} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} hitSlop={4} style={s.delete} onPress={() => remove(item)}><Text style={s.deleteText}>×</Text></Pressable>
            </View>}
          />
          <View style={s.footer}><Pressable disabled={saving} accessibilityRole="button" onPress={() => { setTitle(''); setAmount(''); setCategory('Food'); setError(''); setOpen(true); }} style={({ pressed }) => [s.primary, pressed && s.pressed]}><Text style={s.plus}>+</Text><Text style={s.primaryText}>Add expense</Text></Pressable><Text style={s.localNote}>Just you and your numbers. Saved on this device.</Text></View>
        </>
      )}
      <Modal visible={open} animationType="slide" onRequestClose={() => { if (!saving) setOpen(false); }}>
        <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.formHeader}><Text style={s.sectionTitle}>New expense</Text><Pressable accessibilityRole="button" accessibilityLabel="Close form" disabled={saving} onPress={() => setOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
            <Text style={s.eyebrow}>HOW MUCH DID YOU SPEND?</Text>
            <View style={s.amountEntry}><Text style={s.currency}>₹</Text><TextInput accessibilityLabel="Amount in rupees" value={amount} onChangeText={setAmount} editable={!saving} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A9485" style={s.amountInput} maxLength={11} autoFocus /></View>
            <Text style={s.label}>Description</Text><TextInput accessibilityLabel="Expense description" style={s.input} placeholder="What was it for?" placeholderTextColor="#78836F" value={title} onChangeText={setTitle} maxLength={80} editable={!saving} />
            <Text style={s.label}>Category</Text><View style={s.categoryChoices}>{categories.map((value) => <Pressable key={value} disabled={saving} accessibilityRole="radio" accessibilityState={{ checked: value === category }} onPress={() => setCategory(value)} style={[s.chip, category === value && s.chipActive]}><Text style={[s.chipText, category === value && s.chipTextActive]}>{value}</Text></Pressable>)}</View>
            <View style={s.dateNote}><Text style={s.muted}>Date</Text><Text style={s.dateText}>Today · {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></View>
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          </ScrollView>
          <View style={s.formFooter}><Pressable disabled={saving} accessibilityRole="button" onPress={add} style={({ pressed }) => [s.primary, pressed && s.pressed, saving && s.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Save expense</Text>}</Pressable></View>
        </KeyboardAvoidingView></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() { return <SafeAreaProvider><Tracker /></SafeAreaProvider>; }

const s = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#FAFBF8' },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#626E5C' }, heading: { fontSize: 32, fontWeight: '600', letterSpacing: -1.2, color: '#202B24', marginTop: 9 },
  logo: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#D8DED4', alignItems: 'center', justifyContent: 'center' }, logoText: { fontSize: 22, color: '#3D5144' },
  summary: { backgroundColor: '#E9EFDE', marginHorizontal: 24, padding: 24, borderRadius: 24 }, summaryLabel: { color: '#4F624A', fontSize: 14 },
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
