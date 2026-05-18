import os
import yaml
from flask import Flask
from dotenv import load_dotenv

# Carica le variabili d'ambiente da .env per lo sviluppo locale
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configurazione sicura
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-dev-key')
    app.config['ADMIN_PASSWORD_HASH'] = os.environ.get('ADMIN_PASSWORD_HASH')
    
    # Carica la configurazione YAML
    with open('config.yaml', 'r', encoding='utf-8') as f:
        app.config['APP_CONFIG'] = yaml.safe_load(f)

    # Assicurati che la cartella data esista
    os.makedirs('data', exist_ok=True)
    
    # Inizializza il database
    from database import init_db
    init_db(app)
    
    # Registra i Blueprint
    from routes.portfolio import portfolio_bp
    from routes.auth import auth_bp
    from routes.dashboard import dashboard_bp
    from routes.cms import cms_bp
    from routes.music import music_bp
    
    app.register_blueprint(portfolio_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
    app.register_blueprint(cms_bp, url_prefix='/dashboard/cms')
    app.register_blueprint(music_bp, url_prefix='/dashboard/music')
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
