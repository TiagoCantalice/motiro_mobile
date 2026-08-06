export type Participant = { id: number; name: string };

export type Item = { id: number; name: string };

export type Purchase = {
  id: number;
  title: string;
  total: number;
  paidById: number;
  itemIds: number[];
};

export type Party = {
  id: number;
  name: string;
  participants: Participant[];
  items: Item[];
  purchases: Purchase[];
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
