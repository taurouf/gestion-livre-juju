// components/BookShelfAnimated.js
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function BookShelfAnimated({ books = [] }) {
  const router = useRouter();

  if (!books.length) {
    return <div className="text-brand-900">Aucun livre.</div>;
  }

  // Découpe en rangées de 6
  const chunk = (arr, size) =>
    arr.reduce((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
  const rows = chunk(books, 6);

  return (
    <div className="space-y-12 px-4 sm:px-6 lg:px-12">
      <AnimatePresence>
        {rows.map((row, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="relative"
          >
            {/* planche */}
            <div className="absolute inset-x-0 bottom-0 h-4 bg-[#E9C8B3] shadow-[0_4px_8px_rgba(0,0,0,0.2)] rounded-md" />
            <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 pb-8">
              {row.map((b) => (
                <motion.button
                  key={b.id}
                  onClick={() => router.push(`/books/${b.id}`)}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.97 }}
                  className="group relative text-left"
                >
                  <div className="aspect-[2/3] w-full rounded-lg overflow-hidden ring-1 ring-brand-100 bg-brand-50 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.cover_url || "/placeholder-cover.png"}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-medium text-zinc-950 line-clamp-2 leading-tight">
                      {b.title}
                    </div>
                    <div className="text-xs text-zinc-600">{b.author || "—"}</div>
                  </div>
                  {b.status === "vendu" && (
                    <span className="absolute -left-5 top-3 rotate-[-35deg] bg-rose-600 text-white text-[10px] px-6 py-0.5 shadow-md">
                      VENDU
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
