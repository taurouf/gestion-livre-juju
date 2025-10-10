// components/BookCarousel.js
"use client";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

export default function BookCarousel({ books = [] }) {
  const autoplay = useRef(
    Autoplay({
      delay: 3000,
      stopOnInteraction: true,   // stop si on interagit
      stopOnMouseEnter: true,    // stop au survol
    })
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: false },
    [autoplay.current]
  );

  const [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const [idle, setIdle] = useState(true);
  const idleTimer = useRef(null);

  // Helpers
  const setIdleSoon = useCallback(() => {
    clearTimeout(idleTimer.current);
    setIdle(false);
    idleTimer.current = setTimeout(() => setIdle(true), 1200);
  }, []);

  const onScroll = useCallback(() => {
    if (!emblaApi) return;
    const p = emblaApi.scrollProgress(); // 0..1 (peut dépasser avec loop; on clamp)
    setProgress(Math.max(0, Math.min(1, p)));
    setIdleSoon();
  }, [emblaApi, setIdleSoon]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setIdleSoon();
  }, [emblaApi, setIdleSoon]);

  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", () => {
      onSelect();
      onScroll();
    });
    emblaApi.on("scroll", onScroll);
    onSelect();
    onScroll();

    return () => {
      clearTimeout(idleTimer.current);
    };
  }, [emblaApi, onSelect, onScroll]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  const scrollTo   = useCallback((i) => emblaApi && emblaApi.scrollTo(i),   [emblaApi]);

  if (!books.length) return null;

  return (
    <div className="w-full relative">
      {/* viewport */}
      <div
        className="overflow-hidden pb-6"
        ref={emblaRef}
        onMouseEnter={() => setIdle(false)}
        onMouseLeave={() => setIdleSoon()}
        onFocus={() => setIdle(false)}
        onBlur={() => setIdleSoon()}
      >
        {/* track */}
        <div className="flex gap-6">
          {books.map((b) => (
            <div key={b.id} className="flex-none w-44 sm:w-52 md:w-60 pt-1 pb-5">
              <Link
                href={`/books/${b.id}`}
                className="block h-full bg-white rounded-2xl shadow-soft ring-1 ring-brand-100 hover:ring-brand-300 hover:shadow-lg transition overflow-hidden"
                title={b.title}
                onMouseDown={setIdleSoon}
                onTouchStart={setIdleSoon}
              >
                <div className="h-64 sm:h-72 md:h-80 bg-brand-50 overflow-hidden">
                  {b.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.cover_url}
                      alt={b.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-brand-700">
                      Sans cover
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-brand-900 line-clamp-2">{b.title}</h3>
                  {b.author && <p className="text-xs text-brand-700 truncate mt-0.5">{b.author}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(b.platforms || []).map((p) => (
                      <span
                        key={p}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-brand-300/60 text-brand-900 ring-1 ring-brand-200"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Flèches flottantes — s’estompent quand idle */}
        <NavButton side="left"  onClick={() => { setIdleSoon(); scrollPrev(); }} idle={idle} />
        <NavButton side="right" onClick={() => { setIdleSoon(); scrollNext(); }} idle={idle} />
      </div>

      {/* Progress bar (remplace les dots) */}
      <div className="h-1 rounded-full bg-brand-200/60 overflow-hidden">
        <div
          className="h-full bg-brand-900 rounded-full transition-[width] duration-200"
          style={{ width: `${Math.round((progress || 0) * 100)}%` }}
          aria-label="Progression du carrousel"
        />
      </div>
    </div>
  );
}

/** Bouton de navigation “glassy” + fade quand idle */
function NavButton({ side = "left", onClick, idle }) {
  const isLeft = side === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "Précédent" : "Suivant"}
      className={`
        hidden sm:flex items-center justify-center
        absolute ${isLeft ? "left-3" : "right-3"} top-1/2 -translate-y-1/2
        h-11 w-11 rounded-full
        bg-white/80 backdrop-blur
        shadow-[0_6px_24px_rgba(0,0,0,0.15)]
        ring-1 ring-brand-100
        transition
        ${idle ? "opacity-40" : "opacity-100"}
        hover:opacity-100 hover:bg-white
        group
      `}
    >
      <svg
        className={`h-5 w-5 text-brand-900 transition-transform duration-200 group-hover:scale-110 ${
          isLeft ? "" : "rotate-180"
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 19l-7-7 7-7" />
      </svg>
      <span className="absolute inset-0 rounded-full bg-brand-600/0 group-hover:bg-brand-600/5 transition" />
      <span className="absolute inset-0 rounded-full ring-2 ring-transparent group-focus-visible:ring-brand-600 transition" />
    </button>
  );
}
