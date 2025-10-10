// app/books/library/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

/* ---------- utils ---------- */

function parseLocation(loc) {
  if (!loc) return { shelf: "Non classé", cell: null };
  const m = String(loc).trim().match(/^([A-Za-z]+)\s*([0-9]+)$/);
  if (!m) return { shelf: "Non classé", cell: null };
  return { shelf: m[1].toUpperCase(), cell: Number(m[2]) };
}
function locString(shelf, cell) {
  if (!cell) return shelf;
  return `${shelf}${cell}`;
}
const isMobile = () =>
  typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ============================================================
   PAGE
============================================================ */

export default function LibraryPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState("all"); // 'all' | 'en_stock' | 'vendu'
  const [platforms, setPlatforms] = useState([]);

  const [activeBook, setActiveBook] = useState(null);
  const [movePrompt, setMovePrompt] = useState(null); // {bookId, shelf, cell}
  const [draggingId, setDraggingId] = useState(null);
  const [isTouch, setIsTouch] = useState(false);

  const router = useRouter();

  useEffect(() => {
    setIsTouch(isMobile());
  }, []);

  async function fetchBooks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("id,title,author,cover_url,status,platforms,price,location")
      .order("created_at", { ascending: false });
    if (!error) setBooks(data || []);
    setLoading(false);
  }
  useEffect(() => {
    fetchBooks();
  }, []);

  const allPlatforms = useMemo(() => {
    const s = new Set();
    for (const b of books) (b.platforms || []).forEach((p) => s.add(p));
    return Array.from(s);
  }, [books]);

  const filtered = useMemo(() => {
    return books.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (platforms.length) {
        const set = new Set(b.platforms || []);
        if (!platforms.some((p) => set.has(p))) return false;
      }
      return true;
    });
  }, [books, status, platforms]);

  // groupage: étagère -> {maxCell, cells: Map<number, Book[]>}
  const shelves = useMemo(() => {
    const map = new Map();
    for (const b of filtered) {
      const { shelf, cell } = parseLocation(b.location);
      if (!map.has(shelf)) map.set(shelf, { maxCell: 0, cells: new Map() });
      const entry = map.get(shelf);
      if (cell && cell > entry.maxCell) entry.maxCell = cell;
      const key = cell || 0; // 0 = non classé
      if (!entry.cells.has(key)) entry.cells.set(key, []);
      entry.cells.get(key).push(b);
    }
    const arr = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Non classé") return 1;
      if (b === "Non classé") return -1;
      return a.localeCompare(b);
    });
    return arr;
  }, [filtered]);

  const shelfNames = useMemo(() => shelves.map(([name]) => name), [shelves]);

  /* ---------- Move / Update DB ---------- */

  async function moveBookTo(bookId, shelf, cell) {
    const newLoc = locString(shelf, cell);
    const prev = books;
    setBooks((list) => list.map((b) => (b.id === bookId ? { ...b, location: newLoc } : b)));
    const { error } = await supabase.from("books").update({ location: newLoc }).eq("id", bookId);
    if (error) {
      setBooks(prev);
      alert("Impossible de déplacer le livre (réseau/DB).");
    }
  }

  /* ---------- DnD ---------- */

  function onDragStart(e, book) {
    if (isTouch) return;
    setDraggingId(book.id);
    e.dataTransfer.setData("application/json", JSON.stringify({ id: book.id }));
  }
  function onDragEnd() {
    setDraggingId(null);
  }

  // cellule précise
  function onDragOverCell(e) {
    if (isTouch) return;
    e.preventDefault();
    e.stopPropagation();
  }
  function onDropCell(e, shelf, cell) {
    if (isTouch) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data?.id) moveBookTo(data.id, shelf, cell === null ? null : cell);
    } catch {}
    setDraggingId(null);
  }

  // entête d’étagère → ouvre la modale (pré-remplie)
  function onDragOverShelfHeader(e) {
    if (isTouch) return;
    e.preventDefault();
    e.stopPropagation();
  }
  function onDropShelfHeader(e, shelf) {
    if (isTouch) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data?.id) {
        const entry = shelves.find(([name]) => name === shelf)?.[1];
        const suggested = (entry?.maxCell || 0) + 1 || 1;
        setMovePrompt({ bookId: data.id, shelf, cell: suggested });
      }
    } catch {}
    setDraggingId(null);
  }

  /* ---------- Modal zoom ---------- */

  async function toggleSold(book) {
    const newStatus = book.status === "vendu" ? "en_stock" : "vendu";
    const prev = books;
    setBooks((list) => list.map((b) => (b.id === book.id ? { ...b, status: newStatus } : b)));
    const { error } = await supabase.from("books").update({ status: newStatus }).eq("id", book.id);
    if (error) {
      setBooks(prev);
      alert("Impossible de modifier le statut.");
    } else {
      setActiveBook((b) => (b ? { ...b, status: newStatus } : b));
    }
  }
  function askMoveFromModal(book) {
    const { shelf, cell } = parseLocation(book.location);
    const entry = shelves.find(([name]) => name === shelf)?.[1];
    const suggested = (entry?.maxCell || 0) + 1 || (cell || 1);
    setMovePrompt({ bookId: book.id, shelf, cell: suggested });
  }

  return (
    <>
      {/* aide mobile */}
      <div className="md:hidden px-3 py-2 text-[13px] text-zinc-700">
        Sur mobile, utilisez le bouton <b>Déplacer</b> dans la fiche (pas de drag & drop).
      </div>

      {/* Vue principale */}
      <main className="min-h-screen bg-gradient-to-b from-[#EFD4C4] to-white py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6 md:space-y-8">
          {/* header + filtres */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-[4px] bg-[#AC5B67]" />
              <h1 className="text-2xl md:text-3xl font-bold text-[#4E0714]">Ma bibliothèque</h1>
            </div>

            <div className="bg-white/80 backdrop-blur ring-1 ring-brand-200 rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-700">Statut</span>
                  <div className="bg-brand-50/60 ring-1 ring-brand-200 rounded-xl p-1 flex">
                    <Toggle active={status === "all"} onClick={() => setStatus("all")} label="Tous" />
                    <Toggle active={status === "en_stock"} onClick={() => setStatus("en_stock")} label="En stock" />
                    <Toggle active={status === "vendu"} onClick={() => setStatus("vendu")} label="Vendu" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-700">Plateformes</span>
                  <div className="flex flex-wrap gap-1">
                    {allPlatforms.length ? (
                      allPlatforms.map((p) => (
                        <Chip
                          key={p}
                          label={p}
                          active={platforms.includes(p)}
                          onClick={() =>
                            setPlatforms((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]))
                          }
                        />
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                    {!!platforms.length && (
                      <button
                        type="button"
                        onClick={() => setPlatforms([])}
                        className="text-xs underline text-zinc-700 ml-2"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* contenu */}
          <div className="bg-white/60 rounded-3xl shadow-lg p-4 md:p-6 backdrop-blur">
            {loading ? (
              <div className="h-64 animate-pulse bg-brand-50 rounded-xl" />
            ) : !shelves.length ? (
              <div className="text-zinc-700">Aucun livre pour ces filtres.</div>
            ) : (
              <div className="space-y-10 md:space-y-12">
                {shelves.map(([shelfName, data], idx) => (
                  <ShelfBlock
                    key={shelfName}
                    shelfName={shelfName}
                    data={data}
                    index={idx}
                    onDragOverCell={onDragOverCell}
                    onDropCell={onDropCell}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onShelfDrop={onDropShelfHeader}
                    onShelfDragOver={onDragOverShelfHeader}
                    onOpen={(book) => setActiveBook(book)}
                    touchMode={isTouch}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal zoom */}
      <AnimatePresence>
        {activeBook && (
          <BookModal
            book={activeBook}
            onClose={() => setActiveBook(null)}
            onOpen={() => router.push(`/books/${activeBook.id}`)}
            onEdit={() => router.push(`/books/${activeBook.id}/edit`)}
            onToggle={() => toggleSold(activeBook)}
            onMove={() => askMoveFromModal(activeBook)}
          />
        )}
      </AnimatePresence>

      {/* Move dialog */}
      <AnimatePresence>
        {movePrompt && (
          <MoveDialog
            shelves={shelfNames}
            initialShelf={movePrompt.shelf}
            initialCell={movePrompt.cell}
            onCancel={() => setMovePrompt(null)}
            onConfirm={async ({ shelf, cell }) => {
              await moveBookTo(movePrompt.bookId, shelf, cell);
              setMovePrompt(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   UI atoms
============================================================ */

function Toggle({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-lg text-sm transition " +
        (active ? "bg-[#4E0714] text-white" : "text-[#4E0714] hover:bg-brand-50")
      }
    >
      {label}
    </button>
  );
}
function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-[12px] px-2.5 py-1 rounded-full ring-1 transition " +
        (active
          ? "bg-[#4E0714] text-white ring-[#4E0714]"
          : "bg-white text-[#4E0714] ring-brand-200 hover:bg-brand-50")
      }
      title={label}
    >
      {label}
    </button>
  );
}

/* ============================================================
   Shelves (étagère + cellules multi-livres + DnD précis + highlight)
============================================================ */

function ShelfBlock({
  shelfName,
  data,
  index,
  onDragOverCell,
  onDropCell,
  onDragStart,
  onDragEnd,
  onShelfDrop,
  onShelfDragOver,
  onOpen,
  touchMode,
}) {
  const maxCell = Math.max(data.maxCell || 0, 8);
  const cells = data.cells; // Map<number, Book[]>

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
      className="relative"
    >
      {/* Entête d'étagère — droppable */}
      <div
        className="flex items-center gap-2 mb-3"
        onDragOver={onShelfDragOver}
        onDrop={(e) => onShelfDrop(e, shelfName)}
      >
        <span className="inline-block w-2 h-5 rounded bg-[#AC5B67]" />
        <h2 className="text-xl font-bold text-[#4E0714]">Étagère {shelfName}</h2>
      </div>

      {/* bandeau scrollable de cellules (AFFICHAGE SIMPLE, pas de planches) */}
      <div className="relative overflow-x-auto pb-6">
        <div className="inline-grid grid-flow-col auto-cols-[10.5rem] gap-5 pt-4">
          {Array.from({ length: maxCell }, (_, i) => i + 1).map((num) => {
            const list = cells.get(num) || [];
            return (
              <Cell
                key={num}
                shelf={shelfName}
                num={num}
                books={list}
                touchMode={touchMode}
                onDragOverCell={onDragOverCell}
                onDropCell={onDropCell}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onOpen={onOpen}
              />
            );
          })}

          {cells.has(0) && (
            <Cell
              shelf={shelfName}
              num={0}
              labelOverride="Non classé"
              books={cells.get(0)}
              touchMode={touchMode}
              onDragOverCell={onDragOverCell}
              onDropCell={onDropCell}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onOpen={onOpen}
            />
          )}
        </div>
      </div>
    </motion.section>
  );
}

function Cell({
  shelf,
  num,
  labelOverride,
  books,
  touchMode,
  onDragOverCell,
  onDropCell,
  onDragStart,
  onDragEnd,
  onOpen,
}) {
  const label = labelOverride || `Cellule ${num}`;

  // Highlight local à la cellule
  const [over, setOver] = useState(false);

  const handleOver = (e) => {
    onDragOverCell(e);
    setOver(true);
  };
  const handleEnter = (e) => {
    if (touchMode) return;
    e.preventDefault();
    e.stopPropagation();
    setOver(true);
  };
  const handleLeave = (e) => {
    if (touchMode) return;
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
  };
  const handleDrop = (e) => {
    onDropCell(e, shelf, num === 0 ? null : num);
    setOver(false);
  };

  return (
    <div
      className="relative w-[10.5rem]"
      onDragOver={handleOver}
      onDrop={handleDrop}
      onDragEnter={handleEnter}
      onDragLeave={handleLeave}
    >
      {/* Badge très visible, teinté si over */}
      <div
        className={
          "absolute -top-3 left-2 z-10 text-xs font-semibold px-2.5 py-1 rounded-full shadow " +
          (over ? "bg-[#AC5B67] text-white ring-1 ring-[#AC5B67]" : "bg-white text-[#4E0714] ring-1 ring-[#AC5B67]/30")
        }
      >
        {label}
      </div>

      <div className="relative pt-4">
        <div
          className={
            "min-h-[9.5rem] p-2 rounded-lg border-2 border-dashed bg-brand-50/40 transition " +
            (over ? "ring-2 ring-[#AC5B67] border-[#AC5B67]/40 bg-[#EFD4C4]/50" : "ring-0 border-brand-200")
          }
          onDragOver={handleOver}
          onDrop={handleDrop}
          onDragEnter={handleEnter}
          onDragLeave={handleLeave}
        >
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {books.map((b) => (
                <DraggableBook
                  key={b.id}
                  book={b}
                  touchMode={touchMode}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onOpen={onOpen}
                />
              ))}
            </AnimatePresence>
            {!books.length && (
              <div className="text-center text-xs text-brand-700/70 py-6">— vide —</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DraggableBook({ book, touchMode, onDragStart, onDragEnd, onOpen }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 220, damping: 22, mass: 0.6 }}
      draggable={!touchMode}
      onDragStart={(e) => !touchMode && onDragStart(e, book)}
      onDragEnd={() => !touchMode && onDragEnd()}
      className={"group " + (!touchMode ? "cursor-grab active:cursor-grabbing" : "")}
      title={book.title}
    >
      <button type="button" onClick={() => onOpen(book)} className="w-full text-left">
        <div className="aspect-[2/3] w-full rounded-md overflow-hidden ring-1 ring-brand-100 bg-brand-50 shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={book.cover_url || "/placeholder-cover.png"}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="mt-1">
          <div className="text-[12px] font-medium text-zinc-950 line-clamp-2 leading-tight">
            {book.title}
          </div>
          <div className="text-[11px] text-zinc-600">{book.author || "—"}</div>
        </div>
      </button>
    </motion.div>
  );
}

/* ============================================================
   Modal Zoom / Fiche rapide
============================================================ */

function BookModal({ book, onClose, onOpen, onEdit, onToggle, onMove }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.96, y: 8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="relative z-10 max-w-3xl w-full bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="grid md:grid-cols-[240px_1fr] gap-4 p-4 sm:p-6">
          <div className="rounded-lg overflow-hidden ring-1 ring-brand-100 bg-brand-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={book.cover_url || "/placeholder-cover.png"} alt={book.title} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-zinc-950">{book.title}</h3>
            <p className="text-sm text-zinc-700">{book.author || "—"}</p>

            <div className="pt-2 flex flex-wrap gap-2">
              <button onClick={onOpen} className="rounded-xl px-3 py-1.5 bg-white ring-1 ring-brand-200 hover:bg-brand-50 text-[#4E0714]">
                Ouvrir
              </button>
              <button onClick={onEdit} className="rounded-xl px-3 py-1.5 bg-[#4E0714] text-white hover:brightness-95">
                Éditer
              </button>
              <button
                onClick={onToggle}
                className={
                  "rounded-xl px-3 py-1.5 " +
                  (book.status === "vendu" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white")
                }
              >
                {book.status === "vendu" ? "Remettre en stock" : "Marquer vendu"}
              </button>
              <button onClick={onMove} className="rounded-xl px-3 py-1.5 bg-white ring-1 ring-brand-200 hover:bg-brand-50 text-[#4E0714]">
                Déplacer
              </button>
              <button onClick={onClose} className="ml-auto rounded-xl px-3 py-1.5 bg-white ring-1 ring-brand-200 hover:bg-brand-50">
                Fermer
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================
   MoveDialog — Sélecteur étagère + cellule
============================================================ */

function MoveDialog({ shelves, initialShelf, initialCell, onCancel, onConfirm }) {
  const [shelf, setShelf] = useState(initialShelf || shelves[0] || "A");
  const [cell, setCell] = useState(initialCell || 1);
  const [customShelf, setCustomShelf] = useState("");

  const finalShelf = (customShelf || shelf || "A").toUpperCase();

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.96, y: 8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-[#4E0714]">Déplacer le livre</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm text-zinc-700">Étagère</label>
            <div className="mt-1 flex gap-2">
              <select
                className="flex-1 rounded-xl ring-1 ring-brand-200 px-3 py-2 bg-white"
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
              >
                {shelves.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="w-24 rounded-xl ring-1 ring-brand-200 px-3 py-2"
                placeholder="Autre"
                value={customShelf}
                onChange={(e) => setCustomShelf(e.target.value.replace(/[^A-Za-z]/g, ""))}
                title="Saisir une étagère personnalisée (lettres)"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-700">Cellule</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-32 rounded-xl ring-1 ring-brand-200 px-3 py-2"
              value={cell}
              onChange={(e) => setCell(Math.max(1, Number(e.target.value || 1)))}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-3 py-1.5 bg-white ring-1 ring-brand-200 hover:bg-brand-50">
            Annuler
          </button>
          <button
            onClick={() => onConfirm({ shelf: finalShelf, cell })}
            className="rounded-xl px-3 py-1.5 bg-[#4E0714] text-white hover:brightness-95"
          >
            Déplacer ici
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
