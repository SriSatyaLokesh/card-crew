export type SupportedCardType =
  | "Credit Card"
  | "Debit Card"
  | "Prepaid Card"
  | "Virtual Card"
  | "Business Card";

export const SUPPORTED_CARD_TYPES: SupportedCardType[] = [
  "Credit Card",
  "Debit Card",
  "Prepaid Card",
  "Virtual Card",
  "Business Card",
];

export function normalizeCardType(rawType: string): SupportedCardType | null {
  const normalized = rawType.trim().toLowerCase();
  if (normalized === "credit card" || normalized === "credit") return "Credit Card";
  if (normalized === "debit card" || normalized === "debit") return "Debit Card";
  if (normalized === "prepaid card" || normalized === "prepaid") return "Prepaid Card";
  if (normalized === "virtual card" || normalized === "virtual") return "Virtual Card";
  if (
    normalized === "business card" ||
    normalized === "business" ||
    normalized === "corporate" ||
    normalized === "charge card" ||
    normalized === "charge"
  ) {
    return "Business Card";
  }
  return null;
}

export type VisibilityScope = "DIRECT_FRIENDS" | "TOTAL_NETWORK";

export function normalizeVisibilityScope(rawScope?: string | null): VisibilityScope {
  if (!rawScope) return "DIRECT_FRIENDS";
  const normalized = rawScope.trim().toUpperCase();
  if (normalized === "TOTAL_NETWORK" || normalized === "NETWORK" || normalized === "FRIENDS_OF_FRIENDS") {
    return "TOTAL_NETWORK";
  }
  return "DIRECT_FRIENDS";
}

export type CardRecord = {
  id: string;
  userId: string;
  cardName: string;
  cardType: string;
  visibilityScope: VisibilityScope;
  createdAt: string;
  updatedAt: string;
};

export type CreateCardInput = {
  cardName: string;
  cardType: string;
  visibilityScope?: VisibilityScope;
};

export type UpdateCardInput = {
  cardName?: string;
  cardType?: string;
  visibilityScope?: VisibilityScope;
};
