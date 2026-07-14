# Aiuto

> StageDesk Pro aiuta a preparare un copione teatrale, organizzare materiali multimediali e gestire cue, note di regia, prove ed export PDF.

## Accesso e profilo

Per usare l'app devi accedere con un account. Alla prima registrazione viene richiesto di completare il profilo con nome, cognome, telefono e uno o più profili operativi: regista, autore o altro.

Link utili:

- [Informativa privacy](http://stagedesk-pro.aigconsulting.it/informativa-privacy)
- [Termini d'uso](http://stagedesk-pro.aigconsulting.it/termini-uso)

## Creare o aprire un progetto

Usa il pulsante Nuovo per creare un progetto. L'app chiede il nome e prepara un copione iniziale minimale con titolo, Atto 1, Scena 1 e una prima battuta modificabile.

Usa Apri progetto per rientrare in un progetto già creato. La dialog permette di cercare il progetto, scorrere la lista a pagine, aprirlo con un click, rinominarlo o eliminarlo dal menu con i tre puntini verticali.

Il pulsante Importa nella stessa dialog apre lo Store in un tab dello spazio editor. Lo Store è predisposto per contenuti importabili e, nella versione corrente, mostra una pagina pubblica "Under Construction".

Il salvataggio è automatico.

Nella versione desktop l'app riapre automaticamente l'ultimo progetto usato. Se non trova un progetto precedente, mostra il file di esempio iniziale.

## Area di lavoro

La schermata principale è divisa in tre zone:

- Struttura, a sinistra, con indice del documento, copioni, media e bookmark.
- Editor, al centro, dove scrivi e modifichi il copione.
- Cue, a destra, dove cerchi, selezioni e modifichi le proprietà dei cue.

## Scrivere il copione

L'editor supporta titoli, paragrafi, grassetto, corsivo, elenchi, citazioni, tabelle, link e separatori.

Il documento può contenere anche oggetti battuta. Gli oggetti battuta mantengono separati personaggio e testo, sono collegati alla tabella personaggi del copione e vengono usati per la modalità schermo intero.

Per una battuta usa questo formato:

`**MIRANDOLINA**: A pranzo, che cosa comanda?`

È accettato anche il formato con i due punti inclusi nel grassetto:

`**MIRANDOLINA:** A pranzo, che cosa comanda?`

I link Markdown come `[sito](https://esempio.it)` vengono visualizzati come collegamenti cliccabili e aperti nel browser predefinito del sistema.

Se digiti i due punti dopo il nome di un personaggio presente nella tabella personaggi, StageDesk Pro converte automaticamente la riga in un oggetto battuta.

Se digiti `nota:` su una riga vuota, StageDesk Pro inserisce una nota generale e porta il focus direttamente nel contenuto della nota.

Quando stai scrivendo dentro la textarea di una battuta o di una nota, usa `Cmd+Invio` su macOS o `Ctrl+Invio` su Windows/Linux per creare una nuova riga sotto il box e continuare a scrivere nell'editor. `Shift+Invio` resta disponibile per andare a capo dentro la textarea.

Dal menu con le maschere puoi inserire rapidamente Atto, Scena, Sezione, note di regia, battute dei personaggi, export e condivisione. I comandi Atto, Scena e Sezione applicano lo stile alla riga corrente, al testo selezionato o inseriscono il titolo base quando la riga è vuota.

Scorciatoie utili:

| Scorciatoia | Azione |
| --- | --- |
| Cmd/Ctrl+Invio | Esci dalla textarea di nota o battuta e crea una riga sotto il box |

## Note di regia

Le note di regia sono blocchi colorati inseriti direttamente nel testo. Ogni nota può essere modificata, collassata, eliminata e classificata per tipo, ad esempio movimento, tono, luce, audio, video, immagine o personaggi in scena.

La scorciatoia testuale `nota:` crea una nota generale nel punto corrente. Dopo l'inserimento il cursore viene spostato automaticamente nella textarea della nota.

Puoi collassare o espandere tutte le note con il pulsante dedicato nella toolbar. Dal menu del tipo nota puoi anche scegliere un colore predefinito.

## Tabelle

Puoi inserire tabelle dalla toolbar scegliendo righe e colonne come in un editor di testo. La prima riga viene impostata come intestazione.

La tabella personaggi è protetta: non è possibile eliminare la riga di intestazione o l'intera tabella. Le righe dei personaggi possono invece essere aggiunte o rimosse.

## Cue multimediali

I cue sono chip inseriti nel copione e collegati ai media del progetto. Sono disponibili cue audio, musica, immagine e video.

I cue audio e musicali hanno controlli nel chip: play/pausa, stop quando il cue è in esecuzione e indicatore equalizzatore.

Nella colonna Cue puoi scegliere tra tre filtri:

- **Contestuali**: mostra solo i cue presenti nel blocco corrente dell'editor;
- **Scena**: mostra tutti i cue della scena corrente;
- **Tutte**: mostra tutti i cue del file attivo.

Se il filtro Contestuali non trova cue nel blocco corrente, la lista resta vuota. Oltre cinque risultati vengono distribuiti su più pagine.

## Raccolta media

La raccolta media è organizzata in suoni, musiche, immagini e video. Puoi importare file, creare cartelle, rinominare elementi e spostare media tra cartelle.

I file importati vengono copiati nella cartella del progetto. Quando sposti, rinomini o elimini un media, i cue collegati vengono aggiornati o rimossi dal documento.

Le cartelle principali della raccolta media sono protette da rinomina ed eliminazione.

## Bookmark

I bookmark servono a segnare punti importanti del copione. Li puoi inserire dalla toolbar e ritrovare nel tab Bookmark della colonna Struttura.

## Modalità schermo intero

La modalità schermo intero presenta battute e cue come step autonomi. I cue con autoplay partono automaticamente quando raggiungi lo step.

Prima di entrare in schermo intero StageDesk Pro controlla il copione. Se trova anomalie tipografiche o formali, mostra un riquadro sotto l'editor con la lista degli errori. Ogni riga indica il punto del documento, il tipo di problema e il frammento interessato. Clicca una riga per spostare il cursore nel punto da correggere.

Il controllo verifica, tra le altre cose:

- formato battute, ad esempio `**MIRANDOLINA**: Battuta`;
- titoli H2 per gli atti;
- titoli H3 per scene, sinossi e personaggi;
- nomi personaggio potenzialmente incoerenti;
- battute senza personaggio;
- paragrafi non collegati a note, citazioni, cue o sezioni strutturate.

I nomi numerati con la stessa base, ad esempio "Personaggio 1" e "Personaggio 2", non vengono considerati incoerenti tra loro.

| Tasto | Azione |
| --- | --- |
| Freccia destra | Step successivo |
| Freccia sinistra | Step precedente |
| Home | Primo step |
| Fine | Ultimo step |
| Spazio | Play/pausa del media corrente |
| S | Stop del media corrente |
| R | Riavvio del cue corrente |
| Esc | Uscita |

## Export

Il menu Export genera un PDF del file attivo:

- completo, con note e cue;
- pulito, senza marcatori visuali ma con le note operative di movimento, posizione, personaggi in scena e tono.

Alla fine dell'export l'app mostra dove è stato salvato il file e, quando possibile, un comando per aprirlo.

## Condivisione copione

Dal menu con le maschere puoi aprire Condividi. La dialog prepara e carica su Supabase Storage il copione attivo, pensato per le future app Android e iOS dedicate agli attori.

Il file condiviso contiene i personaggi, le relative battute con identificativi, scena e riga sorgente, e le note operative di movimento, posizione, personaggi in scena e tono. Dalla stessa dialog puoi aggiornare l'ultima versione condivisa, interrompere la condivisione eliminando il file, copiare il link o condividerlo tramite QR code.

Quando il file attivo è condiviso, la schermata principale mostra un'icona di stato vicino alle informazioni di salvataggio.

Nelle app attori, dopo l'accesso con Google, GitHub o Azure, l'utente potrà selezionare il proprio personaggio e visualizzare o nascondere le proprie battute per studiare la parte.

## Aggiornamenti e supporto

Dal menu con tre puntini verticali puoi aprire Novità, Aiuto, Aggiornamenti ed Esci.

Quando è disponibile una nuova versione, l'app desktop scarica e installa automaticamente l'aggiornamento. Al termine dell'installazione StageDesk Pro viene riavviato e apre Novità con la versione installata in evidenza.

Collegamenti progetto:

- [Repository](https://github.com/igelsomino/stagedesk-pro)
- [Segnala un problema](https://github.com/igelsomino/stagedesk-pro/issues)
- [Pull request](https://github.com/igelsomino/stagedesk-pro/pulls)
- [Release](https://github.com/igelsomino/stagedesk-pro/releases)
- [Workflow](https://github.com/igelsomino/stagedesk-pro/actions)
