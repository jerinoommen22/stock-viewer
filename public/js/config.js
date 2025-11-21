// DOM Elements
const tickerInput = document.getElementById('ticker-input');
const addTickerBtn = document.getElementById('add-ticker-btn');
const tickerList = document.getElementById('ticker-list');
const weatherInput = document.getElementById('weather-input');
const intervalInput = document.getElementById('interval-input');
const saveConfigBtn = document.getElementById('save-config-btn');
const resetConfigBtn = document.getElementById('reset-config-btn');
const saveMessage = document.getElementById('save-message');

// State
let config = {
    tickers: [],
    weatherLocation: '',
    refreshInterval: 15000
};

// Load configuration from server
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load config');
        
        config = await response.json();
        updateUI();
    } catch (error) {
        console.error('Error loading config:', error);
        showMessage('Failed to load configuration', 'error');
    }
}

// Save configuration to server
async function saveConfig() {
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) throw new Error('Failed to save config');
        
        const result = await response.json();
        showMessage('Configuration saved successfully! Changes will take effect on the dashboard.', 'success');
        
        // Reload page after 2 seconds to show updated config
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } catch (error) {
        console.error('Error saving config:', error);
        showMessage('Failed to save configuration', 'error');
    }
}

// Update UI with current configuration
function updateUI() {
    // Update ticker list
    renderTickerList();
    
    // Update weather input
    weatherInput.value = config.weatherLocation || '';
    
    // Update interval input (convert from ms to seconds)
    intervalInput.value = (config.refreshInterval || 15000) / 1000;
}

// Render ticker list
function renderTickerList() {
    if (!config.tickers || config.tickers.length === 0) {
        tickerList.innerHTML = '<p style="color: var(--text-secondary);">No tickers added yet. Add some above!</p>';
        return;
    }
    
    tickerList.innerHTML = config.tickers.map((ticker, index) => `
        <div class="ticker-item">
            <span class="ticker-symbol">${ticker}</span>
            <button class="btn btn-danger" onclick="removeTicker(${index})">Remove</button>
        </div>
    `).join('');
}

// Add ticker
function addTicker() {
    const ticker = tickerInput.value.trim().toUpperCase();
    
    if (!ticker) {
        showMessage('Please enter a stock symbol', 'error');
        return;
    }
    
    // Validate ticker format (basic validation)
    if (!/^[A-Z]{1,10}$/.test(ticker)) {
        showMessage('Invalid stock symbol format', 'error');
        return;
    }
    
    // Check if already exists
    if (config.tickers.includes(ticker)) {
        showMessage(`${ticker} is already in your list`, 'error');
        return;
    }
    
    // Add to config
    config.tickers.push(ticker);
    
    // Update UI
    renderTickerList();
    tickerInput.value = '';
    
    showMessage(`${ticker} added to your list`, 'success');
}

// Remove ticker
function removeTicker(index) {
    const ticker = config.tickers[index];
    config.tickers.splice(index, 1);
    renderTickerList();
    showMessage(`${ticker} removed from your list`, 'success');
}

// Show message
function showMessage(text, type) {
    saveMessage.textContent = text;
    saveMessage.className = `save-message ${type}`;
    saveMessage.classList.remove('hidden');
    
    // Hide after 5 seconds
    setTimeout(() => {
        saveMessage.classList.add('hidden');
    }, 5000);
}

// Save all configuration
function saveAllConfig() {
    // Update config from inputs
    config.weatherLocation = weatherInput.value.trim() || 'New York';
    
    // Convert interval from seconds to milliseconds
    const intervalSeconds = parseInt(intervalInput.value) || 15;
    config.refreshInterval = Math.max(5, Math.min(60, intervalSeconds)) * 1000;
    
    // Validate
    if (!config.tickers || config.tickers.length === 0) {
        showMessage('Please add at least one stock ticker', 'error');
        return;
    }
    
    // Save to server
    saveConfig();
}

// Reset to defaults
function resetConfig() {
    if (!confirm('Are you sure you want to reset to default configuration?')) {
        return;
    }
    
    config = {
        tickers: ['AAPL', 'TSLA', 'MSFT', 'GOOGL'],
        weatherLocation: 'New York',
        refreshInterval: 15000
    };
    
    updateUI();
    showMessage('Configuration reset to defaults', 'success');
}

// Event Listeners
addTickerBtn.addEventListener('click', addTicker);

tickerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTicker();
    }
});

saveConfigBtn.addEventListener('click', saveAllConfig);
resetConfigBtn.addEventListener('click', resetConfig);

// Input validation for interval
intervalInput.addEventListener('input', () => {
    const value = parseInt(intervalInput.value);
    if (value < 5) intervalInput.value = 5;
    if (value > 60) intervalInput.value = 60;
});

// Make removeTicker available globally
window.removeTicker = removeTicker;

// Initialize
loadConfig();

