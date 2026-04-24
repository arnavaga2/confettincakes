require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); // NEW: For secure passwords


const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- DATABASE CONNECTION (SQLite) ---
const db = new sqlite3.Database('./bakery.db', (err) => {
    if (err) {
        console.error('❌ Error opening SQLite database:', err.message);
    } else {
        console.log('✅ Connected to SQLite Database (bakery.db)');
        
        // 1. Users Table
        // 3. Users Table (UPDATED SCHEMA)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE,
            email TEXT, -- NEW COLUMN
            address TEXT,
            city TEXT,
            state TEXT,
            pin TEXT,
            password TEXT
        )`);
        
        // 2. Orders Table (UPDATED SCHEMA)
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            customer TEXT,
            customerPhone TEXT,
            customerAddress TEXT,
            customerPin TEXT,
            items TEXT,
            total TEXT,
            status TEXT,
            date TEXT,
            timestamp TEXT
        )`);
        
        // 3. Inventory Table
        db.run(`CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, cat TEXT, name TEXT, desc TEXT, price TEXT, weight TEXT, time TEXT, img TEXT)`);
        
        // 4. Settings Table (With Auto-Rescue Data Restorer)
        db.run(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), config TEXT)`, () => {
            db.get(`SELECT * FROM settings WHERE id = 1`, (err, row) => {
                if (row) {
                    let existingSettings = JSON.parse(row.config);
                    let needsUpdate = false;

                    // RESCUE: If Home Page settings are missing, inject defaults!
                    if (!existingSettings.home) {
                        existingSettings.home = {
                            heroVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
                            heroTitle: "Delicious cakes, delivered to your door.",
                            heroSub: "100% Eggless • Freshly Baked • Fast Delivery",
                            sec1Title: "What's on your mind?",
                            sec2Title: "Trending Today",
                            usp1Title: "100% Eggless", usp1Desc: "Pure vegetarian bakes.",
                            usp2Title: "Freshly Baked", usp2Desc: "Made to order daily.",
                            usp3Title: "Fast Delivery", usp3Desc: "Safe & secure handling."
                        };
                        needsUpdate = true;
                    }

                    // Check if categories are there
                    if (!existingSettings.categories) {
                        existingSettings.categories = ["cakes", "cupcakes", "cookies", "brownies", "pastries", "hampers", "chocolates"];
                        needsUpdate = true;
                    }

                    // RESCUE: If announcements got wiped, bring them back!
                    if (!existingSettings.announcements || existingSettings.announcements.length === 0) {
                        existingSettings.announcements = [
                            "✨ We have freshly baked Cakes!",
                            "🔥 Chocolate Cookie is our Best Selling cookie!"
                        ];
                        needsUpdate = true;
                    }

                    // RESCUE: If promo cards got wiped, bring them back!
                    if (!existingSettings.promoCards || existingSettings.promoCards.length === 0) {
                        existingSettings.promoCards = [
                            { color: "pink", icon: "🎉", title: "Party Combos", desc: "Save 15% on Cake + Cupcake bundles!" },
                            { color: "dark", icon: "🍫", title: "Midnight Cravings", desc: "Late night delivery now active in Delhi." },
                            { color: "gold", icon: "🎂", title: "Custom Creations", desc: "Personalize your dream cake today." }
                        ];
                        needsUpdate = true;
                    }

                    // RESCUE: If banners got wiped, bring them back!
                    if (!existingSettings.banners || existingSettings.banners.length === 0) {
                        existingSettings.banners = [
                            "https://images.unsplash.com/photo-1557925923-33b251dc32d6?w=1200&q=80",
                            "https://images.unsplash.com/photo-1495147466023-af5c19cb6211?w=1200&q=80"
                        ];
                        needsUpdate = true;
                    }

                    // Keep Admin Pass and Pins safe
                    if (!existingSettings.adminPass) existingSettings.adminPass = "cake";
                    if (!existingSettings.pincodes) existingSettings.pincodes = "110";
                    if (!existingSettings.footerText) existingSettings.footerText = "&copy; 2026 CONFETTINCAKE. All rights reserved.";

                    if (needsUpdate) {
                        db.run(`UPDATE settings SET config = ? WHERE id = 1`, [JSON.stringify(existingSettings)], (updateErr) => {
                            if (!updateErr) console.log("✅ Database missing data successfully restored!");
                        });
                    }
                }
            });
        });

        // 5. Promo Codes Table (NEW)
        db.run(`CREATE TABLE IF NOT EXISTS promos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            discount INTEGER,
            isActive BOOLEAN DEFAULT 1
        )`);
        
        console.log('✅ All Database Tables Ready');
    }
});



// ==========================================
// 🚀 BACKEND APIs
// ==========================================

// 1. SIGN UP API
// POST: Customer Signup
app.post('/api/auth/signup', async (req, res) => {
    // Only pulling the exact fields we need (no email)
    const { name, phone, address, pin, city, state, password } = req.body;
    
    // Check if phone number already exists
    db.get(`SELECT * FROM users WHERE phone = ?`, [phone], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ error: "Phone number already registered!" });

        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Insert without email
            const stmt = db.prepare(`INSERT INTO users (name, phone, address, pin, city, state, password) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            stmt.run([name, phone, address, pin, city, state, hashedPassword], function(err) {
                if (err) return res.status(500).json({ error: "Database error during signup." });
                
                const newUser = { id: this.lastID, name, phone, address, pin, city, state };
                res.json({ message: "Registration successful", user: newUser });
            });
            stmt.finalize();
        } catch (error) {
            res.status(500).json({ error: "Server error during hashing." });
        }
    });
});
// 2. LOGIN API
app.post('/api/auth/login', (req, res) => {
    const { phone, password } = req.body;
    
    console.log(`\n➡️ Login attempt for phone: ${phone}`); // DEBUG LOG

    db.get(`SELECT * FROM users WHERE phone = ?`, [phone], async (err, user) => {
        if (err) {
            console.log(`❌ Database Error:`, err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            console.log(`❌ FAILED: No account found with phone number ${phone}`); // DEBUG LOG
            return res.status(400).json({ error: "Incorrect phone or password." });
        }

        // Compare the typed password with the hashed password in the DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`❌ FAILED: Wrong password entered for ${phone}`); // DEBUG LOG
            return res.status(400).json({ error: "Incorrect phone or password." });
        }

        // Success!
        console.log(`✅ SUCCESS: ${user.name} logged in perfectly!`); // DEBUG LOG
        delete user.password;
        res.json({ message: "Login successful", user });
    });
});

// ==========================================
// 👤 UPDATE USER PROFILE (WITH ORDER HISTORY SYNC)
// ==========================================
app.put('/api/auth/update', (req, res) => {
    const { originalPhone, name, phone, address, pin, city, state, password } = req.body;
    
    if (!originalPhone || !name || !phone) return res.status(400).json({ error: "Missing required fields" });

    // 🔄 THE FIX: Helper function to sync old orders to the new phone number
    const syncOrdersAndRespond = () => {
        if (originalPhone !== phone) {
            // If they changed their number, migrate all their old orders!
            db.run(`UPDATE orders SET customerPhone = ? WHERE customerPhone = ?`, [phone, originalPhone], (err) => {
                sendSuccess();
            });
        } else {
            sendSuccess();
        }
    };

    const sendSuccess = () => {
        db.get(`SELECT id, name, phone, address, pin, city, state FROM users WHERE phone = ?`, [phone], (err, user) => {
            res.json({ success: true, user });
        });
    };

    // Scenario 1: They typed a new password
    if (password && password.trim() !== '') {
        db.run(`UPDATE users SET name = ?, phone = ?, address = ?, pin = ?, city = ?, state = ?, password = ? WHERE phone = ?`, 
        [name, phone, address, pin, city, state, password, originalPhone], function(err) {
            if (err) return res.status(500).json({ error: "Phone number might already be in use." });
            syncOrdersAndRespond();
        });
    } 
    // Scenario 2: They left the password blank
    else {
        db.run(`UPDATE users SET name = ?, phone = ?, address = ?, pin = ?, city = ?, state = ? WHERE phone = ?`, 
        [name, phone, address, pin, city, state, originalPhone], function(err) {
            if (err) return res.status(500).json({ error: "Phone number might already be in use." });
            syncOrdersAndRespond();
        });
    }
});

// 3. GET ALL USERS (For Admin Panel)
app.get('/api/admin/users', (req, res) => {
    // We select everything EXCEPT the password for security
    db.all(`SELECT id, name, phone, address, pin, city, state FROM users`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows); // Send the list of users back to the admin panel
    });
});

// 4. ADMIN DASHBOARD API
app.get('/api/admin/dashboard', (req, res) => {
    // Fetch all orders
    db.all(`SELECT * FROM orders`, [], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Fetch just the IDs of all users to get a total count
        db.all(`SELECT id FROM users`, [], (err, users) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Send back both arrays
            res.json({ orders: orders, totalUsers: users.length });
        });
    });
});

// ==========================================
// 🍰 INVENTORY APIs
// ==========================================

// GET: Fetch all inventory items (Used by Admin and the Products page)
app.get('/api/inventory', (req, res) => {
    db.all(`SELECT * FROM inventory`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST: Add a new item
app.post('/api/admin/inventory', (req, res) => {
    const { cat, name, desc, price, weight, time, img } = req.body;
    const stmt = db.prepare(`INSERT INTO inventory (cat, name, desc, price, weight, time, img) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    stmt.run([cat, name, desc, price, weight, time, img], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Product added to database", id: this.lastID });
    });
    stmt.finalize();
});

// PUT: Update an existing item
app.put('/api/admin/inventory/:id', (req, res) => {
    const { cat, name, desc, price, weight, time, img } = req.body;
    const stmt = db.prepare(`UPDATE inventory SET cat=?, name=?, desc=?, price=?, weight=?, time=?, img=? WHERE id=?`);
    stmt.run([cat, name, desc, price, weight, time, img, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Product updated successfully" });
    });
    stmt.finalize();
});

// DELETE: Remove an item
app.delete('/api/admin/inventory/:id', (req, res) => {
    db.run(`DELETE FROM inventory WHERE id=?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Product deleted" });
    });
});

// ==========================================
// 📦 ORDERS APIs (Admin)
// ==========================================

// GET: Fetch all orders for the admin panel
app.get('/api/admin/orders', (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// PUT: Update an order's status (e.g., 'pending' to 'baking')
app.put('/api/admin/orders/:id', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Order status updated successfully" });
    });
});
// DELETE: Remove an order completely
app.delete('/api/admin/orders/:id', (req, res) => {
    db.run(`DELETE FROM orders WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Order deleted" });
    });
});

// GET: Fetch orders for a specific customer
app.get('/api/orders/:phone', (req, res) => {
    const userPhone = req.params.phone;
    
    db.all(`SELECT * FROM orders WHERE customerPhone = ? ORDER BY timestamp DESC`, [userPhone], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error." });
        res.json(rows); // Send only this specific user's orders back
    });
});

app.get('/api/my-orders', (req, res) => {
    const userPhone = req.query.phone;
    
    if (!userPhone) return res.status(400).json({ error: "Phone number required" });

    // Fetch orders matching this phone number
    db.all(`SELECT * FROM orders WHERE customerPhone = ?`, [userPhone], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// ==========================================
// 👥 USERS APIs (Admin)
// ==========================================

// GET: Fetch all registered users
app.get('/api/admin/users', (req, res) => {
    // Select everything EXCEPT the password
    db.all(`SELECT id, name, phone, address, pin, city, state FROM users ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows); 
    });
});

// PUT: Update customer profile
app.put('/api/users/:phone', (req, res) => {
    const { name, address, pin, password } = req.body;
    const phone = req.params.phone;

    // If they typed a new password, update everything
    if (password && password.trim() !== "") {
        db.run(`UPDATE users SET name = ?, address = ?, pin = ?, password = ? WHERE phone = ?`, 
            [name, address, pin, password, phone], function(err) {
            if (err) return res.status(500).json({ error: "Failed to update profile." });
            res.json({ message: "Profile updated!" });
        });
    } else {
        // If password field was empty, update everything EXCEPT the password
        db.run(`UPDATE users SET name = ?, address = ?, pin = ? WHERE phone = ?`, 
            [name, address, pin, phone], function(err) {
            if (err) return res.status(500).json({ error: "Failed to update profile." });
            res.json({ message: "Profile updated!" });
        });
    }
});

// ==========================================
// ⚙️ SETTINGS APIs
// ==========================================

// GET: Fetch current store settings
app.get('/api/settings', (req, res) => {
    db.get(`SELECT config FROM settings WHERE id = 1`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.config) : {});
    });
});

// POST: Overwrite the settings with new updates
app.post('/api/admin/settings', (req, res) => {
    const newConfig = JSON.stringify(req.body);
    db.run(`UPDATE settings SET config = ? WHERE id = 1`, [newConfig], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Settings saved to database" });
    });
});

// ==========================================
// 🛒 CHECKOUT API (Customer)
// ==========================================
app.post('/api/orders/new', (req, res) => {
    const { customer, customerPhone, customerAddress, customerPin, items, total } = req.body;

    // Generate a clean Order ID (e.g., ORD-739281)
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const date = new Date().toLocaleDateString();
    const timestamp = new Date().toISOString();
    const status = 'pending';

    const stmt = db.prepare(`INSERT INTO orders (id, customer, customerPhone, customerAddress, customerPin, items, total, status, date, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    stmt.run([orderId, customer, customerPhone, customerAddress, customerPin, items, total, status, date, timestamp], function(err) {
        if (err) return res.status(500).json({ error: "Failed to save order to database." });
        res.json({ message: "Order placed successfully!", orderId: orderId });
    });
    stmt.finalize();
});

// ==========================================
// 🎟️ PROMO CODE APIs
// ==========================================

// 1. ADMIN: Fetch all promo codes
app.get('/api/admin/promos', (req, res) => {
    db.all(`SELECT * FROM promos ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. ADMIN: Create a new promo code
app.post('/api/admin/promos', (req, res) => {
    // discount is a percentage, e.g., 10 for 10% off
    const { code, discount } = req.body; 
    const cleanCode = code.toUpperCase().trim();

    db.run(`INSERT INTO promos (code, discount, isActive) VALUES (?, ?, 1)`, [cleanCode, discount], function(err) {
        if (err) return res.status(400).json({ error: "Code might already exist!" });
        res.json({ message: "Promo code created!", id: this.lastID });
    });
});

// 3. ADMIN: Delete a promo code
app.delete('/api/admin/promos/:id', (req, res) => {
    db.run(`DELETE FROM promos WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Promo deleted" });
    });
});

// 4. CUSTOMER: Validate a promo code at checkout
app.post('/api/promos/validate', (req, res) => {
    const { code } = req.body;
    const cleanCode = code.toUpperCase().trim();

    db.get(`SELECT * FROM promos WHERE code = ? AND isActive = 1`, [cleanCode], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error." });
        
        if (!row) return res.status(400).json({ error: "Invalid or expired promo code." });
        
        // If code is good, send back the discount percentage
        res.json({ message: "Promo applied!", discount: row.discount });
    });
});

// ==========================================
// 🛒 CHECKOUT API & EMAIL AUTOMATION
// ==========================================
app.post('/api/orders/new', (req, res) => {
    // We expect the frontend to send all these details, including customerEmail
    const { customer, customerPhone, customerAddress, customerPin, items, total, customerEmail } = req.body;

    // Generate a clean Order ID (e.g., ORD-739281)
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const date = new Date().toLocaleDateString();
    const timestamp = new Date().toISOString();
    const status = 'pending';

    // 1. SAVE TO SQLITE DATABASE
    const stmt = db.prepare(`INSERT INTO orders (id, customer, customerPhone, customerAddress, customerPin, items, total, status, date, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    stmt.run([orderId, customer, customerPhone, customerAddress, customerPin, items, total, status, date, timestamp], function(err) {
        if (err) return res.status(500).json({ error: "Failed to save order to database." });

        // 2. 📧 --- NODEMAILER AUTOMATION --- 📧
        
        // A) ALERT THE ADMIN (Sent to your sister's email)
        const adminMail = {
            from: '"ConfettinCake Bot" <confettincake.admin@gmail.com>',
            to: 'confettincake.admin@gmail.com', // Sends the alert to the admin inbox
            subject: `🚨 NEW ORDER: ${total} from ${customer}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; background: #FFF7EA; border-radius: 10px;">
                    <h2 style="color: #FF6B81;">New Order Alert! 🎂</h2>
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Customer:</strong> ${customer} (${customerPhone})</p>
                    <p><strong>Address:</strong> ${customerAddress}, Delhi-${customerPin}</p>
                    <p><strong>Total Value:</strong> <span style="color: #48BB78; font-size: 1.2em;">${total}</span></p>
                    <br>
                    <a href="http://localhost:5000/admin-login.html" style="background: #1A1A1A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open Admin Dashboard</a>
                </div>
            `
        };

        transporter.sendMail(adminMail, (err) => {
            if(err) console.log("Admin email failed to send:", err);
            else console.log("Admin notification sent successfully!");
        });

        // B) RECEIPT FOR CUSTOMER (Only fires if an email was provided)
        if (customerEmail) {
            const customerMail = {
                from: '"ConfettinCake" <confettincake.admin@gmail.com>',
                to: customerEmail,
                subject: `Your ConfettinCake Order Receipt (#${orderId}) 🎂`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Thank you for your order, ${customer}!</h2>
                        <p>We have received your order and our bakers are getting the oven ready.</p>
                        <p><strong>Order ID:</strong> ${orderId}</p>
                        <p><strong>Total Paid:</strong> ${total}</p>
                        <p>You can track your live order status by logging into your account on our website.</p>
                        <br>
                        <p>Sweet regards,<br>The ConfettinCake Team</p>
                    </div>
                `
            };
            transporter.sendMail(customerMail, (err) => {
                if(err) console.log("Customer receipt failed:", err);
                else console.log("Customer receipt sent successfully!");
            });
        }

        // 3. Send success response back to the payment page
        res.json({ message: "Order placed successfully!", orderId: orderId });
    });
    stmt.finalize();
});

// ==========================================
// 🔥 FETCH TRENDING PRODUCTS (Smart Algorithm)
// ==========================================
app.get('/api/trending', (req, res) => {
    // 1. Get all delivered orders to see what's actually selling
    db.all(`SELECT items FROM orders WHERE status = 'delivered'`, (err, orders) => {
        let counts = {};
        if (!err && orders) {
            orders.forEach(o => {
                try {
                    let items = JSON.parse(o.items);
                    items.forEach(i => { counts[i.name] = (counts[i.name] || 0) + i.qty; });
                } catch(e){}
            });
        }
        
        // Sort and get the top 3 best-selling product names
        let topNames = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
        
        // 2. Fetch the live inventory to get the images and prices for those items
        db.all(`SELECT * FROM inventory`, (err2, inv) => {
            if (err2) return res.status(500).json({error: "Database error"});
            
            let trending = [];
            topNames.forEach(name => {
                let prod = inv.find(p => p.name === name);
                if (prod) trending.push(prod);
            });
            
            // 3. THE LAUNCH FALLBACK: If there are less than 3 sales, fill the rest with random items!
            if (trending.length < 3) {
                let remaining = 3 - trending.length;
                let available = inv.filter(p => !trending.includes(p));
                available.sort(() => 0.5 - Math.random()); // Shuffle array
                trending.push(...available.slice(0, remaining));
            }
            res.json(trending);
        });
    });
});

// ==========================================
// 🖥️ FRONTEND HOSTING
// ==========================================
app.use(express.static(path.join(__dirname, '/')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running live on http://localhost:${PORT}`);
});