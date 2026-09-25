type CardSeedTuple = [
  id: string,
  issuer: string,
  product_name: string,
  card_type: "credit" | "debit" | "charge" | "prepaid",
  card_category: "credit" | "debit" | "prepaid" | "charge",
  network: string,
  segment: "retail" | "co-branded" | "corporate",
  variant: string | null,
  upi_enabled: boolean,
];

const CARD_CATALOG_SEED: CardSeedTuple[] = [
  ["hdfc-infinia", "HDFC", "Infinia", "credit", "credit", "Mastercard", "retail", "Infinite", false],
  ["hdfc-regalia-gold", "HDFC", "Regalia Gold", "credit", "credit", "Visa", "retail", "Gold", false],
  ["hdfc-diners-black-metal", "HDFC", "Diners Club Black Metal", "credit", "credit", "Diners Club", "retail", "Metal", false],
  ["hdfc-millennia", "HDFC", "Millennia", "credit", "credit", "Visa", "retail", null, false],
  ["hdfc-swiggy", "HDFC", "Swiggy", "credit", "credit", "Mastercard", "co-branded", null, false],
  ["hdfc-tata-neu-infinity", "HDFC", "Tata Neu Infinity", "credit", "credit", "RuPay", "co-branded", null, true],
  ["hdfc-tata-neu-plus", "HDFC", "Tata Neu Plus", "credit", "credit", "RuPay", "co-branded", null, true],
  ["hdfc-indianoil", "HDFC", "IndianOil", "credit", "credit", "RuPay", "co-branded", null, true],
  ["hdfc-pixel-play", "HDFC", "PIXEL Play", "credit", "credit", "Visa", "retail", null, false],
  ["hdfc-upi-rupay", "HDFC", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["axis-magnus", "Axis", "Magnus", "credit", "credit", "Visa", "retail", "Premium", false],
  ["axis-magnus-burgundy", "Axis", "Magnus for Burgundy", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["axis-atlas", "Axis", "Atlas", "credit", "credit", "Visa", "retail", null, false],
  ["axis-reserve", "Axis", "Reserve", "credit", "credit", "Visa", "retail", "Premium", false],
  ["axis-select", "Axis", "Select", "credit", "credit", "Visa", "retail", "Premium", false],
  ["axis-privilege", "Axis", "Privilege", "credit", "credit", "Visa", "retail", null, false],
  ["axis-ace", "Axis", "ACE", "credit", "credit", "Visa", "retail", null, false],
  ["axis-airtel", "Axis", "Airtel", "credit", "credit", "Mastercard", "co-branded", null, false],
  ["axis-flipkart", "Axis", "Flipkart", "credit", "credit", "Visa", "co-branded", null, false],
  ["axis-myzone", "Axis", "My Zone", "credit", "credit", "Visa", "retail", null, false],
  ["axis-neo", "Axis", "Neo", "credit", "credit", "Visa", "retail", "Entry", false],
  ["axis-indianoil", "Axis", "IndianOil", "credit", "credit", "RuPay", "co-branded", null, true],
  ["axis-upi-rupay", "Axis", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["icici-emeralde-private-metal", "ICICI", "Emeralde Private Metal", "credit", "credit", "Mastercard", "retail", "Metal", false],
  ["icici-emeralde", "ICICI", "Emeralde", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["icici-sapphiro", "ICICI", "Sapphiro", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["icici-rubxy", "ICICI", "Rubyx", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["icici-coral", "ICICI", "Coral", "credit", "credit", "Visa", "retail", null, false],
  ["icici-amazon-pay", "ICICI", "Amazon Pay", "credit", "credit", "Visa", "co-branded", null, false],
  ["icici-hpcl-super-saver", "ICICI", "HPCL Super Saver", "credit", "credit", "RuPay", "co-branded", null, true],
  ["icici-mmt", "ICICI", "MakeMyTrip", "credit", "credit", "Visa", "co-branded", null, false],
  ["icici-manchester-united", "ICICI", "Manchester United", "credit", "credit", "Visa", "co-branded", null, false],
  ["icici-upi-rupay", "ICICI", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["icici-platinum-chip", "ICICI", "Platinum Chip", "credit", "credit", "Visa", "retail", "Entry", false],

  ["sbi-aurum", "SBI Card", "AURUM", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["sbi-elite", "SBI Card", "ELITE", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["sbi-prime", "SBI Card", "PRIME", "credit", "credit", "Visa", "retail", "Premium", false],
  ["sbi-cashback", "SBI Card", "Cashback", "credit", "credit", "Mastercard", "retail", null, false],
  ["sbi-simplyclick", "SBI Card", "SimplyCLICK", "credit", "credit", "Visa", "retail", null, false],
  ["sbi-simplysave", "SBI Card", "SimplySAVE", "credit", "credit", "Visa", "retail", null, false],
  ["sbi-bpcl-octane", "SBI Card", "BPCL OCTANE", "credit", "credit", "Visa", "co-branded", null, false],
  ["sbi-irctc-premium", "SBI Card", "IRCTC Premier", "credit", "credit", "RuPay", "co-branded", null, true],
  ["sbi-tata-neu-infinity", "SBI Card", "Tata Neu Infinity", "credit", "credit", "RuPay", "co-branded", null, true],
  ["sbi-air-india-signature", "SBI Card", "Air India Signature", "credit", "credit", "Visa", "co-branded", null, false],
  ["sbi-upi-rupay", "SBI Card", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["idfc-first-wealth", "IDFC FIRST Bank", "FIRST Wealth", "credit", "credit", "Visa", "retail", "Premium", false],
  ["idfc-first-select", "IDFC FIRST Bank", "FIRST Select", "credit", "credit", "Visa", "retail", "Premium", false],
  ["idfc-first-millennia", "IDFC FIRST Bank", "FIRST Millennia", "credit", "credit", "Visa", "retail", null, false],
  ["idfc-first-wow", "IDFC FIRST Bank", "FIRST WOW", "credit", "credit", "Visa", "retail", null, false],
  ["idfc-first-power-plus", "IDFC FIRST Bank", "FIRST Power+", "credit", "credit", "RuPay", "co-branded", null, true],
  ["idfc-first-swyp", "IDFC FIRST Bank", "FIRST SWYP", "credit", "credit", "Visa", "retail", null, false],
  ["idfc-first-upi-rupay", "IDFC FIRST Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["kotak-white-reserve", "Kotak Mahindra Bank", "White Reserve", "credit", "credit", "Visa", "retail", "Premium", false],
  ["kotak-white", "Kotak Mahindra Bank", "White", "credit", "credit", "Visa", "retail", "Premium", false],
  ["kotak-zen-signature", "Kotak Mahindra Bank", "Zen Signature", "credit", "credit", "Visa", "retail", "Premium", false],
  ["kotak-privy-league", "Kotak Mahindra Bank", "Privy League Signature", "credit", "credit", "Visa", "retail", "Premium", false],
  ["kotak-myntra", "Kotak Mahindra Bank", "Myntra", "credit", "credit", "Visa", "co-branded", null, false],
  ["kotak-indianoil", "Kotak Mahindra Bank", "IndianOil", "credit", "credit", "RuPay", "co-branded", null, true],
  ["kotak-upi-rupay", "Kotak Mahindra Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["rbl-world-safari", "RBL Bank", "World Safari", "credit", "credit", "Mastercard", "retail", null, false],
  ["rbl-world", "RBL Bank", "World", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["rbl-shoprite", "RBL Bank", "ShopRite", "credit", "credit", "Mastercard", "retail", null, false],
  ["rbl-indianoil", "RBL Bank", "IndianOil", "credit", "credit", "RuPay", "co-branded", null, true],
  ["rbl-supercard", "RBL Bank", "SuperCard", "credit", "credit", "Mastercard", "retail", null, false],
  ["rbl-upi-rupay", "RBL Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["au-zenith-plus", "AU Small Finance Bank", "ZENITH+", "credit", "credit", "Visa", "retail", "Premium", false],
  ["au-zenith", "AU Small Finance Bank", "ZENITH", "credit", "credit", "Visa", "retail", "Premium", false],
  ["au-vetta", "AU Small Finance Bank", "Vetta", "credit", "credit", "Visa", "retail", null, false],
  ["au-lit", "AU Small Finance Bank", "LIT", "credit", "credit", "Visa", "retail", null, false],
  ["au-ixigo", "AU Small Finance Bank", "ixigo", "credit", "credit", "RuPay", "co-branded", null, true],
  ["au-xcite", "AU Small Finance Bank", "Xcite", "credit", "credit", "Visa", "retail", "Entry", false],
  ["au-upi-rupay", "AU Small Finance Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["amex-platinum", "American Express", "Platinum", "charge", "charge", "American Express", "retail", "Premium", false],
  ["amex-platinum-reserve", "American Express", "Platinum Reserve", "credit", "credit", "American Express", "retail", "Premium", false],
  ["amex-gold", "American Express", "Gold", "charge", "charge", "American Express", "retail", "Gold", false],
  ["amex-mrcc", "American Express", "Membership Rewards Credit Card", "credit", "credit", "American Express", "retail", null, false],
  ["amex-smartearn", "American Express", "SmartEarn", "credit", "credit", "American Express", "retail", null, false],

  ["indusind-legend", "IndusInd Bank", "Legend", "credit", "credit", "Visa", "retail", "Premium", false],
  ["indusind-pinnacle", "IndusInd Bank", "Pinnacle", "credit", "credit", "Visa", "retail", "Premium", false],
  ["indusind-eazydiner", "IndusInd Bank", "EazyDiner", "credit", "credit", "Visa", "co-branded", null, false],
  ["indusind-tiger", "IndusInd Bank", "Tiger", "credit", "credit", "Visa", "retail", "Premium", false],
  ["indusind-upi-rupay", "IndusInd Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["hsbc-premier", "HSBC India", "Premier", "credit", "credit", "Visa", "retail", "Premium", false],
  ["hsbc-live-plus", "HSBC India", "Live+", "credit", "credit", "Visa", "retail", null, false],
  ["hsbc-cashback", "HSBC India", "Cashback", "credit", "credit", "Visa", "retail", null, false],
  ["hsbc-travelone", "HSBC India", "TravelOne", "credit", "credit", "Mastercard", "retail", "Premium", false],

  ["sc-ultimate", "Standard Chartered", "Ultimate", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["sc-easemytrip", "Standard Chartered", "EaseMyTrip", "credit", "credit", "Visa", "co-branded", null, false],
  ["sc-smart", "Standard Chartered", "Smart", "credit", "credit", "Visa", "retail", null, false],
  ["sc-rewards", "Standard Chartered", "Rewards", "credit", "credit", "Visa", "retail", null, false],
  ["sc-manhattan", "Standard Chartered", "Manhattan", "credit", "credit", "Mastercard", "retail", null, false],

  ["yes-marquee", "YES BANK", "Marquee", "credit", "credit", "Visa", "retail", "Premium", false],
  ["yes-reserv", "YES BANK", "Reserv", "credit", "credit", "Visa", "retail", "Premium", false],
  ["yes-paisabazaar", "YES BANK", "Paisabazaar PaisaSave", "credit", "credit", "RuPay", "co-branded", null, true],
  ["yes-upi-rupay", "YES BANK", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["federal-celesta", "Federal Bank", "Celesta", "credit", "credit", "Visa", "retail", "Premium", false],
  ["federal-scapia", "Federal Bank", "Scapia", "credit", "credit", "Visa", "co-branded", null, false],
  ["federal-imperio", "Federal Bank", "Imperio", "credit", "credit", "Visa", "retail", "Premium", false],
  ["federal-upi-rupay", "Federal Bank", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["onecard-metal", "OneCard", "Metal", "credit", "credit", "Visa", "retail", "Metal", false],
  ["onecard-upi-rupay", "OneCard", "UPI RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["bob-eternal", "Bank of Baroda", "Eterna", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["bob-premier", "Bank of Baroda", "Premier", "credit", "credit", "Visa", "retail", "Premium", false],
  ["bob-upi-rupay", "Bank of Baroda", "UPI RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["pnb-rupay-select", "Punjab National Bank", "RuPay Select", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["canara-rupay-platinum", "Canara Bank", "RuPay Platinum", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["union-rupay-platinum", "Union Bank of India", "RuPay Platinum", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["bajaj-finserv-rbl-supercard", "Bajaj Finserv", "RBL SuperCard", "credit", "credit", "Mastercard", "co-branded", null, false],

  ["hdfc-moneyback-plus", "HDFC", "MoneyBack+", "credit", "credit", "Visa", "retail", null, false],
  ["hdfc-tata-neu-plus-visa", "HDFC", "Tata Neu Plus", "credit", "credit", "Visa", "co-branded", null, false],
  ["hdfc-tata-neu-infinity-visa", "HDFC", "Tata Neu Infinity", "credit", "credit", "Visa", "co-branded", null, false],
  ["axis-vistara-signature", "Axis", "Vistara Signature", "credit", "credit", "Visa", "co-branded", "Signature", false],
  ["axis-vistara-infinite", "Axis", "Vistara Infinite", "credit", "credit", "Visa", "co-branded", "Infinite", false],
  ["axis-samsung-infinite", "Axis", "Samsung Infinite", "credit", "credit", "Visa", "co-branded", "Infinite", false],
  ["icici-expressions-rupay", "ICICI", "Expressions RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["icici-mmt-platinum", "ICICI", "MakeMyTrip Platinum", "credit", "credit", "Visa", "co-branded", "Platinum", false],
  ["sbi-fd-backed-rupay", "SBI Card", "SimplySAVE RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["sbi-irctc-rupay", "SBI Card", "IRCTC RuPay", "credit", "credit", "RuPay", "co-branded", null, true],
  ["idfc-first-private", "IDFC FIRST Bank", "FIRST Private", "credit", "credit", "Visa", "retail", "Premium", false],
  ["idfc-first-select-rupay", "IDFC FIRST Bank", "FIRST Select RuPay", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["kotak-811-dreamdifferent", "Kotak Mahindra Bank", "811 DreamDifferent", "credit", "credit", "Visa", "retail", "Entry", false],
  ["kotak-811-rupay", "Kotak Mahindra Bank", "811 RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["rbl-bajaj-finserv-world", "RBL Bank", "Bajaj Finserv World", "credit", "credit", "Mastercard", "co-branded", null, false],
  ["au-ixigo-visa", "AU Small Finance Bank", "ixigo", "credit", "credit", "Visa", "co-branded", null, false],
  ["au-vetta-rupay", "AU Small Finance Bank", "Vetta RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["indusind-eazydiner-rupay", "IndusInd Bank", "EazyDiner RuPay", "credit", "credit", "RuPay", "co-branded", null, true],
  // Correction: Kiwi is a fintech app partnered with Axis Bank for RuPay-on-UPI credit,
  // not a YES BANK product — matches the Fi/Jupiter/Niyo/Freo pattern of modeling the
  // fintech app as its own issuer. The old "yes-kickstarter-rupay" id/attribution was
  // wrong; if it already reached prod via seed:prod, deactivate that stale row by hand:
  //   update catalog_items set active = false
  //   where name = 'Kiwi RuPay' and issuer_id = (select id from issuers where slug = 'yes-bank');
  ["kiwi-rupay-credit", "Kiwi", "RuPay Credit Card", "credit", "credit", "RuPay", "co-branded", null, true],
  ["federal-scapia-rupay", "Federal Bank", "Scapia RuPay", "credit", "credit", "RuPay", "co-branded", null, true],
  ["onecard-rupay", "OneCard", "RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["bob-easy-rupay", "Bank of Baroda", "Easy RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["idbi-wealth-rupay", "IDBI Bank", "Wealth RuPay", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["idbi-classic-rupay", "IDBI Bank", "Classic RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["dbs-eminence", "DBS Bank India", "Eminence", "credit", "credit", "Visa", "retail", "Premium", false],
  ["dbs-vantage", "DBS Bank India", "Vantage", "credit", "credit", "Visa", "retail", "Premium", false],
  ["south-indian-bank-rupay", "South Indian Bank", "RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["karnataka-bank-rupay", "Karnataka Bank", "RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["fi-federal-debit", "Fi", "Federal Debit", "debit", "debit", "Visa", "retail", "Platinum", false],
  ["fi-federal-rupay-credit", "Fi", "Federal RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["jupiter-edge-csb-debit", "Jupiter", "Edge CSB Debit", "debit", "debit", "Visa", "retail", "Platinum", false],
  ["jupiter-edge-rupay", "Jupiter", "Edge RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["niyo-global-sbm-debit", "Niyo", "Global SBM Debit", "debit", "debit", "Visa", "retail", "Signature", false],
  ["niyo-equitas-debit", "Niyo", "Equitas Debit", "debit", "debit", "Visa", "retail", "Platinum", false],
  ["slice-rupay", "Slice", "RuPay", "credit", "credit", "RuPay", "retail", null, true],
  ["super-money-rupay", "super.money", "RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["uni-nx-wave", "Uni", "NX Wave", "credit", "credit", "Visa", "retail", null, false],
  ["fibe-rupay", "Fibe", "RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["zolve-global-debit", "Zolve", "Global Debit", "debit", "debit", "Visa", "retail", null, false],
  ["hdfc-easyshop-platinum-debit", "HDFC", "EasyShop Platinum Debit", "debit", "debit", "Visa", "retail", "Platinum", false],
  ["hdfc-millennia-debit", "HDFC", "Millennia Debit", "debit", "debit", "Visa", "retail", null, false],
  ["hdfc-infinia-debit", "HDFC", "Platinum Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["axis-burgundy-debit", "Axis", "Burgundy Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["axis-priority-debit", "Axis", "Priority Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["axis-prestige-debit", "Axis", "Prestige Debit", "debit", "debit", "Mastercard", "retail", "Premium", false],
  ["icici-coral-debit", "ICICI", "Coral Debit", "debit", "debit", "Visa", "retail", null, false],
  ["icici-sapphiro-debit", "ICICI", "Sapphiro Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["sbi-platinum-debit", "SBI", "Platinum International Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["sbi-global-debit", "SBI", "Global International Debit", "debit", "debit", "Visa", "retail", null, false],
  ["kotak-privy-debit", "Kotak Mahindra Bank", "Privy League Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["kotak-811-debit", "Kotak Mahindra Bank", "811 Debit", "debit", "debit", "Visa", "retail", null, false],
  ["idfc-first-wealth-debit", "IDFC FIRST Bank", "Wealth Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["au-platinum-debit", "AU Small Finance Bank", "Platinum Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["indusind-world-debit", "IndusInd Bank", "World Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["federal-imperio-debit", "Federal Bank", "Imperio Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["hsbc-premier-debit", "HSBC India", "Premier Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["sc-platinum-debit", "Standard Chartered", "Platinum Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["bob-platinum-debit", "Bank of Baroda", "Platinum Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["pnb-platinum-debit", "Punjab National Bank", "Platinum Debit", "debit", "debit", "RuPay", "retail", "Premium", true],
  ["canara-world-debit", "Canara Bank", "World Debit", "debit", "debit", "Mastercard", "retail", "Premium", false],
  ["union-platinum-debit", "Union Bank of India", "Platinum Debit", "debit", "debit", "RuPay", "retail", "Premium", true],

  // Payments banks: the "small-scale UPI card partnered with a bank" segment — basic
  // RuPay debit cards issued against a payments-bank wallet account, not a full savings
  // account.
  ["paytm-payments-bank-rupay-debit", "Paytm Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "retail", "Basic", true],
  ["airtel-payments-bank-rupay-debit", "Airtel Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "retail", "Basic", true],
  ["ippb-rupay-debit", "India Post Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "retail", "Basic", true],
  ["fino-payments-bank-rupay-debit", "Fino Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "retail", "Basic", true],
  ["nsdl-payments-bank-rupay-debit", "NSDL Payments Bank", "RuPay Debit Card", "debit", "debit", "RuPay", "retail", "Basic", true],
  ["freo-rupay", "Freo", "RuPay Credit Card", "credit", "credit", "RuPay", "co-branded", null, true],

  ["hdfc-regalia", "HDFC", "Regalia", "credit", "credit", "Visa", "retail", null, false],
  ["hdfc-diners-privilege", "HDFC", "Diners Club Privilege", "credit", "credit", "Diners Club", "retail", null, false],

  ["boi-rupay-platinum-debit", "Bank of India", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["central-bank-rupay-platinum-debit", "Central Bank of India", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["indian-bank-rupay-platinum-debit", "Indian Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["iob-rupay-platinum-debit", "Indian Overseas Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["uco-bank-rupay-platinum-debit", "UCO Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["karur-vysya-rupay-platinum-debit", "Karur Vysya Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["equitas-sfb-rupay-platinum-debit", "Equitas Small Finance Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["ujjivan-sfb-rupay-platinum-debit", "Ujjivan Small Finance Bank", "RuPay Platinum Debit", "debit", "debit", "RuPay", "retail", "Platinum", true],

  // Round 2 (issue #23): verified via official bank sites / press releases — corporate
  // and business cards (tagged via `variant`, no dedicated schema column), plus
  // remaining real variants across issuers already tracked above.
  ["hdfc-bizfirst", "HDFC", "BizFirst", "credit", "credit", "Visa", "corporate", null, false],
  ["hdfc-bizgrow", "HDFC", "BizGrow", "credit", "credit", "Visa", "corporate", null, false],
  ["hdfc-bizpower", "HDFC", "BizPower", "credit", "credit", "Visa", "corporate", null, false],
  ["hdfc-bizblack", "HDFC", "BizBlack Metal Edition", "credit", "credit", "Diners Club", "corporate", null, false],
  ["hdfc-upi-rupay-biz", "HDFC", "UPI RuPay Biz Credit Card", "credit", "credit", "RuPay", "corporate", null, true],
  ["hdfc-business-regalia", "HDFC", "Business Regalia", "credit", "credit", "Visa", "corporate", null, false],
  ["hdfc-business-regalia-first", "HDFC", "Business Regalia First", "credit", "credit", "Visa", "corporate", null, false],
  ["hdfc-regalia-first", "HDFC", "Regalia First", "credit", "credit", "Visa", "retail", null, false],
  ["hdfc-marriott-bonvoy", "HDFC", "Marriott Bonvoy", "credit", "credit", "Diners Club", "co-branded", null, false],

  ["icici-corporate-gold", "ICICI", "Corporate Gold", "credit", "credit", "Visa", "corporate", "Gold", false],
  ["icici-corporate-platinum", "ICICI", "Corporate Platinum", "credit", "credit", "Mastercard", "corporate", "Platinum", false],
  ["icici-rubyx-debit", "ICICI", "Rubyx Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["icici-expressions-debit", "ICICI", "Expressions Debit", "debit", "debit", "Mastercard", "retail", null, false],

  ["axis-primus", "Axis", "Primus", "credit", "credit", "Visa", "retail", "Premium", false],
  ["axis-corporate-liability", "Axis", "Corporate Credit Card with Corporate Liability", "credit", "credit", "Visa", "corporate", null, false],
  ["axis-executive-corporate", "Axis", "Executive Corporate Credit Card", "credit", "credit", "Mastercard", "corporate", null, false],
  ["axis-rewards", "Axis", "REWARDS", "credit", "credit", "Visa", "retail", null, false],
  ["axis-horizon-mastercard", "Axis", "Horizon", "credit", "credit", "Mastercard", "retail", null, false],
  ["axis-horizon-visa", "Axis", "Horizon", "credit", "credit", "Visa", "retail", null, false],

  ["kotak-biz", "Kotak Mahindra Bank", "Biz Credit Card", "credit", "credit", "Visa", "corporate", null, false],
  ["kotak-corporate-platinum", "Kotak Mahindra Bank", "Corporate Platinum Credit Card", "credit", "credit", "Visa", "corporate", "Platinum", false],
  ["kotak-solitaire-business", "Kotak Mahindra Bank", "Solitaire Business Credit Card", "credit", "credit", "Visa", "corporate", "Invite-only", false],
  ["kotak-business-power-platinum-debit", "Kotak Mahindra Bank", "Business Power Platinum Debit Card", "debit", "debit", "Visa", "corporate", "Platinum", false],

  ["idfc-first-mayura", "IDFC FIRST Bank", "Mayura", "credit", "credit", "Mastercard", "retail", "Metal", false],
  ["idfc-first-ashva", "IDFC FIRST Bank", "Ashva", "credit", "credit", "Visa", "retail", "Metal", false],
  ["idfc-first-indigo-dual-mastercard", "IDFC FIRST Bank", "IndiGo Dual", "credit", "credit", "Mastercard", "co-branded", null, false],
  ["idfc-first-indigo-dual-rupay", "IDFC FIRST Bank", "IndiGo Dual", "credit", "credit", "RuPay", "co-branded", null, true],
  ["idfc-first-business-multiplier", "IDFC FIRST Bank", "Business Multiplier", "credit", "credit", "Visa", "corporate", null, false],
  ["idfc-first-business-max", "IDFC FIRST Bank", "Business Max", "credit", "credit", "Visa", "corporate", null, false],
  ["idfc-first-private-infinite-debit", "IDFC FIRST Bank", "FIRST Private Infinite", "debit", "debit", "Visa", "retail", "Metal", false],
  ["idfc-first-select-debit", "IDFC FIRST Bank", "FIRST Select Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["idfc-first-business-debit", "IDFC FIRST Bank", "Visa Signature Business Debit Card", "debit", "debit", "Visa", "corporate", "Signature", false],

  ["amex-corporate-platinum", "American Express", "Platinum Corporate Card", "charge", "charge", "American Express", "corporate", "Platinum", false],
  ["amex-corporate-gold", "American Express", "Gold Corporate Card", "charge", "charge", "American Express", "corporate", "Gold", false],

  ["hsbc-visa-platinum", "HSBC India", "Visa Platinum", "credit", "credit", "Visa", "retail", "Entry", false],
  ["hsbc-rupay-platinum", "HSBC India", "RuPay Platinum", "credit", "credit", "RuPay", "retail", null, true],
  ["hsbc-rupay-cashback", "HSBC India", "RuPay Cashback", "credit", "credit", "RuPay", "retail", null, true],

  ["sc-digismart", "Standard Chartered", "DigiSmart", "credit", "credit", "Visa", "retail", null, false],

  ["dbs-infinite-debit", "DBS Bank India", "Treasures Infinite Debit", "debit", "debit", "Visa", "retail", "Premium", false],
  ["dbs-superx", "DBS Bank India", "SuperX", "credit", "credit", "Visa", "retail", null, false],
  ["dbs-superx-plus", "DBS Bank India", "SuperX Plus", "credit", "credit", "Visa", "retail", null, false],

  ["bob-select", "Bank of Baroda", "Select", "credit", "credit", "Visa", "retail", null, false],
  ["bob-tiara", "Bank of Baroda", "Tiara", "credit", "credit", "RuPay", "retail", null, true],
  ["bob-corporate-rupay", "Bank of Baroda", "BOBCARD Corporate", "credit", "credit", "RuPay", "corporate", null, true],
  ["bob-corporate-premium", "Bank of Baroda", "Corporate Premium Credit Card", "credit", "credit", "Visa", "corporate", "Premium", false],

  ["suryoday-sfb-rupay-select-credit", "Suryoday Small Finance Bank", "RuPay Select Credit Card", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["suryoday-sfb-rupay-platinum-credit", "Suryoday Small Finance Bank", "RuPay Platinum Credit Card", "credit", "credit", "RuPay", "retail", "Platinum", true],
  ["suryoday-sfb-rupay-select-debit", "Suryoday Small Finance Bank", "RuPay Select Debit Card", "debit", "debit", "RuPay", "retail", "Premium", true],
  ["suryoday-sfb-rupay-platinum-debit", "Suryoday Small Finance Bank", "RuPay Platinum Debit Card", "debit", "debit", "RuPay", "retail", "Platinum", true],

  ["jana-sfb-rupay-select-debit", "Jana Small Finance Bank", "RuPay Select Debit Card", "debit", "debit", "RuPay", "retail", "Premium", true],

  ["esaf-sfb-rupay-platinum-debit", "ESAF Small Finance Bank", "Platinum RuPay Debit Card", "debit", "debit", "RuPay", "retail", "Platinum", true],
  ["esaf-sfb-rupay-classic-debit", "ESAF Small Finance Bank", "Classic RuPay Debit Card", "debit", "debit", "RuPay", "retail", "Basic", true],
  ["esaf-sfb-inori-rupay-platinum-credit", "ESAF Small Finance Bank", "Inori RuPay Platinum Credit Card", "credit", "credit", "RuPay", "retail", null, true],

  ["unity-sfb-roarbank-rupay", "Unity Small Finance Bank", "RoarBank RuPay Credit Card", "credit", "credit", "RuPay", "co-branded", null, true],
  ["unity-sfb-bharatpe-rupay", "Unity Small Finance Bank", "BharatPe RuPay Credit Card", "credit", "credit", "RuPay", "co-branded", null, true],

  ["lazypay-lazycard", "LazyPay", "LazyCard", "prepaid", "prepaid", "Visa", "co-branded", "Platinum", false],

  ["sbi-miles", "SBI Card", "MILES", "credit", "credit", "Visa", "retail", null, false],
  ["sbi-miles-prime", "SBI Card", "MILES PRIME", "credit", "credit", "Visa", "retail", null, false],
  ["sbi-pulse", "SBI Card", "PULSE", "credit", "credit", "Visa", "retail", null, false],
  ["sbi-unnati", "SBI Card", "Unnati", "credit", "credit", "Visa", "retail", "Entry", false],
  ["sbi-doctors", "SBI Card", "Doctor's SBI Card", "credit", "credit", "Visa", "retail", null, false],
  ["sbi-yatra", "SBI Card", "Yatra SBI Card", "credit", "credit", "Visa", "co-branded", null, false],
  ["sbi-signature-corporate", "SBI Card", "Signature Corporate Card", "credit", "credit", "Visa", "corporate", null, false],
  ["sbi-platinum-corporate", "SBI Card", "Platinum Corporate Card", "credit", "credit", "Visa", "corporate", "Platinum", false],
  ["sbi-central-travel-account", "SBI Card", "Central Travel Account Card", "credit", "credit", "Visa", "corporate", null, false],
  ["sbi-corporate-utility", "SBI Card", "Corporate Utility Card", "credit", "credit", "Visa", "corporate", null, false],
  ["sbi-corporate-purchase", "SBI Card", "Corporate Purchase Card", "credit", "credit", "Visa", "corporate", null, false],
  ["sbi-corporate-virtual", "SBI Card", "Corporate Virtual Card", "credit", "credit", "Visa", "corporate", null, false],

  ["rbl-icon", "RBL Bank", "Icon", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["rbl-insignia-preferred-banking", "RBL Bank", "Insignia Preferred Banking World Card", "credit", "credit", "Mastercard", "retail", "Premium", false],
  ["rbl-lumiere", "RBL Bank", "LUMIERE", "credit", "credit", "Visa", "retail", "Ultra-Premium", false],
  ["rbl-nova", "RBL Bank", "NOVA", "credit", "credit", "Visa", "retail", "Premium", false],
  ["rbl-aspire-banking", "RBL Bank", "Aspire Banking Credit Card", "credit", "credit", "Visa", "retail", "Premium Banking", false],
  ["rbl-signature-banking", "RBL Bank", "Signature Banking Credit Card", "credit", "credit", "Visa", "retail", "Premium Banking", false],
  ["rbl-razorpayx-corporate", "RBL Bank", "RazorpayX Corporate Card", "credit", "credit", "RuPay", "corporate", null, true],
  ["rbl-razorpayx-corporate-purchase", "RBL Bank", "RazorpayX Corporate Purchase Card", "credit", "credit", "RuPay", "corporate", null, true],
  ["rbl-te-platinum-corporate", "RBL Bank", "T&E Platinum Card", "credit", "credit", "Visa", "corporate", "Platinum", false],
  ["rbl-corporate-purchase-card", "RBL Bank", "Corporate Purchase Card", "credit", "credit", "Visa", "corporate", null, false],

  ["au-altura", "AU Small Finance Bank", "Altura", "credit", "credit", "Visa", "retail", "Entry", false],
  ["au-altura-plus", "AU Small Finance Bank", "Altura Plus", "credit", "credit", "Visa", "retail", null, false],
  ["au-spont", "AU Small Finance Bank", "Spont", "credit", "credit", "Visa", "retail", "Invite-only", false],
  ["au-corporate-card", "AU Small Finance Bank", "Corporate Card", "credit", "credit", "Visa", "corporate", null, false],

  ["indusind-platinum-aura-edge", "IndusInd Bank", "Platinum Aura Edge", "credit", "credit", "RuPay", "retail", "Platinum", true],
  ["indusind-platinum-visa", "IndusInd Bank", "Platinum Visa", "credit", "credit", "Visa", "retail", "Entry", false],
  ["indusind-nexxt", "IndusInd Bank", "Nexxt", "credit", "credit", "Visa", "retail", "Premium", false],
  ["indusind-samman", "IndusInd Bank", "Samman RuPay Credit Card", "credit", "credit", "RuPay", "retail", null, true],
  ["indusind-eazydiner-platinum", "IndusInd Bank", "EazyDiner Platinum", "credit", "credit", "Visa", "co-branded", "Platinum", false],
  ["indusind-avios-visa-infinite", "IndusInd Bank", "Avios Visa Infinite", "credit", "credit", "Visa", "co-branded", "Infinite", false],
  ["indusind-epay-amex", "IndusInd Bank", "ePay Amex Credit Card", "credit", "credit", "American Express", "retail", null, false],
  ["indusind-cred-rupay", "IndusInd Bank", "CRED IndusInd Bank RuPay Credit Card", "credit", "credit", "RuPay", "co-branded", null, true],
  ["indusind-pioneer-heritage", "IndusInd Bank", "Pioneer Heritage", "credit", "credit", "Visa", "retail", "Super-Premium", false],
  ["indusind-pioneer-legacy", "IndusInd Bank", "Pioneer Legacy", "credit", "credit", "Visa", "retail", "Premium", false],
  ["indusind-pioneer-private", "IndusInd Bank", "Pioneer Private", "credit", "credit", "Visa", "retail", "Ultra-Premium", false],
  ["indusind-vrddhi-business", "IndusInd Bank", "Vrddhi Business Card", "credit", "credit", "Visa", "corporate", null, false],
  ["indusind-saarthi-business", "IndusInd Bank", "Saarthi Business Card", "credit", "credit", "RuPay", "corporate", null, true],
  ["indusind-fortuna-advantedge", "IndusInd Bank", "Fortuna AdvantEdge Card", "credit", "credit", "Visa", "corporate", null, false],
  ["indusind-odcc-corporate", "IndusInd Bank", "OD/CC Linked Corporate Credit Card", "credit", "credit", "RuPay", "corporate", null, true],

  ["yes-ace", "YES BANK", "Ace", "credit", "credit", "Visa", "retail", "Entry", false],
  ["yes-prosperity-rewards", "YES BANK", "Prosperity Rewards", "credit", "credit", "Visa", "retail", null, false],
  ["yes-prosperity-cashback", "YES BANK", "Prosperity Cashback", "credit", "credit", "Visa", "retail", null, false],
  ["yes-wellness", "YES BANK", "Wellness", "credit", "credit", "Visa", "retail", null, false],
  ["yes-finbooster", "YES BANK", "FinBooster", "credit", "credit", "RuPay", "retail", null, true],

  ["federal-visa-signet", "Federal Bank", "Visa Signet", "credit", "credit", "Visa", "retail", "Entry", false],
  ["federal-rupay-signet", "Federal Bank", "RuPay Signet", "credit", "credit", "RuPay", "retail", "Entry", true],

  ["pnb-luxura-rupay-ekaa", "Punjab National Bank", "LUXURA (RuPay EKAA)", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["pnb-luxura-visa", "Punjab National Bank", "LUXURA (Visa Infinite)", "credit", "credit", "Visa", "retail", "Premium", false],
  ["pnb-patanjali-select", "Punjab National Bank", "RuPay Select Patanjali Credit Card", "credit", "credit", "RuPay", "co-branded", "Premium", true],

  ["canara-rupay-select", "Canara Bank", "RuPay Select", "credit", "credit", "RuPay", "retail", "Premium", true],
  ["canara-rupay-women-platinum-debit", "Canara Bank", "RuPay Women Platinum Debit Card", "debit", "debit", "RuPay", "retail", "Platinum", true],

  ["union-jcb-health", "Union Bank of India", "JCB HEALTH", "credit", "credit", "JCB", "retail", null, false],
  ["union-visa-signature", "Union Bank of India", "Visa Signature", "credit", "credit", "Visa", "retail", "Premium", false],
  ["union-visa-platinum", "Union Bank of India", "Visa Platinum", "credit", "credit", "Visa", "retail", "Platinum", false],

  ["south-indian-bank-onecard", "South Indian Bank", "SIB OneCard", "credit", "credit", "Visa", "co-branded", null, false],

  ["karnataka-bank-sbi-prime", "Karnataka Bank", "SBI Card Prime", "credit", "credit", "Visa", "co-branded", null, false],
  ["karnataka-bank-simplysave-sbi", "Karnataka Bank", "SimplySave SBI Card", "credit", "credit", "Visa", "co-branded", null, false],

  ["idbi-imperium-platinum", "IDBI Bank", "Imperium Platinum", "credit", "credit", "Visa", "retail", "Platinum", false],
  ["idbi-aspire-platinum", "IDBI Bank", "Aspire Platinum", "credit", "credit", "Visa", "retail", "Platinum", false],
];

function toCardCatalogRecord(seed: CardSeedTuple) {
  const [id, issuer, product_name, card_type, card_category, network, segment, variant, upi_enabled] = seed;

  return {
    id,
    issuer,
    product_name,
    card_type,
    card_category,
    network,
    segment,
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
