// app/layout.js
import "../styles/globals.css";
import Header from "../components/Header";

export const metadata = {
  title: "Stock de livres",
  description: "Gestion de stock • Next.js + Tailwind + Supabase",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-[#EFD4C4] text-[#2a0a0e] antialiased">
        {/* Barre de navigation (montre moins d’éléments quand l’utilisateur n’est pas connecté) */}
        <Header />

        {/* Contenu principal */}
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
