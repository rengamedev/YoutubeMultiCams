document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');
    const btnGenerate = document.getElementById('btn-generate');
    const inputRows = document.getElementById('input-rows');
    const inputCols = document.getElementById('input-cols');
    const toggleHeader = document.getElementById('toggle-header');
    const header = document.getElementById('main-header');
    const iconCollapse = document.getElementById('icon-collapse');
    
    // Profiles UI
    const profileSelect = document.getElementById('profile-select');
    const btnSaveProfile = document.getElementById('btn-save-profile');
    const btnDeleteProfile = document.getElementById('btn-delete-profile');
    const btnTogglePlay = document.getElementById('btn-toggle-play');
    const btnExport = document.getElementById('btn-export');
    const btnImport = document.getElementById('btn-import');
    const importFile = document.getElementById('import-file');

    const youtubeIcon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon-placeholder"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>`;

    const iconPause = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    const iconPlay = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

    // --- Global Play/Pause ---
    let isGlobalPlaying = true;
    if (btnTogglePlay) {
        btnTogglePlay.addEventListener('click', () => {
            isGlobalPlaying = !isGlobalPlaying;
            const command = isGlobalPlaying ? 'playVideo' : 'pauseVideo';
            
            document.querySelectorAll('iframe').forEach(iframe => {
                iframe.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: command,
                    args: []
                }), '*');
            });
            
            btnTogglePlay.innerHTML = isGlobalPlaying ? iconPause : iconPlay;
            btnTogglePlay.title = isGlobalPlaying ? "Пауза всем видео" : "Воспроизвести все видео";
        });
    }

    // --- Global Message Listener for YouTube ---
    window.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'infoDelivery' && data.info) {
                const iframes = Array.from(document.querySelectorAll('iframe'));
                const matchedIframe = iframes.find(f => f.contentWindow === event.source);
                if (matchedIframe) {
                    const cell = matchedIframe.closest('.grid-cell');
                    if (cell) {
                        const index = parseInt(cell.dataset.index);
                        const cellState = state.cells[index];
                        if (cellState && data.info.volume !== undefined && data.info.muted !== undefined) {
                            let changed = false;
                            if (cellState.volume !== data.info.volume) {
                                cellState.volume = data.info.volume;
                                changed = true;
                            }
                            if (cellState.muted !== data.info.muted) {
                                cellState.muted = data.info.muted;
                                changed = true;
                            }
                            if (changed) {
                                saveToLocalStorage();
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Ignore non-JSON messages
        }
    });

    setInterval(() => {
        document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
            }
        });
    }, 2000);

    // --- State & Profiles Management ---
    let profiles = JSON.parse(localStorage.getItem('multicam_profiles')) || {
        'default': { name: 'Текущая (Автосохранение)', rows: 2, cols: 2, cells: [] }
    };
    let currentProfileId = localStorage.getItem('multicam_current_profile') || 'default';
    let urlHistory = JSON.parse(localStorage.getItem('multicam_url_history')) || [];
    
    // Migrate legacy string history to objects
    urlHistory = urlHistory.map(item => {
        return typeof item === 'string' ? { url: item, title: item } : item;
    });
    
    if (!profiles[currentProfileId]) {
        currentProfileId = 'default';
    }
    if (!profiles['default']) {
        profiles['default'] = { name: 'Текущая (Автосохранение)', rows: 2, cols: 2, cells: [] };
    }

    let state = profiles[currentProfileId];
    
    inputRows.value = state.rows;
    inputCols.value = state.cols;

    function saveToLocalStorage() {
        profiles[currentProfileId] = state;
        localStorage.setItem('multicam_profiles', JSON.stringify(profiles));
        localStorage.setItem('multicam_current_profile', currentProfileId);
    }

    function renderProfilesList() {
        profileSelect.innerHTML = '';
        for (const [id, prof] of Object.entries(profiles)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = prof.name;
            if (id === currentProfileId) opt.selected = true;
            profileSelect.appendChild(opt);
        }
        btnDeleteProfile.style.display = currentProfileId === 'default' ? 'none' : 'flex';
    }

    profileSelect.addEventListener('change', (e) => {
        currentProfileId = e.target.value;
        state = profiles[currentProfileId];
        inputRows.value = state.rows;
        inputCols.value = state.cols;
        saveToLocalStorage();
        createGrid();
        renderProfilesList();
    });

    btnSaveProfile.addEventListener('click', () => {
        const title = prompt("Введите имя для новой конфигурации:", "Новый профиль");
        if (title && title.trim()) {
            const newId = 'prof_' + Date.now();
            currentProfileId = newId;
            state = {
                name: title.trim(),
                rows: state.rows,
                cols: state.cols,
                cells: JSON.parse(JSON.stringify(state.cells))
            };
            profiles[newId] = state;
            saveToLocalStorage();
            renderProfilesList();
        }
    });

    btnDeleteProfile.addEventListener('click', () => {
        if (currentProfileId === 'default') return;
        if (confirm(`Удалить профиль "${state.name}"?`)) {
            delete profiles[currentProfileId];
            currentProfileId = 'default';
            state = profiles['default'];
            inputRows.value = state.rows;
            inputCols.value = state.cols;
            saveToLocalStorage();
            createGrid();
            renderProfilesList();
        }
    });

    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const dataToExport = {
                profiles: profiles,
                currentProfileId: currentProfileId,
                urlHistory: urlHistory
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "multicam_settings.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    if (btnImport) {
        btnImport.addEventListener('click', () => {
            importFile.click();
        });
    }

    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (importedData.profiles) {
                        profiles = importedData.profiles;
                        localStorage.setItem('multicam_profiles', JSON.stringify(profiles));
                    }
                    if (importedData.currentProfileId && profiles[importedData.currentProfileId]) {
                        currentProfileId = importedData.currentProfileId;
                        localStorage.setItem('multicam_current_profile', currentProfileId);
                    } else if (profiles['default']) {
                        currentProfileId = 'default';
                        localStorage.setItem('multicam_current_profile', currentProfileId);
                    }
                    if (importedData.urlHistory && Array.isArray(importedData.urlHistory)) {
                        urlHistory = importedData.urlHistory;
                        localStorage.setItem('multicam_url_history', JSON.stringify(urlHistory));
                    }
                    
                    state = profiles[currentProfileId];
                    inputRows.value = state.rows;
                    inputCols.value = state.cols;
                    
                    renderProfilesList();
                    createGrid();
                    updateAllHistoryDropdowns();
                    
                    alert("Настройки успешно загружены!");
                } catch (error) {
                    alert("Ошибка при чтении файла настроек. Убедитесь, что это правильный JSON.");
                    console.error(error);
                }
                importFile.value = '';
            };
            reader.readAsText(file);
        });
    }

    // --- History Helper ---
    function updateAllHistoryDropdowns() {
        document.querySelectorAll('.setup-overlay').forEach(overlay => {
            let select = overlay.querySelector('.history-select');
            if (urlHistory.length > 0) {
                if (!select) {
                    select = document.createElement('select');
                    select.className = 'history-select';
                    select.addEventListener('change', (e) => {
                        const input = overlay.querySelector('.url-input');
                        input.value = e.target.value;
                        const btn = overlay.querySelector('.btn-load');
                        if (btn) btn.click(); // Autoload video on select
                    });
                    const btn = overlay.querySelector('.btn-load');
                    overlay.insertBefore(select, btn);
                }
                
                select.innerHTML = `
                    <option value="" disabled selected>Или выберите из истории...</option>
                    ${urlHistory.map(item => {
                        const maxLen = 70;
                        const displayTitle = item.title.length > maxLen ? item.title.substring(0, maxLen) + '...' : item.title;
                        return `<option value="${item.url}">${displayTitle}</option>`;
                    }).join('')}
                `;
                select.value = "";
            }
        });
    }

    // --- Drag and drop state ---
    let draggedCellIndex = null;

    function getYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function createGrid() {
        let newRows = Math.max(1, Math.min(8, parseInt(inputRows.value) || 2));
        let newCols = Math.max(1, Math.min(8, parseInt(inputCols.value) || 2));
        
        inputRows.value = newRows;
        inputCols.value = newCols;

        state.rows = newRows;
        state.cols = newCols;

        gridContainer.style.gridTemplateRows = `repeat(${state.rows}, 1fr)`;
        gridContainer.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
        gridContainer.innerHTML = '';

        const newCells = [];

        for (let i = 0; i < state.rows * state.cols; i++) {
            const cellState = state.cells[i] || { url: null };
            newCells.push(cellState);
            
            const cell = createCell(i, cellState);
            gridContainer.appendChild(cell);
        }
        
        state.cells = newCells;
        saveToLocalStorage();
    }

    function createCell(index, cellState) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.id = `cell-${index}`;
        cell.dataset.index = index;

        // Drag and Drop event listeners on the drop target (the cell)
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('dragenter', handleDragEnter);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('drop', handleDrop);

        if (cellState.url) {
            loadVideo(cell, cellState, cellState.url);
        } else {
            renderSetup(cell, cellState, index);
        }

        return cell;
    }

    function handleDragStart(e, originalIndex) {
        draggedCellIndex = originalIndex;
        document.body.classList.add('is-dragging');
        setTimeout(() => {
            const el = document.getElementById(`cell-${originalIndex}`);
            if(el) el.classList.add('dragging');
        }, 0);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', originalIndex);
    }
    
    function handleDragEnd(e) {
        document.body.classList.remove('is-dragging');
        const cells = document.querySelectorAll('.grid-cell');
        cells.forEach(c => {
            c.classList.remove('dragging');
            c.classList.remove('drag-over');
        });
        draggedCellIndex = null;
    }

    function handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        const targetCell = e.target.closest('.grid-cell');
        if (targetCell && targetCell.dataset.index != draggedCellIndex) {
            targetCell.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        const targetCell = e.target.closest('.grid-cell');
        if (targetCell) {
            targetCell.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();
        const targetCell = e.target.closest('.grid-cell');
        if (!targetCell) return false;
        
        const targetIndex = parseInt(targetCell.dataset.index);
        
        if (draggedCellIndex !== null && draggedCellIndex !== targetIndex) {
            const temp = state.cells[draggedCellIndex];
            state.cells[draggedCellIndex] = state.cells[targetIndex];
            state.cells[targetIndex] = temp;
            
            saveToLocalStorage();
            createGrid();
        }
        
        document.body.classList.remove('is-dragging');
        return false;
    }

    function renderSetup(cell, cellState, index) {
        cellState.url = null;
        cell.classList.remove('has-video');
        
        cell.setAttribute('draggable', 'true');
        cell.addEventListener('dragstart', (e) => handleDragStart(e, index));
        cell.addEventListener('dragend', handleDragEnd);

        cell.innerHTML = `
            <div class="setup-overlay">
                ${youtubeIcon}
                <input type="text" placeholder="Ссылка на YouTube (Video / Live)..." class="url-input" />
                <button class="primary-btn btn-load">Загрузить</button>
            </div>
        `;

        updateAllHistoryDropdowns();

        const btnLoad = cell.querySelector('.btn-load');
        const urlInput = cell.querySelector('.url-input');

        const saveUrl = () => {
            const url = urlInput.value.trim();
            if (url) {
                const newCell = cell.cloneNode(false);
                cell.parentNode.replaceChild(newCell, cell);
                
                newCell.addEventListener('dragover', handleDragOver);
                newCell.addEventListener('dragenter', handleDragEnter);
                newCell.addEventListener('dragleave', handleDragLeave);
                newCell.addEventListener('drop', handleDrop);

                loadVideo(newCell, cellState, url);
            }
        };

        btnLoad.addEventListener('click', saveUrl);
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveUrl();
        });
        saveToLocalStorage();
    }

    function loadVideo(cell, cellState, url) {
        const videoId = getYouTubeId(url);
        if (!videoId) {
            alert('Неверный формат ссылки. Пожалуйста, проверьте ссылку на YouTube.');
            cellState.url = null;
            renderSetup(cell, cellState, parseInt(cell.dataset.index));
            return;
        }

        // Add to global URL history (unique, chronologically newest first)
        let existingItem = urlHistory.find(u => u.url === url);
        let title = existingItem && existingItem.title ? existingItem.title : url;
        
        let newItem = { url: url, title: title };
        
        urlHistory = urlHistory.filter(u => u.url !== url);
        urlHistory.unshift(newItem);
        if (urlHistory.length > 50) urlHistory.pop();
        
        localStorage.setItem('multicam_url_history', JSON.stringify(urlHistory));
        updateAllHistoryDropdowns();

        // Fetch title in background
        if (!existingItem || existingItem.title === url) {
            const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
            fetch(`https://noembed.com/embed?url=${encodeURIComponent(canonicalUrl)}`)
                .then(r => r.json())
                .then(data => {
                    if (data && data.title) {
                        const item = urlHistory.find(u => u.url === url);
                        if (item) {
                            item.title = data.title;
                            localStorage.setItem('multicam_url_history', JSON.stringify(urlHistory));
                            updateAllHistoryDropdowns();
                        }
                    }
                })
                .catch(e => console.error('Failed to fetch video title:', e));
        }

        cellState.url = url; 
        cell.classList.add('has-video');

        const isMuted = cellState.muted !== false; // defaults to true
        const currentOrigin = encodeURIComponent(window.location.origin || '*');
        cell.innerHTML = `
            <iframe 
                src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${isMuted ? '1' : '0'}&enablejsapi=1&origin=${currentOrigin}" 
                title="YouTube live player" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin">
            </iframe>
            <div class="cell-controls">
                <button class="btn-icon-inside btn-mute" title="Включить/выключить звук">
                    ${isMuted
                        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
                        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`}
                </button>
                <button class="btn-icon-inside btn-fullscreen" title="На весь экран">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                </button>
                <button class="btn-icon-inside btn-copy" title="Копировать ссылку">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <div class="btn-icon-inside btn-move" title="Переместить (Перетащите для обмена позициями)" draggable="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="2" x2="12" y2="22"></line>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <polyline points="8 6 12 2 16 6"></polyline>
                        <polyline points="8 18 12 22 16 18"></polyline>
                        <polyline points="6 8 2 12 6 16"></polyline>
                        <polyline points="18 8 22 12 18 16"></polyline>
                    </svg>
                </div>
                <button class="btn-icon-inside btn-edit" title="Изменить ссылку">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-icon-inside btn-danger-inside btn-remove" title="Удалить">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;

        const iframe = cell.querySelector('iframe');
        iframe.addEventListener('load', () => {
            let attempts = 0;
            const initInterval = setInterval(() => {
                if (cellState.volume !== undefined) {
                    iframe.contentWindow.postMessage(JSON.stringify({
                        event: 'command',
                        func: 'setVolume',
                        args: [cellState.volume]
                    }), '*');
                }
                
                if (cellState.muted === false) {
                    iframe.contentWindow.postMessage(JSON.stringify({
                        event: 'command',
                        func: 'unMute',
                        args: []
                    }), '*');
                } else if (cellState.muted === true) {
                    iframe.contentWindow.postMessage(JSON.stringify({
                        event: 'command',
                        func: 'mute',
                        args: []
                    }), '*');
                }
                
                attempts++;
                if (attempts >= 5) clearInterval(initInterval);
            }, 1000);
        });

        const index = parseInt(cell.dataset.index);

        const btnMute = cell.querySelector('.btn-mute');
        btnMute.addEventListener('click', () => {
            const shouldMute = cellState.muted === false;
            cellState.muted = shouldMute;
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: shouldMute ? 'mute' : 'unMute',
                args: []
            }), '*');
            btnMute.innerHTML = shouldMute
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
            saveToLocalStorage();
        });

        const btnFullscreen = cell.querySelector('.btn-fullscreen');
        btnFullscreen.addEventListener('click', () => {
            const target = iframe;
            const requestFs = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;
            if (requestFs) {
                requestFs.call(target).catch(err => {
                    // Fallback: fullscreen the cell instead
                    const cellFs = cell.requestFullscreen || cell.webkitRequestFullscreen || cell.mozRequestFullScreen || cell.msRequestFullscreen;
                    if (cellFs) cellFs.call(cell);
                });
            }
        });
        
        const btnCopy = cell.querySelector('.btn-copy');
        btnCopy.addEventListener('click', () => {
            navigator.clipboard.writeText(url).then(() => {
                const originalSvg = btnCopy.innerHTML;
                btnCopy.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => btnCopy.innerHTML = originalSvg, 1500);
            }).catch(console.error);
        });

        const moveHandle = cell.querySelector('.btn-move');
        moveHandle.addEventListener('dragstart', (e) => handleDragStart(e, index));
        moveHandle.addEventListener('dragend', handleDragEnd);

        const btnEdit = cell.querySelector('.btn-edit');
        const btnRemove = cell.querySelector('.btn-remove');

        btnEdit.addEventListener('click', () => {
            renderSetup(cell, cellState, index);
        });

        btnRemove.addEventListener('click', () => {
            renderSetup(cell, cellState, index);
        });
        
        saveToLocalStorage();
    }

    btnGenerate.addEventListener('click', createGrid);

    let isHeaderVisible = true;
    toggleHeader.addEventListener('click', () => {
        isHeaderVisible = !isHeaderVisible;
        if (isHeaderVisible) {
            header.classList.remove('collapsed');
            iconCollapse.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
            toggleHeader.setAttribute('title', 'Скрыть меню');
        } else {
            header.classList.add('collapsed');
            iconCollapse.innerHTML = '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>';
            toggleHeader.setAttribute('title', 'Показать меню');
        }
    });

    [inputRows, inputCols].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createGrid();
        });
    });

    // Initial state setup
    renderProfilesList();
    createGrid();
});
