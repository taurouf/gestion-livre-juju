import BookForm from "../../../components/BookForm";

export default function NewBookPage({ searchParams }) {
  const raw = searchParams?.isbn ?? "";
  const sanitized = typeof raw === "string" ? raw.replace(/[^\dXx]/g, "").slice(0, 13) : "";
  const initialBook = sanitized ? { isbn: sanitized } : undefined;

  return <BookForm initialBook={initialBook} mode="create" />;
}
