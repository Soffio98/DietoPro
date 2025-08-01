// === PROGRESS.JS - GESTIONE PROGRESSI E GRAFICI ===

// Variabili globali
let progressChart = null;
window.progressData = null;
window.progressCharts = [];

// Funzione principale per mostrare il modal progressi
async function showProgressModal() {
    if (!currentClient) {
        showMessage('Errore: cliente non caricato', 'error');
        return;
    }
    
    // Crea modal
    const modal = document.createElement('div');
    modal.className = 'progress-modal';
    modal.innerHTML = `
        <div class="progress-modal-content">
            <div class="progress-header">
                <h2>📊 Progressi di ${currentClient.nome} ${currentClient.cognome}</h2>
                <button class="modal-close" onclick="closeProgressModal()">×</button>
            </div>
            
            <div class="progress-body">
                <!-- Container per i grafici -->
                <div class="charts-wrapper" id="charts-wrapper">
                    <!-- I grafici verranno inseriti qui -->
                </div>
                
                <!-- Controlli -->
                <div class="progress-controls">
                    <div class="date-range">
                        <label>Periodo:</label>
                        <select id="timeRange" onchange="renderCharts()">
                            <option value="1year" selected>Ultimo anno</option>
                            <option value="6months">Ultimi 6 mesi</option>
                            <option value="3months">Ultimi 3 mesi</option>
                            <option value="1month">Ultimo mese</option>
                            <option value="all">Tutto</option>
                        </select>
                    </div>
                    
                    <!-- Legenda interattiva -->
                    <div class="legend-container">
                        <!-- Peso -->
                        <div class="legend-section">
                            <h4>Generale</h4>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-peso" checked onchange="renderCharts()">
                                <span class="legend-color" style="background: #e74c3c;"></span>
                                <span>Peso (kg)</span>
                            </label>
                        </div>
                        
                        <!-- Plicometria -->
                        <div class="legend-section">
                            <h4>Plicometria (mm)</h4>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-tricipite" onchange="renderCharts()">
                                <span class="legend-color" style="background: #9b59b6;"></span>
                                <span>💪 Tricipite</span>
                            </label>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-addome" onchange="renderCharts()">
                                <span class="legend-color" style="background: #f39c12;"></span>
                                <span>🔲 Addome</span>
                            </label>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-soprailiaca" onchange="renderCharts()">
                                <span class="legend-color" style="background: #2ecc71;"></span>
                                <span>📐 Soprailiaca</span>
                            </label>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-sottoscapolare" onchange="renderCharts()">
                                <span class="legend-color" style="background: #e67e22;"></span>
                                <span>🔻 Sottoscapolare</span>
                            </label>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-ascellare" onchange="renderCharts()">
                                <span class="legend-color" style="background: #1abc9c;"></span>
                                <span>📍 Ascellare</span>
                            </label>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-pettorale" onchange="renderCharts()">
                                <span class="legend-color" style="background: #34495e;"></span>
                                <span>🎯 Pettorale</span>
                            </label>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-coscia" onchange="renderCharts()">
                                <span class="legend-color" style="background: #95a5a6;"></span>
                                <span>🦵 Coscia</span>
                            </label>
                        </div>
                        
                        <!-- % Grasso -->
                        <div class="legend-section">
                            <h4>Composizione</h4>
                            <label class="legend-item">
                                <input type="checkbox" id="metric-grasso" onchange="renderCharts()">
                                <span class="legend-color" style="background: #d35400;"></span>
                                <span>% Grasso Corporeo</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Statistiche -->
                    <div id="progress-stats" class="progress-stats">
                        <!-- Verranno popolate dinamicamente -->
                    </div>
                </div>
            </div>
            
            <div class="progress-footer">
                <button class="btn" onclick="closeProgressModal()">
                    Chiudi
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Carica Chart.js
    await loadChartJS();
    
    // Carica i dati
    await loadProgressData();
    
    // Renderizza i grafici
    renderCharts();
}

// Carica Chart.js dinamicamente
async function loadChartJS() {
    if (window.Chart) return;
    
    const scripts = [
        'https://cdn.jsdelivr.net/npm/chart.js',
        'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns'
    ];
    
    for (const src of scripts) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

async function loadProgressData() {
    try {
        const plicometriaData = await apiCall(`/clients/${currentClient.id}/plicometria`);
        
        window.progressData = {
            plicometria: plicometriaData || []
        };
        

        
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        showMessage('Errore nel caricamento dei dati', 'error');
    }
}

// Renderizza i grafici
function renderCharts() {

    
    // Pulisci grafici esistenti
    if (window.progressCharts && window.progressCharts.length > 0) {
        window.progressCharts.forEach(chart => chart.destroy());
        window.progressCharts = [];
    }
    
    // Ottieni container
    const wrapper = document.getElementById('charts-wrapper');
    if (!wrapper) {
        console.error('Container grafici non trovato');
        return;
    }
    wrapper.innerHTML = '';
    
    // Calcola range date
    const timeRange = document.getElementById('timeRange').value;
    const endDate = new Date();
    let startDate = new Date();
    
    switch(timeRange) {
        case '1month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
        case '3months':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
        case '6months':
            startDate.setMonth(endDate.getMonth() - 6);
            break;
        case '1year':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        case 'all':
            startDate = new Date('2000-01-01');
            break;
    }
    

    
    // Array per memorizzare configurazioni grafici
    const chartsToCreate = [];
    
    // 1. GRAFICO PESO
    if (document.getElementById('metric-peso')?.checked) {
        const pesoData = getPesoData(startDate, endDate);

        
        if (pesoData.length > 0) {
            chartsToCreate.push({
                title: 'Peso (kg)',
                data: [{
                    label: 'Peso',
                    data: pesoData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }],
                yLabel: 'Peso (kg)'
            });
        }
    }
    
    // 2. GRAFICO PLICHE
    const plicheData = [];
    const plicheConfig = [
        { id: 'tricipite', label: 'Tricipite', color: '#9b59b6' },
        { id: 'addome', label: 'Addome', color: '#f39c12' },
        { id: 'soprailiaca', label: 'Soprailiaca', color: '#2ecc71' },
        { id: 'sottoscapolare', label: 'Sottoscapolare', color: '#e67e22' },
        { id: 'ascellare', label: 'Ascellare', color: '#1abc9c' },
        { id: 'pettorale', label: 'Pettorale', color: '#34495e' },
        { id: 'coscia', label: 'Coscia', color: '#95a5a6' }
    ];
    
    plicheConfig.forEach(config => {
        if (document.getElementById(`metric-${config.id}`)?.checked) {
            const data = getPlicometriaData(config.id, startDate, endDate);

            
            if (data.length > 0) {
                plicheData.push({
                    label: config.label,
                    data: data,
                    borderColor: config.color,
                    backgroundColor: config.color + '20',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                });
            }
        }
    });
    
    if (plicheData.length > 0) {
        chartsToCreate.push({
            title: 'Pliche (mm)',
            data: plicheData,
            yLabel: 'Millimetri (mm)'
        });
    }
    
    // 3. GRAFICO % GRASSO
    if (document.getElementById('metric-grasso')?.checked) {
        const grassoData = getPlicometriaData('percentuale_grasso', startDate, endDate);

        
        if (grassoData.length > 0) {
            chartsToCreate.push({
                title: '% Grasso Corporeo',
                data: [{
                    label: '% Grasso',
                    data: grassoData,
                    borderColor: '#d35400',
                    backgroundColor: 'rgba(211, 84, 0, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }],
                yLabel: 'Percentuale (%)'
            });
        }
    }

    
    // Crea i grafici
    chartsToCreate.forEach((chartConfig, index) => {
        // Crea container per il grafico
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart-container';
        chartDiv.style.height = '300px';
        chartDiv.style.marginBottom = '30px';
        chartDiv.style.background = '#f8f9fa';
        chartDiv.style.padding = '20px';
        chartDiv.style.borderRadius = '10px';
        
        // Crea canvas
        const canvas = document.createElement('canvas');
        canvas.id = `progress-chart-${index}`;
        chartDiv.appendChild(canvas);
        wrapper.appendChild(chartDiv);
        
        // Crea il grafico
        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: chartConfig.data
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartConfig.title,
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: chartConfig.data.length > 1
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'dd/MM'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Data'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: chartConfig.yLabel
                        },
                        beginAtZero: false
                    }
                }
            }
        });
        
        window.progressCharts.push(chart);

    });
    
    // Aggiorna statistiche
    updateStatistics(chartsToCreate);
    
}

function getPesoData(startDate, endDate) {
    if (!window.progressData?.plicometria) return [];
    
    return window.progressData.plicometria
        .filter(p => {
            const date = new Date(p.data_misurazione);
            return p.peso && date >= startDate && date <= endDate;
        })
        .map(p => ({
            x: new Date(p.data_misurazione),
            y: parseFloat(p.peso)
        }))
        .sort((a, b) => a.x - b.x);
}

// Ottieni dati plicometria
function getPlicometriaData(field, startDate, endDate) {
    if (!window.progressData?.plicometria) return [];
    
    return window.progressData.plicometria
        .filter(p => {
            const date = new Date(p.data_misurazione);
            return p[field] !== null && p[field] !== undefined && date >= startDate && date <= endDate;
        })
        .map(p => ({
            x: new Date(p.data_misurazione),
            y: parseFloat(p[field])
        }))
        .sort((a, b) => a.x - b.x);
}

// Aggiorna statistiche
function updateStatistics(chartsData) {
    const container = document.getElementById('progress-stats');
    if (!container) return;
    
    if (chartsData.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<h4>Statistiche periodo selezionato:</h4><div class="stats-grid">';
    
    chartsData.forEach(chart => {
        chart.data.forEach(dataset => {
            if (dataset.data && dataset.data.length > 0) {
                const values = dataset.data.map(d => d.y);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                const first = values[0];
                const last = values[values.length - 1];
                const change = last - first;
                const changePercent = first ? ((change / first) * 100).toFixed(1) : '0';
                
                html += `
                    <div class="stat-card">
                        <div class="stat-label" style="color: ${dataset.borderColor};">
                            ${dataset.label}
                        </div>
                        <div class="stat-values">
                            <div>Min: ${min.toFixed(1)}</div>
                            <div>Max: ${max.toFixed(1)}</div>
                            <div>Media: ${avg.toFixed(1)}</div>
                            <div>Variazione: ${change >= 0 ? '+' : ''}${change.toFixed(1)} (${changePercent}%)</div>
                        </div>
                    </div>
                `;
            }
        });
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Chiudi modal
function closeProgressModal() {
    const modal = document.querySelector('.progress-modal');
    if (modal) {
        // Distruggi grafici
        if (window.progressCharts) {
            window.progressCharts.forEach(chart => chart.destroy());
            window.progressCharts = [];
        }
        modal.remove();
    }
}