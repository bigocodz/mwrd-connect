export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
};

export const CONTRACT_STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-green-100 text-green-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  TERMINATED: "bg-red-100 text-red-800",
};
