// === DIETS.JS - GESTIONE DIETE ===

// === GESTIONE DIETE ===
function toggleNewDietForm() {
    const form = document.getElementById('new-diet-form');
    form.classList.toggle('hidden-section');
    
    if (!form.classList.contains('hidden-section')) {
        // Pre-compila con dati del cliente
        if (currentClient) {
            document.getElementById('diet-peso-iniziale').value = currentClient.peso;
            document.getElementById('diet-data-inizio').value = new Date().toISOString().split('T')[0];
        }
    } else {
        document.getElementById('dietForm').reset();
    }
}

async function loadClientDiets(clientId) {
    try {
        const diets = await apiCall(`/clients/${clientId}/diets`);
        currentDiets = diets;
        displayDiets(diets);
        updateCurrentWeight();
        
    } catch (error) {
        console.error('❌ Errore caricamento diete:', error);
        const container = document.getElementById('diets-list');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Errore nel caricamento delle diete.</p>';
        }
    }
}

async function handleNewDiet(event) {
    event.preventDefault();
    
    if (!currentClient) return;
    
    const formData = {
        titolo: document.getElementById('diet-titolo').value.trim(),
        descrizione: document.getElementById('diet-descrizione').value.trim(),
        peso_iniziale: parseFloat(document.getElementById('diet-peso-iniziale').value),
        peso_obiettivo: parseFloat(document.getElementById('diet-peso-obiettivo').value) || null,
        altezza: currentClient.altezza,
        data_inizio: document.getElementById('diet-data-inizio').value,
        data_fine: document.getElementById('diet-data-fine').value || null,
        durata_mesi: parseInt(document.getElementById('diet-durata').value) || 3,
        note_generali: document.getElementById('diet-note').value.trim() || null
    };

    try {
        await apiCall(`/clients/${currentClient.id}/diets`, {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        showMessage('Dieta creata con successo!', 'success');
        toggleNewDietForm();
        await loadClientDetail(currentClient.id);
        
    } catch (error) {
        showMessage('Errore nella creazione della dieta', 'error');
    }
}

async function deleteDiet(dietId) {
    if (confirm('Sei sicuro di voler eliminare questa dieta? Questa azione non può essere annullata.')) {
        try {
            await apiCall(`/diets/${dietId}`, { method: 'DELETE' });
            showMessage('Dieta eliminata con successo', 'success');
            
            if (currentClient) {
                loadClientDiets(currentClient.id);
            }
        } catch (error) {
            showMessage('Errore nell\'eliminazione della dieta', 'error');
        }
    }
}

// === DISPLAY DIETE ===
function displayDiets(diets) {
    const container = document.getElementById('diets-list');
    if (!container) {
        console.error('❌ Container diets-list non trovato');
        return;
    }
    
    if (diets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Nessuna dieta trovata. Crea la prima dieta per questo cliente!</p>';
        return;
    }

    container.innerHTML = diets.map(diet => createDietCard(diet)).join('');
}

function createDietCard(diet) {
    return `
        <div class="diet-card ${diet.stato}" data-diet-id="${diet.id}">
            <div class="diet-header">
                <h4 class="diet-title">${diet.titolo}</h4>
                <span class="diet-status status-${diet.stato}">${diet.stato}</span>
            </div>
            
            <div class="diet-stats">
                ${createDietStats(diet)}
            </div>

            ${diet.descrizione ? `<p style="margin: 10px 0; color: #666;"><strong>Descrizione:</strong> ${diet.descrizione}</p>` : ''}
            
            <div class="diet-actions">
                ${createDietActions(diet.id)}
            </div>
        </div>
    `;
}

function createDietStats(diet) {
    const stats = [
        { label: 'Peso Iniziale', value: `${diet.peso_iniziale} kg` },
        { label: 'Peso Attuale', value: `${diet.peso_attuale || diet.peso_iniziale} kg` },
        { label: 'Obiettivo', value: `${diet.peso_obiettivo || '--'} kg` },
        { label: 'BMI Attuale', value: diet.bmi_attuale },
        { label: 'Progresso', value: `${diet.peso_perso > 0 ? '-' : ''}${Math.abs(diet.peso_perso).toFixed(1)} kg`, class: diet.peso_perso > 0 ? 'text-success' : '' },
        { label: 'Durata', value: `${diet.giorni_dieta} giorni` }
    ];

    return stats.map(stat => `
        <div class="diet-stat">
            <div class="diet-stat-label">${stat.label}</div>
            <div class="diet-stat-value ${stat.class || ''}">${stat.value}</div>
        </div>
    `).join('');
}

function createDietActions(dietId) {
    const actions = [
        { text: '📅 Pianifica Settimana', onclick: `openWeeklyPlanner(${dietId})`, class: 'btn-primary' },
        { text: '📄 Esporta PDF', onclick: `exportDietPDF(${dietId})`, class: 'btn' },
        { text: '🗑️ Elimina', onclick: `deleteDiet(${dietId})`, class: 'btn-danger' }
    ];

    return `
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; justify-content: flex-start;">
            ${actions.map(action => `
                <button class="btn ${action.class}" onclick="${action.onclick}" 
                        style="font-size: 16px; padding: 8px 12px; white-space: nowrap; flex: 0 0 auto;">
                    ${action.text}
                </button>
            `).join('')}
        </div>
        
    `;
    
}