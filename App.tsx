import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { ReactNode, useEffect, useState } from 'react';
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
import { Balance, Item, Participant, Party, Purchase, Settlement, SplitMode } from './src/domain/models';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';

const money = (value: number) => `R$ ${value.toFixed(2)}`;
const fileName = (uri?: string) => uri?.split('/').pop() ?? 'Receipt attached';

function DisclosureArrow({ open }: { open: boolean }) {
  return (
    <View style={styles.arrowCircle}>
      <FontAwesome name={open ? 'chevron-up' : 'chevron-down'} size={11} color="#6750A4" />
    </View>
  );
}

function Button({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <View style={styles.languageSwitcher}>
      <Pressable
        onPress={() => setLanguage('pt')}
        accessibilityLabel="Português"
        style={[styles.flagButton, language === 'pt' && styles.flagButtonActive]}
      >
        <Text style={styles.flagEmoji}>🇧🇷</Text>
      </Pressable>
      <Pressable
        onPress={() => setLanguage('en')}
        accessibilityLabel="English"
        style={[styles.flagButton, language === 'en' && styles.flagButtonActive]}
      >
        <Text style={styles.flagEmoji}>🇺🇸</Text>
      </Pressable>
    </View>
  );
}

function TextModal({ visible, title, label, initialValue = '', onClose, onConfirm }: { visible: boolean; title: string; label: string; initialValue?: string; onClose: () => void; onConfirm: (value: string) => void }) {
  const { t } = useLanguage();
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (visible) setValue(initialValue); }, [visible, initialValue]);
  const confirm = () => { const trimmed = value.trim(); if (trimmed) { onConfirm(trimmed); setValue(''); } };
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput autoFocus placeholder={label} value={value} onChangeText={setValue} style={styles.input} />
          <View style={styles.actions}>
            <Button label={t('cancel')} onPress={onClose} secondary />
            <Button label={t('save')} onPress={confirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ParticipantModal({ visible, existing, onClose, onSave }: { visible: boolean; existing?: Participant; onClose: () => void; onSave: (name: string, pixKey?: string) => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [pixKey, setPixKey] = useState('');
  useEffect(() => { if (visible) { setName(existing?.name ?? ''); setPixKey(existing?.pixKey ?? ''); } }, [visible, existing]);
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{existing ? t('editParticipant') : t('addParticipant')}</Text>
          <TextInput autoFocus placeholder={t('participantName')} value={name} onChangeText={setName} style={styles.input} />
          <TextInput placeholder={t('pixKeyOptional')} value={pixKey} onChangeText={setPixKey} style={styles.input} />
          <View style={styles.actions}>
            <Button label={t('cancel')} onPress={onClose} secondary />
            <Button label={t('save')} onPress={() => { if (name.trim()) onSave(name.trim(), pixKey.trim() || undefined); }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Dropdown({ label, value, open, onToggle, children }: { label: string; value: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.dropdown} onPress={onToggle}>
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>{value || t('select', { label })}</Text>
        <DisclosureArrow open={open} />
      </Pressable>
      {open && <View style={styles.dropdownMenu}>{children}</View>}
    </View>
  );
}

type NewPartyModalProps = {
  visible: boolean;
  parties: Party[];
  onClose: () => void;
  onCreate: (name: string, copyFromId?: number) => void;
};

function NewPartyModal({ visible, parties, onClose, onCreate }: NewPartyModalProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [copyFromId, setCopyFromId] = useState<number | undefined>();
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => { if (visible) { setName(''); setCopyFromId(undefined); setCopyOpen(false); } }, [visible]);

  const copyFromValue = parties.find((party) => party.id === copyFromId)?.name ?? '';
  const confirm = () => { const trimmed = name.trim(); if (trimmed) onCreate(trimmed, copyFromId); };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{t('newPartyTitle')}</Text>
          <TextInput autoFocus placeholder={t('partyNameLabel')} value={name} onChangeText={setName} style={styles.input} />
          {parties.length > 0 && (
            <Dropdown label={t('copyFromParty')} value={copyFromValue} open={copyOpen} onToggle={() => setCopyOpen((current) => !current)}>
              <Pressable onPress={() => { setCopyFromId(undefined); setCopyOpen(false); }} style={styles.menuOption}>
                <Text>{t('copyFromPartyNone')}</Text>
              </Pressable>
              {parties.map((party) => (
                <Pressable key={party.id} onPress={() => { setCopyFromId(party.id); setCopyOpen(false); }} style={[styles.menuOption, copyFromId === party.id && styles.choiceActive]}>
                  <Text>{party.name}</Text>
                </Pressable>
              ))}
            </Dropdown>
          )}
          <View style={styles.actions}>
            <Button label={t('cancel')} onPress={onClose} secondary />
            <Button label={t('save')} onPress={confirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type SplitModeModalProps = {
  visible: boolean;
  participants: Participant[];
  splitMode: SplitMode;
  splitPercentages?: Record<number, number>;
  onClose: () => void;
  onSave: (mode: SplitMode, percentages?: Record<number, number>) => void;
};

function SplitModeModal({ visible, participants, splitMode, splitPercentages, onClose, onSave }: SplitModeModalProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<SplitMode>('equal');
  const [percentages, setPercentages] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!visible) return;
    setMode(splitMode);
    const initial: Record<number, string> = {};
    participants.forEach((person) => {
      initial[person.id] = splitPercentages?.[person.id] !== undefined ? String(splitPercentages[person.id]) : '';
    });
    setPercentages(initial);
  }, [visible, splitMode, splitPercentages, participants]);

  const total = participants.reduce((sum, person) => sum + (Number((percentages[person.id] ?? '').replace(',', '.')) || 0), 0);
  const validPercentage = Math.abs(total - 100) < 0.01 && participants.every((person) => percentages[person.id]);

  const save = () => {
    if (mode === 'equal') { onSave('equal', undefined); return; }
    if (!validPercentage) { Alert.alert(t('splitModeTitle'), t('splitPercentageMustBe100')); return; }
    const numeric: Record<number, number> = {};
    participants.forEach((person) => { numeric[person.id] = Number((percentages[person.id] ?? '0').replace(',', '.')); });
    onSave('percentage', numeric);
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>{t('splitModeTitle')}</Text>
          <Pressable style={[styles.choiceRow, mode === 'equal' && styles.choiceActive]} onPress={() => setMode('equal')}>
            <Text style={styles.choiceTitle}>{t('splitModeEqual')}</Text>
            <Text style={styles.empty}>{t('splitModeEqualDescription')}</Text>
          </Pressable>
          <Pressable style={[styles.choiceRow, mode === 'percentage' && styles.choiceActive]} onPress={() => setMode('percentage')}>
            <Text style={styles.choiceTitle}>{t('splitModePercentage')}</Text>
            <Text style={styles.empty}>{t('splitModePercentageDescription')}</Text>
          </Pressable>
          {mode === 'percentage' && (
            <View style={styles.rowList}>
              {participants.map((person) => (
                <View key={person.id} style={styles.percentageRow}>
                  <Text style={styles.entityName}>{person.name}</Text>
                  <View style={styles.percentageInputWrap}>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={percentages[person.id] ?? ''}
                      onChangeText={(value) => setPercentages((current) => ({ ...current, [person.id]: value }))}
                      style={styles.percentageInput}
                    />
                    <Text style={styles.percentSign}>%</Text>
                  </View>
                </View>
              ))}
              <Text style={[styles.empty, !validPercentage && styles.percentageWarning]}>
                {t('splitPercentageTotal', { total: total.toFixed(1) })}
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            <Button label={t('cancel')} onPress={onClose} secondary />
            <Button label={t('save')} onPress={save} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

type PurchaseModalProps = {
  visible: boolean;
  participants: Participant[];
  items: Item[];
  existing?: Purchase;
  onClose: () => void;
  onAddItem: (name: string) => number;
  onSave: (title: string, total: number, paidById: number, itemIds: number[], receiptUri?: string, itemQuantities?: Record<number, number>) => void;
};

function PurchaseModal({ visible, participants, items, existing, onClose, onAddItem, onSave }: PurchaseModalProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [payerId, setPayerId] = useState<number | undefined>();
  const [itemIds, setItemIds] = useState<number[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [newItem, setNewItem] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [payerOpen, setPayerOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(existing?.title ?? '');
    setTotal(existing ? String(existing.total) : '');
    setPayerId(existing?.paidById ?? participants[0]?.id);
    setItemIds(existing?.itemIds ?? []);
    setItemQuantities(existing?.itemQuantities ?? {});
    setReceiptUri(existing?.receiptUri);
    setNewItem('');
    setPayerOpen(false);
    setItemsOpen(false);
  }, [visible, existing, participants]);

  const save = () => {
    const amount = Number(total.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0 || !payerId) {
      Alert.alert(t('completePurchaseTitle'), t('completePurchaseMessage'));
      return;
    }
    onSave(title.trim(), amount, payerId, itemIds, receiptUri, itemQuantities);
  };
  const toggleItem = (id: number) => setItemIds((current) => (current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]));
  const addItem = () => { const name = newItem.trim(); if (!name) return; const id = onAddItem(name); setItemIds((current) => [...current, id]); setNewItem(''); };
  const chooseReceipt = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('permissionNeededTitle'), camera ? t('permissionNeededCamera') : t('permissionNeededGallery'));
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setReceiptUri(result.assets[0].uri);
  };
  const payerName = participants.find((person) => person.id === payerId)?.name ?? '';
  const selectedItemNames = items.filter((item) => itemIds.includes(item.id)).map((item) => item.name).join(', ');

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>{existing ? t('editPurchase') : t('addPurchase')}</Text>
          <TextInput placeholder={t('purchaseName')} value={title} onChangeText={setTitle} style={styles.input} />
          <TextInput placeholder={t('total')} keyboardType="decimal-pad" value={total} onChangeText={setTotal} style={styles.input} />
          <Dropdown label={t('paidBy')} value={payerName} open={payerOpen} onToggle={() => { setPayerOpen(!payerOpen); setItemsOpen(false); }}>
            {participants.map((person) => (
              <Pressable key={person.id} onPress={() => { setPayerId(person.id); setPayerOpen(false); }} style={[styles.menuOption, payerId === person.id && styles.choiceActive]}>
                <Text>{person.name}</Text>
              </Pressable>
            ))}
          </Dropdown>
          <Dropdown label={t('itemsCount', { count: itemIds.length })} value={selectedItemNames} open={itemsOpen} onToggle={() => { setItemsOpen(!itemsOpen); setPayerOpen(false); }}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
              {items.length ? items.map((item) => (
                <Pressable key={item.id} onPress={() => toggleItem(item.id)} style={[styles.menuOption, itemIds.includes(item.id) && styles.choiceActive]}>
                  <View style={styles.itemOption}>
                    <Text style={styles.itemOptionName}>{itemIds.includes(item.id) ? '✓ ' : ''}{item.name}</Text>
                    {itemIds.includes(item.id) && (
                      <TextInput
                        keyboardType="number-pad"
                        placeholder={t('qty')}
                        value={String(itemQuantities[item.id] ?? 1)}
                        onChangeText={(value) => setItemQuantities((current) => ({ ...current, [item.id]: Number(value) || 1 }))}
                        style={styles.quantityInput}
                      />
                    )}
                  </View>
                </Pressable>
              )) : <Text style={styles.empty}>{t('noItemsYet')}</Text>}
            </ScrollView>
            <View style={styles.newItemRow}>
              <TextInput placeholder={t('newItem')} value={newItem} onChangeText={setNewItem} style={[styles.input, styles.newItemInput]} />
              <Button label={t('add')} onPress={addItem} />
            </View>
          </Dropdown>
          <Text style={styles.fieldLabel}>{t('receipt')}</Text>
          <View style={styles.actions}>
            <Button label={t('choosePhoto')} onPress={() => chooseReceipt(false)} secondary />
            <Button label={t('takePhoto')} onPress={() => chooseReceipt(true)} secondary />
          </View>
          {receiptUri && <Text style={styles.receiptName}>{t('attached', { name: fileName(receiptUri) })}</Text>}
          <View style={styles.actions}>
            <Button label={t('cancel')} onPress={onClose} secondary />
            <Button label={existing ? t('saveChanges') : t('save')} onPress={save} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Section({ title, count, onAdd, children }: { title: string; count?: number; onAdd?: () => void; children: ReactNode }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Pressable onPress={() => setOpen((current) => !current)} style={styles.sectionToggle}>
          <Text style={styles.sectionTitle}>{title}{count !== undefined ? ` (${count})` : ''}</Text>
          <DisclosureArrow open={open} />
        </Pressable>
        {onAdd && <Pressable onPress={onAdd} style={styles.headerAction}><Text style={styles.add}>{t('add')}</Text></Pressable>}
      </View>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function PurchaseTimeline({ purchase, payerName, itemNames, onEdit, onRemove }: { purchase: Purchase; payerName: string; itemNames: string[]; onEdit: () => void; onRemove: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineDot} />
      <View style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <Pressable onPress={() => setOpen((current) => !current)} style={styles.timelineTitle}>
            <Text style={styles.purchaseTitle}>{purchase.title}</Text>
            <Text style={styles.purchaseMeta}>{money(purchase.total)} · {payerName}</Text>
          </Pressable>
          <View style={styles.rowActions}>
            <Pressable onPress={onEdit} accessibilityLabel={`${t('editAction')} ${t('purchase')}`}>
              <FontAwesome name="pencil" size={19} color="#6750A4" />
            </Pressable>
            <Pressable onPress={onRemove} accessibilityLabel={`${t('removeAction')} ${t('purchase')}`}>
              <FontAwesome name="trash" size={17} color="#BA1A1A" />
            </Pressable>
            <Pressable onPress={() => setOpen((current) => !current)}>
              <DisclosureArrow open={open} />
            </Pressable>
          </View>
        </View>
        {open && (
          <View style={styles.timelineDetails}>
            <Text style={styles.detailLabel}>{t('items')}</Text>
            <Text style={styles.empty}>{itemNames.length ? itemNames.join(' · ') : t('noItemsLinked')}</Text>
            {purchase.receiptUri && <Text style={styles.receiptName}>{t('receiptLabel', { name: fileName(purchase.receiptUri) })}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

function AppContent() {
  const { t } = useLanguage();
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [modal, setModal] = useState<'party' | 'participant' | 'item' | 'purchase' | 'splitMode' | null>(null);
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
  const confirmDelete = (label: string, onDelete: () => void) => Alert.alert(t('removeConfirmTitle', { label }), t('removeConfirmMessage'), [{ text: t('cancel'), style: 'cancel' }, { text: t('remove'), style: 'destructive', onPress: onDelete }]);

  const createParty = (name: string, copyFromId?: number) => {
    const source = parties.find((entry) => entry.id === copyFromId);
    const newParticipants: Participant[] = source ? source.participants.map((person) => ({ ...person, id: nextId() })) : [];
    const newItems: Item[] = source ? source.items.map((item) => ({ ...item, id: nextId() })) : [];
    setParties((current) => [...current, { id: nextId(), name, participants: newParticipants, items: newItems, purchases: [], splitMode: 'equal' }]);
    setModal(null);
  };

  if (!party) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.homeHeader}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerSpacer} />
            <LanguageSwitcher />
          </View>
          <Text style={styles.title}>{t('appName')}</Text>
          <Text style={styles.subtitle}>{t('appSubtitle')}</Text>
        </View>
        <FlatList
          data={parties}
          keyExtractor={(entry) => String(entry.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t('noPartiesYet')}</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setPartyId(item.id)}>
              <View style={styles.titleRow}>
                <FontAwesome5 name="glass-cheers" size={16} color="#6750A4" />
                <Text style={styles.cardTitle}>{item.name}</Text>
              </View>
              <Text style={styles.cardMeta}>{t('partiesMeta', { participants: item.participants.length, purchases: item.purchases.length })}</Text>
            </Pressable>
          )}
        />
        <View style={styles.bottomAction}>
          <Button label={t('newParty')} onPress={() => setModal('party')} />
        </View>
        <NewPartyModal visible={modal === 'party'} parties={parties} onClose={() => setModal(null)} onCreate={createParty} />
      </SafeAreaView>
    );
  }

  const participantName = (id: number) => party.participants.find((person) => person.id === id)?.name ?? t('unknownParticipant');
  const totalPurchases = party.purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const calculated = calculatedPartyId === party.id;
  const calculateParty = () => { const nextBalances = calculateBalances(party); setBalances(nextBalances); setSettlements(calculateSettlements(nextBalances)); setCalculatedPartyId(party.id); };
  const settlementMessage = settlements.map((entry) => t('payPhrase', { from: participantName(entry.fromParticipantId), to: participantName(entry.toParticipantId), amount: money(entry.amount) })).join('\n');
  const shareSettlements = () => Share.share({ title: `${t('appName')} · ${party.name}`, message: settlementMessage || t('noSettlements') });
  const removeParticipant = (id: number) => updateParty((current) => ({ ...current, participants: current.participants.filter((person) => person.id !== id) }));
  const removeItem = (id: number) => updateParty((current) => ({ ...current, items: current.items.filter((item) => item.id !== id), purchases: current.purchases.map((purchase) => ({ ...purchase, itemIds: purchase.itemIds.filter((itemId) => itemId !== id) })) }));
  const removePurchase = (id: number) => updateParty((current) => ({ ...current, purchases: current.purchases.filter((purchase) => purchase.id !== id) }));
  const saveSplitMode = (mode: SplitMode, percentages?: Record<number, number>) => {
    updateParty((current) => ({ ...current, splitMode: mode, splitPercentages: mode === 'percentage' ? percentages : undefined }));
    setModal(null);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.dashboard} nestedScrollEnabled>
        <View style={styles.partyHeaderRow}>
          <Pressable onPress={() => setPartyId(null)}><Text style={styles.back}>{t('allParties')}</Text></Pressable>
          <View style={styles.partyHeaderActions}>
            <LanguageSwitcher />
            <Pressable onPress={() => setModal('splitMode')} accessibilityLabel={t('splitModeTitle')} style={styles.hamburgerButton}>
              <FontAwesome name="bars" size={19} color="#6750A4" />
            </Pressable>
          </View>
        </View>
        <View style={styles.titleRow}>
          <FontAwesome5 name="glass-cheers" size={22} color="#6750A4" />
          <Text style={styles.title}>{party.name}</Text>
        </View>

        <Section title={t('participants')} count={party.participants.length} onAdd={() => openNewText('participant')}>
          <ScrollView style={party.participants.length > 5 ? styles.entityScroll : undefined} nestedScrollEnabled>
            <View style={styles.rowList}>
              {party.participants.length ? party.participants.map((person) => (
                <View key={person.id} style={styles.entityRow}>
                  <View style={styles.entityTextBlock}>
                    <Text style={styles.entityName}>{person.name}</Text>
                    {person.pixKey && <Text style={styles.itemStatus}>{t('pixRegistered', { pix: person.pixKey })}</Text>}
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => { setEditingParticipant(person); setModal('participant'); }} accessibilityLabel={`${t('editAction')} ${t('participant')}`}>
                      <FontAwesome name="pencil" size={19} color="#6750A4" />
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(t('participant'), () => removeParticipant(person.id))} accessibilityLabel={`${t('removeAction')} ${t('participant')}`}>
                      <FontAwesome name="trash" size={17} color="#BA1A1A" />
                    </Pressable>
                  </View>
                </View>
              )) : <Text style={styles.empty}>{t('noParticipantsYet')}</Text>}
            </View>
          </ScrollView>
        </Section>

        <Section title={t('items')} count={party.items.length} onAdd={() => openNewText('item')}>
          <ScrollView style={party.items.length > 5 ? styles.entityScroll : undefined} nestedScrollEnabled>
            <View style={styles.rowList}>
              {party.items.length ? party.items.map((item) => {
                const buyers = party.purchases.filter((purchase) => purchase.itemIds.includes(item.id)).map((purchase) => participantName(purchase.paidById));
                return (
                  <View key={item.id} style={styles.entityRow}>
                    <View style={styles.entityTextBlock}>
                      <View style={styles.titleRow}>
                        {buyers.length > 0 && <FontAwesome name="tag" size={13} color="#6750A4" />}
                        <Text style={styles.entityName}>{item.name}</Text>
                      </View>
                      <Text style={styles.itemStatus}>{buyers.length ? t('boughtBy', { names: buyers.join(', ') }) : t('notBought')}</Text>
                    </View>
                    <View style={styles.rowActions}>
                      <Pressable onPress={() => { setEditingItem(item); setModal('item'); }} accessibilityLabel={`${t('editAction')} ${t('item')}`}>
                        <FontAwesome name="pencil" size={19} color="#6750A4" />
                      </Pressable>
                      <Pressable onPress={() => confirmDelete(t('item'), () => removeItem(item.id))} accessibilityLabel={`${t('removeAction')} ${t('item')}`}>
                        <FontAwesome name="trash" size={17} color="#BA1A1A" />
                      </Pressable>
                    </View>
                  </View>
                );
              }) : <Text style={styles.empty}>{t('noItemsYet')}</Text>}
            </View>
          </ScrollView>
        </Section>

        <Section title={t('purchases')} count={party.purchases.length} onAdd={() => party.participants.length ? setModal('purchase') : Alert.alert(t('addParticipantsFirstTitle'))}>
          <View style={styles.timeline}>
            {party.purchases.length ? party.purchases.map((purchase) => (
              <PurchaseTimeline
                key={purchase.id}
                purchase={purchase}
                payerName={participantName(purchase.paidById)}
                itemNames={purchase.itemIds.map((id) => {
                  const item = party.items.find((entry) => entry.id === id);
                  const quantity = purchase.itemQuantities?.[id] ?? 1;
                  return item ? `${item.name}${quantity > 1 ? ` x${quantity}` : ''}` : undefined;
                }).filter((name): name is string => Boolean(name))}
                onEdit={() => setEditingPurchase(purchase)}
                onRemove={() => confirmDelete(t('purchase'), () => removePurchase(purchase.id))}
              />
            )) : <Text style={styles.empty}>{t('noPurchasesYet')}</Text>}
          </View>
        </Section>

        <Button label={t('calculateBalances')} onPress={calculateParty} />

        <Section title={t('balances')}>
          <Text style={styles.totalLabel}>{t('totalPurchases')}</Text>
          <Text style={styles.totalValue}>{money(totalPurchases)}</Text>
          {calculated ? (
            <View style={styles.rowList}>
              {balances.slice().sort((left, right) => right.paid - left.paid).map((balance) => (
                <View key={balance.participantId} style={styles.balanceRow}>
                  <Text style={styles.entityName}>{participantName(balance.participantId)}</Text>
                  <Text style={styles.balanceText}>{t('bought', { amount: money(balance.paid) })}</Text>
                  <Text style={styles.balanceText}>{t('shouldPayLabel', { amount: money(balance.shouldPay) })}</Text>
                  <Text style={[styles.balanceText, balance.balance > 0.01 ? styles.balancePositive : balance.balance < -0.01 ? styles.balanceNegative : undefined]}>
                    {balance.balance > 0.01 ? t('balancePositive', { amount: money(balance.balance) }) : balance.balance < -0.01 ? t('balanceNegative', { amount: money(-balance.balance) }) : t('balanceZero')}
                  </Text>
                </View>
              ))}
            </View>
          ) : <Text style={styles.empty}>{t('tapToCalculate')}</Text>}
        </Section>

        <Section title={t('whoPaysWho')}>
          <View style={styles.settlementTitleRow}>
            <Text style={styles.empty}>{calculated ? t('shareSettlements') : t('calculateToSeeSettlements')}</Text>
            {calculated && (
              <Pressable onPress={shareSettlements} accessibilityLabel={t('shareSettlements')}>
                <FontAwesome name="share-square" size={24} color="#25D366" />
              </Pressable>
            )}
          </View>
          {calculated && settlements.length ? (
            <View style={styles.settlementList}>
              {settlements.map((entry) => {
                const from = party.participants.find((person) => person.id === entry.fromParticipantId);
                const to = party.participants.find((person) => person.id === entry.toParticipantId);
                return (
                  <View key={`${entry.fromParticipantId}-${entry.toParticipantId}`} style={styles.settlementBox}>
                    <Text style={styles.settlementPhrase}>{t('payPhrase', { from: from?.name ?? '', to: to?.name ?? '', amount: money(entry.amount) })}</Text>
                    <Text style={styles.pixLine}>{to?.pixKey ? t('pixRegistered', { pix: to.pixKey }) : t('pixNotRegistered')}</Text>
                  </View>
                );
              })}
            </View>
          ) : calculated ? <Text style={styles.empty}>{t('noSettlements')}</Text> : null}
        </Section>
      </ScrollView>

      <ParticipantModal
        visible={modal === 'participant'}
        existing={editingParticipant}
        onClose={() => setModal(null)}
        onSave={(name, pixKey) => {
          if (editingParticipant) updateParty((current) => ({ ...current, participants: current.participants.map((person) => person.id === editingParticipant.id ? { ...person, name, pixKey } : person) }));
          else updateParty((current) => ({ ...current, participants: [...current.participants, { id: nextId(), name, pixKey }] }));
          setEditingParticipant(undefined);
          setModal(null);
        }}
      />
      <TextModal
        visible={modal === 'item'}
        title={editingItem ? t('editItem') : t('addItem')}
        label={t('itemName')}
        initialValue={editingItem?.name}
        onClose={() => setModal(null)}
        onConfirm={(name) => {
          if (editingItem) updateParty((current) => ({ ...current, items: current.items.map((item) => item.id === editingItem.id ? { ...item, name } : item) }));
          else updateParty((current) => ({ ...current, items: [...current.items, { id: nextId(), name }] }));
          setModal(null);
        }}
      />
      <PurchaseModal
        visible={modal === 'purchase' || Boolean(editingPurchase)}
        participants={party.participants}
        items={party.items}
        existing={editingPurchase}
        onClose={() => { setModal(null); setEditingPurchase(undefined); }}
        onAddItem={(name) => { const id = nextId(); updateParty((current) => ({ ...current, items: [...current.items, { id, name }] })); return id; }}
        onSave={(title, total, paidById, itemIds, receiptUri, itemQuantities) => {
          updateParty((current) => ({ ...current, purchases: editingPurchase ? current.purchases.map((purchase) => purchase.id === editingPurchase.id ? { ...purchase, title, total, paidById, itemIds, receiptUri, itemQuantities } : purchase) : [...current.purchases, { id: nextId(), title, total, paidById, itemIds, receiptUri, itemQuantities }] }));
          setModal(null);
          setEditingPurchase(undefined);
        }}
      />
      <SplitModeModal
        visible={modal === 'splitMode'}
        participants={party.participants}
        splitMode={party.splitMode}
        splitPercentages={party.splitPercentages}
        onClose={() => setModal(null)}
        onSave={saveSplitMode}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  homeHeader: { padding: 28, paddingTop: 52 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  headerSpacer: { flex: 1 },
  dashboard: { padding: 20, gap: 14, paddingBottom: 42 },
  title: { fontSize: 30, fontWeight: '700', color: '#1D1B20' },
  subtitle: { marginTop: 6, fontSize: 16, color: '#625B71' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { padding: 20, gap: 12, flexGrow: 1 },
  card: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E9E3EF' },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardMeta: { color: '#625B71', marginTop: 6 },
  bottomAction: { padding: 20 },
  button: { backgroundColor: '#6750A4', paddingVertical: 13, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  buttonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#6750A4' },
  buttonTextSecondary: { color: '#6750A4' },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 23, fontWeight: '700', marginBottom: 18 },
  input: { borderWidth: 1, borderColor: '#79747E', borderRadius: 8, padding: 13, fontSize: 16, marginBottom: 12, backgroundColor: '#FFFFFF' },
  newItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#FFFFFF' },
  newItemInput: { flex: 1, marginBottom: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  back: { color: '#6750A4', fontSize: 16, fontWeight: '600' },
  partyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partyHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hamburgerButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E9DDFF', alignItems: 'center', justifyContent: 'center' },
  languageSwitcher: { flexDirection: 'row', gap: 6 },
  flagButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', opacity: 0.45 },
  flagButtonActive: { opacity: 1, backgroundColor: '#E9DDFF' },
  flagEmoji: { fontSize: 16 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E9E3EF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flex: 1 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  headerAction: { paddingLeft: 12 },
  add: { color: '#6750A4', fontWeight: '700' },
  arrowCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E9DDFF', alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#625B71', lineHeight: 23 },
  fieldLabel: { fontSize: 15, fontWeight: '600', marginVertical: 6 },
  dropdown: { borderWidth: 1, borderColor: '#79747E', borderRadius: 8, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' },
  dropdownValue: { color: '#1D1B20', flex: 1 },
  dropdownPlaceholder: { color: '#625B71', flex: 1 },
  dropdownMenu: { borderWidth: 1, borderColor: '#CAC4D0', borderRadius: 8, padding: 8, marginTop: 6, gap: 6, backgroundColor: '#FFFFFF' },
  dropdownScroll: { maxHeight: 132 },
  entityScroll: { maxHeight: 240 },
  menuOption: { borderRadius: 8, padding: 11 },
  choiceActive: { backgroundColor: '#E9DDFF' },
  choiceRow: { borderWidth: 1, borderColor: '#CAC4D0', borderRadius: 10, padding: 12, marginBottom: 10, gap: 4 },
  choiceTitle: { fontSize: 16, fontWeight: '700', color: '#1D1B20' },
  itemOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemOptionName: { flex: 1 },
  quantityInput: { width: 54, borderWidth: 1, borderColor: '#79747E', borderRadius: 6, padding: 6, textAlign: 'center', backgroundColor: '#FFFFFF' },
  rowList: { gap: 8 },
  entityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 7 },
  entityTextBlock: { flex: 1 },
  entityName: { flex: 1, color: '#1D1B20' },
  itemStatus: { color: '#625B71', fontSize: 12 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeline: { gap: 10 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6750A4', marginTop: 8 },
  timelineCard: { flex: 1, borderLeftWidth: 1, borderColor: '#D0BCFF', paddingLeft: 10, paddingBottom: 10 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  timelineTitle: { flex: 1 },
  purchaseTitle: { fontWeight: '700', color: '#1D1B20' },
  purchaseMeta: { color: '#625B71', marginTop: 3 },
  timelineDetails: { backgroundColor: '#F7F2FA', borderRadius: 8, padding: 10, marginTop: 8 },
  detailLabel: { fontWeight: '700', marginBottom: 4 },
  receiptName: { color: '#6750A4', marginTop: 8, fontSize: 13 },
  settlementTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settlementList: { gap: 8, marginTop: 10 },
  settlementBox: { backgroundColor: '#F7F2FA', borderWidth: 1, borderColor: '#D0BCFF', borderRadius: 10, padding: 12 },
  settlementPhrase: { color: '#1D1B20', fontWeight: '700' },
  pixLine: { color: '#625B71', marginTop: 5, fontSize: 13 },
  totalLabel: { color: '#625B71' },
  totalValue: { fontSize: 24, fontWeight: '700', marginVertical: 5 },
  balanceRow: { borderTopWidth: 1, borderColor: '#E9E3EF', paddingTop: 9, gap: 3 },
  balanceText: { color: '#625B71', fontSize: 13 },
  balancePositive: { color: '#146C2E', fontWeight: '700' },
  balanceNegative: { color: '#BA1A1A', fontWeight: '700' },
  percentageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 6 },
  percentageInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  percentageInput: { width: 64, borderWidth: 1, borderColor: '#79747E', borderRadius: 6, padding: 8, textAlign: 'center', backgroundColor: '#FFFFFF' },
  percentSign: { color: '#625B71' },
  percentageWarning: { color: '#BA1A1A', fontWeight: '700' },
});
