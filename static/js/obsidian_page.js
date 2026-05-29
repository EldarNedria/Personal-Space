document.addEventListener('DOMContentLoaded', () => {

    // --- STATE VARIABLES ---
    let obsidianTodosSha = null;
    let currentEditingNotePath = null;
    let currentEditingNoteSha = null;
    let allVaultNotes = [];

    // --- DOM ELEMENTS ---
    const workspaceContainer = document.getElementById('obsidian-page-workspace');
    const warningContainer = document.getElementById('obsidian-page-config-warning');
    const repoLabel = document.getElementById('obsidian-repo-label');
    
    // Notes list
    const notesList = document.getElementById('obsidian-page-notes-list');
    const newNoteBtn = document.getElementById('obsidian-page-new-note');

    // Editor parts
    const welcomeState = document.getElementById('obsidian-page-welcome');
    const editorContainer = document.getElementById('obsidian-page-editor-container');
    const editorTitle = document.getElementById('obsidian-page-note-title');
    const editorTextarea = document.getElementById('obsidian-page-textarea');
    const previewContainer = document.getElementById('editor-preview-mode');
    const writeModeContainer = document.getElementById('editor-write-mode');
    const btnModeWrite = document.getElementById('btn-mode-write');
    const btnModePreview = document.getElementById('btn-mode-preview');
    const saveBtn = document.getElementById('obsidian-page-save-btn');

    // Files list
    const filesList = document.getElementById('obsidian-page-files-list');
    const uploadZone = document.getElementById('obsidian-page-upload-zone');
    const fileInput = document.getElementById('obsidian-page-file-input');

    // Todos list
    const todoForm = document.getElementById('obsidian-page-todo-form');
    const todoInput = document.getElementById('obsidian-page-todo-input');
    const todoList = document.getElementById('obsidian-page-todo-list');


    // --- 1. CONFIGURATION CHECK ---
    const checkConfig = async () => {
        try {
            const res = await fetch('/dashboard/obsidian/api/config-check');
            const data = await res.json();
            
            if (!data.configured) {
                warningContainer.style.display = 'flex';
                workspaceContainer.style.display = 'none';
                repoLabel.textContent = 'Non configurato';
                return false;
            }
            
            warningContainer.style.display = 'none';
            workspaceContainer.style.display = 'flex';
            repoLabel.textContent = data.repo;
            return true;
        } catch (e) {
            console.error("Errore nel controllo della configurazione:", e);
            repoLabel.textContent = 'Errore di connessione';
            return false;
        }
    };


    // --- 2. NOTES LIST & CRUD ---
    const loadNotes = async () => {
        notesList.innerHTML = '<div class="loader"></div>';
        try {
            const res = await fetch('/dashboard/obsidian/api/notes');
            const data = await res.json();
            
            if (data.error) {
                notesList.innerHTML = `<li style="padding: 10px 15px; color: var(--warning-color); text-align: center; font-size: 0.8rem;">${data.error}</li>`;
                return;
            }
            
            allVaultNotes = data;
            renderNotesList(data);
        } catch (e) {
            console.error("Errore caricamento note:", e);
            notesList.innerHTML = '<li style="padding: 10px 15px; text-align: center; opacity: 0.5; font-size: 0.8rem;">Errore di connessione</li>';
        }
    };

    const renderNotesList = (notes) => {
        notesList.innerHTML = '';
        if (!notes || notes.length === 0) {
            notesList.innerHTML = '<li style="padding: 12px 15px; text-align: center; opacity: 0.5; font-size: 0.8rem; background: transparent; border: none;">Nessuna nota Markdown</li>';
            return;
        }
        
        notes.forEach(note => {
            const li = document.createElement('li');
            li.dataset.path = note.path;
            
            // Highlight if active
            if (currentEditingNotePath === note.path) {
                li.className = 'active';
            }
            
            li.innerHTML = `
                <div class="note-item-info" onclick="openNote('${note.path}')">
                    <i class="fa-regular fa-file-lines"></i>
                    <a href="javascript:void(0)" title="${note.name}">${note.name}</a>
                </div>
                <button type="button" class="btn-delete" onclick="event.stopPropagation(); deleteNote('${note.path}', '${note.sha}')" title="Elimina nota">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            notesList.appendChild(li);
        });
    };

    window.openNote = async (path) => {
        currentEditingNotePath = path;
        currentEditingNoteSha = null;
        
        // UI transitions
        welcomeState.style.display = 'none';
        editorContainer.style.display = 'flex';
        editorTitle.textContent = path.split('/').pop();
        editorTextarea.value = 'Caricamento contenuto nota...';
        
        // Update active class in sidebar
        document.querySelectorAll('#obsidian-page-notes-list li').forEach(li => {
            if (li.dataset.path === path) li.classList.add('active');
            else li.classList.remove('active');
        });

        // Set write mode default
        toggleEditorMode('write');

        try {
            const res = await fetch(`/dashboard/obsidian/api/notes/content?path=${encodeURIComponent(path)}`);
            const data = await res.json();
            
            if (data.error) {
                editorTextarea.value = "Errore nel caricamento della nota: " + data.error;
                return;
            }
            
            editorTextarea.value = data.content;
            currentEditingNoteSha = data.sha;
        } catch (e) {
            console.error(e);
            editorTextarea.value = "Errore di rete durante il recupero del file.";
        }
    };

    window.deleteNote = async (path, sha) => {
        const name = path.split('/').pop();
        if (!confirm(`Sei sicuro di voler eliminare definitivamente la nota "${name}"?`)) return;
        
        try {
            const res = await fetch(`/dashboard/obsidian/api/notes/delete?path=${encodeURIComponent(path)}&sha=${sha}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            
            if (data.error) {
                alert("Errore nell'eliminazione: " + data.error);
                return;
            }
            
            // If the deleted note was open, reset editor view
            if (currentEditingNotePath === path) {
                currentEditingNotePath = null;
                currentEditingNoteSha = null;
                editorContainer.style.display = 'none';
                welcomeState.style.display = 'flex';
            }
            
            loadNotes();
        } catch (e) {
            console.error(e);
        }
    };

    saveBtn.addEventListener('click', async () => {
        if (!currentEditingNotePath) return;
        
        const originalHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';
        saveBtn.disabled = true;
        
        const content = editorTextarea.value;
        
        try {
            const res = await fetch('/dashboard/obsidian/api/notes/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: currentEditingNotePath,
                    content: content,
                    sha: currentEditingNoteSha
                })
            });
            const data = await res.json();
            
            if (data.error) {
                alert("Errore nel salvataggio: " + data.error);
            } else {
                currentEditingNoteSha = data.sha;
                
                // Aggiorna SHA anche nella lista locale (così le cancellazioni repentine funzionano)
                const noteObj = allVaultNotes.find(n => n.path === currentEditingNotePath);
                if (noteObj) noteObj.sha = data.sha;
                
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvato!';
                setTimeout(() => {
                    saveBtn.innerHTML = originalHtml;
                    saveBtn.disabled = false;
                }, 1500);
                return;
            }
        } catch (e) {
            console.error(e);
            alert("Errore di rete durante il salvataggio.");
        }
        
        saveBtn.innerHTML = originalHtml;
        saveBtn.disabled = false;
    });

    newNoteBtn.addEventListener('click', async () => {
        const noteName = prompt("Inserisci il nome della nuova nota (senza estensione .md):");
        if (!noteName) return;
        
        const sanitizedName = noteName.trim().replace(/[/\\?%*:|"<>]/g, '-');
        if (!sanitizedName) return;
        
        const resConfig = await fetch('/dashboard/obsidian/api/config-check');
        const configData = await resConfig.json();
        const prefix = configData.notes_path ? configData.notes_path + '/' : '';
        const fullPath = `${prefix}${sanitizedName}.md`;
        
        const content = `---\ntitle: ${sanitizedName}\ncreated: ${new Date().toISOString()}\n---\n\n# ${sanitizedName}\n\n`;
        
        try {
            const res = await fetch('/dashboard/obsidian/api/notes/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: fullPath,
                    content: content
                })
            });
            const data = await res.json();
            
            if (data.error) {
                alert("Errore durante la creazione: " + data.error);
            } else {
                // Ricarica la lista e apri la nota creata
                await loadNotes();
                openNote(fullPath);
            }
        } catch (e) {
            console.error(e);
        }
    });

    // --- 3. EDITOR MODES (WRITE / PREVIEW) ---
    const toggleEditorMode = (mode) => {
        if (mode === 'preview') {
            btnModeWrite.classList.remove('active');
            btnModePreview.classList.add('active');
            writeModeContainer.style.display = 'none';
            previewContainer.style.display = 'block';
            
            // Render markdown using Marked
            const rawContent = editorTextarea.value;
            if (typeof marked !== 'undefined') {
                previewContainer.innerHTML = marked.parse(rawContent);
            } else {
                previewContainer.textContent = rawContent; // Fallback
            }
        } else {
            btnModePreview.classList.remove('active');
            btnModeWrite.classList.add('active');
            previewContainer.style.display = 'none';
            writeModeContainer.style.display = 'flex';
        }
    };

    btnModeWrite.addEventListener('click', () => toggleEditorMode('write'));
    btnModePreview.addEventListener('click', () => toggleEditorMode('preview'));


    // --- 4. FILES (ATTACHMENTS) LIST & UPLOAD ---
    const loadFiles = async () => {
        filesList.innerHTML = '<div class="loader"></div>';
        try {
            const res = await fetch('/dashboard/obsidian/api/attachments');
            const data = await res.json();
            
            if (data.error) {
                filesList.innerHTML = `<li style="padding: 10px 15px; color: var(--warning-color); text-align: center; font-size: 0.8rem;">${data.error}</li>`;
                return;
            }
            
            renderFilesList(data);
        } catch (e) {
            console.error(e);
            filesList.innerHTML = '<li style="padding: 10px 15px; text-align: center; opacity: 0.5; font-size: 0.8rem;">Errore di connessione</li>';
        }
    };

    const renderFilesList = (files) => {
        filesList.innerHTML = '';
        if (!files || files.length === 0) {
            filesList.innerHTML = '<li style="padding: 12px 15px; text-align: center; opacity: 0.5; font-size: 0.8rem; background: transparent; border: none;">Nessun allegato</li>';
            return;
        }
        
        files.forEach(file => {
            const li = document.createElement('li');
            
            const ext = file.name.split('.').pop().toLowerCase();
            let icon = 'fa-file';
            if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) icon = 'fa-file-image';
            else if (ext === 'pdf') icon = 'fa-file-pdf';
            else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) icon = 'fa-file-word';
            else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) icon = 'fa-file-zipper';
            
            const sizeKb = (file.size / 1024).toFixed(1);
            const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

            li.innerHTML = `
                <div class="file-item-info">
                    <i class="fa-solid ${icon}"></i>
                    <a href="${file.download_url}" target="_blank" title="${file.name} (${sizeStr})">${file.name}</a>
                </div>
                <button type="button" class="btn-delete" onclick="deleteAttachment('${file.path}', '${file.sha}')" title="Elimina file">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            filesList.appendChild(li);
        });
    };

    window.deleteAttachment = async (path, sha) => {
        const name = path.split('/').pop();
        if (!confirm(`Sei sicuro di voler eliminare definitivamente l'allegato "${name}"?`)) return;
        
        try {
            const res = await fetch('/dashboard/obsidian/api/attachments', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, sha })
            });
            const data = await res.json();
            
            if (data.error) {
                alert("Errore nell'eliminazione del file: " + data.error);
                return;
            }
            
            loadFiles();
        } catch (e) {
            console.error(e);
        }
    };

    // Upload handlers
    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());
        
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                uploadFile(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                uploadFile(e.target.files[0]);
            }
        });
    }

    const uploadFile = async (file) => {
        if (file.size > 10 * 1024 * 1024) {
            alert("Il file supera la dimensione massima consentita di 10MB.");
            return;
        }
        
        const dropText = uploadZone.querySelector('p');
        const originalText = dropText.textContent;
        dropText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Caricamento...`;
        uploadZone.style.pointerEvents = 'none';
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Content = reader.result.split(',')[1];
            
            try {
                const res = await fetch('/dashboard/obsidian/api/attachments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        content: base64Content
                    })
                });
                const data = await res.json();
                
                if (data.error) {
                    alert("Errore nel caricamento: " + data.error);
                } else {
                    loadFiles();
                }
            } catch (e) {
                console.error(e);
                alert("Errore di connessione durante l'upload.");
            } finally {
                dropText.textContent = originalText;
                uploadZone.style.pointerEvents = 'auto';
                fileInput.value = '';
            }
        };
    };


    // --- 5. TODOS WORKSPACE CRUD ---
    const loadTodos = async () => {
        todoList.innerHTML = '<div class="loader"></div>';
        try {
            const res = await fetch('/dashboard/obsidian/api/todos');
            const data = await res.json();
            
            if (data.error) {
                todoList.innerHTML = `<li class="todo-item" style="color:var(--warning-color); justify-content:center;">${data.error}</li>`;
                return;
            }
            
            obsidianTodosSha = data.sha;
            renderTodosList(data.todos);
        } catch (e) {
            console.error(e);
            todoList.innerHTML = '<li class="todo-item" style="justify-content:center;opacity:0.5;">Errore connessione checklist.</li>';
        }
    };

    const renderTodosList = (todos) => {
        todoList.innerHTML = '';
        if (!todos || todos.length === 0) {
            todoList.innerHTML = '<li class="todo-item" style="justify-content:center;opacity:0.5;font-size:0.8rem;padding:12px;">Nessun todo nel vault</li>';
            return;
        }
        
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.style.padding = '8px 10px';
            li.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <span class="todo-text" style="font-size: 0.85rem;">${todo.text}</span>
                </div>
                <div class="todo-actions">
                    <button type="button" class="btn-check" onclick="toggleTodo(${todo.id}, ${!todo.completed})" title="${todo.completed ? 'Da fare' : 'Completa'}" style="padding: 2px;">
                        <i class="fa-solid ${todo.completed ? 'fa-rotate-left' : 'fa-check'}" style="font-size: 0.75rem;"></i>
                    </button>
                    <button type="button" class="btn-delete" onclick="deleteTodo(${todo.id})" title="Elimina" style="padding: 2px;">
                        <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
                    </button>
                </div>
            `;
            todoList.appendChild(li);
        });
    };

    window.toggleTodo = async (id, completed) => {
        try {
            const res = await fetch(`/dashboard/obsidian/api/todos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed })
            });
            const data = await res.json();
            if (data.error) alert("Errore: " + data.error);
            loadTodos();
        } catch (e) {
            console.error(e);
        }
    };

    window.deleteTodo = async (id) => {
        if (!confirm("Vuoi rimuovere questo Todo?")) return;
        try {
            const res = await fetch(`/dashboard/obsidian/api/todos/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.error) alert("Errore: " + data.error);
            loadTodos();
        } catch (e) {
            console.error(e);
        }
    };

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();
        if (!text) return;
        
        const submitBtn = todoForm.querySelector('button[type="submit"]');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        submitBtn.disabled = true;
        
        try {
            const res = await fetch('/dashboard/obsidian/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (data.error) alert(data.error);
            todoInput.value = '';
            loadTodos();
        } catch (err) {
            console.error(err);
        } finally {
            submitBtn.innerHTML = originalHtml;
            submitBtn.disabled = false;
        }
    });


    // --- 6. INITIALIZE ---
    const init = async () => {
        const isConfigured = await checkConfig();
        if (isConfigured) {
            loadNotes();
            loadFiles();
            loadTodos();
        }
    };

    init();
});
