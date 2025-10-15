// app/api/isbn/route.js
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

/** Petite aide pour éviter que chaque source prenne trop de temps */
const withTimeout = (p, ms = 7000) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);

/** Map des codes langue -> libellé */
function mapLangCodeToLabel(code) {
  if (!code) return "";
  const m = {
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
  return m[String(code).toLowerCase()] || code;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("isbn") || "").replace(/[^\dXx]/g, "");
  if (!raw) return NextResponse.json({ error: "missing isbn" }, { status: 400 });

  try {
    // 1) BnF SRU (DC)
    const bnf = await tryBnf(raw);
    if (bnf) return NextResponse.json({ source: "bnf", ...bnf });

    // 2) Google Books
    const google = await tryGoogle(raw);
    if (google) return NextResponse.json({ source: "google", ...google });

    // 3) OpenLibrary
    const ol = await tryOpenLibrary(raw);
    if (ol) return NextResponse.json({ source: "openlibrary", ...ol });

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "failed" },
      { status: 500 }
    );
  }
}

/* ------------------------- BnF (SRU / DC) ------------------------- */

async function tryBnf(isbn) {
  // On tente plusieurs indexes (certains catalogages n'ont que ean/identifier)
  const queries = [
    `bib.isbn any "${isbn}"`,
    `bib.ean any "${isbn}"`,
    `dc.identifier any "${isbn}"`,
  ];

  for (const cql of queries) {
    const url =
      "https://catalogue.bnf.fr/api/SRU?" +
      new URLSearchParams({
        version: "1.2",
        operation: "searchRetrieve",
        recordSchema: "dc", // Dublin Core (facile à mapper)
        maximumRecords: "1",
        query: cql,
      });

    let res;
    try {
      res = await withTimeout(fetch(url, { cache: "no-store" }), 8000);
    } catch {
      continue;
    }
    if (!res.ok) continue;

    const xml = await res.text();

    // Parseur robuste (force certains nœuds en tableaux)
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "text",
      trimValues: true,
      isArray: (name) =>
        [
          "srw:record",
          "dc:title",
          "dc:creator",
          "dc:publisher",
          "dc:date",
          "dc:language",
          "dc:description",
          "dc:identifier",
        ].includes(name),
    });

    let json;
    try {
      json = parser.parse(xml);
    } catch {
      continue;
    }

    const resp = json?.["srw:searchRetrieveResponse"];
    const nb = Number(resp?.["srw:numberOfRecords"] || 0);
    if (!nb) continue;

    const records = resp?.["srw:records"]?.["srw:record"];
    const record = Array.isArray(records) ? records[0] : records;
    const dc = record?.["srw:recordData"]?.["oai_dc:dc"];
    if (!dc) continue;

    // Helpers
    const pickText = (v) => {
      if (v == null) return "";
      if (Array.isArray(v)) {
        const first = v.find((x) => x?.text || typeof x === "string");
        return (first?.text ?? first ?? "").toString().trim();
      }
      return (v?.text ?? v ?? "").toString().trim();
    };

    const allTexts = (v) =>
      (Array.isArray(v) ? v : [v])
        .map((x) => (x?.text ?? x ?? "").toString().trim())
        .filter(Boolean);

    const normalizeRole = (s) =>
      s
        .replace(/\.\s*(Auteur du texte|Illustrateur|Éditeur|Editeur|Préfacier|Traducteur).*$/i, "")
        .replace(/\s+\(\d{4}-.*?\)\s*$/i, "")
        .trim();

    const extractIsbn = (idents) => {
      for (const id of allTexts(idents)) {
        // ex: "ISBN 9791026820963" / "EAN 9791026820963" / URL ark
        const m = id.match(/\b97[89][\d\- ]{10,}\b/);
        if (m) return m[0].replace(/[^\dXx]/g, "");
      }
      return isbn;
    };

    // Mapping BnF (DC)
    const titleFull = pickText(dc["dc:title"]); // Titre complet, on ne tronque pas
    const title = titleFull; // si tu veux, tu peux enlever la "zone de responsabilité" : titleFull.split(" / ")[0]

    const author = normalizeRole(pickText(dc["dc:creator"])) || "";
    const publisher = pickText(dc["dc:publisher"]) || "";
    const publication_date = pickText(dc["dc:date"]) || "";

    // langues : la BnF renvoie parfois "fre" ET "français"
    const langs = allTexts(dc["dc:language"]);
    const language =
      langs.find((l) => l.length > 3) || // "français"
      mapLangCodeToLabel(langs.find((l) => l.length <= 3)) || // "fre" -> "Français"
      "";

    const description = allTexts(dc["dc:description"]).join("\n").trim();

    const isbnClean = extractIsbn(dc["dc:identifier"]);

    return {
      isbn: isbnClean || isbn,
      title,
      author,
      publisher,
      publication_date,
      language,
      description,
      // Pas de cover à la BnF -> laisse Google/OL compléter
      cover_url: "",
    };
  }

  return null;
}

/* ------------------------- Google Books ------------------------- */

async function tryGoogle(isbn) {
  const key = process.env.GOOGLE_BOOKS_KEY || "";
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&langRestrict=fr&printType=books` +
    (key ? `&key=${key}` : "");

  let res;
  try {
    res = await withTimeout(fetch(url, { cache: "no-store" }), 7000);
  } catch {
    return null;
  }
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

/* ------------------------- OpenLibrary ------------------------- */

async function tryOpenLibrary(isbn) {
  let r;
  try {
    r = await withTimeout(
      fetch(`https://openlibrary.org/isbn/${isbn}.json`, { cache: "no-store" }),
      7000
    );
  } catch {
    return null;
  }
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

  // langue brute (code)
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
