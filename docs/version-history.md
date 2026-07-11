# Novità

## Versione 1.0.7

> Patch dedicata a drag&drop editor e completamento autenticazione desktop.

- Riprogettato il drag&drop interno dell'app per cue, note e file multimediali con anteprima coerente e indicatore di rilascio esplicito.
- Corretto lo spostamento di cue e note nell'editor senza selezioni indesiderate del testo sottostante.
- Il rilascio di cue e note non forza più lo scroll verso la vecchia posizione del cursore.
- Migliorata la registrazione dei deep link su Linux per completare correttamente il login OAuth da Firefox o browser predefinito.
- Il callback OAuth desktop passa da una pagina HTTPS di completamento, evitando che il browser resti bloccato sulla pagina Google o GitHub dopo il rientro nell'app.
- Aggiunta la pagina statica `auth-callback` per completare l'autenticazione desktop e riaprire StageDesk Pro tramite deep link.

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
