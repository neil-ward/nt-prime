"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/",          label: "Home"          },
  { href: "/about",     label: "About"         },
  { href: "/compare",   label: "Explore"       },
  { href: "/explore",   label: "Patterns"      },
  { href: "/browse",    label: "Commands"      },
  { href: "/analytics", label: "User Behavior" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 h-12 flex items-center justify-between px-6 lg:px-10 bg-surface border-b border-stone-200"
      style={{ height: "var(--nav-h)" }}
    >
      {/* Wordmark */}
      <Link href="/" className="flex items-baseline gap-2 group">
        <span className="text-sm font-serif font-semibold text-stone-900 tracking-tight group-hover:text-ds-a transition-colors">
          NT Prime
        </span>
        <span className="hidden sm:inline text-[10px] font-medium text-stone-400 uppercase tracking-widest">
          Interactive Explorer
        </span>
      </Link>

      {/* Links */}
      <ul className="flex items-center gap-1">
        {LINKS.map(({ href, label }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`
                  px-3 py-1.5 rounded text-xs font-medium transition-colors
                  ${active
                    ? "text-stone-900 bg-stone-100"
                    : "text-stone-400 hover:text-stone-700 hover:bg-stone-50"
                  }
                `}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
