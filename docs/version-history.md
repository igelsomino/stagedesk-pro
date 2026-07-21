# Novità

## Versione 1.0.25

> Recupero password integrato nelle schermate di accesso.

- Aggiunto il comando **Password dimenticata?** nella pagina di login desktop.
- Aggiunto l'invio del link di recupero tramite Supabase e la pagina per impostare e confermare una nuova password.
- Aggiunto lo stesso flusso nella pagina StageDesk Share, mantenendo il collegamento alla condivisione e al relativo PIN.
- Dopo l'accesso OAuth viene verificato il profilo applicativo e, se incompleto, viene richiesto il completamento prima di entrare nell'app o nel copione condiviso.
- Allineata la registrazione Share ai campi desktop: nome, cognome, telefono, profili multipli e consensi.
- Aggiunto il profilo operativo **Attore/Attrice**, uniformata la label **Autore/Autrice** e aggiornati normalizzazione e vincoli Supabase.
- Chiarita la separazione tra `profiles` e Supabase Auth: provider e password restano gestiti dal sistema Auth e non vengono salvati nella tabella applicativa.
- Documentati i redirect URL necessari per configurare il recupero password in Supabase.

## Versione 1.0.24

> Patch dedicata alla conclusione del login OAuth desktop.

- La pagina HTTPS di completamento mantiene il browser su una pagina stabile mentre riapre StageDesk Pro tramite deep link.
- Dopo l'autenticazione viene mostrato subito un messaggio che indica quando è possibile chiudere la finestra del browser.
- Mantenuto il collegamento manuale **Riapri StageDesk Pro** come fallback se il sistema operativo non avvia automaticamente l'app.
- Aggiornati i sorgenti e gli installer per macOS, Windows e Linux.

## Versione 1.0.23

> Aggiornamento dedicato al completamento dell'autenticazione OAuth desktop.

- Il login con Google, GitHub e Azure ora passa da una pagina HTTPS pubblica di completamento invece di reindirizzare direttamente il browser allo schema dell'app.
- Dopo l'autenticazione, la pagina riapre StageDesk Pro tramite deep link e mostra un messaggio esplicito che consente di chiudere la finestra del browser.
- Aggiunto un collegamento manuale per riaprire StageDesk Pro quando il browser non avvia automaticamente l'app.
- Aggiornati gli installer e i metadati dell'updater per macOS, Windows e Linux.

## Versione 1.0.21

> Condivisione privata dei copioni con accesso per gli attori.

- Reso nuovamente visibile il comando **Condividi** nel menu teatrale.
- Ogni condivisione ora usa un identificativo univoco e un link dedicato `/share/[UID]`.
- Generato un PIN attore di cinque cifre, visualizzato nella dialog di condivisione e reimpostabile dall'autore del progetto.
- Aggiunta una pagina responsive per l'accesso degli attori con Google, GitHub, Azure oppure email e password.
- Aggiunta la selezione di uno o più personaggi, la visualizzazione filtrata delle battute e lo stato di apprendimento locale.
- Copiato il file condiviso nel bucket privato Supabase `published-scripts`, mantenendo il percorso associato all'UID.
- Aggiunta la migrazione Supabase `docs/supabase-sharing.sql` con RLS e RPC per pubblicazione e verifica del PIN.

## Versione 1.0.20

> Patch di stabilità della riproduzione audio.

- Corretto il monitoraggio della durata naturale dei cue audio: i cue in loop restano in esecuzione finché l'utente non li interrompe.

## Versione 1.0.19

> Aggiornamento dedicato a battute, gestione del menu e riproduzione audio.

- Rimosso il bordo di focus dal titolo delle note, mantenendo il focus visibile sul contenuto modificabile.
- Aggiunto il trascinamento delle battute nell'editor con indicatore della posizione di rilascio e anteprima compatta.
- Aggiunto il pulsante per eliminare una battuta direttamente dal suo header.
- Nascosto il comando Condividi dal menu teatrale.
- Resa più precisa la dissolvenza audio nel player web, includendo la durata naturale del file quando non è configurata una durata manuale.
- Allineata la temporizzazione della dissolvenza web a intervalli brevi e regolari, evitando fade più lunghi del valore impostato.
- Verificato il player nativo desktop per mantenere fade in e fade out durante la riproduzione dei cue audio.

## Versione 1.0.18

> Aggiornamento dedicato all'export PDF e alla compatibilità delle note su Linux.

- Corretto il rendering delle linee orizzontali Markdown (`hr`) nell'export PDF.
- Le note dell'editor vengono convertite in blocchi di export anche quando i metadati del progetto non sono disponibili o non sono sincronizzati.
- L'export PDF riconosce direttamente i marker nota presenti nel documento, mantenendo le note previste anche su Linux.
- Aggiunti test automatici per linee orizzontali, marker nota e fallback dei metadati.

## Versione 1.0.17

> Aggiornamento dedicato alla chiarezza dei filtri cue, alla stabilità dell'editor e alla diagnostica.

- Ridefinito il filtro **Contestuali**: mostra esclusivamente i cue presenti nel blocco corrente dell'editor e non ricade più automaticamente sui cue della scena o dell'intero file.
- Confermato il comportamento distinto dei filtri **Scena** e **Tutte**: rispettivamente cue della scena corrente e cue dell'intero file attivo.
- Aggiunto un messaggio esplicito quando il blocco corrente non contiene cue contestuali.
- La lista dei cue viene paginata oltre cinque risultati, con navigazione tramite icone.
- Aggiunti ai log diagnostici i riferimenti dei cue contestuali e gli eventi di lifecycle, focus, refresh e riproduzione media.
- Corretto il reset dei riferimenti contestuali quando si passa a Store o a un tab senza file attivo.

## Versione 1.0.16

> Aggiornamento dedicato a gestione progetti, Store, condivisione strutturata e finiture UI.

- La dialog Apri progetto ora include ricerca, paginazione, apertura rapida, rinomina ed eliminazione dei progetti.
- Aggiunto il pulsante Importa nella dialog Apri progetto: apre il tab Store nello spazio editor e carica la pagina pubblica `/store/`.
- Il tab Store mostra un indicatore di caricamento finché la pagina esterna non è pronta.
- Pubblicata la pagina Store "Under Construction" sul sito pubblico StageDesk Pro.
- Migliorata la resa grafica della dialog Apri progetto: focus ricerca più discreto, lista compatta, pulsanti di pagina con icone e menu progetto più ordinato.
- La condivisione del copione include anche le note di movimento, posizione, personaggi in scena e tono.
- L'export PDF pulito conserva le note di movimento, posizione, personaggi in scena e tono, continuando a rimuovere gli altri marcatori operativi.
- Aggiunta l'icona di stato condivisione nella schermata principale, senza bordo circolare.
- Migliorato l'ordinamento del menu Note: Nota generale è sempre in alto, con separatori dedicati.
- Corretto il testo dei bookmark salvati, evitando che in alcuni casi venisse mostrato il codice del chip.

## Versione 1.0.15

> Aggiornamento dedicato a stabilita editor, documentazione pubblica e standard del repository.

- Corretto il rendering di Aiuto e Novità: le righe vuote Markdown non generano più paragrafi vuoti visibili tra le sezioni.
- Aggiunta la scorciatoia testuale `nota:` per creare una nota generale con focus automatico nel contenuto.
- Aggiunto `Cmd+Invio` su macOS e `Ctrl+Invio` su Windows/Linux nelle textarea di note e battute per creare una riga sotto il box.
- Migliorata la normalizzazione Markdown/editor per rimuovere righe vuote reali tra blocchi strutturali, note, cue e battute.
- I cue in modalità schermo intero vengono risolti tramite ID stabile, evitando duplicazioni di immagini e mancati avvii di cue musicali.
- Il player audio nativo applica fade in e fade out anche nella versione desktop.
- Aggiornati Aiuto, README tecnico e fallback offline dei documenti applicativi.
- Aggiunti Code of Conduct, guida contributi, licenza, security policy, template issue e template pull request per completare gli standard community del repository GitHub.

## Versione 1.0.14

> Aggiornamento dedicato alla sincronizzazione editor/fullscreen, agli oggetti battuta e alla toolbar teatrale.

- La modalità schermo intero parte dalla battuta o dalla sezione in cui si trova il cursore nell'editor.
- Uscendo dallo schermo intero, il focus torna alla battuta corrispondente nell'editor.
- Migliorata la persistenza dello stile dei box battuta dopo entrata e uscita dalla modalità schermo intero.
- Digitando i due punti dopo il nome di un personaggio presente nella tabella personaggi, la riga viene convertita automaticamente in un oggetto battuta.
- Aggiunte scorciatoie rapide per inserire Atto, Scena, Sezione e battute dei personaggi.
- Il pulsante struttura applica Atto, Scena o Sezione alla riga corrente, al testo selezionato o inserisce il titolo corretto se la riga è vuota.
- Digitando `nota:` su una riga vuota viene inserita una nota generale con focus automatico nel contenuto.
- Dentro le textarea di note e battute `Cmd+Invio` su macOS o `Ctrl+Invio` su Windows/Linux crea una nuova riga sotto il box e sposta lì il cursore.
- Aggiunto un pulsante dedicato per collassare o espandere tutte le note dell'editor.
- Aggiunto un inserimento tabella da toolbar con selezione rapida di righe e colonne e prima riga impostata come intestazione.
- Rimossi i paragrafi vuoti reali generati tra blocchi strutturali, note, cue e battute durante la conversione Markdown/editor.
- I cue in modalità schermo intero vengono risolti tramite ID stabile; questo evita duplicazioni di immagini e mancati avvii dei cue musicali.
- Il player audio nativo applica fade in e fade out anche nella versione desktop.
- Le tabelle vuote non vengono renderizzate in modalità schermo intero.
- Raffinati gli stili di note, menu tipo nota, menu personaggio e box battuta.

## Versione 1.0.13

> Aggiornamento dedicato a battute strutturate, menu teatrale, PDF e anteprime media.

- Aggiunti gli oggetti battuta collegati alla tabella personaggi del documento.
- Il menu teatro raggruppa struttura, note, battute ed export in sottomenu più ordinati.
- Il menu tabella è disponibile solo quando la selezione è dentro una tabella.
- Il progetto di esempio e i nuovi progetti iniziano dalla tabella personaggi, seguita da Atto 1, Scena 1 e nota personaggi in scena.
- Aggiornata la validazione del copione per riconoscere le battute strutturate.
- Migliorato il rendering PDF delle battute e aumentati i margini superiori dei titoli H1, H2 e H3.
- Rifiniti i player di anteprima media nella Struttura e nella colonna Cue.

## Versione 1.0.12

> Patch dedicata alla sincronizzazione delle anteprime e alla persistenza dell'interfaccia.

- Corrette le anteprime nella colonna Struttura della versione web: i media del progetto usano il file reale e, se necessario, il fallback ai media campione.
- Sincronizzato lo stato play, pausa e stop delle anteprime cue e media anche quando il browser blocca l'avvio o il file termina senza emettere un evento di fine affidabile.
- Migliorata la risoluzione delle anteprime media nell'app desktop macOS usando una lettura controllata del file progetto o della risorsa campione.
- Conservati tab, file attivo, selezione, posizione cursore e dimensione finestra tra cambio focus e riapertura dell'app desktop.

## Versione 1.0.11

> Aggiornamento dedicato a anteprime media, fullscreen e identità visiva.

- Le anteprime audio e video nella struttura media e nella colonna proprietà cue usano controlli applicativi coerenti con editor e fullscreen.
- Nell'app desktop le anteprime audio e musicali usano il player nativo, riducendo i problemi di riproduzione su Linux.
- Entrando in modalità tutto schermo vengono interrotti cue in esecuzione nell'editor e anteprime media.
- I cue previsti in modalità tutto schermo vengono rieseguiti quando lo step lo richiede, anche se erano già stati eseguiti nell'editor o in uno step precedente.
- Riallineati gli shortcut della modalità tutto schermo con la riproduzione multimediale e aggiunti comandi ghost cliccabili in basso a destra.
- Resa più robusta la pausa dei chip audio nell'editor.
- Aggiornata l'icona dell'applicazione e sostituito l'accento viola con l'arancione Ubuntu.
- Il pulsante di avvio fullscreen usa ora un'icona play piena.

## Versione 1.0.10

> Patch dedicata alla riproduzione dei cue audio su Linux.

- Aggiunto un player audio nativo per l'app desktop, usato per cue sonori e musicali in editor e modalità tutto schermo.
- La riproduzione audio su Linux non dipende più dal solo WebView/GStreamer e riduce i casi di blocco con messaggio "avvio bloccato dal browser".
- Sincronizzati play, pausa, ripresa e stop dei cue audio tra chip nell'editor, modalità tutto schermo e player nativo.
- Migliorata la gestione dello stato di fine cue anche quando il file viene riprodotto fuori dal tag HTML audio.
- Mantenuto il fallback HTML per il progetto dimostrativo non ancora salvato su una cartella reale.

## Versione 1.0.8

> Patch dedicata a drag&drop note e avvio cue audio su Linux.

- Ripristinato il callback OAuth desktop diretto `stagedeskpro://auth-callback`, eliminando la dipendenza dal dominio pubblico durante login Google/GitHub su macOS e Linux.
- Aggiunto il recupero locale del progetto dimostrativo per evitare che un refresh o un riavvio automatico ripristini la versione iniziale mentre l'utente sta scrivendo.
- Anticipato l'avvio dei cue audio sul gesto `pointerdown` del pulsante play per ridurre i blocchi autoplay su Linux/WebKit.
- Migliorati i messaggi di errore dei cue audio distinguendo blocco browser, file mancante e codec/formato non supportato.
- Reso compatto il ghost delle note durante il drag&drop, evitando l'anteprima nativa grande quanto tutta la nota.
- Il trascinamento delle note parte dall'header della nota e non dal corpo modificabile, riducendo i conflitti con WebKit su macOS e Linux.
- Disattivato il drag nativo delle note per mantenere stabile l'indicatore di rilascio nell'editor.
- Corretto l'avvio dei cue audio dall'editor su Linux: il comando `play()` viene eseguito subito nel gesto utente, prima delle attese di preparazione media.
- Conservata la preparazione asincrona di posizione iniziale, fade e stato playback dopo l'avvio immediato del cue.

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
