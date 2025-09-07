Voici un **README.md** prêt à mettre à la racine du projet.

---

# JSON Analyzer

Outil léger pour **coller, valider, formater et explorer** du JSON. Supporte `?json=` dans l’URL (texte brut ou `b64:…`), repliage/dépliage par blocs, surlignage syntaxique, gestion des `BigInt`, fonctions, symboles et références circulaires. Interface FR/EN.

## ✨ Fonctionnalités

* **Entrée JSON** : collage direct ou via l’URL `?json=...`

  * Brut (`?json={"a":1}`) ou encodé `base64` avec le préfixe `b64:` (`?json=b64:eyJhIjoxfQ==`)
* **Explorateur repliable** (par lignes) :

  * Clic pour (dé)plier, **Alt/⌘/Ctrl+clic** = (dé)pliage **récursif**
  * **Flèches uniquement** sur les lignes où **un bloc commence**
  * **Expand all / Collapse all**
* **Surlignage syntaxique** (chaînes, nombres, booléens, null, ponctuation)
* **Robuste au non-JSON pur** : affiche `BigInt(…)`, `[Function …]`, `Symbol(...)`, et **\[Circular]** au lieu de planter
* **i18n** : routes `/fr` et `/en`
* **Next.js App Router** + **Suspense** pour `useSearchParams()` / `usePathname()`

## 🚀 Démarrage

Pré-requis : **Node 20+** (recommandé : 20.14).

```bash
# installation
npm i

# dev
npm run dev
# → http://localhost:3000/fr  (ou /en)
```

### Build & production

```bash
npm run build
npm start
```

> Note : Tout composant qui lit `useSearchParams()`/`usePathname()` doit être **enveloppé dans `<Suspense>`** (déjà fait dans `app/[locale]/page.tsx` ou dans vos composants clients).

## 🔗 Paramètres d’URL

* Brut :
  `http://localhost:3000/fr?json={"user":{"id":1}}`
* Base64 :

  ```js
  // navigateur
  const txt = JSON.stringify({ user: { id: 1 } });
  const b64 = btoa(txt);
  // URL : ?json=b64:eyJ1c2VyIjp7ImlkIjoxfX0=
  ```

## 🧭 Utilisation

* **Coller** un JSON ou ouvrir avec `?json=…`
* Dans l’explorateur :

  * Clic ligne ou chevron : (dé)plier
  * **Alt/⌘/Ctrl+clic** : (dé)plier **récursivement**
  * Boutons **Expand all / Collapse all**

## 🗂️ Structure (extrait)

```
app/[locale]/page.tsx
components/
  HeroJson.tsx
  tools/
    JsonAnalyzer.tsx
    JsonExplorer.tsx
  visuals/
    DottedRadialGridCanvas.tsx
lib/
  i18n.ts
  site.ts
```

## 🧩 API des composants

### `<JsonAnalyzer />`

```tsx
<JsonAnalyzer
  initialText={string}               
  onParsed={({ value }) => { ... }}   
/>
```

### `<JsonExplorer />`

```tsx
<JsonExplorer
  value={unknown | null}              
  className="..."                  
/>
```

## 🛠️ Tech

* Next.js (App Router), React, TypeScript
* Tailwind CSS
* Framer Motion

## 📄 Licence

MIT © 2025 — Raphael Comandon
