// app/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import BookCarousel from "../components/BookCarousel";

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [latest, setLatest] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(true);

  useEffect(() => {
    let mounted = true;

    // session initiale
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
    });

    // écouter les changements (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, _session) => {
      setSession(_session);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // fetch derniers livres seulement si connecté
  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoadingLatest(true);
      const { data, error } = await supabase
        .from("books")
        .select("id,title,author,cover_url,platforms")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!error) setLatest(data || []);
      setLoadingLatest(false);
    })();
  }, [session]);

  if (!session) return <PublicLanding />;

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-brand-900">
              Stock de livres
            </h1>
            <p className="mt-3 text-brand-800 text-lg">
              Gérez vos livres, prix, plateformes et ventes en toute simplicité.
            </p>
          </div>
          <Link
            href="/books/new"
            className="bg-brand-600 hover:bg-brand-900 text-white rounded-2xl px-4 py-2"
          >
            + Ajouter un livre
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-brand-900">Derniers ajouts</h2>
        </div>
        {loadingLatest ? (
          <div className="h-48 rounded-xl bg-brand-50 animate-pulse" />
        ) : (
          <BookCarousel books={latest} />
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">Tous les livres</h2>
          <Link href="/books" className="text-brand-700 hover:text-brand-900 underline">
            Voir la liste
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ----------------------- */
/* Landing publique (non connecté) */
/* ----------------------- */

function PublicLanding() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSendMagicLink(e) {
    e.preventDefault();
    setError("");
    if (!email) return;
    try {
      setSending(true);
      // Invite-only: seules les adresses invitées recevront le lien
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || "Impossible d’envoyer le lien.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="w-full max-w-3xl px-4">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-block rounded-full px-3 py-1 text-xs bg-brand-300/40 text-brand-900 ring-1 ring-brand-200 mb-3">
            Next.js • Tailwind • Supabase
          </div>
         <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-brand-900">
              Stock de livres
            </h1>
            <p className="mt-3 text-brand-800 text-lg">
              Gérez vos livres, prix, plateformes et ventes en toute simplicité.
            </p>
        </div>

        {/* Carte connexion */}
        <div className="mt-6 bg-white/95 backdrop-blur rounded-2xl shadow-soft ring-1 ring-brand-100 p-4 sm:p-6">
          <form onSubmit={handleSendMagicLink} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="email"
              required
              placeholder="Votre email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl ring-1 ring-brand-200 focus:ring-2 focus:ring-brand-600 px-3 py-2"
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-brand-600 hover:bg-brand-900 text-white px-4 py-2 disabled:opacity-60"
            >
              {sending ? "Envoi…" : "Recevoir le lien"}
            </button>
          </form>

          {sent && (
            <p className="mt-3 text-sm text-emerald-700">
              Lien envoyé 🎉 — vérifiez votre boîte mail.
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-brand-700">
            <p>Accès sur invitation uniquement.</p>
            <p>Nous n’utilisons votre email que pour la connexion.</p>
          </div>
        </div>

        {/* Features mini */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <FeatureCard title="Scan ISBN (mobile)">
            Scannez un code EAN-13 et remplissez la fiche automatiquement.
          </FeatureCard>
          <FeatureCard title="Recherche intelligente">
            Trouvez un titre même avec une frappe approximative.
          </FeatureCard>
          <FeatureCard title="UI moderne">
            Palette personnalisée, cartes élégantes, carrousel embelli.
          </FeatureCard>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, children }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-xl ring-1 ring-brand-100 p-4 shadow-soft">
      <h3 className="font-semibold text-brand-900">{title}</h3>
      <p className="text-sm text-brand-800 mt-1">{children}</p>
    </div>
  );
}
