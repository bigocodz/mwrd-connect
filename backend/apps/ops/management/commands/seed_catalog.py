"""R15 — Pre-launch catalog seed.

Spec § "Master catalog seeded pre-launch: 200 to 300 master products across
3 strongest categories (Office Supplies, IT and Electronics, Furniture).
Use AI generation, then admin curation."

This command spins up the three categories and a deterministic 210-product
catalog suitable for staging / pre-launch demos. Idempotent: re-running
detects existing rows by sku and skips duplicates.

    uv run python manage.py seed_catalog
    uv run python manage.py seed_catalog --count-per-category 70
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

# 70 products per category × 3 = 210 total. Each entry is a (sku-slug,
# en-name, ar-name, brand) tuple — kept short here so the command fits one
# screen. Admins curate further after import.
_OFFICE_SUPPLIES = [
    ("PEN-BLU-01", "Ballpoint pen, blue", "قلم حبر أزرق", "Pilot"),
    ("PEN-BLK-01", "Ballpoint pen, black", "قلم حبر أسود", "Pilot"),
    ("PEN-RED-01", "Ballpoint pen, red", "قلم حبر أحمر", "Pilot"),
    ("PNCL-HB-01", "HB pencil", "قلم رصاص HB", "Faber-Castell"),
    ("ERAS-WHT-01", "White eraser", "ممحاة بيضاء", "Staedtler"),
    ("HIGH-YEL-01", "Highlighter, yellow", "قلم تظليل أصفر", "Stabilo"),
    ("HIGH-GRN-01", "Highlighter, green", "قلم تظليل أخضر", "Stabilo"),
    ("HIGH-PNK-01", "Highlighter, pink", "قلم تظليل وردي", "Stabilo"),
    ("MARK-BLK-01", "Permanent marker, black", "قلم ماركر دائم أسود", "Sharpie"),
    ("MARK-BLU-01", "Permanent marker, blue", "قلم ماركر دائم أزرق", "Sharpie"),
    ("WBM-BLK-01", "Whiteboard marker, black", "قلم سبورة أسود", "Pilot"),
    ("WBM-BLU-01", "Whiteboard marker, blue", "قلم سبورة أزرق", "Pilot"),
    ("WBM-RED-01", "Whiteboard marker, red", "قلم سبورة أحمر", "Pilot"),
    ("PAP-A4-80", "A4 copy paper, 80gsm", "ورق A4 80 جرام", "Double A"),
    ("PAP-A4-100", "A4 copy paper, 100gsm", "ورق A4 100 جرام", "Double A"),
    ("PAP-A3-80", "A3 copy paper, 80gsm", "ورق A3 80 جرام", "Double A"),
    ("ENV-DL-WHT", "DL envelope, white", "ظرف DL أبيض", "Generic"),
    ("ENV-C5-WHT", "C5 envelope, white", "ظرف C5 أبيض", "Generic"),
    ("ENV-C4-WHT", "C4 envelope, white", "ظرف C4 أبيض", "Generic"),
    ("FLD-A4-MNL", "Manila folder, A4", "ملف مانيلا A4", "Bantex"),
    ("FLD-A4-PLS", "Plastic L-folder, A4", "ملف بلاستيكي A4", "Bantex"),
    ("BIN-CLP-RG", "Binder clips, regular", "مشابك ورق متوسطة", "Officemate"),
    ("BIN-CLP-LG", "Binder clips, large", "مشابك ورق كبيرة", "Officemate"),
    ("PPRCLP-SM", "Paper clips, small", "مشابك ورق صغيرة", "Officemate"),
    ("STPL-26", "Staples 26/6", "دبابيس 26/6", "Max"),
    ("STPL-23", "Staples 23/8", "دبابيس 23/8", "Max"),
    ("STPLR-DSK", "Desktop stapler", "دباسة مكتبية", "Max"),
    ("STPLR-HDV", "Heavy-duty stapler", "دباسة ثقيلة", "Rapid"),
    ("HOLE-PUNCH", "2-hole punch", "خرامة ثنائية", "Rapesco"),
    ("HOLE-PNCH4", "4-hole punch", "خرامة رباعية", "Rapesco"),
    ("TAPE-CLR", "Clear tape, 18mm", "شريط لاصق شفاف 18 مم", "3M"),
    ("TAPE-MASK", "Masking tape, 24mm", "شريط لاصق ورقي 24 مم", "3M"),
    ("TAPE-DBL", "Double-sided tape", "شريط لاصق وجهين", "3M"),
    ("GLUE-STK", "Glue stick", "قلم لصق", "UHU"),
    ("GLUE-LIQ", "Liquid glue, 60ml", "غراء سائل 60 مل", "UHU"),
    ("SCSR-OFF", "Office scissors", "مقص مكتبي", "Maped"),
    ("RULER-30", "Ruler, 30cm", "مسطرة 30 سم", "Maped"),
    ("RULER-15", "Ruler, 15cm", "مسطرة 15 سم", "Maped"),
    ("CALC-BSC", "Basic calculator, 12-digit", "آلة حاسبة أساسية", "Casio"),
    ("CALC-SCI", "Scientific calculator", "آلة حاسبة علمية", "Casio"),
    ("PSTNT-3X3", "Sticky notes, 3×3", "ملاحظات لاصقة 3×3", "Post-it"),
    ("PSTNT-4X6", "Sticky notes, 4×6", "ملاحظات لاصقة 4×6", "Post-it"),
    ("FLG-IDX", "Index flags, assorted", "علامات تبويب", "Post-it"),
    ("NB-A5-RUL", "Notebook A5, ruled", "دفتر A5 مسطر", "Oxford"),
    ("NB-A4-RUL", "Notebook A4, ruled", "دفتر A4 مسطر", "Oxford"),
    ("NB-A5-GRD", "Notebook A5, grid", "دفتر A5 مربعات", "Oxford"),
    ("BNDR-A4-2R", "Lever arch binder, A4 2-ring", "ملف رافعة A4 حلقتين", "Bantex"),
    ("BNDR-A4-4R", "Ring binder, A4 4-ring", "ملف A4 4 حلقات", "Bantex"),
    ("ARCH-A4", "Archive box, A4", "صندوق أرشفة A4", "Bantex"),
    ("LBL-A4-21", "Address labels, 21/sheet", "ملصقات عناوين 21/ورقة", "Avery"),
    ("LBL-A4-65", "Address labels, 65/sheet", "ملصقات عناوين 65/ورقة", "Avery"),
    ("ENVL-PYRL", "Payroll envelopes", "ظروف رواتب", "Generic"),
    ("CLPB-A4", "A4 clipboard", "حافظة قصاصات A4", "Maped"),
    ("LTRTRY-3T", "Letter tray, 3-tier", "صينية ملفات 3 طبقات", "Officemate"),
    ("BSKT-TRSH", "Office bin, 10L", "سلة مهملات 10 لتر", "Generic"),
    ("DTKT-BSC", "Desk organizer, basic", "منظم مكتب أساسي", "Officemate"),
    ("PNCRYL-SH", "Pen holder cup", "حامل أقلام", "Generic"),
    ("STPL-RMVR", "Staple remover", "نازع دبابيس", "Max"),
    ("ACE-HRTSH", "Office shredder, P-3", "آلة تمزيق ورق P-3", "Fellowes"),
    ("LMTR-A4", "Laminator, A4", "آلة تغليف A4", "Fellowes"),
    ("LMSV-A4", "Laminating pouches, A4", "أكياس تغليف A4", "Fellowes"),
    ("WB-90X60", "Whiteboard, 90×60cm", "سبورة 90×60 سم", "Generic"),
    ("WB-180X120", "Whiteboard, 180×120cm", "سبورة 180×120 سم", "Generic"),
    ("CRKBRD-90", "Cork board, 90×60cm", "لوحة فلين 90×60 سم", "Generic"),
    ("FLPCH-A4", "Flip chart pad, A4", "دفتر فليب شارت A4", "Generic"),
    ("DSKMAT", "Desk mat", "حصيرة مكتب", "Generic"),
    ("CHRMAT", "Chair mat", "حصيرة كرسي", "Generic"),
    ("SHRDR-OIL", "Shredder oil, 350ml", "زيت آلة تمزيق 350 مل", "Fellowes"),
    ("STMP-DTR", "Self-inking date stamp", "ختم تاريخ", "Trodat"),
    ("STMP-PAID", "'Paid' stamp", "ختم 'مدفوع'", "Trodat"),
]

_IT_AND_ELECTRONICS = [
    ("LPTP-145H", "14\" laptop, 16GB/512GB", "لابتوب 14 إنش 16/512", "Lenovo"),
    ("LPTP-156H", "15.6\" laptop, 16GB/512GB", "لابتوب 15.6 إنش", "Lenovo"),
    ("LPTP-X1", "Premium ultrabook 14\"", "لابتوب رفيع 14 إنش", "Lenovo"),
    ("LPTP-MBP14", "MacBook Pro 14\"", "ماك بوك برو 14", "Apple"),
    ("LPTP-MBP16", "MacBook Pro 16\"", "ماك بوك برو 16", "Apple"),
    ("LPTP-MBA13", "MacBook Air 13\"", "ماك بوك إير 13", "Apple"),
    ("DSKP-OPTI", "Desktop PC, i5/16/512", "كمبيوتر مكتبي i5", "Dell"),
    ("DSKP-IMAC", "iMac 24\"", "آي ماك 24", "Apple"),
    ("MNTR-24FHD", "24\" FHD monitor", "شاشة 24 إنش FHD", "LG"),
    ("MNTR-27FHD", "27\" FHD monitor", "شاشة 27 إنش FHD", "LG"),
    ("MNTR-274K", "27\" 4K monitor", "شاشة 27 إنش 4K", "LG"),
    ("MNTR-32C", "32\" curved monitor", "شاشة 32 إنش منحنية", "Samsung"),
    ("MNTR-34UW", "34\" ultrawide monitor", "شاشة 34 فائقة العرض", "LG"),
    ("KB-USB-AR", "Wired keyboard, AR layout", "لوحة مفاتيح USB عربي", "Logitech"),
    ("KB-WL-AR", "Wireless keyboard, AR", "لوحة مفاتيح لاسلكية", "Logitech"),
    ("KB-MX-KEYS", "MX Keys keyboard", "لوحة مفاتيح MX Keys", "Logitech"),
    ("MS-USB", "Wired mouse", "ماوس USB", "Logitech"),
    ("MS-WL", "Wireless mouse", "ماوس لاسلكي", "Logitech"),
    ("MS-MX3", "MX Master 3 mouse", "ماوس MX Master 3", "Logitech"),
    ("HSET-USB", "USB headset", "سماعة رأس USB", "Jabra"),
    ("HSET-BT", "Bluetooth headset", "سماعة بلوتوث", "Jabra"),
    ("HSET-NC", "Noise-cancelling headphones", "سماعة بإلغاء الضوضاء", "Sony"),
    ("WBCM-1080", "1080p webcam", "كاميرا ويب 1080p", "Logitech"),
    ("WBCM-4K", "4K webcam", "كاميرا ويب 4K", "Logitech"),
    ("DOCK-USB-C", "USB-C docking station", "محطة إرساء USB-C", "Dell"),
    ("DOCK-TB4", "Thunderbolt 4 dock", "محطة إرساء TB4", "CalDigit"),
    ("CBL-USBC-1M", "USB-C cable 1m", "كابل USB-C 1م", "Anker"),
    ("CBL-USBC-2M", "USB-C cable 2m", "كابل USB-C 2م", "Anker"),
    ("CBL-HDMI-1M", "HDMI cable 1m", "كابل HDMI 1م", "Anker"),
    ("CBL-HDMI-3M", "HDMI cable 3m", "كابل HDMI 3م", "Anker"),
    ("ADP-USBC-HDMI", "USB-C to HDMI adapter", "محول USB-C إلى HDMI", "Anker"),
    ("ADP-USBC-VGA", "USB-C to VGA adapter", "محول USB-C إلى VGA", "Anker"),
    ("HUB-USB", "USB hub, 4-port", "موزع USB 4 منافذ", "Anker"),
    ("HUB-USBC", "USB-C hub, 7-in-1", "موزع USB-C 7 في 1", "Anker"),
    ("USB-32G", "USB drive, 32GB", "فلاش USB 32GB", "SanDisk"),
    ("USB-64G", "USB drive, 64GB", "فلاش USB 64GB", "SanDisk"),
    ("USB-128G", "USB drive, 128GB", "فلاش USB 128GB", "SanDisk"),
    ("SSD-1TB", "External SSD, 1TB", "قرص SSD خارجي 1TB", "Samsung"),
    ("SSD-2TB", "External SSD, 2TB", "قرص SSD خارجي 2TB", "Samsung"),
    ("HDD-2TB", "External HDD, 2TB", "قرص HDD خارجي 2TB", "WD"),
    ("HDD-4TB", "External HDD, 4TB", "قرص HDD خارجي 4TB", "WD"),
    ("PRT-LSR-MN", "Mono laser printer", "طابعة ليزر أبيض/أسود", "HP"),
    ("PRT-LSR-CL", "Color laser printer", "طابعة ليزر ملونة", "HP"),
    ("PRT-MFP", "Multifunction printer", "طابعة متعددة الوظائف", "HP"),
    ("TONR-HP-BK", "HP toner, black", "حبر طابعة HP أسود", "HP"),
    ("TONR-HP-CL", "HP toner, color set", "حبر طابعة HP ملون", "HP"),
    ("RTR-WIFI6", "Wi-Fi 6 router", "راوتر Wi-Fi 6", "TP-Link"),
    ("SWCH-8P", "8-port gigabit switch", "سويتش 8 منافذ", "TP-Link"),
    ("SWCH-24P", "24-port gigabit switch", "سويتش 24 منافذ", "TP-Link"),
    ("AP-MESH", "Mesh access point", "نقطة وصول شبكية", "Ubiquiti"),
    ("UPS-650", "UPS 650VA", "مزود طاقة احتياطي 650", "APC"),
    ("UPS-1500", "UPS 1500VA", "مزود طاقة احتياطي 1500", "APC"),
    ("PWR-STRP-6", "Power strip, 6-outlet", "موزع طاقة 6 منافذ", "Belkin"),
    ("PHN-IP", "IP phone", "هاتف IP", "Yealink"),
    ("PHN-CONF", "Conference phone", "هاتف اجتماعات", "Polycom"),
    ("CAM-SEC-IND", "Indoor security camera", "كاميرا مراقبة داخلية", "Hikvision"),
    ("CAM-SEC-OUT", "Outdoor security camera", "كاميرا مراقبة خارجية", "Hikvision"),
    ("NVR-8CH", "8-channel NVR", "جهاز تسجيل 8 قنوات", "Hikvision"),
    ("PROJ-1080", "1080p projector", "بروجكتر 1080p", "Epson"),
    ("PROJ-4K", "4K projector", "بروجكتر 4K", "Epson"),
    ("SCR-PROJ", "Projection screen 100\"", "شاشة عرض 100", "Generic"),
    ("TV-43-4K", "43\" 4K TV", "تلفاز 43 إنش 4K", "Samsung"),
    ("TV-55-4K", "55\" 4K TV", "تلفاز 55 إنش 4K", "Samsung"),
    ("TV-65-4K", "65\" 4K TV", "تلفاز 65 إنش 4K", "Samsung"),
    ("TBL-IPAD", "iPad, 10th gen", "آيباد الجيل 10", "Apple"),
    ("TBL-IPAIR", "iPad Air", "آيباد إير", "Apple"),
    ("TBL-SAM", "Samsung Galaxy Tab", "تابلت سامسونج", "Samsung"),
    ("PHN-IPHN", "iPhone 16", "آيفون 16", "Apple"),
    ("PHN-SAM", "Samsung Galaxy S24", "سامسونج جالاكسي S24", "Samsung"),
    ("BAT-PB-10K", "Power bank 10000mAh", "بطارية محمولة 10000", "Anker"),
    ("CHRG-WL", "Wireless charger", "شاحن لاسلكي", "Anker"),
]

_FURNITURE = [
    ("DSK-OFF-120", "Office desk, 120cm", "مكتب 120 سم", "IKEA"),
    ("DSK-OFF-160", "Office desk, 160cm", "مكتب 160 سم", "IKEA"),
    ("DSK-EXEC", "Executive desk", "مكتب تنفيذي", "Generic"),
    ("DSK-STND", "Sit-stand desk, electric", "مكتب وقوف كهربائي", "Flexispot"),
    ("DSK-CRNR", "Corner desk", "مكتب زاوية", "IKEA"),
    ("DSK-CONF-2M", "Conference table, 2m", "طاولة اجتماعات 2م", "Generic"),
    ("DSK-CONF-3M", "Conference table, 3m", "طاولة اجتماعات 3م", "Generic"),
    ("DSK-CONF-4M", "Conference table, 4m", "طاولة اجتماعات 4م", "Generic"),
    ("CHR-EXEC-BK", "Executive chair, black", "كرسي تنفيذي أسود", "Herman Miller"),
    ("CHR-MGR-BK", "Manager chair, black", "كرسي مدير أسود", "Generic"),
    ("CHR-MGR-GR", "Manager chair, grey", "كرسي مدير رمادي", "Generic"),
    ("CHR-OPS-BK", "Operator chair, black", "كرسي موظف أسود", "Generic"),
    ("CHR-VST-BK", "Visitor chair, black", "كرسي زائر أسود", "Generic"),
    ("CHR-CONF", "Conference chair", "كرسي اجتماعات", "Generic"),
    ("CHR-MSH-AR", "Mesh chair, with arms", "كرسي شبكي بمساند", "Generic"),
    ("CHR-MSH-NA", "Mesh chair, armless", "كرسي شبكي بدون مساند", "Generic"),
    ("CHR-DRFT", "Drafting chair, tall", "كرسي مرتفع", "Generic"),
    ("STL-BAR", "Bar stool", "كرسي بار", "IKEA"),
    ("CAB-FILE-2D", "Filing cabinet, 2-drawer", "خزانة ملفات درجين", "Bisley"),
    ("CAB-FILE-3D", "Filing cabinet, 3-drawer", "خزانة ملفات 3 أدراج", "Bisley"),
    ("CAB-FILE-4D", "Filing cabinet, 4-drawer", "خزانة ملفات 4 أدراج", "Bisley"),
    ("CAB-LATR", "Lateral filing cabinet", "خزانة ملفات أفقية", "Bisley"),
    ("CAB-TLL", "Tall storage cabinet", "خزانة طويلة", "IKEA"),
    ("CAB-MD", "Mid storage cabinet", "خزانة متوسطة", "IKEA"),
    ("BKSHL-5", "Bookshelf, 5-tier", "رف كتب 5 طبقات", "IKEA"),
    ("BKSHL-3", "Bookshelf, 3-tier", "رف كتب 3 طبقات", "IKEA"),
    ("BKSHL-OPN", "Open shelving unit", "رف مفتوح", "IKEA"),
    ("CRDNZ", "Credenza, 160cm", "كردنزا 160 سم", "Generic"),
    ("LCKR-3T", "Locker, 3-door", "خزانة قفل 3 أبواب", "Bisley"),
    ("LCKR-6T", "Locker, 6-door", "خزانة قفل 6 أبواب", "Bisley"),
    ("RECEP-DSK", "Reception desk", "مكتب استقبال", "Generic"),
    ("RECEP-COUNT", "Reception counter", "كاونتر استقبال", "Generic"),
    ("SOFA-3STR", "3-seater sofa", "أريكة 3 مقاعد", "IKEA"),
    ("SOFA-2STR", "2-seater sofa", "أريكة مقعدين", "IKEA"),
    ("SOFA-MOD", "Modular sofa, L-shape", "أريكة مقطعية L", "IKEA"),
    ("ARMC-LNG", "Lounge armchair", "كرسي صالة", "Generic"),
    ("CFTBL-RND", "Round coffee table", "طاولة قهوة دائرية", "IKEA"),
    ("CFTBL-RCT", "Rectangular coffee table", "طاولة قهوة مستطيلة", "IKEA"),
    ("SDTBL", "Side table", "طاولة جانبية", "IKEA"),
    ("BIST-2P", "Bistro table, 2-person", "طاولة بسترو شخصين", "Generic"),
    ("CAFE-4P", "Cafeteria table, 4-person", "طاولة كافتيريا 4 أشخاص", "Generic"),
    ("CAFE-CHR", "Cafeteria chair", "كرسي كافتيريا", "Generic"),
    ("CONF-PHN-TBL", "Phone booth table", "طاولة بوث هاتف", "Generic"),
    ("PHN-BOOTH", "Phone booth pod", "كابينة هاتف", "Framery"),
    ("PRTN-DSK", "Desk privacy screen", "حاجز خصوصية مكتب", "Generic"),
    ("PRTN-FLR", "Floor partition, 1.6m", "حاجز أرضي 1.6م", "Generic"),
    ("WHRBD-ROL", "Rolling whiteboard, 120×90", "سبورة متحركة 120×90", "Generic"),
    ("FLPRT-STD", "Flip chart stand", "حامل فليب شارت", "Generic"),
    ("PSTR-RCK", "Magazine rack", "حامل مجلات", "IKEA"),
    ("CRT-MAIL", "Mail cart", "عربة بريد", "Generic"),
    ("CRT-TROLLEY", "Office trolley", "عربة مكتب", "Generic"),
    ("PRTN-CUB", "Cubicle workstation, 4-person", "كبائن عمل 4 أشخاص", "Generic"),
    ("DRWR-PED", "Mobile pedestal, 3-drawer", "خزانة درج متنقلة", "Bisley"),
    ("FOOTRT", "Adjustable footrest", "مسند قدم", "Fellowes"),
    ("MNTR-ARM", "Single monitor arm", "ذراع شاشة مفردة", "Ergotron"),
    ("MNTR-ARM2", "Dual monitor arm", "ذراع شاشة مزدوجة", "Ergotron"),
    ("KB-TRAY", "Under-desk keyboard tray", "صينية لوحة مفاتيح", "Fellowes"),
    ("LMP-DSK-LED", "LED desk lamp", "مصباح مكتب LED", "Philips"),
    ("LMP-FLR", "Floor lamp", "مصباح أرضي", "IKEA"),
    ("PLNT-FAUX", "Faux indoor plant", "نبتة صناعية", "Generic"),
    ("PLNT-POT", "Plant pot, 30cm", "أصيص نبات 30 سم", "Generic"),
    ("RUG-OFF", "Office rug, 2×3m", "سجادة مكتب 2×3م", "IKEA"),
    ("RUG-CONF", "Conference room rug", "سجادة قاعة اجتماعات", "Generic"),
    ("CLK-WALL", "Wall clock", "ساعة حائط", "Generic"),
    ("SAFE-DESK", "Desk safe, A4", "خزنة مكتب A4", "Yale"),
    ("SAFE-FLR", "Floor safe", "خزنة أرضية", "Yale"),
    ("HMRD-TRSH", "Trash bin, 30L", "سلة مهملات 30 لتر", "Generic"),
    ("RECYC-3B", "Recycling station, 3-bin", "محطة إعادة تدوير 3 سلال", "Generic"),
    ("UMBR-RACK", "Umbrella stand", "حامل مظلات", "Generic"),
    ("WTR-DSP", "Water dispenser, hot/cold", "موزع مياه ساخن/بارد", "Generic"),
    ("FRDG-MINI", "Mini fridge, 90L", "ثلاجة صغيرة 90 لتر", "Toshiba"),
    ("MICRO", "Microwave, 23L", "ميكروويف 23 لتر", "Samsung"),
]


def _seed_category(*, slug: str, name_en: str, name_ar: str, default_uom: str):
    """Idempotent: returns existing category if slug matches, else creates."""
    from apps.catalog.models import Category

    cat, created = Category.objects.get_or_create(
        slug=slug,
        defaults={
            "level": 0, "name_en": name_en, "name_ar": name_ar,
            "default_uom": default_uom, "display_order": 0, "is_active": True,
        },
    )
    return cat


def _seed_master_products(*, category, products, by, count_limit: int):
    """Create up to `count_limit` master products in `category`. Skips ones
    whose sku already exists."""
    from apps.catalog.services import create_master_product

    pack_types = [
        {"code": "EACH", "label_en": "Each", "label_ar": "وحدة", "base_qty": 1, "uom": "PCS"},
        {"code": "BOX", "label_en": "Box", "label_ar": "صندوق", "base_qty": 12, "uom": "BOX"},
        {"code": "CASE", "label_en": "Case", "label_ar": "كرتون", "base_qty": 24, "uom": "CASE"},
    ]

    from apps.catalog.models import MasterProduct

    created_count = 0
    skipped_count = 0
    for sku, name_en, name_ar, brand in products[:count_limit]:
        if MasterProduct.objects.filter(sku=sku).exists():
            skipped_count += 1
            continue
        create_master_product(
            by=by,
            name_en=name_en,
            name_ar=name_ar,
            description_en=f"{name_en} — pre-launch seed.",
            description_ar="منتج مضاف للإطلاق الأولي.",
            category=category,
            sku=sku,
            brand=brand,
            image_keys=[],
            specs={"brand": brand},
            pack_types=pack_types,
        )
        created_count += 1
    return created_count, skipped_count


class Command(BaseCommand):
    help = (
        "R15 — Seed the master catalog with 200+ products across the spec's "
        "three strongest categories: Office Supplies, IT and Electronics, "
        "Furniture. Idempotent — re-running skips existing rows by sku."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--count-per-category", type=int, default=70,
            help="How many products to seed in each of the 3 categories (default 70).",
        )
        parser.add_argument(
            "--actor-email", default=None,
            help="Existing staff user to record as creator (defaults to first superuser).",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        from apps.accounts.models import User

        if opts["actor_email"]:
            actor = User.objects.get(email=opts["actor_email"].lower())
        else:
            actor = User.objects.filter(is_superuser=True).first()
            if actor is None:
                self.stderr.write(self.style.ERROR(
                    "No superuser found. Run `seed_staff` first.",
                ))
                return

        limit = opts["count_per_category"]

        office = _seed_category(
            slug="office-supplies", name_en="Office Supplies",
            name_ar="مستلزمات مكتبية", default_uom="PCS",
        )
        it = _seed_category(
            slug="it-electronics", name_en="IT and Electronics",
            name_ar="تقنية المعلومات والإلكترونيات", default_uom="PCS",
        )
        furniture = _seed_category(
            slug="furniture", name_en="Furniture",
            name_ar="الأثاث", default_uom="PCS",
        )

        total_created = 0
        total_skipped = 0
        for cat, products in (
            (office, _OFFICE_SUPPLIES),
            (it, _IT_AND_ELECTRONICS),
            (furniture, _FURNITURE),
        ):
            c, s = _seed_master_products(
                category=cat, products=products, by=actor, count_limit=limit,
            )
            total_created += c
            total_skipped += s
            self.stdout.write(
                f"  {cat.name_en}: +{c} created, {s} skipped (already present)",
            )

        self.stdout.write(self.style.SUCCESS(
            f"R15 catalog seed complete: {total_created} new master products, "
            f"{total_skipped} skipped.",
        ))
