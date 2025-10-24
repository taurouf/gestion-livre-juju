// components/BookForm.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import IsbnScanner from "./IsbnScanner";

const EMPTY = {
  isbn: "",
  title: "",
  author: "",
  description: "",
  publication_date: "",
  publisher: "",
  language: "",
  cover_url: "",
  location: "",
  platforms: [],
  status: "en_stock",
  price: "",
  notes: "",
};

// -------- helpers image --------
async function downscaleToJpeg(file, maxW = 1200, maxH = 1200, quality = 0.85) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  let { width, height } = img;
  const ratio = Math.min(maxW / width, maxH / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  URL.revokeObjectURL(url);
  return blob;
}
function randomName(ext = "jpg") {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
}

/** Convertit un code OpenLibrary (`eng`, `fre`, etc.) en libellé friendly */
function mapLangCodeToLabel(code) {
  if (!code) return "";
  const map = {
    eng: "English",
    fre: "Français",
    fra: "Français",
    spa: "Español",
    ita: "Italiano",
    deu: "Deutsch",
    ger: "Deutsch",
    por: "Português",
    rus: "Русский",
    jpn: "日本語",
    zho: "中文",
  };
  return map[code.toLowerCase()] || code;
}

/** Best-effort translation EN/other → FR (silencieux si CORS/échec) */
async function translateToFr(text) {
  if (!text || text.length < 3) return text;
  try {
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: "fr",
        format: "text",
      }),
    });
    if (!res.ok) return text;
    const json = await res.json();
    return json?.translatedText || text;
  } catch {
    return text;
  }
}

export default function BookForm({ initialBook = null, onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState(null);
  const isSuccessToast = toast?.type === "success";
  const isEdit = !!(initialBook && initialBook.id);

  // upload cover
  const fileRef = useRef(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (initialBook) {
      setForm({
        ...EMPTY,
        ...initialBook,
        price: initialBook.price ?? "",
        platforms: Array.isArray(initialBook.platforms)
          ? initialBook.platforms
          : [],
      });
    }
  }, [initialBook]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
    return () => clearTimeout(timer);
  }, [toast]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function togglePlatform(p) {
    setForm((f) => {
      const exists = f.platforms?.includes(p);
      return {
        ...f,
        platforms: exists
          ? f.platforms.filter((x) => x !== p)
          : [...(f.platforms || []), p],
      };
    });
  }

  const canSubmit = useMemo(() => {
    return form.isbn.trim() && form.title.trim() && form.author.trim();
  }, [form.isbn, form.title, form.author]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      const payload = {
        isbn: form.isbn.trim(),
        title: form.title.trim(),
        author: form.author.trim(),
        description: form.description?.trim() || null,
        publication_date: form.publication_date?.trim() || null,
        publisher: form.publisher?.trim() || null,
        language: form.language?.trim() || null,
        cover_url: form.cover_url?.trim() || null,
        location: form.location?.trim() || null,
        platforms: form.platforms || [],
        status: form.status,
        price:
          form.price === "" || form.price === null
            ? null
            : Number(form.price),
        notes: form.notes?.trim() || null,
      };

      let result;
      if (isEdit) {
        result = await supabase
          .from("books")
          .update(payload)
          .eq("id", initialBook.id)
          .select()
          .single();
      } else {
        result = await supabase.from("books").insert(payload).select().single();
      }

      if (result.error) throw result.error;
      onSaved?.(result.data);
      setToast({
        message: isEdit ? "Modifications enregistrées avec succès." : "Livre créé avec succès.",
        type: "success",
      });
      if (!isEdit) setForm(EMPTY);
    } catch (err) {
      alert(err.message || "Erreur lors de l’enregistrement");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------
  // Auto-fill multi-sources (BnF → Google → OpenLibrary via /api/isbn)
  // ÉCRASE TOUJOURS LES CHAMPS QUAND L’API FOURNIT UNE VALEUR
  // ---------------------------
  async function handleAutoFill() {
    const raw = (form.isbn || "").replace(/\D/g, "");
    if (!raw) return;
    setAutofilling(true);

    try {
      // endpoint serveur qui tente BnF → Google → OpenLibrary
      const r = await fetch(`/api/isbn?isbn=${raw}`, { cache: "no-store" });

      let info = null;
      if (r.ok) {
        info = await r.json();
      } else {
        // fallback OpenLibrary direct (ultime secours)
        info = await fallbackOpenLibrary(raw);
        if (!info) throw new Error("Livre introuvable sur les sources configurées.");
      }

      // Description → tentative de traduction FR (silencieuse si échec)
      let description = info.description || "";
      if (description) {
        try {
          const translated = await translateToFr(description);
          if (translated) description = translated;
        } catch {}
      }

      // Map langue si code court
      let language = info.language || "";
      if (language && language.length <= 3) {
        language = mapLangCodeToLabel(language) || language;
      }

      // ÉCRASE tout ce qui arrive non vide
      setForm((prev) => ({
        ...prev,
        isbn: raw.slice(0, 13),
        title: info.title || prev.title,
        author: info.author || prev.author,
        publisher: info.publisher || prev.publisher,
        publication_date: info.publication_date || prev.publication_date,
        language: language || prev.language,
        cover_url: info.cover_url || prev.cover_url,
        description: description || prev.description,
      }));
    } catch (e) {
      alert(e.message || "Échec de la récupération via ISBN.");
    } finally {
      setAutofilling(false);
    }
  }

  // Fallback OpenLibrary au cas où /api/isbn ne trouve rien
  async function fallbackOpenLibrary(isbn) {
    try {
      const rBook = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
      if (!rBook.ok) return null;
      const bookJson = await rBook.json();

      let title = bookJson.title || "";
      let author = "";
      if (Array.isArray(bookJson.authors) && bookJson.authors[0]?.key) {
        try {
          const aRes = await fetch(`https://openlibrary.org${bookJson.authors[0].key}.json`);
          if (aRes.ok) {
            const aJson = await aRes.json();
            author = aJson?.name || "";
          }
        } catch {}
      }

      const publisher =
        (Array.isArray(bookJson.publishers) && bookJson.publishers[0]) ||
        bookJson.publisher ||
        "";

      const publication_date = bookJson.publish_date || bookJson.publishDate || "";

      // langue brute
      let language = "";
      if (Array.isArray(bookJson.languages) && bookJson.languages[0]?.key) {
        language = bookJson.languages[0].key.split("/").pop();
      }

      let cover_url = "";
      if (bookJson.covers && bookJson.covers[0]) {
        cover_url = `https://covers.openlibrary.org/b/id/${bookJson.covers[0]}-L.jpg`;
      } else if (bookJson.cover && typeof bookJson.cover === "string") {
        cover_url = bookJson.cover;
      } else {
        cover_url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
      }

      // Description depuis /works
      let description = "";
      if (Array.isArray(bookJson.works) && bookJson.works[0]?.key) {
        try {
          const wRes = await fetch(`https://openlibrary.org${bookJson.works[0].key}.json`);
          if (wRes.ok) {
            const wJson = await wRes.json();
            const rawDesc =
              typeof wJson.description === "string"
                ? wJson.description
                : wJson.description?.value || "";
            description = rawDesc || "";
          }
        } catch {}
      }

      return {
        isbn,
        title,
        author,
        publisher,
        publication_date,
        language,
        cover_url,
        description,
      };
    } catch {
      return null;
    }
  }

  // Entrée dans le champ ISBN -> lance auto-fill
  function handleIsbnKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAutoFill();
    }
  }

  // -------- upload de couverture (caméra/import) --------
  async function handlePickCover(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      // 1) compresser/redimensionner
      const blob = await downscaleToJpeg(file, 1200, 1200, 0.85);

      // 2) upload vers Supabase Storage (bucket "covers")
      const ext = "jpg";
      const path = `covers/${randomName(ext)}`;

      const { data, error } = await supabase.storage
        .from("covers")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) throw error;

      // 3) URL publique (si bucket public)
      const { data: pub, error: pubErr } = supabase.storage.from("covers").getPublicUrl(path);
      if (pubErr) throw pubErr;
      const url = pub?.publicUrl;
      if (!url) throw new Error("Impossible de générer l’URL de la couverture.");

      // 4) on remplit le champ cover_url
      setField("cover_url", url);
    } catch (err) {
      alert(err?.message || "Échec de l’envoi de la couverture");
    } finally {
      setUploadingCover(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-soft p-6 max-w-2xl">
      {toast && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div
            className={
              "w-full max-w-sm rounded-2xl px-5 py-6 shadow-lg ring-1 text-center text-sm transition " +
              (isSuccessToast
                ? "bg-white text-emerald-800 ring-emerald-200"
                : "bg-white text-amber-900 ring-amber-200")
            }
            role="status"
            aria-live="assertive"
          >
            <div
              className={
                "mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-2xl " +
                (isSuccessToast
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700")
              }
            >
              <span aria-hidden="true">{isSuccessToast ? "✅" : "⚠️"}</span>
            </div>
            <p className="font-medium text-base">{toast.message}</p>
            <p className="mt-1 text-xs text-brand-600">Fermeture automatique dans 3 secondes…</p>
          </div>
        </div>
      )}
      <h2 className="text-lg font-semibold text-brand-900 mb-4">
        {isEdit ? "Modifier le livre" : "Ajouter un livre"}
      </h2>

      {/* ISBN + Scanner + Auto-fill */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-start">
        <div>
          <label className="block text-sm text-brand-800 mb-1">ISBN *</label>
          <input
            className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
            placeholder="ISBN *"
            value={form.isbn}
            onChange={(e) => setField("isbn", e.target.value.replace(/[^\dXx-]/g, ""))}
            onKeyDown={handleIsbnKeyDown}
            inputMode="numeric"
            pattern="\d*"
          />
        </div>

        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="mt-7 md:mt-6 bg-white text-brand-900 ring-1 ring-brand-200 hover:bg-brand-50 rounded-2xl px-4 py-2"
            title="Scanner l’ISBN avec la caméra"
          >
            📷 Scanner
          </button>
        </div>

        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={autofilling || !form.isbn}
            className="mt-7 md:mt-6 bg-brand-600 hover:bg-brand-900 text-white rounded-2xl px-4 py-2 disabled:opacity-60"
            title="Récupère via BnF → Google → OpenLibrary (remplace les champs)"
          >
            {autofilling ? "Récupération…" : "Récupérer via ISBN"}
          </button>
        </div>
      </div>

      {/* Titre / Auteur */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="block text-sm text-brand-800 mb-1">Titre *</label>
          <input
            className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Titre *"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-800 mb-1">Auteur *</label>
          <input
            className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
            value={form.author}
            onChange={(e) => setField("author", e.target.value)}
            placeholder="Auteur *"
          />
        </div>
      </div>

      {/* Description */}
      <div className="mt-4">
        <label className="block text-sm text-brand-800 mb-1">
          Description (auto-traduite si possible)
        </label>
        <textarea
          className="w-full min-h-[110px] ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
        />
      </div>

      {/* Publication / Éditeur / Langue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="block text-sm text-brand-800 mb-1">
            Date de publication
          </label>
          <input
            className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
            value={form.publication_date || ""}
            onChange={(e) => setField("publication_date", e.target.value)}
            placeholder="ex : 2017"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-800 mb-1">Éditeur</label>
          <input
            className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
            value={form.publisher || ""}
            onChange={(e) => setField("publisher", e.target.value)}
            placeholder="Éditeur"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-800 mb-1">Langue</label>
          <input
            className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
            value={form.language || ""}
            onChange={(e) => setField("language", e.target.value)}
            placeholder="ex : Français"
          />
        </div>
      </div>

      {/* Couverture : URL + prise de photo / import */}
      <div className="mt-4">
        <label className="block text-sm text-brand-800 mb-1">Couverture</label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          {/* Champ URL comme avant */}
          <div>
            <input
              className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
              value={form.cover_url || ""}
              onChange={(e) => setField("cover_url", e.target.value)}
              placeholder="https://… (URL de l’image)"
            />
            {form.cover_url && (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.cover_url}
                  alt="Aperçu couverture"
                  className="h-40 rounded-lg ring-1 ring-brand-200 object-cover"
                />
              </div>
            )}
          </div>

          {/* Bouton prendre une photo / importer */}
          <div className="flex sm:justify-end">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePickCover}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingCover}
              className="px-4 py-2 rounded-2xl ring-1 ring-brand-200 bg-white hover:bg-brand-50 text-brand-900 disabled:opacity-60"
              title="Prendre une photo (mobile) ou importer une image"
            >
              {uploadingCover ? "Envoi…" : "📷 Prendre une photo / Importer"}
            </button>
          </div>
        </div>
      </div>

      {/* Emplacement / Prix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="block text-sm text-brand-800 mb-1">
            Emplacement (ex: A1)
          </label>
          <input
            className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
            value={form.location || ""}
            onChange={(e) => setField("location", e.target.value)}
            placeholder="ex: A1"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-800 mb-1">Prix</label>
          <div className="relative">
            <input
              className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2 pr-7"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              inputMode="decimal"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-800">
              €
            </span>
          </div>
        </div>
      </div>

      {/* Plateformes */}
      <div className="mt-4">
        <label className="block text-sm text-brand-800 mb-1">Plateformes</label>
        <div className="flex gap-2">
          {["Vinted", "Rakuten"].map((p) => {
            const active = form.platforms?.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={
                  "px-3 py-1.5 rounded-xl ring-1 transition " +
                  (active
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-brand-900 ring-brand-200 hover:bg-brand-50")
                }
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Statut */}
      <div className="mt-4">
        <label className="block text-sm text-brand-800 mb-1">Statut</label>
        <select
          className="w-full md:w-48 ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
          value={form.status}
          onChange={(e) => setField("status", e.target.value)}
        >
          <option value="en_stock">En stock</option>
          <option value="vendu">Vendu</option>
        </select>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <label className="block text-sm text-brand-800 mb-1">Notes</label>
        <textarea
          className="w-full min-h-[80px] ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
          value={form.notes || ""}
          onChange={(e) => setField("notes", e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-2 md:flex-row md:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full md:w-auto text-center px-4 py-2 rounded-2xl ring-1 ring-brand-200 hover:bg-brand-50 text-brand-900"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="w-full md:w-auto px-4 py-2 rounded-2xl bg-brand-600 hover:bg-brand-900 text-white disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
        </button>
      </div>

      {/* Scanner modal */}
      {showScanner && (
        <IsbnScanner
          onDetected={(isbn) => {
            setField("isbn", isbn);
            setTimeout(() => handleAutoFill(), 0); // écrase tout de suite
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </form>
  );
}
