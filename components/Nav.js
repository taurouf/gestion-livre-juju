"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/books", label: "Livres" },
  { href: "/books/new", label: "Ajouter" },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  if (href === "/books/new") return pathname === "/books/new";
  if (href === "/books") {
    // /books ou /books/<id> ou /books/<id>/edit
    return pathname === "/books" ||
           (pathname.startsWith("/books/") && !pathname.startsWith("/books/new"));
  }
  return pathname === href;
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="mt-3">
      <ul className="flex flex-wrap gap-2">
        {links.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={
                  "px-3 py-1.5 rounded-2xl ring-1 transition " +
                  (active
                    ? "bg-white text-brand-900 ring-white"
                    : "bg-white/10 text-white hover:bg-white/20 ring-white/20")
                }
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
