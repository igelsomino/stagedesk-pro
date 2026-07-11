export type AppDocument = {
  path: string
  title: string
  content: string
  remoteUrl: string
}

const githubRawBase = 'https://raw.githubusercontent.com/igelsomino/stagedesk-pro/main'

export const compactAppDocumentMarkdown = (markdown: string) => markdown.trim().replace(/\n{3,}/g, '\n\n')

const readmeFallback = compactAppDocumentMarkdown(`# Aiuto

> StageDesk Pro aiuta a preparare copioni teatrali, organizzare media, gestire cue e produrre export PDF.

## Operazioni principali

- Accedi con il tuo account e completa il profilo.
- Crea o apri un progetto.
- Nella versione desktop viene riaperto automaticamente l'ultimo progetto usato.
- Scrivi il copione nell'editor centrale.
- Organizza copioni, media e bookmark dalla colonna Struttura.
- Inserisci note di regia e cue multimediali direttamente nel testo.
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
]

export const getAppDocument = (path: string) => appDocuments.find((document) => document.path === path)

export const isAppDocumentPath = (path: string) => Boolean(getAppDocument(path))

export const fetchAppDocumentContent = async (document: AppDocument) => {
  const response = await fetch(`${document.remoteUrl}?_=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Documento remoto non disponibile: ${response.status}`)
  return compactAppDocumentMarkdown(await response.text())
}

export const appDocumentContent = (document: AppDocument, installedVersion?: string, remoteContent?: string) => {
  const content = compactAppDocumentMarkdown(remoteContent || document.content)
  if (document.path !== 'app://version-history' || !installedVersion) return content
  return compactAppDocumentMarkdown(`# Novità

> Aggiornamento installato: **StageDesk Pro ${installedVersion}**. Questa pagina è stata aperta automaticamente per mostrarti cosa è cambiato.

${content.replace(/^# Novità\s*/, '')}`)
}
