from flask import Blueprint, jsonify, current_app, session
import os
from functools import wraps

music_bp = Blueprint('music', __name__)

# Re-use the login_required decorator from dashboard or auth, 
# or just redefine it here for simplicity
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

# Lazy initialization of YTMusic to avoid blocking startup
_ytmusic_instance = None

def get_ytmusic():
    global _ytmusic_instance
    if _ytmusic_instance is None:
        try:
            from ytmusicapi import YTMusic
            if os.path.exists('secrets/browser.json'):
                _ytmusic_instance = YTMusic('secrets/browser.json')
            else:
                return None
        except Exception as e:
            print(f"YTMusic init error: {e}")
            return None
    return _ytmusic_instance

@music_bp.route('/api/playlists', methods=['GET'])
@login_required
def get_playlists():
    yt = get_ytmusic()
    if not yt:
        return jsonify({"error": "YouTube Music non configurato (secrets/browser.json mancante)."}), 404
        
    try:
        # Fetch library playlists (limit to 10 for the widget)
        playlists = yt.get_library_playlists(limit=10)
        return jsonify(playlists)
    except Exception as e:
        return jsonify({"error": f"Errore YTMusic API: {str(e)}"}), 500

@music_bp.route('/api/playlist/<playlist_id>', methods=['GET'])
@login_required
def get_playlist(playlist_id):
    yt = get_ytmusic()
    if not yt:
        return jsonify({"error": "YouTube Music non configurato."}), 404
        
    try:
        playlist = yt.get_playlist(playlist_id, limit=50)
        return jsonify(playlist)
    except Exception as e:
        return jsonify({"error": f"Errore caricamento playlist: {str(e)}"}), 500

@music_bp.route('/api/search/<query>', methods=['GET'])
@login_required
def search_music(query):
    yt = get_ytmusic()
    if not yt:
        return jsonify({"error": "YouTube Music non configurato."}), 404
        
    try:
        results = yt.search(query, filter="songs", limit=5)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": f"Errore ricerca: {str(e)}"}), 500
