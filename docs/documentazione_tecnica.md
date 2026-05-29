# Documentazione Tecnica: Personal Dashboard & Portfolio

**Progetto di fine anno scolastico (Esame di Stato)**
**Studente:** Eldar Nedria
**Classe:**  ITIS 5M

---

## 1. Obiettivo del Progetto
Sviluppo di una Web Application ibrida che funge da:
1. **Portfolio Pubblico:** Vetrina statica per la presentazione personale e l'esposizione dei progetti scolastici.
2. **Dashboard Privata:** Area riservata accessibile tramite autenticazione, contenente widget per la produttività (To-Do list, Meteo, Lettore Feed RSS, Statistiche).

Il progetto mira a dimostrare le competenze acquisite nello sviluppo Full-Stack (Informatica), progettazione e integrazione di servizi di rete (Sistemi e Reti) e sviluppo di API RESTful (TPSIT).

---

## 2. Stack Tecnologico
* **Backend:** Python 3.x, Flask (Web Framework)
* **Frontend:** HTML5, CSS3 (Vanilla, uso di CSS Variables e CSS Grid/Flexbox), JavaScript ES6+ (Fetch API, DOM Manipulation, Marked.js per rendering Markdown)
* **Data Storage:** SQLite (`data/database.db`) per preferenze widget e CMS Blog + file JSON per cache locale
* **Sicurezza:** `bcrypt` per l'hashing delle credenziali
* **Deploy e Hosting:** Render.com (PaaS) tramite Gunicorn (WSGI Server)
* **Version Control:** Git & GitHub
* **API Esterne:** Google Tasks/Calendar, GitHub REST API, YouTube Music, Telegram Bot API

---

## 3. Architettura Software (Backend)
L'applicazione backend è stata strutturata seguendo il pattern architetturale basato su moduli, sfruttando i **Flask Blueprints** per separare le responsabilità e garantire la scalabilità del codice:

* `app.py`: Entry point dell'applicazione. Gestisce l'inizializzazione dell'istanza Flask, il caricamento delle configurazioni (`.env` e `config/config.yaml`) e la registrazione dei blueprint.
* `routes/portfolio.py`: Gestisce le route pubbliche (landing page).
* `routes/auth.py`: Gestisce il flusso di autenticazione, la creazione e la distruzione delle sessioni HTTP. Verifica le credenziali confrontando l'input utente con l'hash bcrypt memorizzato in modo sicuro nelle variabili d'ambiente.
* `routes/dashboard.py`: Contiene la logica dell'area riservata e gli **Endpoint API REST** usati dal frontend per le operazioni asincrone. La route principale è protetta dal decoratore custom `@login_required`.
* `routes/obsidian.py`: Gestisce l'integrazione bidirezionale con il Vault privato di Obsidian tramite chiamate autenticate alle API GitHub REST.

---

## 4. Gestione Dati e API (TPSIT)
### 4.1. Database SQLite
Per la persistenza dei dati strutturati dell'applicazione (es. configurazione layout della dashboard, articoli del blog e CMS), viene utilizzato **SQLite** (`data/database.db`). Le tabelle create includono:
* `widget_preferences`: Salva lo stato (attivo/disattivo) e le coordinate/dimensioni del layout flessibile Gridstack per ogni widget.
* `articles`: Memorizza gli articoli del blog con stato di pubblicazione e metadata temporali.

### 4.2. Integrazioni API di Terze Parti e Asincronismo (AJAX)
Il frontend comunica costantemente con le API in background senza ricaricare la pagina (AJAX tramite `fetch`).
* **Widget Meteo:** Utilizza l'API pubblica RESTful di **Open-Meteo**. Il client esegue una GET passando latitudine e longitudine e formatta il JSON di risposta.
* **Feed RSS (Parsing XML):** Implementato con logica lato server. Il backend Python si connette al feed RSS tramite la libreria `requests`, parsando la struttura XML tramite `xml.etree.ElementTree` per superare eventuali limitazioni di CORS (Cross-Origin Resource Sharing) del browser, offrendo al frontend un payload JSON pulito.
* **YouTube Music API:** Permette l'esplorazione e la riproduzione in streaming delle playlist personali tramite la libreria `ytmusicapi`, emulando le intestazioni del browser.
* **Grafici:** Utilizzo della libreria Chart.js per il rendering di statistiche derivate dallo stato corrente del file JSON locale.

### 4.3. Integrazione Obsidian Vault (GitHub API Bridge)
Poiché l'applicazione gira online su Render, non ha accesso diretto a un file system locale di Obsidian. È stata quindi implementata un'integrazione basata su GitHub API per dialogare con un repository privato contenente il proprio Vault:
1. **Navigazione & CRUD Note:** Endpoint per listare ricorsivamente i file `.md`, leggerne il contenuto e permetterne la creazione, modifica o eliminazione direttamente sul repository tramite chiamate REST (con autenticazione PAT).
2. **Interfaccia To-Do List:** Parsing del file `Todos.md` per estrarre checkbox markdown (`- [ ]` e `- [x]`). Gli utenti possono flaggare gli elementi dal widget o dalla pagina dedicata, innescando una riscrittura riga per riga del file remoto su GitHub.
3. **Gestione Allegati:** Un uploader drag-and-drop consente di inviare immagini o documenti. Il backend converte il file in Base64 e lo committa nella cartella degli allegati configurata (es. `Attachments/`), inserendo il link relativo Markdown nel documento attivo.

---

## 5. Sicurezza e Configurazioni
* **Nessuna password in chiaro:** La password dell'amministratore è salvata come hash `bcrypt` (algoritmo asimmetrico con salt).
* **Gestione dei Segreti:** Segreti come il `SECRET_KEY` di Flask, il token GitHub (`OBSIDIAN_GITHUB_TOKEN`) e le credenziali risiedono in variabili d'ambiente (`.env` in locale, Env Vars nativi su Render).
* **Configurazione Modulare:** Parametri non sensibili (come gli endpoint dei feed RSS o i link rapidi) risiedono in un file `config/config.yaml`, rendendo l'app dinamicamente aggiornabile senza modificare il codice sorgente.

---

## 6. Prospettive di Sviluppo (Scalabilità)
Il progetto, grazie all'uso dei Blueprints e alla netta separazione tra backend (API) e frontend (Client), è facilmente scalabile.
Sviluppi futuri potrebbero includere:
1. Sviluppo di una Progressive Web App (PWA) integrando un Service Worker per l'utilizzo offline della dashboard.
2. Integrazione di protocolli OAuth2 per l'accesso tramite provider esterni (es. GitHub Login).
3. Integrazione di un parser Markdown avanzato lato server per il rendering nativo di plugin Obsidian specifici.
