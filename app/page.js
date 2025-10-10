// app/page.js
"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";
import BookCarousel from "../components/BookCarousel";

export default function HomePage() {
  const [latest, setLatest] = useState([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("books")
        .select("id,title,author,cover_url,platforms")
        .order("created_at", { ascending: false })
        .limit(20); // 20 derniers
      if (!error) setLatest(data || []);
    })();
  }, []);

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-brand-900">Bienvenue 👋</h1>
            <p className="text-brand-800">Gère ton stock de livres en un clin d’œil.</p>
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
        <BookCarousel books={latest} />
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
