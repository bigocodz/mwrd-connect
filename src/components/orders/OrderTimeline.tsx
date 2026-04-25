import { Badge } from "@/components/ui/badge";
import { ORDER_EVENT_LABEL } from "./orderStatus";
import { useLanguage } from "@/contexts/LanguageContext";

export const OrderTimeline = ({ events }: { events: any[] }) => {
  const { tr, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-SA";
  const enumLabel = (value?: string) => {
    if (!value) return "";
    if (lang === "ar") return tr(value);
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (!events?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{tr("Timeline")}</p>
      <ol className="space-y-2">
        {events.map((event: any) => (
          <li key={event._id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{enumLabel(event.actor_role)}</Badge>
                <span className="font-medium">{tr(ORDER_EVENT_LABEL[event.event_type] ?? enumLabel(event.event_type))}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString(locale)}
              </span>
            </div>
            {event.message && <p className="mt-2 text-muted-foreground">{event.message}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
};
