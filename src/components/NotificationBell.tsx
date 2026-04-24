"use client";

import { useEffect, useRef, useState } from "react";

type Notification = {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  actorImage: string | null;
};

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/notifications");
      const t = await r.text();
      if (!t) return;
      const data = JSON.parse(t);
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* quiet */
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) {
            setTimeout(markAllRead, 400);
          }
        }}
        className="relative rounded-2xl border border-[#1b271f]/10 bg-[#fffaf0] size-10 grid place-items-center text-sm hover:border-[#172019] transition"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#b6522b] text-[0.58rem] font-black text-[#fffaf0] grid place-items-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[22rem] max-w-[calc(100vw-2rem)] rounded-[1.4rem] border border-[#1b271f]/10 bg-[#fffaf0] shadow-[0_24px_80px_rgba(23,32,25,0.25)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1b271f]/10 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#172019]">Notifications</p>
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-[0.62rem] font-black text-[#667064] hover:text-[#172019]">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm font-semibold text-[#899083]">
                No notifications yet. Invite some friends and check in somewhere.
              </p>
            ) : (
              items.map((n) => {
                const p = n.payload as { name?: string; category?: string; lat?: number; lng?: number };
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[#1b271f]/5 last:border-0 ${n.read ? "" : "bg-[#eadfca]/30"}`}
                  >
                    {n.actorImage ? (
                      <img src={n.actorImage} alt="" className="size-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="size-9 rounded-full bg-[#1f6b5d] grid place-items-center text-xs font-black text-[#fffaf0] flex-shrink-0">
                        {(n.actorName ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {n.kind === "checkin" ? (
                        <p className="text-sm font-bold text-[#172019] leading-5">
                          <span className="font-black">{n.actorName ?? "Someone"}</span>{" "}
                          checked in at{" "}
                          <span className="font-black">{p.name ?? "a place"}</span>
                          {p.category && <span className="text-[#667064]"> · {p.category}</span>}
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-[#172019] leading-5">
                          <span className="font-black">{n.actorName ?? "Someone"}</span> · {n.kind}
                        </p>
                      )}
                      <p className="text-[0.62rem] font-bold text-[#899083] mt-0.5">
                        {relTime(n.createdAt)} ago
                        {p.lat != null && p.lng != null && (
                          <span className="ml-1">· {Number(p.lat).toFixed(3)}, {Number(p.lng).toFixed(3)}</span>
                        )}
                      </p>
                    </div>
                    {!n.read && <span className="size-2 rounded-full bg-[#b6522b] mt-2 flex-shrink-0" aria-label="unread" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
