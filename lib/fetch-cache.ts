// Init di fetch condiviso: cache normale (revalidate) per il polling automatico, oppure
// bypass totale (no-store) quando l'utente preme REFRESH manualmente (fresh=true). Così il
// tasto refresh porta davvero dati nuovi senza sacrificare la cache del polling di fondo.
export function cacheInit(revalidate: number, fresh?: boolean): RequestInit {
  return fresh ? { cache: "no-store" } : { next: { revalidate } };
}
