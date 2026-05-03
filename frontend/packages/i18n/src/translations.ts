/**
 * R14 — UI translation dictionaries.
 *
 * Single flat-key store keyed by locale. Add a new key here, then both
 * languages have to update or `t(key)` falls through to the en value
 * (so the app never breaks because a key is missing in ar).
 */
import type { Locale } from "./locale";

export type TranslationKey =
  // header / nav
  | "app.signIn"
  | "app.signOut"
  | "app.loading"
  | "app.dashboard"
  | "app.welcome"
  | "app.toggleLanguage"
  // common
  | "common.cancel"
  | "common.save"
  | "common.submit"
  | "common.edit"
  | "common.delete"
  | "common.create"
  | "common.search"
  | "common.required"
  // catalog
  | "catalog.browse"
  | "catalog.addToRfq"
  | "catalog.addToFavourites"
  | "catalog.addToCatalog"
  | "catalog.search"
  | "catalog.bundles"
  | "catalog.customRequest"
  | "catalog.cantFindIt"
  // RFQ
  | "rfq.list"
  | "rfq.draft"
  | "rfq.published"
  | "rfq.compare"
  | "rfq.awardPerItem"
  | "rfq.awardEntireRfq"
  // cart
  | "cart.title"
  | "cart.continueBrowsing"
  | "cart.saveForLater"
  | "cart.submitRfq"
  | "cart.empty"
  | "cart.expiresInDays"
  // orders / POs
  | "order.list"
  | "order.cpo"
  | "order.spo"
  | "order.transactionRef"
  | "order.confirmReceipt"
  | "order.payInvoice"
  // approval
  | "approval.tree"
  | "approval.tasks"
  | "approval.approve"
  | "approval.reject"
  | "approval.directApprover"
  | "approval.chain"
  // status
  | "status.awaitingApproval"
  | "status.confirmed"
  | "status.inTransit"
  | "status.delivered"
  | "status.completed"
  | "status.cancelled";

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    "app.signIn": "Sign in",
    "app.signOut": "Sign out",
    "app.loading": "Loading…",
    "app.dashboard": "Dashboard",
    "app.welcome": "Welcome",
    "app.toggleLanguage": "العربية",

    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.submit": "Submit",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.create": "Create",
    "common.search": "Search",
    "common.required": "Required",

    "catalog.browse": "Browse Catalog",
    "catalog.addToRfq": "Add to RFQ",
    "catalog.addToFavourites": "Add to Favourites",
    "catalog.addToCatalog": "Add to Catalog",
    "catalog.search": "Search the catalog",
    "catalog.bundles": "Essentials Packs",
    "catalog.customRequest": "Submit a Custom Request",
    "catalog.cantFindIt": "Can't find what you need?",

    "rfq.list": "RFQs",
    "rfq.draft": "Draft",
    "rfq.published": "Published",
    "rfq.compare": "Compare quotes",
    "rfq.awardPerItem": "Confirm Per-Item Award (creates split CPOs)",
    "rfq.awardEntireRfq": "Award Entire RFQ to ONE Supplier",

    "cart.title": "Cart",
    "cart.continueBrowsing": "Continue Browsing",
    "cart.saveForLater": "Save for Later",
    "cart.submitRfq": "Submit RFQ",
    "cart.empty": "Your cart is empty.",
    "cart.expiresInDays": "Expires in {days} working days",

    "order.list": "Orders",
    "order.cpo": "Client PO",
    "order.spo": "Supplier PO",
    "order.transactionRef": "Transaction reference",
    "order.confirmReceipt": "Confirm Receipt",
    "order.payInvoice": "Pay Invoice",

    "approval.tree": "Approval Tree",
    "approval.tasks": "Approval tasks",
    "approval.approve": "Approve",
    "approval.reject": "Reject with note",
    "approval.directApprover": "Direct Approver",
    "approval.chain": "Chain",

    "status.awaitingApproval": "Awaiting approval",
    "status.confirmed": "Confirmed",
    "status.inTransit": "In transit",
    "status.delivered": "Delivered",
    "status.completed": "Completed",
    "status.cancelled": "Cancelled",
  },
  ar: {
    "app.signIn": "تسجيل الدخول",
    "app.signOut": "تسجيل الخروج",
    "app.loading": "جاري التحميل…",
    "app.dashboard": "لوحة التحكم",
    "app.welcome": "مرحباً",
    "app.toggleLanguage": "English",

    "common.cancel": "إلغاء",
    "common.save": "حفظ",
    "common.submit": "إرسال",
    "common.edit": "تعديل",
    "common.delete": "حذف",
    "common.create": "إنشاء",
    "common.search": "بحث",
    "common.required": "مطلوب",

    "catalog.browse": "تصفح الكتالوج",
    "catalog.addToRfq": "إضافة إلى طلب الأسعار",
    "catalog.addToFavourites": "إضافة إلى المفضلة",
    "catalog.addToCatalog": "إضافة إلى الكتالوج",
    "catalog.search": "ابحث في الكتالوج",
    "catalog.bundles": "حزم أساسية",
    "catalog.customRequest": "إرسال طلب مخصص",
    "catalog.cantFindIt": "لم تجد ما تبحث عنه؟",

    "rfq.list": "طلبات الأسعار",
    "rfq.draft": "مسودة",
    "rfq.published": "منشور",
    "rfq.compare": "مقارنة العروض",
    "rfq.awardPerItem": "ترسية لكل بند (إنشاء أوامر شراء مقسّمة)",
    "rfq.awardEntireRfq": "ترسية كامل الطلب لمورد واحد",

    "cart.title": "السلة",
    "cart.continueBrowsing": "متابعة التصفح",
    "cart.saveForLater": "حفظ لوقت لاحق",
    "cart.submitRfq": "إرسال طلب الأسعار",
    "cart.empty": "السلة فارغة.",
    "cart.expiresInDays": "تنتهي خلال {days} أيام عمل",

    "order.list": "الطلبات",
    "order.cpo": "أمر شراء العميل",
    "order.spo": "أمر شراء المورد",
    "order.transactionRef": "مرجع المعاملة",
    "order.confirmReceipt": "تأكيد الاستلام",
    "order.payInvoice": "دفع الفاتورة",

    "approval.tree": "شجرة الاعتماد",
    "approval.tasks": "مهام الاعتماد",
    "approval.approve": "اعتماد",
    "approval.reject": "رفض مع ملاحظة",
    "approval.directApprover": "المعتمد المباشر",
    "approval.chain": "السلسلة",

    "status.awaitingApproval": "بانتظار الاعتماد",
    "status.confirmed": "مؤكد",
    "status.inTransit": "قيد التوصيل",
    "status.delivered": "تم التسليم",
    "status.completed": "مكتمل",
    "status.cancelled": "ملغي",
  },
};
