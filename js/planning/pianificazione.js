// POST /api/pianificazioni - Salva pianificazione completa
app.post('/api/pianificazioni', async (req, res) => {
  const { dieta_id, configurazione, dati_settimanali, configurazioni_giornaliere, limiti_micronutrienti, cliente_id } = req.body;
  
  try {

    
    // Ottieni cliente_id dalla dieta
    const [dietaInfo] = await connection.query(
      'SELECT cliente_id FROM diete WHERE id = ?',
      [dieta_id]
    );
    
    if (dietaInfo.length === 0) {
      return res.status(404).json({ error: 'Dieta non trovata' });
    }
    
    const cliente_id = dietaInfo[0].cliente_id;

    
    // Elimina pianificazione esistente per questa dieta E cliente
    await connection.query(
      'DELETE FROM pianificazioni_settimanali WHERE dieta_id = ? AND cliente_id = ?', 
      [dieta_id, cliente_id]
    );
    
    // Calcola totali settimanali
    let totaliSettimana = {
      kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
      sodio: 0, potassio: 0, calcio: 0, ferro: 0,
      vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
      vitamina_b1: 0, vitamina_b12: 0, folati: 0
    };
    
    Object.values(dati_settimanali).forEach(giornoData => {
      giornoData.forEach(mealData => {
        mealData.foods.forEach(food => {
          totaliSettimana.kcal += food.kcal || 0;
          totaliSettimana.proteine += food.proteine || 0;
          totaliSettimana.carboidrati += food.carboidrati || 0;
          totaliSettimana.grassi += food.grassi || 0;
          totaliSettimana.sodio += food.sodio || 0;
          totaliSettimana.potassio += food.potassio || 0;
          totaliSettimana.calcio += food.calcio || 0;
          totaliSettimana.ferro += food.ferro || 0;
          totaliSettimana.vitamina_d += food.vitaminaD || 0;
          totaliSettimana.vitamina_a += food.vitaminaA || 0;
          totaliSettimana.vitamina_c += food.vitaminaC || 0;
          totaliSettimana.vitamina_b1 += food.vitaminaB1 || 0;
          totaliSettimana.vitamina_b12 += food.vitaminaB12 || 0;
          totaliSettimana.folati += food.folati || 0;
        });
      });
    });
    
    // Crea pianificazione principale CON cliente_id
    // Crea pianificazione principale CON limiti micronutrienti
    const [pianificazioneResult] = await connection.query(
      `INSERT INTO pianificazioni_settimanali 
       (dieta_id, cliente_id, numero_pasti_giorno, calorie_target_giorno, 
        percentuale_proteine, percentuale_carboidrati, percentuale_grassi,
        limiti_micronutrienti,
        totale_kcal_settimana, totale_proteine_settimana, totale_carboidrati_settimana, totale_grassi_settimana,
        totale_sodio_settimana, totale_potassio_settimana, totale_calcio_settimana, totale_ferro_settimana,
        totale_vitamina_d_settimana, totale_vitamina_a_settimana, totale_vitamina_c_settimana,
        totale_vitamina_b1_settimana, totale_vitamina_b12_settimana, totale_folati_settimana) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dieta_id, 
        cliente_id, 
        configurazione.mealsCount,
        configurazione.dailyKcal,
        configurazione.proteinPercent,
        configurazione.carbsPercent,
        configurazione.fatsPercent,
        JSON.stringify(configurazione.micronutrientLimits || {}), // NUOVO: salva i limiti
        totaliSettimana.kcal, 
        totaliSettimana.proteine, 
        totaliSettimana.carboidrati, 
        totaliSettimana.grassi,
        totaliSettimana.sodio, 
        totaliSettimana.potassio, 
        totaliSettimana.calcio, 
        totaliSettimana.ferro,
        totaliSettimana.vitamina_d, 
        totaliSettimana.vitamina_a, 
        totaliSettimana.vitamina_c,
        totaliSettimana.vitamina_b1, 
        totaliSettimana.vitamina_b12, 
        totaliSettimana.folati
      ]
    );
    const pianificazioneId = pianificazioneResult.insertId;
    
    // Salva giorni, pasti e alimenti
    for (const [nomeGiorno, giornoData] of Object.entries(dati_settimanali)) {
      if (giornoData.length === 0) continue;
      
      // Calcola totali del giorno
      let totaliGiorno = {
        kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
        sodio: 0, potassio: 0, calcio: 0, ferro: 0,
        vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
        vitamina_b1: 0, vitamina_b12: 0, folati: 0
      };
      
      giornoData.forEach(mealData => {
        mealData.foods.forEach(food => {
          totaliGiorno.kcal += food.kcal || 0;
          totaliGiorno.proteine += food.proteine || 0;
          totaliGiorno.carboidrati += food.carboidrati || 0;
          totaliGiorno.grassi += food.grassi || 0;
          totaliGiorno.sodio += food.sodio || 0;
          totaliGiorno.potassio += food.potassio || 0;
          totaliGiorno.calcio += food.calcio || 0;
          totaliGiorno.ferro += food.ferro || 0;
          totaliGiorno.vitamina_d += food.vitaminaD || 0;
          totaliGiorno.vitamina_a += food.vitaminaA || 0;
          totaliGiorno.vitamina_c += food.vitaminaC || 0;
          totaliGiorno.vitamina_b1 += food.vitaminaB1 || 0;
          totaliGiorno.vitamina_b12 += food.vitaminaB12 || 0;
          totaliGiorno.folati += food.folati || 0;
        });
      });
      
      // NUOVO: Recupera le configurazioni del giorno specifico
      let configGiorno = {
        calorie_target: configurazione.dailyKcal || 2000, // Usa i valori dalla configurazione generale come fallback
        percentuale_proteine: configurazione.proteinPercent || 30,
        percentuale_carboidrati: configurazione.carbsPercent || 40,
        percentuale_grassi: configurazione.fatsPercent || 30
      };
      
      // Se esistono configurazioni specifiche per il giorno, usale
      if (configurazioni_giornaliere && configurazioni_giornaliere[nomeGiorno]) {
        const config = configurazioni_giornaliere[nomeGiorno];
        configGiorno.calorie_target = config.dailyKcal || configGiorno.calorie_target;
        configGiorno.percentuale_proteine = config.proteinPercent || configGiorno.percentuale_proteine;
        configGiorno.percentuale_carboidrati = config.carbsPercent || configGiorno.percentuale_carboidrati;
        configGiorno.percentuale_grassi = config.fatsPercent || configGiorno.percentuale_grassi;
      }
      
      // Crea giorno con configurazioni (senza pasti_configurati)
      const [giornoResult] = await connection.query(
        `INSERT INTO pianificazioni_giorni 
         (pianificazione_id, giorno_settimana, 
          calorie_target, percentuale_proteine, percentuale_carboidrati, percentuale_grassi,
          totale_kcal_giorno, totale_proteine_giorno, totale_carboidrati_giorno, totale_grassi_giorno,
          totale_sodio_giorno, totale_potassio_giorno, totale_calcio_giorno, totale_ferro_giorno,
          totale_vitamina_d_giorno, totale_vitamina_a_giorno, totale_vitamina_c_giorno,
          totale_vitamina_b1_giorno, totale_vitamina_b12_giorno, totale_folati_giorno) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pianificazioneId, nomeGiorno,
          configGiorno.calorie_target,
          configGiorno.percentuale_proteine,
          configGiorno.percentuale_carboidrati,
          configGiorno.percentuale_grassi,
          totaliGiorno.kcal, totaliGiorno.proteine, totaliGiorno.carboidrati, totaliGiorno.grassi,
          totaliGiorno.sodio, totaliGiorno.potassio, totaliGiorno.calcio, totaliGiorno.ferro,
          totaliGiorno.vitamina_d, totaliGiorno.vitamina_a, totaliGiorno.vitamina_c,
          totaliGiorno.vitamina_b1, totaliGiorno.vitamina_b12, totaliGiorno.folati
        ]
      );
      const giornoId = giornoResult.insertId;
      
      // Salva pasti del giorno
      for (const mealData of giornoData) {
        // Calcola totali del pasto
        let totaliPasto = {
          kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
          sodio: 0, potassio: 0, calcio: 0, ferro: 0,
          vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
          vitamina_b1: 0, vitamina_b12: 0, folati: 0
        };
        
        mealData.foods.forEach(food => {
          totaliPasto.kcal += food.kcal || 0;
          totaliPasto.proteine += food.proteine || 0;
          totaliPasto.carboidrati += food.carboidrati || 0;
          totaliPasto.grassi += food.grassi || 0;
          totaliPasto.sodio += food.sodio || 0;
          totaliPasto.potassio += food.potassio || 0;
          totaliPasto.calcio += food.calcio || 0;
          totaliPasto.ferro += food.ferro || 0;
          totaliPasto.vitamina_d += food.vitaminaD || 0;
          totaliPasto.vitamina_a += food.vitaminaA || 0;
          totaliPasto.vitamina_c += food.vitaminaC || 0;
          totaliPasto.vitamina_b1 += food.vitaminaB1 || 0;
          totaliPasto.vitamina_b12 += food.vitaminaB12 || 0;
          totaliPasto.folati += food.folati || 0;
        });
        
        // Crea pasto
        const [pastoResult] = await connection.query(
          `INSERT INTO pianificazioni_pasti 
           (giorno_id, nome_pasto, ordine_pasto, totale_kcal_pasto, totale_proteine_pasto, totale_carboidrati_pasto, totale_grassi_pasto,
            totale_sodio_pasto, totale_potassio_pasto, totale_calcio_pasto, totale_ferro_pasto,
            totale_vitamina_d_pasto, totale_vitamina_a_pasto, totale_vitamina_c_pasto,
            totale_vitamina_b1_pasto, totale_vitamina_b12_pasto, totale_folati_pasto) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            giornoId, mealData.mealName, mealData.mealIndex,
            totaliPasto.kcal, totaliPasto.proteine, totaliPasto.carboidrati, totaliPasto.grassi,
            totaliPasto.sodio, totaliPasto.potassio, totaliPasto.calcio, totaliPasto.ferro,
            totaliPasto.vitamina_d, totaliPasto.vitamina_a, totaliPasto.vitamina_c,
            totaliPasto.vitamina_b1, totaliPasto.vitamina_b12, totaliPasto.folati
          ]
        );
        const pastoId = pastoResult.insertId;
        
        // Salva alimenti del pasto
// Salva alimenti principali del pasto
// Salva alimenti del pasto (principali e alternative insieme)
let ordineGlobale = 0; // Contatore unico per l'ordine

// Prima salva tutti gli alimenti principali
// Combina tutti gli alimenti (principali + alternative) in un unico array
const allFoods = [];

// Aggiungi alimenti principali
mealData.foods.forEach((food, index) => {
  allFoods.push({
    ...food,
    is_alternative: false,
    orderIndex: food.globalOrder !== undefined ? food.globalOrder : index
  });
});

// Aggiungi alternative
if (mealData.alternatives && mealData.alternatives.length > 0) {
  mealData.alternatives.forEach((alt, index) => {
    allFoods.push({
      ...alt,
      is_alternative: true,
      orderIndex: alt.globalOrder !== undefined ? alt.globalOrder : mealData.foods.length + index
    });
  });
}

// Ordina per orderIndex per mantenere l'ordine corretto
allFoods.sort((a, b) => a.orderIndex - b.orderIndex);

// Salva tutti gli alimenti in un unico ciclo
for (let i = 0; i < allFoods.length; i++) {
  const food = allFoods[i];
  
  const [alimentoResult] = await connection.query(
    'SELECT ID FROM alimenti WHERE Nome = ? LIMIT 1',
    [food.nome]
  );
  const alimentoId = alimentoResult.length > 0 ? alimentoResult[0].ID : null;
  
  await connection.query(
    `INSERT INTO pianificazioni_alimenti 
     (pasto_id, alimento_id, nome_alimento, quantita, ordine_alimento, is_alternative,
      kcal_calcolate, proteine_calcolate, carboidrati_calcolati, grassi_calcolati,
      sodio_calcolato, potassio_calcolato, calcio_calcolato, ferro_calcolato,
      vitamina_d_calcolata, vitamina_a_calcolata, vitamina_c_calcolata,
      vitamina_b1_calcolata, vitamina_b12_calcolata, folati_calcolati)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pastoId, alimentoId, food.nome, food.quantita, 
      i, // Usa l'indice del ciclo come ordine_alimento
      food.is_alternative,
      food.kcal || 0, food.proteine || 0, food.carboidrati || 0, food.grassi || 0,
      food.sodio || 0, food.potassio || 0, food.calcio || 0, food.ferro || 0,
      food.vitaminaD || 0, food.vitaminaA || 0, food.vitaminaC || 0,
      food.vitaminaB1 || 0, food.vitaminaB12 || 0, food.folati || 0
    ]
  );
}
      }
    }
    

    res.json({ success: true, pianificazione_id: pianificazioneId, cliente_id: cliente_id });
    
  } catch (error) {
    console.error('❌ Errore salvataggio pianificazione:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pianificazioni/dieta/:dietaId/completa - Carica pianificazione completa
app.get('/api/pianificazioni/dieta/:dietaId/completa', async (req, res) => {
  const { dietaId } = req.params;
  
  try {
    console.log(`🔍 Caricamento pianificazione per dieta ${dietaId}`);
    
    // Prima ottieni il cliente_id dalla dieta
    const [dietaInfo] = await connection.query(
      'SELECT cliente_id FROM diete WHERE id = ?',
      [dietaId]
    );
    
    if (dietaInfo.length === 0) {
      return res.status(404).json({ message: 'Dieta non trovata' });
    }
    
    const cliente_id = dietaInfo[0].cliente_id;
    
    // Carica pianificazione principale con controllo cliente_id
    const [pianificazioni] = await connection.query(
      'SELECT * FROM pianificazioni_settimanali WHERE dieta_id = ? AND cliente_id = ?',
      [dietaId, cliente_id]
    );
    
    if (pianificazioni.length === 0) {
      return res.status(404).json({ message: 'Nessuna pianificazione trovata' });
    }
    
    const pianificazione = pianificazioni[0];
    
    // Carica dati completi degli alimenti PRIMA
    const [datiCompleti] = await connection.query(`
      SELECT 
        g.giorno_settimana,
        p.nome_pasto, p.ordine_pasto,
        a.nome_alimento, a.quantita, a.ordine_alimento, a.is_alternative,
        a.kcal_calcolate, a.proteine_calcolate, a.carboidrati_calcolati, a.grassi_calcolati,
        a.sodio_calcolato, a.potassio_calcolato, a.calcio_calcolato, a.ferro_calcolato,
        a.vitamina_d_calcolata, a.vitamina_a_calcolata, a.vitamina_c_calcolata,
        a.vitamina_b1_calcolata, a.vitamina_b12_calcolata, a.folati_calcolati
      FROM pianificazioni_giorni g
      INNER JOIN pianificazioni_pasti p ON g.id = p.giorno_id
      INNER JOIN pianificazioni_alimenti a ON p.id = a.pasto_id
      WHERE g.pianificazione_id = ?
      ORDER BY 
        CASE g.giorno_settimana 
          WHEN 'lunedi' THEN 1 WHEN 'martedi' THEN 2 WHEN 'mercoledi' THEN 3 
          WHEN 'giovedi' THEN 4 WHEN 'venerdi' THEN 5 WHEN 'sabato' THEN 6 
          WHEN 'domenica' THEN 7 
        END,
        p.ordine_pasto, 
        a.ordine_alimento
    `, [pianificazione.id]);

    // DOPO carica le configurazioni giornaliere dalla tabella pianificazioni_giorni
    const [configurazioniGiornaliere] = await connection.query(`
      SELECT 
        giorno_settimana,
        calorie_target,
        percentuale_proteine,
        percentuale_carboidrati,
        percentuale_grassi
      FROM pianificazioni_giorni 
      WHERE pianificazione_id = ?
      ORDER BY 
        CASE giorno_settimana 
          WHEN 'lunedi' THEN 1 WHEN 'martedi' THEN 2 WHEN 'mercoledi' THEN 3 
          WHEN 'giovedi' THEN 4 WHEN 'venerdi' THEN 5 WHEN 'sabato' THEN 6 
          WHEN 'domenica' THEN 7 
        END
    `, [pianificazione.id]);
    
    // Organizza le configurazioni giornaliere
    const configurazioni_giornaliere = {};
    configurazioniGiornaliere.forEach(config => {
      // Ora posso usare datiCompleti perché è già definito
      const pasti = datiCompleti.filter(row => row.giorno_settimana === config.giorno_settimana);
      const pastiUnici = [...new Set(pasti.map(row => row.nome_pasto))];
      
      configurazioni_giornaliere[config.giorno_settimana] = {
        dailyKcal: parseInt(config.calorie_target) || 2000,
        proteinPercent: parseInt(config.percentuale_proteine) || 30,
        carbsPercent: parseInt(config.percentuale_carboidrati) || 40,
        fatsPercent: parseInt(config.percentuale_grassi) || 30,
        mealsCount: pastiUnici.length,
        selectedMeals: pastiUnici
      };
    });

    // Organizza i dati degli alimenti
    const giorniOrganizzati = {
      lunedi: [], martedi: [], mercoledi: [], giovedi: [],
      venerdi: [], sabato: [], domenica: []
    };

    const pastiMap = new Map();

    datiCompleti.forEach(row => {
      const chiavePasto = `${row.giorno_settimana}_${row.nome_pasto}_${row.ordine_pasto}`;
      
      if (!pastiMap.has(chiavePasto)) {
        pastiMap.set(chiavePasto, {
          giorno: row.giorno_settimana,
          mealName: row.nome_pasto,
          mealIndex: row.ordine_pasto,
          foods: [],
          alternatives: []
        });
      }
      
      const pasto = pastiMap.get(chiavePasto);
      const foodData = {
        nome: row.nome_alimento,
        quantita: parseFloat(row.quantita),
        kcal: parseFloat(row.kcal_calcolate) || 0,
        proteine: parseFloat(row.proteine_calcolate) || 0,
        carboidrati: parseFloat(row.carboidrati_calcolati) || 0,
        grassi: parseFloat(row.grassi_calcolati) || 0,
        sodio: parseFloat(row.sodio_calcolato) || 0,
        potassio: parseFloat(row.potassio_calcolato) || 0,
        calcio: parseFloat(row.calcio_calcolato) || 0,
        ferro: parseFloat(row.ferro_calcolato) || 0,
        vitaminaD: parseFloat(row.vitamina_d_calcolata) || 0,
        vitaminaA: parseFloat(row.vitamina_a_calcolata) || 0,
        vitaminaC: parseFloat(row.vitamina_c_calcolata) || 0,
        vitaminaB1: parseFloat(row.vitamina_b1_calcolata) || 0,
        vitaminaB12: parseFloat(row.vitamina_b12_calcolata) || 0,
        folati: parseFloat(row.folati_calcolati) || 0,
        globalOrder: row.ordine_alimento
      };
      
      // Distingui tra alimenti principali e alternative
      if (row.is_alternative) {
        pasto.alternatives.push(foodData);
      } else {
        pasto.foods.push(foodData);
      }
    });

    // Organizza i pasti per giorno
    pastiMap.forEach(pasto => {
      if (giorniOrganizzati[pasto.giorno]) {
        giorniOrganizzati[pasto.giorno].push({
          mealName: pasto.mealName,
          mealIndex: pasto.mealIndex,
          foods: pasto.foods,
          alternatives: pasto.alternatives
        });
      }
    });
    
    // Aggiungi i dati organizzati alla pianificazione
    pianificazione.dati_settimanali = giorniOrganizzati;
    
    // NUOVO: Aggiungi le configurazioni giornaliere
    pianificazione.configurazioni_giornaliere = configurazioni_giornaliere;
    
    // Gestisci i limiti micronutrienti
    if (pianificazione.limiti_micronutrienti) {
        if (typeof pianificazione.limiti_micronutrienti === 'string') {
            try {
                pianificazione.limiti_micronutrienti = JSON.parse(pianificazione.limiti_micronutrienti);
            } catch (e) {
                console.error('Errore parsing limiti micronutrienti:', e);
                pianificazione.limiti_micronutrienti = {};
            }
        }
    } else {
        pianificazione.limiti_micronutrienti = {};
    }
    
    console.log(`✅ Pianificazione caricata con configurazioni giornaliere:`, configurazioni_giornaliere);
    
    res.json({ pianificazione });
    
  } catch (error) {
    console.error('❌ Errore ricerca pianificazione:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pianificazioni/dieta/:dietaId - Pianificazione base
app.get('/api/pianificazioni/dieta/:dietaId', async (req, res) => {
  const { dietaId } = req.params;
  
  try {
    const [pianificazioni] = await connection.query(
      'SELECT * FROM pianificazioni_settimanali WHERE dieta_id = ?',
      [dietaId]
    );
    
    if (pianificazioni.length === 0) {
      return res.status(404).json({ message: 'Nessuna pianificazione trovata' });
    }
    
    res.json({ pianificazione: pianificazioni[0] });
    
  } catch (error) {
    console.error('❌ Errore ricerca pianificazione:', error);
    res.status(500).json({ error: error.message });
  }
});

//#endregion