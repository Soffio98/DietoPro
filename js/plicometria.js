// Mostra form plicometria
function showPlicometriaForm() {
    const form = document.getElementById('plicometria-form');
    const display = document.getElementById('plicometria-display');
    
    if (form && display) {
        form.classList.remove('hidden');
        form.style.display = 'block'; // Forza la visualizzazione
        display.style.display = 'none';
        
        // Imposta data odierna
        document.getElementById('plico-data').value = new Date().toISOString().split('T')[0];
        
        // Focus sul primo campo
        setTimeout(() => {
            document.getElementById('plico-tricipite').focus();
        }, 100);
    } else {
        console.error('Form o display plicometria non trovato');
    }
}


// Nascondi form plicometria
function hidePlicometriaForm() {
    const form = document.getElementById('plicometria-form');
    const display = document.getElementById('plicometria-display');
    
    if (form) {
        form.classList.add('hidden');
        display.style.display = 'block';
        document.getElementById('formPlicometria').reset();
    }
}

// Salva misurazione plicometrica
async function savePlicometria(event) {
    event.preventDefault();
    
    if (!currentClient) {
        showMessage('Errore: cliente non caricato', 'error');
        return;
    }
    
    const formData = {
        data_misurazione: document.getElementById('plico-data').value,
        tricipite: parseFloat(document.getElementById('plico-tricipite').value) || null,
        addome: parseFloat(document.getElementById('plico-addome').value) || null,
        soprailiaca: parseFloat(document.getElementById('plico-soprailiaca').value) || null,
        sottoscapolare: parseFloat(document.getElementById('plico-sottoscapolare').value) || null,
        ascellare: parseFloat(document.getElementById('plico-ascellare').value) || null,
        pettorale: parseFloat(document.getElementById('plico-pettorale').value) || null,
        coscia: parseFloat(document.getElementById('plico-coscia').value) || null,
        peso: parseFloat(document.getElementById('plico-peso').value) || null,
        note: document.getElementById('plico-note').value.trim() || null
    };
    
    // Calcola BMI se c'è il peso
    if (formData.peso && currentClient.altezza) {
        const altezzaM = currentClient.altezza / 100;
        formData.bmi = Math.round((formData.peso / (altezzaM * altezzaM)) * 10) / 10;
    }
    
    // Verifica che almeno una misurazione sia stata inserita
    const hasValues = Object.keys(formData).some(key => 
        key !== 'data_misurazione' && key !== 'note' && formData[key] !== null
    );
    
    if (!hasValues) {
        showMessage('Inserisci almeno una misurazione', 'warning');
        return;
    }
    
    try {
        // Salva plicometria
        await apiCall(`/clients/${currentClient.id}/plicometria`, {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        // Se c'è il peso, aggiorna anche la tabella pesi

        
        showMessage('✅ Misurazione salvata con successo!', 'success');
        hidePlicometriaForm();
        
        // Forza il ricaricamento dell'ultima misurazione
        setTimeout(() => {
            loadUltimaPlicometria();
        }, 100);
        
    } catch (error) {
        console.error('Errore salvataggio plicometria:', error);
        showMessage('Errore nel salvataggio', 'error');
    }
}

// Carica ultima misurazione
async function loadUltimaPlicometria() {
    if (!currentClient) return;
    
    try {
        const misurazioni = await apiCall(`/clients/${currentClient.id}/plicometria?limit=1`);
        const container = document.getElementById('ultima-plicometria');
        
        if (!container) return;
        
        if (!misurazioni || misurazioni.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Nessuna misurazione registrata</p>';
            return;
        }
        
        const ultima = misurazioni[0];
        const valori = [
            { label: 'Tricipite', value: ultima.tricipite, icon: '💪' },
            { label: 'Addome', value: ultima.addome, icon: '🔲' },
            { label: 'Soprailiaca', value: ultima.soprailiaca, icon: '📐' },
            { label: 'Sottoscapolare', value: ultima.sottoscapolare, icon: '🔻' },
            { label: 'Ascellare', value: ultima.ascellare, icon: '📍' },
            { label: 'Pettorale', value: ultima.pettorale, icon: '🎯' },
            { label: 'Coscia', value: ultima.coscia, icon: '🦵' },
            { label: 'Peso', value: ultima.peso, icon: '⚖️', unit: 'kg' },
            { label: 'BMI', value: ultima.bmi, icon: '📊', unit: '' }
        ].filter(item => item.value !== null);
        
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <span style="color: #6c757d; font-size: 0.9em;">
                    Ultima misurazione: ${formatDate(ultima.data_misurazione)}
                </span>
            </div>
            <div class="plico-results">
                ${valori.map(item => `
                    <div class="plico-result-item">
                        <div class="plico-icon">${item.icon}</div>
                        <div class="plico-result-value">${item.value}</div>
                        <div class="plico-result-label">${item.label}${item.unit !== undefined ? (item.unit ? ` (${item.unit})` : '') : ' (mm)'}</div>
                    </div>
                `).join('')}
            </div>
            ${ultima.percentuale_grasso ? `
                <div class="body-fat-display">
                    <div class="body-fat-label">Grasso Corporeo Stimato</div>
                    <div class="body-fat-value">${ultima.percentuale_grasso}%</div>
                </div>
            ` : ''}
            ${ultima.note ? `
                <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong>Note:</strong> ${ultima.note}
                </div>
            ` : ''}
        `;
        
        // Mostra di nuovo il display
        const display = document.getElementById('plicometria-display');
        if (display) {
            display.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Errore caricamento plicometria:', error);
        const container = document.getElementById('ultima-plicometria');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #dc3545;">Errore nel caricamento dei dati</p>';
        }
    }
}

// Mostra storico misurazioni
async function showPlicometriaHistory() {
    if (!currentClient) return;
    
    try {
        const misurazioni = await apiCall(`/clients/${currentClient.id}/plicometria`);
        
        const modal = document.createElement('div');
        modal.className = 'history-modal';
        modal.innerHTML = `
            <div class="history-content">
                <h3>📊 Storico Misurazioni Plicometriche</h3>
                <button class="modal-close" onclick="this.closest('.history-modal').remove()" 
                        style="position: absolute; top: 20px; right: 20px;">×</button>
                
                ${misurazioni.length === 0 ? 
                    '<p style="text-align: center; color: #999; margin: 40px 0;">Nessuna misurazione registrata</p>' :
                    `<table class="history-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tricipite</th>
                                <th>Addome</th>
                                <th>Soprailiaca</th>
                                <th>Sottoscapolare</th>
                                <th>Ascellare</th>
                                <th>Pettorale</th>
                                <th>Coscia</th>
                                <th>% Grasso</th>
                                <th>Peso</th>
                                <th>BMI</th>
                                <th>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${misurazioni.map(m => `
                                <tr>
                                    <td>${formatDate(m.data_misurazione)}</td>
                                    <td>${m.tricipite || '-'}</td>
                                    <td>${m.addome || '-'}</td>
                                    <td>${m.soprailiaca || '-'}</td>
                                    <td>${m.sottoscapolare || '-'}</td>
                                    <td>${m.ascellare || '-'}</td>
                                    <td>${m.pettorale || '-'}</td>
                                    <td>${m.coscia || '-'}</td>
                                    <td>${m.percentuale_grasso ? m.percentuale_grasso + '%' : '-'}</td>
                                    <td>${m.peso || '-'}</td>
                                    <td>${m.bmi || '-'}</td>            
                                    <td class="actions">
                                        <button class="btn btn-small btn-danger" 
                                                onclick="deletePlicometria(${m.id})">
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`
                }
                
                <div style="text-align: center; margin-top: 30px;">
                    <button class="btn btn-primary" onclick="exportPlicometriaCSV()">
                        📥 Esporta CSV
                    </button>
                    <button class="btn" onclick="this.closest('.history-modal').remove()">
                        Chiudi
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Errore caricamento storico:', error);
        showMessage('Errore nel caricamento dello storico', 'error');
    }
}
// Elimina misurazione
async function deletePlicometria(id) {
    if (!confirm('Eliminare questa misurazione?')) return;
    
    try {
        await apiCall(`/plicometria/${id}`, { method: 'DELETE' });
        showMessage('Misurazione eliminata', 'success');
        
        // Ricarica storico e ultima misurazione
        document.querySelector('.history-modal').remove();
        showPlicometriaHistory();
        loadUltimaPlicometria();
        
    } catch (error) {
        console.error('Errore eliminazione:', error);
        showMessage('Errore nell\'eliminazione', 'error');
    }
}

// Esporta CSV
function exportPlicometriaCSV() {
    // Implementazione export CSV
    showMessage('Export CSV in sviluppo', 'info');
}

// Mostra modal progressi (che include peso e plicometria)
function showProgressModal() {
    // TODO: Implementare modal unificato per progressi peso + plicometria
    showMessage('Modal progressi completo in sviluppo', 'info');
}