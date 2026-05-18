# Documentazione Tecnica: Personal Dashboard & Portfolio

**Progetto di fine anno scolastico (Esame di Stato)**
**Studente:** [Tuo Nome e Cognome]
**Classe/Indirizzo:** 5° Anno - Informatica e Telecomunicazioni

---

## 1. Obiettivo del Progetto
Sviluppo di una Web Application ibrida che funge da:
1. **Portfolio Pubblico:** Vetrina statica per la presentazione personale e l'esposizione dei progetti scolastici.
2. **Dashboard Privata:** Area riservata accessibile tramite autenticazione, contenente widget per la produttività (To-Do list, Meteo, Lettore Feed RSS, Statistiche).

Il progetto mira a dimostrare le competenze acquisite nello sviluppo Full-Stack (Informatica), progettazione e integrazione di servizi di rete (Sistemi e Reti) e sviluppo di API RESTful (TPSIT).

---

## 2. Stack Tecnologico
* **Backend:** Python 3.x, Flask (Web Framework)
* **Frontend:** HTML5, CSS3 (Vanilla, uso di CSS Variables e CSS Grid/Flexbox), JavaScript ES6+ (Fetch API, DOM Manipulation)
* **Data Storage:** JSON (File-based storage locale)
* **Sicurezza:** `bcrypt` per l'hashing delle credenziali
* **Deploy e Hosting:** Render.com (PaaS) tramite Gunicorn (WSGI Server)
* **Version Control:** Git & GitHub

---

## 3. Architettura Software (Backend)
L'applicazione backend è stata strutturata seguendo il pattern architetturale basato su moduli, sfruttando i **Flask Blueprints** per separare le responsabilità e garantire la scalabilità del codice:

* `app.py`: Entry point dell'applicazione. Gestisce l'inizializzazione dell'istanza Flask, il caricamento delle configurazioni (`.env` e `config/config.yaml`) e la registrazione dei blueprint.
* `routes/portfolio.py`: Gestisce le route pubbliche (landing page).
* `routes/auth.py`: Gestisce il flusso di autenticazione, la creazione e la distruzione delle sessioni HTTP. Verifica le credenziali confrontando l'input utente con l'hash bcrypt memorizzato in modo sicuro nelle variabili d'ambiente.
* `routes/dashboard.py`: Contiene la logica dell'area riservata e gli **Endpoint API REST** usati dal frontend per le operazioni asincrone. La route principale è protetta dal decoratore custom `@login_required`.

---

## 4. Gestione Dati e API (TPSIT)
### 4.1. Storage JSON Locale (CRUD)
Non essendoci necessità di un DBMS relazionale complesso per un singolo utente, i dati persistenti (es. i task della To-Do List) sono gestiti tramite file JSON (`data/todos.json`).
Sono state implementate route API RESTful per gestire il ciclo CRUD:
* `GET /api/todos`: Restituisce l'array JSON dei task.
* `POST /api/todos`: Aggiunge un nuovo task.
* `PUT /api/todos/<id>`: Modifica lo stato (completato/non completato) di un task.
* `DELETE /api/todos/<id>`: Elimina un task specifico.

### 4.2. Integrazioni API di Terze Parti e Asincronismo (AJAX)
Il frontend comunica costantemente con le API in background senza ricaricare la pagina (AJAX tramite `fetch`).
* **Widget Meteo:** Utilizza l'API pubblica RESTful di **Open-Meteo**. Il client esegue una GET passando latitudine e longitudine e formatta il JSON di risposta.
* **Feed RSS (Parsing XML):** Implementato con logica lato server. Il backend Python si connette al feed RSS tramite la libreria `requests`, parsando la struttura XML tramite `xml.etree.ElementTree` per superare eventuali limitazioni di CORS (Cross-Origin Resource Sharing) del browser, offrendo al frontend un payload JSON pulito.
* **Grafici:** Utilizzo della libreria Chart.js per il rendering di statistiche derivate dallo stato corrente del file JSON locale.

---

## 5. Sicurezza e Configurazioni
* **Nessuna password in chiaro:** La password dell'amministratore è salvata come hash `bcrypt` (algoritmo asimmetrico con salt).
* **Gestione dei Segreti:** Segreti come il `SECRET_KEY` di Flask e le credenziali risiedono in variabili d'ambiente (`.env` in locale, Env Vars nativi su Render).
* **Configurazione Modulare:** Parametri non sensibili (come gli endpoint dei feed RSS o i link rapidi) risiedono in un file `config/config.yaml`, rendendo l'app dinamicamente aggiornabile senza modificare il codice sorgente.

---

## 6. Prospettive di Sviluppo (Scalabilità)
Il progetto, grazie all'uso dei Blueprints e alla netta separazione tra backend (API) e frontend (Client), è facilmente scalabile.
Sviluppi futuri potrebbero includere:
1. Migrazione dal file system JSON a un database SQLite o PostgreSQL tramite ORM (SQLAlchemy).
2. Sviluppo di una Progressive Web App (PWA) integrando un Service Worker per l'utilizzo offline della dashboard.
3. Integrazione di protocolli OAuth2 per l'accesso tramite provider esterni (es. GitHub Login).
