import os
import base64
import re
import requests
from flask import Blueprint, jsonify, request, session, render_template, redirect, url_for
from functools import wraps

obsidian_bp = Blueprint('obsidian', __name__)

# --- AUTH DECORATOR ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- HELPERS ---
def get_github_config():
    repo = os.environ.get('OBSIDIAN_GITHUB_REPO')
    token = os.environ.get('OBSIDIAN_GITHUB_TOKEN')
    todo_file = os.environ.get('OBSIDIAN_TODO_FILE', 'Todos.md')
    
    # Rimuovi slash inziali/finali per evitare path malformati
    notes_path = os.environ.get('OBSIDIAN_NOTES_PATH', '').strip('/')
    attachments_path = os.environ.get('OBSIDIAN_ATTACHMENTS_PATH', 'Attachments').strip('/')
    
    return repo, token, todo_file, notes_path, attachments_path

def make_github_request(method, path, data=None):
    repo, token, _, _, _ = get_github_config()
    if not repo or not token:
        return None, "Configurazione GitHub mancante (controlla OBSIDIAN_GITHUB_REPO e OBSIDIAN_GITHUB_TOKEN)."
    
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'PUT':
            response = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, json=data, timeout=10)
        else:
            return None, f"Metodo HTTP {method} non supportato"
        return response, None
    except Exception as e:
        return None, str(e)

# --- ROUTES ---

@obsidian_bp.route('/vault', methods=['GET'])
def vault_page():
    if 'logged_in' not in session:
        return redirect(url_for('auth.login'))
    return render_template('dashboard/obsidian.html')

@obsidian_bp.route('/api/config-check', methods=['GET'])
@login_required
def check_config():
    repo, token, todo_file, notes_path, attachments_path = get_github_config()
    if not repo or not token:
        return jsonify({
            "configured": False,
            "error_msg": "OBSIDIAN_GITHUB_REPO o OBSIDIAN_GITHUB_TOKEN mancanti nel file .env."
        })
    return jsonify({
        "configured": True,
        "repo": repo,
        "todo_file": todo_file,
        "notes_path": notes_path,
        "attachments_path": attachments_path
    })

# 1. NOTES API

@obsidian_bp.route('/api/notes', methods=['GET'])
@login_required
def list_notes():
    _, _, _, notes_path, _ = get_github_config()
    response, error = make_github_request('GET', notes_path)
    if error:
        return jsonify({"error": error}), 500
    
    if response.status_code == 404:
        return jsonify([])
        
    if response.status_code != 200:
        return jsonify({"error": f"Errore GitHub (Status {response.status_code})"}), response.status_code
        
    items = response.json()
    if not isinstance(items, list):
        items = [items]
        
    notes = []
    for item in items:
        # Mostra solo i file Markdown
        if item['type'] == 'file' and item['name'].endswith('.md'):
            notes.append({
                "name": item['name'],
                "path": item['path'],
                "sha": item['sha'],
                "size": item['size']
            })
    # Ordina per nome alfabeticamente
    notes.sort(key=lambda x: x['name'].lower())
    return jsonify(notes)

@obsidian_bp.route('/api/notes/content', methods=['GET'])
@login_required
def get_note_content():
    path = request.args.get('path')
    if not path:
        return jsonify({"error": "Path mancante"}), 400
        
    response, error = make_github_request('GET', path)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code != 200:
        return jsonify({"error": f"Errore caricamento nota (Status {response.status_code})"}), response.status_code
        
    data = response.json()
    try:
        content = base64.b64decode(data['content']).decode('utf-8')
    except Exception:
        content = "[Impossibile decodificare il file in formato UTF-8]"
        
    return jsonify({
        "path": data['path'],
        "sha": data['sha'],
        "content": content
    })

@obsidian_bp.route('/api/notes/content', methods=['POST'])
@login_required
def save_note_content():
    data = request.json
    path = data.get('path')
    content = data.get('content', '')
    sha = data.get('sha')
    
    if not path:
        return jsonify({"error": "Path mancante"}), 400
        
    # Assicurati che abbia l'estensione corretta
    if not path.endswith('.md'):
        path += '.md'
        
    # Se lo sha non è fornito, proviamo a cercarlo per non fallire il commit
    if not sha:
        resp_get, _ = make_github_request('GET', path)
        if resp_get and resp_get.status_code == 200:
            sha = resp_get.json().get('sha')
            
    payload = {
        "message": f"Nota {os.path.basename(path)} salvata da Dashboard",
        "content": base64.b64encode(content.encode('utf-8')).decode('utf-8')
    }
    if sha:
        payload["sha"] = sha
        
    response, error = make_github_request('PUT', path, payload)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code not in (200, 201):
        return jsonify({"error": f"Errore nel salvataggio della nota (Status {response.status_code})"}), response.status_code
        
    res_data = response.json()
    return jsonify({
        "success": True,
        "path": res_data['content']['path'],
        "sha": res_data['content']['sha']
    })

@obsidian_bp.route('/api/notes/delete', methods=['DELETE'])
@login_required
def delete_note():
    path = request.args.get('path')
    sha = request.args.get('sha')
    if not path or not sha:
        return jsonify({"error": "Path o SHA mancanti"}), 400
        
    payload = {
        "message": f"Eliminata nota {os.path.basename(path)} da Dashboard",
        "sha": sha
    }
    
    response, error = make_github_request('DELETE', path, payload)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code != 200:
        return jsonify({"error": f"Errore eliminazione nota (Status {response.status_code})"}), response.status_code
        
    return jsonify({"success": True})

# 2. TODOS API (PARSING MARKDOWN CHECKLIST)

@obsidian_bp.route('/api/todos', methods=['GET'])
@login_required
def get_todos():
    _, _, todo_file, _, _ = get_github_config()
    response, error = make_github_request('GET', todo_file)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code == 404:
        return jsonify({"sha": None, "todos": []})
        
    if response.status_code != 200:
        return jsonify({"error": f"Errore caricamento Todo (Status {response.status_code})"}), response.status_code
        
    data = response.json()
    content = base64.b64decode(data['content']).decode('utf-8')
    sha = data['sha']
    
    lines = content.split('\n')
    todos = []
    for idx, line in enumerate(lines):
        match = re.match(r'^(\s*-\s*\[([ xX])\]\s+)(.+)$', line)
        if match:
            status = match.group(2)
            text = match.group(3)
            todos.append({
                "id": idx,
                "text": text,
                "completed": status.lower() == 'x'
            })
            
    return jsonify({"sha": sha, "todos": todos})

@obsidian_bp.route('/api/todos', methods=['POST'])
@login_required
def add_todo():
    data = request.json
    text = data.get('text', '').strip()
    if not text:
        return jsonify({"error": "Testo mancante"}), 400
        
    _, _, todo_file, _, _ = get_github_config()
    
    # 1. Recupera contenuto attuale
    response, error = make_github_request('GET', todo_file)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code == 404:
        # Se non esiste, crea un file pulito
        content = f"# Todos\n\n- [ ] {text}\n"
        sha = None
    elif response.status_code == 200:
        file_data = response.json()
        content = base64.b64decode(file_data['content']).decode('utf-8')
        sha = file_data['sha']
        # Appendi alla fine
        if content and not content.endswith('\n'):
            content += '\n'
        content += f"- [ ] {text}\n"
    else:
        return jsonify({"error": f"Errore recupero file Todo (Status {response.status_code})"}), response.status_code
        
    # 2. Salva modifiche
    payload = {
        "message": f"Aggiunto todo '{text}' da Dashboard",
        "content": base64.b64encode(content.encode('utf-8')).decode('utf-8')
    }
    if sha:
        payload["sha"] = sha
        
    res, err = make_github_request('PUT', todo_file, payload)
    if err:
        return jsonify({"error": err}), 500
        
    if res.status_code not in (200, 201):
        return jsonify({"error": f"Errore nel salvataggio del Todo (Status {res.status_code})"}), res.status_code
        
    return jsonify({"success": True})

@obsidian_bp.route('/api/todos/<int:line_idx>', methods=['PUT'])
@login_required
def toggle_todo(line_idx):
    data = request.json
    completed = data.get('completed', False)
    
    _, _, todo_file, _, _ = get_github_config()
    
    # 1. Recupera il file aggiornato
    response, error = make_github_request('GET', todo_file)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code != 200:
        return jsonify({"error": f"Impossibile trovare il file Todo (Status {response.status_code})"}), response.status_code
        
    file_data = response.json()
    content = base64.b64decode(file_data['content']).decode('utf-8')
    sha = file_data['sha']
    
    lines = content.split('\n')
    if line_idx >= len(lines):
        return jsonify({"error": "Indice linea non valido"}), 400
        
    line = lines[line_idx]
    match = re.match(r'^(\s*-\s*\[)([ xX])(\]\s+.+)$', line)
    if not match:
        return jsonify({"error": "La linea selezionata non è un Todo valido"}), 400
        
    new_status = 'x' if completed else ' '
    lines[line_idx] = f"{match.group(1)}{new_status}{match.group(3)}"
    new_content = '\n'.join(lines)
    
    # 2. Salva modifiche
    payload = {
        "message": f"Stato Todo riga {line_idx} modificato da Dashboard",
        "content": base64.b64encode(new_content.encode('utf-8')).decode('utf-8'),
        "sha": sha
    }
    
    res, err = make_github_request('PUT', todo_file, payload)
    if err:
        return jsonify({"error": err}), 500
        
    if res.status_code != 200:
        return jsonify({"error": f"Errore nel salvataggio dello stato del Todo (Status {res.status_code})"}), res.status_code
        
    return jsonify({"success": True})

@obsidian_bp.route('/api/todos/<int:line_idx>', methods=['DELETE'])
@login_required
def delete_todo(line_idx):
    _, _, todo_file, _, _ = get_github_config()
    
    # 1. Recupera il file aggiornato
    response, error = make_github_request('GET', todo_file)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code != 200:
        return jsonify({"error": f"Impossibile trovare il file Todo (Status {response.status_code})"}), response.status_code
        
    file_data = response.json()
    content = base64.b64decode(file_data['content']).decode('utf-8')
    sha = file_data['sha']
    
    lines = content.split('\n')
    if line_idx >= len(lines):
        return jsonify({"error": "Indice linea non valido"}), 400
        
    line = lines[line_idx]
    if not re.match(r'^\s*-\s*\[[ xX]\]\s+.+$', line):
        return jsonify({"error": "La linea selezionata non è un Todo valido"}), 400
        
    # Elimina la linea
    del lines[line_idx]
    new_content = '\n'.join(lines)
    
    # 2. Salva modifiche
    payload = {
        "message": f"Eliminato Todo riga {line_idx} da Dashboard",
        "content": base64.b64encode(new_content.encode('utf-8')).decode('utf-8'),
        "sha": sha
    }
    
    res, err = make_github_request('PUT', todo_file, payload)
    if err:
        return jsonify({"error": err}), 500
        
    if res.status_code != 200:
        return jsonify({"error": f"Errore nell'eliminazione del Todo (Status {res.status_code})"}), res.status_code
        
    return jsonify({"success": True})

# 3. ATTACHMENTS (FILE SYNC)

@obsidian_bp.route('/api/attachments', methods=['GET'])
@login_required
def list_attachments():
    _, _, _, _, attachments_path = get_github_config()
    response, error = make_github_request('GET', attachments_path)
    if error:
        return jsonify({"error": error}), 500
    
    if response.status_code == 404:
        return jsonify([])
        
    if response.status_code != 200:
        return jsonify({"error": f"Errore GitHub (Status {response.status_code})"}), response.status_code
        
    items = response.json()
    if not isinstance(items, list):
        items = [items]
        
    attachments = []
    for item in items:
        if item['type'] == 'file':
            attachments.append({
                "name": item['name'],
                "path": item['path'],
                "sha": item['sha'],
                "size": item['size'],
                "download_url": item['download_url']
            })
    # Ordina per nome alfabeticamente
    attachments.sort(key=lambda x: x['name'].lower())
    return jsonify(attachments)

@obsidian_bp.route('/api/attachments', methods=['POST'])
@login_required
def upload_attachment():
    data = request.json
    filename = data.get('filename')
    content_b64 = data.get('content')
    
    if not filename or not content_b64:
        return jsonify({"error": "Nome file o contenuto mancante"}), 400
        
    _, _, _, _, attachments_path = get_github_config()
    
    # Pulisci e unisci il percorso del file
    filename = os.path.basename(filename)
    path = f"{attachments_path}/{filename}" if attachments_path else filename
    
    # Controlla se il file esiste già per recuperare lo sha (sovrascrittura sicura)
    sha = None
    resp_get, _ = make_github_request('GET', path)
    if resp_get and resp_get.status_code == 200:
        sha = resp_get.json().get('sha')
        
    payload = {
        "message": f"Caricato file {filename} da Dashboard",
        "content": content_b64
    }
    if sha:
        payload["sha"] = sha
        
    response, error = make_github_request('PUT', path, payload)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code not in (200, 201):
        return jsonify({"error": f"Errore caricamento file (Status {response.status_code})"}), response.status_code
        
    return jsonify({"success": True, "name": filename})

@obsidian_bp.route('/api/attachments', methods=['DELETE'])
@login_required
def delete_attachment():
    data = request.json
    path = data.get('path')
    sha = data.get('sha')
    
    if not path or not sha:
        return jsonify({"error": "Path o SHA mancanti"}), 400
        
    payload = {
        "message": f"Eliminato file {os.path.basename(path)} da Dashboard",
        "sha": sha
    }
    
    response, error = make_github_request('DELETE', path, payload)
    if error:
        return jsonify({"error": error}), 500
        
    if response.status_code != 200:
        return jsonify({"error": f"Errore eliminazione file (Status {response.status_code})"}), response.status_code
        
    return jsonify({"success": True})
