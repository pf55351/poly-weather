// Interfaccia comune a TUTTE le fonti meteo (Open-Meteo, Met Norway, OpenWeather,
// WeatherAPI, scraper...). L'aggregatore concatena i "members" di ogni fonte.
// Un "member" = una previsione di temperatura MASSIMA per il giorno target, in °C.

export interface SourceContext {
  lat: number;
  lon: number;
  /** Giorno target in formato YYYY-MM-DD */
  date: string;
  /** IANA timezone della città, per allineare il "giorno" */
  timezone: string;
  signal?: AbortSignal;
}

export interface WeatherSource {
  id: string;
  label: string;
  /** true se la fonte è utilizzabile (es. chiave presente). */
  enabled(): boolean;
  /** Ritorna le temperature massime previste (°C). Può restituirne molte (ensemble). */
  fetchMembers(ctx: SourceContext): Promise<number[]>;
}

export interface SourceResult {
  id: string;
  label: string;
  members: number[];
  /** popolato se la fonte ha fallito */
  error?: string;
}
