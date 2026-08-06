import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { calculateBalances, calculateSettlements } from './src/domain/calculations';
import { Item, Participant, Party } from './src/domain/models';

const money = (value: number) => `R$ ${value.toFixed(2)}`;

type TextModalProps = {
  visible: boolean;
  title: string;
  label: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
};

function TextModal({ visible, title, label, onClose, onConfirm }: TextModalProps) {
  const [value, setValue] = useState('');
  const confirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setValue('');
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput autoFocus placeholder={label} value={value} onChangeText={setValue} style={styles.input} />
          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} secondary />
            <Button label="Save" onPress={confirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Button({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary]}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></Pressable>;
}

type PurchaseModalProps = {
  visible: boolean;
  participants: Participant[];
  items: Item[];
  onClose: () => void;
  onSave: (title: string, total: number, paidById: number, itemIds: number[]) => void;
};

function PurchaseModal({ visible, participants, items, onClose, onSave }: PurchaseModalProps) {
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [payerId, setPayerId] = useState<number | undefined>();
  const [itemIds, setItemIds] = useState<number[]>([]);
  const save = () => {
    const amount = Number(total.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0 || !payerId) {
      Alert.alert('Complete the purchase', 'Enter a title, a positive total, and select who paid.');
      return;
    }
    onSave(title.trim(), amount, payerId, itemIds);
    setTitle(''); setTotal(''); setPayerId(undefined); setItemIds([]);
  };
  const toggleItem = (id: number) => setItemIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Add purchase</Text>
          <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} />
          <TextInput placeholder="Total" keyboardType="decimal-pad" value={total} onChangeText={setTotal} style={styles.input} />
          <Text style={styles.fieldLabel}>Paid by</Text>
          <View style={styles.choiceList}>{participants.map((person) => <Pressable key={person.id} onPress={() => setPayerId(person.id)} style={[styles.choice, payerId === person.id && styles.choiceActive]}><Text>{person.name}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Items (optional)</Text>
          <View style={styles.choiceList}>{items.map((item) => <Pressable key={item.id} onPress={() => toggleItem(item.id)} style={[styles.choice, itemIds.includes(item.id) && styles.choiceActive]}><Text>{itemIds.includes(item.id) ? '✓ ' : ''}{item.name}</Text></Pressable>)}</View>
          <View style={styles.actions}><Button label="Cancel" onPress={onClose} secondary /><Button label="Save" onPress={save} /></View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function App() {
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [modal, setModal] = useState<'party' | 'participant' | 'item' | 'purchase' | null>(null);
  const party = parties.find((entry) => entry.id === partyId);
  const balances = useMemo(() => party ? calculateBalances(party) : [], [party]);
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const nextId = () => Date.now() + Math.floor(Math.random() * 1000);
  const updateParty = (updater: (current: Party) => Party) => setParties((current) => current.map((entry) => entry.id === partyId ? updater(entry) : entry));

  if (!party) return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.homeHeader}><Text style={styles.title}>Motiro</Text><Text style={styles.subtitle}>Split expenses simply.</Text></View>
      <FlatList data={parties} keyExtractor={(entry) => String(entry.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No parties yet. Create one to get started.</Text>} renderItem={({ item }) => <Pressable style={styles.card} onPress={() => setPartyId(item.id)}><Text style={styles.cardTitle}>🎉 {item.name}</Text><Text style={styles.cardMeta}>{item.participants.length} participants · {item.purchases.length} purchases</Text></Pressable>} />
      <View style={styles.bottomAction}><Button label="+ New party" onPress={() => setModal('party')} /></View>
      <TextModal visible={modal === 'party'} title="New party" label="Party name" onClose={() => setModal(null)} onConfirm={(name) => { setParties((current) => [...current, { id: nextId(), name, participants: [], items: [], purchases: [] }]); setModal(null); }} />
    </SafeAreaView>
  );

  const participantName = (id: number) => party.participants.find((person) => person.id === id)?.name ?? 'Unknown';
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.dashboard}>
        <Pressable onPress={() => setPartyId(null)}><Text style={styles.back}>‹ All parties</Text></Pressable>
        <Text style={styles.title}>🎉 {party.name}</Text>
        <Section title="Participants" count={party.participants.length} onAdd={() => setModal('participant')}><Text style={styles.empty}>{party.participants.length ? party.participants.map((person) => person.name).join('\n') : 'No participants yet.'}</Text></Section>
        <Section title="Items" count={party.items.length} onAdd={() => setModal('item')}><Text style={styles.empty}>{party.items.length ? party.items.map((item) => `${item.name}${party.purchases.some((purchase) => purchase.itemIds.includes(item.id)) ? ` · bought by ${party.purchases.filter((purchase) => purchase.itemIds.includes(item.id)).map((purchase) => participantName(purchase.paidById)).join(', ')}` : ''}`).join('\n') : 'No items yet.'}</Text></Section>
        <Section title="Purchases" count={party.purchases.length} onAdd={() => party.participants.length ? setModal('purchase') : Alert.alert('Add participants first')}><Text style={styles.empty}>{party.purchases.length ? party.purchases.map((purchase) => `${purchase.title} · ${money(purchase.total)} · paid by ${participantName(purchase.paidById)}`).join('\n') : 'No purchases yet.'}</Text></Section>
        <Section title="Balances"><Text style={styles.empty}>{balances.length ? balances.map((balance) => `${participantName(balance.participantId)}: ${money(balance.balance)}`).join('\n') : 'Add participants and purchases to calculate balances.'}</Text></Section>
        <Section title="Who pays who?"><Text style={styles.empty}>{settlements.length ? settlements.map((entry) => `${participantName(entry.fromParticipantId)} → ${participantName(entry.toParticipantId)}: ${money(entry.amount)}`).join('\n') : 'No settlements to display.'}</Text></Section>
      </ScrollView>
      <TextModal visible={modal === 'participant'} title="Add participant" label="Participant name" onClose={() => setModal(null)} onConfirm={(name) => { updateParty((current) => ({ ...current, participants: [...current.participants, { id: nextId(), name }] })); setModal(null); }} />
      <TextModal visible={modal === 'item'} title="Add item" label="Item name" onClose={() => setModal(null)} onConfirm={(name) => { updateParty((current) => ({ ...current, items: [...current.items, { id: nextId(), name }] })); setModal(null); }} />
      <PurchaseModal visible={modal === 'purchase'} participants={party.participants} items={party.items} onClose={() => setModal(null)} onSave={(title, total, paidById, itemIds) => { updateParty((current) => ({ ...current, purchases: [...current.purchases, { id: nextId(), title, total, paidById, itemIds }] })); setModal(null); }} />
    </SafeAreaView>
  );
}

function Section({ title, count, onAdd, children }: { title: string; count?: number; onAdd?: () => void; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}{count !== undefined ? ` (${count})` : ''}</Text>{onAdd && <Pressable onPress={onAdd}><Text style={styles.add}>+ Add</Text></Pressable>}</View>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' }, homeHeader: { padding: 28, paddingTop: 52 }, dashboard: { padding: 20, gap: 14, paddingBottom: 36 }, title: { fontSize: 30, fontWeight: '700', color: '#1D1B20' }, subtitle: { marginTop: 6, fontSize: 16, color: '#625B71' }, list: { padding: 20, gap: 12, flexGrow: 1 }, card: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E9E3EF' }, cardTitle: { fontSize: 18, fontWeight: '600' }, cardMeta: { color: '#625B71', marginTop: 6 }, bottomAction: { padding: 20 }, button: { backgroundColor: '#6750A4', paddingVertical: 13, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center' }, buttonText: { color: '#FFFFFF', fontWeight: '700' }, buttonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#6750A4' }, buttonTextSecondary: { color: '#6750A4' }, overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 20 }, modal: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, maxHeight: '85%' }, modalTitle: { fontSize: 23, fontWeight: '700', marginBottom: 18 }, input: { borderWidth: 1, borderColor: '#79747E', borderRadius: 8, padding: 13, fontSize: 16, marginBottom: 12 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }, back: { color: '#6750A4', fontSize: 16, fontWeight: '600' }, section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E9E3EF' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }, sectionTitle: { fontSize: 18, fontWeight: '700' }, add: { color: '#6750A4', fontWeight: '700' }, empty: { color: '#625B71', lineHeight: 23 }, fieldLabel: { fontSize: 15, fontWeight: '600', marginVertical: 6 }, choiceList: { gap: 7 }, choice: { borderWidth: 1, borderColor: '#CAC4D0', borderRadius: 8, padding: 11 }, choiceActive: { borderColor: '#6750A4', backgroundColor: '#E9DDFF' },
});
