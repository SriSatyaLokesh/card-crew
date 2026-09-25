type CardCatalogRecord = {
  id: string;
  issuer: string;
  product_name: string;
  card_type: "credit" | "debit" | "charge" | "prepaid";
  card_category: "credit" | "debit" | "prepaid" | "charge";
  network: string;
  segment: "retail" | "co-branded" | "corporate";
  variant: string | null;
  country: string;
  upi_enabled: boolean;
  use_cases: string[];
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type { CardCatalogRecord };
