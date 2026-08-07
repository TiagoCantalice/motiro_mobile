import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { calculateBalances, calculateSettlements } from './src/domain/calculations';
import { Balance, Item, Participant, Party, Purchase, Settlement } from './src/domain/models';

const money = (value: number) => `R$ ${value.toFixed(2)}`;
const fileName = (uri?: string) => uri?.split('/').pop() ?? 'Receipt attached';

function DisclosureArrow({ open }: { open: boolean }) {
  return <View style={styles.arrowCircle}><Text style={styles.arrow}>{open ? '▲' : '▼'}</Text></View>;
}

function Button({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary]}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></Pressable>;
}

function TextModal({ visible, title, label, initialValue = '', onClose, onConfirm }: { visible: boolean; title: string; label: string; initialValue?: string; onClose: () => void; onConfirm: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (visible) setValue(initialValue); }, [visible, initialValue]);
  const confirm = () => { const trimmed = value.trim(); if (trimmed) { onConfirm(trimmed); setValue(''); } };
  return <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>{title}</Text><TextInput autoFocus placeholder={label} value={value} onChangeText={setValue} style={styles.input} /><View style={styles.actions}><Button label="Cancel" onPress={onClose} secondary /><Button label="Save" onPress={confirm} /></View></View></View></Modal>;
}

function ParticipantModal({ visible, existing, onClose, onSave }: { visible: boolean; existing?: Participant; onClose: () => void; onSave: (name: string, pixKey?: string) => void }) {
  const [name, setName] = useState('');
  const [pixKey, setPixKey] = useState('');
  useEffect(() => { if (visible) { setName(existing?.name ?? ''); setPixKey(existing?.pixKey ?? ''); } }, [visible, existing]);
  return <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>{existing ? 'Edit participant' : 'Add participant'}</Text><TextInput autoFocus placeholder="Participant name" value={name} onChangeText={setName} style={styles.input} /><TextInput placeholder="PIX key (optional)" value={pixKey} onChangeText={setPixKey} style={styles.input} /><View style={styles.actions}><Button label="Cancel" onPress={onClose} secondary /><Button label="Save" onPress={() => { if (name.trim()) onSave(name.trim(), pixKey.trim() || undefined); }} /></View></View></View></Modal>;
}

function Dropdown({ label, value, open, onToggle, children }: { label: string; value: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <View><Text style={styles.fieldLabel}>{label}</Text><Pressable style={styles.dropdown} onPress={onToggle}><Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>{value || `Select ${label.toLowerCase()}`}</Text><DisclosureArrow open={open} /></Pressable>{open && <View style={styles.dropdownMenu}>{children}</View>}</View>;
}

type PurchaseModalProps = {
  visible: boolean;
  participants: Participant[];
  items: Item[];
  previousPurchases: Purchase[];
  existing?: Purchase;
  onClose: () => void;
  onAddItem: (name: string) => number;
  onSave: (title: string, total: number, paidById: number, itemIds: number[], receiptUri?: string, itemQuantities?: Record<number, number>) => void;
};

function PurchaseModal({ visible, participants, items, previousPurchases, existing, onClose, onAddItem, onSave }: PurchaseModalProps) {
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [payerId, setPayerId] = useState<number | undefined>();
  const [itemIds, setItemIds] = useState<number[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [newItem, setNewItem] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [payerOpen, setPayerOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [templateId, setTemplateId] = useState<number | undefined>();
  const [templateOpen, setTemplateOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(existing?.title ?? ''); setTotal(existing ? String(existing.total) : '');
    setPayerId(existing?.paidById ?? participants[0]?.id); setItemIds(existing?.itemIds ?? []); setItemQuantities(existing?.itemQuantities ?? {});
    setReceiptUri(existing?.receiptUri); setNewItem(''); setPayerOpen(false); setItemsOpen(false); setTemplateId(undefined); setTemplateOpen(false);
  }, [visible, existing, participants]);

  const save = () => {
    const amount = Number(total.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0 || !payerId) {
      Alert.alert('Complete the purchase', 'Enter a title, a positive total, and select who paid.'); return;
    }
    onSave(title.trim(), amount, payerId, itemIds, receiptUri, itemQuantities);
  };
  const toggleItem = (id: number) => setItemIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  const addItem = () => { const name = newItem.trim(); if (!name) return; const id = onAddItem(name); setItemIds((current) => [...current, id]); setNewItem(''); };
  const chooseReceipt = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission needed', `Allow access to ${camera ? 'the camera' : 'your photos'} to attach a receipt.`); return; }
    const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setReceiptUri(result.assets[0].uri);
  };
  const payerName = participants.find((person) => person.id === payerId)?.name ?? '';
  const selectedItemNames = items.filter((item) => itemIds.includes(item.id)).map((item) => item.name).join(', ');
  const applyTemplate = (id: number) => { const template = previousPurchases.find((purchase) => purchase.id === id); if (!template) return; setTemplateId(id); setTitle(template.title); setTotal(String(template.total)); setPayerId(template.paidById); setItemIds(template.itemIds); setItemQuantities(template.itemQuantities ?? {}); setReceiptUri(template.receiptUri); };

  return <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}><View style={styles.overlay}><ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled"><Text style={styles.modalTitle}>{existing ? 'Edit purchase' : 'Add purchase'}</Text>{!existing && previousPurchases.length > 0 && <Dropdown label="Copy previous event" value={previousPurchases.find((purchase) => purchase.id === templateId)?.title ?? ''} open={templateOpen} onToggle={() => { setTemplateOpen(!templateOpen); setPayerOpen(false); setItemsOpen(false); }}>{previousPurchases.map((purchase) => <Pressable key={purchase.id} onPress={() => { applyTemplate(purchase.id); setTemplateOpen(false); }} style={styles.menuOption}><Text>{purchase.title}</Text></Pressable>)}</Dropdown>}<TextInput placeholder="Purchase name" value={title} onChangeText={setTitle} style={styles.input} /><TextInput placeholder="Total" keyboardType="decimal-pad" value={total} onChangeText={setTotal} style={styles.input} />
    <Dropdown label="Paid by" value={payerName} open={payerOpen} onToggle={() => { setPayerOpen(!payerOpen); setItemsOpen(false); }}>{participants.map((person) => <Pressable key={person.id} onPress={() => { setPayerId(person.id); setPayerOpen(false); }} style={[styles.menuOption, payerId === person.id && styles.choiceActive]}><Text>{person.name}</Text></Pressable>)}</Dropdown>
    <Dropdown label={`Items (${itemIds.length})`} value={selectedItemNames} open={itemsOpen} onToggle={() => { setItemsOpen(!itemsOpen); setPayerOpen(false); setTemplateOpen(false); }}><ScrollView style={styles.dropdownScroll} nestedScrollEnabled>{items.length ? items.map((item) => <Pressable key={item.id} onPress={() => toggleItem(item.id)} style={[styles.menuOption, itemIds.includes(item.id) && styles.choiceActive]}><View style={styles.itemOption}><Text style={styles.itemOptionName}>{itemIds.includes(item.id) ? '✓ ' : ''}{item.name}</Text>{itemIds.includes(item.id) && <TextInput keyboardType="number-pad" placeholder="Qty" value={String(itemQuantities[item.id] ?? 1)} onChangeText={(value) => setItemQuantities((current) => ({ ...current, [item.id]: Number(value) || 1 }))} style={styles.quantityInput} />}</View></Pressable>) : <Text style={styles.empty}>No items yet.</Text>}</ScrollView><View style={styles.newItemRow}><TextInput placeholder="New item" value={newItem} onChangeText={setNewItem} style={[styles.input, styles.newItemInput]} /><Button label="Add" onPress={addItem} /></View></Dropdown>
    <Text style={styles.fieldLabel}>Receipt</Text><View style={styles.actions}><Button label="Choose photo" onPress={() => chooseReceipt(false)} secondary /><Button label="Take photo" onPress={() => chooseReceipt(true)} secondary /></View>{receiptUri && <Text style={styles.receiptName}>Attached: {fileName(receiptUri)}</Text>}
    <View style={styles.actions}><Button label="Cancel" onPress={onClose} secondary /><Button label={existing ? 'Save changes' : 'Save'} onPress={save} /></View>
  </ScrollView></View></Modal>;
}

function Section({ title, count, onAdd, children }: { title: string; count?: number; onAdd?: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.section}><View style={styles.sectionHeader}><Pressable onPress={() => setOpen((current) => !current)} style={styles.sectionToggle}><Text style={styles.sectionTitle}>{title}{count !== undefined ? ` (${count})` : ''}</Text><View style={styles.arrowCircle}><Text style={styles.arrow}>{open ? '▲' : '▼'}</Text></View></Pressable>{onAdd && <Pressable onPress={onAdd} style={styles.headerAction}><Text style={styles.add}>+ Add</Text></Pressable>}</View>{open && <View style={styles.sectionBody}>{children}</View>}</View>;
}

function PurchaseTimeline({ purchase, payerName, itemNames, onEdit, onRemove }: { purchase: Purchase; payerName: string; itemNames: string[]; onEdit: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.timelineRow}><View style={styles.timelineDot} /><View style={styles.timelineCard}><View style={styles.timelineHeader}><Pressable onPress={() => setOpen((current) => !current)} style={styles.timelineTitle}><Text style={styles.purchaseTitle}>{purchase.title}</Text><Text style={styles.purchaseMeta}>{money(purchase.total)} · {payerName}</Text></Pressable><View style={styles.rowActions}><Pressable onPress={onEdit} accessibilityLabel="Edit purchase"><Text style={styles.iconAction}>✎</Text></Pressable><Pressable onPress={onRemove} accessibilityLabel="Remove purchase"><Text style={styles.trashAction}>🗑</Text></Pressable><Pressable onPress={() => setOpen((current) => !current)}><DisclosureArrow open={open} /></Pressable></View></View>{open && <View style={styles.timelineDetails}><Text style={styles.detailLabel}>Items</Text><Text style={styles.empty}>{itemNames.length ? itemNames.join(' · ') : 'No items linked.'}</Text>{purchase.receiptUri && <Text style={styles.receiptName}>Receipt: {fileName(purchase.receiptUri)}</Text>}</View>}</View></View>;
}

export default function App() {
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [modal, setModal] = useState<'party' | 'participant' | 'item' | 'purchase' | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<Participant | undefined>();
  const [editingItem, setEditingItem] = useState<Item | undefined>();
  const [editingPurchase, setEditingPurchase] = useState<Purchase | undefined>();
  const [calculatedPartyId, setCalculatedPartyId] = useState<number | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const party = parties.find((entry) => entry.id === partyId);
  const nextId = () => Date.now() + Math.floor(Math.random() * 1000);
  const updateParty = (updater: (current: Party) => Party) => setParties((current) => current.map((entry) => entry.id === partyId ? updater(entry) : entry));
  const openNewText = (kind: 'participant' | 'item') => { setEditingParticipant(undefined); setEditingItem(undefined); setModal(kind); };
  const confirmDelete = (label: string, onDelete: () => void) => Alert.alert(`Remove ${label}?`, 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onDelete }]);

  if (!party) return <SafeAreaView style={styles.screen}><StatusBar style="dark" /><View style={styles.homeHeader}><Text style={styles.title}>Motiro</Text><Text style={styles.subtitle}>Split expenses simply.</Text></View><FlatList data={parties} keyExtractor={(entry) => String(entry.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No parties yet. Create one to get started.</Text>} renderItem={({ item }) => <Pressable style={styles.card} onPress={() => setPartyId(item.id)}><Text style={styles.cardTitle}>🎉 {item.name}</Text><Text style={styles.cardMeta}>{item.participants.length} participants · {item.purchases.length} purchases</Text></Pressable>} /><View style={styles.bottomAction}><Button label="+ New party" onPress={() => setModal('party')} /></View><TextModal visible={modal === 'party'} title="New party" label="Party name" onClose={() => setModal(null)} onConfirm={(name) => { setParties((current) => [...current, { id: nextId(), name, participants: [], items: [], purchases: [] }]); setModal(null); }} /></SafeAreaView>;

  const participantName = (id: number) => party.participants.find((person) => person.id === id)?.name ?? 'Unknown';
  const totalPurchases = party.purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const calculated = calculatedPartyId === party.id;
  const calculateParty = () => { const nextBalances = calculateBalances(party); setBalances(nextBalances); setSettlements(calculateSettlements(nextBalances)); setCalculatedPartyId(party.id); };
  const settlementMessage = settlements.map((entry) => `${participantName(entry.fromParticipantId)} → ${participantName(entry.toParticipantId)}: ${money(entry.amount)}`).join('\n');
  const shareSettlements = () => Share.share({ title: `Motiro · ${party.name}`, message: settlementMessage || 'No settlements to display.' });
  const removeParticipant = (id: number) => updateParty((current) => ({ ...current, participants: current.participants.filter((person) => person.id !== id) }));
  const removeItem = (id: number) => updateParty((current) => ({ ...current, items: current.items.filter((item) => item.id !== id), purchases: current.purchases.map((purchase) => ({ ...purchase, itemIds: purchase.itemIds.filter((itemId) => itemId !== id) })) }));
  const removePurchase = (id: number) => updateParty((current) => ({ ...current, purchases: current.purchases.filter((purchase) => purchase.id !== id) }));

  return <SafeAreaView style={styles.screen}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.dashboard} nestedScrollEnabled><Pressable onPress={() => setPartyId(null)}><Text style={styles.back}>‹ All parties</Text></Pressable><Text style={styles.title}>🎉 {party.name}</Text>
    <Section title="Participants" count={party.participants.length} onAdd={() => openNewText('participant')}><ScrollView style={party.participants.length > 5 ? styles.entityScroll : undefined} nestedScrollEnabled><View style={styles.rowList}>{party.participants.length ? party.participants.map((person) => <View key={person.id} style={styles.entityRow}><View style={styles.entityTextBlock}><Text style={styles.entityName}>{person.name}</Text>{person.pixKey && <Text style={styles.itemStatus}>PIX: {person.pixKey}</Text>}</View><View style={styles.rowActions}><Pressable onPress={() => { setEditingParticipant(person); setModal('participant'); }} accessibilityLabel="Edit participant"><Text style={styles.iconAction}>✎</Text></Pressable><Pressable onPress={() => confirmDelete('participant', () => removeParticipant(person.id))} accessibilityLabel="Remove participant"><Text style={styles.trashAction}>🗑</Text></Pressable></View></View>) : <Text style={styles.empty}>No participants yet.</Text>}</View></ScrollView></Section>
    <Section title="Items" count={party.items.length} onAdd={() => openNewText('item')}><ScrollView style={party.items.length > 5 ? styles.entityScroll : undefined} nestedScrollEnabled><View style={styles.rowList}>{party.items.length ? party.items.map((item) => { const buyers = party.purchases.filter((purchase) => purchase.itemIds.includes(item.id)).map((purchase) => participantName(purchase.paidById)); return <View key={item.id} style={styles.entityRow}><Text style={styles.entityName}>{buyers.length ? `🏷️ ${item.name}` : item.name}<Text style={styles.itemStatus}>{buyers.length ? `  Bought by ${buyers.join(', ')}` : '  Not bought'}</Text></Text><View style={styles.rowActions}><Pressable onPress={() => { setEditingItem(item); setModal('item'); }} accessibilityLabel="Edit item"><Text style={styles.iconAction}>✎</Text></Pressable><Pressable onPress={() => confirmDelete('item', () => removeItem(item.id))} accessibilityLabel="Remove item"><Text style={styles.trashAction}>🗑</Text></Pressable></View></View>; }) : <Text style={styles.empty}>No items yet.</Text>}</View></ScrollView></Section>
    <Section title="Purchases" count={party.purchases.length} onAdd={() => party.participants.length ? setModal('purchase') : Alert.alert('Add participants first')}><View style={styles.timeline}>{party.purchases.length ? party.purchases.map((purchase) => <PurchaseTimeline key={purchase.id} purchase={purchase} payerName={participantName(purchase.paidById)} itemNames={purchase.itemIds.map((id) => { const item = party.items.find((entry) => entry.id === id); const quantity = purchase.itemQuantities?.[id] ?? 1; return item ? `${item.name}${quantity > 1 ? ` x${quantity}` : ''}` : undefined; }).filter((name): name is string => Boolean(name))} onEdit={() => setEditingPurchase(purchase)} onRemove={() => confirmDelete('purchase', () => removePurchase(purchase.id))} />) : <Text style={styles.empty}>No purchases yet.</Text>}</View></Section>
    <Button label="Calculate balances" onPress={calculateParty} />
    <Section title="Balances"><Text style={styles.totalLabel}>Total purchases</Text><Text style={styles.totalValue}>{money(totalPurchases)}</Text>{calculated ? <View style={styles.rowList}>{balances.slice().sort((left, right) => right.paid - left.paid).map((balance) => <View key={balance.participantId} style={styles.balanceRow}><Text style={styles.entityName}>{participantName(balance.participantId)}</Text><Text style={styles.balanceText}>Bought {money(balance.paid)}</Text></View>)}</View> : <Text style={styles.empty}>Tap Calculate balances after adding purchases.</Text>}</Section>
    <Section title="Who pays who?"><View style={styles.settlementTitleRow}><Text style={styles.empty}>{calculated ? 'Share these settlements' : 'Calculate balances to see settlements.'}</Text>{calculated && <Pressable onPress={shareSettlements} accessibilityLabel="Share settlements"><Text style={styles.shareAction}>↗</Text></Pressable>}</View>{calculated && settlements.length ? <View style={styles.settlementList}>{settlements.map((entry) => { const from = party.participants.find((person) => person.id === entry.fromParticipantId); const to = party.participants.find((person) => person.id === entry.toParticipantId); return <View key={`${entry.fromParticipantId}-${entry.toParticipantId}`} style={styles.settlementBox}><Text style={styles.settlementPhrase}>→  {from?.name} pays {to?.name}: {money(entry.amount)}</Text><Text style={styles.pixLine}>PIX: {to?.pixKey || 'not registered'}</Text></View>; })}</View> : calculated ? <Text style={styles.empty}>No settlements to display.</Text> : null}</Section>
  </ScrollView>
  <ParticipantModal visible={modal === 'participant'} existing={editingParticipant} onClose={() => setModal(null)} onSave={(name, pixKey) => { if (editingParticipant) updateParty((current) => ({ ...current, participants: current.participants.map((person) => person.id === editingParticipant.id ? { ...person, name, pixKey } : person) })); else updateParty((current) => ({ ...current, participants: [...current.participants, { id: nextId(), name, pixKey }] })); setEditingParticipant(undefined); setModal(null); }} />
  <TextModal visible={modal === 'item'} title={editingItem ? 'Edit item' : 'Add item'} label="Item name" initialValue={editingItem?.name} onClose={() => setModal(null)} onConfirm={(name) => { if (editingItem) updateParty((current) => ({ ...current, items: current.items.map((item) => item.id === editingItem.id ? { ...item, name } : item) })); else updateParty((current) => ({ ...current, items: [...current.items, { id: nextId(), name }] })); setModal(null); }} />
  <PurchaseModal visible={modal === 'purchase' || Boolean(editingPurchase)} participants={party.participants} items={party.items} previousPurchases={party.purchases} existing={editingPurchase} onClose={() => { setModal(null); setEditingPurchase(undefined); }} onAddItem={(name) => { const id = nextId(); updateParty((current) => ({ ...current, items: [...current.items, { id, name }] })); return id; }} onSave={(title, total, paidById, itemIds, receiptUri, itemQuantities) => { updateParty((current) => ({ ...current, purchases: editingPurchase ? current.purchases.map((purchase) => purchase.id === editingPurchase.id ? { ...purchase, title, total, paidById, itemIds, receiptUri, itemQuantities } : purchase) : [...current.purchases, { id: nextId(), title, total, paidById, itemIds, receiptUri, itemQuantities }] })); setModal(null); setEditingPurchase(undefined); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' }, homeHeader: { padding: 28, paddingTop: 52 }, dashboard: { padding: 20, gap: 14, paddingBottom: 42 }, title: { fontSize: 30, fontWeight: '700', color: '#1D1B20' }, subtitle: { marginTop: 6, fontSize: 16, color: '#625B71' }, list: { padding: 20, gap: 12, flexGrow: 1 }, card: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E9E3EF' }, cardTitle: { fontSize: 18, fontWeight: '600' }, cardMeta: { color: '#625B71', marginTop: 6 }, bottomAction: { padding: 20 }, button: { backgroundColor: '#6750A4', paddingVertical: 13, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center' }, buttonText: { color: '#FFFFFF', fontWeight: '700' }, buttonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#6750A4' }, buttonTextSecondary: { color: '#6750A4' }, overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 20 }, modal: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, maxHeight: '90%' }, modalTitle: { fontSize: 23, fontWeight: '700', marginBottom: 18 }, input: { borderWidth: 1, borderColor: '#79747E', borderRadius: 8, padding: 13, fontSize: 16, marginBottom: 12, backgroundColor: '#FFFFFF' }, newItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#FFFFFF' }, newItemInput: { flex: 1, marginBottom: 0 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12, flexWrap: 'wrap' }, back: { color: '#6750A4', fontSize: 16, fontWeight: '600' }, section: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E9E3EF' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }, sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flex: 1 }, sectionBody: { paddingHorizontal: 16, paddingBottom: 16 }, sectionTitle: { fontSize: 18, fontWeight: '700' }, headerAction: { paddingLeft: 12 }, add: { color: '#6750A4', fontWeight: '700' }, arrowCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E9DDFF', alignItems: 'center', justifyContent: 'center' }, arrow: { color: '#6750A4', fontSize: 12, fontWeight: '800' }, chevron: { color: '#6750A4', fontSize: 20, fontWeight: '700' }, empty: { color: '#625B71', lineHeight: 23 }, fieldLabel: { fontSize: 15, fontWeight: '600', marginVertical: 6 }, dropdown: { borderWidth: 1, borderColor: '#79747E', borderRadius: 8, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }, dropdownValue: { color: '#1D1B20', flex: 1 }, dropdownPlaceholder: { color: '#625B71', flex: 1 }, dropdownMenu: { borderWidth: 1, borderColor: '#CAC4D0', borderRadius: 8, padding: 8, marginTop: 6, gap: 6, backgroundColor: '#FFFFFF' }, dropdownScroll: { maxHeight: 132 }, entityScroll: { maxHeight: 240 }, menuOption: { borderRadius: 8, padding: 11 }, choiceActive: { backgroundColor: '#E9DDFF' }, itemOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, itemOptionName: { flex: 1 }, quantityInput: { width: 54, borderWidth: 1, borderColor: '#79747E', borderRadius: 6, padding: 6, textAlign: 'center', backgroundColor: '#FFFFFF' }, rowList: { gap: 8 }, entityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 7 }, entityTextBlock: { flex: 1 }, entityName: { flex: 1, color: '#1D1B20' }, itemStatus: { color: '#625B71', fontSize: 12 }, rowActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, iconAction: { color: '#6750A4', fontSize: 21 }, trashAction: { color: '#BA1A1A', fontSize: 18 }, edit: { color: '#6750A4', fontWeight: '700' }, remove: { color: '#BA1A1A', fontWeight: '700' }, timeline: { gap: 10 }, timelineRow: { flexDirection: 'row', gap: 10 }, timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6750A4', marginTop: 8 }, timelineCard: { flex: 1, borderLeftWidth: 1, borderColor: '#D0BCFF', paddingLeft: 10, paddingBottom: 10 }, timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 }, timelineTitle: { flex: 1 }, purchaseTitle: { fontWeight: '700', color: '#1D1B20' }, purchaseMeta: { color: '#625B71', marginTop: 3 }, timelineDetails: { backgroundColor: '#F7F2FA', borderRadius: 8, padding: 10, marginTop: 8 }, detailLabel: { fontWeight: '700', marginBottom: 4 }, receiptName: { color: '#6750A4', marginTop: 8, fontSize: 13 }, settlementTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, shareAction: { color: '#25D366', fontSize: 28, fontWeight: '800' }, settlementList: { gap: 8, marginTop: 10 }, settlementBox: { backgroundColor: '#F7F2FA', borderWidth: 1, borderColor: '#D0BCFF', borderRadius: 10, padding: 12 }, settlementPhrase: { color: '#1D1B20', fontWeight: '700' }, pixLine: { color: '#625B71', marginTop: 5, fontSize: 13 }, totalLabel: { color: '#625B71' }, totalValue: { fontSize: 24, fontWeight: '700', marginVertical: 5 }, balanceRow: { borderTopWidth: 1, borderColor: '#E9E3EF', paddingTop: 9, gap: 3 }, balanceText: { color: '#625B71', fontSize: 13 },
});
