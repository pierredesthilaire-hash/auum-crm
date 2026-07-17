"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/pipe", label: "Pipe", icon: "☰", enabled: true },
  { href: "/clients", label: "Mes clients", icon: "⌂", enabled: true },
  { href: "/dashboard", label: "Dashboard", icon: "◈", enabled: false },
  { href: "/cockpit", label: "Cockpit direction", icon: "◎", enabled: false, directionOnly: true },
];

export function Sidebar({ isDirection }: { isDirection: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-[212px] min-w-[212px] flex-col p-4"
      style={{
        background: "linear-gradient(180deg, var(--pine) 0%, var(--pine2) 100%)",
        color: "#EAF3EE",
      }}
    >
      <div className="font-display px-2 pt-0.5 text-[26px] font-bold leading-none tracking-tight text-white">
        auum<span style={{ color: "#59D2B0" }}>.</span>
      </div>
      <div className="px-2 pb-4 pt-1 text-[10.5px] uppercase tracking-wide" style={{ color: "#8FBCA9" }}>
        CRM Ventes
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.filter((item) => !item.directionOnly || isDirection).map((item) => {
          const active = pathname.startsWith(item.href);
          if (!item.enabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium opacity-40"
                style={{ color: "#C9DED3" }}
                title="Bientôt disponible"
              >
                <span className="w-[17px] text-center">{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[9px] uppercase">bientôt</span>
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors"
              style={
                active
                  ? { background: "rgba(89,210,176,.16)", color: "#fff", boxShadow: "inset 2.5px 0 0 #59D2B0" }
                  : { color: "#C9DED3" }
              }
            >
              <span className="w-[17px] text-center opacity-85">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
