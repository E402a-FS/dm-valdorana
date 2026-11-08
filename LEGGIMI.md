# DM Valdorana — applicazione desktop (.exe)

Simulatore della postazione del Dirigente Movimento in versione Windows, con installer, icona nel menu Start
e aggiornamenti automatici.

## Cosa fa in più rispetto alla web app
- Ogni pannello sganciato (⧉) è una **finestra di Windows**: posizione, dimensione e monitor vengono ricordati,
  e all'avvio i pannelli si riaprono **dove li avevi lasciati**.
- La simulazione **non rallenta** se la finestra principale è in secondo piano o ridotta a icona.
- I turni si salvano su file in **Documenti\DM Valdorana**:
  - *Salva* → `turno-AAAA-MM-GG-hh-mm-ss.json`
  - salvataggi automatici ogni minuto in `automatici\` (vengono conservati gli ultimi 20)
  - *Carica* / *Esporta* aprono le normali finestre di Windows
  - all'avvio viene proposto di riprendere il turno più recente
- Menu: cartella dei salvataggi, schermo intero, zoom, ripristino disposizione finestre, controllo aggiornamenti.

## Struttura
```
app/index.html          il simulatore (stesso file della web app)
main.js                 finestre, salvataggi, aggiornamenti
preload.js              ponte sicuro pagina ↔ sistema
package.json            versione e configurazione dell'installer
build/icon.png|ico      icona
.github/workflows/      compilazione automatica su GitHub
```

---

## 1. Primo installer — senza installare nulla (consigliato)
1. Crea su github.com un repository **pubblico** chiamato `dm-valdorana`.
2. In `package.json` sostituisci `TUO-UTENTE-GITHUB` con il tuo nome utente GitHub.
3. Carica **tutto** il contenuto di questa cartella nel repository (Add file → Upload files), compresa la cartella
   `.github` (se l'interfaccia web non la mostra, attiva la visualizzazione dei file nascosti o usa GitHub Desktop).
4. Scheda **Actions** → *Build DM Valdorana* → **Run workflow**.
5. Dopo circa 5 minuti, nell'esecuzione completata, scarica **DM-Valdorana-installer** (zip con `DM-Valdorana-Setup-1.0.0.exe`).

## 1-bis. In alternativa, sul tuo PC
Serve **Node.js** (versione LTS da nodejs.org). Poi, nella cartella del progetto:
```
npm install
npm start        ← prova l'app senza installarla
npm run dist     ← crea l'installer in dist\DM-Valdorana-Setup-1.0.0.exe
```

Al primo avvio Windows può mostrare "PC protetto da Windows / editore sconosciuto", perché l'installer non è firmato:
*Ulteriori informazioni → Esegui comunque*. Succede solo con installer non firmati (un certificato di firma è a pagamento).

---

## 2. Aggiornamenti — come pubblicare una nuova versione
1. Sostituisci `app/index.html` con la nuova versione del simulatore.
2. In `package.json` aumenta `"version"` (es. `1.0.0` → `1.1.0`).
3. Carica i due file modificati nel repository (Add file → Upload files → Commit).
4. **Releases → Draft a new release → Choose a tag** → scrivi `v1.1.0` → *Create new tag* → titolo a piacere → **Publish release**.
   GitHub Actions compila l'installer e lo allega alla Release insieme a `latest.yml` (circa 5 minuti, scheda *Actions*).
5. Sui PC dove l'app è installata: all'avvio successivo l'aggiornamento viene **scaricato in automatico** e l'app
   propone *Riavvia e aggiorna* (il turno in corso viene salvato prima). Si può anche forzare da **? → Controlla aggiornamenti**.

I salvataggi e la disposizione delle finestre **non vengono toccati** dagli aggiornamenti.

Nota: il numero di versione in `package.json` e il tag della Release (`v` + versione) devono coincidere,
e il repository deve essere pubblico perché gli aggiornamenti automatici lo possano leggere.
