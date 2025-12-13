// DOM Elements
const tickerInput = document.getElementById('ticker-input');
const addTickerBtn = document.getElementById('add-ticker-btn');
const tickerList = document.getElementById('ticker-list');
const weatherInput = document.getElementById('weather-input');
const intervalInput = document.getElementById('interval-input');
const saveConfigBtn = document.getElementById('save-config-btn');
const resetConfigBtn = document.getElementById('reset-config-btn');
const saveMessage = document.getElementById('save-message');

// Spotify Elements
const spotifyAuthSection = document.getElementById('spotify-auth-section');
const spotifySearchSection = document.getElementById('spotify-search-section');
const spotifyLoginBtn = document.getElementById('spotify-login-btn');
const spotifySearchInput = document.getElementById('spotify-search-input');
const spotifySearchBtn = document.getElementById('spotify-search-btn');
const spotifyResults = document.getElementById('spotify-results');
const spotifySelected = document.getElementById('spotify-selected');
const spotifySelectedContent = document.getElementById('spotify-selected-content');
const spotifyClearBtn = document.getElementById('spotify-clear-btn');

// Spotify Player Controls (on config page)
const spotifyPlayPauseBtn = document.getElementById('spotify-play-pause-btn');
const spotifyPrevBtn = document.getElementById('spotify-prev-btn');
const spotifyNextBtn = document.getElementById('spotify-next-btn');
const spotifyVolumeSlider = document.getElementById('spotify-volume-slider');

// State
let config = {
    tickers: [],
    weatherLocation: '',
    refreshInterval: 15000,
    spotify: {
        enabled: false,
        accessToken: null,
        selectedItem: null
    }
};

// Spotify Player State (for config page)
let spotifyPlayerInstance = null;
let spotifyDeviceId = null;
let spotifyIsPlaying = false;

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
    
    // Update Spotify UI
    updateSpotifyUI();
}

// Update Spotify UI
function updateSpotifyUI() {
    if (config.spotify && config.spotify.accessToken) {
        spotifyAuthSection.classList.add('hidden');
        spotifySearchSection.classList.remove('hidden');
        
        if (config.spotify.selectedItem) {
            renderSelectedSpotifyItem(config.spotify.selectedItem);
        }
        
        // Initialize player if not already initialized
        if (!spotifyPlayerInstance) {
            initSpotifyPlayer();
        }
    } else {
        spotifyAuthSection.classList.remove('hidden');
        spotifySearchSection.classList.add('hidden');
    }
}

// Render selected Spotify item
function renderSelectedSpotifyItem(item) {
    spotifySelected.classList.remove('hidden');
    spotifySelectedContent.innerHTML = `
        <img src="${item.image || 'https://via.placeholder.com/80'}" alt="${item.name}" class="spotify-selected-image">
        <div class="spotify-selected-info">
            <div class="spotify-selected-name">${item.name}</div>
            <div class="spotify-selected-type">${item.type}${item.artist ? ` • ${item.artist}` : ''}</div>
        </div>
    `;
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

// Spotify Functions
async function handleSpotifyLogin() {
    try {
        const response = await fetch('/api/spotify/auth-url');
        if (!response.ok) throw new Error('Failed to get auth URL');
        const data = await response.json();
        window.location.href = data.authUrl;
    } catch (error) {
        console.error('Error initiating Spotify login:', error);
        showMessage('Failed to connect to Spotify', 'error');
    }
}

async function handleSpotifySearch() {
    const query = spotifySearchInput.value.trim();
    if (!query) {
        showMessage('Please enter a search query', 'error');
        return;
    }
    
    if (!config.spotify || !config.spotify.accessToken) {
        showMessage('Please connect to Spotify first', 'error');
        return;
    }
    
    try {
        spotifyResults.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Searching...</p>';
        
        const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${config.spotify.accessToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                showMessage('Spotify session expired. Please reconnect.', 'error');
                config.spotify.accessToken = null;
                updateSpotifyUI();
                return;
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Search failed');
        }
        
        const data = await response.json();
        if (!data || !data.items) {
            throw new Error('Invalid response from server');
        }
        
        renderSpotifyResults(data);
    } catch (error) {
        console.error('Error searching Spotify:', error);
        const errorMessage = error.message || 'Failed to search Spotify';
        showMessage(errorMessage, 'error');
        spotifyResults.innerHTML = `<p style="text-align: center; color: var(--accent-red);">${errorMessage}</p>`;
    }
}

let currentSpotifyResults = [];

function renderSpotifyResults(data) {
    if (!data || !data.items || data.items.length === 0) {
        spotifyResults.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No results found</p>';
        currentSpotifyResults = [];
        return;
    }
    
    // Filter out any invalid items
    const validItems = data.items.filter(item => item && item.id && item.uri && item.name);
    currentSpotifyResults = validItems;
    
    if (validItems.length === 0) {
        spotifyResults.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No valid results found</p>';
        return;
    }
    
    spotifyResults.innerHTML = validItems.map((item, index) => {
        if (!item || !item.id) return ''; // Skip invalid items
        
        const image = item.images && item.images.length > 0 ? item.images[0].url : null;
        const artist = item.artists && item.artists.length > 0 
            ? item.artists.map(a => a && a.name ? a.name : '').filter(Boolean).join(', ') 
            : (item.artist || null);
        const isSelected = config.spotify && config.spotify.selectedItem && 
                          config.spotify.selectedItem.id === item.id &&
                          config.spotify.selectedItem.type === item.type;
        
        return `
            <div class="spotify-result-item ${isSelected ? 'selected' : ''}" 
                 onclick="selectSpotifyItem(${index})">
                <img src="${image || 'https://via.placeholder.com/60'}" alt="${item.name || 'Unknown'}" class="spotify-result-image">
                <div class="spotify-result-info">
                    <div class="spotify-result-name">${item.name || 'Unknown'}</div>
                    <div class="spotify-result-type">${item.type || 'track'}</div>
                    ${artist ? `<div class="spotify-result-artist">${artist}</div>` : ''}
                </div>
            </div>
        `;
    }).filter(Boolean).join('');
}

function selectSpotifyItem(index) {
    const itemData = currentSpotifyResults[index];
    if (!itemData || !itemData.id || !itemData.uri) {
        showMessage('Invalid item selected', 'error');
        return;
    }
    
    const item = {
        id: itemData.id,
        type: itemData.type || 'track',
        name: itemData.name || 'Unknown',
        image: itemData.images && itemData.images.length > 0 ? itemData.images[0].url : null,
        artist: itemData.artists && itemData.artists.length > 0
            ? itemData.artists.map(a => a && a.name ? a.name : '').filter(Boolean).join(', ')
            : (itemData.artist || null),
        uri: itemData.uri
    };
    
    if (!config.spotify) {
        config.spotify = { enabled: false, accessToken: null, selectedItem: null };
    }
    
    config.spotify.selectedItem = item;
    config.spotify.enabled = true;
    
    renderSelectedSpotifyItem(item);
    renderSpotifyResults({ items: currentSpotifyResults }); // Re-render to show selection
    
    // Auto-save config when item is selected
    saveConfig();
    
    // Play the selected item if player is ready
    if (spotifyDeviceId && config.spotify.accessToken) {
        playSpotifyItem(item);
    }
    
    showMessage(`${item.name} selected`, 'success');
}

function clearSpotifySelection() {
    config.spotify.selectedItem = null;
    config.spotify.enabled = false;
    spotifySelected.classList.add('hidden');
    showMessage('Spotify selection cleared', 'success');
}

// Make functions available globally
window.removeTicker = removeTicker;
window.selectSpotifyItem = selectSpotifyItem;

// Event Listeners
spotifyLoginBtn.addEventListener('click', handleSpotifyLogin);
spotifySearchBtn.addEventListener('click', handleSpotifySearch);
spotifySearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSpotifySearch();
    }
});
spotifyClearBtn.addEventListener('click', clearSpotifySelection);

// Spotify Player Functions (for config page)
async function initializeSpotifyPlayer() {
    if (!window.Spotify || !config.spotify || !config.spotify.accessToken) {
        return;
    }

    try {
        spotifyPlayerInstance = new Spotify.Player({
            name: 'Stock Viewer Config Player',
            getOAuthToken: cb => {
                cb(config.spotify.accessToken);
            },
            volume: 0.5
        });

        // Error handling
        spotifyPlayerInstance.addListener('initialization_error', ({message}) => {
            console.error('Spotify initialization error:', message);
        });

        spotifyPlayerInstance.addListener('authentication_error', ({message}) => {
            console.error('Spotify authentication error:', message);
        });

        spotifyPlayerInstance.addListener('account_error', ({message}) => {
            console.error('Spotify account error:', message);
        });

        // Ready
        spotifyPlayerInstance.addListener('ready', ({device_id}) => {
            console.log('Spotify player ready with device ID:', device_id);
            spotifyDeviceId = device_id;
            
            // If there's a selected item, play it
            if (config.spotify && config.spotify.selectedItem) {
                // Small delay to ensure device is fully ready
                setTimeout(() => {
                    playSpotifyItem(config.spotify.selectedItem);
                }, 500);
            }
        });

        // Not ready
        spotifyPlayerInstance.addListener('not_ready', ({device_id}) => {
            console.log('Spotify device has gone offline:', device_id);
        });

        // Player state changed
        spotifyPlayerInstance.addListener('player_state_changed', state => {
            if (!state) return;
            spotifyIsPlaying = !state.paused;
            updatePlayPauseButton();
        });

        // Connect to the player
        await spotifyPlayerInstance.connect();
    } catch (error) {
        console.error('Error initializing Spotify player:', error);
    }
}

async function ensureDeviceActive() {
    if (!spotifyDeviceId || !config.spotify || !config.spotify.accessToken) {
        return false;
    }

    try {
        // Transfer playback to our device
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.spotify.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device_ids: [spotifyDeviceId],
                play: false
            })
        });
        return response.ok || response.status === 204;
    } catch (error) {
        console.error('Error activating device:', error);
        return false;
    }
}

async function playSpotifyItem(item) {
    if (!spotifyDeviceId || !config.spotify || !config.spotify.accessToken) {
        console.log('Waiting for player to be ready...');
        return;
    }

    try {
        // Ensure device is active
        await ensureDeviceActive();
        
        // Small delay to ensure device activation
        await new Promise(resolve => setTimeout(resolve, 300));

        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.spotify.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                context_uri: item.type === 'playlist' ? item.uri : null,
                uris: item.type === 'track' ? [item.uri] : null
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Error playing Spotify item:', error);
            showMessage('Failed to play. Make sure Spotify is open on another device or try again.', 'error');
        } else {
            spotifyIsPlaying = true;
            updatePlayPauseButton();
        }
    } catch (error) {
        console.error('Error playing Spotify:', error);
        showMessage('Error playing music', 'error');
    }
}

function updatePlayPauseButton() {
    if (!spotifyPlayPauseBtn) return;
    if (spotifyIsPlaying) {
        spotifyPlayPauseBtn.textContent = '⏸ Pause';
    } else {
        spotifyPlayPauseBtn.textContent = '▶ Play';
    }
}

async function togglePlayPause() {
    if (!spotifyPlayerInstance || !spotifyDeviceId || !config.spotify || !config.spotify.accessToken) {
        console.error('Spotify player not ready');
        showMessage('Player not ready. Please wait...', 'error');
        return;
    }

    try {
        // Ensure device is active first
        await ensureDeviceActive();
        
        const state = await spotifyPlayerInstance.getCurrentState();
        if (!state) {
            // If no state, try to resume/start playback
            if (config.spotify.selectedItem) {
                await playSpotifyItem(config.spotify.selectedItem);
            } else {
                showMessage('No track selected', 'error');
            }
            return;
        }

        // Use REST API for more reliable control
        const action = state.paused ? 'play' : 'pause';
        const response = await fetch(`https://api.spotify.com/v1/me/player/${action}?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.spotify.accessToken}`
            }
        });

        if (!response.ok && response.status !== 204) {
            // Fallback to SDK methods
            if (state.paused) {
                await spotifyPlayerInstance.resume();
            } else {
                await spotifyPlayerInstance.pause();
            }
        }
    } catch (error) {
        console.error('Error toggling play/pause:', error);
        showMessage('Failed to control playback', 'error');
    }
}

async function playPrevious() {
    if (!spotifyPlayerInstance || !spotifyDeviceId || !config.spotify || !config.spotify.accessToken) {
        console.error('Spotify player not ready');
        showMessage('Player not ready', 'error');
        return;
    }
    
    try {
        await ensureDeviceActive();
        
        const response = await fetch(`https://api.spotify.com/v1/me/player/previous?device_id=${spotifyDeviceId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.spotify.accessToken}`
            }
        });

        if (!response.ok && response.status !== 204) {
            // Fallback to SDK method
            await spotifyPlayerInstance.previousTrack();
        }
    } catch (error) {
        console.error('Error playing previous track:', error);
        showMessage('Failed to play previous track', 'error');
    }
}

async function playNext() {
    if (!spotifyPlayerInstance || !spotifyDeviceId || !config.spotify || !config.spotify.accessToken) {
        console.error('Spotify player not ready');
        showMessage('Player not ready', 'error');
        return;
    }
    
    try {
        await ensureDeviceActive();
        
        const response = await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${spotifyDeviceId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.spotify.accessToken}`
            }
        });

        if (!response.ok && response.status !== 204) {
            // Fallback to SDK method
            await spotifyPlayerInstance.nextTrack();
        }
    } catch (error) {
        console.error('Error playing next track:', error);
        showMessage('Failed to play next track', 'error');
    }
}

function setVolume(value) {
    if (!spotifyPlayerInstance) return;
    const volume = value / 100;
    spotifyPlayerInstance.setVolume(volume);
}

// Spotify Player Event Listeners - Set up after DOM is ready
function setupSpotifyEventListeners() {
    if (spotifyPlayPauseBtn) {
        spotifyPlayPauseBtn.addEventListener('click', togglePlayPause);
    }
    if (spotifyPrevBtn) {
        spotifyPrevBtn.addEventListener('click', playPrevious);
    }
    if (spotifyNextBtn) {
        spotifyNextBtn.addEventListener('click', playNext);
    }
    if (spotifyVolumeSlider) {
        spotifyVolumeSlider.addEventListener('input', (e) => {
            setVolume(e.target.value);
        });
    }
}

// Set up event listeners when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSpotifyEventListeners);
} else {
    setupSpotifyEventListeners();
}

// Check for Spotify callback
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
        showMessage('Spotify authentication failed', 'error');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code) {
        // Exchange code for token
        fetch('/api/spotify/callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.accessToken) {
                // Reload config from server to get the saved token
                loadConfig().then(() => {
                    showMessage('Successfully connected to Spotify! You can now search for music.', 'success');
                });
            } else {
                showMessage('Failed to connect to Spotify', 'error');
            }
        })
        .catch(err => {
            console.error('Error exchanging code:', err);
            showMessage('Failed to connect to Spotify', 'error');
        })
        .finally(() => {
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
});

// Initialize
loadConfig();

// Initialize Spotify player when SDK is ready
function initSpotifyPlayer() {
    if (window.Spotify) {
        // Wait a bit for config to load
        setTimeout(() => {
            if (config.spotify && config.spotify.accessToken && !spotifyPlayerInstance) {
                initializeSpotifyPlayer();
            }
        }, 1000);
    } else {
        window.onSpotifyWebPlaybackSDKReady = () => {
            if (config.spotify && config.spotify.accessToken && !spotifyPlayerInstance) {
                initializeSpotifyPlayer();
            }
        };
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    initSpotifyPlayer();
});

// Also try to initialize after config loads
// This will be called from loadConfig() after it completes


