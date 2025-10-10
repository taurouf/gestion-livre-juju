"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import BookTable from "../../components/BookTable";

export default function BooksPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  // 👉 handler appelé par le bouton "Vendu"
  async function handleToggleSold(book) {
    if (!book || book.status !== "en_stock") return; // déjà vendu, on ne fait rien
    const { error, data } = await supabase
      .from("books")
      .update({ status: "vendu" })
      .eq("id", book.id)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    // maj locale immédiate (optimistic UI)
    setRows((prev) => prev.map((r) => (r.id === book.id ? { ...r, status: "vendu" } : r)));
  }

  return (
    <section className="space-y-4">
      {/* … tes filtres / header … */}
      <BookTable
        books={rows}
        loading={loading}
        onToggleSold={handleToggleSold}
      />
    </section>
  );
}
