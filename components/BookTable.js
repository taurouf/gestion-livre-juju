"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Miniature couverture
function CoverCell({ url, title }) {
  return (
    <div className="w-14 h-20 rounded-md overflow-hidden bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] text-brand-700 px-1 text-center">Sans cover</span>
      )}
    </div>
  );
}

// Format prix en €
const fmtPrice = (val) => {
  const n = typeof val === "number" ? val : Number(val);
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
};

export default function BookTable({ books = [], loading, onToggleSold }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredBooks = useMemo(() => {
    if (!normalizedQuery) return books;
    return books.filter((book) => (book.title || "").toLowerCase().includes(normalizedQuery));
  }, [books, normalizedQuery]);

  if (loading) return <div className="text-brand-800">Chargement…</div>;
  if (!books.length) return <div className="text-brand-800">Aucun livre.</div>;

  return (
    <div className="rounded-2xl ring-1 ring-brand-100 bg-white">
      <div className="px-4 py-3 border-b border-brand-100">
        <label htmlFor="book-search" className="sr-only">
          Rechercher un livre par son titre
        </label>
        <input
          id="book-search"
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un livre par titre…"
          className="w-full md:w-80 px-3 py-2 text-sm rounded-xl border border-brand-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-200/80 focus:outline-none text-brand-900 placeholder-brand-400 transition"
        />
      </div>
      {/* 👇 wrapper scrollable en mobile */}
      <div className="overflow-x-auto md:overflow-x-visible px-4 pb-4">
        <table className="min-w-[900px] md:min-w-full text-sm">
          <thead className="bg-brand-300/50 text-brand-900">
            <tr>
              <th className="text-left px-4 py-3">Couverture</th>
              <th className="text-left px-4 py-3">Titre</th>
              <th className="text-left px-4 py-3">Auteur</th>
              <th className="text-left px-4 py-3">Plateformes</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Prix</th>
              <th className="px-4 py-3 text-center">Emplacement</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-brand-100">
            {filteredBooks.length ? (
              filteredBooks.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/books/${b.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/books/${b.id}`);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer transition hover:bg-brand-50/60 focus:bg-brand-50/80"
                >
                  <td className="px-4 py-3">
                    <CoverCell url={b.cover_url} title={b.title} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-brand-900">{b.title}</div>
                    <div className="text-brand-700 text-xs">{b.isbn || "—"}</div>
                  </td>

                  <td className="px-4 py-3 text-brand-800">{b.author || "—"}</td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(b.platforms || []).length ? (
                        b.platforms.map((p) => (
                          <span
                            key={p}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-brand-300/60 text-brand-900 ring-1 ring-brand-200"
                          >
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-brand-700">—</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded-full ring-1 whitespace-nowrap " +
                        (b.status === "en_stock"
                          ? "bg-green-50 text-green-700 ring-green-200"
                          : "bg-rose-50 text-rose-700 ring-rose-200")
                      }
                    >
                      {b.status === "en_stock" ? "En\u00A0stock" : "Vendu"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-brand-900">
                    <span className="whitespace-nowrap">{fmtPrice(b.price)}</span>
                  </td>

                  <td className="px-4 py-3 text-brand-800 text-center">{b.location || "—"}</td>

                  {/* Actions (desktop) */}
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/books/${b.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-xl ring-1 ring-brand-200 bg-white/80 hover:bg-white text-brand-900 backdrop-blur transition"
                      >
                        Ouvrir
                      </Link>

                      <Link
                        href={`/books/${b.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-900 text-white transition"
                      >
                        Éditer
                      </Link>

                      {b.status === "en_stock" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSold && onToggleSold(b);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition"
                          title="Marquer comme vendu"
                        >
                          Vendu
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                          Vendu
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-brand-700">
                  Aucun livre ne correspond à « {searchTerm} ».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* fin wrapper scrollable */}
    </div>
  );
}
