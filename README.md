# StageDesk Pro

Applicazione desktop/web per scrittura, organizzazione e messa in scena di copioni teatrali con note di regia, cue multimediali, raccolta media, modalità schermo intero ed export PDF.

## Scopo

StageDesk Pro fornisce un ambiente unico per:

1. scrivere e revisionare copioni teatrali;
2. gestire note di regia direttamente nel testo;
3. collegare audio, musica, immagini e video come cue operativi;
4. organizzare i materiali in una raccolta media di progetto;
5. presentare il copione in modalità schermo intero;
6. esportare PDF completi o puliti.

## Architettura

La codebase comprende:

1. frontend React + TypeScript;
2. editor Tiptap con estensioni per tabelle, link, note e chip cue;
3. shell desktop Tauri 2;
4. storage progetto su cartelle e file;
5. parser Markdown esteso;
6. export PDF tramite jsPDF;
7. test unitari Vitest.

## Funzionalità

Implementato:

1. autenticazione obbligatoria e profilo utente;
2. ruoli profilo multipli: regista, autore, altro;
3. layout a tre colonne con Struttura, Editor e Cue;
4. creazione e apertura progetti;
5. salvataggio automatico;
6. tree file explorer per copioni Markdown;
7. tree file explorer per raccolta multimediale;
8. tab multipli per file Markdown e documenti interni;
9. outline del file attivo;
10. bookmark inline;
11. note di regia inline, colorate e collassabili;
12. collasso o espansione globale delle note;
13. oggetti battuta collegati alla tabella personaggi;
14. conversione automatica `Personaggio:` in oggetto battuta quando il personaggio è presente in tabella;
15. conversione automatica `nota:` in nota generale con focus sul contenuto;
16. `Cmd/Ctrl+Invio` dalle textarea di note e battute per creare una riga sotto il box;
17. inserimento toolbar di Atto, Scena, Sezione, note, battute, tabelle ed export;
18. scorciatoie per struttura e battute;
19. cue audio, musica, immagine e video;
20. controlli inline per cue audio/musica;
21. inspector laterale dedicato ai cue;
22. riapertura automatica dell'ultimo progetto nella versione desktop;
23. validazione tipografica e formale prima della modalità schermo intero;
24. sincronizzazione tra posizione editor e modalità schermo intero;
25. modalità schermo intero con step battuta/cue;
26. export PDF completo e pulito;
27. aggiornamenti automatici tramite GitHub Releases.

## Sviluppo

Comandi principali:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
npm run tauri:dev
```

URL sviluppo web:

```text
http://127.0.0.1:1420/
```

## Configurazione

La configurazione dell'autenticazione viene letta dall'ambiente di build. Non inserire credenziali, chiavi o URL di progetto direttamente nel codice sorgente.

Se la configurazione manca, l'app mostra una schermata esplicita di errore invece di usare valori di fallback.

## Installer

Build locale:

```bash
npm run tauri:build
```

Artefatti attesi:

1. macOS: `.app` e `.dmg`;
2. Windows: `.msi` e/o `.exe`;
3. Linux: `.AppImage`, `.deb` e/o `.rpm`.

La workflow `.github/workflows/release.yml` genera release e metadata updater quando viene pubblicato un tag `v*`.

Procedura operativa completa: `docs/RELEASE.md`.

## Aggiornamenti

L'app desktop controlla gli aggiornamenti da GitHub Releases. Se è disponibile una nuova versione, scarica e installa automaticamente l'aggiornamento, salva le modifiche correnti e riavvia l'app.

Il metadata updater viene pubblicato come `latest.json` nella release corrente.

## Media e salvataggio

I media importati dall'utente vengono copiati nella cartella del progetto tramite il layer storage. Le operazioni di rinomina, spostamento ed eliminazione aggiornano il filesystem e il modello dati; l'eliminazione rimuove anche i cue collegati dai documenti Markdown.

I salvataggi automatici verso la cartella progetto sono serializzati per evitare scritture concorrenti fuori ordine.

La versione desktop registra il percorso dell'ultimo progetto aperto nel data directory dell'app e lo riapre al successivo avvio. L'autosave verso cartella progetto resta sospeso finché il controllo iniziale dell'ultimo progetto non è concluso, evitando che il progetto dimostrativo venga scritto accidentalmente sulla cartella di lavoro.

## Controllo copione

Prima di entrare in modalità schermo intero l'app esegue controlli tipografici e formali sul file attivo:

1. formato battute `**PERSONAGGIO**: Battuta`;
2. oggetti battuta collegati alla tabella personaggi;
3. struttura H2 per atti e H3 per scene, sinossi e personaggi;
4. nomi personaggio potenzialmente incoerenti;
5. battute senza personaggio;
6. paragrafi non collegati a note, citazioni, cue o sezioni strutturate.

Le anomalie vengono mostrate in un pannello sotto l'editor. Ogni item conserva la riga sorgente, il tipo di errore e un frammento evidenziato; il click sull'item sposta il cursore nel punto corrispondente.

La modalità schermo intero viene avviata dalla battuta o dalla sezione in cui si trova il cursore. All'uscita, l'app riporta il focus nell'editor sullo step visualizzato.

## Scorciatoie editor

Scorciatoie e inserimenti testuali principali:

1. `Personaggio:` converte la riga in un oggetto battuta se il personaggio è presente nella tabella personaggi;
2. `nota:` inserisce una nota generale nel punto corrente e porta il focus nel contenuto;
3. `Alt+1`, `Alt+2`, `Alt+3` inseriscono o applicano Atto, Scena e Sezione;
4. `Alt+Shift+1..9` inserisce una battuta del personaggio corrispondente;
5. `Cmd+Invio` su macOS o `Ctrl+Invio` su Windows/Linux, dentro una textarea di nota o battuta, crea una riga sotto il box e sposta lì il cursore.

## Documenti applicativi

I documenti visualizzati dal menu utente sono Markdown nel repository:

1. `docs/app-help.md`: contenuto della voce Aiuto;
2. `docs/version-history.md`: contenuto della voce Novità.

L'app li carica da GitHub all'apertura del tab e usa il fallback compilato solo se la rete o GitHub non sono disponibili. In questo modo correzioni e integrazioni testuali possono essere pubblicate sul repository senza generare nuovi installer.

## Sicurezza

Regole adottate:

1. nessuna chiave privata nel repository;
2. nessuna credenziale hardcoded nel frontend;
3. chiavi e secret gestiti tramite ambiente locale o GitHub Actions;
4. installer OS non ancora firmati con certificati Apple/Windows;
5. artefatti updater firmati dalla pipeline di release.

## Riferimenti tecnici

- `src/App.tsx`: flussi UI principali, toolbar, inspector, fullscreen ed export.
- `src/AuthGate.tsx`: accesso, registrazione e profilo utente.
- `src/auth.ts`: client di autenticazione e normalizzazione profilo.
- `src/domain.ts`: modello dati di progetto, note, cue e media.
- `src/defaultProject.ts`: progetto dimostrativo.
- `src/markdown.ts`: parsing Markdown, serializzazione ed export pulito.
- `src/scriptNote.ts`: blocchi nota Tiptap.
- `src/scriptChip.ts`: chip cue Tiptap.
- `src/storage.ts`: storage browser, sviluppo locale e Tauri.
- `src/appDocs.ts`: configurazione dei documenti interni Aiuto e Novità, con fallback locale e URL remoti.
- `docs/app-help.md`: Aiuto utente caricato dal repository.
- `docs/version-history.md`: Novità caricate dal repository.
- `src-tauri/src/lib.rs`: comandi desktop.
- `docs/RELEASE.md`: procedura di release.

## Collegamenti

1. Repository: `https://github.com/igelsomino/stagedesk-pro`
2. Issues: `https://github.com/igelsomino/stagedesk-pro/issues`
3. Pull request: `https://github.com/igelsomino/stagedesk-pro/pulls`
4. Release: `https://github.com/igelsomino/stagedesk-pro/releases`
5. GitHub Actions: `https://github.com/igelsomino/stagedesk-pro/actions`

## Rischi e issue

1. I media importati in ambiente browser possono non mantenere l'oggetto binario reale dopo refresh, salvo disponibilità della persistenza filesystem.
2. I contenuti legacy privi di `refId` usano fallback per ordine fino a normalizzazione.
3. Il bundle web supera 500 kB per dipendenze editor/export; valutare code splitting.
4. La copertura test è concentrata sul livello Markdown; mancano test end-to-end sui flussi UI più critici.

## Azioni successive

| Azione | Owner | Scadenza |
| --- | --- | --- |
| Estendere i test end-to-end sui flussi editor, cue e storage | Team sviluppo | Da pianificare |
| Valutare code splitting per ridurre il bundle iniziale | Team sviluppo | Da pianificare |
| Migliorare persistenza binaria dei media in tutti gli ambienti runtime | Team sviluppo | Da pianificare |
| Raffinare il player video/immagini in fullscreen | Team sviluppo | Da pianificare |
| Configurare firma macOS Developer ID, notarizzazione e firma Windows | Owner progetto | Da pianificare |
