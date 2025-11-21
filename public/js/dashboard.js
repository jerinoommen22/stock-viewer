// Initialize Socket.IO connection
const socket = io();

// DOM Elements
const stocksGrid = document.getElementById('stocks-grid');
const loading = document.getElementById('loading');
const marketStatus = document.getElementById('market-status');
const dateTime = document.getElementById('date-time');
const weatherTemp = document.getElementById('weather-temp');
const weatherCondition = document.getElementById('weather-condition');
const weatherIconImg = document.getElementById('weather-icon-img');
const marketClosedBanner = document.getElementById('market-closed-banner');
const connectionStatus = document.getElementById('connection-status');

// State
let currentStocks = [];
let isConnected = false;
let charts = {}; // Store chart instances

// Format price with proper decimals
function formatPrice(price) {
    return parseFloat(price).toFixed(2);
}

// Format large numbers (market cap, volume)
function formatLargeNumber(num) {
    if (!num || num === 0) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(0);
}

// Format ratio (P/E, Beta, etc.)
function formatRatio(num) {
    if (!num || num === null || num === undefined) return 'N/A';
    return parseFloat(num).toFixed(2);
}

// Format percentage
function formatPercentage(num) {
    if (!num || num === null || num === undefined) return 'N/A';
    return (parseFloat(num) * 100).toFixed(2) + '%';
}

// Format change value with sign
function formatChange(change) {
    const formatted = parseFloat(change).toFixed(2);
    return change >= 0 ? `+$${formatted}` : `-$${Math.abs(formatted)}`;
}

// Format percent change with sign
function formatPercentChange(percent) {
    const formatted = parseFloat(percent).toFixed(2);
    return percent >= 0 ? `+${formatted}%` : `${formatted}%`;
}

// Get arrow icon based on change
function getArrowIcon(change) {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '▬';
}

// Get card class based on change
function getCardClass(change) {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
}

// Create chart for a stock
function createChart(canvas, stock) {
    const ctx = canvas.getContext('2d');
    
    // Get history data
    const history = stock.history;
    if (!history || !history.prices || history.prices.length === 0) {
        return null;
    }
    
    // Determine if stock is up or down overall
    const firstPrice = history.prices[0];
    const lastPrice = history.prices[history.prices.length - 1];
    const isPositive = lastPrice >= firstPrice;
    
    const chartColor = isPositive 
        ? 'rgba(0, 200, 5, 1)' 
        : 'rgba(255, 87, 87, 1)';
    const gradientColor = isPositive
        ? 'rgba(0, 200, 5, 0.1)'
        : 'rgba(255, 87, 87, 0.1)';
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, gradientColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.timestamps.map(t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
                data: history.prices,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: chartColor,
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(26, 31, 36, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#b8b8b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6e7175',
                        font: {
                            size: 10
                        },
                        maxRotation: 0,
                        autoSkipPadding: 20
                    }
                },
                y: {
                    display: true,
                    position: 'right',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6e7175',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    return chart;
}

// Create stock card HTML
function createStockCard(stock) {
    const cardClass = getCardClass(stock.change);
    const arrow = getArrowIcon(stock.change);
    const hasHistory = stock.history && stock.history.prices && stock.history.prices.length > 0;
    
    return `
        <div class="stock-card ${cardClass}" data-ticker="${stock.ticker}">
            <div class="stock-header">
                <div>
                    <div class="stock-ticker">${stock.ticker}</div>
                    <div class="stock-name">${stock.name}</div>
                </div>
            </div>
            <div class="stock-price">$${formatPrice(stock.price)}</div>
            <div class="stock-change">
                <span class="change-arrow">${arrow}</span>
                <span>${formatChange(stock.change)} (${formatPercentChange(stock.changePercent)})</span>
            </div>
            ${hasHistory ? `
            <div class="stock-chart-container">
                <canvas id="chart-${stock.ticker}" class="stock-chart"></canvas>
            </div>
            ` : ''}
            <div class="stock-details">
                <div class="detail-item">
                    <span class="detail-label">Open</span>
                    <span class="detail-value">$${formatPrice(stock.open)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">High</span>
                    <span class="detail-value">$${formatPrice(stock.high)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Low</span>
                    <span class="detail-value">$${formatPrice(stock.low)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Prev Close</span>
                    <span class="detail-value">$${formatPrice(stock.previousClose)}</span>
                </div>
                ${stock.metrics ? `
                ${stock.metrics.peRatio ? `
                <div class="detail-item">
                    <span class="detail-label">P/E Ratio</span>
                    <span class="detail-value">${formatRatio(stock.metrics.peRatio)}</span>
                </div>
                ` : ''}
                ${stock.metrics.marketCap ? `
                <div class="detail-item">
                    <span class="detail-label">Market Cap</span>
                    <span class="detail-value">$${formatLargeNumber(stock.metrics.marketCap)}</span>
                </div>
                ` : ''}
                ${stock.metrics.dividendYield ? `
                <div class="detail-item">
                    <span class="detail-label">Dividend Yield</span>
                    <span class="detail-value">${formatPercentage(stock.metrics.dividendYield)}</span>
                </div>
                ` : ''}
                ${stock.metrics.eps ? `
                <div class="detail-item">
                    <span class="detail-label">EPS</span>
                    <span class="detail-value">$${formatRatio(stock.metrics.eps)}</span>
                </div>
                ` : ''}
                ${stock.metrics.beta ? `
                <div class="detail-item">
                    <span class="detail-label">Beta</span>
                    <span class="detail-value">${formatRatio(stock.metrics.beta)}</span>
                </div>
                ` : ''}
                ${stock.metrics.yearHigh ? `
                <div class="detail-item">
                    <span class="detail-label">52W High</span>
                    <span class="detail-value">$${formatPrice(stock.metrics.yearHigh)}</span>
                </div>
                ` : ''}
                ${stock.metrics.yearLow ? `
                <div class="detail-item">
                    <span class="detail-label">52W Low</span>
                    <span class="detail-value">$${formatPrice(stock.metrics.yearLow)}</span>
                </div>
                ` : ''}
                ` : ''}
            </div>
        </div>
    `;
}

// Update stock card with animation
function updateStockCard(stock) {
    const card = document.querySelector(`[data-ticker="${stock.ticker}"]`);
    if (!card) return;
    
    const priceElement = card.querySelector('.stock-price');
    const changeElement = card.querySelector('.stock-change');
    const detailValues = card.querySelectorAll('.detail-value');
    
    // Update card class
    const newClass = getCardClass(stock.change);
    card.className = `stock-card ${newClass}`;
    
    // Update price with animation
    priceElement.style.transform = 'scale(1.05)';
    priceElement.textContent = `$${formatPrice(stock.price)}`;
    setTimeout(() => {
        priceElement.style.transform = 'scale(1)';
    }, 200);
    
    // Update change
    const arrow = getArrowIcon(stock.change);
    changeElement.innerHTML = `
        <span class="change-arrow">${arrow}</span>
        <span>${formatChange(stock.change)} (${formatPercentChange(stock.changePercent)})</span>
    `;
    
    // Update chart if history data exists
    if (stock.history) {
        const canvas = document.getElementById(`chart-${stock.ticker}`);
        if (canvas) {
            // Destroy old chart if exists
            if (charts[stock.ticker]) {
                charts[stock.ticker].destroy();
            }
            // Create new chart
            charts[stock.ticker] = createChart(canvas, stock);
        }
    }
    
    // Update details - this is complex, so we'll re-render the details section
    const detailsContainer = card.querySelector('.stock-details');
    if (detailsContainer && stock.metrics) {
        // Rebuild details section with updated metrics
        const detailsHTML = `
            <div class="detail-item">
                <span class="detail-label">Open</span>
                <span class="detail-value">$${formatPrice(stock.open)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">High</span>
                <span class="detail-value">$${formatPrice(stock.high)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Low</span>
                <span class="detail-value">$${formatPrice(stock.low)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Prev Close</span>
                <span class="detail-value">$${formatPrice(stock.previousClose)}</span>
            </div>
            ${stock.metrics.peRatio ? `
            <div class="detail-item">
                <span class="detail-label">P/E Ratio</span>
                <span class="detail-value">${formatRatio(stock.metrics.peRatio)}</span>
            </div>
            ` : ''}
            ${stock.metrics.marketCap ? `
            <div class="detail-item">
                <span class="detail-label">Market Cap</span>
                <span class="detail-value">$${formatLargeNumber(stock.metrics.marketCap)}</span>
            </div>
            ` : ''}
            ${stock.metrics.dividendYield ? `
            <div class="detail-item">
                <span class="detail-label">Dividend Yield</span>
                <span class="detail-value">${formatPercentage(stock.metrics.dividendYield)}</span>
            </div>
            ` : ''}
            ${stock.metrics.eps ? `
            <div class="detail-item">
                <span class="detail-label">EPS</span>
                <span class="detail-value">$${formatRatio(stock.metrics.eps)}</span>
            </div>
            ` : ''}
            ${stock.metrics.beta ? `
            <div class="detail-item">
                <span class="detail-label">Beta</span>
                <span class="detail-value">${formatRatio(stock.metrics.beta)}</span>
            </div>
            ` : ''}
            ${stock.metrics.yearHigh ? `
            <div class="detail-item">
                <span class="detail-label">52W High</span>
                <span class="detail-value">$${formatPrice(stock.metrics.yearHigh)}</span>
            </div>
            ` : ''}
            ${stock.metrics.yearLow ? `
            <div class="detail-item">
                <span class="detail-label">52W Low</span>
                <span class="detail-value">$${formatPrice(stock.metrics.yearLow)}</span>
            </div>
            ` : ''}
        `;
        detailsContainer.innerHTML = detailsHTML;
    } else {
        // Fallback to simple update if no metrics
        const details = [
            formatPrice(stock.open),
            formatPrice(stock.high),
            formatPrice(stock.low),
            formatPrice(stock.previousClose)
        ];
        
        detailValues.forEach((element, index) => {
            if (element) element.textContent = `$${details[index]}`;
        });
    }
}

// Render all stocks
function renderStocks(stocks) {
    if (!stocks || stocks.length === 0) {
        stocksGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 1.2rem;">No stocks configured. Go to configuration to add tickers.</p>';
        return;
    }
    
    // Set grid layout based on stock count
    stocksGrid.setAttribute('data-count', stocks.length);
    
    // Check if we need to re-render or just update
    const existingTickers = Array.from(document.querySelectorAll('.stock-card')).map(
        card => card.getAttribute('data-ticker')
    ).filter(Boolean).sort();
    const newTickers = stocks.map(stock => stock.ticker).sort();
    
    // Always re-render if ticker lists don't match exactly
    const needsRerender = existingTickers.length !== newTickers.length ||
                          JSON.stringify(existingTickers) !== JSON.stringify(newTickers);
    
    console.log('Render check:', {
        existing: existingTickers,
        new: newTickers,
        needsRerender
    });
    
    if (needsRerender) {
        // Destroy all existing charts
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        charts = {};
        
        // Full re-render
        stocksGrid.innerHTML = stocks.map(stock => createStockCard(stock)).join('');
        
        // Create charts after DOM is ready
        setTimeout(() => {
            stocks.forEach(stock => {
                if (stock.history) {
                    const canvas = document.getElementById(`chart-${stock.ticker}`);
                    if (canvas) {
                        charts[stock.ticker] = createChart(canvas, stock);
                    }
                }
            });
        }, 100);
    } else {
        // Update existing cards
        stocks.forEach(stock => updateStockCard(stock));
    }
    
    currentStocks = stocks;
}

// Update market status
function updateMarketStatus(status) {
    if (!status) return;
    
    marketStatus.textContent = status.message;
    marketStatus.className = `market-status ${status.isOpen ? 'open' : 'closed'}`;
    
    // Show/hide market closed banner
    if (status.isOpen) {
        marketClosedBanner.classList.add('hidden');
    } else {
        marketClosedBanner.classList.remove('hidden');
    }
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    dateTime.textContent = now.toLocaleString('en-US', options);
}

// Update weather
function updateWeather(weather) {
    if (!weather) return;
    
    weatherTemp.textContent = `${weather.temperature}°F`;
    weatherCondition.textContent = weather.description || weather.condition;
    
    // Set weather icon (using emoji from server)
    if (weather.icon) {
        // If it's an emoji, display it as text
        if (weather.icon.length <= 3) {
            weatherIconImg.style.display = 'none';
            const iconContainer = weatherIconImg.parentElement;
            iconContainer.innerHTML = `<span style="font-size: 40px;">${weather.icon}</span>`;
        } else {
            weatherIconImg.src = weather.icon;
            weatherIconImg.alt = weather.description;
            weatherIconImg.style.display = 'block';
        }
    }
}

// Handle data update from server
function handleUpdate(data) {
    console.log('Received update:', {
        stockCount: data.stocks?.length,
        tickers: data.stocks?.map(s => s.ticker)
    });
    
    // Hide loading indicator
    loading.classList.add('hidden');
    
    // Update stocks
    if (data.stocks) {
        renderStocks(data.stocks);
    }
    
    // Update weather
    if (data.weather) {
        updateWeather(data.weather);
    }
    
    // Update market status
    if (data.marketStatus) {
        updateMarketStatus(data.marketStatus);
    }
}

// Socket.IO event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    isConnected = true;
    connectionStatus.classList.add('hidden');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    isConnected = false;
    connectionStatus.classList.remove('hidden');
});

socket.on('update', handleUpdate);

socket.on('configChanged', () => {
    console.log('Config changed event received - requesting update');
    
    // Show a brief notification
    const notification = document.createElement('div');
    notification.textContent = '🔄 Updating...';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-green);
        color: var(--bg-primary);
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(notification);
    
    // Request immediate update when config changes
    // The server will send the update automatically, but we also request it
    socket.emit('requestUpdate');
    
    // Also set a timeout to show error if update doesn't come
    const updateTimeout = setTimeout(() => {
        notification.textContent = '⚠️ Update delayed...';
        notification.style.background = 'var(--accent-red)';
    }, 5000);
    
    // Remove notification after update (or timeout)
    const removeNotification = () => {
        clearTimeout(updateTimeout);
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };
    
    // Listen for next update to remove notification
    const oneTimeUpdateHandler = () => {
        removeNotification();
        socket.off('update', oneTimeUpdateHandler);
    };
    socket.once('update', oneTimeUpdateHandler);
    
    // Fallback timeout
    setTimeout(removeNotification, 10000);
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionStatus.classList.remove('hidden');
});

// Initialize
function init() {
    // Update date/time every second
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Request initial update if not received yet
    setTimeout(() => {
        if (currentStocks.length === 0) {
            socket.emit('requestUpdate');
        }
    }, 2000);
}

// Start the application
init();

// Handle page visibility change to reconnect when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isConnected) {
        socket.connect();
    }
});

