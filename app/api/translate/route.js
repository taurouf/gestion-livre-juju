// app/api/translate/route.js
export async function POST(req) {
  try {
    const { text, target = "fr" } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ text: "" }), { status: 200 });
    }

    // Appel serveur->serveur (pas de CORS côté navigateur)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      target
    )}&dt=t&q=${encodeURIComponent(text)}`;

    const res = await fetch(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ text }), { status: 200 });
    }
    const data = await res.json();
    const out = (data?.[0] || []).map((seg) => seg?.[0]).join("");
    return new Response(JSON.stringify({ text: out || text }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ text: "" }), { status: 200 });
  }
}
