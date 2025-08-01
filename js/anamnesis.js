// === ANAMNESIS.JS - GESTIONE ANAMNESI E IMMAGINI ===

// === GESTIONE ANAMNESI ===
async function saveAnamnesi() {
    if (!currentClient) {
        showMessage('Errore: cliente non caricato', 'error');
        return;
    }

    try {
        const riquadri = document.querySelectorAll('.anamnesi-riquadro');
        const updates = [];

        for (let i = 0; i < riquadri.length; i++) {
            const riquadro = riquadri[i];
            const id = riquadro.getAttribute('data-id');
            const titolo = riquadro.querySelector('.riquadro-title').value.trim();
            const contenuto = riquadro.querySelector('.riquadro-content').value.trim();

            if (titolo) {
                const endpoint = id && id !== 'null' ? 
                    `/anamnesis/${id}` : 
                    `/clients/${currentClient.id}/anamnesis`;
                    
                const method = id && id !== 'null' ? 'PUT' : 'POST';
                
                updates.push(apiCall(endpoint, {
                    method,
                    body: JSON.stringify({ titolo, contenuto, ordine: i })
                }));
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            showMessage('Anamnesi salvata con successo!', 'success');
            
            const anamnesisData = await apiCall(`/clients/${currentClient.id}/anamnesis`);
            displayAnamnesi(anamnesisData);
        } else {
            showMessage('Nessuna modifica da salvare', 'info');
        }
        
    } catch (error) {
        console.error('❌ Errore nel salvataggio dell\'anamnesi:', error);
        showMessage('Errore nel salvataggio dell\'anamnesi: ' + error.message, 'error');
    }

    displayAnamnesi()
}

async function addNewRiquadro() {
    const container = document.getElementById('anamnesi-riquadri');
    if (!container) {
        console.error('❌ Container anamnesi non trovato');
        return;
    }
    
    const riquadroCount = container.querySelectorAll('.anamnesi-riquadro').length;
    
    const newRiquadro = document.createElement('div');
    newRiquadro.className = 'anamnesi-riquadro';
    newRiquadro.innerHTML = `
        <div class="riquadro-header">
            <input type="text" class="riquadro-title" placeholder="Titolo del riquadro" value="Nuovo Riquadro ${riquadroCount + 1}">
                <button class="btn btn-danger" onclick="this.closest('.anamnesi-riquadro').remove()" style="padding: 8px 12px; margin-left: 10px;">
                    🗑️
                </button>
        </div>
        <textarea class="riquadro-content" placeholder="Inserisci qui le informazioni..." rows="4"></textarea>
    `;
    container.appendChild(newRiquadro);
}

async function removeRiquadro(riquadroId) {
    if (confirm('Sei sicuro di voler eliminare questo riquadro?')) {
        try {
            await apiCall(`/anamnesis/${riquadroId}`, { method: 'DELETE' });
            const riquadroElement = document.querySelector(`[data-id="${riquadroId}"]`);
            if (riquadroElement) {
                riquadroElement.remove();
            }
            showMessage('Riquadro eliminato', 'success');
        } catch (error) {
            showMessage('Errore nell\'eliminazione del riquadro', 'error');
        }
    }
}

function displayAnamnesi(anamnesis) {
    const container = document.getElementById('anamnesi-riquadri');
    if (!container) return;
    
    if (anamnesis.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; margin: 20px 0;">Nessun riquadro anamnesi. Inizia aggiungendone uno!</p>';
        return;
    }

    container.innerHTML = anamnesis.map(riquadro => `
        <div class="anamnesi-riquadro" data-id="${riquadro.id}">
            <div class="riquadro-header">
                <input type="text" class="riquadro-title" value="${riquadro.titolo}" placeholder="Titolo del riquadro">
                <div class="riquadro-actions">
                    <button class="btn btn-small" onclick="showImageUpload(${riquadro.id})" title="Aggiungi immagini">
                        📷 <span class="image-count" id="img-count-${riquadro.id}">0</span>
                    </button>
                    <button class="btn btn-danger btn-small" onclick="removeRiquadro(${riquadro.id})">
                        🗑️
                    </button>
                </div>
            </div>
            <textarea class="riquadro-content" placeholder="Inserisci qui le informazioni...">${riquadro.contenuto || ''}</textarea>
            <div class="riquadro-images" id="images-${riquadro.id}">
                <!-- Le immagini verranno caricate qui -->
            </div>
        </div>
    `).join('');
    
    // Carica le immagini per ogni riquadro
    anamnesis.forEach(riquadro => {
        loadRiquadroImages(riquadro.id);
    });
}

// Mostra dialog per upload immagini
function showImageUpload(riquadroId) {
    // Controlla se è un riquadro nuovo non salvato
    if (riquadroId && riquadroId.toString().startsWith('new-')) {
        showMessage('⚠️ Salva prima il riquadro per aggiungere immagini', 'warning');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'image-upload-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>📷 Gestione Immagini</h3>
                <button class="modal-close" onclick="this.closest('.image-upload-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="upload-area" id="upload-area-${riquadroId}">
                    <input type="file" id="file-input-${riquadroId}" multiple accept="image/*" style="display: none;" 
                           onchange="handleImageSelect(event, ${riquadroId})">
                    <div class="upload-placeholder" onclick="document.getElementById('file-input-${riquadroId}').click()">
                        <div style="font-size: 3em; margin-bottom: 10px;">📸</div>
                        <p>Clicca per selezionare immagini</p>
                        <p style="font-size: 0.9em; color: #666;">Formati supportati: JPG, PNG, GIF (max 5MB per immagine)</p>
                    </div>
                </div>
                <div id="preview-area-${riquadroId}" class="image-preview-grid">
                    <!-- Anteprime immagini -->
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="uploadImages(${riquadroId})">
                        💾 Salva Immagini
                    </button>
                    <button class="btn" onclick="this.closest('.image-upload-modal').remove()">
                        Annulla
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Carica immagini esistenti
    loadImagesForUploadModal(riquadroId);
}
// Gestisci selezione immagini
let selectedImages = {};

function handleImageSelect(event, riquadroId) {
    const files = event.target.files;
    const previewArea = document.getElementById(`preview-area-${riquadroId}`);
    
    if (!selectedImages[riquadroId]) {
        selectedImages[riquadroId] = [];
    }
    
    Array.from(files).forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
            showMessage('⚠️ Immagine troppo grande! Max 5MB', 'warning');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = {
                nome: file.name,
                tipo: file.type,
                dimensione: Math.round(file.size / 1024),
                base64: e.target.result,
                isNew: true
            };
            
            selectedImages[riquadroId].push(imageData);
            
            // Aggiungi anteprima
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}">
                <div class="image-info">
                    <span class="image-name">${file.name}</span>
                    <span class="image-size">${imageData.dimensione}KB</span>
                </div>
                <button class="remove-image" onclick="removeSelectedImage(${riquadroId}, ${selectedImages[riquadroId].length - 1})">
                    ×
                </button>
            `;
            previewArea.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });
}
// Carica immagini esistenti nel modal
async function loadImagesForUploadModal(riquadroId) {
    try {
        const images = await apiCall(`/anamnesis/${riquadroId}/images`);
        const previewArea = document.getElementById(`preview-area-${riquadroId}`);
        
        if (!selectedImages[riquadroId]) {
            selectedImages[riquadroId] = [];
        }
        
        images.forEach((image, index) => {
            selectedImages[riquadroId].push({
                id: image.id,
                nome: image.nome_file,
                tipo: image.tipo_mime,
                dimensione: image.dimensione_kb,
                base64: image.immagine_base64,
                isNew: false
            });
            
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${image.immagine_base64}" alt="${image.nome_file}">
                <div class="image-info">
                    <span class="image-name">${image.nome_file}</span>
                    <span class="image-size">${image.dimensione_kb}KB</span>
                </div>
                <button class="remove-image" onclick="removeSelectedImage(${riquadroId}, ${index})">
                    ×
                </button>
            `;
            previewArea.appendChild(preview);
        });
    } catch (error) {
        console.error('Errore caricamento immagini:', error);
    }
}

// Rimuovi immagine selezionata
function removeSelectedImage(riquadroId, index) {
    const image = selectedImages[riquadroId][index];
    
    if (!image.isNew && image.id) {
        // Se è un'immagine esistente, segna per eliminazione
        image.toDelete = true;
    } else {
        // Se è nuova, rimuovi dall'array
        selectedImages[riquadroId].splice(index, 1);
    }
    
    // Ricarica preview
    const previewArea = document.getElementById(`preview-area-${riquadroId}`);
    previewArea.innerHTML = '';
    
    selectedImages[riquadroId].forEach((img, idx) => {
        if (!img.toDelete) {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${img.base64}" alt="${img.nome}">
                <div class="image-info">
                    <span class="image-name">${img.nome}</span>
                    <span class="image-size">${img.dimensione}KB</span>
                </div>
                <button class="remove-image" onclick="removeSelectedImage(${riquadroId}, ${idx})">
                    ×
                </button>
            `;
            previewArea.appendChild(preview);
        }
    });
}

const style = document.createElement('style');
style.textContent = `
    .compressed-badge {
        display: inline-block;
        background: #28a745;
        color: white;
        font-size: 0.7em;
        padding: 2px 6px;
        border-radius: 3px;
        margin-left: 5px;
    }
`;
document.head.appendChild(style);

// Upload immagini
async function uploadImages(riquadroId) {
    const images = selectedImages[riquadroId] || [];
    
    try {
        showMessage('⏳ Salvataggio immagini...', 'info');
        
        // Elimina immagini marcate per eliminazione
        for (const img of images) {
            if (img.toDelete && img.id) {
                await apiCall(`/anamnesis/images/${img.id}`, { method: 'DELETE' });
            }
        }
        
        // Carica nuove immagini
        for (const img of images) {
            if (img.isNew && !img.toDelete) {
                await apiCall(`/anamnesis/${riquadroId}/images`, {
                    method: 'POST',
                    body: JSON.stringify({
                        nome_file: img.nome,
                        tipo_mime: img.tipo,
                        dimensione_kb: img.dimensione,
                        immagine_base64: img.base64
                    })
                });
            }
        }
        
        showMessage('✅ Immagini salvate con successo!', 'success');
        
        // Chiudi modal e ricarica
        document.querySelector('.image-upload-modal').remove();
        loadRiquadroImages(riquadroId);
        
        // Reset
        selectedImages[riquadroId] = [];
        
    } catch (error) {
        console.error('Errore upload immagini:', error);
        showMessage('❌ Errore nel salvataggio delle immagini', 'error');
    }

}

// Carica immagini di un riquadro
async function loadRiquadroImages(riquadroId) {
    try {
        const images = await apiCall(`/anamnesis/${riquadroId}/images`);
        const container = document.getElementById(`images-${riquadroId}`);
        const countBadge = document.getElementById(`img-count-${riquadroId}`);
        
        if (countBadge) {
            countBadge.textContent = images.length;
        }
        
        if (container && images.length > 0) {
            container.innerHTML = `
                <div class="riquadro-images-grid">
                    ${images.map(img => `
                        <div class="riquadro-image-thumb" onclick="showImageFullscreen('${img.immagine_base64}', '${img.nome_file}')">
                            <img src="${img.immagine_base64}" alt="${img.nome_file}" title="${img.nome_file}">
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        console.error('Errore caricamento immagini riquadro:', error);
    }
}

// Mostra immagine a schermo intero
function showImageFullscreen(base64, nome) {
    const modal = document.createElement('div');
    modal.className = 'fullscreen-image-modal';
    modal.innerHTML = `
        <div class="fullscreen-image-container">
            <button class="fullscreen-close" onclick="this.closest('.fullscreen-image-modal').remove()">×</button>
            <img src="${base64}" alt="${nome}">
            <div class="fullscreen-caption">${nome}</div>
        </div>
    `;
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
    document.body.appendChild(modal);
}

// Funzione per comprimere l'immagine
function compressImage(base64String, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calcola nuove dimensioni mantenendo l'aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Disegna immagine ridimensionata
            ctx.drawImage(img, 0, 0, width, height);
            
            // Comprimi e converti in base64
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = base64String;
    });
}