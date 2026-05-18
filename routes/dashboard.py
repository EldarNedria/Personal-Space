import os
import json
import xml.etree.ElementTree as ET
import requests
import datetime
from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify, current_app
from functools import wraps
from google.oauth2 import service_account
from googleapiclient.discovery import build

dashboard_bp = Blueprint('dashboard', __name__)

# --- DECORATORE AUTENTICAZIONE ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

# --- HELPER FUNZIONI DATA JSON ---
def read_json(filename):
    filepath = os.path.join('data', filename)
    if not os.path.exists(filepath):
        return []
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def write_json(filename, data):
    filepath = os.path.join('data', filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

# --- ROUTES PRINCIPALI ---
@dashboard_bp.route('/')
@login_required
def index():
    config = current_app.config['APP_CONFIG']
    links = config.get('dashboard_links', [])
    return render_template('dashboard/index.html', links=links)

# --- API ENDPOINTS PER AJAX ---

# 1. GOOGLE TASKS (Sostituisce i vecchi TODOs JSON)
def get_tasks_service():
    if not os.path.exists('secrets/credentials.json'):
        return None
    SCOPES = ['https://www.googleapis.com/auth/tasks']
    creds = service_account.Credentials.from_service_account_file('secrets/credentials.json', scopes=SCOPES)
    service = build('tasks', 'v1', credentials=creds)
    return service

@dashboard_bp.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    service = get_tasks_service()
    if not service:
        return jsonify({"error": "Credenziali Google mancanti"}), 404
        
    try:
        results = service.tasks().list(tasklist='@default', showCompleted=True, showHidden=True).execute()
        tasks = results.get('items', [])
        
        # Mappiamo i dati per il frontend
        parsed_tasks = []
        for t in tasks:
            parsed_tasks.append({
                "id": t['id'],
                "text": t['title'],
                "notes": t.get('notes', ''),
                "due": t.get('due', ''),
                "completed": t.get('status') == 'completed'
            })
            
        return jsonify(parsed_tasks)
    except Exception as e:
        return jsonify({"error": f"Errore Google Tasks: {str(e)}"}), 500

@dashboard_bp.route('/api/tasks', methods=['POST'])
@login_required
def add_task():
    service = get_tasks_service()
    if not service:
        return jsonify({"error": "Credenziali Google mancanti"}), 404
        
    data = request.json
    text = data.get('text', '').strip()
    notes = data.get('notes', '').strip()
    due = data.get('due', '').strip()
    
    if not text:
        return jsonify({"error": "Testo mancante"}), 400
        
    try:
        task_body = {'title': text}
        if notes:
            task_body['notes'] = notes
        if due:
            # L'API richiede il formato RFC 3339 (es. 2026-05-15T00:00:00.000Z)
            task_body['due'] = f"{due}T00:00:00.000Z"
            
        result = service.tasks().insert(tasklist='@default', body=task_body).execute()
        
        new_task = {
            "id": result['id'],
            "text": result['title'],
            "notes": result.get('notes', ''),
            "due": result.get('due', ''),
            "completed": False
        }
        return jsonify(new_task), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dashboard_bp.route('/api/tasks/<task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    service = get_tasks_service()
    data = request.json
    
    try:
        # Recupera il task attuale
        task = service.tasks().get(tasklist='@default', task=task_id).execute()
        
        if 'completed' in data:
            task['status'] = 'completed' if data['completed'] else 'needsAction'
        if 'text' in data:
            task['title'] = data['text']
        if 'notes' in data:
            task['notes'] = data['notes']
        if 'due' in data:
            if data['due']:
                task['due'] = f"{data['due']}T00:00:00.000Z"
            else:
                task['due'] = None # Rimuove la scadenza
            
        updated = service.tasks().update(tasklist='@default', task=task_id, body=task).execute()
        return jsonify({
            "id": updated['id'],
            "text": updated['title'],
            "notes": updated.get('notes', ''),
            "due": updated.get('due', ''),
            "completed": updated.get('status') == 'completed'
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dashboard_bp.route('/api/tasks/<task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    service = get_tasks_service()
    try:
        service.tasks().delete(tasklist='@default', task=task_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- WIDGET PREFERENCES (Dashboard Modulare con Gridstack) ---
@dashboard_bp.route('/api/widgets/preferences', methods=['GET'])
@login_required
def get_widget_preferences():
    """Restituisce lo stato e la posizione/dimensione di ogni widget."""
    from database import get_db
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT widget_id, widget_name, widget_icon, is_enabled, pos_x, pos_y, size_w, size_h FROM widget_preferences")
    prefs = [dict(row) for row in cursor.fetchall()]
    return jsonify(prefs)

@dashboard_bp.route('/api/widgets/preferences', methods=['PUT'])
@login_required
def update_widget_preferences():
    """Aggiorna lo stato di un widget (attivato/disattivato)."""
    from database import get_db
    data = request.json
    widget_id = data.get('widget_id')
    is_enabled = data.get('is_enabled')
    
    if widget_id is None or is_enabled is None:
        return jsonify({"error": "widget_id e is_enabled sono obbligatori"}), 400
    
    db = get_db()
    cursor = db.cursor()
    cursor.execute("UPDATE widget_preferences SET is_enabled = ? WHERE widget_id = ?", (1 if is_enabled else 0, widget_id))
    db.commit()
    return jsonify({"success": True})

@dashboard_bp.route('/api/widgets/layout', methods=['PUT'])
@login_required
def update_widget_layout():
    """Salva la posizione e dimensione di tutti i widget dopo un drag/resize."""
    from database import get_db
    data = request.json  # Lista di {widget_id, x, y, w, h}
    
    if not isinstance(data, list):
        return jsonify({"error": "Formato non valido"}), 400
    
    db = get_db()
    cursor = db.cursor()
    for item in data:
        cursor.execute(
            "UPDATE widget_preferences SET pos_x = ?, pos_y = ?, size_w = ?, size_h = ? WHERE widget_id = ?",
            (item.get('x', 0), item.get('y', 0), item.get('w', 1), item.get('h', 4), item['widget_id'])
        )
    db.commit()
    return jsonify({"success": True})

# 2. RSS FEED (XML PARSING)
@dashboard_bp.route('/api/rss/<feed_type>', methods=['GET'])
@login_required
def get_rss(feed_type):
    config = current_app.config['APP_CONFIG']
    feeds = config.get('rss_feeds', {})
    
    url = feeds.get(feed_type)
    if not url:
        return jsonify({"error": "Feed non configurato"}), 404
        
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        
        # Parsing XML
        root = ET.fromstring(response.content)
        items = []
        for item in root.findall('./channel/item')[:5]: # Prendi i primi 5
            title = item.find('title').text if item.find('title') is not None else 'Senza Titolo'
            link = item.find('link').text if item.find('link') is not None else '#'
            pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ''
            
            # Extract image if available
            image_url = None
            enclosure = item.find('enclosure')
            if enclosure is not None and enclosure.get('type', '').startswith('image/'):
                image_url = enclosure.get('url')
            
            items.append({
                'title': title,
                'link': link,
                'pubDate': pub_date,
                'image': image_url
            })
            
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": f"Errore caricamento RSS: {str(e)}"}), 500

# --- GOOGLE CALENDAR HELPER ---
def get_calendar_service():
    if not os.path.exists('secrets/credentials.json'):
        return None
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    creds = service_account.Credentials.from_service_account_file('secrets/credentials.json', scopes=SCOPES)
    service = build('calendar', 'v3', credentials=creds)
    return service

# 3. GOOGLE CALENDAR
@dashboard_bp.route('/api/calendar/events', methods=['GET'])
@login_required
def get_calendar_events():
    config = current_app.config['APP_CONFIG']
    calendar_id = config.get('google_calendar_id', 'primary')
    
    service = get_calendar_service()
    if not service:
        return jsonify({"error": "Credenziali Google (secrets/credentials.json) mancanti."}), 404
        
    try:
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        
        if year and month:
            start_date = datetime.datetime(year, month, 1)
            timeMin = start_date.isoformat() + 'Z'
            if month == 12:
                next_month = datetime.datetime(year + 1, 1, 1)
            else:
                next_month = datetime.datetime(year, month + 1, 1)
            timeMax = next_month.isoformat() + 'Z'
            
            events_result = service.events().list(
                calendarId=calendar_id, timeMin=timeMin, timeMax=timeMax,
                maxResults=100, singleEvents=True,
                orderBy='startTime'
            ).execute()
        else:
            now = datetime.datetime.utcnow().isoformat() + 'Z'
            events_result = service.events().list(
                calendarId=calendar_id, timeMin=now,
                maxResults=10, singleEvents=True,
                orderBy='startTime'
            ).execute()
            
        events = events_result.get('items', [])
        
        parsed_events = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            parsed_events.append({
                "id": event['id'],
                "title": event.get('summary', 'Senza Titolo'),
                "start": start,
                "link": event.get('htmlLink', '#')
            })
            
        return jsonify(parsed_events)
    except Exception as e:
        return jsonify({"error": f"Errore API Google: {str(e)}"}), 500

@dashboard_bp.route('/api/calendar/events', methods=['POST'])
@login_required
def add_calendar_event():
    config = current_app.config['APP_CONFIG']
    calendar_id = config.get('google_calendar_id', 'primary')
    
    service = get_calendar_service()
    if not service:
        return jsonify({"error": "Credenziali Google mancanti"}), 404
        
    data = request.json
    summary = data.get('title')
    start_time = data.get('start') 
    end_time = data.get('end')
    
    if not summary or not start_time or not end_time:
        return jsonify({"error": "Dati mancanti (title, start, end richiesti)"}), 400
        
    # start_time ed end_time dovrebbero essere in formato ISO (es. 2026-05-13T10:00:00)
    event = {
      'summary': summary,
      'start': {
        'dateTime': start_time + ':00', # Assicura i secondi se passati dall'input datetime-local
        'timeZone': 'Europe/Rome',
      },
      'end': {
        'dateTime': end_time + ':00',
        'timeZone': 'Europe/Rome',
      },
    }
    
    try:
        event = service.events().insert(calendarId=calendar_id, body=event).execute()
        return jsonify({"success": True, "link": event.get('htmlLink')})
    except Exception as e:
        return jsonify({"error": f"Errore creazione evento: {str(e)}"}), 500
