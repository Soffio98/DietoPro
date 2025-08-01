// === WEIGHT.JS - GESTIONE PESO E BMI ===

// === GESTIONE PESO ===
function updateCurrentWeight() {
    if (!currentClient) return;
    
    const updates = [
        { id: 'peso-attuale', value: currentClient.peso },
        { id: 'bmi-attuale-numero', value: currentClient.bmi }
    ];
    
    updates.forEach(({ id, value }) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    
    const categoriaElement = document.getElementById('bmi-categoria');
    if (categoriaElement) {
        const bmiClass = getBmiClass(currentClient.bmi);
        const bmiLabel = getBmiLabel(currentClient.bmi);
        categoriaElement.textContent = bmiLabel;
        categoriaElement.className = `bmi-badge ${bmiClass}`;
    }
}

function toggleWeightEditMode() {
    if (!currentClient) return;
    
    const displayMode = document.getElementById('weight-display-mode');
    const editMode = document.getElementById('weight-edit-mode');
    const weightInput = document.getElementById('new-weight-input');
    
    if (!displayMode || !editMode || !weightInput) {
        console.error('❌ Elementi weight edit non trovati');
        return;
    }
    
    displayMode.classList.add('hidden');
    editMode.classList.remove('hidden');
    
    const currentWeight = document.getElementById('peso-attuale').textContent;
    if (currentWeight && currentWeight !== '--') {
        weightInput.value = currentWeight;
        updateBmiPreview();
    }
    
    weightInput.focus();
    weightInput.addEventListener('input', updateBmiPreview);
}

function cancelWeightEdit() {
    const displayMode = document.getElementById('weight-display-mode');
    const editMode = document.getElementById('weight-edit-mode');
    const inputs = ['new-weight-input', 'weight-update-note'];
    
    if (displayMode && editMode) {
        displayMode.classList.remove('hidden');
        editMode.classList.add('hidden');
    }
    
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    const preview = document.getElementById('bmi-preview');
    if (preview) preview.style.display = 'none';
}

function updateBmiPreview() {
    if (!currentClient) return;
    
    const weightInput = document.getElementById('new-weight-input');
    const newWeight = parseFloat(weightInput.value);
    
    if (isNaN(newWeight) || newWeight <= 0) {
        const preview = document.getElementById('bmi-preview');
        if (preview) preview.style.display = 'none';
        return;
    }
    
    const newBmi = Math.round((newWeight / Math.pow(currentClient.altezza/100, 2)) * 10) / 10;
    const bmiCategory = getBmiLabel(newBmi);
    const bmiClass = getBmiClass(newBmi);
    
    const elements = {
        preview: document.getElementById('bmi-preview'),
        value: document.getElementById('bmi-preview-value'),
        category: document.getElementById('bmi-preview-category')
    };
    
    if (elements.preview && elements.value && elements.category) {
        elements.preview.style.display = 'block';
        elements.value.textContent = newBmi;
        elements.category.textContent = bmiCategory;
        elements.category.className = `bmi-badge ${bmiClass}`;
    }
}

async function saveWeightUpdate() {

    
    if (!currentClient) {
        console.error('❌ currentClient non disponibile');
        showMessage('Errore: cliente non caricato', 'error');
        return;
    }
    
    const weightInput = document.getElementById('new-weight-input');
    const noteInput = document.getElementById('weight-update-note');
    
    if (!weightInput) {
        console.error('❌ Campo peso non trovato');
        showMessage('Errore: campo peso non trovato', 'error');
        return;
    }
    
    const newWeight = parseFloat(weightInput.value);
    const note = noteInput ? noteInput.value.trim() : '';
    
    // Validazione
    if (isNaN(newWeight) || newWeight <= 0) {
        showMessage('Inserisci un peso valido', 'error');
        return;
    }
    
    if (newWeight < 30 || newWeight > 300) {
        showMessage('Il peso deve essere tra 30 e 300 kg', 'error');
        return;
    }
    
    try {

        
        // 1. Aggiorna il cliente con il nuovo peso
        const updateData = {
            nome: currentClient.nome,
            cognome: currentClient.cognome,
            peso: newWeight,
            altezza: currentClient.altezza,
            telefono: currentClient.telefono,
            email: currentClient.email,
            note_generali: currentClient.note_generali
        };
        
        if (currentClient.data_nascita) {
            const birthDate = new Date(currentClient.data_nascita);
            if (!isNaN(birthDate.getTime())) {
                updateData.data_nascita = birthDate.toISOString().split('T')[0];
            } else {
                updateData.data_nascita = null;
            }
        } else {
            updateData.data_nascita = null;
        }
        
        await apiCall(`/clients/${currentClient.id}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        // 2. Aggiorna tutte le diete attive del cliente
        if (currentDiets && currentDiets.length > 0) {
            const dietUpdates = currentDiets
                .filter(diet => diet.stato === 'attiva') // Solo diete attive
                .map(diet => {
                    const newBmi = Math.round((newWeight / Math.pow(currentClient.altezza/100, 2)) * 10) / 10;
                    
                    return apiCall(`/diets/${diet.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            ...diet,
                            peso_attuale: newWeight,
                            bmi_attuale: newBmi,
                            peso_perso: diet.peso_iniziale - newWeight
                        })
                    });
                });
            
            if (dietUpdates.length > 0) {
                await Promise.all(dietUpdates);

            }
        }
        
        showMessage('Peso aggiornato con successo in cliente e diete!', 'success');
        
        // 3. Aggiorna i dati locali
        currentClient.peso = newWeight;
        currentClient.bmi = Math.round((newWeight / Math.pow(currentClient.altezza/100, 2)) * 10) / 10;
        
        // 4. Aggiorna display
        updateCurrentWeight();
        
        // 5. Ricarica le diete per mostrare i valori aggiornati
        await loadClientDiets(currentClient.id);
        
        // 6. Torna alla modalità display
        cancelWeightEdit();
        
    } catch (error) {
        console.error('❌ Errore aggiornamento peso:', error);
        showMessage('Errore nell\'aggiornamento: ' + error.message, 'error');
    }
}

// Aggiorna display peso e BMI
function updateWeightDisplay() {
    if (!currentClient) return;
    
    // Calcola e aggiorna BMI
    if (currentClient.peso && currentClient.altezza) {
        const altezzaM = currentClient.altezza / 100;
        const bmi = currentClient.peso / (altezzaM * altezzaM);
        
        const bmiElement = document.getElementById('bmi-attuale-numero');
        if (bmiElement) {
            bmiElement.textContent = bmi.toFixed(1);
        }
        
        // Aggiorna categoria BMI
        const categoriaElement = document.getElementById('bmi-categoria');
        if (categoriaElement) {
            let categoria = '';
            let className = 'bmi-badge ';
            
            if (bmi < 18.5) {
                categoria = 'Sottopeso';
                className += 'bmi-sottopeso';
            } else if (bmi < 25) {
                categoria = 'Normale';
                className += 'bmi-normale';
            } else if (bmi < 30) {
                categoria = 'Sovrappeso';
                className += 'bmi-sovrappeso';
            } else {
                categoria = 'Obesità';
                className += 'bmi-obesita';
            }
            
            categoriaElement.textContent = categoria;
            categoriaElement.className = className;
        }
    }
}