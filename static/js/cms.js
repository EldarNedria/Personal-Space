document.addEventListener('DOMContentLoaded', () => {
    const btnNew = document.getElementById('btn-new-article');
    const btnCancel = document.getElementById('btn-cancel');
    const btnSave = document.getElementById('btn-save');
    
    const articlesView = document.getElementById('articles-view');
    const editorView = document.getElementById('editor-view');
    
    const inputId = document.getElementById('article-id');
    const inputTitle = document.getElementById('article-title');
    const inputExcerpt = document.getElementById('article-excerpt');
    const inputContent = document.getElementById('article-content');
    const inputPublished = document.getElementById('article-published');
    
    const editorTitle = document.getElementById('editor-title');

    // Mostra l'editor e nasconde la lista
    const showEditor = (isNew = true) => {
        articlesView.style.display = 'none';
        editorView.style.display = 'flex';
        btnNew.style.display = 'none';
        
        if (isNew) {
            editorTitle.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Nuovo Articolo';
            inputId.value = '';
            inputTitle.value = '';
            inputExcerpt.value = '';
            inputContent.value = '';
            inputPublished.checked = false;
        } else {
            editorTitle.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Modifica Articolo';
        }
    };

    // Nasconde l'editor e mostra la lista
    const hideEditor = () => {
        articlesView.style.display = 'block';
        editorView.style.display = 'none';
        btnNew.style.display = 'block';
    };

    btnNew.addEventListener('click', () => showEditor(true));
    btnCancel.addEventListener('click', hideEditor);

    // Salvataggio (Crea o Aggiorna)
    btnSave.addEventListener('click', async () => {
        const title = inputTitle.value.trim();
        const excerpt = inputExcerpt.value.trim();
        const content = inputContent.value.trim();
        const is_published = inputPublished.checked;
        const id = inputId.value;
        
        if (!title || !content) {
            alert('Titolo e contenuto sono obbligatori.');
            return;
        }
        
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';
        btnSave.disabled = true;
        
        const payload = { title, excerpt, content, is_published };
        const url = id ? `/dashboard/cms/api/articles/${id}` : '/dashboard/cms/api/articles';
        const method = id ? 'PUT' : 'POST';
        
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (data.error) {
                alert('Errore: ' + data.error);
            } else {
                window.location.reload(); // Ricarica per mostrare la lista aggiornata
            }
        } catch (e) {
            console.error(e);
            alert('Errore di connessione al server.');
        } finally {
            btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Salva Articolo';
            btnSave.disabled = false;
        }
    });

    // Funzioni globali per i bottoni nella lista
    window.editArticle = async (id) => {
        try {
            const res = await fetch(`/dashboard/cms/api/articles/${id}`);
            const data = await res.json();
            
            if (data.error) {
                alert(data.error);
                return;
            }
            
            inputId.value = data.id;
            inputTitle.value = data.title;
            inputExcerpt.value = data.excerpt;
            inputContent.value = data.content;
            inputPublished.checked = data.is_published === 1;
            
            showEditor(false);
        } catch (e) {
            console.error(e);
            alert('Errore caricamento articolo.');
        }
    };

    window.deleteArticle = async (id) => {
        if (!confirm('Sei sicuro di voler eliminare questo articolo? Questa azione non può essere annullata.')) {
            return;
        }
        
        try {
            const res = await fetch(`/dashboard/cms/api/articles/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert('Errore: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            alert('Errore durante l\'eliminazione.');
        }
    };
});
