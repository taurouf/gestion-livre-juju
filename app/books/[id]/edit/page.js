// app/books/[id]/edit/page.js
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import BookForm from "../../../../components/BookForm";

export default function EditBookPage() {
  const { id } = useParams(); // ex: "10"
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("books")
        .select(
          // on récupère toutes les colonnes utilisées par TON BookForm
          "id, isbn, title, author, description, publication_date, publisher, language, cover_url, location, platforms, status, price, notes"
        )
        .eq("id", Number(id))
        .single();

      if (!mounted) return;
      if (error) setError(error.message);
      setBook(data || null);
      setLoading(false);
    }
    if (id) load();
    return () => (mounted = false);
  }, [id]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <p className="text-red-600">
          Impossible de charger le livre : {error || "introuvable"}.
        </p>
        <Link href="/books" className="text-[#4E0714] underline">
          ← Retour à la liste
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#4E0714]">Éditer : {book.title}</h1>
        <Link href={`/books/${book.id}`} className="text-sm underline text-zinc-700">
          Voir la fiche
        </Link>
      </div>

      <BookForm
        initialBook={book}
        onSaved={(saved) => router.push(`/books/${saved.id}`)}
        onCancel={() => router.back()}
      />
    </main>
  );
}
