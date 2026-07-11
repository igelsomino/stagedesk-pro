# Novità

## Versione 1.0.5

> Patch dedicata a drag&drop macOS, link legali e controllo copione.

- Rafforzata la compatibilità del drag&drop su macOS per cue, note e file nella struttura multimediale.
- L'editor accetta esplicitamente il rilascio di cue, note e media anche quando WebKit non espone correttamente i tipi del trascinamento.
- I link a informativa privacy e termini d'uso vengono aperti nel browser predefinito del sistema operativo nell'app desktop.
- Il controllo copione non segnala più come errore i due punti inclusi nel grassetto del nome personaggio.
- Ridotti i falsi positivi sui nomi personaggio numerati, ad esempio "Personaggio 1" e "Personaggio 2".

## Versione 1.0.4

> Patch dedicata a stabilità progetto, drag&drop macOS e controllo copione.

- All'avvio l'app desktop riapre automaticamente l'ultimo progetto aperto.
- Il progetto di esempio non viene più salvato accidentalmente sulla cartella progetto durante refresh o riavvii.
- Migliorata la compatibilità del drag&drop su macOS per cue, note e file nella struttura multimediale.
- Il pulsante fullscreen esegue un controllo tipografico e formale prima di avviare la modalità spettacolo.
- Gli errori del copione vengono mostrati in un riquadro sotto l'editor con riga, tipo di anomalia e frammento evidenziato.
- Cliccando un'anomalia il cursore viene portato nel punto corrispondente dell'editor.

## Versione 1.0.3

> Patch dedicata a media, drag&drop e coerenza del salvataggio.

- I file multimediali importati vengono salvati fisicamente nella cartella del progetto.
- La rinomina, lo spostamento e l'eliminazione dei media aggiornano anche i cue collegati.
- L'eliminazione di un media rimuove i cue collegati anche dal documento, evitando chip orfani.
- Migliorato il drag&drop di cue, note e file nella struttura multimediale.
- Le cartelle root della raccolta media restano protette anche dalla rinomina.
- I salvataggi automatici verso la cartella progetto vengono serializzati per ridurre il rischio di scritture fuori ordine.

## Versione 1.0.2

> Aggiornamento dedicato all'installazione automatica delle nuove versioni.

- Quando l'app desktop rileva una nuova versione, scarica e installa automaticamente l'aggiornamento.
- Il comando Aggiornamenti nel menu applicazione avvia direttamente download, installazione e riavvio, senza richiesta di conferma.
- Prima del riavvio vengono salvate le modifiche correnti al progetto.
- Se un aggiornamento è già in corso, il comando Aggiornamenti mostra lo stato senza avviare un secondo processo.

## Versione 1.0.1

> Aggiornamento dedicato al progetto iniziale, ai nuovi progetti e alle tabelle Markdown.

- Il progetto dimostrativo di primo avvio mostra un avviso che chiarisce che il file è un esempio non registrato sul dispositivo.
- I nuovi progetti partono da un copione minimale e non replicano il contenuto dimostrativo.
- Le tabelle Markdown incollate o digitate nell'editor vengono convertite in tabelle editabili.
- Migliorata la persistenza delle modifiche prima dell'apertura dei PDF esportati.

## Versione 1.0.0

> Prima versione stabile di StageDesk Pro.

- Aiuto e Novità vengono caricati direttamente dal repository GitHub, con fallback locale se la rete non è disponibile.
- I link nell'editor vengono aperti nel browser predefinito del sistema.
- Migliorata la gestione dei profili multipli utente: il campo `user_types` conserva tutte le selezioni.
- La configurazione di autenticazione non è salvata nei sorgenti pubblicati.
- Migliorato il rendering PDF delle citazioni nella versione completa e nella versione pulita.
- L'editor renderizza i collegamenti Markdown come link cliccabili.

## Versione 0.1.13

> Patch dedicata alla validazione della sessione utente.

- La sessione locale viene validata prima di mostrare la schermata profilo.
- Se l'utente non esiste più o la sessione è orfana, l'app cancella la sessione locale e torna al login.
- Evitato il passaggio improprio alla schermata Completa il profilo quando non esiste un utente valido.

## Versione 0.1.12

> Patch dedicata alla persistenza dell'editor quando l'app perde focus.

- Il contenuto modificato nell'editor viene incorporato nel progetto prima di ogni salvataggio automatico.
- I draft pendenti vengono salvati immediatamente quando la finestra perde focus o l'app diventa nascosta.
- Corretto il caso del file completamente svuotato: il contenuto vuoto resta persistito e non viene ripristinato dal testo di esempio.

## Versione 0.1.11

> Patch dedicata al ciclo di autenticazione nell'app desktop macOS.

- Aggiunto deep link desktop `stagedeskpro://auth-callback`.
- I provider OAuth vengono aperti nel browser di sistema.
- Gestito il rientro OAuth sia con app già aperta sia con app avviata dal deep link.

## Versione 0.1.10

> Aggiornamento dedicato ai provider OAuth e al menu applicazione.

- Aggiunto provider Azure nell'accesso.
- Migliorato il feedback dei pulsanti OAuth.
- Spostato Esci nel menu applicazione dopo Aggiornamenti.

## Versione 0.1.9

> Aggiornamento dedicato ad autenticazione, profili utente e stabilità della modalità fullscreen.

- Aggiunta autenticazione obbligatoria.
- Supportato accesso email/password e provider esterni.
- Introdotto completamento profilo obbligatorio.
- Stabilizzato il playback musicale in fullscreen.

## Versione 0.1.8

> Patch dedicata al flusso di installazione degli aggiornamenti.

- Separati download e installazione.
- Migliorato il feedback utente durante download, installazione e riavvio.

## Versione 0.1.7

> Patch dedicata alla stabilità della riproduzione MP3 su Linux.

- Preparazione asincrona dei media prima dell'avvio.
- Ridotto il rischio di salti all'inizio dei cue MP3 su WebKitGTK/Linux.

## Versione 0.1.6

> Patch dedicata alla riproduzione media su Linux, al metadata aggiornamenti e alla pulizia della documentazione.

- Migliorata l'inizializzazione di audio e video.
- Corretto il metadata `latest.json`.
- Sostituita la scritta di uscita dal fullscreen con un pulsante a icona.

## Versione 0.1.5

> Aggiornamento dedicato a bookmark, stabilità del drag & drop e documentazione applicativa.

- Aggiunti bookmark inline nel documento e tab Bookmark.
- Migliorato lo stile delle citazioni nell'editor.
- Stabilizzato il drag & drop di cue, note e media.

## Versione 0.1.4

> Aggiornamento dedicato alla pubblicazione, agli aggiornamenti automatici e alla stabilità dei cue.

- Verifica aggiornamenti eseguita automaticamente all'avvio dell'app desktop.
- Stop dei cue audio/musica nell'editor reso immediato.
- Export PDF con notifica di completamento e comando Apri PDF.

## Versione 0.1.3

> Aggiornamento dedicato al progetto iniziale e alla gestione dei cue multimediali.

- Progetto iniziale rinominato in `La locandiera`.
- Media campione reali e copia automatica nei nuovi progetti.
- Colonna Cue sincronizzata con i chip presenti nell'editor.

## Versione 0.1.2

> Stabilizzazione di fullscreen, export e sincronizzazione cue.

- Eliminazione cue sincronizzata tra inspector ed editor.
- Export PDF completo e pulito con tabelle, grassetto e note in box.
- Navigazione fullscreen con frecce, Home e Fine.

## Versione 0.1.1

- Firma e pacchettizzazione macOS corrette.
- Installer desktop aggiornati.

## Versione 0.1.0

> Prima pubblicazione desktop con aggiornamenti automatici.

- Repository GitHub e pipeline Release.
- Build macOS, Windows e Linux.
- `latest.json` per Tauri Updater.
- Comando Aggiornamenti dal menu applicazione.
