# Contribuire a StageDesk Pro

## Scopo

Questo documento descrive le regole minime per contribuire al codice, alla documentazione e alle release di StageDesk Pro.

## Prima di iniziare

1. Verificare se esiste gia una issue collegata.
2. Aprire una nuova issue per bug, proposta o miglioramento non ancora tracciato.
3. Non inserire credenziali, chiavi, token, file privati o dati personali nei commit.
4. Mantenere le modifiche focalizzate su un solo obiettivo.

## Setup locale

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 1420
```

Comandi di verifica:

```bash
npm run lint
npm test -- --run
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Pull request

Ogni pull request dovrebbe includere:

1. descrizione sintetica della modifica;
2. motivazione o issue collegata;
3. test eseguiti;
4. eventuali impatti su installer, aggiornamenti, storage, export PDF o autenticazione;
5. screenshot o note di verifica quando la modifica riguarda l'interfaccia.

## Documentazione

Aggiornare la documentazione quando la modifica cambia funzionalita utente, scorciatoie, flussi di lavoro, release o configurazioni.

File principali:

- `docs/app-help.md`: aiuto utente mostrato nell'app.
- `docs/version-history.md`: novita mostrate nell'app.
- `README.md`: documentazione tecnica del repository.
- `src/appDocs.ts`: fallback offline di Aiuto e Novita.

## Stile tecnico

- Preferire modifiche piccole e verificabili.
- Seguire le convenzioni esistenti di React, TypeScript, Tauri e Markdown esteso.
- Non introdurre nuove dipendenze senza una motivazione esplicita.
- Non pubblicare build o release manualmente se la pipeline automatica e disponibile.

## Sicurezza

Per vulnerabilita, credenziali esposte o dati sensibili, non aprire issue pubbliche. Seguire la procedura indicata in `SECURITY.md`.
