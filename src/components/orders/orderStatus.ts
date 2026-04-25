export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: "Pending confirmation",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-indigo-100 text-indigo-800",
  DISPATCHED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export const ORDER_EVENT_LABEL: Record<string, string> = {
  CREATED: "Order created",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NOTE: "Note",
  TRACKING_UPDATED: "Tracking updated",
  POD_UPLOADED: "Proof of delivery uploaded",
  DISPUTE_OPENED: "Dispute opened",
  DISPUTE_RESOLVED: "Dispute resolved",
  DISPUTE_REJECTED: "Dispute closed",
};

export const DISPUTE_BADGE_COLOR: Record<string, string> = {
  OPEN: "bg-red-100 text-red-800",
  RESOLVED: "bg-green-100 text-green-800",
  REJECTED: "bg-muted text-muted-foreground",
};

export const DISPUTE_LABEL: Record<string, string> = {
  OPEN: "Open dispute",
  RESOLVED: "Dispute resolved",
  REJECTED: "Dispute closed",
};
