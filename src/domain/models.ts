export type Participant = { id: number; name: string; pixKey?: string };

export type Item = { id: number; name: string };

export type Purchase = {
  id: number;
  title: string;
  total: number;
  paidById: number;
  itemIds: number[];
  itemQuantities?: Record<number, number>;
  receiptUri?: string;
};

export type SplitMode = 'equal' | 'percentage';

export type Party = {
  id: number;
  name: string;
  participants: Participant[];
  items: Item[];
  purchases: Purchase[];
  splitMode: SplitMode;
  splitPercentages?: Record<number, number>;
};

export type Balance = {
  participantId: number;
  paid: number;
  shouldPay: number;
  balance: number;
};

export type Settlement = {
  fromParticipantId: number;
  toParticipantId: number;
  amount: number;
};
