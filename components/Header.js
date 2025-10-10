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
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

 const isActive = (href) => {
  if (href === "/") return pathname === "/";
  if (href === "/books") return pathname === "/books";     // match exact
  return pathname === href;                                 // exact pour les autres
};


  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const isAuth = !!session;

  return (
    <header className="sticky top-0 z-40 bg-[#4E0714] text-white/90">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
        {/* Branding */}
        <Link href="/" className="shrink-0">
          <div className="leading-tight">
            <div className="text-2xl font-extrabold tracking-tight">Stock</div>
            <div className="text-2xl font-extrabold tracking-tight -mt-1">de livres</div>
            <div className="text-[10px] opacity-75">Next.js + Tailwind + Supabase</div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
          {NAV.filter((i) => (i.auth ? isAuth : true)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-full px-3 py-1.5 text-sm/none transition " +
                (isActive(item.href)
                  ? "bg-white text-[#4E0714]"
                  : "bg-white/10 hover:bg-white/15")
              }
            >
              {item.label}
            </Link>
          ))}

          {/* Auth button — visible seulement si connecté */}
          {isAuth && (
            <button
              onClick={handleSignOut}
              className="ml-1 rounded-full px-3 py-1.5 text-sm bg-white/10 hover:bg-white/15"
            >
              Se déconnecter
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
