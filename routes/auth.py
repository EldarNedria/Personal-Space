import bcrypt
from flask import Blueprint, render_template, request, redirect, url_for, session, current_app, flash

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if 'logged_in' in session:
        return redirect(url_for('dashboard.index'))
        
    if request.method == 'POST':
        password = request.form.get('password')
        stored_hash = current_app.config.get('ADMIN_PASSWORD_HASH')
        
        if not stored_hash:
            flash("Errore di configurazione server: hash password mancante.", "error")
            return render_template('portfolio/login.html')
            
        try:
            # checkpw richiede che entrambe le stringhe siano in bytes
            if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
                session['logged_in'] = True
                return redirect(url_for('dashboard.index'))
            else:
                flash("Password errata.", "error")
        except ValueError:
            flash("Errore nel formato dell'hash della password.", "error")
            
    return render_template('portfolio/login.html')

@auth_bp.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('portfolio.index'))
