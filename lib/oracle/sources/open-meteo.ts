// Backbone dell'oracolo (NESSUNA chiave richiesta).
// Fornisce due fonti:
//  1) Ensemble (fino a ~40-51 membri ECMWF/GFS/ICON) -> distribuzione nativa.
//  2) Multi-model: la temp max prevista da 8-10 servizi meteo nazionali distinti.
// Insieme rappresentano l'equivalente delle "~20 fonti affidabili".
import type { SourceContext, WeatherSource } from "./types";

const ENSEMBLE = "https://ensemble-api.open-meteo.com/v1/ensemble";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

// Modelli ensemble: coprono i principali centri (ECMWF, NOAA, DWD, CMC, BoM, UKMO...).
// Insieme forniscono ~150+ membri probabilistici.
const ENSEMBLE_MODELS = [
  "ecmwf_ifs025",
  "gfs_seamless",
  "icon_seamless",
  "gem_global",
  "bom_access_global_ensemble",
  "ukmo_global_ensemble_20km",
];

// Modelli deterministici di servizi meteo nazionali diversi (ogni modello = 1 fonte).
// Include modelli ad alta risoluzione regionali (Italia ARPAE, MeteoSwiss, KNMI/DMI HARMONIE...)
// che migliorano l'accuratezza locale. I modelli che non coprono un'area tornano null e
// vengono scartati automaticamente.
const FORECAST_MODELS = [
  // globali
  "ecmwf_ifs025",
  "gfs_seamless",
  "icon_seamless",
  "gem_seamless",
  "jma_seamless",
  "meteofrance_seamless",
  "ukmo_seamless",
  "metno_seamless",
  "knmi_seamless",
  "dmi_seamless",
  "cma_grapes_global",
  "bom_access_global",
  "gfs_graphcast025",
  // regionali ad alta risoluzione
  "italia_meteo_arpae_icon_2i", // servizio meteo nazionale italiano (ARPAE)
  "meteoswiss_icon_ch2",
  "knmi_harmonie_arome_europe",
  "dmi_harmonie_arome_europe",
  "ukmo_uk_deterministic_2km",
  "meteofrance_arome_france_hd",
];

function commonParams(ctx: SourceContext): string {
  return [
    `latitude=${ctx.lat}`,
    `longitude=${ctx.lon}`,
    `daily=temperature_2m_max`,
    `start_date=${ctx.date}`,
    `end_date=${ctx.date}`,
    `timezone=${encodeURIComponent(ctx.timezone)}`,
  ].join("&");
}

/** Estrae tutti i valori numerici (non null) dalle chiavi temperature_2m_max* */
function collectMaxValues(daily: Record<string, unknown>, onlyMembers: boolean): number[] {
  const out: number[] = [];
  for (const [key, val] of Object.entries(daily)) {
    if (!key.startsWith("temperature_2m_max")) continue;
    if (onlyMembers && key === "temperature_2m_max") continue; // evita doppio conteggio del controllo
    if (Array.isArray(val)) {
      for (const v of val) if (typeof v === "number" && Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

export const openMeteoEnsemble: WeatherSource = {
  id: "open-meteo-ensemble",
  label: "Open-Meteo Ensemble (ECMWF/GFS/ICON/GEM)",
  enabled: () => true,
  async fetchMembers(ctx) {
    const url = `${ENSEMBLE}?${commonParams(ctx)}&models=${ENSEMBLE_MODELS.join(",")}`;
    const res = await fetch(url, { signal: ctx.signal, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`ensemble ${res.status}`);
    const data = (await res.json()) as { daily?: Record<string, unknown> };
    const members = collectMaxValues(data.daily ?? {}, true);
    if (members.length === 0) throw new Error("ensemble: nessun membro");
    return members;
  },
};

export const openMeteoMultiModel: WeatherSource = {
  id: "open-meteo-multimodel",
  label: "Open-Meteo Multi-model (~19 servizi nazionali + regionali HD)",
  enabled: () => true,
  async fetchMembers(ctx) {
    const url = `${FORECAST}?${commonParams(ctx)}&models=${FORECAST_MODELS.join(",")}`;
    const res = await fetch(url, { signal: ctx.signal, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`forecast ${res.status}`);
    const data = (await res.json()) as { daily?: Record<string, unknown> };
    const members = collectMaxValues(data.daily ?? {}, false);
    if (members.length === 0) throw new Error("multimodel: nessun valore");
    return members;
  },
};
