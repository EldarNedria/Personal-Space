# Personal Space - Personal Dashboard & Portfolio

Personal Space è una web application ibrida sviluppata in Python (Flask) e JavaScript vanilla che funge sia da portfolio pubblico, sia da dashboard privata modulare. Integra nativamente la gestione di task personali, appuntamenti, feed RSS, playlist musicali e include un mini-CMS interno per la pubblicazione di articoli sul blog.

***Link al deploy del progetto*** : https://personal-space-hfnp.onrender.com/

## Documentazione

* **[report.md](report.md)** — report lavoro, difficoltà, lezioni aprese
* **[README.md](README.md)** — guida completa progetto, architettura, installazione e deploy

## Documentazione

* **Documento_dei_requisiti.md** — analisi completa: requisiti, schema ER, diagramma delle classi, casi d'uso
* **report.md** — report dettagliato del lavoro svolto, difficoltà e lezioni aprese
* **assets/** — sorgenti PlantUML e immagini dei diagrammi

## Funzionalità
*   **Portfolio e Blog:** Pagine statiche pubbliche per la presentazione dei progetti e degli articoli creati dal CMS. Include un form di contatto che invia payload JSON a un bot Telegram sfruttando le API ufficiali.
*   **Dashboard Modulare:** Area riservata a layout flessibile. Il sistema permette di abilitare o nascondere i widget di interesse, salvando lo stato delle preferenze sul database SQLite in background.
*   **Integrazione Google Tasks e Calendar:** Sincronizzazione CRUD in tempo reale con gli account Google tramite autenticazione Service Account (OAuth2 Server-to-Server).
*   **News RSS Aggregator:** Parsing XML lato server di molteplici feed esterni (NASA, Bloomberg) tramite `xml.etree.ElementTree` per bypassare le policy CORS dei browser ed esporre un JSON pulito al frontend.
*   **YouTube Music API:** Interfaccia per estrapolare e riprodurre le playlist musicali private dell'utente tramite la libreria `ytmusicapi`, sfruttando l'autenticazione via intestazioni HTTP emulate (`browser.json`).
*   **CMS Interno:** Pannello di amministrazione backend protetto da autenticazione per la stesura, formattazione e gestione dello stato (Bozza/Pubblicato) degli articoli visibili sul portfolio pubblico.

## Stack tecnico

| Layer | Tecnologia |
| :--- | :--- |
| **Backend** | Python 3.x, Flask |
| **Database** | SQLite (Layout & CMS) + JSON locale (Dati Cache) |
| **Frontend** | HTML5, CSS3 (Vanilla + Variabili), JavaScript ES6+ |
| **Real-time / UI** | Fetch API (AJAX) |
| **API Esterne** | Google Cloud (Tasks/Calendar), YouTube Music API, Telegram Bot API |
| **Deploy** | Render.com (PaaS), Gunicorn (WSGI Server) |

## Architettura

```text
Personal Space/
├── app.py                # Entry point: inizializza Flask e l'app factory
├── render.yaml           # Infrastruttura as Code per il deploy automatico su Render
├── config/
│   └── config.yaml       # Configurazione generale dinamica (Feed RSS, Link Rapidi)
├── secrets/              # File sensibili e credenziali API (esclusi da git)
│   ├── browser.json      # Token di accesso OAuth emulato per YouTube Music
│   ├── credentials.json  # Service Account Google per Calendar e Tasks
│   └── headers_raw.txt   # Intestazioni HTTP grezze per generare browser.json
├── scripts/              # Script di utilità
│   ├── generate_hash.py  # Genera salt e hash bcrypt sicuri per la password
│   ├── setup_yt.py       # Configura l'autenticazione a YouTube Music
│   └── test_yt.py        # Testa la connessione a YT Music
├── routes/               # Blueprints: separazione logica del dominio
│   ├── auth.py           # Gestione login, checkpw bcrypt e distruzione sessioni
│   ├── cms.py            # Logica CRUD e query SQLite per il blog
│   ├── dashboard.py      # Endpoint API JSON usati per l'aggiornamento asincrono dei widget
│   ├── music.py          # Wrapper per le chiamate esterne verso YouTube Music API
│   └── portfolio.py      # Rendering dei template pubblici e invio POST Telegram
├── static/               # Assets frontend: CSS (Vanilla) e JavaScript (DOM Manipulation)
├── templates/            # Template Engine (Jinja2)
└── data/                 # Directory per il database locale `database.db` (non tracciata su git)
```

### Approfondimento Tecnico (Backend & API)

Per garantire manutenibilità e sicurezza, il codice backend Python implementa pattern architetturali avanzati e tecniche di integrazione specifiche:

1.  **Application Factory & Blueprints:** 
    L'applicazione non viene istanziata globalmente, ma tramite il design pattern *Application Factory* (funzione `create_app()` in `app.py`). Questo garantisce un perfetto isolamento del contesto e agevola la configurazione dinamica. Le rotte sono suddivise per dominio logico (`auth.py`, `dashboard.py`, `portfolio.py`, ecc.) sfruttando i **Flask Blueprints**, in modo che ciascun modulo si occupi di una singola responsabilità (Separation of Concerns).

2.  **Sicurezza e Autenticazione Custom:**
    Il sistema non memorizza password in testo in chiaro. Lo script `scripts/generate_hash.py` impiega l'algoritmo crittografico `bcrypt` per aggiungere un *salt* casuale alla password e calcolarne l'hash. Durante la fase di accesso, l'hash memorizzato in modo sicuro (`ADMIN_PASSWORD_HASH`) viene validato usando `bcrypt.checkpw()`. L'accesso alle rotte private è protetto da un decoratore personalizzato `@login_required` che verifica la presenza di uno specifico flag all'interno della sessione utente di Flask (che è a sua volta protetta da manomissioni lato client tramite firma crittografica generata usando `SECRET_KEY`).

3.  **Integrazione OAuth2 Server-to-Server (Google API):**
    Le chiamate verso Google Tasks e Google Calendar avvengono interamente backend-side. Anziché richiedere l'interazione umana tramite popup di consenso (OAuth2 Flow standard), il backend usa le librerie `google-auth` e `google-api-python-client` per leggere un **Service Account** (`secrets/credentials.json`). Questo permette alla libreria di firmare dei token JWT e dialogare con le API di Google in maniera invisibile e privilegiata.

4.  **Bypass CORS e Proxy RSS (XML Parsing):**
    I moderni Web Browser bloccano le richieste JavaScript verso domini esterni privi di precise intestazioni CORS (Cross-Origin Resource Sharing). Per implementare i feed, Personal Space utilizza un pattern *Proxy*: 
    * Il frontend richiede asincronamente `/api/rss/nasa`.
    * Il backend Flask effettua una connessione `HTTP GET` al feed originario.
    * Tramite la libreria `xml.etree.ElementTree`, la complessa struttura ad albero XML viene decodificata e convertita.
    * Viene costruito e rispedito al frontend un payload JSON pulito e pronto all'uso, bypassando integralmente qualsiasi restrizione del browser.

5.  **Gestione del Database (Context Locals):**
    Il modulo `database.py` non mantiene una connessione aperta perennemente. Utilizza invece l'oggetto locale di contesto di Flask (`g._database`) per aprire la connessione SQLite all'inizio della richiesta e chiuderla garantitamente alla fine (`app.teardown_appcontext`). Questo approccio evita i colli di bottiglia o l'errore "database is locked" nei deploy asincroni serviti tramite l'application server WSGI `gunicorn`.

### Scelte Progettuali e Giustificazioni (Design Decisions)

*   **Perché Flask (Python) invece di Node.js/PHP?**
    La natura del progetto, fortemente incentrata sull'aggregazione di API esterne complesse (Google Tasks/Calendar, YouTube Music, XML Parsing), ha reso Python la scelta più logica grazie al suo immenso ecosistema di librerie ufficiali e stabili. Flask è stato preferito a framework più pesanti (come Django) perché la dashboard richiedeva un'architettura a microservizi flessibile, senza l'overhead di un ORM monolitico preconfigurato.
*   **Architettura Single-User senza Tabella 'Utenti':**
    Non essendo un servizio SaaS pubblico ma una dashboard *personale*, si è deciso deliberatamente di omettere la tabella `USERS` nel database. L'hash della password dell'amministratore risiede nelle variabili d'ambiente. Questa scelta azzera il rischio di *SQL Injection* in fase di login e semplifica drasticamente il layer di persistenza.
*   **Perché SQLite + Storage JSON locale?**
    In un contesto Single-User, deployare e mantenere un DBMS relazionale completo (come PostgreSQL o MySQL) avrebbe introdotto costi e complessità ingiustificati. SQLite gestisce perfettamente i dati strutturati (come gli articoli del CMS), mentre lo storage locale JSON funge da rapida cache o da "ponte" prima che i dati vengano sincronizzati definitivamente con le API (es. Google Tasks).
*   **Perché CSS/JS Vanilla invece di React/Tailwind?**
    L'obiettivo didattico primario del progetto era dimostrare una solida padronanza delle tecnologie web fondamentali (manipolazione del DOM, Fetch API asincrone, CSS Grid e Flexbox, variabili CSS). L'impiego di framework pesanti avrebbe astratto questi concetti, riducendo l'efficacia formativa del progetto.
*   **Rimozione di Gridstack.js (Adattamento in corso d'opera):**
    In fase di progettazione, era previsto l'utilizzo di `gridstack.js` per un'interazione Drag & Drop avanzata. Durante lo sviluppo, tuttavia, l'aggiornamento asincrono dei widget (che modificavano il proprio DOM interno per mostrare nuove notizie o task) causava pesanti conflitti di rendering e calcolo delle altezze con la libreria. Si è optato per la **stabilità**: Gridstack è stato rimosso in favore di un layout flessibile che permette l'abilitazione/disabilitazione dei widget, accettando il compromesso visivo di eventuali gap tra le card per garantire l'affidabilità tecnica.

## Installazione locale

1. Clona il repository
```bash
git clone https://github.com/TuoUtente/Antigravity.git
cd Antigravity
```

2. Crea e attiva l'ambiente virtuale
```bash
python -m venv .venv

# Su Windows (PowerShell/CMD):
.venv\Scripts\activate
# Su Linux/Mac:
source .venv/bin/activate
```

3. Installa le dipendenze
```bash
pip install -r requirements.txt
```

4. Configura le variabili d'ambiente
```bash
# Copia il file template
cp .env.example .env

# Genera una password sicura avviando lo script apposito:
python scripts/generate_hash.py
# Copia l'output generato (inizia con $2b$...) e incollalo nel file .env alla voce ADMIN_PASSWORD_HASH
```

5. Avvio del server di sviluppo
```bash
# Il database SQLite e le tabelle vengono inizializzate automaticamente al primo avvio
flask run
```

## Configurazione API

Essendo un aggregatore di servizi esterni, Personal Space necessita di alcune credenziali:
*   **Telegram Bot (Contact Form):** Configurare le chiavi `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` all'interno del file `.env`.
*   **Google Calendar & Tasks:** È necessario creare un progetto su Google Cloud Console, generare le credenziali di tipo **Service Account**, abilitare le rispettive API ed esportare la chiave in un file rinominato `credentials.json` e posizionato nella cartella `secrets/`.
*   **YouTube Music:** Copiare le richieste HTTP headers ("Accept", "Cookie", ecc.) dalla console Sviluppatori del browser e incollarle nel file `secrets/headers_raw.txt`. Eseguire lo script `python scripts/setup_yt.py` per generare l'effettivo token di accesso su `secrets/browser.json`.

*(La cartella `secrets/` è automaticamente esclusa tramite `.gitignore` per motivi di sicurezza).*

## Deploy

Il progetto è predisposto per essere distribuito in produzione in modo rapido e sicuro. Di seguito sono riportate le istruzioni dettagliate per il deploy sulla piattaforma **Render.com** (utilizzando la configurazione Infrastructure-as-Code fornita) e le indicazioni per una configurazione VPS/IaaS alternativa.

### 1. Deploy su Render.com (Consigliato)

Render.com consente di effettuare il deploy automatico collegando direttamente il proprio repository GitHub. Il file [render.yaml](file:///c:/Users/PCX/.antigravity-ide/Personal-Space/render.yaml) definisce l'infrastruttura necessaria.

#### Persistenza dei Dati (Persistent Disk)
SQLite e l'applicazione utilizzano la directory `data/` (dove risiede `database.db`) per memorizzare gli articoli del blog e le preferenze dei widget. Poiché le istanze di Render hanno un file system effimero (i dati vengono persi a ogni riavvio o nuovo deploy), il file `render.yaml` configura automaticamente un **Persistent Disk**:
* **Nome del Volume:** `database-disk`
* **Punto di Mount:** `/opt/render/project/src/data` (mappato direttamente alla cartella `data/` del progetto)
* **Dimensione:** 1 GB (più che sufficiente per le esigenze personali dell'applicazione)

*Nota: Al primo avvio, l'applicazione rileverà l'assenza del database nella cartella del volume e lo inizializzerà automaticamente creando le tabelle e inserendo i widget di default.*

#### Variabili d'Ambiente da Configurare
Durante la creazione del servizio su Render (o nella scheda **Environment** del servizio web creato), è necessario impostare le seguenti variabili d'ambiente:

| Variabile | Descrizione | Valore Consigliato |
| :--- | :--- | :--- |
| `FLASK_ENV` | Ambiente di esecuzione di Flask. | `production` (impostato automaticamente dal blueprint) |
| `SECRET_KEY` | Chiave crittografica per firmare i cookie di sessione. | Una stringa alfanumerica casuale e complessa (auto-generata da Render o inserita manualmente) |
| `ADMIN_PASSWORD_HASH` | Hash Bcrypt della password dell'amministratore. | Generato localmente eseguendo lo script `python scripts/generate_hash.py` |
| `TELEGRAM_BOT_TOKEN` | Token del bot Telegram per il form dei contatti. | *(Opzionale)* Ottenuto da [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Il tuo ID utente o canale Telegram. | *(Opzionale)* Il tuo ID numerico per ricevere i messaggi |

#### Caricamento delle Credenziali API (Secret Files)
I file di autenticazione per le API esterne (`credentials.json` per Google e `browser.json` per YouTube Music) non devono essere tracciati su Git. Su Render, puoi caricarli in modo sicuro tramite la funzionalità **Secret Files**:
1. Apri la dashboard del tuo servizio su Render e vai alla scheda **Environment**.
2. Scorri fino alla sezione **Secret Files**.
3. Clicca su **Add Secret File** e aggiungi i seguenti file:
   * **Nome file:** `credentials.json` -> Incolla il contenuto del file di credenziali del Service Account Google.
   * **Nome file:** `browser.json` -> Incolla il contenuto del file generato per YouTube Music.
4. Render monterà questi file direttamente nella directory radice dell'applicazione `/opt/render/project/src/`. Il backend di *Personal Space* rileva automaticamente questi file sia nella cartella `secrets/` (ambiente locale) sia nella cartella radice (ambiente di produzione Render).

#### Istruzioni Passo-Passo per il Deploy
1. Esegui il fork o il push del repository su un tuo account GitHub privato (consigliato per non esporre configurazioni personali).
2. Accedi alla dashboard di [Render.com](https://render.com) e clicca su **New > Blueprint**.
3. Collega il tuo repository GitHub.
4. Render leggerà il file `render.yaml` e mostrerà la schermata di configurazione iniziale chiedendo di inserire i valori per le variabili d'ambiente contrassegnate con `sync: false` (`ADMIN_PASSWORD_HASH`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
5. Clicca su **Apply** per avviare il build e il deploy.
6. Una volta completato il deploy, configura i **Secret Files** come descritto nella sezione precedente e riavvia il servizio per caricare le nuove configurazioni.

---

### 2. Deploy Alternativo: VPS o Server Privato (IaaS)

Se preferisci ospitare l'applicazione su un server Linux dedicato (es. Ubuntu Server su AWS, DigitalOcean, Hetzner o Oracle Cloud Free Tier):

#### Requisiti di Sistema
* Python 3.8+ con modulo `venv`
* Un web server con funzione di Reverse Proxy (es. Nginx)
* Un gestore di processi (es. `systemd`)
* Certificato SSL (es. Let's Encrypt tramite Certbot)

#### Configurazione Passo-Passo
1. **Clonazione e Setup dell'Ambiente:**
   ```bash
   git clone https://github.com/TuoUtente/Personal-Space.git /var/www/personal-space
   cd /var/www/personal-space
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **File di Configurazione e Segreti:**
   * Crea il file `.env` basandoti su `.env.example` e inserisci le chiavi corrette.
   * Crea la cartella `secrets/` e inserisci all'interno i file `credentials.json` e `browser.json`.

3. **Configurazione del Servizio Systemd:**
   Crea il file `/etc/systemd/system/personal-space.service`:
   ```ini
   [Unit]
   Description=Gunicorn instance to serve Personal Space Dashboard
   After=network.target

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/personal-space
   Environment="PATH=/var/www/personal-space/.venv/bin"
   ExecStart=/var/www/personal-space/.venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 app:app

   [Install]
   WantedBy=multi-user.target
   ```
   Abilita e avvia il servizio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start personal-space
   sudo systemctl enable personal-space
   ```

4. **Configurazione Reverse Proxy (Nginx):**
   Crea una configurazione per il sito in `/etc/nginx/sites-available/personal-space`:
   ```nginx
   server {
       listen 80;
       server_name la_tua_dashboard.com;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Abilita il sito e riavvia Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/personal-space /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Installazione Certificato SSL:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d la_tua_dashboard.com
   ```


## Test

È stato implementato uno script di test per verificare autonomamente l'avvenuta associazione dell'account YouTube Music prima dell'avvio completo dell'applicazione server. Eseguire:
```bash
python scripts/test_yt.py
```
*Le altre route API sono state verificate manualmente tramite le DevTools Network del browser e chiamate cURL.*

## Credenziali di default

Essendo un'applicazione pensata ad uso strettamente personale (Single-User), l'architettura **non prevede la generazione di account nel database** né l'esistenza di ruoli.

| Utente | Ruolo | Password | Note |
| :--- | :--- | :--- | :--- |
| **Nessuno** | Amministratore Unico | *Definita dall'utente* | L'accesso avviene confrontando input utente con l'hash `bcrypt` generato dallo script e memorizzato nella variabile sicura `ADMIN_PASSWORD_HASH`. |

## Problemi Riscontrati e Soluzioni (Troubleshooting)

Durante lo sviluppo del progetto, sono state affrontate e risolte diverse sfide tecniche:

*   **Gestione del Layout con Gridstack.js:**
    *   *Problema:* L'implementazione iniziale del Drag & Drop tramite `gridstack.js` causava conflitti di rendering, sovrapposizioni e disallineamenti quando combinata con l'aggiornamento asincrono dei widget.
    *   *Soluzione (Workaround):* La libreria è stata temporaneamente rimossa per garantire la stabilità visiva. È stato adottato un sistema di "toggle" che permette di nascondere o mostrare le card, anche se ciò lascia dei *gap* vuoti nella griglia.
*   **Autenticazione YouTube Music:**
    *   *Problema:* Le API ufficiali di YouTube Data non espongono nativamente i dati dell'applicazione YouTube Music (es. i mix personalizzati).
    *   *Soluzione:* Si è optato per la libreria Python `ytmusicapi`, che simula una sessione browser estrapolando i cookie (`secrets/browser.json`).
    *   *Bug Noto:* La sessione potrebbe scadere periodicamente, richiedendo l'estrazione e l'aggiornamento manuale delle intestazioni HTTP per far funzionare nuovamente il widget.
*   **Blocchi CORS sui Feed RSS:**
    *   *Problema:* Il tentativo di leggere direttamente da frontend (tramite `fetch()`) le notizie RSS di Bloomberg e NASA veniva bloccato dai browser a causa delle policy CORS (Cross-Origin Resource Sharing).
    *   *Soluzione:* Il problema è stato risolto spostando la logica sul server. Il backend Python funge da proxy: scarica l'XML, ne fa il parsing e restituisce al frontend un array JSON sicuro e formattato.

## Sviluppi Futuri (Roadmap)

Il progetto è stato concepito con una struttura scalabile, lasciando spazio a implementazioni future:

1.  **Refactoring UI/UX:** Migliorare ulteriormente il design dell'interfaccia utente (micro-interazioni, temi personalizzati, palette colori più moderne).
2.  **Re-integrazione Gridstack.js:** Studiare in maniera più approfondita la libreria per reintrodurre il Drag & Drop dei widget in modo stabile, eliminando i gap visivi attuali.
3.  **Ottimizzazione Autenticazione Musicale:** Testare metodi alternativi o più stabili per l'autenticazione a YouTube Music, in modo da evitare il reinserimento manuale dei cookie di sessione.
4.  **Espansione delle Funzionalità (Nuovi Widget):**
    *   Widget "Wikipedia Daily Facts" (La curiosità o la pagina in evidenza del giorno).
    *   Migrazione del widget *Scratchpad* (Appunti rapidi) per fare in modo che il testo venga salvato direttamente sul server (tramite SQLite) e non solo sul device locale.
5.  **Studio Sistemistico Avanzato:** Sperimentare il deploy dell'applicazione non più su un PaaS gestito come Render.com, ma su un'infrastruttura **IaaS (Infrastructure as a Service)** configurando da zero una macchina virtuale Linux tramite **Oracle Cloud Free Tier** (setup di Nginx come reverse proxy, configurazione di un dominio, gestione certificati SSL e demoni systemd).
