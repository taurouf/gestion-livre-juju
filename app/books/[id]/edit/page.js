"use client";
import BookForm from "../../../../components/BookForm";
export default function EditBookPage({ params }){ return <BookForm mode="edit" id={params.id} />; }
