import bcrypt
import getpass

def main():
    print("\n--- Generatore di Hash per la Dashboard ---")
    print("Questo script genera un hash sicuro per la tua password.")
    password = getpass.getpass("Inserisci la password da usare per il login: ")
    
    # Genera il salt e l'hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    print("\nEcco il tuo hash. Copialo e incollalo nel file .env (o nelle variabili d'ambiente di Render):")
    print("-" * 50)
    print(f"ADMIN_PASSWORD_HASH={hashed.decode('utf-8')}")
    print("-" * 50)
    print("\nATTENZIONE: non condividere mai questo hash e NON committarlo su GitHub in file di configurazione pubblici!")

if __name__ == "__main__":
    main()
