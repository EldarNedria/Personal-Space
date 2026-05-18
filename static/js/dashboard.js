document.addEventListener('DOMContentLoaded', () => {

    // --- OROLOGIO E DATA ---
    const updateClock = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('it-IT');
        
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        let dateStr = now.toLocaleDateString('it-IT', dateOptions);
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        
        document.getElementById('clock').innerHTML = `
            <div style="font-size: 0.75rem; font-family: var(--font-main); opacity: 0.8; text-transform: capitalize; margin-bottom: 2px;">${dateStr}</div>
            <div style="font-weight: 700;">${timeStr}</div>
        `;
    };
    setInterval(updateClock, 1000);
    updateClock();

    // --- SALUTO INTELLIGENTE ---
    const updateGreeting = () => {
        const hour = new Date().getHours();
        let greeting = 'Benvenuto';
        if (hour >= 5 && hour < 12) greeting = 'Buongiorno';
        else if (hour >= 12 && hour < 18) greeting = 'Buon pomeriggio';
        else if (hour >= 18 && hour < 22) greeting = 'Buonasera';
        else greeting = 'Buonanotte';
        
        document.getElementById('greeting').textContent = `${greeting}, Eldar!`;
    };
    updateGreeting();

    // --- CITAZIONE DEL GIORNO ---
    const loadQuote = async () => {
        try {
            const res = await fetch('https://dummyjson.com/quotes/random');
            const data = await res.json();
            document.getElementById('quote').textContent = `"${data.quote}" - ${data.author}`;
        } catch(e) {
            document.getElementById('quote').textContent = '"Il codice è come l\'umorismo. Se devi spiegarlo, è pessimo." - Cory House';
        }
    };
    loadQuote();

    // --- CHART.JS ISTANZA ---
    let tasksChart;

    // --- TODO LIST (GOOGLE TASKS AJAX) ---
    const todoList = document.getElementById('todo-list');
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');

    const loadTodos = async () => {
        try {
            const res = await fetch('/dashboard/api/tasks');
            const data = await res.json();
            
            if (data.error) {
                todoList.innerHTML = `<li class="todo-item" style="color:var(--warning-color); justify-content:center;">${data.error}</li>`;
                return;
            }
            
            renderTodos(data);
            updateChart(data);
        } catch (e) {
            console.error('Errore caricamento tasks:', e);
            todoList.innerHTML = '<li>Errore di connessione</li>';
        }
    };

    const toggleTaskFormBtn = document.getElementById('toggle-task-form-btn');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');

    toggleTaskFormBtn.addEventListener('click', () => {
        todoForm.style.display = 'flex';
        toggleTaskFormBtn.style.display = 'none';
        todoInput.focus();
    });

    const closeTaskForm = () => {
        todoForm.style.display = 'none';
        toggleTaskFormBtn.style.display = 'flex';
        todoForm.reset();
    };

    cancelTaskBtn.addEventListener('click', closeTaskForm);

    const renderTodos = (todos) => {
        todoList.innerHTML = '';
        if (todos.length === 0) {
            todoList.innerHTML = '<li class="todo-item" style="justify-content:center;opacity:0.5;">Nessun task presente.</li>';
            return;
        }
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            
            let extraHtml = '';
            if (todo.notes || todo.due) {
                extraHtml = '<div style="font-size: 0.8rem; opacity: 0.7; margin-top: 5px; display: flex; flex-direction: column; gap: 3px;">';
                if (todo.due) {
                    const d = new Date(todo.due);
                    extraHtml += `<span><i class="fa-regular fa-calendar"></i> Scadenza: ${d.toLocaleDateString('it-IT')}</span>`;
                }
                if (todo.notes) {
                    extraHtml += `<span><i class="fa-solid fa-align-left"></i> ${todo.notes}</span>`;
                }
                extraHtml += '</div>';
            }

            li.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <span class="todo-text">${todo.text}</span>
                    ${extraHtml}
                </div>
                <div class="todo-actions">
                    <button class="btn-check" onclick="toggleTodo('${todo.id}', ${!todo.completed})" title="${todo.completed ? 'Da fare' : 'Completa'}">
                        <i class="fa-solid ${todo.completed ? 'fa-rotate-left' : 'fa-check'}"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteTodo('${todo.id}')" title="Elimina">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            todoList.appendChild(li);
        });
    };

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();
        const notes = document.getElementById('todo-notes').value.trim();
        const due = document.getElementById('todo-due').value;
        if (!text) return;

        // Mostra loader temp
        const submitBtn = document.getElementById('save-task-btn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            await fetch('/dashboard/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, notes, due })
            });
            closeTaskForm();
            loadTodos();
        } catch (e) { 
            console.error(e); 
        } finally {
            submitBtn.innerHTML = originalBtnHtml;
        }
    });

    window.toggleTodo = async (id, completed) => {
        try {
            await fetch(`/dashboard/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed })
            });
            loadTodos();
        } catch (e) { console.error(e); }
    };

    window.deleteTodo = async (id) => {
        try {
            await fetch(`/dashboard/api/tasks/${id}`, {
                method: 'DELETE'
            });
            loadTodos();
        } catch (e) { console.error(e); }
    };

    // --- CHART.JS ---
    const updateChart = (todos) => {
        const completed = todos.filter(t => t.completed).length;
        const pending = todos.length - completed;

        const ctx = document.getElementById('tasksChart').getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f8fafc' : '#657b83';

        if (tasksChart) {
            tasksChart.data.datasets[0].data = [completed, pending];
            tasksChart.update();
        } else {
            tasksChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Completati', 'Da Fare'],
                    datasets: [{
                        data: [completed, pending],
                        backgroundColor: ['#10b981', '#ef4444'], // Verde e Rosso
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: textColor, font: { family: 'Inter', size: 14 } }
                        }
                    },
                    cutout: '70%'
                }
            });
        }
    };

    // Reagisci al cambio tema
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        setTimeout(() => {
            if (tasksChart) {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                tasksChart.options.plugins.legend.labels.color = isDark ? '#f8fafc' : '#657b83';
                tasksChart.update();
            }
        }, 50);
    });

    // --- WEATHER WIDGET (Open-Meteo) ---
    const getWeatherCategory = (code, isDay = 1) => {
        const sunMoonIcon = isDay ? 'fa-sun' : 'fa-moon';
        const nameClear = isDay ? 'Sole' : 'Sereno';

        if (code <= 1) return { name: nameClear, icon: sunMoonIcon };
        if (code <= 3 || (code >= 45 && code <= 48)) return { name: 'Nuvole', icon: 'fa-cloud' };
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { name: 'Pioggia', icon: 'fa-cloud-rain' };
        if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { name: 'Neve', icon: 'fa-snowflake' };
        if (code >= 95) return { name: 'Temporale', icon: 'fa-cloud-bolt' };
        return { name: 'Sconosciuto', icon: 'fa-circle-question' };
    };

    const loadWeather = async (lat = 43.9618, lon = 12.7363) => {
        const content = document.getElementById('weather-content');
        try {
            // Chiamata arricchita con i dati orari e is_day
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&hourly=weather_code,precipitation_probability,is_day&timezone=auto`);
            const data = await res.json();

            const temp = Math.round(data.current.temperature_2m);
            const currentCode = data.current.weather_code;
            const isDay = data.current.is_day; // 1 = giorno, 0 = notte

            // Interpretazione WMO per l'icona principale
            let mainIcon = isDay ? 'fa-sun' : 'fa-moon';
            let color = isDay ? 'var(--warning-color)' : '#94a3b8'; // Giallo di giorno, grigio/bluastro di notte
            
            if (currentCode >= 1 && currentCode <= 3) { mainIcon = isDay ? 'fa-cloud-sun' : 'fa-cloud-moon'; }
            if (currentCode >= 45 && currentCode <= 48) { mainIcon = 'fa-smog'; color = '#94a3b8'; }
            if (currentCode >= 51 && currentCode <= 67) { mainIcon = 'fa-cloud-rain'; color = '#60a5fa'; }
            if (currentCode >= 71 && currentCode <= 77) { mainIcon = 'fa-snowflake'; color = '#e0f2fe'; }
            if (currentCode >= 80 && currentCode <= 82) { mainIcon = 'fa-cloud-showers-heavy'; color = '#3b82f6'; }
            if (currentCode >= 95) { mainIcon = 'fa-cloud-bolt'; color = '#fbbf24'; }

            // Logica Cambiamenti Meteo
            const nowTime = new Date().getTime();
            let currentIndex = 0;
            let minDiff = Infinity;
            
            // Troviamo l'ora attuale nell'array dei dati previsti
            data.hourly.time.forEach((timeStr, idx) => {
                const diff = Math.abs(new Date(timeStr).getTime() - nowTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    currentIndex = idx;
                }
            });

            const currentCategory = getWeatherCategory(currentCode, isDay).name;
            const changes = [];
            let lastCategory = currentCategory;

            // Analizziamo le prossime 24 ore
            for (let i = currentIndex + 1; i < currentIndex + 24 && i < data.hourly.time.length; i++) {
                const hourCode = data.hourly.weather_code[i];
                const hourIsDay = data.hourly.is_day[i];
                const hourCategoryObj = getWeatherCategory(hourCode, hourIsDay);
                
                // Rileviamo se c'è un "cambiamento di categoria" (es. da Sole a Pioggia)
                if (hourCategoryObj.name !== lastCategory) {
                    const hoursAhead = i - currentIndex;
                    const prob = data.hourly.precipitation_probability[i] || 0;
                    
                    changes.push({
                        hours: hoursAhead,
                        name: hourCategoryObj.name,
                        icon: hourCategoryObj.icon,
                        prob: prob
                    });
                    
                    lastCategory = hourCategoryObj.name;
                    // Mostriamo al massimo i prossimi 2 cambiamenti rilevanti
                    if (changes.length >= 2) break;
                }
            }

            // Costruiamo l'HTML dei cambiamenti
            let changesHtml = '';
            if (changes.length > 0) {
                changesHtml = `
                    <div style="margin-top: 15px; font-size: 0.9rem; width: 100%; padding-top: 10px; border-top: 1px solid var(--glass-border);">
                        <div style="font-weight: 600; margin-bottom: 5px; opacity: 0.9;"><i class="fa-solid fa-clock-rotate-left"></i> Cambiamenti in arrivo:</div>
                        <ul style="list-style: none; padding: 0; margin: 0; opacity: 0.8;">
                            ${changes.map(c => `
                                <li style="margin-bottom: 3px; display: flex; align-items: center; gap: 8px;">
                                    <i class="fa-solid ${c.icon}" style="width: 15px; text-align: center;"></i> 
                                    <span>Tra ${c.hours} ${c.hours === 1 ? 'ora' : 'ore'}: <strong>${c.name}</strong> ${c.prob > 20 ? `(${c.prob}%)` : ''}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            } else {
                 changesHtml = `
                    <div style="margin-top: 15px; font-size: 0.9rem; width: 100%; padding-top: 10px; border-top: 1px solid var(--glass-border); opacity: 0.7;">
                        <i class="fa-solid fa-temperature-empty"></i> Il meteo rimarrà stabile (${currentCategory}) nelle prossime 24 ore.
                    </div>
                `;
            }

            content.innerHTML = `
                <div style="display: flex; flex-direction: column; width: 100%;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                        <i class="fa-solid ${mainIcon}" style="font-size: 4rem; color: ${color}; text-shadow: 0 4px 10px rgba(0,0,0,0.1);"></i>
                        <div class="weather-info">
                            <span class="weather-temp">${temp}°C</span>
                            <span style="opacity:0.8; font-weight:600;">Oggi (${currentCategory})</span>
                        </div>
                    </div>
                    ${changesHtml}
                </div>
            `;
        } catch (e) {
            console.error(e);
            content.innerHTML = '<p>Dati meteo non disponibili.</p>';
        }
    };

    // --- GOOGLE CALENDAR (VISUAL GRID) ---
    const calDaysContainer = document.getElementById('cal-days-container');
    const calMonthYear = document.getElementById('cal-month-year');
    const calSelectedDateTitle = document.getElementById('cal-selected-date-title');
    const calSelectedEvents = document.getElementById('cal-selected-events');
    const calendarDayDetails = document.getElementById('calendar-day-details');
    const calendarFormContainer = document.getElementById('calendar-form-container');
    const btnAddEvent = document.getElementById('add-event-btn');
    const btnSaveEvent = document.getElementById('save-event-btn');

    let currentCalDate = new Date();
    let currentCalMonth = currentCalDate.getMonth(); // 0-11
    let currentCalYear = currentCalDate.getFullYear();
    let allMonthEvents = [];

    btnAddEvent.addEventListener('click', () => {
        calendarFormContainer.style.display = calendarFormContainer.style.display === 'none' ? 'flex' : 'none';
    });

    document.getElementById('cal-prev-month').addEventListener('click', () => {
        currentCalMonth--;
        if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; }
        loadCalendarMonth(currentCalYear, currentCalMonth);
    });

    document.getElementById('cal-next-month').addEventListener('click', () => {
        currentCalMonth++;
        if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; }
        loadCalendarMonth(currentCalYear, currentCalMonth);
    });

    const loadCalendarMonth = async (year, month) => {
        const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        calMonthYear.textContent = `${monthNames[month]} ${year}`;
        calDaysContainer.innerHTML = '<div style="grid-column: 1 / -1; margin-top: 20px;"><div class="loader"></div></div>';
        calendarDayDetails.style.display = 'none';

        try {
            const res = await fetch(`/dashboard/api/calendar/events?year=${year}&month=${month+1}`);
            const data = await res.json();
            
            if (data.error) {
                calDaysContainer.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: var(--warning-color); padding: 10px;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p style="font-size: 0.9rem;">${data.error}</p>
                    </div>`;
                return;
            }

            allMonthEvents = data;
            renderCalendarGrid(year, month);
        } catch (e) {
            console.error(e);
            calDaysContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;">Errore.</div>';
        }
    };

    const renderCalendarGrid = (year, month) => {
        calDaysContainer.innerHTML = '';
        const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();
        
        let startDay = firstDay === 0 ? 6 : firstDay - 1; // Sposta inizio a Lunedì (0)
        
        // Giorni mese precedente
        for (let i = startDay - 1; i >= 0; i--) {
            const div = document.createElement('div');
            div.className = 'cal-day other-month';
            div.textContent = prevMonthDays - i;
            calDaysContainer.appendChild(div);
        }

        const today = new Date();

        // Giorni mese corrente
        for (let i = 1; i <= daysInMonth; i++) {
            const div = document.createElement('div');
            div.className = 'cal-day';
            div.textContent = i;
            
            // Check if today
            if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
                div.classList.add('today');
            }

            // Check events
            const dayEvents = allMonthEvents.filter(ev => {
                const evDate = new Date(ev.start);
                return evDate.getFullYear() === year && evDate.getMonth() === month && evDate.getDate() === i;
            });

            if (dayEvents.length > 0) {
                const dot = document.createElement('div');
                dot.className = 'cal-event-dot';
                div.appendChild(dot);
            }

            div.addEventListener('click', () => {
                document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
                div.classList.add('selected');
                showDayEvents(i, month, year, dayEvents);
            });

            calDaysContainer.appendChild(div);
        }

        // Giorni mese successivo (per completare griglia celle)
        let nextMonthDay = 1;
        while (calDaysContainer.children.length % 7 !== 0) {
            const div = document.createElement('div');
            div.className = 'cal-day other-month';
            div.textContent = nextMonthDay++;
            calDaysContainer.appendChild(div);
        }
    };

    const showDayEvents = (day, month, year, events) => {
        calendarDayDetails.style.display = 'block';
        const dateObj = new Date(year, month, day);
        const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        calSelectedDateTitle.textContent = `Eventi del ${dateStr}:`;
        
        // Pre-compila form per aggiungere evento in questo giorno
        const isoDate = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T09:00`;
        document.getElementById('event-start').value = isoDate;
        document.getElementById('event-end').value = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T10:00`;

        if (events.length === 0) {
            calSelectedEvents.innerHTML = '<p style="opacity: 0.6; font-size: 0.9rem;">Nessun evento in programma.</p>';
            return;
        }

        let html = '<ul class="rss-list" style="margin:0; padding:0; list-style:none;">';
        events.forEach(event => {
            const timeStr = new Date(event.start).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
            html += `
                <li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <a href="${event.link}" target="_blank" style="font-weight: 600; text-decoration: none; color: inherit;">${event.title}</a>
                        <span style="font-size: 0.8rem; opacity: 0.7; background: rgba(0,0,0,0.1); padding: 3px 6px; border-radius: 4px;">
                            <i class="fa-regular fa-clock"></i> ${timeStr}
                        </span>
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        calSelectedEvents.innerHTML = html;
    };

    btnSaveEvent.addEventListener('click', async () => {
        const title = document.getElementById('event-title').value;
        const start = document.getElementById('event-start').value;
        const end = document.getElementById('event-end').value;

        if (!title || !start || !end) {
            alert('Compila tutti i campi (Titolo, Inizio, Fine).');
            return;
        }

        btnSaveEvent.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvataggio...';
        btnSaveEvent.disabled = true;

        try {
            const res = await fetch('/dashboard/api/calendar/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, start, end })
            });
            const data = await res.json();
            
            if (data.error) {
                alert('Errore: ' + data.error);
            } else {
                // Svuota form
                document.getElementById('event-title').value = '';
                calendarFormContainer.style.display = 'none';
                
                // Ricarica il mese correntemente visualizzato
                loadCalendarMonth(currentCalYear, currentCalMonth);
            }
        } catch (e) {
            console.error(e);
            alert('Errore di connessione.');
        } finally {
            btnSaveEvent.innerHTML = '<i class="fa-solid fa-check"></i> Salva Evento';
            btnSaveEvent.disabled = false;
        }
    });

    // --- RSS FEED ---
    const rssSelect = document.getElementById('rss-select');
    const rssContent = document.getElementById('rss-content');

    const loadRSS = async (type) => {
        rssContent.innerHTML = '<div class="loader"></div>';
        try {
            const res = await fetch(`/dashboard/api/rss/${type}`);
            const items = await res.json();

            if (items.error) {
                rssContent.innerHTML = `<p style="text-align:center;color:var(--danger-color);">${items.error}</p>`;
                return;
            }

            if (items.length === 0) {
                rssContent.innerHTML = '<p style="text-align:center;">Nessuna notizia trovata.</p>';
                return;
            }

            let html = '<ul class="rss-list">';
            items.forEach(item => {
                // Pulizia base della data
                let dateStr = item.pubDate;
                if (dateStr.includes('+')) dateStr = dateStr.split('+')[0];

                html += `
                    <li>
                        ${item.image ? `<div style="width: 100%; height: 120px; overflow: hidden; border-radius: 8px; margin-bottom: 8px;"><img src="${item.image}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;"></div>` : ''}
                        <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                        <span class="rss-date"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                    </li>
                `;
            });
            html += '</ul>';
            rssContent.innerHTML = html;
        } catch (e) {
            console.error(e);
            rssContent.innerHTML = '<p style="text-align:center;">Errore di connessione al feed.</p>';
        }
    };

    rssSelect.addEventListener('change', (e) => loadRSS(e.target.value));

    // --- SCRATCHPAD ---
    const scratchpad = document.getElementById('scratchpad-text');
    scratchpad.value = localStorage.getItem('scratchpad_notes') || '';
    scratchpad.addEventListener('input', (e) => {
        localStorage.setItem('scratchpad_notes', e.target.value);
    });

    // --- POMODORO TIMER ---
    const pomodoroDisplay = document.getElementById('pomodoro-display');
    const btnStart = document.getElementById('pomodoro-start');
    const btnPause = document.getElementById('pomodoro-pause');
    const btnReset = document.getElementById('pomodoro-reset');
    
    let pomodoroInterval;
    let timeLeft = 25 * 60; // 25 minuti in secondi
    let isRunning = false;

    const updatePomodoroDisplay = () => {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        pomodoroDisplay.textContent = `${m}:${s}`;
    };

    btnStart.addEventListener('click', () => {
        if (isRunning) return;
        isRunning = true;
        pomodoroInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updatePomodoroDisplay();
            } else {
                clearInterval(pomodoroInterval);
                isRunning = false;
                // Suona un campanello
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(e => console.log(e));
                alert("Pomodoro completato! Ottimo lavoro, fai una pausa di 5 minuti.");
            }
        }, 1000);
    });

    btnPause.addEventListener('click', () => {
        clearInterval(pomodoroInterval);
        isRunning = false;
    });

    btnReset.addEventListener('click', () => {
        clearInterval(pomodoroInterval);
        isRunning = false;
        timeLeft = 25 * 60;
        updatePomodoroDisplay();
    });
    
    updatePomodoroDisplay();

    // --- WIDGET PREFERENCES (Dashboard Modulare) ---
    const customizeBtn = document.getElementById('customize-btn');
    const customizePanel = document.getElementById('customize-panel');
    const customizeOverlay = document.getElementById('customize-overlay');
    const customizeClose = document.getElementById('customize-close');
    const widgetTogglesList = document.getElementById('widget-toggles-list');

    const openCustomizePanel = () => {
        customizePanel.classList.add('open');
        customizeOverlay.style.display = 'block';
    };

    const closeCustomizePanel = () => {
        customizePanel.classList.remove('open');
        customizeOverlay.style.display = 'none';
    };

    customizeBtn.addEventListener('click', openCustomizePanel);
    customizeClose.addEventListener('click', closeCustomizePanel);
    customizeOverlay.addEventListener('click', closeCustomizePanel);

    const loadWidgetPreferences = async () => {
        try {
            const res = await fetch('/dashboard/api/widgets/preferences');
            const prefs = await res.json();
            
            // Renderizza i toggle nel pannello
            widgetTogglesList.innerHTML = '';
            prefs.forEach(pref => {
                const item = document.createElement('div');
                item.className = 'widget-toggle-item';
                item.innerHTML = `
                    <div class="widget-toggle-info">
                        <i class="fa-solid ${pref.widget_icon}"></i>
                        <span>${pref.widget_name}</span>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" ${pref.is_enabled ? 'checked' : ''} data-toggle-id="${pref.widget_id}">
                        <span class="toggle-slider"></span>
                    </label>
                `;
                widgetTogglesList.appendChild(item);
                
                // Applica lo stato iniziale al widget
                const widgetEl = document.querySelector(`[data-widget-id="${pref.widget_id}"]`);
                if (widgetEl && !pref.is_enabled) {
                    widgetEl.classList.add('widget-hidden');
                }
            });

            // Aggiungi anche widget che non sono nel DB (come pomodoro, links)
            document.querySelectorAll('.widget[data-widget-id]').forEach(widget => {
                const wid = widget.dataset.widgetId;
                const exists = prefs.find(p => p.widget_id === wid);
                if (!exists) {
                    // Widget non nel DB, aggiungi un toggle locale (sempre visibile)
                    const name = widget.querySelector('h3')?.textContent?.trim() || wid;
                    const item = document.createElement('div');
                    item.className = 'widget-toggle-item';
                    item.innerHTML = `
                        <div class="widget-toggle-info">
                            <i class="fa-solid fa-puzzle-piece"></i>
                            <span>${name}</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" checked data-toggle-id="${wid}" data-local="true">
                            <span class="toggle-slider"></span>
                        </label>
                    `;
                    widgetTogglesList.appendChild(item);
                }
            });

            // Listener per tutti i toggle
            widgetTogglesList.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
                toggle.addEventListener('change', async (e) => {
                    const widgetId = e.target.dataset.toggleId;
                    const isEnabled = e.target.checked;
                    const widgetEl = document.querySelector(`[data-widget-id="${widgetId}"]`);
                    
                    if (widgetEl) {
                        if (isEnabled) {
                            widgetEl.classList.remove('widget-hidden');
                        } else {
                            widgetEl.classList.add('widget-hidden');
                        }
                    }

                    // Salva nel DB (solo per widget registrati)
                    if (!e.target.dataset.local) {
                        await fetch('/dashboard/api/widgets/preferences', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ widget_id: widgetId, is_enabled: isEnabled })
                        });
                    }
                });
            });
        } catch (e) {
            console.error('Errore caricamento preferenze widget:', e);
        }
    };

    // --- YOUTUBE MUSIC ---
    const ytListContainer = document.getElementById('ytmusic-list-container');
    const ytPlayerContainer = document.getElementById('ytmusic-player-container');
    const ytListTitle = document.getElementById('ytmusic-list-title');
    const ytBackBtn = document.getElementById('ytmusic-back-btn');

    let cachedPlaylistsHtml = '';
    let ytPlayer = null;
    let currentTracks = [];
    let currentTrackIndex = -1;

    // Carica YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = function() {
        ytPlayer = new YT.Player('ytplayer-div', {
            height: '100%',
            width: '100%',
            playerVars: {
                'autoplay': 1,
                'controls': 1,
                'disablekb': 1,
                'fs': 0,
                'rel': 0
            },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    };

    function onPlayerStateChange(event) {
        // YT.PlayerState.ENDED == 0
        if (event.data === 0) {
            playNextTrack();
        }
    }

    const playNextTrack = () => {
        if (currentTrackIndex >= 0 && currentTrackIndex < currentTracks.length - 1) {
            playYTTrackIndex(currentTrackIndex + 1);
        }
    };

    const playPrevTrack = () => {
        if (currentTrackIndex > 0) {
            playYTTrackIndex(currentTrackIndex - 1);
        }
    };

    document.getElementById('yt-btn-next')?.addEventListener('click', playNextTrack);
    document.getElementById('yt-btn-prev')?.addEventListener('click', playPrevTrack);

    const playYTTrackIndex = (index) => {
        if (!ytPlayer || typeof ytPlayer.loadVideoById !== 'function') {
            console.log("Player YouTube non ancora pronto");
            return;
        }
        currentTrackIndex = index;
        const track = currentTracks[index];
        
        document.getElementById('ytmusic-placeholder').style.display = 'none';
        document.getElementById('ytplayer-div').style.display = 'block';
        document.getElementById('ytmusic-controls').style.display = 'flex';
        document.getElementById('yt-current-title').textContent = track.title;

        // Highlight active track
        document.querySelectorAll('.yt-track-item').forEach(i => i.style.background = 'rgba(255,255,255,0.03)');
        const activeItem = document.querySelector(`.yt-track-item[data-index="${index}"]`);
        if (activeItem) {
            activeItem.style.background = 'rgba(255,255,255,0.1)';
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        ytPlayer.loadVideoById(track.videoId);
    };

    const loadYTPlaylists = async () => {
        if (!ytListContainer) return;
        ytListTitle.innerHTML = '<i class="fa-solid fa-list-ul"></i> Le tue Playlist';
        ytBackBtn.style.display = 'none';

        if (cachedPlaylistsHtml) {
            ytListContainer.innerHTML = cachedPlaylistsHtml;
            attachPlaylistListeners();
            return;
        }

        try {
            const res = await fetch('/dashboard/music/api/playlists');
            const data = await res.json();
            
            if (data.error) {
                ytListContainer.innerHTML = `<li><div style="color: var(--warning-color); padding: 10px; text-align: center; font-size: 0.9rem;">${data.error}</div></li>`;
                return;
            }

            if (!data || data.length === 0) {
                ytListContainer.innerHTML = `<li><div style="opacity: 0.6; padding: 10px; text-align: center; font-size: 0.9rem;">Nessuna playlist trovata.</div></li>`;
                return;
            }

            let html = '';
            data.forEach(pl => {
                const thumb = pl.thumbnails && pl.thumbnails.length > 0 ? pl.thumbnails[0].url : '';
                const thumbHtml = thumb ? `<img src="${thumb}" alt="thumb" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 6px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-music"></i></div>`;
                
                html += `
                    <li style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; cursor: pointer; transition: background 0.2s;" class="yt-playlist-item" data-id="${pl.playlistId}" data-title="${pl.title}">
                        ${thumbHtml}
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pl.title}</div>
                            <div style="font-size: 0.75rem; opacity: 0.6;">${pl.count || ''}</div>
                        </div>
                        <i class="fa-solid fa-chevron-right" style="opacity: 0.5; font-size: 0.8rem;"></i>
                    </li>
                `;
            });
            cachedPlaylistsHtml = html;
            ytListContainer.innerHTML = html;
            attachPlaylistListeners();

        } catch (e) {
            console.error('Errore YTMusic:', e);
            ytListContainer.innerHTML = `<li><div style="color: var(--danger-color); padding: 10px; text-align: center; font-size: 0.9rem;">Errore di caricamento.</div></li>`;
        }
    };

    const attachPlaylistListeners = () => {
        document.querySelectorAll('.yt-playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                let playlistId = item.dataset.id;
                let title = item.dataset.title;
                if (playlistId.startsWith('VL')) playlistId = playlistId.substring(2);
                loadYTPlaylistTracks(playlistId, title);
            });
        });
    };

    const loadYTPlaylistTracks = async (playlistId, title) => {
        ytListTitle.innerHTML = `<i class="fa-solid fa-music"></i> ${title}`;
        ytBackBtn.style.display = 'block';
        ytListContainer.innerHTML = '<div class="loader"></div>';

        try {
            const res = await fetch(`/dashboard/music/api/playlist/${playlistId}`);
            const data = await res.json();

            if (data.error) {
                ytListContainer.innerHTML = `<li><div style="color: var(--warning-color); padding: 10px; text-align: center; font-size: 0.9rem;">${data.error}</div></li>`;
                return;
            }

            const tracks = data.tracks || [];
            if (tracks.length === 0) {
                ytListContainer.innerHTML = `<li><div style="opacity: 0.6; padding: 10px; text-align: center; font-size: 0.9rem;">Nessun brano trovato.</div></li>`;
                return;
            }

            currentTracks = tracks;
            currentTrackIndex = -1;

            let html = '';
            tracks.forEach((tr, index) => {
                const thumb = tr.thumbnails && tr.thumbnails.length > 0 ? tr.thumbnails[0].url : '';
                const thumbHtml = thumb ? `<img src="${thumb}" alt="thumb" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 6px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-play"></i></div>`;
                const artists = tr.artists ? tr.artists.map(a => a.name).join(', ') : '';
                
                html += `
                    <li style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; cursor: pointer; transition: background 0.2s;" class="yt-track-item" data-id="${tr.videoId}" data-index="${index}">
                        ${thumbHtml}
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tr.title}</div>
                            <div style="font-size: 0.75rem; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${artists}</div>
                        </div>
                        <i class="fa-solid fa-play" style="opacity: 0.5; font-size: 0.8rem;"></i>
                    </li>
                `;
            });
            ytListContainer.innerHTML = html;

            document.querySelectorAll('.yt-track-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index);
                    playYTTrackIndex(index);
                });
            });

        } catch(e) {
            console.error(e);
            ytListContainer.innerHTML = `<li><div style="color: var(--danger-color); padding: 10px; text-align: center; font-size: 0.9rem;">Errore caricamento brani.</div></li>`;
        }
    };

    if(ytBackBtn) {
        ytBackBtn.addEventListener('click', () => {
            loadYTPlaylists();
        });
    }

    // INIZIALIZZAZIONE GLOBALE
    loadWidgetPreferences();
    loadTodos();
    loadYTPlaylists();
    loadCalendarMonth(currentCalYear, currentCalMonth);
    
    // Geolocalizzazione per il meteo
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => loadWeather(position.coords.latitude, position.coords.longitude),
            (error) => {
                console.warn("Geolocalizzazione non permessa o fallita. Uso le coordinate di default.");
                loadWeather();
            }
        );
    } else {
        loadWeather();
    }
    
    loadRSS(rssSelect.value);
});

