# Release e aggiornamenti automatici

## Repository

Repository previsto:

```text
igelsomino/stagedesk-pro
```

Endpoint updater configurato nell'app:

```text
https://github.com/igelsomino/stagedesk-pro/releases/latest/download/latest.json
```

## Primo setup GitHub

Autenticare GitHub CLI:

```bash
gh auth login
```

Creare il repository e pubblicare i sorgenti:

```bash
gh repo create igelsomino/stagedesk-pro --private --source=. --remote=origin --push
```

Se il repository viene creato manualmente da browser:

```bash
git remote add origin git@github.com:igelsomino/stagedesk-pro.git
git push -u origin main
```

## Secret richiesti

La chiave privata dell'updater è locale e ignorata da Git:

```text
.tauri/updater.key
```

Caricarla nei secret GitHub:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < .tauri/updater.key
```

La chiave generata per questo progetto non ha password. La workflow imposta comunque `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; se in futuro viene rigenerata una chiave protetta, impostare anche:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

## Firma installer macOS e Windows

Stato al 2026-07-08: la pubblicazione delle versioni procede con la firma degli artefatti updater Tauri, ma senza firma sistema operativo degli installer macOS e Windows. La firma OS verrà configurata in una release successiva dopo il completamento degli adempimenti necessari.

### macOS

Per distribuire senza avvisi Gatekeeper sono richiesti:

1. account Apple Developer a pagamento;
2. certificato `Developer ID Application`;
3. notarizzazione Apple;
4. secret GitHub per certificato e notarizzazione, ad esempio `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_ISSUER`, `APPLE_API_KEY` e chiave privata App Store Connect.

La configurazione attuale usa firma ad-hoc (`bundle.macOS.signingIdentity = "-"`), quindi non sostituisce Developer ID e notarizzazione.

### Windows

Per evitare l'avviso di file non firmato sono richiesti:

1. Azure Artifact Signing, consigliato per distribuzione fuori Microsoft Store, oppure un certificato Code Signing OV/EV emesso da CA;
2. configurazione di `bundle.windows.signCommand` oppure `certificateThumbprint`, `digestAlgorithm` e `timestampUrl`;
3. secret GitHub dedicati al provider scelto.

Nota operativa: anche con firma valida, Microsoft SmartScreen può continuare a mostrare avvisi finché il publisher o il file non maturano reputazione sufficiente.

## Pubblicare una nuova versione

Aggiornare la versione in modo sincronizzato:

```bash
npm run version:sync -- --set=1.0.19
```

Commit e tag:

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: release v1.0.19"
git tag v1.0.19
git push origin main --tags
```

La workflow `Release` compila macOS, Windows e Linux, firma gli artefatti updater e pubblica la GitHub Release con `latest.json`.

## Verifica locale firma updater

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat .tauri/updater.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npm run tauri:build
```

Artefatti attesi su macOS:

```text
src-tauri/target/release/bundle/macos/StageDesk Pro.app.tar.gz
src-tauri/target/release/bundle/macos/StageDesk Pro.app.tar.gz.sig
```
