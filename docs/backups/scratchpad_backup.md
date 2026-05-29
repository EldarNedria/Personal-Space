# Backup: Scratchpad Widget ("Appunti Rapidi")

This file contains the original code segments for the client-side `localStorage` based Scratchpad widget, archived before removing it in favor of the Obsidian Vault cloud-synced notes integration.

## Database Preference (Default Row)
```python
('scratchpad', 'Scratchpad', 'fa-note-sticky', 1, 0, 4, 1, 3)
```

## HTML Markup
Defined in `templates/dashboard/index.html`:
```html
<!-- Appunti Rapidi (Scratchpad) -->
<div class="widget glass-panel" id="scratchpad-widget" data-widget-id="scratchpad">
    <h3><i class="fa-solid fa-pen-to-square"></i> Appunti Rapidi</h3>
    <textarea id="scratchpad-text"
        placeholder="Scrivi qui i tuoi appunti... Verranno salvati in automatico nel tuo browser!"></textarea>
</div>
```

## CSS Styling
Defined in `static/css/dashboard.css`:
```css
/* Scratchpad */
#scratchpad-text {
    flex: 1;
    resize: none;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    padding: 15px;
    color: var(--text-color);
    font-family: inherit;
    outline: none;
    line-height: 1.5;
    transition: var(--transition);
    min-height: 150px;
}
[data-theme="light"] #scratchpad-text { background: rgba(0,0,0,0.05); }
#scratchpad-text:focus { border-color: var(--primary-color); }
```

## JavaScript Logic
Defined in `static/js/dashboard.js`:
```javascript
// --- SCRATCHPAD ---
const scratchpad = document.getElementById('scratchpad-text');
if (scratchpad) {
    scratchpad.value = localStorage.getItem('scratchpad_notes') || '';
    scratchpad.addEventListener('input', (e) => {
        localStorage.setItem('scratchpad_notes', e.target.value);
    });
}
```
