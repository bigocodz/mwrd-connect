export const CLIENT_INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

export const CLIENT_INVOICE_STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  VOID: "bg-muted text-muted-foreground",
};
