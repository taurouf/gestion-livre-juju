// app/api/isbn/route.js
import { NextResponse } from "next/server";

// Helper: timeout rapide pour chaque source
const withTimeout = (p, ms = 5000) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const isbn = (searchParams.get("isbn") || "").replace(/[^\dXx]/g, "");
  if (!isbn) return NextResponse.json({ error: "missing isbn" }, { status: 400 });

  try {
    // 1) BnF SRU
    const bnf = await tryBnf(isbn);
    if (bnf) return NextResponse.json({ source: "bnf", ...bnf });

    // 2) Google Books (avec lang FR si possible)
    const g = await tryGoogle(isbn);
    if (g) return NextResponse.json({ source: "google", ...g });

    // 3) OpenLibrary
    const ol = await tryOpenLibrary(isbn);
    if (ol) return NextResponse.json({ source: "openlibrary", ...ol });

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "failed" }, { status: 500 });
  }
}

// ---------- Sources ---------- //

async function tryBnf(isbn) {
  // SRU (XML)
  const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=isbn=${isbn}`;
  const res = await withTimeout(fetch(url, { cache: "no-store" }), 7000);
  if (!res.ok) return null;
  const xml = await res.text();

  // extraction minimale (titre, auteur, éditeur, date) avec regex simples
  // NB: pour du costaud, installe xml2js côté serveur et mappe proprement.
  const get = (re) => (xml.match(re)?.[1] || "").replace(/\s+/g, " ").trim();

  // Les balises varient (dc:title, marc:subfield…); on tente plusieurs patterns
  const title =
    get(/<dc:title>([^<]+)<\/dc:title>/i) ||
    get(/<title>([^<]+)<\/title>/i) ||
    "";

  const author =
    get(/<dc:creator>([^<]+)<\/dc:creator>/i) ||
    get(/<roleTerm[^>]*>auteur<\/roleTerm>[\s\S]*?<namePart>([^<]+)<\/namePart>/i) ||
    "";

  const publisher =
    get(/<dc:publisher>([^<]+)<\/dc:publisher>/i) ||
    get(/<publisher>([^<]+)<\/publisher>/i) ||
    "";

  const publication_date =
    get(/<dc:date>([^<]+)<\/dc:date>/i) ||
    get(/<dateIssued>([^<]+)<\/dateIssued>/i) ||
    "";

  // cover : pas fourni, on laissera OpenLibrary cover fallback dans le form
  if (!title) return null;
  return { isbn, title, author, publisher, publication_date };
}

async function tryGoogle(isbn) {
  const key = process.env.GOOGLE_BOOKS_KEY || "";
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&langRestrict=fr&printType=books` +
    (key ? `&key=${key}` : "");
  const res = await withTimeout(fetch(url, { cache: "no-store" }), 6000);
  if (!res.ok) return null;
  const json = await res.json();
  const it = json.items?.[0]?.volumeInfo;
  if (!it) return null;

  return {
    isbn,
    title: it.title || "",
    author: (it.authors && it.authors[0]) || "",
    publisher: it.publisher || "",
    publication_date: it.publishedDate || "",
    language: it.language || "",
    description: it.description || "",
    cover_url: it.imageLinks?.thumbnail?.replace("http:", "https:") || "",
  };
}

async function tryOpenLibrary(isbn) {
  const r = await withTimeout(fetch(`https://openlibrary.org/isbn/${isbn}.json`, { cache: "no-store" }), 6000);
  if (!r.ok) return null;
  const data = await r.json();

  let title = data.title || "";
  let author = "";
  if (Array.isArray(data.authors) && data.authors[0]?.key) {
    try {
      const a = await fetch(`https://openlibrary.org${data.authors[0].key}.json`);
      const aj = await a.json();
      author = aj?.name || "";
    } catch {}
  }

  let cover_url = "";
  if (Array.isArray(data.covers) && data.covers[0]) {
    cover_url = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
  } else {
    cover_url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  }

  // description via works
  let description = "";
  if (Array.isArray(data.works) && data.works[0]?.key) {
    try {
      const w = await fetch(`https://openlibrary.org${data.works[0].key}.json`);
      const wj = await w.json();
      description =
        typeof wj.description === "string" ? wj.description : wj.description?.value || "";
    } catch {}
  }

  // langue brute
  let language = "";
  if (Array.isArray(data.languages) && data.languages[0]?.key) {
    language = data.languages[0].key.split("/").pop();
  }

  return {
    isbn,
    title,
    author,
    publisher:
      (Array.isArray(data.publishers) && data.publishers[0]) || data.publisher || "",
    publication_date: data.publish_date || "",
    language,
    description,
    cover_url,
  };
}
