export type Locale = "fr" | "en";

export const locales: Locale[] = ["fr", "en"];
export const defaultLocale: Locale = "fr";

type Dict = Record<string, string>;

const fr: Dict = {
  "json.hero_title": "Analyseur JSON — Beta",
  "json.hero_desc": "Colle un JSON ci-dessous ou ajoute ?json=… à l’URL. Supporte aussi b64:…",
  "json.hero_loading": "Chargement…",

  "json.title": "Analyse JSON",
  "json.hint": "Colle ton JSON ou passe ?json=… en URL",
  "json.input": "Entrée",
  "json.preview": "Aperçu",
  "json.empty": "Aucun contenu.",

  "json.stats.nodes": "Nœuds",
  "json.stats.depth": "Profondeur",
  "json.stats.objects": "Objets",
  "json.stats.arrays": "Tableaux",
  "json.stats.numbers": "Nombres",
  "json.stats.strings": "Chaînes",
  "json.stats.booleans": "Booléens",
  "json.stats.nulls": "Null",

  "json.numbers.title": "Nombres",
  "json.numbers.min": "min",
  "json.numbers.max": "max",
  "json.numbers.mean": "moyenne",

  "json.arrays.title": "Tableaux",
  "json.arrays.count": "compte",
  "json.arrays.avg_len": "longueur moyenne",

  "json.top_keys.title": "Clés (ensemble d’objets)",
  "json.top_keys.key": "Clé",
  "json.top_keys.presence": "Présence",

  "json.raw.title": "Aperçu brut",

  "json.placeholder": "{\"items\":[{\"id\":1,\"name\":\"A\"},{\"id\":2,\"name\":\"B\"}]}",
  "json.error.invalid": "JSON invalide",

  "json.explorer.expand_all": "Tout déplier",
  "json.explorer.collapse_all": "Tout replier",
  "json.explorer.expand": "Déplier",
  "json.explorer.collapse": "Replier",
  "json.explorer.tip_recursive": "Astuce : ⌘F / Ctrl+F pour afficher la barre de recherche",
};

const en: Dict = {
  "json.hero_title": "JSON Analyzer — Beta",
  "json.hero_desc": "Paste JSON below or add ?json=… in the URL. Also supports b64:…",
  "json.hero_loading": "Loading…",

  "json.title": "JSON Analysis",
  "json.hint": "Paste your JSON or pass ?json=… in the URL",
  "json.input": "Input",
  "json.preview": "Overview",
  "json.empty": "No content.",

  "json.stats.nodes": "Nodes",
  "json.stats.depth": "Depth",
  "json.stats.objects": "Objects",
  "json.stats.arrays": "Arrays",
  "json.stats.numbers": "Numbers",
  "json.stats.strings": "Strings",
  "json.stats.booleans": "Booleans",
  "json.stats.nulls": "Null",

  "json.numbers.title": "Numbers",
  "json.numbers.min": "min",
  "json.numbers.max": "max",
  "json.numbers.mean": "mean",

  "json.arrays.title": "Arrays",
  "json.arrays.count": "count",
  "json.arrays.avg_len": "average length",

  "json.top_keys.title": "Keys (object set)",
  "json.top_keys.key": "Key",
  "json.top_keys.presence": "Presence",

  "json.raw.title": "Raw preview",

  "json.placeholder": "{\"items\":[{\"id\":1,\"name\":\"A\"},{\"id\":2,\"name\":\"B\"}]}",
  "json.error.invalid": "Invalid JSON",

  "json.explorer.expand_all": "Expand all",
  "json.explorer.collapse_all": "Collapse all",
  "json.explorer.expand": "Expand",
  "json.explorer.collapse": "Collapse",
  "json.explorer.tip_recursive": "Tip: Press ⌘F / Ctrl+F to open the search bar",
};

export const dictionaries: Record<Locale, Dict> = { fr, en };

export function getDict(locale: Locale) {
  return dictionaries[locale] ?? fr;
}
