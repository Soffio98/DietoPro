// === UTILS.JS - FUNZIONI DI UTILITÀ GENERALE ===

// === UTILITY FUNCTIONS ===
function getBmiClass(bmi) {
    if (bmi < 18.5) return 'bmi-sottopeso';
    if (bmi <= 24.9) return 'bmi-normale';
    if (bmi <= 29.9) return 'bmi-sovrappeso';
    return 'bmi-obesita';
}

function getBmiLabel(bmi) {
    if (bmi < 18.5) return 'Sottopeso';
    if (bmi <= 24.9) return 'Normale';
    if (bmi <= 29.9) return 'Sovrappeso';
    return 'Obesità';
}

function formatDate(dateString) {
    if (!dateString) return 'N/D';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// === SISTEMA MESSAGGI ===
function showMessage(message, type = 'success', duration = 5000) {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    let messagesContainer = document.getElementById('messages');
    
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.id = 'messages';
        messagesContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        document.body.appendChild(messagesContainer);
    }
    
    const messageDiv = document.createElement('div');
    const messageStyles = {
        success: 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;',
        error: 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;',
        warning: 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;',
        info: 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;'
    };
    
    messageDiv.className = `alert alert-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        padding: 15px 20px; border-radius: 10px; margin-bottom: 10px;
        font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        cursor: pointer; animation: slideInRight 0.3s ease-out;
        ${messageStyles[type] || messageStyles.info}
    `;
    
    // Aggiungi animazione CSS se non esiste
    if (!document.getElementById('message-animations')) {
        const style = document.createElement('style');
        style.id = 'message-animations';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    messagesContainer.appendChild(messageDiv);
    
    // Auto-remove
    setTimeout(() => {
        if (messageDiv.parentNode) messageDiv.remove();
    }, duration);
    
    // Click per rimuovere
    messageDiv.onclick = () => messageDiv.remove();
}