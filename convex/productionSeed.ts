import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Production seed (PRD: pre-launch 200-300 master products across the 3
 * strongest categories — Writing Instruments, Paper Products, Break Room
 * & Cleaning).
 *
 * Idempotent: skips any master_product with a matching SKU. Run with:
 *   npx convex run productionSeed:seedMasterProducts
 *
 * If categories haven't been seeded, run categories.seedDefaults first.
 *
 * Each entry resolves its target subcategory by english name (level 1 under
 * the named root). Unresolved entries are reported in the return.
 */

type PackTypeSpec = {
  code: string;
  label_en: string;
  label_ar: string;
  base_qty: number;
  uom?: string;
};

type SeedRow = {
  sku: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  brand?: string;
  root_category_en: string;
  subcategory_en: string;
  pack_types: PackTypeSpec[];
};

const PACKS = {
  EACH: { code: "EACH", label_en: "Each", label_ar: "حبة", base_qty: 1, uom: "PCS" },
  BOX_OF_12: { code: "BOX_12", label_en: "Box of 12", label_ar: "علبة 12", base_qty: 12, uom: "PCS" },
  PACK_OF_4: { code: "PACK_4", label_en: "Pack of 4", label_ar: "عبوة 4", base_qty: 4, uom: "PCS" },
  PACK_OF_10: { code: "PACK_10", label_en: "Pack of 10", label_ar: "عبوة 10", base_qty: 10, uom: "PCS" },
  REAM: { code: "REAM", label_en: "Ream (500 sheets)", label_ar: "رزمة 500 ورقة", base_qty: 500, uom: "SHEETS" },
  CASE_5_REAMS: { code: "CASE_5R", label_en: "Case of 5 reams", label_ar: "كرتون 5 رزم", base_qty: 2500, uom: "SHEETS" },
  PAD: { code: "PAD", label_en: "Pad", label_ar: "دفتر", base_qty: 1, uom: "PCS" },
  PACK_OF_12: { code: "PACK_12", label_en: "Pack of 12", label_ar: "عبوة 12", base_qty: 12, uom: "PCS" },
  PACK_OF_50: { code: "PACK_50", label_en: "Pack of 50", label_ar: "عبوة 50", base_qty: 50, uom: "PCS" },
  BOX_OF_500: { code: "BOX_500", label_en: "Box of 500", label_ar: "علبة 500", base_qty: 500, uom: "PCS" },
  BOTTLE: { code: "BOTTLE", label_en: "Bottle", label_ar: "زجاجة", base_qty: 1, uom: "PCS" },
  CARTON: { code: "CARTON", label_en: "Carton", label_ar: "كرتون", base_qty: 1, uom: "PCS" },
  CASE_24: { code: "CASE_24", label_en: "Case of 24", label_ar: "كرتون 24", base_qty: 24, uom: "PCS" },
  CASE_48: { code: "CASE_48", label_en: "Case of 48", label_ar: "كرتون 48", base_qty: 48, uom: "PCS" },
  ROLL: { code: "ROLL", label_en: "Roll", label_ar: "لفة", base_qty: 1, uom: "PCS" },
  PACK_OF_6_ROLLS: { code: "PACK_6R", label_en: "Pack of 6 rolls", label_ar: "عبوة 6 لفات", base_qty: 6, uom: "ROLLS" },
} as const;

// ─── Writing Instruments ────────────────────────────────────────────────────
const PEN_COLORS = [
  { en: "Blue", ar: "أزرق" },
  { en: "Black", ar: "أسود" },
  { en: "Red", ar: "أحمر" },
  { en: "Green", ar: "أخضر" },
];
const PEN_TIPS = [
  { en: "Fine 0.5mm", ar: "رفيع ٠.٥ مم", code: "F" },
  { en: "Medium 0.7mm", ar: "متوسط ٠.٧ مم", code: "M" },
  { en: "Bold 1.0mm", ar: "عريض ١.٠ مم", code: "B" },
];

const writingInstruments: SeedRow[] = [];

// Ballpoint pens — 4 colors × 3 tips × 2 brands = 24
for (const brand of ["BIC Cristal", "Pilot BPS"]) {
  const brandCode = brand.includes("BIC") ? "BIC" : "PIL";
  for (const c of PEN_COLORS) {
    for (const t of PEN_TIPS) {
      writingInstruments.push({
        sku: `WI-PEN-${brandCode}-${c.en.slice(0, 2).toUpperCase()}-${t.code}`,
        name_en: `${brand} Ballpoint Pen, ${c.en}, ${t.en}`,
        name_ar: `قلم حبر جاف ${brand}, ${c.ar}, ${t.ar}`,
        description_en: `Smooth-writing ballpoint pen. ${t.en} tip.`,
        description_ar: `قلم حبر جاف يكتب بسلاسة. سن ${t.ar}.`,
        brand,
        root_category_en: "Writing Instruments",
        subcategory_en: "Pens",
        pack_types: [PACKS.EACH, PACKS.BOX_OF_12],
      });
    }
  }
}

// Gel pens — 4 colors
for (const c of PEN_COLORS) {
  writingInstruments.push({
    sku: `WI-GEL-${c.en.slice(0, 2).toUpperCase()}`,
    name_en: `Gel Pen 0.5mm, ${c.en}`,
    name_ar: `قلم جل ٠.٥ مم, ${c.ar}`,
    description_en: "Gel ink rollerball, smooth and quick-dry.",
    description_ar: "قلم حبر جل سريع الجفاف.",
    root_category_en: "Writing Instruments",
    subcategory_en: "Pens",
    pack_types: [PACKS.EACH, PACKS.BOX_OF_12],
  });
}

// Permanent markers — 4 colors × 2 nib sizes
for (const c of PEN_COLORS) {
  for (const nib of [
    { en: "Fine", ar: "رفيع", code: "F" },
    { en: "Chisel", ar: "مائل", code: "C" },
  ]) {
    writingInstruments.push({
      sku: `WI-MRK-PERM-${c.en.slice(0, 2).toUpperCase()}-${nib.code}`,
      name_en: `Permanent Marker, ${c.en}, ${nib.en} Tip`,
      name_ar: `قلم تحديد دائم, ${c.ar}, سن ${nib.ar}`,
      description_en: "Permanent waterproof marker for most surfaces.",
      description_ar: "قلم تحديد دائم مقاوم للماء لمعظم الأسطح.",
      root_category_en: "Writing Instruments",
      subcategory_en: "Markers",
      pack_types: [PACKS.EACH, PACKS.PACK_OF_4, PACKS.BOX_OF_12],
    });
  }
}

// Whiteboard markers — 4 colors
for (const c of PEN_COLORS) {
  writingInstruments.push({
    sku: `WI-MRK-WB-${c.en.slice(0, 2).toUpperCase()}`,
    name_en: `Whiteboard Marker, ${c.en}, Bullet Tip`,
    name_ar: `قلم سبورة, ${c.ar}, سن مدور`,
    description_en: "Dry-erase marker for whiteboards. Low odor.",
    description_ar: "قلم سبورة قابل للمسح. رائحة خفيفة.",
    root_category_en: "Writing Instruments",
    subcategory_en: "Markers",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_4],
  });
}

// Highlighters — 6 colors
const HL_COLORS = [
  { en: "Yellow", ar: "أصفر" },
  { en: "Pink", ar: "وردي" },
  { en: "Green", ar: "أخضر" },
  { en: "Blue", ar: "أزرق" },
  { en: "Orange", ar: "برتقالي" },
  { en: "Purple", ar: "بنفسجي" },
];
for (const c of HL_COLORS) {
  writingInstruments.push({
    sku: `WI-HL-${c.en.slice(0, 2).toUpperCase()}`,
    name_en: `Highlighter Marker, ${c.en}`,
    name_ar: `قلم تظليل, ${c.ar}`,
    description_en: "Chisel-tip fluorescent highlighter.",
    description_ar: "قلم تظليل بسن مائل ولون فلوريسنت.",
    root_category_en: "Writing Instruments",
    subcategory_en: "Highlighters",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_4, PACKS.PACK_OF_12],
  });
}

// Wood pencils — 3 hardness grades
for (const grade of ["HB", "2B", "2H"]) {
  writingInstruments.push({
    sku: `WI-PCL-${grade}`,
    name_en: `Wooden Pencil ${grade}`,
    name_ar: `قلم رصاص خشبي ${grade}`,
    description_en: `Premium graphite, ${grade} hardness.`,
    description_ar: `جرافيت ممتاز, درجة ${grade}.`,
    root_category_en: "Writing Instruments",
    subcategory_en: "Pencils",
    pack_types: [PACKS.EACH, PACKS.BOX_OF_12],
  });
}

// Mechanical pencils
for (const lead of ["0.5mm", "0.7mm", "0.9mm"]) {
  writingInstruments.push({
    sku: `WI-MPCL-${lead.replace(".", "").replace("mm", "")}`,
    name_en: `Mechanical Pencil ${lead}`,
    name_ar: `قلم رصاص ميكانيكي ${lead}`,
    description_en: `Refillable mechanical pencil with ${lead} lead.`,
    description_ar: `قلم رصاص ميكانيكي قابل للتعبئة, مقاس ${lead}.`,
    root_category_en: "Writing Instruments",
    subcategory_en: "Pencils",
    pack_types: [PACKS.EACH, PACKS.BOX_OF_12],
  });
}

// Pencil refills + erasers + sharpeners
writingInstruments.push(
  {
    sku: "WI-PCL-LEAD-05",
    name_en: "Pencil Lead Refill 0.5mm, 12 leads",
    name_ar: "عبوة أسنان قلم رصاص ٠.٥ مم, ١٢ سن",
    root_category_en: "Writing Instruments",
    subcategory_en: "Pencils",
    pack_types: [PACKS.EACH],
  },
  {
    sku: "WI-PCL-ERSR-WHT",
    name_en: "White Eraser, Standard",
    name_ar: "ممحاة بيضاء, قياس عادي",
    root_category_en: "Writing Instruments",
    subcategory_en: "Pencils",
    pack_types: [PACKS.EACH, PACKS.BOX_OF_12],
  },
  {
    sku: "WI-PCL-SHRP-MTL",
    name_en: "Metal Pencil Sharpener",
    name_ar: "براية معدنية",
    root_category_en: "Writing Instruments",
    subcategory_en: "Pencils",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
);

// Correction fluid + tape
writingInstruments.push(
  {
    sku: "WI-CORR-FLD-20",
    name_en: "Correction Fluid Bottle 20ml",
    name_ar: "زجاجة سائل تصحيح ٢٠ مل",
    description_en: "Fast-drying white correction fluid with brush.",
    description_ar: "سائل تصحيح أبيض سريع الجفاف مع فرشاة.",
    root_category_en: "Writing Instruments",
    subcategory_en: "Correction Fluid",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
  {
    sku: "WI-CORR-PEN-7",
    name_en: "Correction Pen 7ml",
    name_ar: "قلم تصحيح ٧ مل",
    root_category_en: "Writing Instruments",
    subcategory_en: "Correction Fluid",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
  {
    sku: "WI-CORR-TAPE-5M",
    name_en: "Correction Tape 5m",
    name_ar: "شريط تصحيح ٥ متر",
    root_category_en: "Writing Instruments",
    subcategory_en: "Correction Fluid",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
  {
    sku: "WI-CORR-TAPE-10M",
    name_en: "Correction Tape 10m",
    name_ar: "شريط تصحيح ١٠ متر",
    root_category_en: "Writing Instruments",
    subcategory_en: "Correction Fluid",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
);

// Now ~70 writing-instruments rows.

// ─── Paper Products ─────────────────────────────────────────────────────────
const paperProducts: SeedRow[] = [];

// Copy paper — 4 grades × 2 sizes × 2 brands = 16
const PAPER_GRADES = [
  { gsm: 70, name: "Economy" },
  { gsm: 75, name: "Standard" },
  { gsm: 80, name: "Premium" },
  { gsm: 100, name: "Executive" },
];
const PAPER_SIZES = [
  { en: "A4", ar: "أ٤" },
  { en: "A3", ar: "أ٣" },
];
for (const brand of ["Double A", "Paper One"]) {
  const brandCode = brand.replace(/\s/g, "").toUpperCase().slice(0, 4);
  for (const g of PAPER_GRADES) {
    for (const s of PAPER_SIZES) {
      paperProducts.push({
        sku: `PP-CP-${brandCode}-${s.en}-${g.gsm}`,
        name_en: `${brand} ${g.name} Copy Paper ${s.en}, ${g.gsm}gsm`,
        name_ar: `ورق تصوير ${brand} ${s.ar}, ${g.gsm} جرام`,
        description_en: `${g.gsm}gsm white copy paper, ${s.en} format. 500 sheets per ream.`,
        description_ar: `ورق تصوير أبيض ${g.gsm} جرام, مقاس ${s.ar}. ٥٠٠ ورقة في الرزمة.`,
        brand,
        root_category_en: "Paper Products",
        subcategory_en: "Copy Paper",
        pack_types: [PACKS.REAM, PACKS.CASE_5_REAMS],
      });
    }
  }
}

// Coloured copy paper — 6 colours
const COLOR_PAPER = [
  { en: "Yellow", ar: "أصفر" },
  { en: "Pink", ar: "وردي" },
  { en: "Green", ar: "أخضر" },
  { en: "Blue", ar: "أزرق" },
  { en: "Ivory", ar: "عاجي" },
  { en: "Lilac", ar: "أرجواني" },
];
for (const c of COLOR_PAPER) {
  paperProducts.push({
    sku: `PP-CP-COLOR-${c.en.slice(0, 3).toUpperCase()}`,
    name_en: `Coloured Copy Paper A4, ${c.en}, 80gsm`,
    name_ar: `ورق تصوير ملوّن أ٤, ${c.ar}, ٨٠ جرام`,
    root_category_en: "Paper Products",
    subcategory_en: "Specialty Paper",
    pack_types: [PACKS.REAM, PACKS.CASE_5_REAMS],
  });
}

// Sticky notes
const STICKY_SIZES = [
  { en: "76×76mm", ar: "٧٦×٧٦ مم", code: "76" },
  { en: "76×127mm", ar: "٧٦×١٢٧ مم", code: "76127" },
  { en: "38×51mm", ar: "٣٨×٥١ مم", code: "3851" },
];
const STICKY_COLORS = [
  { en: "Yellow", ar: "أصفر", code: "Y" },
  { en: "Assorted Neon", ar: "نيون متنوع", code: "N" },
  { en: "Pastel Mix", ar: "ألوان باستيل", code: "P" },
];
for (const sz of STICKY_SIZES) {
  for (const c of STICKY_COLORS) {
    paperProducts.push({
      sku: `PP-SN-${sz.code}-${c.code}`,
      name_en: `Sticky Notes ${sz.en}, ${c.en}, 100 sheets`,
      name_ar: `ملاحظات لاصقة ${sz.ar}, ${c.ar}, ١٠٠ ورقة`,
      root_category_en: "Paper Products",
      subcategory_en: "Stick Notes",
      pack_types: [PACKS.PAD, PACKS.PACK_OF_12],
    });
  }
}

// Envelopes
const ENV_SIZES = [
  { en: "DL White (110×220mm)", ar: "DL أبيض (١١٠×٢٢٠ مم)", code: "DLW" },
  { en: "DL Brown (110×220mm)", ar: "DL بني (١١٠×٢٢٠ مم)", code: "DLB" },
  { en: "C5 White (162×229mm)", ar: "C5 أبيض (١٦٢×٢٢٩ مم)", code: "C5W" },
  { en: "C4 White (229×324mm)", ar: "C4 أبيض (٢٢٩×٣٢٤ مم)", code: "C4W" },
  { en: "C4 Brown (229×324mm)", ar: "C4 بني (٢٢٩×٣٢٤ مم)", code: "C4B" },
  { en: "Window DL", ar: "DL بنافذة", code: "DLWW" },
];
for (const e of ENV_SIZES) {
  paperProducts.push({
    sku: `PP-ENV-${e.code}`,
    name_en: `Envelope ${e.en}`,
    name_ar: `مظروف ${e.ar}`,
    root_category_en: "Paper Products",
    subcategory_en: "Envelopes",
    pack_types: [PACKS.PACK_OF_50, PACKS.BOX_OF_500],
  });
}

// Notebooks
const NB_SIZES = [
  { en: "A4 Hardcover, 200 pages", ar: "أ٤ غلاف صلب, ٢٠٠ صفحة", code: "A4H200" },
  { en: "A5 Hardcover, 200 pages", ar: "أ٥ غلاف صلب, ٢٠٠ صفحة", code: "A5H200" },
  { en: "A4 Soft, 100 pages", ar: "أ٤ غلاف ناعم, ١٠٠ صفحة", code: "A4S100" },
  { en: "A5 Soft, 100 pages", ar: "أ٥ غلاف ناعم, ١٠٠ صفحة", code: "A5S100" },
  { en: "A6 Pocket, 80 pages", ar: "أ٦ جيب, ٨٠ صفحة", code: "A6P80" },
];
for (const nb of NB_SIZES) {
  paperProducts.push({
    sku: `PP-NB-${nb.code}`,
    name_en: `Spiral Notebook ${nb.en}`,
    name_ar: `دفتر سلك ${nb.ar}`,
    root_category_en: "Paper Products",
    subcategory_en: "Pads & Note Books",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_10],
  });
}

// Other paper SKUs
paperProducts.push(
  {
    sku: "PP-PAD-LGL-WT",
    name_en: "Legal Pad Yellow, 50 sheets",
    name_ar: "دفتر قانوني أصفر, ٥٠ ورقة",
    root_category_en: "Paper Products",
    subcategory_en: "Pads & Note Books",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
  {
    sku: "PP-PAD-WHT",
    name_en: "Writing Pad A4 White, 80 sheets",
    name_ar: "دفتر كتابة أ٤ أبيض, ٨٠ ورقة",
    root_category_en: "Paper Products",
    subcategory_en: "Pads & Note Books",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
  {
    sku: "PP-CR-57",
    name_en: "Thermal Cash Roll 57×40mm",
    name_ar: "رول كاشير حراري ٥٧×٤٠ مم",
    root_category_en: "Paper Products",
    subcategory_en: "Cash Rolls",
    pack_types: [PACKS.ROLL, PACKS.CARTON],
  },
  {
    sku: "PP-CR-80",
    name_en: "Thermal Cash Roll 80×80mm",
    name_ar: "رول كاشير حراري ٨٠×٨٠ مم",
    root_category_en: "Paper Products",
    subcategory_en: "Cash Rolls",
    pack_types: [PACKS.ROLL, PACKS.CARTON],
  },
  {
    sku: "PP-RB-200",
    name_en: "Record Book A4, 200 pages, Hardcover",
    name_ar: "دفتر سجلات أ٤ ٢٠٠ صفحة, غلاف صلب",
    root_category_en: "Paper Products",
    subcategory_en: "Record Book",
    pack_types: [PACKS.EACH],
  },
  {
    sku: "PP-RB-400",
    name_en: "Record Book A4, 400 pages, Hardcover",
    name_ar: "دفتر سجلات أ٤ ٤٠٠ صفحة, غلاف صلب",
    root_category_en: "Paper Products",
    subcategory_en: "Record Book",
    pack_types: [PACKS.EACH],
  },
  {
    sku: "PP-AWD-CERT",
    name_en: "Certificate Paper A4 Gold Border, 100 sheets",
    name_ar: "ورق شهادات أ٤ بحواف ذهبية, ١٠٠ ورقة",
    root_category_en: "Paper Products",
    subcategory_en: "Awards",
    pack_types: [PACKS.EACH],
  },
  {
    sku: "PP-FOAM-5MM",
    name_en: "Foam Board A2, 5mm, White",
    name_ar: "لوح فوم أ٢, ٥ مم, أبيض",
    root_category_en: "Paper Products",
    subcategory_en: "Foam Boards",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_10],
  },
  {
    sku: "PP-FOAM-10MM",
    name_en: "Foam Board A2, 10mm, White",
    name_ar: "لوح فوم أ٢, ١٠ مم, أبيض",
    root_category_en: "Paper Products",
    subcategory_en: "Foam Boards",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_10],
  },
);

// ─── Break Room & Cleaning ──────────────────────────────────────────────────
const breakRoom: SeedRow[] = [];

// Coffee
breakRoom.push(
  {
    sku: "BR-CFE-INST-200",
    name_en: "Instant Coffee Granules 200g",
    name_ar: "قهوة سريعة الذوبان حبيبات ٢٠٠ جم",
    brand: "Nescafé",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_12],
  },
  {
    sku: "BR-CFE-3IN1",
    name_en: "3-in-1 Coffee Sachets, 30 sachets",
    name_ar: "أكياس قهوة ٣ في ١, ٣٠ كيس",
    brand: "Nescafé",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-CFE-CAPS-NESP",
    name_en: "Coffee Capsules Nespresso-compatible, 50 capsules",
    name_ar: "كبسولات قهوة متوافقة مع نسبريسو, ٥٠ كبسولة",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-CFE-FILTER-1KG",
    name_en: "Ground Filter Coffee 1kg",
    name_ar: "قهوة مطحونة للفلتر ١ كجم",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
);

// Tea
breakRoom.push(
  {
    sku: "BR-TEA-LIPT-100",
    name_en: "Black Tea Bags, 100 bags",
    name_ar: "أكياس شاي أسود, ١٠٠ كيس",
    brand: "Lipton",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-TEA-GREEN-50",
    name_en: "Green Tea Bags, 50 bags",
    name_ar: "أكياس شاي أخضر, ٥٠ كيس",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-TEA-MINT-25",
    name_en: "Mint Herbal Tea, 25 bags",
    name_ar: "شاي نعناع عشبي, ٢٥ كيس",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-TEA-KARAK",
    name_en: "Karak Tea Premix, 20 sachets",
    name_ar: "شاي كرك جاهز, ٢٠ كيس",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
);

// Sugar / Creamer
breakRoom.push(
  {
    sku: "BR-SUG-WHT-1KG",
    name_en: "White Sugar 1kg",
    name_ar: "سكر أبيض ١ كجم",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-SUG-STK-1000",
    name_en: "Sugar Sticks, 1000 × 5g",
    name_ar: "أعواد سكر, ١٠٠٠ × ٥ جم",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH],
  },
  {
    sku: "BR-CRM-NDR-500",
    name_en: "Non-Dairy Creamer 500g",
    name_ar: "مبيض قهوة غير الألبان ٥٠٠ جم",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-CRM-STK-500",
    name_en: "Creamer Sticks, 500 × 3g",
    name_ar: "أعواد مبيض قهوة, ٥٠٠ × ٣ جم",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.EACH],
  },
);

// Bottled water + soft drinks
breakRoom.push(
  {
    sku: "BR-WTR-200ML",
    name_en: "Bottled Water 200ml",
    name_ar: "مياه معبأة ٢٠٠ مل",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.BOTTLE, PACKS.CASE_48],
  },
  {
    sku: "BR-WTR-500ML",
    name_en: "Bottled Water 500ml",
    name_ar: "مياه معبأة ٥٠٠ مل",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.BOTTLE, PACKS.CASE_24],
  },
  {
    sku: "BR-WTR-1500ML",
    name_en: "Bottled Water 1.5L",
    name_ar: "مياه معبأة ١.٥ لتر",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.BOTTLE, { code: "PACK_6", label_en: "Pack of 6", label_ar: "عبوة 6", base_qty: 6, uom: "PCS" }],
  },
  {
    sku: "BR-WTR-19L",
    name_en: "Bottled Water 19L Jug",
    name_ar: "جالون مياه ١٩ لتر",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Food & Beverages",
    pack_types: [PACKS.BOTTLE],
  },
);

// Snacks (catering)
const SNACKS = [
  { en: "Plain Biscuits", ar: "بسكويت سادة", code: "BSCT" },
  { en: "Cream Biscuits", ar: "بسكويت بكريمة", code: "BSCRM" },
  { en: "Wafer Bars", ar: "ويفر", code: "WAFR" },
  { en: "Chocolate Bars Mini", ar: "ألواح شوكولاتة صغيرة", code: "CHOC" },
  { en: "Mixed Nuts 100g", ar: "مكسرات منوّعة ١٠٠ جم", code: "NUTS" },
  { en: "Dates Premium 1kg", ar: "تمر ممتاز ١ كجم", code: "DATES" },
];
for (const s of SNACKS) {
  breakRoom.push({
    sku: `BR-SNK-${s.code}`,
    name_en: s.en,
    name_ar: s.ar,
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Catering Supplies",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  });
}

// Disposable catering
const CATERING = [
  { en: "Paper Cups 8oz, 50 cups", ar: "أكواب ورقية ٨ أونص, ٥٠ كوب", code: "PCUP8" },
  { en: "Paper Cups 12oz, 50 cups", ar: "أكواب ورقية ١٢ أونص, ٥٠ كوب", code: "PCUP12" },
  { en: "Plastic Stirrers, 1000 pcs", ar: "محركات بلاستيك, ١٠٠٠ قطعة", code: "STIR" },
  { en: "Wooden Stirrers, 1000 pcs", ar: "محركات خشب, ١٠٠٠ قطعة", code: "STIRW" },
  { en: "Plastic Tea Spoons, 100 pcs", ar: "ملاعق شاي بلاستيك, ١٠٠ قطعة", code: "TSPN" },
  { en: "Plastic Forks, 100 pcs", ar: "شوك بلاستيك, ١٠٠ قطعة", code: "FORK" },
  { en: "Paper Napkins, 100 pcs", ar: "مناديل ورقية, ١٠٠ قطعة", code: "NAPK" },
  { en: "Disposable Plates 9-inch, 50 pcs", ar: "أطباق للاستخدام الواحد ٩ إنش, ٥٠ قطعة", code: "PLT9" },
];
for (const c of CATERING) {
  breakRoom.push({
    sku: `BR-CAT-${c.code}`,
    name_en: c.en,
    name_ar: c.ar,
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Catering Supplies",
    pack_types: [PACKS.EACH, PACKS.CARTON],
  });
}

// Cleaning supplies
const CLEANERS = [
  { en: "Multi-Surface Cleaner 750ml Spray", ar: "منظف متعدد الأسطح بخاخ ٧٥٠ مل", code: "MS750" },
  { en: "Glass Cleaner 750ml Spray", ar: "منظف زجاج بخاخ ٧٥٠ مل", code: "GLS750" },
  { en: "Floor Cleaner 1L", ar: "منظف أرضيات ١ لتر", code: "FLR1L" },
  { en: "Floor Cleaner 4L", ar: "منظف أرضيات ٤ لتر", code: "FLR4L" },
  { en: "Disinfectant Pine 1L", ar: "مطهّر برائحة الصنوبر ١ لتر", code: "DSN1L" },
  { en: "Bleach 1L", ar: "مبيض كلور ١ لتر", code: "BLCH1L" },
  { en: "Dishwashing Liquid 1L", ar: "سائل غسيل صحون ١ لتر", code: "DISH1L" },
  { en: "Hand Soap Liquid 500ml", ar: "صابون سائل لليدين ٥٠٠ مل", code: "HSP500" },
  { en: "Hand Sanitizer Gel 500ml", ar: "معقّم يدين جل ٥٠٠ مل", code: "HSAN500" },
  { en: "Air Freshener Spray 300ml", ar: "معطّر جو بخاخ ٣٠٠ مل", code: "AIR300" },
];
for (const c of CLEANERS) {
  breakRoom.push({
    sku: `BR-CLN-${c.code}`,
    name_en: c.en,
    name_ar: c.ar,
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Office Cleaning",
    pack_types: [PACKS.BOTTLE, PACKS.CARTON],
  });
}

// Cleaning tools
const TOOLS = [
  { en: "Microfiber Cloth, 5 pcs", ar: "قماش مايكروفايبر, ٥ قطع", code: "MFC5" },
  { en: "Floor Mop with Bucket", ar: "ممسحة أرضيات مع دلو", code: "MOP" },
  { en: "Broom and Dustpan Set", ar: "مكنسة ومجرفة طقم", code: "BRM" },
  { en: "Latex Gloves Medium, 100 pcs", ar: "قفازات لاتكس مقاس متوسط, ١٠٠ قطعة", code: "GLV-M" },
  { en: "Latex Gloves Large, 100 pcs", ar: "قفازات لاتكس مقاس كبير, ١٠٠ قطعة", code: "GLV-L" },
  { en: "Trash Bags Medium 60×80cm, 50 pcs", ar: "أكياس قمامة متوسطة ٦٠×٨٠ سم, ٥٠ قطعة", code: "TB-M" },
  { en: "Trash Bags Large 80×110cm, 50 pcs", ar: "أكياس قمامة كبيرة ٨٠×١١٠ سم, ٥٠ قطعة", code: "TB-L" },
  { en: "Trash Bags XL 90×120cm, 50 pcs", ar: "أكياس قمامة كبيرة جدًا ٩٠×١٢٠ سم, ٥٠ قطعة", code: "TB-XL" },
  { en: "Spray Bottle Empty 500ml", ar: "زجاجة بخاخ فارغة ٥٠٠ مل", code: "SPRB" },
  { en: "Scouring Pad, 10 pcs", ar: "ليفة جلي, ١٠ قطع", code: "SCRP" },
];
for (const t of TOOLS) {
  breakRoom.push({
    sku: `BR-CLN-TL-${t.code}`,
    name_en: t.en,
    name_ar: t.ar,
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Office Cleaning",
    pack_types: [PACKS.EACH, PACKS.CARTON],
  });
}

// Toilet/tissue paper
breakRoom.push(
  {
    sku: "BR-TP-2P-12",
    name_en: "Toilet Paper 2-ply, 12 rolls",
    name_ar: "ورق تواليت طبقتين, ١٢ لفة",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Office Cleaning",
    pack_types: [PACKS.EACH, PACKS.PACK_OF_6_ROLLS, PACKS.CARTON],
  },
  {
    sku: "BR-TP-2P-24",
    name_en: "Toilet Paper 2-ply, 24 rolls",
    name_ar: "ورق تواليت طبقتين, ٢٤ لفة",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Office Cleaning",
    pack_types: [PACKS.EACH, PACKS.CARTON],
  },
  {
    sku: "BR-FT-300",
    name_en: "Facial Tissues, 300 sheets",
    name_ar: "مناديل وجه, ٣٠٠ ورقة",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Office Cleaning",
    pack_types: [PACKS.EACH, PACKS.CASE_24],
  },
  {
    sku: "BR-PT-RLL",
    name_en: "Paper Towel Roll, Kitchen",
    name_ar: "لفة مناديل مطبخ",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Office Cleaning",
    pack_types: [PACKS.ROLL, PACKS.PACK_OF_6_ROLLS],
  },
  {
    sku: "BR-PT-MULTI",
    name_en: "Multi-fold Paper Hand Towels, 200 sheets",
    name_ar: "مناديل ورقية لليدين, ٢٠٠ ورقة",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Office Cleaning",
    pack_types: [PACKS.EACH, PACKS.CARTON],
  },
);

// Personal care
breakRoom.push(
  {
    sku: "BR-PC-MASK-50",
    name_en: "Disposable Face Masks, 50 pcs",
    name_ar: "كمامات للاستخدام الواحد, ٥٠ قطعة",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Personal Care",
    pack_types: [PACKS.EACH, PACKS.CARTON],
  },
  {
    sku: "BR-PC-WET-100",
    name_en: "Antibacterial Wet Wipes, 100 sheets",
    name_ar: "مناديل مبللة مضادة للبكتيريا, ١٠٠ ورقة",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Personal Care",
    pack_types: [PACKS.EACH, PACKS.CARTON],
  },
);

// Appliances (small selection)
breakRoom.push(
  {
    sku: "BR-APP-KETTLE-1.7",
    name_en: "Electric Kettle 1.7L",
    name_ar: "غلاية كهربائية ١.٧ لتر",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Appliances",
    pack_types: [PACKS.EACH],
  },
  {
    sku: "BR-APP-COFMACH-AUTO",
    name_en: "Automatic Drip Coffee Machine 12-cup",
    name_ar: "ماكينة قهوة فلتر تلقائية ١٢ فنجان",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Appliances",
    pack_types: [PACKS.EACH],
  },
  {
    sku: "BR-APP-MWAVE-25L",
    name_en: "Microwave Oven 25L",
    name_ar: "فرن ميكروويف ٢٥ لتر",
    root_category_en: "Break Room & Cleaning",
    subcategory_en: "Appliances",
    pack_types: [PACKS.EACH],
  },
);

// Concatenate all
const ALL_ROWS: SeedRow[] = [
  ...writingInstruments,
  ...paperProducts,
  ...breakRoom,
];

// Resolve a category id by walking the tree by english name. Looks up the
// `subcategory_en` whose parent's `name_en` matches `root_category_en`.
async function resolveSubcategory(
  ctx: { db: any },
  rootEn: string,
  subEn: string,
): Promise<Id<"categories"> | null> {
  const root = await ctx.db
    .query("categories")
    .withIndex("by_level", (q: any) => q.eq("level", 0))
    .filter((q: any) => q.eq(q.field("name_en"), rootEn))
    .first();
  if (!root) return null;
  const child = await ctx.db
    .query("categories")
    .withIndex("by_parent", (q: any) => q.eq("parent_id", root._id))
    .filter((q: any) =>
      q.and(
        q.eq(q.field("name_en"), subEn),
        q.eq(q.field("status"), "ACTIVE"),
      ),
    )
    .first();
  return child?._id ?? null;
}

export const seedMasterProducts = internalMutation({
  args: {
    admin_profile_id: v.optional(v.id("profiles")),
    /** Publish status — DRAFT (review first) or ACTIVE (live to suppliers/clients). */
    status: v.optional(
      v.union(v.literal("DRAFT"), v.literal("ACTIVE")),
    ),
    /** Cap how many entries to seed in one run. */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const status = args.status ?? "ACTIVE";
    const limit = args.limit ?? ALL_ROWS.length;

    let adminId = args.admin_profile_id;
    if (!adminId) {
      const admin = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", "ADMIN"))
        .first();
      if (!admin) throw new Error("No admin profile — pass admin_profile_id");
      adminId = admin._id;
    }

    const skipped: { sku: string; reason: string }[] = [];
    let created = 0;

    for (const row of ALL_ROWS.slice(0, limit)) {
      // Skip if a master with this SKU already exists.
      const existing = await ctx.db
        .query("master_products")
        .withIndex("by_sku", (q) => q.eq("sku", row.sku))
        .first();
      if (existing) {
        skipped.push({ sku: row.sku, reason: "exists" });
        continue;
      }
      const categoryId = await resolveSubcategory(
        ctx,
        row.root_category_en,
        row.subcategory_en,
      );
      if (!categoryId) {
        skipped.push({
          sku: row.sku,
          reason: `category not found: ${row.root_category_en} > ${row.subcategory_en}`,
        });
        continue;
      }
      await ctx.db.insert("master_products", {
        name_en: row.name_en,
        name_ar: row.name_ar,
        description_en: row.description_en,
        description_ar: row.description_ar,
        category_id: categoryId,
        sku: row.sku,
        brand: row.brand,
        images: [],
        pack_types: row.pack_types,
        status,
        created_by: adminId,
        updated_at: Date.now(),
      });
      created++;
    }

    return {
      total_rows: ALL_ROWS.length,
      attempted: Math.min(limit, ALL_ROWS.length),
      created,
      skipped: skipped.length,
      skipped_detail: skipped.slice(0, 25), // cap output for log readability
    };
  },
});
