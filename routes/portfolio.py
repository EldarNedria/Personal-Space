from flask import Blueprint, render_template, request, jsonify
from database import get_db
import os
import urllib.request
import urllib.parse
import json

portfolio_bp = Blueprint('portfolio', __name__)

@portfolio_bp.route('/')
def index():
    return render_template('portfolio/index.html')

@portfolio_bp.route('/blog')
def blog():
    """Pagina pubblica con la lista degli articoli del blog."""
    db = get_db()
    cursor = db.cursor()
    # Mostra solo gli articoli pubblicati
    cursor.execute("SELECT id, title, excerpt, created_at FROM articles WHERE is_published = 1 ORDER BY created_at DESC")
    articles = cursor.fetchall()
    return render_template('portfolio/blog.html', articles=articles)

@portfolio_bp.route('/blog/<int:id>')
def article(id):
    """Pagina pubblica per un singolo articolo."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM articles WHERE id = ? AND is_published = 1", (id,))
    article = cursor.fetchone()
    if not article:
        return render_template('portfolio/404.html'), 404
    return render_template('portfolio/article.html', article=article)

@portfolio_bp.route('/api/contact', methods=['POST'])
def contact():
    """Riceve i dati dal form di contatto e invia una notifica Telegram."""
    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    message = data.get('message', '').strip()
    
    if not name or not email or not message:
        return jsonify({"error": "Tutti i campi sono obbligatori."}), 400
        
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID')
    
    if not bot_token or not chat_id:
        return jsonify({"error": "Configurazione Telegram mancante sul server."}), 500
        
    text = (
        "📩 Nuovo Messaggio dal Portfolio!\n\n"
        f"👤 Da: {name}\n"
        f"📧 Email: {email}\n\n"
        f"📝 Messaggio:\n{message}"
    )
           
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": int(chat_id),
        "text": text
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            if res_data.get('ok'):
                return jsonify({"success": True})
            else:
                return jsonify({"error": "Errore API Telegram."}), 500
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"Telegram HTTP Error: {e.code} - {error_body}")
        return jsonify({"error": f"Errore Telegram: {error_body}"}), 500
    except Exception as e:
        print(f"Telegram Error: {str(e)}")
        return jsonify({"error": str(e)}), 500
