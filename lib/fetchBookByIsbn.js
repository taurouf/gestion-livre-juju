// lib/fetchBookByIsbn.js
export async function fetchBookByIsbn(isbn) {
  const clean = (isbn || "").replace(/[^0-9Xx]/g, "");
  if (!clean) throw new Error("ISBN vide");

  // 1) Open Library (data + details)
  let ol = await fetchOpenLibraryAPI(clean);

  // 2) Edition/Work JSON → description.value très fiable
  const olDesc = await fetchOLDescriptionFromEditionWork(clean); // récupère description.value si dispo
  if (olDesc) {
    ol = ol || {};
    ol.description = olDesc; // ⬅️ on PRIORISE la vraie description.value
  }

  // 3) HTML fallback (.read-more__content > p:nth-child(1)) si rien
  if (ol && !ol.description) {
    const d = await fetchOpenLibraryDescriptionHTML(clean);
    if (d) ol.description = d;
  }

  // 4) Google Books si titre/auteur manquent
  const gb = needsFallback(ol) ? await fetchGoogleBooks(clean) : null;

  // Fusion
  const merged = {
    title: ol?.title || gb?.title || "",
    author: ol?.author || gb?.author || "",
    description: ol?.description || gb?.description || "",
    cover_url: ol?.cover_url || gb?.cover_url || "",
    publication_date: ol?.publication_date || gb?.publication_date || "",
    publisher: ol?.publisher || gb?.publisher || "",
    language: normalizeLang(ol?.language || gb?.language || "")
  };

  // Traduction FR côté serveur (API route Next)
  if (merged.description) {
    merged.description = await translateToFrench(merged.description);
  }

  return merged;
}

function needsFallback(d) { return !(d?.title) || !(d?.author); }

async function fetchOpenLibraryAPI(isbn) {
  try {
    const r1 = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const j1 = r1.ok ? await r1.json() : {};
    const d = j1[`ISBN:${isbn}`] || {};

    const r2 = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=details`);
    const j2 = r2.ok ? await r2.json() : {};
    const details = j2[`ISBN:${isbn}`]?.details || {};

    const title = d.title || details.title || "";
    const author =
      (Array.isArray(d.authors) && d.authors.map(a => a.name).filter(Boolean).join(", ")) ||
      (Array.isArray(details.authors) && details.authors.map?.(a => a.name || a?.personal_name).filter(Boolean).join(", ")) ||
      "";

    // ⚠️ on ne force PAS la description ici si elle n’est pas sûre
    const description =
      (typeof details.description === "object" ? details.description?.value : details.description) ||
      (typeof d.notes === "object" ? d.notes?.value : d.notes) ||
      d.subtitle || "";

    const cover_url = d.cover?.large || d.cover?.medium || d.cover?.small || "";
    const publication_date = d.publish_date || details.publish_date || details.publish_date_edition || "";
    const publisher =
      (Array.isArray(d.publishers) ? d.publishers.map(p => p.name || p).filter(Boolean).join(", ") : "") ||
      (Array.isArray(details.publishers) ? details.publishers.map(p => p?.name || p).filter(Boolean).join(", ") : "");

    let language = "";
    const key = (Array.isArray(d.languages) && d.languages[0]?.key) ||
                (Array.isArray(details.languages) && details.languages[0]?.key) || "";
    if (key) language = key.split("/").pop();

    return { title, author, description, cover_url, publication_date, publisher, language };
  } catch { return null; }
}

// Prend d'abord /isbn/{isbn}.json puis /works/{id}.json et renvoie description.value si dispo
async function fetchOLDescriptionFromEditionWork(isbn) {
  try {
    const eRes = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if (eRes.ok) {
      const edition = await eRes.json();
      const d1 = extractDescription(edition?.description);
      if (d1) return d1;

      const workKey = Array.isArray(edition?.works) && edition.works[0]?.key; // "/works/OLxxxxW"
      if (workKey) {
        const wRes = await fetch(`https://openlibrary.org${workKey}.json`);
        if (wRes.ok) {
          const work = await wRes.json();
          const d2 = extractDescription(work?.description);
          if (d2) return d2;
        }
      }
    }
    return "";
  } catch { return ""; }
}

function extractDescription(d) {
  if (!d) return "";
  if (typeof d === "string") return d.trim();
  if (typeof d === "object") return (d.value || "").trim();
  return "";
}

async function fetchOpenLibraryDescriptionHTML(isbn) {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}`);
    if (!res.ok) return "";
    const html = await res.text();
    const blockMatch = html.match(/class=["'][^"']*read-more__content[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/i);
    if (!blockMatch) return "";
    const pMatch = blockMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!pMatch) return "";
    const raw = stripTags(pMatch[1]).trim();
    return decodeEntities(raw);
  } catch { return ""; }
}

async function fetchGoogleBooks(isbn) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const v = json?.items?.[0]?.volumeInfo;
    if (!v) return null;
    return {
      title: v.title || "",
      author: Array.isArray(v.authors) ? v.authors.join(", ") : "",
      description: v.description || "",
      cover_url: v.imageLinks?.large || v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "",
      publication_date: v.publishedDate || "",
      publisher: v.publisher || "",
      language: v.language || ""
    };
  } catch { return null; }
}

// Traduction FR via route API (pas de CORS)
async function translateToFrench(text) {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target: "fr" }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.text || text;
  } catch {
    return text;
  }
}

function stripTags(s){ return s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""); }
function decodeEntities(s){
  const map = { "&amp;":"&", "&lt;":"<", "&gt;":">", "&quot;":"\"", "&#39;":"'", "&nbsp;":" " };
  return s.replace(/&[a-zA-Z#0-9]+;/g, m => map[m] || m);
}
function normalizeLang(l){
  if (!l) return "";
  const m = { en:"English", eng:"English", fr:"Français", fre:"Français", fra:"Français", es:"Español", spa:"Español", de:"Deutsch", ger:"Deutsch", deu:"Deutsch", it:"Italiano", ita:"Italiano" };
  return m[l.toLowerCase()] || l;
}
