type CardSeedTuple = [
  id: string,
  issuer: string,
  product_name: string,
  card_type: "credit" | "debit" | "charge" | "co-branded",
  card_category: "credit" | "debit" | "prepaid" | "charge",
  network: string,
  variant: string | null,
  upi_enabled: boolean,
];

const CARD_CATALOG_SEED: CardSeedTuple[] = [
  ["hdfc-infinia", "HDFC", "Infinia", "credit", "credit", "Mastercard", "Infinite", false],
  ["hdfc-regalia-gold", "HDFC", "Regalia Gold", "credit", "credit", "Visa", "Gold", false],
  ["hdfc-diners-black-metal", "HDFC", "Diners Club Black Metal", "credit", "credit", "Diners Club", "Metal", false],
  ["hdfc-millennia", "HDFC", "Millennia", "credit", "credit", "Visa", "Rewards", false],
  ["hdfc-swiggy", "HDFC", "Swiggy", "co-branded", "credit", "Mastercard", "Co-branded", false],
  ["hdfc-tata-neu-infinity", "HDFC", "Tata Neu Infinity", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["hdfc-tata-neu-plus", "HDFC", "Tata Neu Plus", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["hdfc-indianoil", "HDFC", "IndianOil", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["hdfc-pixel-play", "HDFC", "PIXEL Play", "credit", "credit", "Visa", "Virtual", false],
  ["hdfc-upi-rupay", "HDFC", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["axis-magnus", "Axis", "Magnus", "credit", "credit", "Visa", "Premium", false],
  ["axis-magnus-burgundy", "Axis", "Magnus for Burgundy", "credit", "credit", "Mastercard", "Premium", false],
  ["axis-atlas", "Axis", "Atlas", "credit", "credit", "Visa", "Travel", false],
  ["axis-reserve", "Axis", "Reserve", "credit", "credit", "Visa", "Premium", false],
  ["axis-select", "Axis", "Select", "credit", "credit", "Visa", "Premium", false],
  ["axis-privilege", "Axis", "Privilege", "credit", "credit", "Visa", "Rewards", false],
  ["axis-ace", "Axis", "ACE", "credit", "credit", "Visa", "Cashback", false],
  ["axis-airtel", "Axis", "Airtel", "co-branded", "credit", "Mastercard", "Co-branded", false],
  ["axis-flipkart", "Axis", "Flipkart", "co-branded", "credit", "Visa", "Co-branded", false],
  ["axis-myzone", "Axis", "My Zone", "credit", "credit", "Visa", "Lifestyle", false],
  ["axis-neo", "Axis", "Neo", "credit", "credit", "Visa", "Entry", false],
  ["axis-indianoil", "Axis", "IndianOil", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["axis-upi-rupay", "Axis", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["icici-emeralde-private-metal", "ICICI", "Emeralde Private Metal", "credit", "credit", "Mastercard", "Metal", false],
  ["icici-emeralde", "ICICI", "Emeralde", "credit", "credit", "Mastercard", "Premium", false],
  ["icici-sapphiro", "ICICI", "Sapphiro", "credit", "credit", "Mastercard", "Premium", false],
  ["icici-rubxy", "ICICI", "Rubyx", "credit", "credit", "Mastercard", "Premium", false],
  ["icici-coral", "ICICI", "Coral", "credit", "credit", "Visa", "Rewards", false],
  ["icici-amazon-pay", "ICICI", "Amazon Pay", "co-branded", "credit", "Visa", "Co-branded", false],
  ["icici-hpcl-super-saver", "ICICI", "HPCL Super Saver", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["icici-mmt", "ICICI", "MakeMyTrip", "co-branded", "credit", "Visa", "Co-branded", false],
  ["icici-manchester-united", "ICICI", "Manchester United", "co-branded", "credit", "Visa", "Co-branded", false],
  ["icici-upi-rupay", "ICICI", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["icici-platinum-chip", "ICICI", "Platinum Chip", "credit", "credit", "Visa", "Entry", false],

  ["sbi-aurum", "SBI Card", "AURUM", "credit", "credit", "Mastercard", "Premium", false],
  ["sbi-elite", "SBI Card", "ELITE", "credit", "credit", "Mastercard", "Premium", false],
  ["sbi-prime", "SBI Card", "PRIME", "credit", "credit", "Visa", "Premium", false],
  ["sbi-cashback", "SBI Card", "Cashback", "credit", "credit", "Mastercard", "Cashback", false],
  ["sbi-simplyclick", "SBI Card", "SimplyCLICK", "credit", "credit", "Visa", "Rewards", false],
  ["sbi-simplysave", "SBI Card", "SimplySAVE", "credit", "credit", "Visa", "Rewards", false],
  ["sbi-bpcl-octane", "SBI Card", "BPCL OCTANE", "co-branded", "credit", "Visa", "Co-branded", false],
  ["sbi-irctc-premium", "SBI Card", "IRCTC Premier", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["sbi-tata-neu-infinity", "SBI Card", "Tata Neu Infinity", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["sbi-air-india-signature", "SBI Card", "Air India Signature", "co-branded", "credit", "Visa", "Co-branded", false],
  ["sbi-upi-rupay", "SBI Card", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["idfc-first-wealth", "IDFC FIRST Bank", "FIRST Wealth", "credit", "credit", "Visa", "Premium", false],
  ["idfc-first-select", "IDFC FIRST Bank", "FIRST Select", "credit", "credit", "Visa", "Premium", false],
  ["idfc-first-millennia", "IDFC FIRST Bank", "FIRST Millennia", "credit", "credit", "Visa", "Rewards", false],
  ["idfc-first-wow", "IDFC FIRST Bank", "FIRST WOW", "credit", "credit", "Visa", "Lifetime Free", false],
  ["idfc-first-power-plus", "IDFC FIRST Bank", "FIRST Power+", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["idfc-first-swyp", "IDFC FIRST Bank", "FIRST SWYP", "credit", "credit", "Visa", "Lifestyle", false],
  ["idfc-first-upi-rupay", "IDFC FIRST Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["kotak-white-reserve", "Kotak Mahindra Bank", "White Reserve", "credit", "credit", "Visa", "Premium", false],
  ["kotak-white", "Kotak Mahindra Bank", "White", "credit", "credit", "Visa", "Premium", false],
  ["kotak-zen-signature", "Kotak Mahindra Bank", "Zen Signature", "credit", "credit", "Visa", "Premium", false],
  ["kotak-privy-league", "Kotak Mahindra Bank", "Privy League Signature", "credit", "credit", "Visa", "Premium", false],
  ["kotak-myntra", "Kotak Mahindra Bank", "Myntra", "co-branded", "credit", "Visa", "Co-branded", false],
  ["kotak-indianoil", "Kotak Mahindra Bank", "IndianOil", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["kotak-upi-rupay", "Kotak Mahindra Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["rbl-world-safari", "RBL Bank", "World Safari", "credit", "credit", "Mastercard", "Travel", false],
  ["rbl-world", "RBL Bank", "World", "credit", "credit", "Mastercard", "Premium", false],
  ["rbl-shoprite", "RBL Bank", "ShopRite", "credit", "credit", "Mastercard", "Rewards", false],
  ["rbl-indianoil", "RBL Bank", "IndianOil", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["rbl-supercard", "RBL Bank", "SuperCard", "credit", "credit", "Mastercard", "Rewards", false],
  ["rbl-upi-rupay", "RBL Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["au-zenith-plus", "AU Small Finance Bank", "ZENITH+", "credit", "credit", "Visa", "Premium", false],
  ["au-zenith", "AU Small Finance Bank", "ZENITH", "credit", "credit", "Visa", "Premium", false],
  ["au-vetta", "AU Small Finance Bank", "Vetta", "credit", "credit", "Visa", "Rewards", false],
  ["au-lit", "AU Small Finance Bank", "LIT", "credit", "credit", "Visa", "Flexible", false],
  ["au-ixigo", "AU Small Finance Bank", "ixigo", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["au-xcite", "AU Small Finance Bank", "Xcite", "credit", "credit", "Visa", "Entry", false],
  ["au-upi-rupay", "AU Small Finance Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["amex-platinum", "American Express", "Platinum", "charge", "charge", "American Express", "Premium", false],
  ["amex-platinum-reserve", "American Express", "Platinum Reserve", "credit", "credit", "American Express", "Premium", false],
  ["amex-gold", "American Express", "Gold", "charge", "charge", "American Express", "Rewards", false],
  ["amex-mrcc", "American Express", "Membership Rewards Credit Card", "credit", "credit", "American Express", "Rewards", false],
  ["amex-smartearn", "American Express", "SmartEarn", "credit", "credit", "American Express", "Rewards", false],

  ["indusind-legend", "IndusInd Bank", "Legend", "credit", "credit", "Visa", "Premium", false],
  ["indusind-pinnacle", "IndusInd Bank", "Pinnacle", "credit", "credit", "Visa", "Premium", false],
  ["indusind-eazydiner", "IndusInd Bank", "EazyDiner", "co-branded", "credit", "Visa", "Co-branded", false],
  ["indusind-tiger", "IndusInd Bank", "Tiger", "credit", "credit", "Visa", "Premium", false],
  ["indusind-upi-rupay", "IndusInd Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["hsbc-premier", "HSBC India", "Premier", "credit", "credit", "Visa", "Premium", false],
  ["hsbc-live-plus", "HSBC India", "Live+", "credit", "credit", "Visa", "Cashback", false],
  ["hsbc-cashback", "HSBC India", "Cashback", "credit", "credit", "Visa", "Cashback", false],
  ["hsbc-travelone", "HSBC India", "TravelOne", "credit", "credit", "Mastercard", "Travel", false],

  ["sc-ultimate", "Standard Chartered", "Ultimate", "credit", "credit", "Mastercard", "Premium", false],
  ["sc-easemytrip", "Standard Chartered", "EaseMyTrip", "co-branded", "credit", "Visa", "Co-branded", false],
  ["sc-smart", "Standard Chartered", "Smart", "credit", "credit", "Visa", "Cashback", false],
  ["sc-rewards", "Standard Chartered", "Rewards", "credit", "credit", "Visa", "Rewards", false],
  ["sc-manhattan", "Standard Chartered", "Manhattan", "credit", "credit", "Mastercard", "Rewards", false],

  ["yes-marquee", "YES BANK", "Marquee", "credit", "credit", "Visa", "Premium", false],
  ["yes-reserv", "YES BANK", "Reserv", "credit", "credit", "Visa", "Premium", false],
  ["yes-paisabazaar", "YES BANK", "Paisabazaar PaisaSave", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["yes-upi-rupay", "YES BANK", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["federal-celesta", "Federal Bank", "Celesta", "credit", "credit", "Visa", "Premium", false],
  ["federal-scapia", "Federal Bank", "Scapia", "co-branded", "credit", "Visa", "Travel", false],
  ["federal-imperio", "Federal Bank", "Imperio", "credit", "credit", "Visa", "Premium", false],
  ["federal-upi-rupay", "Federal Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],

  ["onecard-metal", "OneCard", "Metal", "credit", "credit", "Visa", "Metal", false],
  ["onecard-upi-rupay", "OneCard", "UPI RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["bob-eternal", "Bank of Baroda", "Eterna", "credit", "credit", "Mastercard", "Premium", false],
  ["bob-premier", "Bank of Baroda", "Premier", "credit", "credit", "Visa", "Premium", false],
  ["bob-upi-rupay", "Bank of Baroda", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["pnb-rupay-select", "Punjab National Bank", "RuPay Select", "credit", "credit", "RuPay", "Premium", true],
  ["canara-rupay-platinum", "Canara Bank", "RuPay Platinum", "credit", "credit", "RuPay", "Premium", true],
  ["union-rupay-platinum", "Union Bank of India", "RuPay Platinum", "credit", "credit", "RuPay", "Premium", true],
  ["bajaj-finserv-rbl-supercard", "Bajaj Finserv", "RBL SuperCard", "co-branded", "credit", "Mastercard", "Co-branded", false],

  ["hdfc-moneyback-plus", "HDFC", "MoneyBack+", "credit", "credit", "Visa", "Rewards", false],
  ["hdfc-tata-neu-plus-visa", "HDFC", "Tata Neu Plus", "co-branded", "credit", "Visa", "Co-branded", false],
  ["hdfc-tata-neu-infinity-visa", "HDFC", "Tata Neu Infinity", "co-branded", "credit", "Visa", "Co-branded", false],
  ["axis-vistara-signature", "Axis", "Vistara Signature", "co-branded", "credit", "Visa", "Co-branded", false],
  ["axis-vistara-infinite", "Axis", "Vistara Infinite", "co-branded", "credit", "Visa", "Co-branded", false],
  ["axis-samsung-infinite", "Axis", "Samsung Infinite", "co-branded", "credit", "Visa", "Co-branded", false],
  ["icici-expressions-rupay", "ICICI", "Expressions RuPay", "credit", "credit", "RuPay", "Customizable", true],
  ["icici-mmt-platinum", "ICICI", "MakeMyTrip Platinum", "co-branded", "credit", "Visa", "Co-branded", false],
  ["sbi-fd-backed-rupay", "SBI Card", "SimplySAVE RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["sbi-irctc-rupay", "SBI Card", "IRCTC RuPay", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["idfc-first-private", "IDFC FIRST Bank", "FIRST Private", "credit", "credit", "Visa", "Premium", false],
  ["idfc-first-select-rupay", "IDFC FIRST Bank", "FIRST Select RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["kotak-811-dreamdifferent", "Kotak Mahindra Bank", "811 DreamDifferent", "credit", "credit", "Visa", "Entry", false],
  ["kotak-811-rupay", "Kotak Mahindra Bank", "811 RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["rbl-bajaj-finserv-world", "RBL Bank", "Bajaj Finserv World", "co-branded", "credit", "Mastercard", "Co-branded", false],
  ["au-ixigo-visa", "AU Small Finance Bank", "ixigo", "co-branded", "credit", "Visa", "Co-branded", false],
  ["au-vetta-rupay", "AU Small Finance Bank", "Vetta RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["indusind-eazydiner-rupay", "IndusInd Bank", "EazyDiner RuPay", "co-branded", "credit", "RuPay", "Co-branded", true],
  ["yes-kickstarter-rupay", "YES BANK", "Kiwi RuPay", "co-branded", "credit", "RuPay", "UPI", true],
  ["federal-scapia-rupay", "Federal Bank", "Scapia RuPay", "co-branded", "credit", "RuPay", "Travel", true],
  ["onecard-rupay", "OneCard", "RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["bob-easy-rupay", "Bank of Baroda", "Easy RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["idbi-wealth-rupay", "IDBI Bank", "Wealth RuPay", "credit", "credit", "RuPay", "Premium", true],
  ["idbi-classic-rupay", "IDBI Bank", "Classic RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["dbs-eminence", "DBS Bank India", "Eminence", "credit", "credit", "Visa", "Premium", false],
  ["dbs-vantage", "DBS Bank India", "Vantage", "credit", "credit", "Visa", "Premium", false],
  ["south-indian-bank-rupay", "South Indian Bank", "RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["karnataka-bank-rupay", "Karnataka Bank", "RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["fi-federal-debit", "Fi", "Federal Debit", "debit", "debit", "Visa", "Digital", false],
  ["fi-federal-rupay-credit", "Fi", "Federal RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["jupiter-edge-csb-debit", "Jupiter", "Edge CSB Debit", "debit", "debit", "Visa", "Digital", false],
  ["jupiter-edge-rupay", "Jupiter", "Edge RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["niyo-global-sbm-debit", "Niyo", "Global SBM Debit", "debit", "debit", "Visa", "Travel", false],
  ["niyo-equitas-debit", "Niyo", "Equitas Debit", "debit", "debit", "Visa", "Digital", false],
  ["slice-rupay", "Slice", "RuPay", "credit", "credit", "RuPay", "UPI", true],
  ["super-money-rupay", "super.money", "RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["uni-nx-wave", "Uni", "NX Wave", "credit", "credit", "Visa", "Digital", false],
  ["fibe-rupay", "Fibe", "RuPay Credit Card", "credit", "credit", "RuPay", "UPI", true],
  ["zolve-global-debit", "Zolve", "Global Debit", "debit", "debit", "Visa", "Travel", false],
  ["hdfc-easyshop-platinum-debit", "HDFC", "EasyShop Platinum Debit", "debit", "debit", "Visa", "Platinum", false],
  ["hdfc-millennia-debit", "HDFC", "Millennia Debit", "debit", "debit", "Visa", "Rewards", false],
  ["hdfc-infinia-debit", "HDFC", "Platinum Debit", "debit", "debit", "Visa", "Premium", false],
  ["axis-burgundy-debit", "Axis", "Burgundy Debit", "debit", "debit", "Visa", "Premium", false],
  ["axis-priority-debit", "Axis", "Priority Debit", "debit", "debit", "Visa", "Premium", false],
  ["axis-prestige-debit", "Axis", "Prestige Debit", "debit", "debit", "Mastercard", "Premium", false],
  ["icici-coral-debit", "ICICI", "Coral Debit", "debit", "debit", "Visa", "Rewards", false],
  ["icici-sapphiro-debit", "ICICI", "Sapphiro Debit", "debit", "debit", "Visa", "Premium", false],
  ["sbi-platinum-debit", "SBI", "Platinum International Debit", "debit", "debit", "Visa", "Premium", false],
  ["sbi-global-debit", "SBI", "Global International Debit", "debit", "debit", "Visa", "Travel", false],
  ["kotak-privy-debit", "Kotak Mahindra Bank", "Privy League Debit", "debit", "debit", "Visa", "Premium", false],
  ["kotak-811-debit", "Kotak Mahindra Bank", "811 Debit", "debit", "debit", "Visa", "Digital", false],
  ["idfc-first-wealth-debit", "IDFC FIRST Bank", "Wealth Debit", "debit", "debit", "Visa", "Premium", false],
  ["au-platinum-debit", "AU Small Finance Bank", "Platinum Debit", "debit", "debit", "Visa", "Premium", false],
  ["indusind-world-debit", "IndusInd Bank", "World Debit", "debit", "debit", "Visa", "Premium", false],
  ["federal-imperio-debit", "Federal Bank", "Imperio Debit", "debit", "debit", "Visa", "Premium", false],
  ["hsbc-premier-debit", "HSBC India", "Premier Debit", "debit", "debit", "Visa", "Premium", false],
  ["sc-platinum-debit", "Standard Chartered", "Platinum Debit", "debit", "debit", "Visa", "Premium", false],
  ["bob-platinum-debit", "Bank of Baroda", "Platinum Debit", "debit", "debit", "Visa", "Premium", false],
  ["pnb-platinum-debit", "Punjab National Bank", "Platinum Debit", "debit", "debit", "RuPay", "Premium", true],
  ["canara-world-debit", "Canara Bank", "World Debit", "debit", "debit", "Mastercard", "Premium", false],
  ["union-platinum-debit", "Union Bank of India", "Platinum Debit", "debit", "debit", "RuPay", "Premium", true],

  // Payments banks: the "small-scale UPI card partnered with a bank" segment — basic
  // RuPay debit cards issued against a payments-bank wallet account, not a full savings
  // account.
  ["paytm-payments-bank-rupay-debit", "Paytm Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "Basic", true],
  ["airtel-payments-bank-rupay-debit", "Airtel Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "Basic", true],
  ["ippb-rupay-debit", "India Post Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "Basic", true],
  ["fino-payments-bank-rupay-debit", "Fino Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "Basic", true],
  ["nsdl-payments-bank-rupay-debit", "NSDL Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "Basic", true],
  ["freo-rupay", "Freo", "RuPay Credit Card", "co-branded", "credit", "RuPay", "UPI", true],

  ["hdfc-regalia", "HDFC", "Regalia", "credit", "credit", "Visa", "Rewards", false],
  ["hdfc-diners-privilege", "HDFC", "Diners Club Privilege", "credit", "credit", "Diners Club", "Rewards", false],

  ["boi-rupay-platinum-debit", "Bank of India", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
  ["central-bank-rupay-platinum-debit", "Central Bank of India", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
  ["indian-bank-rupay-platinum-debit", "Indian Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
  ["iob-rupay-platinum-debit", "Indian Overseas Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
  ["uco-bank-rupay-platinum-debit", "UCO Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
  ["karur-vysya-rupay-platinum-debit", "Karur Vysya Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
  ["equitas-sfb-rupay-platinum-debit", "Equitas Small Finance Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
  ["ujjivan-sfb-rupay-platinum-debit", "Ujjivan Small Finance Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "Platinum", true],
];

function toCardCatalogRecord(seed: CardSeedTuple) {
  const [id, issuer, product_name, card_type, card_category, network, variant, upi_enabled] = seed;

  return {
    id,
    issuer,
    product_name,
    card_type,
    card_category,
    network,
    variant,
    country: "IN",
    upi_enabled,
    use_cases: inferUseCases(issuer, product_name, card_category, upi_enabled),
    active: true,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
  };
}

function inferUseCases(
  issuer: string,
  productName: string,
  cardCategory: CardSeedTuple[4],
  upiEnabled: boolean,
): string[] {
  const searchable = `${issuer} ${productName}`.toLowerCase();
  const useCases = new Set<string>([cardCategory === "debit" ? "daily-banking" : "general-spend"]);

  if (upiEnabled) {
    useCases.add("upi");
  }
  if (/travel|atlas|air india|ixigo|scapia|world safari|platinum|reserve|emeralde|infinia|wealth|magnus/i.test(searchable)) {
    useCases.add("travel");
  }
  if (/cashback|cash back|ace|millennia|swiggy|amazon|flipkart|airtel|live\+|smart/i.test(searchable)) {
    useCases.add("cashback");
  }
  if (/fuel|indianoil|bpcl|hpcl/i.test(searchable)) {
    useCases.add("fuel");
  }
  if (/dining|eazydiner|tata neu|myntra|swiggy|lifestyle|coral|rubyx/i.test(searchable)) {
    useCases.add("lifestyle");
  }
  if (/irctc|railway/i.test(searchable)) {
    useCases.add("railway");
  }
  if (/debit|daily/i.test(searchable) || cardCategory === "debit") {
    useCases.add("daily-banking");
  }

  return [...useCases];
}

const DEFAULT_CATALOG = CARD_CATALOG_SEED.map(toCardCatalogRecord);

export { CARD_CATALOG_SEED, DEFAULT_CATALOG };
export type { CardSeedTuple };
