import { Balance, Party, Settlement } from './models';

export function calculateBalances(party: Party): Balance[] {
  if (party.participants.length === 0) return [];

  const totalSpent = party.purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const percentages = party.splitPercentages;
  const usePercentages =
    party.splitMode === 'percentage' &&
    percentages !== undefined &&
    party.participants.every((participant) => percentages[participant.id] !== undefined);
  const equalShare = totalSpent / party.participants.length;

  return party.participants.map((participant) => {
    const paid = party.purchases
      .filter((purchase) => purchase.paidById === participant.id)
      .reduce((sum, purchase) => sum + purchase.total, 0);
    const shouldPay = usePercentages ? totalSpent * ((percentages![participant.id] ?? 0) / 100) : equalShare;

    return { participantId: participant.id, paid, shouldPay, balance: paid - shouldPay };
  });
}

export function calculateSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances.filter((entry) => entry.balance > 0.01).map((entry) => ({ ...entry }));
  const debtors = balances.filter((entry) => entry.balance < -0.01).map((entry) => ({ ...entry }));
  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.balance, -debtor.balance);
    settlements.push({
      fromParticipantId: debtor.participantId,
      toParticipantId: creditor.participantId,
      amount,
    });
    creditor.balance -= amount;
    debtor.balance += amount;
    if (creditor.balance < 0.01) creditorIndex += 1;
    if (debtor.balance > -0.01) debtorIndex += 1;
  }

  return settlements;
}
