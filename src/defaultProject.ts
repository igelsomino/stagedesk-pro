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

const filePath = '/copione/atto-1.md'
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
  noteTypes.map((noteType) => ({
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

const demoScriptContent = (projectName: string) => `# ${projectName}

> **AVVISO IMPORTANTE**: questo è un file di esempio e non è registrato sul dispositivo. Per lavorare con dati reali crea un nuovo progetto dall'apposito pulsante.

## ATTO I - SCENA XV

::regia{id="note-characters" type="characters" color="blue" title="Personaggi in scena" sceneId="${sceneId}" anchorId="note-characters"}
${demoNoteContent.characters}
::

### Sinossi

Mirandolina conversa con il Cavaliere e usa cortesia, ironia e apparente sincerità per incrinare la sua diffidenza verso le donne.

::regia{id="note-general" type="general" color="cyan" title="Nota generale" sceneId="${sceneId}" anchorId="note-general"}
${demoNoteContent.general}
::

| Personaggio | Interprete | Presenza | Note |
| --- | --- | --- | --- |
| MIRANDOLINA | Da assegnare | In scena | Guida il ritmo della scena. |
| CAVALIERE | Da assegnare | In scena | Resiste, poi si lascia incuriosire. |
| SERVITORE | Da assegnare | Fuori scena | Ha appena lasciato la camera. |

::regia{id="note-movement" type="movement" color="green" title="Movimento" sceneId="${sceneId}" anchorId="note-movement"}
${demoNoteContent.movement}
::

::regia{id="note-position" type="position" color="blue" title="Posizione" sceneId="${sceneId}" anchorId="note-position"}
${demoNoteContent.position}
::

::media{id="cue-campanello" type="audio" src="/media/suoni/doorbell-ding-dong.mp3" title="Campanello" autoplay="true" volume="75" fadeOut="1" sceneId="${sceneId}" anchorId="cue-campanello"}
Campanello in apertura, eseguito automaticamente prima dell’ingresso di Mirandolina.
::

**MIRANDOLINA**: A pranzo, che cosa comanda?

::regia{id="note-tone" type="tone" color="purple" title="Tono" sceneId="${sceneId}" anchorId="note-tone"}
${demoNoteContent.tone}
::

**CAVALIERE**: Mangerò quello che vi sarà.

::regia{id="note-light" type="light" color="yellow" title="Luce" sceneId="${sceneId}" anchorId="note-light"}
${demoNoteContent.light}
::

::media{id="cue-blues" type="music" src="/media/musiche/blues-jazz.mp3" title="Blues jazz" autoplay="true" volume="60" fadeIn="2" fadeOut="3" sceneId="${sceneId}" anchorId="cue-blues"}
Tappeto musicale leggero con fade in morbido.
::

**MIRANDOLINA**: Vorrei pur sapere il suo genio. Se le piace una cosa più dell’altra, lo dica con libertà.

::regia{id="note-audio" type="audio" color="orange" title="Audio" sceneId="${sceneId}" anchorId="note-audio"}
${demoNoteContent.audio}
::

**CAVALIERE**: Se vorrò qualche cosa, lo dirò al cameriere.

**MIRANDOLINA**: Ma in queste cose gli uomini non hanno l’attenzione e la pazienza che abbiamo noi altre donne.

::regia{id="note-video" type="video" color="red" title="Video" sceneId="${sceneId}" anchorId="note-video"}
${demoNoteContent.video}
::

::media{id="cue-immagine" type="image" src="/media/immagini/image.jpg" title="Trio jazz" autoplay="true" duration="8" sceneId="${sceneId}" anchorId="cue-immagine"}
Immagine di riferimento caricata nel progetto iniziale.
::

::regia{id="note-image" type="image" color="gray" title="Immagine" sceneId="${sceneId}" anchorId="note-image"}
${demoNoteContent.image}
::

**CAVALIERE**: Vi ringrazio; ma ne anche per questo verso vi riuscirà di far con me quello che avete fatto col Conte e col Marchese.

**MIRANDOLINA**: Che dice della debolezza di quei due cavalieri? Vengono alla locanda per alloggiare, e pretendono poi di voler far all’amore colla locandiera.

::regia{id="note-prop" type="prop" color="brown" title="Oggetto di scena" sceneId="${sceneId}" anchorId="note-prop"}
${demoNoteContent.prop}
::

**MIRANDOLINA**: Abbiamo altro in testa noi, che dar retta alle loro ciarle. Cerchiamo di fare il nostro interesse; se diamo loro delle buone parole, lo facciamo per tenerli a bottega.

::media{id="cue-pistola" type="audio" src="/media/suoni/gunshot.mp3" title="Colpo di pistola" autoplay="false" volume="75" sceneId="${sceneId}" anchorId="cue-pistola"}
Colpo secco da usare come effetto sonoro manuale.
::
`

const blankScriptContent = (projectName: string) => `# ${projectName}

## Atto 1

### Scena 1

**PERSONAGGIO 1**: Battuta 1
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

export const defaultProject = (name = 'La locandiera'): Project => ({
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
      name: 'copione',
      path: '/copione',
      kind: 'folder',
      children: [
        {
          id: crypto.randomUUID(),
          name: 'atto-1.md',
          path: filePath,
          kind: 'markdown',
          content: demoScriptContent(name),
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
      name: 'copione',
      path: '/copione',
      kind: 'folder',
      children: [
        {
          id: crypto.randomUUID(),
          name: 'atto-1.md',
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
