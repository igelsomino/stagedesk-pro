import { SCRIPT_ROOT_PATH } from './domain'
import type { DirectorNote, MediaAsset, MediaCue, NoteType, Project } from './domain'

const now = () => new Date().toISOString()

const noteTypes: NoteType[] = [
  { id: 'movement', label: 'Movimento', color: 'green' },
  { id: 'position', label: 'Posizione', color: 'blue' },
  { id: 'characters', label: 'Personaggi in scena', color: 'blue' },
  { id: 'tone', label: 'Tono', color: 'purple' },
  { id: 'light', label: 'Luce', color: 'yellow' },
  { id: 'audio', label: 'Audio', color: 'orange' },
  { id: 'video', label: 'Video', color: 'red' },
  { id: 'image', label: 'Immagine', color: 'gray' },
  { id: 'prop', label: 'Oggetto di scena', color: 'brown' },
  { id: 'general', label: 'Nota generale', color: 'cyan' },
]

const filePath = `${SCRIPT_ROOT_PATH}/la locandiera.md`
const sceneId = 'atto-i-scena-xv'

const demoNoteContent: Record<string, string> = {
  movement: 'Ingresso lento da quinta sinistra. L’attrice attraversa il cono di luce senza fermarsi al centro.',
  position: 'Il protagonista resta vicino al tavolo, di tre quarti verso il pubblico.',
  characters: 'In scena: MIRANDOLINA, CAVALIERE. Il SERVITORE è appena uscito.',
  tone: 'Mirandolina mantiene leggerezza apparente e controllo. Il Cavaliere risponde asciutto, ma inizia a incuriosirsi.',
  light: 'Taglio caldo sulla zona del tavolo. Fondo più freddo per isolare il dialogo.',
  audio: 'Campanello automatico in apertura. Il colpo di pistola resta manuale e disponibile come effetto di prova.',
  video: 'Eventuale proiezione discreta della locanda, senza distogliere l’attenzione dal dialogo.',
  image: 'Immagine di riferimento: trio jazz su fondo nero, utile come materiale visivo di prova.',
  prop: 'Tavola apparecchiata, tovaglia, biancheria di servizio.',
  general: 'Estratto di lavoro da Carlo Goldoni, La locandiera, Atto I, Scena XV.',
}

const demoNotes = (): DirectorNote[] =>
  noteTypes
    .filter((noteType) => noteType.id !== 'characters')
    .map((noteType) => ({
      id: `note-${noteType.id}`,
      type: noteType.id,
      color: noteType.color,
      title: noteType.label,
      content: demoNoteContent[noteType.id],
      filePath,
      anchorId: `note-${noteType.id}`,
      sceneId,
      createdAt: now(),
      updatedAt: now(),
    }))

const demoCues = (): MediaCue[] => [
  {
    id: 'cue-campanello',
    type: 'audio',
    src: '/media/suoni/doorbell-ding-dong.mp3',
    title: 'Campanello',
    description: 'Campanello eseguito automaticamente prima dell’arrivo di Mirandolina.',
    autoplay: true,
    anchorId: 'cue-campanello',
    filePath,
    sceneId,
    options: { volume: 75, fadeIn: 0, fadeOut: 1, loop: false },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'cue-blues',
    type: 'music',
    src: '/media/musiche/blues-jazz.mp3',
    title: 'Blues jazz',
    description: 'Tappeto musicale leggero sotto il primo scambio.',
    autoplay: true,
    anchorId: 'cue-blues',
    filePath,
    sceneId,
    options: { volume: 60, fadeIn: 2, fadeOut: 3, loop: false },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'cue-immagine',
    type: 'image',
    src: '/media/immagini/image.jpg',
    title: 'Trio jazz',
    description: 'Immagine di riferimento per ambiente e atmosfera.',
    autoplay: true,
    anchorId: 'cue-immagine',
    filePath,
    sceneId,
    options: { duration: 8, displayMode: 'overlay' },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'cue-pistola',
    type: 'audio',
    src: '/media/suoni/gunshot.mp3',
    title: 'Colpo di pistola',
    description: 'Effetto secco da lanciare manualmente quando richiesto.',
    autoplay: false,
    anchorId: 'cue-pistola',
    filePath,
    sceneId,
    options: { volume: 75, fadeIn: 0, fadeOut: 0, loop: false },
    createdAt: now(),
    updatedAt: now(),
  },
]

const demoMedia = (): MediaAsset[] => [
  {
    id: crypto.randomUUID(),
    name: 'suoni',
    path: '/media/suoni',
    kind: 'folder',
    children: [
      {
        id: crypto.randomUUID(),
        name: 'doorbell-ding-dong.mp3',
        path: '/media/suoni/doorbell-ding-dong.mp3',
        kind: 'audio',
        sourcePath: '/sample-media/suoni/doorbell-ding-dong.mp3',
      },
      {
        id: crypto.randomUUID(),
        name: 'gunshot.mp3',
        path: '/media/suoni/gunshot.mp3',
        kind: 'audio',
        sourcePath: '/sample-media/suoni/gunshot.mp3',
      },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'musiche',
    path: '/media/musiche',
    kind: 'folder',
    children: [
      {
        id: crypto.randomUUID(),
        name: 'blues-jazz.mp3',
        path: '/media/musiche/blues-jazz.mp3',
        kind: 'music',
        sourcePath: '/sample-media/musiche/blues-jazz.mp3',
      },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'immagini',
    path: '/media/immagini',
    kind: 'folder',
    children: [
      {
        id: crypto.randomUUID(),
        name: 'image.jpg',
        path: '/media/immagini/image.jpg',
        kind: 'image',
        sourcePath: '/sample-media/immagini/image.jpg',
      },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'video',
    path: '/media/video',
    kind: 'folder',
    children: [],
  },
]

const demoScriptContent = () => `> **Sinossi**
>
> "La locandiera" di Carlo Goldoni si svolge a Firenze, nella locanda gestita dall'affascinante e indipendente Mirandolina. Attorno a lei ruotano diversi corteggiatori, tra cui il Marchese di Forlipopoli, un nobile decaduto che le offre una vana protezione, il Conte d'Albafiorita, un ricco mercante che cerca di conquistarla con doni costosi, e Fabrizio, il cameriere sinceramente legato a lei. L'equilibrio della vicenda viene stravolto dall'arrivo del Cavaliere di Ripafratta, un aristocratico superbo e dichiaratamente misogino che tratta la donna con totale disprezzo. Ferita nell'orgoglio, Mirandolina decide di impartirgli una lezione e di farlo innamorare di sé usando unicamente il proprio ingegno. Attraverso finta dedizione, conversazioni stimolanti e un'apparente modestia, riesce a far crollare le difese del Cavaliere, che finisce per invaghirsi perdutamente di lei fino a perdere il controllo. Una volta dimostrato che anche il più fiero dei misogini può essere piegato dall'intelligenza femminile, Mirandolina comprende che la situazione rischia di compromettere la sua reputazione e la gestione degli affari. Decide così di rifiutare tutti i nobili pretendenti e di sposare il fedele Fabrizio, scelta che le garantisce stabilità sociale e la sicurezza necessaria per continuare a guidare la locanda in piena autonomia.

### Personaggi

| Personaggio | Interprete | Presenza | Note |
| --- | --- | --- | --- |
| MIRANDOLINA | D/A | 1-XV | |
| CAVALIERE | D/A | 1-XV | |
| SERVITORE | D/A | 1-XV | |

---

| Personaggio | Descrizione |
| --- | --- |
| MIRANDOLINA | Mirandolina, la protagonista de "La locandiera" di Carlo Goldoni, è un personaggio rivoluzionario e l'incarnazione perfetta dello spirito borghese del Settecento. Indipendente, pragmatica e dotata di una straordinaria intelligenza psicologica, gestisce la sua locanda con spiccato senso degli affari. Non conquista gli uomini con la sola bellezza, ma con l'acutezza dell'ingegno, riuscendo a piegare persino la fiera misoginia del Cavaliere di Ripafratta solo per orgoglio e sfida personale. Senza mai lasciarsi travolgere dalle emozioni, sceglie infine di sposare il cameriere Fabrizio per tutelare la propria reputazione, la stabilità economica e la sua preziosa autonomia. |
| CAVALIERE | Il Cavaliere di Ripafratta rappresenta la nobiltà superba, aristocratica e ostinatamente misogina. Persuaso che le donne siano solo una fonte di inganno e di disturbo per la libertà maschile, ostenta una freddezza incrollabile e un disprezzo aperto verso Mirandolina, ritenendosi del tutto immune al fascino femminile. Questa sua granitica certezza si rivela tuttavia la sua più grande debolezza: proprio la sua arroganza lo spinge a sottovalutare la padrona di casa, cadendo dritto nella trappola della sua raffinata seduzione. In breve tempo, il Cavaliere crolla di fronte alle attenzioni della locandiera, perdendo completamente la testa, la dignità e l'autocontrollo, fino a trasformarsi in un amante geloso e disperato. La sua parabola incarna la satira goldoniana verso un'aristocrazia presuntuosa, destinata a essere smascherata e ridicolizzata dall'intelligenza pratica della borghesia. |
| SERVITORE | Fabrizio, il cameriere della locanda, rappresenta la fedeltà, la classe lavoratrice e il pragmatismo borghese. Sinceramente innamorato di Mirandolina e destinato a lei già dalle ultime volontà del padre di quest'ultima, Fabrizio vive la commedia in un costante stato di gelosia e sofferenza di fronte alle attenzioni dei nobili clienti. Nonostante i dubbi e l'orgoglio ferito, incarna la pazienza e la dedizione assoluta. Alla fine, la sua fedeltà viene premiata: sposando la protagonista, garantisce a Mirandolina la stabilità e la rispettoabilità sociale necessarie, diventando il partner ideale per la gestione della locanda e l'alleato perfetto della sua ritrovata serenità. |

# Atto 1

> **AVVISO IMPORTANTE**: questo è un file di esempio e non viene registrato sul dispositivo. Per lavorare con dati reali crea un nuovo progetto dal pulsante **Nuovo**, oppure importa un copione dallo Store di StageDesk tramite il pulsante **Importa** nella finestra **Apri progetto**.

::regia{id="note-general" type="general" color="cyan" title="Nota generale" sceneId="${sceneId}" anchorId="note-general"}
${demoNoteContent.general}
::

## Scena XV

::regia{id="note-position" type="position" color="blue" title="Posizione" sceneId="${sceneId}" anchorId="note-position"}
${demoNoteContent.position}
::

::regia{id="note-tone" type="tone" color="purple" title="Tono" sceneId="${sceneId}" anchorId="note-tone"}
${demoNoteContent.tone}
::

::regia{id="note-movement" type="movement" color="green" title="Movimento" sceneId="${sceneId}" anchorId="note-movement"}
${demoNoteContent.movement}
::

::regia{id="note-position" type="position" color="blue" title="Posizione" sceneId="${sceneId}" anchorId="note-position"}
${demoNoteContent.position}
::

::media{id="cue-campanello" type="audio" src="/media/suoni/doorbell-ding-dong.mp3" title="Campanello" autoplay="true" volume="75" fadeIn="0" fadeOut="1" loop="false" sceneId="${sceneId}" anchorId="cue-campanello"}
Campanello eseguito automaticamente prima dell’arrivo di Mirandolina.
::

::battuta{id="battuta-mirandolina-1" characterId="mirandolina" character="MIRANDOLINA" sceneId="${sceneId}"}
A pranzo, che cosa comanda?
::

::regia{id="note-tone" type="tone" color="purple" title="Tono" sceneId="${sceneId}" anchorId="note-tone"}
${demoNoteContent.tone}
::

::battuta{id="battuta-cavaliere-1" characterId="cavaliere" character="CAVALIERE" sceneId="${sceneId}"}
Mangerò quello che vi sarà.
::

::regia{id="note-light" type="light" color="yellow" title="Luce" sceneId="${sceneId}" anchorId="note-light"}
${demoNoteContent.light}
::

::media{id="cue-blues" type="music" src="/media/musiche/blues-jazz.mp3" title="Blues jazz" autoplay="true" volume="60" fadeIn="2" fadeOut="3" loop="false" sceneId="${sceneId}" anchorId="cue-blues"}
Tappeto musicale leggero sotto il primo scambio.
::

::battuta{id="battuta-mirandolina-2" characterId="mirandolina" character="MIRANDOLINA" sceneId="${sceneId}"}
Vorrei pur sapere il suo genio. Se le piace una cosa più dell’altra, lo dica con libertà.
::

::regia{id="note-audio" type="audio" color="orange" title="Audio" sceneId="${sceneId}" anchorId="note-audio"}
${demoNoteContent.audio}
::

::battuta{id="battuta-cavaliere-2" characterId="cavaliere" character="CAVALIERE" sceneId="${sceneId}"}
Se vorrò qualche cosa, lo dirò al cameriere.
::

::battuta{id="battuta-mirandolina-3" characterId="mirandolina" character="MIRANDOLINA" sceneId="${sceneId}"}
Ma in queste cose gli uomini non hanno l’attenzione e la pazienza che abbiamo noi altre donne.
::

::regia{id="note-video" type="video" color="red" title="Video" sceneId="${sceneId}" anchorId="note-video"}
${demoNoteContent.video}
::

::media{id="cue-immagine" type="image" src="/media/immagini/image.jpg" title="Trio jazz" autoplay="true" duration="8" sceneId="${sceneId}" anchorId="cue-immagine"}
Immagine di riferimento per ambiente e atmosfera.
::

::regia{id="note-image" type="image" color="gray" title="Immagine" sceneId="${sceneId}" anchorId="note-image"}
Immagine di riferimento: trio jazz su fondo nero, utile come materiale visivo di prova.
::

::battuta{id="battuta-cavaliere-3" characterId="cavaliere" character="CAVALIERE" sceneId="${sceneId}"}
Vi ringrazio; ma ne anche per questo verso vi riuscirà di far con me quello che avete fatto col Conte e col Marchese.
::

::battuta{id="battuta-mirandolina-4" characterId="mirandolina" character="MIRANDOLINA" sceneId="${sceneId}"}
Che dice della debolezza di quei due cavalieri? Vengono alla locanda per alloggiare, e pretendono poi di voler far all’amore colla locandiera.
::

::regia{id="note-prop" type="prop" color="brown" title="Oggetto di scena" sceneId="${sceneId}" anchorId="note-prop"}
Tavola apparecchiata, tovaglia, biancheria di servizio.
::

::battuta{id="battuta-mirandolina-5" characterId="mirandolina" character="MIRANDOLINA" sceneId="${sceneId}"}
Abbiamo altro in testa noi, che dar retta alle loro ciarle. Cerchiamo di fare il nostro interesse; se diamo loro delle buone parole, lo facciamo per tenerli a bottega.
::

::media{id="cue-pistola" type="audio" src="/media/suoni/gunshot.mp3" title="Colpo di pistola" autoplay="false" volume="75" fadeIn="0" fadeOut="0" loop="false" sceneId="${sceneId}" anchorId="cue-pistola"}
Effetto secco da lanciare manualmente quando richiesto.
::
`

const blankScriptContent = (projectName: string) => `| Personaggio | Interprete | Presenza | Note |
| --- | --- | --- | --- |
| PERSONAGGIO 1 | Da assegnare | Atto 1, Scena 1 | Primo personaggio della scena. |

# ${projectName}

## Scena 1

::regia{id="note-characters" type="characters" color="blue" title="Personaggi in scena" sceneId="scena-1" anchorId="note-characters"}
In scena: PERSONAGGIO 1.
::

### Sinossi

::battuta{id="battuta-1" characterId="personaggio-1" character="PERSONAGGIO 1" sceneId="scena-1"}
Battuta 1
::
`

const emptyMedia = (): MediaAsset[] => [
  {
    id: crypto.randomUUID(),
    name: 'suoni',
    path: '/media/suoni',
    kind: 'folder',
    children: [],
  },
  {
    id: crypto.randomUUID(),
    name: 'musiche',
    path: '/media/musiche',
    kind: 'folder',
    children: [],
  },
  {
    id: crypto.randomUUID(),
    name: 'immagini',
    path: '/media/immagini',
    kind: 'folder',
    children: [],
  },
  {
    id: crypto.randomUUID(),
    name: 'video',
    path: '/media/video',
    kind: 'folder',
    children: [],
  },
]

const baseSettings = {
  theme: 'dark' as const,
  autosave: true,
  fullscreenCueReplayPolicy: 'forward-only' as const,
}

export const defaultProject = (name = 'Goldoni'): Project => ({
  id: crypto.randomUUID(),
  name,
  rootPath: '/progetto',
  author: '',
  language: 'it',
  actorsCount: 0,
  estimatedDuration: '',
  characters: [
    { id: 'mirandolina', name: 'MIRANDOLINA' },
    { id: 'cavaliere', name: 'CAVALIERE' },
    { id: 'servitore', name: 'SERVITORE' },
  ],
  noteTypes,
  settings: baseSettings,
  scripts: [
    {
      id: crypto.randomUUID(),
      name: 'copioni',
      path: SCRIPT_ROOT_PATH,
      kind: 'folder',
      children: [
        {
          id: crypto.randomUUID(),
          name: 'la locandiera.md',
          path: filePath,
          kind: 'markdown',
          content: demoScriptContent(),
        },
      ],
    },
  ],
  media: demoMedia(),
  notes: demoNotes(),
  cues: demoCues(),
})

export const blankProject = (name = 'Nuovo progetto'): Project => ({
  id: crypto.randomUUID(),
  name,
  rootPath: '/progetto',
  author: '',
  language: 'it',
  actorsCount: 0,
  estimatedDuration: '',
  characters: [
    { id: 'personaggio-1', name: 'PERSONAGGIO 1' },
  ],
  noteTypes,
  settings: baseSettings,
  scripts: [
    {
      id: crypto.randomUUID(),
      name: 'copioni',
      path: SCRIPT_ROOT_PATH,
      kind: 'folder',
      children: [
        {
          id: crypto.randomUUID(),
          name: 'la locandiera.md',
          path: filePath,
          kind: 'markdown',
          content: blankScriptContent(name),
        },
      ],
    },
  ],
  media: emptyMedia(),
  notes: [],
  cues: [],
})
