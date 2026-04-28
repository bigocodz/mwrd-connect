import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

type Channel = "in_app" | "email" | "sms" | "whatsapp";

/**
 * Per-user-per-event channel opt-in/out (PRD §10.2). Lists every
 * notification event the platform sends, with a row per event and a
 * toggle per supported channel. Missing pref rows mean "send on every
 * wired channel" — channels not yet wired (SMS / WhatsApp) are rendered
 * as disabled with a "coming soon" hint so users can see what's planned.
 */
export const NotificationPrefsCard = () => {
  const { tr, lang } = useLanguage();
  const events = useQuery(api.notificationTemplates.listForPrefsUI) as
    | Array<{
        _id: string;
        event_type: string;
        subject_ar: string;
        subject_en: string;
        description?: string;
      }>
    | undefined;
  const prefs = useQuery(api.notificationTemplates.getMyChannelPrefs) as
    | Array<{
        event_type: string;
        in_app?: boolean;
        email?: boolean;
        sms?: boolean;
        whatsapp?: boolean;
      }>
    | undefined;
  const setPref = useMutation(api.notificationTemplates.setMyChannelPref);

  const prefByEvent = useMemo(() => {
    const m = new Map<string, Record<Channel, boolean | undefined>>();
    (prefs ?? []).forEach((p) =>
      m.set(p.event_type, {
        in_app: p.in_app,
        email: p.email,
        sms: p.sms,
        whatsapp: p.whatsapp,
      }),
    );
    return m;
  }, [prefs]);

  const handleToggle = async (
    event_type: string,
    channel: Channel,
    enabled: boolean,
  ) => {
    try {
      await setPref({ event_type, channel, enabled });
    } catch (err: any) {
      toast.error(err.message || tr("Failed"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("Notification preferences")}</CardTitle>
        <CardDescription>
          {tr("Choose how you receive each kind of update. Defaults send to every wired channel.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events === undefined ? (
          <p className="text-sm text-muted-foreground">{tr("Loading…")}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {tr("No notification templates installed yet.")}
          </p>
        ) : (
          <div className="space-y-1">
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div className="col-span-7">{tr("Event")}</div>
              <div className="col-span-1 text-center">{tr("In-app")}</div>
              <div className="col-span-1 text-center">{tr("Email")}</div>
              <div className="col-span-1 text-center">SMS</div>
              <div className="col-span-2 text-center">WhatsApp</div>
            </div>
            <ul className="divide-y divide-border">
              {events.map((e) => {
                const p = prefByEvent.get(e.event_type) ?? {
                  in_app: true,
                  email: true,
                  sms: false,
                  whatsapp: false,
                };
                const subject = lang === "ar" ? e.subject_ar : e.subject_en;
                return (
                  <li
                    key={e._id}
                    className="grid grid-cols-12 gap-2 items-center py-3 px-2"
                  >
                    <div className="col-span-12 sm:col-span-7">
                      <p className="text-sm font-medium">{subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {e.event_type}
                        </span>
                      </div>
                      {e.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                      )}
                    </div>
                    <div className="col-span-3 sm:col-span-1 flex justify-center">
                      <Switch
                        checked={p.in_app !== false}
                        onCheckedChange={(v) => handleToggle(e.event_type, "in_app", v)}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1 flex justify-center">
                      <Switch
                        checked={p.email !== false}
                        onCheckedChange={(v) => handleToggle(e.event_type, "email", v)}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1 flex justify-center">
                      <Switch
                        checked={!!p.sms}
                        disabled
                        title={tr("Coming soon")}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2 flex justify-center">
                      <Switch
                        checked={!!p.whatsapp}
                        disabled
                        title={tr("Coming soon")}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 pt-3 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {tr("Saved automatically")}
              </Badge>
              <span>{tr("Toggles save as soon as you change them.")}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
