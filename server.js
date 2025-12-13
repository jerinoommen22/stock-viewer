const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const axios = require('axios')
const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')
require('dotenv').config()

const app = express()
const server = http.createServer(app)
const io = socketIo(server)

const PORT = process.env.PORT || 3000
const CONFIG_FILE = path.join(__dirname, 'config.json')

// Spotify configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${PORT}/config.html`

// Middleware
app.use(express.json())
app.use(express.static('public'))

// Default configuration
const defaultConfig = {
  tickers: ['AAPL', 'TSLA', 'MSFT', 'GOOGL'],
  weatherLocation: 'New York',
  refreshInterval: 15000, // 15 seconds
  spotify: {
    enabled: false,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    selectedItem: null,
  },
}

// Load or create config
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    // If config doesn't exist, create it with defaults
    await saveConfig(defaultConfig)
    return defaultConfig
  }
}

async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
}

// Market hours configuration (NYSE: Mon-Fri 9:30 AM - 4:00 PM ET)
// Change these values if you want different hours:
const MARKET_OPEN_HOUR = 9
const MARKET_OPEN_MINUTE = 30 // Set to 0 for 9:00 AM, or 30 for 9:30 AM
const MARKET_CLOSE_HOUR = 16 // 4:00 PM (16:00 in 24-hour format)
const MARKET_CLOSE_MINUTE = 0

// Check if market is open
function isMarketOpen() {
  const now = new Date()
  const etTime = new Date(
    now.toLocaleString('en-US', {timeZone: 'America/New_York'}),
  )
  const day = etTime.getDay()
  const hours = etTime.getHours()
  const minutes = etTime.getMinutes()

  // Check if it's a weekday (1-5 = Mon-Fri)
  if (day === 0 || day === 6) {
    return false
  }

  // Check if it's between market open and close times
  const currentTime = hours * 60 + minutes
  const marketOpen = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE
  const marketClose = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE

  return currentTime >= marketOpen && currentTime < marketClose
}

// Get market status with detailed info
function getMarketStatus() {
  const now = new Date()
  const etTime = new Date(
    now.toLocaleString('en-US', {timeZone: 'America/New_York'}),
  )
  const isOpen = isMarketOpen()

  return {
    isOpen,
    message: isOpen ? 'Market Open' : 'Market Closed',
    currentTime: etTime.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    currentDate: etTime.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }
}

// Fetch historical data for charts (last 7 days of daily data)
// Note: This requires a paid Finnhub plan. Free tier returns 403.
// We'll gracefully handle this and skip charts if unavailable.
async function fetchHistoricalData(ticker) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY
    if (!apiKey) {
      return null
    }

    // Only fetch historical data when market is open (saves API calls)
    if (!isMarketOpen()) {
      return null
    }

    // Get timestamps for last 7 days
    const to = Math.floor(Date.now() / 1000)
    const from = to - 7 * 24 * 60 * 60 // 7 days ago

    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${apiKey}`,
      {
        validateStatus: function (status) {
          // Don't throw error on 403 (free tier limitation)
          return status < 500
        },
      },
    )

    // Handle 403 (Forbidden) - free tier doesn't include historical data
    if (response.status === 403) {
      console.log(
        `Historical data not available for ${ticker} (requires paid Finnhub plan)`,
      )
      return null
    }

    const data = response.data

    if (data.s === 'ok' && data.c && data.c.length > 0) {
      // Return arrays of timestamps and closing prices
      return {
        timestamps: data.t.map(t => t * 1000), // Convert to milliseconds
        prices: data.c,
        volumes: data.v,
      }
    }

    return null
  } catch (error) {
    // Silently fail - charts are optional
    if (error.response?.status !== 403) {
      console.error(
        `Error fetching historical data for ${ticker}:`,
        error.message,
      )
    }
    return null
  }
}

// Fetch company metrics (P/E ratio, market cap, etc.)
async function fetchCompanyMetrics(ticker) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY
    if (!apiKey) {
      return null
    }

    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${apiKey}`,
      {
        validateStatus: function (status) {
          // Don't throw error on 403 or 404 (may not be available on free tier)
          return status < 500
        },
      },
    )

    if (response.status === 403 || response.status === 404) {
      return null
    }

    const data = response.data
    if (data.metric) {
      return {
        peRatio:
          data.metric.peNormalizedAnnual ||
          data.metric.peBasicExclExtraTTM ||
          null,
        marketCap: data.metric.marketCapitalization || null,
        dividendYield: data.metric.dividendYieldIndicatedAnnual || null,
        eps:
          data.metric.epsNormalizedAnnual ||
          data.metric.epsBasicExclExtraTTM ||
          null,
        beta: data.metric.beta || null,
        yearHigh: data.metric['52WeekHigh'] || null,
        yearLow: data.metric['52WeekLow'] || null,
        volume: data.metric.volume || null,
        avgVolume: data.metric.volume10DayAverage || null,
      }
    }

    return null
  } catch (error) {
    // Silently fail - metrics are optional
    return null
  }
}

// Fetch stock data from Finnhub
async function fetchStockData(ticker) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY
    if (!apiKey) {
      throw new Error('FINNHUB_API_KEY not set')
    }

    // Fetch quote and profile in parallel
    const [quoteResponse, profileResponse] = await Promise.all([
      axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`,
      ),
      axios.get(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apiKey}`,
      ),
    ])

    // Fetch historical data and metrics separately (optional, may fail on free tier)
    // Don't let them block the main data fetch
    let historicalData = null
    let metrics = null

    try {
      historicalData = await fetchHistoricalData(ticker)
    } catch (error) {
      historicalData = null
    }

    try {
      metrics = await fetchCompanyMetrics(ticker)
    } catch (error) {
      metrics = null
    }

    const quote = quoteResponse.data
    const profile = profileResponse.data

    return {
      ticker,
      name: profile.name || ticker,
      price: quote.c || 0,
      change: quote.d || 0,
      changePercent: quote.dp || 0,
      high: quote.h || 0,
      low: quote.l || 0,
      open: quote.o || 0,
      previousClose: quote.pc || 0,
      volume: quote.v || 0,
      timestamp: Date.now(),
      history: historicalData,
      metrics: metrics,
    }
  } catch (error) {
    console.error(`Error fetching stock data for ${ticker}:`, error.message)
    return {
      ticker,
      name: ticker,
      price: 0,
      change: 0,
      changePercent: 0,
      error: 'Failed to fetch data',
    }
  }
}

// Geocode location to get coordinates
async function geocodeLocation(location) {
  try {
    const response = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        location,
      )}&count=1&language=en&format=json`,
    )

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0]
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        name: result.name,
        country: result.country,
      }
    }
    return null
  } catch (error) {
    console.error('Error geocoding location:', error.message)
    return null
  }
}

// Weather code to description mapping (Open-Meteo WMO Weather codes)
function getWeatherDescription(code) {
  const weatherCodes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Heavy showers',
    85: 'Light snow showers',
    86: 'Snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail',
  }
  return weatherCodes[code] || 'Unknown'
}

// Weather code to icon mapping
function getWeatherIcon(code, isDay = true) {
  if (code === 0) return isDay ? '☀️' : '🌙'
  if (code === 1 || code === 2) return isDay ? '🌤️' : '🌙'
  if (code === 3) return '☁️'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 51 && code <= 55) return '🌦️'
  if (code >= 61 && code <= 65) return '🌧️'
  if (code >= 71 && code <= 77) return '🌨️'
  if (code >= 80 && code <= 82) return '🌧️'
  if (code >= 85 && code <= 86) return '🌨️'
  if (code >= 95) return '⛈️'
  return '🌡️'
}

// Fetch weather data from Open-Meteo (Free, no API key needed!)
async function fetchWeatherData(location) {
  try {
    // First, geocode the location to get coordinates
    const coords = await geocodeLocation(location)
    if (!coords) {
      throw new Error('Location not found')
    }

    // Fetch weather data using coordinates
    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`,
    )

    const data = response.data.current
    const weatherCode = data.weather_code
    const isDay = data.is_day === 1

    return {
      location: `${coords.name}, ${coords.country}`,
      temperature: Math.round(data.temperature_2m),
      feelsLike: Math.round(data.apparent_temperature),
      condition: getWeatherDescription(weatherCode),
      description: getWeatherDescription(weatherCode),
      icon: getWeatherIcon(weatherCode, isDay),
      humidity: data.relative_humidity_2m,
      windSpeed: Math.round(data.wind_speed_10m),
      weatherCode: weatherCode,
      isDay: isDay,
    }
  } catch (error) {
    console.error('Error fetching weather data:', error.message)
    return {
      location: location,
      temperature: '--',
      condition: 'Unknown',
      description: 'Unable to fetch weather',
      icon: '🌡️',
      error: 'Failed to fetch weather',
    }
  }
}

// API Routes
app.get('/api/config', async (req, res) => {
  try {
    const config = await loadConfig()
    res.json(config)
  } catch (error) {
    res.status(500).json({error: 'Failed to load configuration'})
  }
})

app.post('/api/config', async (req, res) => {
  try {
    const config = req.body
    await saveConfig(config)

    // Immediately notify all clients of config change
    console.log('📝 Config saved via API - notifying all clients')
    lastConfigHash = await getConfigHash()
    io.emit('configChanged')

    // Small delay to ensure file is fully written
    setTimeout(() => {
      // Force update for all active connections
      activeConnections.forEach((connection, socketId) => {
        if (connection.sendUpdate) {
          connection.sendUpdate(true) // Force fresh fetch
        }
      })
    }, 200)

    res.json({success: true, config})
  } catch (error) {
    res.status(500).json({error: 'Failed to save configuration'})
  }
})

// Cache for stock data when market is closed
let cachedStockData = null
let lastFetchTime = null

app.get('/api/stocks', async (req, res) => {
  try {
    const config = await loadConfig()
    const marketStatus = getMarketStatus()
    let stockData

    // Only fetch fresh data if market is open
    if (marketStatus.isOpen) {
      stockData = await Promise.all(
        config.tickers.map(ticker => fetchStockData(ticker)),
      )
      cachedStockData = stockData
      lastFetchTime = Date.now()
    } else {
      // Market closed - use cached data
      if (!cachedStockData) {
        // No cache yet, fetch once
        stockData = await Promise.all(
          config.tickers.map(ticker => fetchStockData(ticker)),
        )
        cachedStockData = stockData
        lastFetchTime = Date.now()
      } else {
        stockData = cachedStockData
      }
    }

    res.json({
      stocks: stockData,
      marketStatus: marketStatus,
      lastUpdate: lastFetchTime,
      fromCache: !marketStatus.isOpen,
    })
  } catch (error) {
    res.status(500).json({error: 'Failed to fetch stock data'})
  }
})

app.get('/api/weather', async (req, res) => {
  try {
    const config = await loadConfig()
    const weather = await fetchWeatherData(config.weatherLocation)
    res.json(weather)
  } catch (error) {
    res.status(500).json({error: 'Failed to fetch weather data'})
  }
})

app.get('/api/market-status', (req, res) => {
  res.json(getMarketStatus())
})

// Spotify API Routes
app.get('/api/spotify/auth-url', (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({error: 'Spotify client ID not configured'})
  }

  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
    'playlist-read-collaborative',
  ].join(' ')

  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scopes)}`

  res.json({authUrl})
})

app.post('/api/spotify/callback', async (req, res) => {
  try {
    const {code} = req.body

    if (!code) {
      return res.status(400).json({error: 'No authorization code provided'})
    }

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({error: 'Spotify credentials not configured'})
    }

    // Exchange code for access token
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
          ).toString('base64')}`,
        },
      },
    )

    const {access_token, refresh_token, expires_in} = response.data

    // Store tokens in config
    const config = await loadConfig()
    config.spotify = config.spotify || {}
    config.spotify.accessToken = access_token
    config.spotify.refreshToken = refresh_token
    config.spotify.tokenExpiresAt = Date.now() + expires_in * 1000
    await saveConfig(config)

    res.json({accessToken: access_token})
  } catch (error) {
    console.error('Error exchanging Spotify code:', error.message)
    res.status(500).json({error: 'Failed to exchange authorization code'})
  }
})

app.get('/api/spotify/search', async (req, res) => {
  try {
    const query = req.query.q
    if (!query) {
      return res.status(400).json({error: 'Query parameter required'})
    }

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({error: 'Authorization required'})
    }

    const accessToken = authHeader.replace('Bearer ', '')

    // Search for tracks and playlists
    const [tracksResponse, playlistsResponse] = await Promise.all([
      axios
        .get(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            query,
          )}&type=track&limit=10`,
          {
            headers: {Authorization: `Bearer ${accessToken}`},
          },
        )
        .catch(() => ({data: {tracks: {items: []}}})),
      axios
        .get(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            query,
          )}&type=playlist&limit=10`,
          {
            headers: {Authorization: `Bearer ${accessToken}`},
          },
        )
        .catch(() => ({data: {playlists: {items: []}}})),
    ])

    const tracks = tracksResponse.data.tracks?.items || []
    const playlists = playlistsResponse.data.playlists?.items || []

    // Combine and format results
    const items = [
      ...tracks
        .filter(track => track && track.id && track.uri) // Filter out invalid tracks
        .map(track => ({
          id: track.id,
          type: 'track',
          name: track.name || 'Unknown Track',
          artist:
            track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
          artists: track.artists || [],
          uri: track.uri,
          images: track.album?.images || [],
        })),
      ...playlists
        .filter(playlist => playlist && playlist.id && playlist.uri) // Filter out invalid playlists
        .map(playlist => ({
          id: playlist.id,
          type: 'playlist',
          name: playlist.name || 'Unknown Playlist',
          artist: playlist.owner?.display_name || 'Spotify',
          artists: [{name: playlist.owner?.display_name || 'Spotify'}],
          uri: playlist.uri,
          images: playlist.images || [],
        })),
    ]

    res.json({items})
  } catch (error) {
    console.error('Error searching Spotify:', error.message)
    if (error.response?.status === 401) {
      res.status(401).json({error: 'Invalid or expired token'})
    } else {
      res.status(500).json({error: 'Failed to search Spotify'})
    }
  }
})

// Store active socket connections and their intervals
const activeConnections = new Map()

// Watch for config file changes
let lastConfigHash = null
let configWatcher = null

async function getConfigHash() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8')
    return JSON.stringify(JSON.parse(data))
  } catch (error) {
    return null
  }
}

// Check for config changes and notify all clients
async function checkConfigChanges() {
  try {
    const currentHash = await getConfigHash()
    if (currentHash && currentHash !== lastConfigHash) {
      console.log('📝 Config file changed - notifying all clients')
      lastConfigHash = currentHash

      // Notify all connected clients
      io.emit('configChanged')

      // Small delay to ensure config is fully written
      setTimeout(() => {
        // Force update for all active connections
        activeConnections.forEach((connection, socketId) => {
          if (connection.sendUpdate) {
            connection.sendUpdate(true) // Force fresh fetch
          }
        })
      }, 200)
    }
  } catch (error) {
    console.error('Error checking config changes:', error.message)
  }
}

// Watch config file for changes
async function initializeConfigWatcher() {
  try {
    if (fsSync.existsSync(CONFIG_FILE)) {
      // Initialize hash
      lastConfigHash = await getConfigHash()

      // Watch for file changes
      fsSync.watchFile(CONFIG_FILE, {interval: 1000}, (curr, prev) => {
        // Only trigger if file was actually modified (not just accessed)
        if (curr.mtime !== prev.mtime) {
          checkConfigChanges()
        }
      })
      console.log('📝 Config file watcher initialized')
    } else {
      // Watch for file creation
      const watchDir = path.dirname(CONFIG_FILE)
      fsSync.watch(watchDir, (eventType, filename) => {
        if (filename === path.basename(CONFIG_FILE)) {
          setTimeout(() => {
            if (fsSync.existsSync(CONFIG_FILE)) {
              initializeConfigWatcher()
            }
          }, 500)
        }
      })
    }
  } catch (error) {
    console.error('Error initializing config watcher:', error.message)
  }
}

// Initialize watcher on startup
initializeConfigWatcher()

// WebSocket connection
io.on('connection', async socket => {
  console.log('Client connected')

  let updateInterval
  let currentConfig = null

  // Store last stock data for when market is closed
  let lastStockData = null

  const sendUpdate = async (forceFresh = false) => {
    try {
      const config = await loadConfig()
      currentConfig = config
      const marketStatus = getMarketStatus()
      let stockData

      // If forceFresh is true (config changed), always fetch fresh data
      if (forceFresh) {
        console.log('Force fetching fresh stock data for:', config.tickers)
        stockData = await Promise.all(
          config.tickers.map(ticker => fetchStockData(ticker)),
        )
        lastStockData = stockData
      } else if (marketStatus.isOpen) {
        // Market is open - fetch fresh data
        stockData = await Promise.all(
          config.tickers.map(ticker => fetchStockData(ticker)),
        )
        lastStockData = stockData // Cache for when market closes
      } else {
        // Market is closed - use cached data or fetch once
        if (!lastStockData) {
          stockData = await Promise.all(
            config.tickers.map(ticker => fetchStockData(ticker)),
          )
          lastStockData = stockData
        } else {
          // Check if cached data matches current tickers
          const cachedTickers = lastStockData.map(s => s.ticker).sort()
          const currentTickers = config.tickers.sort()
          if (
            JSON.stringify(cachedTickers) !== JSON.stringify(currentTickers)
          ) {
            // Tickers changed, fetch fresh data
            console.log('Tickers changed, fetching fresh data')
            stockData = await Promise.all(
              config.tickers.map(ticker => fetchStockData(ticker)),
            )
            lastStockData = stockData
          } else {
            stockData = lastStockData
          }
        }
      }

      // Always fetch weather
      const weather = await fetchWeatherData(config.weatherLocation)

      console.log(
        'Sending update with',
        stockData.length,
        'stocks:',
        stockData.map(s => s.ticker),
      )
      socket.emit('update', {
        stocks: stockData,
        weather,
        marketStatus: marketStatus,
      })
    } catch (error) {
      console.error('Error sending update:', error.message)
    }
  }

  // Store connection info
  const connectionInfo = {
    sendUpdate,
    updateInterval: null,
  }
  activeConnections.set(socket.id, connectionInfo)

  // Send initial data
  await sendUpdate()

  // Set up periodic updates
  const config = await loadConfig()
  currentConfig = config
  // When market is open: use configured interval
  // When market is closed: update every 5 minutes (only for weather)
  const interval = isMarketOpen() ? config.refreshInterval : 300000 // 5 minutes when closed
  updateInterval = setInterval(sendUpdate, interval)
  connectionInfo.updateInterval = updateInterval

  console.log(
    `Update interval set to ${interval / 1000} seconds (Market ${
      isMarketOpen() ? 'OPEN' : 'CLOSED'
    })`,
  )

  // Listen for config changes
  socket.on('configChanged', async () => {
    console.log('Config change detected for client', socket.id)
    const newConfig = await loadConfig()

    // Clear cached data so we fetch fresh data for new tickers
    lastStockData = null

    // Check if tickers changed
    const tickersChanged =
      !currentConfig ||
      JSON.stringify(currentConfig.tickers) !==
        JSON.stringify(newConfig.tickers)

    if (tickersChanged) {
      console.log('Tickers changed:', {
        old: currentConfig?.tickers,
        new: newConfig.tickers,
      })
    }

    // Check if refresh interval changed
    if (
      currentConfig &&
      newConfig.refreshInterval !== currentConfig.refreshInterval
    ) {
      // Restart interval with new timing
      if (updateInterval) {
        clearInterval(updateInterval)
      }
      const newInterval = isMarketOpen() ? newConfig.refreshInterval : 300000
      updateInterval = setInterval(() => sendUpdate(false), newInterval)
      connectionInfo.updateInterval = updateInterval
      console.log(`Updated interval to ${newInterval / 1000} seconds`)
    }

    // Update current config
    currentConfig = newConfig

    // Force immediate update with new tickers (always fetch fresh, don't use cache)
    // This works even when market is closed
    console.log(
      'Fetching fresh data for tickers (market closed:',
      !isMarketOpen(),
      '):',
      newConfig.tickers,
    )
    await sendUpdate(true) // Force fresh fetch - ignores market status
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected')
    if (updateInterval) {
      clearInterval(updateInterval)
    }
    activeConnections.delete(socket.id)
  })

  socket.on('requestUpdate', () => {
    console.log('Update requested by client', socket.id)
    // When client requests update (like after config change), force fresh data
    sendUpdate(true)
  })
})

// Start server
server.listen(PORT, () => {
  console.log(`TV Stock Viewer running on http://localhost:${PORT}`)
  console.log('Make sure to set FINNHUB_API_KEY in .env file')
  console.log('Weather provided by Open-Meteo (no API key needed)')
  console.log(
    `Market hours: ${MARKET_OPEN_HOUR}:${MARKET_OPEN_MINUTE.toString().padStart(
      2,
      '0',
    )} - ${MARKET_CLOSE_HOUR}:${MARKET_CLOSE_MINUTE.toString().padStart(
      2,
      '0',
    )} ET`,
  )
  console.log(`Market is currently: ${isMarketOpen() ? 'OPEN' : 'CLOSED'}`)
  if (!isMarketOpen()) {
    console.log(
      '⚠️  Stock API calls are paused while market is closed (saves API quota)',
    )
  }
})
