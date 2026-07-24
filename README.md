# StageDesk Pro

Applicazione desktop/web per scrittura, organizzazione e messa in scena di copioni teatrali con note di regia, cue multimediali, raccolta media, modalità schermo intero ed export PDF.

Versione desktop corrente: **1.0.39**.

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
2. profili operativi multipli: regista, autore/autrice, attore/attrice, altro;
3. layout a tre colonne con Struttura, Editor e Cue;
4. creazione e apertura progetti;
5. ricerca, paginazione, rinomina ed eliminazione nella dialog di apertura progetti;
6. tab Store importabile dalla dialog progetti;
7. importazione diretta dei pacchetti `.stagedesk` dallo Store desktop, senza pubblicare o scaricare il Markdown sorgente;
8. salvataggio automatico;
9. tree file explorer per copioni Markdown;
10. tree file explorer per raccolta multimediale;
11. tab multipli per file Markdown, Store e documenti interni;
12. outline del file attivo;
13. bookmark inline;
14. note di regia inline, colorate e collassabili;
15. collasso o espansione globale delle note;
16. oggetti battuta collegati alla tabella personaggi;
17. trascinamento delle battute nell'editor e pulsante per eliminarle dall'header;
18. conversione automatica `Personaggio:` in oggetto battuta quando il personaggio è presente in tabella;
19. conversione automatica `nota:` in nota generale con focus sul contenuto;
20. `Cmd/Ctrl+Invio` dalle textarea di note e battute per creare una riga sotto il box;
21. inserimento toolbar di Atto, Scena, Sezione, note, battute, tabelle ed export;
22. menu teatrale per struttura, note, battute ed export;
23. trascinamento delle battute con indicatore di rilascio e cancellazione dal relativo header;
24. cue audio, musica, immagine e video;
25. controlli inline per cue audio/musica;
26. inspector laterale dedicato ai cue;
27. riapertura automatica dell'ultimo progetto nella versione desktop;
28. validazione tipografica e formale prima della modalità schermo intero;
29. sincronizzazione tra posizione editor e modalità schermo intero;
30. modalità schermo intero con step battuta/cue;
31. export PDF completo e pulito, con conservazione delle note operative nel pulito;
32. condivisione strutturata del copione per future app attori, con battute, personaggi e note operative;
33. inspector cue con filtri Contestuali, Scena e Tutte;
34. paginazione della lista cue con cinque elementi per pagina;
35. aggiornamenti automatici tramite GitHub Releases;
36. diagnostica persistente per eventi di lifecycle, focus, refresh, stato editor e riproduzione media.
37. completamento OAuth desktop tramite pagina HTTPS pubblica, con riapertura dell'app tramite deep link senza lasciare il browser in caricamento;
38. recupero password tramite link e-mail e impostazione guidata di una nuova password;
39. dialog coerenti e responsive per condivisione e pubblicazione versionata nello Store;
40. navigazione da tastiera tra note e battute adiacenti, anche quando cambia il tipo di blocco;
41. comando **Valuta copione** nella toolbar, disponibile solo per il file importato dallo StageDesk Store;
42. trascinamento unificato di note, battute e cue nell'editor con indicatore della posizione di rilascio;

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

Nel desktop il login con Google, GitHub e Azure passa dalla pagina pubblica `https://stagedesk-pro.aigconsulting.it/auth-callback/`. La pagina conferma il completamento dell'autenticazione, riapre StageDesk Pro tramite il protocollo `stagedeskpro://` e lascia disponibile un collegamento manuale se il sistema operativo non avvia automaticamente l'app. Dopo l'apertura dell'app è possibile chiudere la finestra del browser.

Se non ricordi la password, seleziona **Password dimenticata?** nella schermata di accesso, inserisci l'e-mail dell'account e apri il collegamento ricevuto. StageDesk Pro mostra una pagina dedicata per impostare e confermare la nuova password; al termine chiude la sessione di recupero e riporta alla schermata di accesso.

Dopo l'accesso con Google, GitHub o Azure, se il profilo non contiene ancora nome, cognome, telefono, un profilo operativo e l'accettazione della privacy, l'app apre automaticamente **Completa il profilo** prima di consentire l'accesso al resto dell'applicazione.

Un account creato con Google, GitHub o Azure può completare il recupero tramite e-mail e impostare una nuova password, mantenendo lo stesso account per StageDesk Pro e StageDesk Share.

Per il recupero desktop, Supabase deve consentire il redirect `https://stagedesk-pro.aigconsulting.it/auth-callback/` nelle URL di reindirizzamento dell'autenticazione. Il callback del provider resta invece `https://insoqzhjmrbrgfrsmlnj.supabase.co/auth/v1/callback`.

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

La dialog di apertura progetti usa l'elenco delle cartelle progetto disponibili, supporta ricerca, paginazione, rinomina ed eliminazione, e permette l'apertura dello Store pubblico in un tab dedicato dell'editor.

## Pubblicazione nello StageDesk Store

**Condividi** e **Pubblica nello Store** sono flussi distinti. Condividi prepara il copione per gli attori tramite link, QR code e PIN; Pubblica nello Store aggiorna il pacchetto catalogato associato all'autore.

Il comando di pubblicazione viene mostrato solo se il file Markdown attivo appartiene a un record `store_scripts` con `author_id` uguale all'utente autenticato. La verifica usa il nome del pacchetto del file attivo e non il nome del progetto; il copione dimostrativo viene sempre escluso. Ogni conferma carica un nuovo pacchetto `.stagedesk` e crea una versione incrementale con numero, data, autore e note di rilascio. Il catalogo conserva il pacchetto corrente mentre lo storico resta disponibile in `store_script_versions`.

Le dialog Condividi e Pubblica nello Store condividono una struttura responsive: intestazione, corpo informativo scorrevole e barra delle azioni. Nella condivisione QR code, stato, link e PIN restano raccolti nello stesso corpo della finestra.

Per attivare il flusso eseguire `docs/supabase-store-publication-versions.sql` dopo `docs/supabase-store.sql`. La migrazione aggiunge policy RLS e la funzione transazionale `publish_store_script`, che verifica la proprietà del copione e del percorso Storage prima di registrare la nuova versione.

## Filtri cue

La colonna Cue distingue tre ambiti:

1. **Contestuali**: mostra soltanto i cue presenti nel blocco corrente dell'editor; se il blocco non contiene cue, la lista resta vuota.
2. **Scena**: mostra tutti i cue associati alla scena corrente.
3. **Tutte**: mostra tutti i cue del file attivo.

Quando i risultati sono più di cinque, la lista viene suddivisa in pagine.

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
3. `Cmd+Invio` su macOS o `Ctrl+Invio` su Windows/Linux, dentro una textarea di nota o battuta, crea una riga sotto il box e sposta lì il cursore.

## Documenti applicativi

I documenti visualizzati dal menu utente sono Markdown nel repository:

1. `docs/app-help.md`: contenuto della voce Aiuto;
2. `docs/version-history.md`: contenuto della voce Novità.

L'app li carica da GitHub all'apertura del tab e usa il fallback compilato solo se la rete o GitHub non sono disponibili. In questo modo correzioni e integrazioni testuali possono essere pubblicate sul repository senza generare nuovi installer.

## Condivisione strutturata

La funzione Condividi genera un payload strutturato destinato alle future app attori. Il payload include:

1. metadati progetto e file;
2. personaggi ricavati dalla tabella personaggi;
3. battute con personaggio, scena, testo e riga sorgente;
4. note operative dei tipi movimento, posizione, personaggi in scena e tono.

Il nuovo flusso salva il file strutturato anche nel bucket privato `published-scripts` di Supabase, usando un percorso associato all'utente e all'UID della condivisione. La tabella privata `script_shares` conserva metadati, percorso del file, payload di fallback e hash del PIN; l'accesso degli attori avviene tramite RPC dopo autenticazione e verifica del PIN, senza esporre un URL pubblico diretto. La UI mostra link, QR code, PIN e stato di condivisione del file attivo.

Per configurare il flusso eseguire `docs/supabase-sharing.sql` dopo `docs/supabase-auth.sql` nel SQL Editor di Supabase.

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
