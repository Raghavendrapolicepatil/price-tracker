/*
// ============================================================
// server.js — Our Node.js + Express backend server
//
// WHAT IS A BACKEND SERVER?
// Think of it like a restaurant kitchen:
//   - The frontend (HTML page) = the dining area (customer sees it)
//   - The backend (this file)  = the kitchen (processes requests)
//   - The database (MySQL)     = the pantry (stores everything)
//
// HOW IT WORKS:
// 1. Frontend sends: "Please fetch price for amazon.in/dp/B09XYZ"
// 2. This server receives that request
// 3. Puppeteer opens that URL in a hidden browser and scrapes the price
// 4. We save the price to MySQL
// 5. We send the price back to the frontend as JSON
// ============================================================


// ─────────────────────────────────────────────
// REQUIRE = Import external modules
// Like "using" in C# or "import" in Python
// ─────────────────────────────────────────────

const express = require('express');
// Express: web framework that makes building servers easy
// Without it, we'd have to write hundreds of lines to handle HTTP

const cors = require('cors');
// CORS = Cross-Origin Resource Sharing
// By default, browsers BLOCK requests from one domain to another.
// Example: your HTML page at localhost:5500 can't talk to localhost:3000
// cors() removes that restriction (safe for local development)

const mysql = require('mysql2/promise');
// mysql2: lets us connect to MySQL database
// /promise means it supports async/await (modern way to handle waiting)

const puppeteer = require('puppeteer');
// Puppeteer: controls a real Chrome/Chromium browser from code
// It's like having a robot that browses the internet for you
// We use it to open Amazon/Flipkart and read the price

const path = require('path');
// path: helps build file paths correctly on any OS
// e.g., path.join(__dirname, 'public') works on Windows and Mac/Linux


// ─────────────────────────────────────────────
// CREATE THE EXPRESS APP
// ─────────────────────────────────────────────
const app = express();
// app is our server object — we add routes and settings to it

const PORT = 3000;
// The port our server listens on
// Think of port like a door number: 3000 is just our chosen door


// ─────────────────────────────────────────────
// MIDDLEWARE
// Middleware = code that runs BEFORE your route handler
// Every incoming request passes through these first
// ─────────────────────────────────────────────

app.use(cors());
// Allow all domains to send requests to us (for development)
// In production, you'd limit this to your own domain

app.use(express.json());
// Parse incoming request bodies as JSON
// Without this, req.body would be undefined

app.use(express.static(path.join(__dirname,'../public')));
// Serve everything in the "public" folder as static files
// So http://localhost:3000/ automatically serves public/index.html
// This means our frontend HTML is served FROM this same server!


// ─────────────────────────────────────────────
// DATABASE CONFIGURATION
// Change these to match YOUR MySQL setup
// ─────────────────────────────────────────────
const DB_CONFIG = {
  host:     'localhost',    // Where MySQL is running (localhost = this computer)
  user:     'root',         // Your MySQL username (often 'root' by default)
  password: '990106', // ⚠ CHANGE THIS to your MySQL password
  database: 'pricetracker',  // The database name we'll create
  waitForConnections: true,
  connectionLimit: 10        // Max 10 simultaneous DB connections
};

// ─────────────────────────────────────────────
// CREATE DATABASE CONNECTION POOL
//
// A "pool" is a group of database connections that stay open.
// Instead of connecting/disconnecting for every query (slow!),
// we borrow a connection from the pool and return it after.
// ─────────────────────────────────────────────
let db;   // we'll assign the pool here after setup


// ─────────────────────────────────────────────
// DATABASE SETUP FUNCTION
// Creates the table if it doesn't exist yet
// Called once when the server starts
// ─────────────────────────────────────────────
async function setupDatabase() {
  try {
    console.log('🔌 Connecting to MySQL...');

    // First connect WITHOUT specifying a database
    // So we can CREATE the database if it doesn't exist
    const tempConnection = await mysql.createConnection({
      host:     DB_CONFIG.host,
      user:     DB_CONFIG.user,
      password: DB_CONFIG.password
    });

    // Create the database if it doesn't already exist
    await tempConnection.execute(`
      CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\`
    `);
    // Backticks around the name handle special characters

    await tempConnection.end();  // close this temporary connection
    console.log(`✓ Database "${DB_CONFIG.database}" ready`);

    // Now create the connection pool WITH the database selected
    db = mysql.createPool(DB_CONFIG);

    // ─────────────────────────────────────────────
    // CREATE TABLE: price_history
    //
    // This table stores every price check.
    // Think of it like a spreadsheet with these columns:
    //   id         | url                   | title   | price  | site    | fetched_at
    //   -----------|-----------------------|---------|--------|---------|--------------------
    //   1          | amazon.in/dp/B09...   | iPhone  | ₹79999 | Amazon  | 2024-12-01 10:30:00
    //   2          | flipkart.com/...      | Headset | ₹1299  | Flipkart| 2024-12-01 11:00:00
    // ─────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS price_history (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        -- AUTO_INCREMENT: id is set automatically (1, 2, 3...)
        -- PRIMARY KEY: uniquely identifies each row

        url        TEXT NOT NULL,
        -- TEXT: long string (URLs can be very long)
        -- NOT NULL: this field is required

        title      VARCHAR(500),
        -- VARCHAR(500): string up to 500 characters
        -- product name can be null if scraping fails

        price      VARCHAR(100) NOT NULL,
        -- We store price as text (e.g. "₹1,299") not as number
        -- because different sites format prices differently

        site       VARCHAR(50),
        -- "Amazon" or "Flipkart"

        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        -- TIMESTAMP: date + time
        -- DEFAULT CURRENT_TIMESTAMP: automatically set to "now" when inserted
      )
    `);

    console.log('✓ Table "price_history" ready');

  } catch (err) {
    // If database connection fails, print the error clearly
    console.error('✗ Database setup failed:', err.message);
    console.error('  → Check your MySQL credentials in DB_CONFIG');
    process.exit(1);
    // process.exit(1) stops the server — no point running without a DB
  }
}


// ─────────────────────────────────────────────
// SCRAPING FUNCTIONS
//
// Puppeteer opens a real browser, loads the page,
// and extracts the price from the HTML.
//
// WHY PUPPETEER?
// Amazon and Flipkart use JavaScript to load prices.
// Simple HTTP requests (like fetch/axios) only get the HTML shell —
// they don't run JavaScript. Puppeteer runs a full browser,
// so JavaScript executes and prices appear.
// ─────────────────────────────────────────────

async function scrapeAmazon(url) {
  // This function opens an Amazon page and extracts the price
  console.log('🔍 Scraping Amazon:', url);

  let browser;  // declare outside try so we can close it in finally
  try {
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: 'new',
      // headless: 'new' = run browser WITHOUT a visible window
      // Change to headless: false to SEE the browser (useful for debugging!)

      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // These args are needed on Linux servers
        // On your local Windows/Mac they're not strictly needed but don't hurt

        '--disable-dev-shm-usage',
        // Prevents crashes on systems with low memory
      ]
    });

    const page = await browser.newPage();
    // Open a new browser tab

    // Set a realistic User-Agent (browser identifier string)
    // Without this, Amazon may detect us as a bot and block us
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set viewport (browser window size)
    await page.setViewport({ width: 1366, height: 768 });

    // Navigate to the product URL
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      // domcontentloaded: wait until the main HTML is loaded
      // (doesn't wait for all images, videos, etc.)
      timeout: 30000   // timeout after 30 seconds if page doesn't load
    });

    // Wait a bit for JavaScript to render prices
    await new Promise(r => setTimeout(r, 2000));
    // This is a simple "sleep" — wait 2 seconds

    // ─────────────────────────────────────────────
    // EXTRACT DATA using page.evaluate()
    //
    // page.evaluate() runs code INSIDE the browser.
    // It's like opening DevTools Console and running JavaScript there.
    // It can read the page's HTML/DOM.
    // The return value comes back to our Node.js code.
    // ─────────────────────────────────────────────
    const result = await page.evaluate(() => {

      // ── EXTRACT PRICE ──
      // Amazon has multiple possible HTML selectors for the price.
      // We try each one until we find one that exists.
      // These are CSS selectors — same as what you use in CSS styling.

      const priceSelectors = [
        '.a-price-whole',           // Main price (whole number part)
        '#priceblock_ourprice',     // Old-style price block
        '#priceblock_dealprice',    // Deal price
        '.a-offscreen',             // Price hidden in accessibility span
        '.priceToPay .a-price-whole', // "Price to pay" section
        '#apex_offerDisplay_desktop .a-price-whole',
        '[data-asin] .a-price .a-offscreen',
        '.reinventPricePolicyMessage .a-offscreen'
      ];

      let priceEl = null;
      // Loop through each selector and stop when we find one
      for (const selector of priceSelectors) {
        priceEl = document.querySelector(selector);  // querySelector returns first match
        if (priceEl) break;  // found one, stop searching
      }

      // ── EXTRACT PRODUCT TITLE ──
      const titleEl = document.querySelector('#productTitle');

      return {
        price: priceEl ? priceEl.textContent.trim() : null,
        // textContent gets the text inside the element
        // .trim() removes leading/trailing whitespace

        title: titleEl ? titleEl.textContent.trim().substring(0, 200) : null
        // substring(0, 200) limits to 200 characters (product titles can be very long)
      };
    });

    // Handle case where price wasn't found
    if (!result.price) {
      throw new Error('Price element not found on page. Amazon may have changed its layout.');
    }

    // Clean up the price string
    // Sometimes we get "1,299" (from .a-price-whole), add the ₹ symbol
    let price = result.price.replace(/\s+/g, ' ').trim();
    if (!price.includes('₹') && !price.includes('$') && !price.includes('€')) {
      price = '₹' + price;
    }
    // Remove the decimal part if it exists separately (Amazon shows "1,299" + ".00")
    price = price.split('\n')[0].trim();

    return { price, title: result.title };

  } catch (err) {
    console.error('Amazon scraping error:', err.message);
    throw err;  // re-throw so the calling code knows something went wrong

  } finally {
    // ALWAYS close the browser, even if there was an error
    // Otherwise you'll have hundreds of Chrome windows open!
    if (browser) await browser.close();
    console.log('✓ Browser closed');
  }
}


async function scrapeFlipkart(url) {
  // Similar to scrapeAmazon but with Flipkart's HTML structure
  console.log('🔍 Scraping Flipkart:', url);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1366, height: 768 });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Handle Flipkart's login popup (it appears on first visit)
    // We look for and click the "✕" close button
    try {
      // Wait up to 3 seconds for the popup to appear
      await page.waitForSelector('button._2KpZ6l._2doB4z', { timeout: 3000 });
      await page.click('button._2KpZ6l._2doB4z');
      console.log('  Closed Flipkart login popup');
    } catch {
      // Popup didn't appear — that's fine, continue
    }

    await new Promise(r => setTimeout(r, 2000));  // wait for page to settle

    const result = await page.evaluate(() => {
      // Flipkart price selectors
      const priceSelectors = [
        '._30jeq3._16Jk6d',  // Main price (large text)
        '._30jeq3',          // Price (general)
        '._25b18c ._30jeq3', // Price in product info box
        '[class*="price"] [class*="30jeq"]'
      ];

      let priceEl = null;
      for (const selector of priceSelectors) {
        priceEl = document.querySelector(selector);
        if (priceEl) break;
      }

      // Flipkart title selectors
      const titleSelectors = [
        '.B_NuCI',        // Main product title
        'h1.yhB1nd',
        'span.B_NuCI'
      ];

      let titleEl = null;
      for (const selector of titleSelectors) {
        titleEl = document.querySelector(selector);
        if (titleEl) break;
      }

      return {
        price: priceEl ? priceEl.textContent.trim() : null,
        title: titleEl ? titleEl.textContent.trim().substring(0, 200) : null
      };
    });

    if (!result.price) {
      throw new Error('Price element not found on Flipkart page.');
    }

    return { price: result.price, title: result.title };

  } catch (err) {
    console.error('Flipkart scraping error:', err.message);
    throw err;

  } finally {
    if (browser) await browser.close();
    console.log('✓ Browser closed');
  }
}


// ─────────────────────────────────────────────
// ROUTES — URL endpoints our frontend can call
//
// Route = a specific URL path + what to do when it's called
//
// We have 2 routes:
//   POST /track   → Scrape price and save to DB
//   GET  /history → Fetch saved prices from DB
// ─────────────────────────────────────────────

// ── ROUTE 1: POST /track ──
// Called when user clicks "Track Price"
app.post('/track', async (req, res) => {
  // req = the incoming request (contains what frontend sent)
  // res = the response object (used to send data back)
  // async = this function will wait for async operations

  console.log('\n--- New /track request ---');

  // ── Get the URL from the request body ──
  const { url } = req.body;
  // req.body is the JSON data sent by frontend
  // { url } is "destructuring" — same as: const url = req.body.url

  // ── Validate ──
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
    // status(400) = Bad Request HTTP code
    // .json() sends JSON back to the frontend
    // return stops the function here
  }

  // Check if it's a supported site
  const isAmazon   = url.includes('amazon');
  const isFlipkart = url.includes('flipkart');

  if (!isAmazon && !isFlipkart) {
    return res.status(400).json({ error: 'Only Amazon and Flipkart URLs are supported' });
  }

  // ── Scrape the price ──
  let scrapeResult;
  let site;

  try {
    if (isAmazon) {
      scrapeResult = await scrapeAmazon(url);
      site = 'Amazon';
    } else {
      scrapeResult = await scrapeFlipkart(url);
      site = 'Flipkart';
    }
  } catch (err) {
    console.error('Scraping failed:', err.message);
    return res.status(500).json({
      error: `Could not fetch price: ${err.message}. Try again in a few seconds.`
    });
  }

  const { price, title } = scrapeResult;
  console.log(`✓ Price found: ${price}`);
  console.log(`  Title: ${title || '(not found)'}`);

  // ─────────────────────────────────────────────
  // SAVE TO DATABASE
  //
  // SQL INSERT statement adds a new row to our table.
  //
  // We use "?" placeholders (called parameterized queries).
  // NEVER put variables directly in SQL strings like:
  //   `INSERT INTO ... VALUES ('${url}', '${price}')` ← DANGEROUS!
  // That's called SQL injection — a security vulnerability.
  // Parameterized queries are safe.
  // ─────────────────────────────────────────────
  try {
    await db.execute(
      'INSERT INTO price_history (url, title, price, site) VALUES (?, ?, ?, ?)',
      [url, title, price, site]
      // The array maps to the ? placeholders in order
    );
    console.log('✓ Saved to database');

  } catch (dbErr) {
    console.error('Database insert failed:', dbErr.message);
    // We still return the price even if saving failed
    // The user at least gets their price data
    return res.json({
      price, title, site,
      warning: 'Price fetched but could not save to database'
    });
  }

  // ── Send response back to frontend ──
  res.json({
    success: true,
    price,              // e.g. "₹1,299"
    title,              // e.g. "Samsung Galaxy..."
    site                // e.g. "Amazon"
  });
  // The frontend receives this JSON and displays it on the page
});


// ── ROUTE 2: GET /history ──
// Called when the page loads to show saved price history
app.get('/history', async (req, res) => {
  console.log('\n--- /history request ---');

  try {
    // ─────────────────────────────────────────────
    // SQL SELECT query:
    // "Get the 50 most recent rows from price_history,
    //  ordered by newest first"
    //
    // ORDER BY fetched_at DESC = newest first (DESC = descending = Z→A, newest→oldest)
    // LIMIT 50 = only return 50 rows maximum
    // ─────────────────────────────────────────────
    const [rows] = await db.execute(
      'SELECT id, title, price, site, fetched_at FROM price_history ORDER BY fetched_at DESC LIMIT 50'
    );
    // db.execute returns [rows, fields]
    // [rows] is destructuring — we only care about rows, not fields

    console.log(`✓ Returning ${rows.length} history records`);

    res.json({ history: rows });
    // Send the array of records back as JSON
    // Frontend receives this and loops through it to build the history list

  } catch (err) {
    console.error('History fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to load history', history: [] });
  }
});


// ─────────────────────────────────────────────
// START THE SERVER
//
// We first set up the database,
// THEN start listening for requests.
// Order matters!

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
async function startServer() {
  await setupDatabase();   // set up DB first

  // app.listen starts the server on the given port
  app.listen(PORT, () => {
    console.log('\n═══════════════════════════════════════');
    console.log(`🚀 PriceWatch server running!`);
    console.log(`   Open: http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════\n');
  });
}

// Call the function to start everything
startServer();
*/


app.get('/',(req, res) => {
  res.sed('server running ✅');
});