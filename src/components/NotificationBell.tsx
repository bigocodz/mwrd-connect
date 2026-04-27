import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import { useAuth } from "@/hooks/useAuth";
import { Bell01 } from "@untitledui/icons";
import { useLanguage } from "@/contexts/LanguageContext";

const NotificationBell = () => {
  const { profile } = useAuth();
  const { tr, lang } = useLanguage();
  const notifications = useQuery(api.notifications.listMine) ?? [];
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!profile) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#667085] transition-colors hover:bg-[#fff1eb] hover:text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2bb6c8]"
        onClick={() => setOpen(!open)}
        aria-label={tr("Notifications")}
      >
        <Bell01 className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute end-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#eb4f5d] text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-md bg-white shadow-[0_18px_44px_rgba(26,26,26,0.12),0_0_0_1px_rgba(190,184,174,0.42)]">
          <div className="flex items-center justify-between border-b border-[#ece7e1] px-3 py-2">
            <span className="font-display text-base font-semibold text-[#1a1a1a]">{tr("Notifications")}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-semibold text-[#5f625f] hover:bg-[#eef7f8] hover:text-[#1a1a1a]"
                onClick={() => markAllRead()}
              >
                {tr("Mark all read")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#5f625f]">{tr("No notifications")}</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`cursor-pointer border-b border-[#ece7e1] px-3 py-2.5 transition-colors last:border-0 hover:bg-[#f7f8f7] ${
                    !n.read ? "bg-[#fff1eb]" : ""
                  }`}
                  onClick={() => {
                    if (!n.read) markRead({ id: n._id });
                    if (n.link) setOpen(false);
                  }}
                >
                  {n.link ? (
                    <Link to={n.link} className="block" onClick={() => setOpen(false)}>
                      <p className={`text-sm ${!n.read ? "font-semibold text-[#1a1a1a]" : "text-[#5f625f]"}`}>{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs leading-relaxed text-[#5f625f]">{n.message}</p>}
                      <p className="mt-1 text-[10px] tracking-normal text-[#8a8a85]">{new Date(n._creationTime).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA")}</p>
                    </Link>
                  ) : (
                    <>
                      <p className={`text-sm ${!n.read ? "font-semibold text-[#1a1a1a]" : "text-[#5f625f]"}`}>{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs leading-relaxed text-[#5f625f]">{n.message}</p>}
                      <p className="mt-1 text-[10px] tracking-normal text-[#8a8a85]">{new Date(n._creationTime).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA")}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
