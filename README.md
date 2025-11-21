# TV Stock Viewer 📈

A beautiful, modern stock market dashboard designed for TV displays and Raspberry Pi. Features real-time stock data, weather information, and a sleek Robinhood-inspired dark theme.

![Stock Viewer](https://img.shields.io/badge/Node.js-18+-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

✨ **Real-time Stock Data** - Live stock prices with automatic updates
📊 **Beautiful Price Charts** - 7-day price history charts for each stock
📈 **Responsive Grid Layout** - Automatically adjusts based on number of stocks
🌙 **Dark Theme** - Robinhood-inspired color scheme optimized for TV viewing
🌤️ **Weather Widget** - Current weather conditions and temperature
📅 **Market Status** - Shows when the market is open or closed
⚙️ **Easy Configuration** - Web-based config page to manage stocks
🔄 **Auto-reconnect** - Maintains connection even if network drops
💻 **Raspberry Pi Optimized** - Lightweight and efficient
🎯 **Smart API Usage** - Stops stock API calls when market is closed

## Screenshots

### Main Dashboard
- Full-screen display when tracking 1 stock with large chart
- Grid layouts for 2-9+ stocks
- Real-time price updates with smooth animations
- Beautiful 7-day price history charts
- Color-coded gains (green) and losses (red)
- Interactive chart tooltips with hover data

### Configuration Page
- Add/remove stock tickers
- Set weather location
- Adjust refresh interval

## Prerequisites

- **Node.js** 14+ (18+ recommended)
- **npm** or **yarn**
- Free API keys:
  - [Finnhub](https://finnhub.io/) - Stock market data (required)
  - Weather is provided by Open-Meteo (no API key needed!)

## Installation

### 1. Clone or Download

```bash
cd stock_viewer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp env.example .env
```

Edit `.env` and add your API key:

```env
# Finnhub API Key (Get free key at https://finnhub.io/)
FINNHUB_API_KEY=your_finnhub_api_key_here

# Server Port (optional, defaults to 3000)
PORT=3000
```

## Getting API Keys

### Finnhub (Stock Data)
1. Go to [finnhub.io](https://finnhub.io/)
2. Click "Get free API key"
3. Sign up for a free account
4. Copy your API key
5. Free tier includes 60 API calls/minute

### Weather (No API Key Needed!)
Weather data is provided by [Open-Meteo](https://open-meteo.com/) - completely free with no API key required! 🎉

## Usage

### Start the Server

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Access the Dashboard

Open your browser (or TV browser) and navigate to:

```
http://localhost:3000
```

Or from another device on the same network:

```
http://YOUR_RASPBERRY_PI_IP:3000
```

### Configure Stocks

1. Click the ⚙️ icon in the top-right corner
2. Add stock tickers (e.g., AAPL, TSLA, MSFT, GOOGL)
3. Set your weather location (city name or ZIP code)
4. Adjust refresh interval (5-60 seconds)
5. Click "Save Configuration"
6. Return to dashboard

## Raspberry Pi Setup

### 1. Install on Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Clone/copy project to Pi
cd /home/pi
# ... copy your project files here ...

# Install dependencies
npm install
```

### 2. Auto-start on Boot (Optional)

Using PM2 (recommended):

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the app
pm2 start server.js --name stock-viewer

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the instructions shown
```

Using systemd:

Create `/etc/systemd/system/stock-viewer.service`:

```ini
[Unit]
Description=Stock Viewer
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/stock_viewer
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable stock-viewer
sudo systemctl start stock-viewer
```

### 3. Configure TV/Browser

For kiosk mode on Raspberry Pi:

```bash
# Install Chromium if not installed
sudo apt install -y chromium-browser unclutter

# Edit autostart
nano ~/.config/lxsession/LXDE-pi/autostart

# Add these lines:
@chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble http://localhost:3000
@unclutter -idle 0.1 -root
```

## Configuration File

The app stores configuration in `config.json`:

```json
{
  "tickers": ["AAPL", "TSLA", "MSFT", "GOOGL"],
  "weatherLocation": "New York",
  "refreshInterval": 15000
}
```

You can edit this file directly or use the web interface.

## API Rate Limits

### Finnhub Free Tier
- 60 API calls/minute
- Real-time US stock data (quote and profile endpoints)
- **Historical candle data (charts) requires paid plan** - charts will be hidden on free tier
- This app makes 2 calls per stock per refresh interval (quote + profile)
- Example: 4 stocks refreshing every 15 seconds = 32 calls/minute
- Charts are optional - app works perfectly without them

### Open-Meteo (Weather)
- Completely free, no API key needed
- Unlimited requests for non-commercial use
- High-quality weather data from national weather services
- No rate limits for reasonable usage

## Troubleshooting

### Stock data not loading
- Check that your `FINNHUB_API_KEY` is correct in `.env`
- Verify your API key is active at [finnhub.io](https://finnhub.io/)
- Check browser console for error messages

### Weather not displaying
- Verify your location name is correct (try "New York" or "London")
- Check browser console for error messages
- Weather API requires internet connection

### "Market Closed" showing during market hours
- The app uses Eastern Time (NYSE hours)
- Market hours: Monday-Friday, 9:30 AM - 4:00 PM ET (configurable in server.js)
- **Stock API calls automatically stop when market is closed** to save API quota
- Weather updates continue regardless of market status
- Check your system time/timezone

To change market hours, edit these values in `server.js`:
```javascript
const MARKET_OPEN_HOUR = 9
const MARKET_OPEN_MINUTE = 30  // Set to 0 for 9:00 AM
const MARKET_CLOSE_HOUR = 16   // 4:00 PM
```

### Connection issues
- Ensure the server is running (`npm start`)
- Check firewall settings if accessing from another device
- Verify the correct IP address and port

## Customization

### Colors
Edit `public/css/styles.css` to change the color scheme:

```css
:root {
    --bg-primary: #0a0e13;
    --bg-secondary: #1a1f24;
    --accent-green: #00c805;
    --accent-red: #ff5757;
    /* ... more colors ... */
}
```

### Refresh Interval
Default is 15 seconds. You can change this in the configuration page (5-60 seconds range).

### Default Stocks
Edit `server.js` to change default stocks:

```javascript
const defaultConfig = {
  tickers: ['AAPL', 'TSLA', 'MSFT', 'GOOGL'],
  weatherLocation: 'New York',
  refreshInterval: 15000
};
```

## Technology Stack

- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **Frontend**: Vanilla JavaScript, CSS3
- **APIs**: Finnhub (stocks), Open-Meteo (weather)

## Project Structure

```
stock_viewer/
├── server.js              # Express server + WebSocket
├── package.json          # Dependencies
├── config.json           # User configuration (auto-created)
├── .env                  # Environment variables (create this)
├── env.example           # Environment template
├── public/
│   ├── index.html        # Main dashboard
│   ├── config.html       # Configuration page
│   ├── css/
│   │   └── styles.css    # All styles
│   └── js/
│       ├── dashboard.js  # Dashboard logic
│       └── config.js     # Config page logic
└── README.md
```

## Performance

- Lightweight: ~50MB RAM usage
- Fast: < 100ms response times
- Efficient: Optimized for Raspberry Pi 3/4
- Battery-friendly: Smart refresh intervals

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use for personal or commercial projects.

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the browser console for errors
3. Check the server logs
4. Ensure all API keys are valid

## Future Enhancements

- [x] Historical price charts (7-day)
- [ ] Extended historical data (30-day, 90-day)
- [ ] Crypto support
- [ ] Multiple themes
- [ ] News headlines
- [ ] Portfolio tracking
- [ ] Price alerts
- [ ] Mobile app

## Acknowledgments

- Design inspired by [Robinhood](https://robinhood.com/)
- Stock data provided by [Finnhub](https://finnhub.io/)
- Weather data provided by [Open-Meteo](https://open-meteo.com/)

---

**Enjoy your TV Stock Viewer! 📈**

