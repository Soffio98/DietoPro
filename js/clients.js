// === CLIENTS.JS - GESTIONE CLIENTI ===

// === CARICAMENTO DATI CLIENTI ===
async function loadClientsData() {
    try {
        const data = await apiCall('/clients');
        clients = data;
        displayAllClients(data);
    } catch (error) {
        const container = document.getElementById('clients-grid');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Errore nel caricamento dei clienti.</p>';
        }
    }
}

function loadClients() {
    showClientList();
}

async function loadClientDetail(clientId) {
    const [clientData, anamnesisData] = await Promise.all([
        apiCall(`/clients/${clientId}`),
        apiCall(`/clients/${clientId}/anamnesis`)
    ]);
    
    currentClient = clientData;
    displayClientDetail(clientData, anamnesisData);
    await loadClientDiets(clientId);
    
    // Carica anche la plicometria e aggiorna il peso
    await loadUltimaPlicometria();
    updateWeightDisplay();
}

// === FORM HANDLING CLIENTI ===
async function handleNewClient(event) {
    event.preventDefault();
    
    const formData = {
        nome: document.getElementById('nome').value.trim(),
        cognome: document.getElementById('cognome').value.trim(),
        peso: parseFloat(document.getElementById('peso').value),
        altezza: parseInt(document.getElementById('altezza').value),
        data_nascita: document.getElementById('data_nascita').value || null,
        telefono: document.getElementById('telefono').value.trim() || null,
        email: document.getElementById('email').value.trim() || null,
        note_generali: document.getElementById('note_generali').value.trim() || null
    };

    try {
        const result = await apiCall('/clients', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        showMessage('Cliente creato con successo!', 'success');
        showClientDetail(result.clientId);
    } catch (error) {
        showMessage('Errore nella creazione del cliente', 'error');
    }
}

async function deleteClient(clientId) {
    if (confirm('Sei sicuro di voler eliminare questo cliente?')) {
        try {
            await apiCall(`/clients/${clientId}`, { method: 'DELETE' });
            showMessage('Cliente eliminato con successo', 'success');
            
            if (!document.getElementById('homepage').classList.contains('hidden')) {
                loadRecentClients();
            } else {
                loadClientsData();
            }
        } catch (error) {
            showMessage('Errore nell\'eliminazione del cliente', 'error');
        }
    }
}

// === DISPLAY FUNCTIONS CLIENTI ===
function displayRecentClients(clientList) {
    const container = document.getElementById('recent-clients');
    if (!container) return;
    
    if (clientList.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Nessun cliente trovato. Inizia creando il tuo primo cliente!</p>';
        return;
    }

    container.innerHTML = `
        <div class="client-grid">
            ${clientList.map(client => createClientCard(client)).join('')}
        </div>
        ${clientList.length >= 6 ? '<div style="text-align: center; margin-top: 20px;"><button class="btn" onclick="showClientList()">Vedi Tutti i Clienti</button></div>' : ''}
    `;
}

function displayAllClients(clientList) {
    const container = document.getElementById('clients-grid');
    if (!container) return;
    
    if (clientList.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Nessun cliente trovato.</p>';
        return;
    }

    container.innerHTML = clientList.map(client => createClientCard(client)).join('');
}

function createClientCard(client) {
    const bmiClass = getBmiClass(client.bmi);
    const bmiLabel = getBmiLabel(client.bmi);
    
    return `
        <div class="client-card">
            <div class="client-info">
                <h3>${client.nome_completo}</h3>
                <span class="bmi-badge ${bmiClass}">BMI: ${client.bmi} - ${bmiLabel}</span>
            </div>
            <div class="client-stats">
                <div class="stat-item">
                    <span class="stat-label">Peso</span>
                    <span class="stat-value">${client.peso} kg</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Altezza</span>
                    <span class="stat-value">${client.altezza} cm</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Ultimo Aggiornamento</span>
                    <span class="stat-value">${formatDate(client.ultimo_aggiornamento)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Riquadri Anamnesi</span>
                    <span class="stat-value">${client.num_riquadri_anamnesi || 0}</span>
                </div>
            </div>
            <div style="text-align: center; margin-top: 15px;">
                <button class="btn btn-primary" onclick="showClientDetail(${client.id})">
                    📝 Gestisci
                </button>
                <button class="btn btn-danger" style="margin-left: 5px" onclick="deleteClient(${client.id})">
                    🗑️ Elimina
                </button>
            </div>
        </div>
    `;
}

function displayClientDetail(client, anamnesis) {
    const titleElement = document.getElementById('client-detail-title');
    if (titleElement) {
        titleElement.textContent = `👤 ${client.nome_completo}`;
    }
    
    const bmiClass = getBmiClass(client.bmi);
    const bmiLabel = getBmiLabel(client.bmi);
    
    const infoContainer = document.getElementById('client-info-detail');
    if (infoContainer) {
        infoContainer.innerHTML = createClientInfoHTML(client, bmiClass, bmiLabel);
    }

    displayAnamnesi(anamnesis);
    updateCurrentWeight();
}

function createClientInfoHTML(client, bmiClass, bmiLabel) {
    const optionalFields = [
        { condition: client.data_nascita, label: 'Data di Nascita', value: formatDate(client.data_nascita) },
        { condition: client.telefono, label: 'Telefono', value: client.telefono },
        { condition: client.email, label: 'Email', value: client.email },
        { condition: client.note_generali, label: 'Note', value: client.note_generali }
    ];

    return `
        <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <h3 style="margin-bottom: 20px; color: #667eea;">Informazioni Personali</h3>
            <div class="form-row">
                <div><strong>Nome:</strong> ${client.nome}</div>
                <div><strong>Cognome:</strong> ${client.cognome}</div>
            </div>
            <div class="form-row" style="margin-top: 15px;">
                <div><strong>Peso:</strong> ${client.peso} kg</div>
                <div><strong>Altezza:</strong> ${client.altezza} cm</div>
            </div>
            <div style="margin-top: 15px;">
                <strong>BMI:</strong> <span class="bmi-badge ${bmiClass}">${client.bmi} - ${bmiLabel}</span>
            </div>
            ${optionalFields.filter(field => field.condition).map(field => 
                `<div style="margin-top: 15px;"><strong>${field.label}:</strong> ${field.value}</div>`
            ).join('')}
        </div>
    `;
}