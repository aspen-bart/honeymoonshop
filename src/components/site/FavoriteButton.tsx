"use client";
import { Icon } from "@/components/Icon";
import { useFavorites, type Favorite } from "./favorites";

export function FavoriteButton({ item, className = "", withLabel = false, iconClassName = "h-5 w-5" }: { item: Favorite; className?: string; withLabel?: boolean; iconClassName?: string }) {
  const fav = useFavorites();
  const on = fav.has(item.path);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fav.toggle(item);
      }}
      aria-pressed={on}
      aria-label={on ? `${item.name} verwijderen uit favorieten` : `${item.name} bewaren als favoriet`}
      className={`inline-flex items-center gap-2 transition ${className}`}
    >
      <Icon name="heart" strokeWidth={1.8} className={`${iconClassName} transition ${on ? "scale-110 fill-lilac-700 text-lilac-700" : ""}`} />
      {withLabel && <span>{on ? "Bewaard als favoriet" : "Bewaar als favoriet"}</span>}
    </button>
  );
}
