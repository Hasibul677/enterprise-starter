"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return <span className="text-sm text-ink-soft">Dashboard</span>;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-soft">
      {segments.map((seg, i) => (
        <Fragment key={seg + i}>
          {i > 0 && <span>/</span>}
          <span className={i === segments.length - 1 ? "text-ink" : ""}>
            {seg.charAt(0).toUpperCase() + seg.slice(1)}
          </span>
        </Fragment>
      ))}
    </nav>
  );
}
