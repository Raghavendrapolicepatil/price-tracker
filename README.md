# 🛒 PriceWatch — Beginner's Price Tracker

A simple web app to track Amazon and Flipkart product prices.
Built with HTML, CSS, JavaScript, Node.js, Express, MySQL, and Puppeteer.

---

## 📁 Project Structure

```
price-tracker/
│
├── public/
│   └── index.html        ← The website (HTML + CSS + JavaScript)
│
├── server/
│   └── server.js         ← The backend (Node.js + Express)
│
├── package.json          ← Lists all Node.js packages we need
├── setup.sql             ← MySQL setup (optional — server auto-creates it)
└── README.md             ← This file
```

**How each part connects:**
```
Browser (index.html)
    ↕ HTTP requests (fetch API)
Node.js Server (server.js) on port 3000
    ↕ Puppeteer launches Chrome
Amazon / Flipkart website
    ↕ mysql2 library
MySQL Database
```

---

## ✅ Prerequisites — What to Install First

### 1. Install Node.js
Node.js lets you run JavaScript outside the browser (on the server).

- Go to: https://nodejs.org
- Download the **LTS version** (recommended)
- Install it (click Next → Next → Finish)
- Verify: open Terminal/Command Prompt and type:
  ```
  node --version
  ```
  You should see something like `v20.10.0`

### 2. Install MySQL
MySQL is the database where we save prices.

- Go to: https://dev.mysql.com/downloads/installer/
- Download **MySQL Installer** (for Windows) or use Homebrew on Mac
- During setup, choose "Developer Default"
- **Remember your root password** — you'll need it!
- Verify: open MySQL Workbench or MySQL CLI and log in

---

## 🚀 Step-by-Step Setup

### Step 1: Download / Create the Project Files

Create a folder called `price-tracker` and put all the files inside as shown in the structure above.

### Step 2: Open Terminal in the project folder

- **Windows**: Right-click in the folder → "Open in Terminal"
  OR: open Command Prompt and type `cd path\to\price-tracker`
- **Mac/Linux**: Open Terminal, type `cd ~/path/to/price-tracker`

### Step 3: Set Your MySQL Password

Open `server/server.js` and find this section (around line 80):

```javascript
const DB_CONFIG = {
  host:     'localhost',
  user:     'root',
  password: 'your_password',   // ← CHANGE THIS
  database: 'pricetracker',
};
```

Replace `your_password` with your actual MySQL password.
If you have no password, use `''` (empty string).

### Step 4: Install Node.js Packages

In your terminal (inside the price-tracker folder), run:

```bash
npm install
```

This reads `package.json` and downloads all required libraries into a `node_modules` folder.
It may take 2–5 minutes because Puppeteer downloads Chromium (a browser).

What gets installed:
- `express` — web server framework
- `cors` — allows browser to talk to our server
- `mysql2` — MySQL database driver
- `puppeteer` — headless Chrome browser for scraping
- `nodemon` — (dev tool) auto-restarts server when you edit code

### Step 5: Start the Server

```bash
npm start
```

You should see:
```
🔌 Connecting to MySQL...
✓ Database "pricetracker" ready
✓ Table "price_history" ready

═══════════════════════════════════════
🚀 PriceWatch server running!
   Open: http://localhost:3000
═══════════════════════════════════════
```

### Step 6: Open the App

Open your browser and go to:
```
http://localhost:3000
```

You should see the PriceWatch interface!

### Step 7: Track Your First Product

1. Go to Amazon.in or Flipkart.com
2. Open any product page
3. Copy the URL from your browser's address bar
4. Paste it in PriceWatch
5. Click "Track Price →"
6. Wait 10–30 seconds (Puppeteer opens a browser to fetch the price)
7. The price appears on your page and is saved to MySQL!

---

## 🛠 Development Mode (Auto-Restart)

Instead of `npm start`, use:
```bash
npm run dev
```

This uses `nodemon` — it watches your files and automatically restarts the server whenever you save changes. Very useful while developing!

---

## 🐛 Troubleshooting

### "Cannot connect to server"
- Make sure you ran `npm start` and see the "server running" message
- Check that you're going to `http://localhost:3000` (not 5500 or another port)

### "Database setup failed: Access denied"
- Wrong MySQL password in `DB_CONFIG`
- Double-check your password and update `server/server.js`

### "Price element not found on page"
- Amazon/Flipkart change their HTML layout occasionally
- Try a different product URL
- Some products have region-specific pricing that may not load

### "Could not fetch price: Navigation timeout"
- The product page took too long to load
- Check your internet connection
- Try again (Amazon sometimes throttles bot traffic)

### Port already in use
- Change `const PORT = 3000` to `3001` or another number

---

## 📊 Viewing Your Data in MySQL

Open MySQL Workbench or run:
```bash
mysql -u root -p
```
Then:
```sql
USE pricetracker;
SELECT * FROM price_history ORDER BY fetched_at DESC;
```

---

## 🚀 Ideas to Improve Later

Once you're comfortable with this project:

1. **Price Alerts** — Email yourself when price drops below a threshold
   - Learn: Nodemailer library, cron jobs

2. **Scheduled Tracking** — Auto-check prices every day
   - Learn: `node-cron` library

3. **User Accounts** — Let multiple users track different products
   - Learn: Sessions, bcrypt for passwords

4. **Better Scraping** — Handle more products reliably
   - Learn: more Puppeteer techniques, ScrapingBee API

5. **Deploy Online** — Make it accessible from anywhere
   - Learn: Railway.app or Render.com (free Node.js hosting)

6. **Price Comparison** — Check same product on multiple sites
   - Expand: Call scrapeAmazon AND scrapeFlipkart for same product

---

## 📚 Key Concepts Summary

| Concept | What it means |
|---------|--------------|
| `require()` | Import a module (like import in Python) |
| `async/await` | Wait for slow operations (network, DB) without freezing |
| `app.post('/track', ...)` | Handle POST requests to /track URL |
| `req.body` | Data sent by the frontend |
| `res.json({...})` | Send JSON response to frontend |
| `fetch()` | Browser function to call backend APIs |
| `page.evaluate()` | Run JavaScript inside Puppeteer's browser |
| SQL `INSERT INTO` | Add a new row to a database table |
| SQL `SELECT ... ORDER BY` | Get rows from a table, sorted |
| CSS `display: none` | Hide an element (JS can show it later) |
| CSS `flex` | Layout system for arranging elements |
