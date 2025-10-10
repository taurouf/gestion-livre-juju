import "./../styles/globals.css";
import AuthBar from "../components/AuthBar";
import Nav from "../components/Nav";

export const metadata = {
  title: "Stock de livres",
  description: "MVP Next.js + Supabase",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <header className="sticky top-0 z-10 bg-brand-900 text-white">
          <div className="container mx-auto max-w-6xl p-6">
            {/* Ligne titre + auth */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Stock de livres</h1>
                <p className="opacity-90 text-sm">Next.js + Tailwind + Supabase</p>
              </div>
              <AuthBar />
            </div>

            {/* Navigation */}
            <Nav />
          </div>
        </header>

        <main className="container mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
