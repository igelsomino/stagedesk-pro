export type AppDocument = {
  path: string
  title: string
  content: string
  remoteUrl: string
}

const githubRawBase = 'https://raw.githubusercontent.com/igelsomino/stagedesk-pro/main'
const githubWikiHome = 'https://raw.githubusercontent.com/wiki/igelsomino/stagedesk-pro/Home.md'
const githubWikiBase = 'https://github.com/igelsomino/stagedesk-pro/wiki'

export const compactAppDocumentMarkdown = (markdown: string) => markdown.trim().replace(/\n{3,}/g, '\n\n')

const wikiPageSlug = (title: string) =>
  title
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')

const normalizeWikiLinks = (markdown: string) =>
  markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => {
    const pageTitle = target.trim()
    return `[${(label ?? pageTitle).trim()}](${githubWikiBase}/${wikiPageSlug(pageTitle)})`
  })

const documentationFallback = compactAppDocumentMarkdown(`# Documentazione

La documentazione completa di StageDesk Pro è disponibile nel [wiki del progetto](${githubWikiBase}).

Apri le sezioni dalla home del wiki per consultare guida rapida, editor, note, battute, cue, modalità spettacolo, export, condivisione, aggiornamenti e sviluppo.
`)

const readmeFallback = compactAppDocumentMarkdown(`# Aiuto

> StageDesk Pro aiuta a preparare copioni teatrali, organizzare media, gestire cue e produrre export PDF.

## Operazioni principali

- Accedi con il tuo account e completa il profilo.
- Crea o apri un progetto.
- Cerca, rinomina o elimina progetti dalla dialog Apri progetto.
- Apri lo Store dal pulsante Importa nella dialog Apri progetto.
- Dallo Store aperto nell'app desktop importa direttamente i pacchetti \`.stagedesk\`, senza scaricare file Markdown.
- Nella versione desktop viene riaperto automaticamente l'ultimo progetto usato.
- Scrivi il copione nell'editor centrale.
- Organizza copioni, media e bookmark dalla colonna Struttura.
- Inserisci note di regia e cue multimediali direttamente nel testo.
- Usa oggetti battuta collegati alla tabella personaggi.
- Digita \`nota:\` su una riga vuota per inserire una nota generale con focus nel contenuto.
- Inserisci Atto, Scena, Sezione, battute e tabelle dalla toolbar teatrale.
- Usa Cmd+Invio su macOS o Ctrl+Invio su Windows/Linux dentro una nota o battuta per creare una riga sotto il box.
- Condividi il copione attivo per future app attori con un link \`/share/[UID]\`, QR code e PIN personale di cinque cifre.
- La condivisione richiede autenticazione e include personaggi, battute e note operative di movimento, posizione, personaggi in scena e tono.
- Collassa o espandi tutte le note e assegna colori predefiniti alle note.
- I media importati vengono salvati nella cartella progetto e restano collegati ai cue.
- Usa la modalità schermo intero per seguire battute e cue durante l'esecuzione; prima dell'avvio l'app segnala eventuali anomalie tipografiche o formali.
- Esporta il file attivo in PDF completo o pulito.
- Gli aggiornamenti desktop vengono scaricati e installati automaticamente quando disponibili.

## Link utili

- [Informativa privacy](http://stagedesk-pro.aigconsulting.it/informativa-privacy)
- [Termini d'uso](http://stagedesk-pro.aigconsulting.it/termini-uso)
- [Repository](https://github.com/igelsomino/stagedesk-pro)
- [Issues](https://github.com/igelsomino/stagedesk-pro/issues)
- [Release](https://github.com/igelsomino/stagedesk-pro/releases)
`)

const versionHistoryFallback = compactAppDocumentMarkdown(`# Novità

## Versione 1.0.30

> Corretto il catalogo Store e l'importazione dei copioni completi.

- Le tabelle dei personaggi mostrano solo i personaggi effettivamente presenti nelle battute.
- La colonna **Interprete** usa il valore compatto \`D/A\` e la colonna Note è stata rimossa dalle tabelle dei copioni pubblicati.
- Corretta l'interpretazione dei ruoli secondari e collettivi nei copioni classici, evitando battute assegnate al personaggio precedente.
- Rimossi dagli import i caratteri residui delle note editoriali e interrotta la lettura del testo al termine dell'opera.
- Rigenerati e pubblicati nello Storage Store tutti i pacchetti \`.stagedesk\` aggiornati.

## Versione 1.0.29

> Aggiornata la verifica formale della struttura del copione.

- Rimossa la segnalazione di errore per la presenza di più titoli H1.
- Gli H1 possono essere utilizzati per identificare più atti dello stesso copione.
- Rimane attivo il controllo che segnala l'assenza totale di un titolo H1.

## Versione 1.0.28

> Corretto definitivamente il riconoscimento e l'importazione dei pacchetti Store.

- La validazione riconosce l'intestazione della tabella personaggi anche in presenza di spaziatura diversa.
- Note, battute e cue vengono letti sia nei pacchetti con direttive a due \`:\` sia in quelli precedenti a tre \`:\`.
- Evitata la segnalazione errata di pacchetto StageDesk non valido durante l'importazione.

## Versione 1.0.27

> Corretto l'import del copione dal catalogo Store.

- I pacchetti StageDesk con estensione .stagedesk vengono riconosciuti anche quando usano la sintassi estesa compatibile con l'editor desktop.
- Risolto il controllo preliminare che segnalava erroneamente il pacchetto come non valido.
- Note registiche e battute vengono ora interpretate come oggetti del copione invece di essere mostrate come testo sorgente.

## Versione 1.0.26

> Aggiornamento dedicato all'importazione diretta dei copioni dallo Store desktop.

- Lo Store pubblica i copioni come pacchetti \`.stagedesk\`, senza esporre file Markdown scaricabili.
- Il comando **Importa in StageDesk Pro** viene mostrato soltanto quando lo Store è aperto nell'app desktop.
- L'importazione crea una nuova cartella progetto locale con il copione nella struttura \`copioni\`.
- Personaggi e note registiche vengono ricostruiti automaticamente dal pacchetto importato.
- Un browser normale continua a mostrare la scheda informativa dello Store senza il comando di importazione.

## Versione 1.0.22

> Aggiornamento dedicato alla condivisione del copione e alla continuità di lettura.

- Note e battute condivise vengono pubblicate in un unico elenco ordinato secondo la posizione reale nel copione.
- La pagina StageDesk Share mantiene la posizione della pagina quando si mostra o si nasconde una battuta.
- La selezione dei personaggi viene mantenuta dopo il refresh della pagina condivisa e ripristinata per il copione attivo.

## Versione 1.0.20

> Patch di stabilità della riproduzione audio.

- Corretto il monitoraggio della durata naturale dei cue audio: i cue in loop restano in esecuzione finché l'utente non li interrompe.

## Versione 1.0.19

> Aggiornamento dedicato a battute, gestione del menu e riproduzione audio.

- Rimosso il bordo di focus dal titolo delle note, mantenendo il focus visibile sul contenuto modificabile.
- Aggiunto il trascinamento delle battute nell'editor con indicatore della posizione di rilascio e anteprima compatta.
- Aggiunto il pulsante per eliminare una battuta direttamente dal suo header.
- Reso nuovamente visibile il comando Condividi nel menu teatrale.
- Resa più precisa la dissolvenza audio nel player web, includendo la durata naturale del file quando non è configurata una durata manuale.
- Allineata la temporizzazione della dissolvenza web a intervalli brevi e regolari.
- Verificato il player nativo desktop per mantenere fade in e fade out durante la riproduzione dei cue audio.

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

- La dialog Apri progetto include ricerca, paginazione, apertura rapida, rinomina ed eliminazione dei progetti.
- Il pulsante Importa apre lo Store in un tab dello spazio editor, con indicatore di caricamento.
- Pubblicata la pagina Store "Under Construction" sul sito pubblico StageDesk Pro.
- Migliorata la resa grafica della dialog Apri progetto: focus ricerca più discreto, lista compatta, pulsanti di pagina con icone e menu progetto più ordinato.
- La condivisione del copione include anche le note di movimento, posizione, personaggi in scena e tono.
- L'export PDF pulito conserva le note di movimento, posizione, personaggi in scena e tono.
- Aggiunta l'icona di stato condivisione nella schermata principale, senza bordo circolare.
- Migliorato l'ordinamento del menu Note: Nota generale è sempre in alto, con separatori dedicati.
- Corretto il testo dei bookmark salvati, evitando che venisse mostrato il codice del chip.

## Versione 1.0.15

> Aggiornamento dedicato a stabilita editor, documentazione pubblica e standard del repository.

- Corretto il rendering di Aiuto e Novità: le righe vuote Markdown non generano più paragrafi vuoti visibili tra le sezioni.
- Aggiunta la scorciatoia testuale \`nota:\` per creare una nota generale con focus automatico nel contenuto.
- Aggiunto Cmd+Invio su macOS e Ctrl+Invio su Windows/Linux nelle textarea di note e battute per creare una riga sotto il box.
- Migliorata la normalizzazione Markdown/editor per rimuovere righe vuote reali tra blocchi strutturali, note, cue e battute.
- I cue in modalità schermo intero vengono risolti tramite ID stabile, evitando duplicazioni di immagini e mancati avvii di cue musicali.
- Il player audio nativo applica fade in e fade out anche nella versione desktop.
- Aggiornati Aiuto, README tecnico e fallback offline dei documenti applicativi.
- Aggiunti Code of Conduct, guida contributi, licenza, security policy, template issue e template pull request per completare gli standard community del repository GitHub.
- Aggiunta la dialog Condividi per preparare il copione attivo destinato alle future app attori, con aggiornamento, rimozione, link e QR code.
- Rimossi gli shortcut da tastiera per Struttura e Battuta dal menu teatrale.

## Versione 1.0.14

> Aggiornamento dedicato alla sincronizzazione editor/fullscreen, agli oggetti battuta e alla toolbar teatrale.

- La modalità schermo intero parte dalla battuta o dalla sezione in cui si trova il cursore nell'editor.
- Uscendo dallo schermo intero, il focus torna alla battuta corrispondente nell'editor.
- Migliorata la persistenza dello stile dei box battuta dopo entrata e uscita dalla modalità schermo intero.
- Digitando i due punti dopo il nome di un personaggio presente nella tabella personaggi, la riga viene convertita automaticamente in un oggetto battuta.
- Aggiunte scorciatoie rapide per inserire Atto, Scena, Sezione e battute dei personaggi.
- Il pulsante struttura applica Atto, Scena o Sezione alla riga corrente, al testo selezionato o inserisce il titolo corretto se la riga è vuota.
- Digitando \`nota:\` su una riga vuota viene inserita una nota generale con focus automatico nel contenuto.
- Dentro le textarea di note e battute Cmd+Invio su macOS o Ctrl+Invio su Windows/Linux crea una nuova riga sotto il box e sposta lì il cursore.
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

- Corrette le anteprime nella colonna Struttura della versione web, con fallback ai media campione quando il file progetto non è disponibile.
- Sincronizzato lo stato play, pausa e stop delle anteprime cue e media anche quando il browser blocca l'avvio o il file termina senza evento affidabile.
- Migliorata la risoluzione delle anteprime media nell'app desktop macOS.
- Conservati tab, file attivo, selezione, posizione cursore e dimensione finestra tra cambio focus e riapertura dell'app desktop.

## Versione 1.0.11

> Aggiornamento dedicato a anteprime media, fullscreen e identità visiva.

- Le anteprime audio e video nella struttura media e nella colonna proprietà cue usano controlli applicativi coerenti con editor e fullscreen.
- Nell'app desktop le anteprime audio e musicali usano il player nativo.
- Entrando in modalità tutto schermo vengono interrotti cue in esecuzione nell'editor e anteprime media.
- I cue previsti in modalità tutto schermo vengono rieseguiti quando lo step lo richiede.
- Riallineati gli shortcut della modalità tutto schermo con la riproduzione multimediale e aggiunti comandi ghost cliccabili.
- Resa più robusta la pausa dei chip audio nell'editor.
- Aggiornata l'icona dell'applicazione e sostituito l'accento viola con l'arancione Ubuntu.
- Il pulsante di avvio fullscreen usa ora un'icona play piena.

## Versione 1.0.10

> Patch dedicata alla riproduzione dei cue audio su Linux.

- Aggiunto un player audio nativo per l'app desktop, usato per cue sonori e musicali in editor e modalità tutto schermo.
- La riproduzione audio su Linux non dipende più dal solo WebView/GStreamer.
- Sincronizzati play, pausa, ripresa e stop dei cue audio tra chip nell'editor, modalità tutto schermo e player nativo.

## Versione 1.0.8

> Patch dedicata a drag&drop note e avvio cue audio su Linux.

- Ripristinato il callback OAuth desktop diretto stagedeskpro://auth-callback.
- Aggiunto il recupero locale del progetto dimostrativo dopo refresh o riavvio automatico.
- Anticipato l'avvio dei cue audio sul gesto pointerdown per ridurre i blocchi autoplay su Linux/WebKit.
- Migliorati i messaggi di errore dei cue audio distinguendo blocco browser, file mancante e codec non supportato.
- Reso compatto il ghost delle note durante il drag&drop.
- Il trascinamento delle note parte dall'header della nota e non dal corpo modificabile.
- Disattivato il drag nativo delle note per mantenere stabile l'indicatore di rilascio nell'editor.
- Corretto l'avvio dei cue audio dall'editor su Linux eseguendo il comando play subito nel gesto utente.
- Conservata la preparazione asincrona di posizione iniziale, fade e stato playback dopo l'avvio immediato del cue.

## Versione 1.0.7

> Patch dedicata a drag&drop editor e completamento autenticazione desktop.

- Riprogettato il drag&drop interno dell'app per cue, note e file multimediali.
- Corretto lo spostamento di cue e note nell'editor senza selezioni indesiderate del testo sottostante.
- Il rilascio di cue e note non forza più lo scroll verso la vecchia posizione del cursore.
- Migliorata la registrazione dei deep link su Linux per completare il login OAuth.
- Il callback OAuth desktop passa da una pagina HTTPS di completamento per evitare browser bloccati sul redirect provider.

## Versione 1.0.5

> Patch dedicata a drag&drop macOS, link legali e controllo copione.

- Rafforzata la compatibilità del drag&drop su macOS per cue, note e file nella struttura multimediale.
- I link a informativa privacy e termini d'uso vengono aperti nel browser predefinito del sistema operativo.
- Il controllo copione accetta anche i due punti inclusi nel grassetto del nome personaggio.
- Ridotti i falsi positivi sui nomi personaggio numerati.

## Versione 1.0.4

> Patch dedicata a stabilità progetto, drag&drop macOS e controllo copione.

- All'avvio l'app desktop riapre automaticamente l'ultimo progetto aperto.
- Migliorata la compatibilità del drag&drop su macOS.
- Il fullscreen controlla formato battute, struttura atti/scene/personaggi e paragrafi scollegati prima dell'avvio.
- Le anomalie vengono mostrate in un riquadro sotto l'editor e sono cliccabili.

## Versione 1.0.3

> Patch dedicata a media, drag&drop e salvataggio.

- I file multimediali importati vengono salvati nella cartella progetto.
- Rinomina, spostamento ed eliminazione media aggiornano i cue collegati.
- Migliorato il drag&drop di cue, note e file media.
- Serializzati i salvataggi automatici verso la cartella progetto.

## Versione 1.0.2

> Aggiornamento dedicato all'installazione automatica delle nuove versioni.

- Quando l'app desktop rileva una nuova versione, scarica e installa automaticamente l'aggiornamento.
- Il comando Aggiornamenti avvia direttamente download, installazione e riavvio.
- Prima del riavvio vengono salvate le modifiche correnti al progetto.

## Versione 1.0.0

> Prima versione stabile di StageDesk Pro.

- Aiuto e Novità vengono caricati dal repository GitHub, con fallback locale.
- I link nell'editor vengono aperti nel browser predefinito del sistema.
- Migliorata la gestione dei profili multipli utente.
- Rimossi i parametri di configurazione dai sorgenti pubblicati.
`)

export const appDocuments: AppDocument[] = [
  {
    path: 'app://readme',
    title: 'Aiuto',
    content: readmeFallback,
    remoteUrl: `${githubRawBase}/docs/app-help.md`,
  },
  {
    path: 'app://version-history',
    title: 'Novità',
    content: versionHistoryFallback,
    remoteUrl: `${githubRawBase}/docs/version-history.md`,
  },
  {
    path: 'app://documentation',
    title: 'Documentazione',
    content: documentationFallback,
    remoteUrl: githubWikiHome,
  },
]

export const getAppDocument = (path: string) => appDocuments.find((document) => document.path === path)

export const isAppDocumentPath = (path: string) => Boolean(getAppDocument(path))

export const fetchAppDocumentContent = async (document: AppDocument) => {
  const response = await fetch(`${document.remoteUrl}?_=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Documento remoto non disponibile: ${response.status}`)
  const content = compactAppDocumentMarkdown(await response.text())
  return document.path === 'app://documentation' ? normalizeWikiLinks(content) : content
}

export const appDocumentContent = (document: AppDocument, installedVersion?: string, remoteContent?: string) => {
  const content = compactAppDocumentMarkdown(remoteContent || document.content)
  if (document.path === 'app://documentation') return normalizeWikiLinks(content)
  if (document.path !== 'app://version-history' || !installedVersion) return content
  return compactAppDocumentMarkdown(`# Novità

> Aggiornamento installato: **StageDesk Pro ${installedVersion}**. Questa pagina è stata aperta automaticamente per mostrarti cosa è cambiato.

${content.replace(/^# Novità\s*/, '')}`)
}
