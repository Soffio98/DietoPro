// === export-pdf.js - EXPORT PDF PROFESSIONALE ===

let doc;

// Funzione principale per esportare in PDF
async function exportDietPDF(dietId) {
    // Mostra dialog per scegliere il formato
    const formato = await showPDFFormatDialog();
    
    if (!formato) {
        // Utente ha annullato
        return;
    }
    
    try {
        showMessage('⏳ Generazione PDF in corso...', 'info');
        
        // Carica dati dieta
        const dietData = await apiCall(`/diets/${dietId}`);
        const pianificazione = await apiCall(`/pianificazioni/dieta/${dietId}/completa`);
        
        if (!pianificazione || !pianificazione.pianificazione) {
            showMessage('⚠️ Nessuna pianificazione da esportare!', 'warning');
            return;
        }
        
        // Genera il PDF nel formato scelto
        if (formato === 'compatto') {
            generatePDF(dietData, pianificazione.pianificazione);
        } else {
            generatePDFGiornaliero(dietData, pianificazione.pianificazione);
        }
        
    } catch (error) {
        console.error('❌ Errore export PDF:', error);
        showMessage('Errore nella generazione del PDF', 'error');
    }
}

// Genera PDF con un giorno per pagina
function generatePDFGiornaliero(dietData, pianificazione) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Configurazione
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (2 * margin);
    
    // Colori
    const headerColor = [51, 122, 183];
    const lightBlue = [236, 240, 245];
    
    // Giorni e dati
    const giorni = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
    const giorniNomi = ['LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO', 'DOMENICA'];
    const nomePasti = ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena', 'Spuntino Ser.'];
    
    // Mappa per gestire le varianti dei nomi
    const mapNomiPasti = {
        'colazione': ['colazione'],
        'spuntino': ['spuntino', 'spuntino mattina', 'spuntino mattutino'],
        'pranzo': ['pranzo'],
        'merenda': ['merenda', 'spuntino pomeridiano'],
        'cena': ['cena'],
        'spuntino ser.': ['spuntino ser.', 'spuntino serale']
    };
    
    // Per ogni giorno - UNA PAGINA COMPLETA
    giorni.forEach((giorno, giornoIndex) => {
        if (giornoIndex > 0) {
            doc.addPage();
        }
        
        // === CALCOLA LAYOUT PRIMA DI DISEGNARE ===
        const giornoDati = pianificazione.dati_settimanali[giorno] || [];
        
        // Altezze fisse
        const headerHeight = 15;
        const infoBarHeight = 15;
        const footerHeight = 40;
        const pastoHeaderHeight = 8;
        const spazioPasti = 3;
        
        // Spazio disponibile per contenuto pasti
        const spazioDisponibile = pageHeight - headerHeight - infoBarHeight - footerHeight - 30;
        const spazioPastiTotale = spazioDisponibile - (nomePasti.length * pastoHeaderHeight) - ((nomePasti.length - 1) * spazioPasti);
        
        // Conta alimenti totali per distribuire lo spazio
        let alimentiTotali = 0;
        let pastiConAlimenti = [];
        
        nomePasti.forEach((nomePasto, index) => {
            // Cerca il pasto con nomi varianti
            const nomiVarianti = mapNomiPasti[nomePasto.toLowerCase()] || [nomePasto.toLowerCase()];
            const pasto = giornoDati.find(p => {
                if (p.mealName) {
                    const mealNameLower = p.mealName.toLowerCase();
                    return nomiVarianti.some(variante => mealNameLower === variante);
                }
                return false;
            });
            
            let count = 0;
            if (pasto) {
                if (pasto.foods && pasto.foods.length > 0) {
                    count += pasto.foods.length;
                }
                if (pasto.alternatives && pasto.alternatives.length > 0) {
                    count += pasto.alternatives.length;
                }
            }
            
            pastiConAlimenti.push({
                nome: nomePasto,
                pasto: pasto,
                numAlimenti: count || 1,
                index: index
            });
            
            alimentiTotali += count || 1;
        });
        
        // Calcola altezza per alimento con un minimo di 4mm e massimo di 8mm
        const altezzaPerAlimento = Math.min(8, Math.max(4, spazioPastiTotale / alimentiTotali));
        
        // === DISEGNA PAGINA ===
        
        // HEADER
        doc.setFillColor(...headerColor);
        doc.rect(0, 0, pageWidth, 20, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(giorniNomi[giornoIndex], pageWidth / 2, 12, { align: 'center' });
        
        let y = 25;
        
        // PASTI
        let pastiInPaginaCorrente = [];
        let pastiPerProssimaP = [];
        let altezzaAccumulata = 25; // Inizia dopo l'header
        
        // Calcola quali pasti stanno nella pagina corrente
        pastiConAlimenti.forEach((pastoInfo) => {
            const altezzaPasto = pastoHeaderHeight + (pastoInfo.numAlimenti * altezzaPerAlimento) + spazioPasti;
            
            if (altezzaAccumulata + altezzaPasto < pageHeight - 20) {
                pastiInPaginaCorrente.push(pastoInfo);
                altezzaAccumulata += altezzaPasto;
            } else {
                pastiPerProssimaP.push(pastoInfo);
            }
        });
        
        // Disegna i pasti che stanno nella pagina corrente
        pastiInPaginaCorrente.forEach((pastoInfo) => {
            const nomePasto = pastoInfo.nome;
            const pasto = pastoInfo.pasto;
            const pastoIndex = pastoInfo.index;
            
            // Header pasto
            doc.setFillColor(...headerColor);
            doc.rect(margin, y, contentWidth, pastoHeaderHeight, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(nomePasto.toUpperCase(), margin + 5, y + 5.5);
            
            y += pastoHeaderHeight;
            
            const bgColor = pastoIndex % 2 === 0 ? 255 : 248;
            doc.setFillColor(bgColor, bgColor, bgColor);
            
            if (!pasto || !pasto.foods || pasto.foods.length === 0) {
                // Pasto vuoto - non scrivere nulla
                const altezzaPastoVuoto = Math.max(20, altezzaPerAlimento * 1.5);
                doc.rect(margin, y, contentWidth, altezzaPastoVuoto, 'F');
                doc.setDrawColor(220, 220, 220);
                doc.rect(margin, y, contentWidth, altezzaPastoVuoto);
                
                // Non scrivere nulla nella cella vuota
                
                y += altezzaPastoVuoto;
            } else {
                // Lista alimenti principali e alternative
                let allFoods = [];
                
                // Aggiungi foods con flag isAlternative
                if (pasto.foods) {
                    pasto.foods.forEach(food => {
                        allFoods.push({ ...food, isAlternative: false });
                    });
                }
                
                // Aggiungi alternatives
                if (pasto.alternatives && pasto.alternatives.length > 0) {
                    pasto.alternatives.forEach(alt => {
                        allFoods.push({ ...alt, isAlternative: true });
                    });
                }
                
                // Se hanno globalOrder, ordina per quello
                if (allFoods.length > 0 && allFoods[0].globalOrder !== undefined) {
                    allFoods.sort((a, b) => a.globalOrder - b.globalOrder);
                }
                
                // Calcola altezza totale del pasto
                const altezzaPasto = allFoods.length * altezzaPerAlimento;
                doc.rect(margin, y, contentWidth, altezzaPasto, 'F');
                doc.setDrawColor(220, 220, 220);
                doc.rect(margin, y, contentWidth, altezzaPasto);
                
                let foodY = y + (altezzaPerAlimento / 2) - 1;
                
                allFoods.forEach((food) => {
                    // Reset stili
                    doc.setTextColor(0, 0, 0);
                    doc.setFont(undefined, 'normal');
                    
                    // Applica stili per alternative
                    if (food.isAlternative) {
                        doc.setFont(undefined, 'italic');
                        doc.setTextColor(100, 100, 100);
                    }
                    
                    doc.setFontSize(8);
                    
                    // Prefisso e indentazione
                    const prefix = food.isAlternative ? '- ' : '• ';
                    const textX = margin + 5 + (food.isAlternative ? 5 : 0);
                    
                    let foodName = food.nome;
                    const maxWidth = contentWidth - 35;
                    
                    // Tronca se necessario
                    if (doc.getTextWidth(`${prefix}${foodName}`) > maxWidth) {
                        while (doc.getTextWidth(`${prefix}${foodName}...`) > maxWidth && foodName.length > 10) {
                            foodName = foodName.slice(0, -1);
                        }
                        foodName += '...';
                    }
                    
                    // Testo alimento
                    doc.text(`${prefix}${foodName}`, textX, foodY + 2);
                    
                    // Quantità
                    doc.setFontSize(7);
                    doc.setTextColor(120, 120, 120);
                    doc.text(`${food.quantita}g`, margin + contentWidth - 5, foodY + 2, { align: 'right' });
                    
                    foodY += altezzaPerAlimento;
                });
                
                y += altezzaPasto;
            }
            
            // Spazio tra pasti
            if (pastoIndex < nomePasti.length - 1) {
                y += spazioPasti;
            }
        });
        
        // Se ci sono pasti che non entrano, crea una nuova pagina
        if (pastiPerProssimaP.length > 0) {
            doc.addPage();
            
            // Header continuazione
            doc.setFillColor(...headerColor);
            doc.rect(0, 0, pageWidth, 20, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(`${giorniNomi[giornoIndex]} (continua)`, pageWidth / 2, 12, { align: 'center' });
            
            y = 25;
            
            // Disegna i pasti rimanenti
            pastiPerProssimaP.forEach((pastoInfo) => {
                const nomePasto = pastoInfo.nome;
                const pasto = pastoInfo.pasto;
                const pastoIndex = pastoInfo.index;
                
                // Header pasto
                doc.setFillColor(...headerColor);
                doc.rect(margin, y, contentWidth, pastoHeaderHeight, 'F');
                
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text(nomePasto.toUpperCase(), margin + 5, y + 5.5);
                
                y += pastoHeaderHeight;
                
                const bgColor = pastoIndex % 2 === 0 ? 255 : 248;
                doc.setFillColor(bgColor, bgColor, bgColor);
                
                if (!pasto || !pasto.foods || pasto.foods.length === 0) {
                    // Pasto vuoto
                    const altezzaPastoVuoto = Math.max(20, altezzaPerAlimento * 1.5);
                    doc.rect(margin, y, contentWidth, altezzaPastoVuoto, 'F');
                    doc.setDrawColor(220, 220, 220);
                    doc.rect(margin, y, contentWidth, altezzaPastoVuoto);
                    
                    y += altezzaPastoVuoto;
                } else {
                    // Lista alimenti
                    let allFoods = [];
                    if (pasto.foods) {
                        pasto.foods.forEach(food => {
                            allFoods.push({ ...food, isAlternative: false });
                        });
                    }
                    if (pasto.alternatives && pasto.alternatives.length > 0) {
                        pasto.alternatives.forEach(alt => {
                            allFoods.push({ ...alt, isAlternative: true });
                        });
                    }
                    
                    if (allFoods.length > 0 && allFoods[0].globalOrder !== undefined) {
                        allFoods.sort((a, b) => a.globalOrder - b.globalOrder);
                    }
                    
                    const altezzaPasto = allFoods.length * altezzaPerAlimento;
                    doc.rect(margin, y, contentWidth, altezzaPasto, 'F');
                    doc.setDrawColor(220, 220, 220);
                    doc.rect(margin, y, contentWidth, altezzaPasto);
                    
                    let foodY = y + (altezzaPerAlimento / 2) - 1;
                    
                    allFoods.forEach((food) => {
                        doc.setTextColor(0, 0, 0);
                        doc.setFont(undefined, 'normal');
                        
                        if (food.isAlternative) {
                            doc.setFont(undefined, 'italic');
                            doc.setTextColor(100, 100, 100);
                        }
                        
                        doc.setFontSize(8);
                        
                        const prefix = food.isAlternative ? '- ' : '• ';
                        const textX = margin + 5 + (food.isAlternative ? 5 : 0);
                        
                        let foodName = food.nome;
                        const maxWidth = contentWidth - 35;
                        
                        if (doc.getTextWidth(`${prefix}${foodName}`) > maxWidth) {
                            while (doc.getTextWidth(`${prefix}${foodName}...`) > maxWidth && foodName.length > 10) {
                                foodName = foodName.slice(0, -1);
                            }
                            foodName += '...';
                        }
                        
                        doc.text(`${prefix}${foodName}`, textX, foodY + 0.5);
                        
                        doc.setFontSize(7);
                        doc.setTextColor(120, 120, 120);
                        doc.text(`${food.quantita}g`, margin + contentWidth - 5, foodY + 0.5, { align: 'right' });
                        
                        foodY += altezzaPerAlimento;
                    });
                    
                    y += altezzaPasto;
                }
                
                if (pastoIndex < nomePasti.length - 1) {
                    y += spazioPasti;
                }
            });
        }
        
        // FOOTER
        const footerY = pageHeight - 10;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont(undefined, 'normal');
    });
    
    // Salva
    const fileName = `dieta_giornaliera_${dietData.nome_cliente.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    showMessage('✅ PDF giornaliero generato con successo!', 'success');
}

function showPDFFormatDialog() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 500px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            animation: slideIn 0.3s ease-out;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-bottom: 20px; color: #333; text-align: center;">
                📄 Scegli il formato di esportazione
            </h3>
            
            <div style="display: flex; flex-direction: column; gap: 15px; margin: 30px 0;">
                <button class="pdf-format-btn" data-format="compatto" style="
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-align: left;
                ">
                    <div style="font-size: 2em;">📋</div>
                    <div>
                        <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">
                            Formato Compatto
                        </div>
                        <div style="color: #666; font-size: 0.9em;">
                            Tutti i giorni in un unico foglio
                        </div>
                    </div>
                </button>
                
                <button class="pdf-format-btn" data-format="giornaliero" style="
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-align: left;
                ">
                    <div style="font-size: 2em;">📅</div>
                    <div>
                        <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">
                            Formato Giornaliero
                        </div>
                        <div style="color: #666; font-size: 0.9em;">
                            Un giorno per pagina con più dettagli
                        </div>
                    </div>
                </button>
            </div>
            
            <div style="text-align: center;">
                <button onclick="this.closest('.pdf-dialog-overlay').remove()" style="
                    padding: 10px 20px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">
                    Annulla
                </button>
            </div>
        `;
        
        overlay.className = 'pdf-dialog-overlay';
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Aggiungi animazione
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .pdf-format-btn:hover {
                border-color: #667eea !important;
                background: #f8f9ff !important;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
            }
        `;
        document.head.appendChild(style);
        
        // Gestisci click sui bottoni
        dialog.querySelectorAll('.pdf-format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.getAttribute('data-format');
                overlay.remove();
                resolve(format);
            });
        });
        
        // Click fuori per chiudere
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(null);
            }
        });
    });
}

function generatePDF(dietData, pianificazione) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait', // CAMBIATO: ora verticale
        unit: 'mm',
        format: 'a4'
    });
    
    // Configurazione per formato verticale
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const labelWidth = 25;
    
    // Colori
    const headerColor = [51, 122, 183];
    const lightBlue = [236, 240, 245];
    const lightGray = [250, 250, 250];
    const borderColor = [200, 200, 200];
    
    // PAGINA 1: LUNEDÌ - GIOVEDÌ
    generatePage(doc, dietData, pianificazione, ['LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ'], ['lunedi', 'martedi', 'mercoledi', 'giovedi'], 1);
    
    // PAGINA 2: VENERDÌ - DOMENICA
    doc.addPage();
    generatePage(doc, dietData, pianificazione, ['VENERDÌ', 'SABATO', 'DOMENICA'], ['venerdi', 'sabato', 'domenica'], 2);
    
    // Salva
    const fileName = `dieta_${dietData.nome_cliente.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    showMessage('✅ PDF generato con successo!', 'success');
}

function generatePage(doc, dietData, pianificazione, giorniLabels, giorniKeys, pageNumber) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const labelWidth = 25;
    
    // Calcolo spazio per i giorni (ora solo 3 o 4 giorni per pagina)
    const startX = margin + labelWidth;
    const availableWidth = pageWidth - startX - margin;
    const colWidth = availableWidth / giorniLabels.length;
    
    // Colori
    const headerColor = [51, 122, 183];
    const lightBlue = [236, 240, 245];
    const lightGray = [250, 250, 250];
    const borderColor = [200, 200, 200];
    
    // HEADER
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, pageWidth, 20, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    
    const titleText = pageNumber === 1 
        ? `PIANIFICAZIONE SETTIMANALE - ${dietData.nome_cliente.toUpperCase()} (Lun-Gio)`
        : `PIANIFICAZIONE SETTIMANALE - ${dietData.nome_cliente.toUpperCase()} (Ven-Dom)`;
    
    doc.text(titleText, pageWidth / 2, 12, { align: 'center' });
    
    // GIORNI HEADER
    let y = 25;
    
    giorniLabels.forEach((giorno, i) => {
        const x = startX + (i * colWidth);
        
        doc.setFillColor(...headerColor);
        doc.rect(x, y, colWidth, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(giorno, x + colWidth/2, y + 8, { align: 'center' });
    });
    
    y += 12;
    
    // PASTI - Mostra sempre tutti e 6 i pasti con i nomi standard
    const nomePasti = ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena', 'Spuntino Ser.'];
    
    // Mappa per gestire le varianti dei nomi
    const mapNomiPasti = {
        'colazione': ['colazione'],
        'spuntino': ['spuntino', 'spuntino mattina', 'spuntino mattutino'],
        'pranzo': ['pranzo'],
        'merenda': ['merenda', 'spuntino pomeridiano'],
        'cena': ['cena'],
        'spuntino ser.': ['spuntino ser.', 'spuntino serale']
    };
    
    // CALCOLO INTELLIGENTE DELLO SPAZIO DISPONIBILE
    const spazioDisponibile = pageHeight - y - 25; // Spazio rimanente meno footer
    
    // Prima passata: calcola il fabbisogno totale di spazio
    let fabbisognoTotale = 0;
    const fabbisogniPasti = [];
    
    nomePasti.forEach((nomePasto, pastoIndex) => {
        // Calcola altezza riga considerando anche le alternative
        let maxFoods = 1;
        giorniKeys.forEach(giorno => {
            const giornoDati = pianificazione.dati_settimanali[giorno] || [];
            
            // Cerca il pasto con nomi varianti
            const nomiVarianti = mapNomiPasti[nomePasto.toLowerCase()] || [nomePasto.toLowerCase()];
            const pasto = giornoDati.find(p => {
                if (p.mealName) {
                    const mealNameLower = p.mealName.toLowerCase();
                    return nomiVarianti.some(variante => mealNameLower === variante);
                }
                return false;
            });
            
            if (pasto) {
                let count = 0;
                if (pasto.foods) count += pasto.foods.length;
                if (pasto.alternatives) count += pasto.alternatives.length;
                maxFoods = Math.max(maxFoods, count || 1);
            }
        });
        
        // Calcola altezza ideale per questo pasto
        const altezzaIdeale = Math.max(18, maxFoods * 3.5 + 8);
        fabbisogniPasti.push(altezzaIdeale);
        fabbisognoTotale += altezzaIdeale;
    });
    
    // Se il fabbisogno totale supera lo spazio disponibile, scala proporzionalmente
    const fattoreScala = fabbisognoTotale > spazioDisponibile ? spazioDisponibile / fabbisognoTotale : 1;
    
    nomePasti.forEach((nomePasto, pastoIndex) => {
        // Usa l'altezza scalata ma con un minimo assoluto
        let rowHeight = Math.max(15, fabbisogniPasti[pastoIndex] * fattoreScala);
        
        // Label pasto con font dinamico
        doc.setFillColor(...lightBlue);
        doc.setDrawColor(...borderColor);
        doc.rect(margin, y, labelWidth, rowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        
        // Font size dinamico per il label del pasto
        let labelFontSize = rowHeight > 20 ? 11 : (rowHeight > 15 ? 10 : 9);
        doc.setFontSize(labelFontSize);
        doc.setFont(undefined, 'bold');
        
        const textY = y + rowHeight/2;
        doc.text(nomePasto.toUpperCase(), margin + labelWidth/2, textY, { 
            align: 'center',
            baseline: 'middle'
        });
        
        // Celle giorni
        giorniKeys.forEach((giorno, giornoIndex) => {
            const x = startX + (giornoIndex * colWidth);
            
            // Sfondo alternato
            if (pastoIndex % 2 === 0) {
                doc.setFillColor(255, 255, 255);
            } else {
                doc.setFillColor(...lightGray);
            }
            
            doc.rect(x, y, colWidth, rowHeight, 'FD');
            
            // Contenuto
            const giornoDati = pianificazione.dati_settimanali[giorno] || [];
            
            // Cerca il pasto con nomi varianti
            const nomiVarianti = mapNomiPasti[nomePasto.toLowerCase()] || [nomePasto.toLowerCase()];
            const pasto = giornoDati.find(p => {
                if (p.mealName) {
                    const mealNameLower = p.mealName.toLowerCase();
                    return nomiVarianti.some(variante => mealNameLower === variante);
                }
                return false;
            });
            
            // Se non c'è il pasto o non ha alimenti, lascia la cella vuota
            if (!pasto || (!pasto.foods || pasto.foods.length === 0) && (!pasto.alternatives || pasto.alternatives.length === 0)) {
                // Cella vuota - non scrivere nulla
            } else {
                // Alimenti
                let foodY = y + 4;
                const spazioDisponibileAlimenti = rowHeight - 8; // Spazio per gli alimenti (meno margini)
                
                // Combina foods e alternatives
                let allFoods = [];
                if (pasto.foods) {
                    pasto.foods.forEach(f => allFoods.push({ ...f, isAlternative: false }));
                }
                if (pasto.alternatives) {
                    pasto.alternatives.forEach(a => allFoods.push({ ...a, isAlternative: true }));
                }
                
                // Ordina se hanno globalOrder
                if (allFoods.length > 0 && allFoods[0].globalOrder !== undefined) {
                    allFoods.sort((a, b) => a.globalOrder - b.globalOrder);
                }
                
                // Calcola spaziatura dinamica per non tagliare alimenti
                const spaziaturaPerAlimento = allFoods.length > 0 ? Math.max(2.5, spazioDisponibileAlimenti / allFoods.length) : 3;
                
                allFoods.forEach((food, foodIndex) => {
                    // Se stiamo per sforare, fermiamoci
                    if (foodY + spaziaturaPerAlimento > y + rowHeight - 2) {
                        return; // Salta questo alimento se non c'è spazio
                    }
                    
                    // Reset stili
                    doc.setTextColor(0, 0, 0);
                    doc.setFont(undefined, 'normal');
                    
                    // Stili per alternative
                    if (food.isAlternative) {
                        doc.setFont(undefined, 'italic');
                        doc.setTextColor(120, 120, 120);
                    }
                    
                    // FONT SIZE DINAMICO basato sullo spazio disponibile per alimento
                    let fontSize = spaziaturaPerAlimento > 4 ? 9 : (spaziaturaPerAlimento > 3 ? 8 : 7);
                    doc.setFontSize(fontSize);
                    
                    let name = food.isAlternative ? `• ${food.nome}` : food.nome;
                    const maxLen = Math.floor(colWidth / (fontSize * 0.35));
                    if (name.length > maxLen) {
                        name = name.substring(0, maxLen - 2) + '..';
                    }
                    
                    // Testo con quantità
                    const text = `${name} ${food.quantita}g`;
                    
                    // Se troppo lungo, vai a capo (solo se c'è spazio)
                    if (doc.getTextWidth(text) > colWidth - 4 && spaziaturaPerAlimento > 3.5) {
                        doc.text(name, x + 2, foodY);
                        foodY += Math.min(2.5, spaziaturaPerAlimento * 0.6);
                        doc.setFontSize(Math.max(6, fontSize - 1));
                        doc.text(`${food.quantita}g`, x + 3, foodY);
                        doc.setFontSize(fontSize);
                        foodY += Math.max(1, spaziaturaPerAlimento * 0.4);
                    } else {
                        doc.text(text, x + 2, foodY);
                        foodY += spaziaturaPerAlimento;
                    }
                });
            }
        });
        
        y += rowHeight;
    });
    
    // FOOTER
    const footerY = pageHeight - 10;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont(undefined, 'normal');
}

function getNomePasti(numPasti) {
    const configurazioni = {
        3: ['Colazione', 'Pranzo', 'Cena'],
        4: ['Colazione', 'Spuntino', 'Pranzo', 'Cena'],
        5: ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena'],
        6: ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena', 'Spuntino Ser.']
    };
    return configurazioni[numPasti] || configurazioni[3];
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
}