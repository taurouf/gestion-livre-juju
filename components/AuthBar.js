"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthBar() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    if (!email) return alert("Entre ton email");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined }
    });
    if (error) alert(error.message); else alert("Lien magique envoyé ✉️");
  }

  return session ? (
    <button onClick={()=>supabase.auth.signOut()} className="bg-white/10 hover:bg-white/20 text-white rounded-2xl px-3 py-1">Se déconnecter</button>
  ) : (
    <div className="flex items-center gap-2">
      <input type="email" placeholder="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="text-black rounded-xl px-3 py-1"/>
      <button onClick={signIn} className="bg-white/10 hover:bg-white/20 text-white rounded-2xl px-3 py-1">Se connecter</button>
    </div>
  );
}
