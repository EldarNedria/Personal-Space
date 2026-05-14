import sqlite3
from flask import g
import os

DATABASE = 'data/database.db'

def get_db():
    """Restituisce la connessione al database SQLite per la richiesta corrente."""
    db = getattr(g, '_database', None)
    if db is None:
        # Crea la cartella data se non esiste
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        db = g._database = sqlite3.connect(DATABASE)
        # Permette di accedere alle colonne per nome (es: row['title'])
        db.row_factory = sqlite3.Row
    return db

def close_connection(exception):
    """Chiude la connessione al termine della richiesta."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db(app):
    """Inizializza il database creando le tabelle se non esistono."""
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        
        # Tabella per gli articoli del blog/CMS
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                excerpt TEXT,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_published BOOLEAN DEFAULT 0
            )
        ''')
        
        # Tabella per le preferenze dei widget (dashboard modulare con gridstack)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS widget_preferences (
                widget_id TEXT PRIMARY KEY,
                widget_name TEXT NOT NULL,
                widget_icon TEXT NOT NULL,
                is_enabled BOOLEAN DEFAULT 1,
                pos_x INTEGER DEFAULT 0,
                pos_y INTEGER DEFAULT 0,
                size_w INTEGER DEFAULT 1,
                size_h INTEGER DEFAULT 4
            )
        ''')
        
        # Migrazione: aggiungi le colonne di posizione se mancano (per DB già esistenti)
        existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(widget_preferences)").fetchall()]
        for col, default in [('pos_x', 0), ('pos_y', 0), ('size_w', 1), ('size_h', 4)]:
            if col not in existing_cols:
                cursor.execute(f"ALTER TABLE widget_preferences ADD COLUMN {col} INTEGER DEFAULT {default}")
        
        # Inserisci i widget di default (solo se la tabella è vuota)
        # Griglia a 4 colonne. (widget_id, name, icon, enabled, x, y, w, h)
        cursor.execute("SELECT COUNT(*) FROM widget_preferences")
        if cursor.fetchone()[0] == 0:
            default_widgets = [
                ('weather',    'Meteo Locale',     'fa-cloud-sun',     1, 0, 0, 1, 4),
                ('todos',      'Google Tasks',     'fa-list-check',    1, 1, 0, 1, 5),
                ('rss',        'Notizie RSS',      'fa-rss',           1, 2, 0, 1, 5),
                ('calendar',   'Google Calendar',  'fa-calendar-days', 1, 3, 0, 1, 7),
                ('scratchpad', 'Scratchpad',       'fa-note-sticky',   1, 0, 4, 1, 3),
                ('pomodoro',   'Timer Pomodoro',   'fa-stopwatch',     1, 1, 5, 1, 4),
                ('stats',      'Statistiche',      'fa-chart-line',    1, 2, 5, 1, 4),
                ('links',      'Link Rapidi',      'fa-link',          1, 3, 7, 1, 3),
            ]
            cursor.executemany(
                "INSERT INTO widget_preferences (widget_id, widget_name, widget_icon, is_enabled, pos_x, pos_y, size_w, size_h) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                default_widgets
            )
        
        db.commit()
        
    # Registra la chiusura della connessione alla fine di ogni richiesta
    app.teardown_appcontext(close_connection)
