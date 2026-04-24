import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cvx/api";
import { useAuth } from "@/hooks/useAuth";
import { Bell01 } from "@untitledui/icons";

const NotificationBell = () => {
  const { profile } = useAuth();
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
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#5e5d59] transition-colors hover:bg-[#e8e6dc] hover:text-[#141413]"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell01 className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute end-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#b53333] text-[10px] font-medium text-[#faf9f5]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl bg-[#faf9f5] shadow-[0_12px_36px_rgba(20,20,19,0.08),0_0_0_1px_#e8e6dc]">
          <div className="flex items-center justify-between border-b border-[#f0eee6] px-3 py-2">
            <span className="font-display text-base font-medium text-[#141413]">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-medium text-[#5e5d59] hover:bg-[#e8e6dc] hover:text-[#141413]"
                onClick={() => markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#5e5d59]">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`cursor-pointer border-b border-[#f0eee6] px-3 py-2.5 transition-colors last:border-0 hover:bg-[#e8e6dc] ${
                    !n.read ? "bg-[#fbf3ef]" : ""
                  }`}
                  onClick={() => {
                    if (!n.read) markRead({ id: n._id });
                    if (n.link) setOpen(false);
                  }}
                >
                  {n.link ? (
                    <Link to={n.link} className="block" onClick={() => setOpen(false)}>
                      <p className={`text-sm ${!n.read ? "font-medium text-[#141413]" : "text-[#5e5d59]"}`}>{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs leading-relaxed text-[#5e5d59]">{n.message}</p>}
                      <p className="mt-1 text-[10px] tracking-[0.5px] text-[#87867f]">{new Date(n._creationTime).toLocaleString()}</p>
                    </Link>
                  ) : (
                    <>
                      <p className={`text-sm ${!n.read ? "font-medium text-[#141413]" : "text-[#5e5d59]"}`}>{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs leading-relaxed text-[#5e5d59]">{n.message}</p>}
                      <p className="mt-1 text-[10px] tracking-[0.5px] text-[#87867f]">{new Date(n._creationTime).toLocaleString()}</p>
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
