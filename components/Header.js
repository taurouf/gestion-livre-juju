// components/Header.js
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/books", label: "Livres", auth: true },
  { href: "/books/new", label: "Ajouter", auth: true },
];

export default function Header() {
  const [session, setSession] = useState(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // évite d'avoir "Livres" actif sur /books/new
  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    if (href === "/books") return pathname === "/books";
    return pathname === href;
  };

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      console.warn("signOut:", e?.message);
    } finally {
      setOpen(false);
      router.replace("/");
    }
  }

  const isAuth = !!session;

  // Fermer le menu quand on change de route
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#4E0714] text-white/90 shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
        {/* Branding */}
        <Link href="/" className="shrink-0">
          <div className="leading-tight select-none">
            <div className="text-2xl font-extrabold tracking-tight">Stock</div>
            <div className="text-2xl font-extrabold tracking-tight -mt-1">de livres</div>
            <div className="text-[10px] opacity-75">Next.js • Tailwind • Supabase</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-2">
          {NAV.filter((i) => (i.auth ? isAuth : true)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-full px-3 py-1.5 text-sm transition " +
                (isActive(item.href)
                  ? "bg-white text-[#4E0714] shadow"
                  : "bg-white/10 hover:bg-white/15")
              }
            >
              {item.label}
            </Link>
          ))}
          {isAuth && (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full px-3 py-1.5 text-sm bg-white/10 hover:bg-white/15"
            >
              Se déconnecter
            </button>
          )}
        </nav>

        {/* Burger (mobile) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="sm:hidden inline-flex items-center justify-center rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15"
        >
          {open ? (
            // X
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            // Menu
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <span className="sr-only">Ouvrir le menu</span>
        </button>
      </div>

      {/* Mobile menu (overlay dropdown) */}
      {open && (
        <div
          id="mobile-menu"
          className="sm:hidden border-t border-white/10 bg-[#4E0714]/98 backdrop-blur"
        >
          <div className="max-w-6xl mx-auto px-3 py-3 grid gap-2">
            {NAV.filter((i) => (i.auth ? isAuth : true)).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "block w-full rounded-xl px-4 py-3 text-base text-left transition " +
                  (isActive(item.href)
                    ? "bg-white text-[#4E0714] shadow"
                    : "bg-white/10 hover:bg-white/15")
                }
              >
                {item.label}
              </Link>
            ))}

            {isAuth && (
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-xl px-4 py-3 text-left text-base bg-white/10 hover:bg-white/15"
              >
                Se déconnecter
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
