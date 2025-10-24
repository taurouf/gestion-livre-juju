"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import BookForm from "../../../components/BookForm";

export default function NewBookPage() {
  const searchParams = useSearchParams();
  const initialBook = useMemo(() => {
    const raw = searchParams.get("isbn");
    if (!raw) return null;
    const sanitized = raw.toString().replace(/[^\dXx]/g, "").slice(0, 13);
    if (!sanitized) return null;
    return { isbn: sanitized };
  }, [searchParams]);

  return <BookForm initialBook={initialBook ?? undefined} mode="create" />;
}
