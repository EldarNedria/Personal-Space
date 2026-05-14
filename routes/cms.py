from flask import Blueprint, jsonify, request, render_template
from routes.dashboard import login_required
from database import get_db

cms_bp = Blueprint('cms', __name__)

@cms_bp.route('/', methods=['GET'])
@login_required
def cms_index():
    """Pagina principale del CMS per la gestione degli articoli."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, title, created_at, is_published FROM articles ORDER BY created_at DESC")
    articles = cursor.fetchall()
    return render_template('dashboard/cms.html', articles=articles)

@cms_bp.route('/api/articles', methods=['GET'])
@login_required
def get_articles():
    """API: Restituisce tutti gli articoli."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM articles ORDER BY created_at DESC")
    articles = [dict(row) for row in cursor.fetchall()]
    return jsonify(articles)

@cms_bp.route('/api/articles/<int:id>', methods=['GET'])
@login_required
def get_article(id):
    """API: Restituisce un singolo articolo."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM articles WHERE id = ?", (id,))
    article = cursor.fetchone()
    if article:
        return jsonify(dict(article))
    return jsonify({"error": "Articolo non trovato"}), 404

@cms_bp.route('/api/articles', methods=['POST'])
@login_required
def create_article():
    """API: Crea un nuovo articolo."""
    data = request.json
    title = data.get('title', '').strip()
    excerpt = data.get('excerpt', '').strip()
    content = data.get('content', '').strip()
    is_published = data.get('is_published', False)
    
    if not title or not content:
        return jsonify({"error": "Titolo e contenuto sono obbligatori"}), 400
        
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "INSERT INTO articles (title, excerpt, content, is_published) VALUES (?, ?, ?, ?)",
            (title, excerpt, content, 1 if is_published else 0)
        )
        db.commit()
        new_id = cursor.lastrowid
        return jsonify({"id": new_id, "success": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cms_bp.route('/api/articles/<int:id>', methods=['PUT'])
@login_required
def update_article(id):
    """API: Aggiorna un articolo esistente."""
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("SELECT * FROM articles WHERE id = ?", (id,))
    article = cursor.fetchone()
    if not article:
        return jsonify({"error": "Articolo non trovato"}), 404
        
    title = data.get('title', article['title']).strip()
    excerpt = data.get('excerpt', article['excerpt']).strip()
    content = data.get('content', article['content']).strip()
    
    # is_published parsing safely
    if 'is_published' in data:
        is_published = 1 if data['is_published'] else 0
    else:
        is_published = article['is_published']
        
    try:
        cursor.execute(
            "UPDATE articles SET title = ?, excerpt = ?, content = ?, is_published = ? WHERE id = ?",
            (title, excerpt, content, is_published, id)
        )
        db.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cms_bp.route('/api/articles/<int:id>', methods=['DELETE'])
@login_required
def delete_article(id):
    """API: Elimina un articolo."""
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM articles WHERE id = ?", (id,))
        db.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
