// app/books/[id]/page.js
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

// ----- Helpers -----
const fmtPrice = (val) => {
  const n = typeof val === "number" ? val : Number(val);
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
};

// Icônes inline (pas de dépendance externe)
function Icon({ name, className = "h-4 w-4" }) {
  const paths = {
    barcode:
      "M2 6h1v8H2V6zm3 0h1v8H5V6zm3 0h1v8H8V6zm3 0h2v8h-2V6zm5 0h1v8h-1V6zM1 4h18a1 1 0 011 1v10a1 1 0 01-1 1H1a1 1 0 01-1-1V5a1 1 0 011-1z",
    building:
      "M3 20h18M6 20V6a2 2 0 012-2h8a2 2 0 012 2v14M9 10h6M9 14h6M9 18h6",
    calendar:
      "M7 2v2M17 2v2M3 8h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
    globe:
      "M12 2a10 10 0 100 20 10 10 0 000-20zm0 0s4 3 4 10-4 10-4 10-4-3-4-10S12 2 12 2zm-8 10h16",
    pin:
      "M12 21s7-5.373 7-11a7 7 0 10-14 0c0 5.627 7 11 7 11zm0-9a2 2 0 110-4 2 2 0 010 4z",
    tags:
      "M7 7l10 10a2 2 0 002.828 0l2.172-2.172a2 2 0 000-2.828L12 2H7v5zM7 7H2V2h5v5z",
    badge:
      "M12 1l3.09 6.26L22 8.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 13.14 2 8.27l6.91-1.01L12 1z",
    euro:
      "M17 7H9m10 6H8m-2 0a6 6 0 010-6m0 6a6 6 0 006 6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function Field({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-brand-50/50">
      <div className="mt-0.5 text-brand-700 shrink-0">
        <Icon name={icon} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-brand-700">{label}</div>
        <div className="text-sm font-medium text-brand-900 break-words">
          {children || "—"}
        </div>
      </div>
    </div>
  );
}

// ----- Page -----
export default function BookDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [book, setBook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();
      if (error) alert(error.message);
      setBook(data);
    })();
  }, [id]);

  async function toggleSold() {
    if (!book) return;
    setSaving(true);
    const next = book.status === "en_stock" ? "vendu" : "en_stock";
    const { error, data } = await supabase
      .from("books")
      .update({ status: next })
      .eq("id", book.id)
      .select()
      .single();
    if (error) alert(error.message);
    else setBook(data);
    setSaving(false);
  }

  async function handleDelete() {
    if (!book) return;
    if (!confirm("Supprimer ce livre ?")) return;
    const { error } = await supabase.from("books").delete().eq("id", book.id);
    if (error) alert(error.message);
    else router.push("/books");
  }

  if (!book) return <div className="text-brand-800">Chargement…</div>;

  return (
    <section className="bg-white rounded-2xl shadow-soft p-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[180px,1fr] gap-6">
        {/* Cover */}
        <div className="w-full">
          <div className="w-full h-60 md:h-72 rounded-lg overflow-hidden ring-1 ring-brand-100 bg-brand-50 flex items-center justify-center">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm text-brand-700">Sans cover</span>
            )}
          </div>
        </div>

        {/* Titre + Auteur + Résumé (repliable, sans overlay) */}
        <div>
          <h1 className="text-2xl font-semibold text-brand-900 mb-1">{book.title}</h1>
          <p className="text-brand-800 mb-4">{book.author || "—"}</p>

          <div>
            <article
              className={
                "prose prose-sm max-w-none text-brand-900 transition-all duration-300 " +
                (expanded ? "" : "max-h-64 overflow-hidden")
              }
            >
              <div className="border-l-4 border-brand-300 pl-4">
                <p style={{ whiteSpace: "pre-line" }}>{book.description || "—"}</p>
              </div>
            </article>

            {book.description && book.description.length > 280 && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5
                             bg-brand-600 text-white hover:bg-brand-900 shadow-sm transition"
                >
                  <span className="text-sm font-medium">
                    {expanded ? "Réduire" : "Lire plus"}
                  </span>
                  <svg
                    className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Détails — carte 2 colonnes avec icônes */}
      <div className="mt-6 bg-white ring-1 ring-brand-100 rounded-xl p-4 shadow-soft">
        <h2 className="text-base font-semibold text-brand-900 mb-3">Détails</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field icon="barcode" label="ISBN">
            {book.isbn}
          </Field>

          <Field icon="building" label="Éditeur">
            {book.publisher}
          </Field>

          <Field icon="calendar" label="Publication">
            {book.publication_date}
          </Field>

          <Field icon="globe" label="Langue">
            {book.language}
          </Field>

          <Field icon="pin" label="Emplacement">
            {book.location}
          </Field>

          <Field icon="tags" label="Plateformes">
            {(book.platforms || []).length ? (
              <div className="flex flex-wrap gap-1">
                {book.platforms.map((p) => (
                  <span
                    key={p}
                    className="text-xs px-2 py-0.5 rounded-full bg-brand-300/60 text-brand-900 ring-1 ring-brand-200"
                  >
                    {p}
                  </span>
                ))}
              </div>
            ) : (
              "—"
            )}
          </Field>

          <Field icon="badge" label="Statut">
            <span
              className={
                "text-xs px-2 py-0.5 rounded-full ring-1 whitespace-nowrap " +
                (book.status === "en_stock"
                  ? "bg-green-50 text-green-700 ring-green-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200")
              }
            >
              {book.status === "en_stock" ? "En\u00A0stock" : "Vendu"}
            </span>
          </Field>

          <Field icon="euro" label="Prix">
            <span className="whitespace-nowrap">{fmtPrice(book.price)}</span>
          </Field>
        </div>
      </div>

      {/* Actions — plein largeur en mobile, CENTRÉES en desktop */}
      <div className="mt-6 flex flex-col gap-2 md:flex-row md:justify-center md:gap-3">
        <Link
          href={`/books/${book.id}/edit`}
          className="w-full md:w-auto text-center px-4 py-2 rounded-2xl ring-1 ring-brand-200 hover:bg-brand-50 text-brand-900"
        >
          Éditer
        </Link>

        <button
          onClick={toggleSold}
          disabled={saving}
          className="w-full md:w-auto px-4 py-2 rounded-2xl bg-brand-600 hover:bg-brand-900 text-white disabled:opacity-60"
        >
          {book.status === "en_stock" ? "Marquer comme vendu" : "Remettre en stock"}
        </button>

        <button
          onClick={handleDelete}
          className="w-full md:w-auto px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white"
        >
          Supprimer
        </button>
      </div>
    </section>
  );
}
