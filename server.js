require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer'); // Make sure you have this installed if you use emails!

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- MONGODB CONNECTION ---
// Make sure to add MONGODB_URI=your_atlas_connection_string to your .env file
const dbURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/confettincake';

// ==========================================
// 🚀 RENDER 24/7 MONGODB CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("❌ CRITICAL ERROR: MONGODB_URI is completely missing! Check Render Environment Variables.");
    // We don't exit here so the server stays alive long enough to show you the log!
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("✅ MongoDB Connected Successfully"))
        .catch(err => console.error("❌ MongoDB Connection Error:", err));
}



// ==========================================
// 👑 VIP ADMIN ROUTES 
// ==========================================

// 1. The Admin Login Page (Handles the frontend redirect)
app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

// 2. Backup Login Route (Just in case you ever type it without the .html)
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

// 3. The Secret Admin Dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'admin-dashboard.html'));
});

// --- USERS PAGE ---
app.get('/admin-users', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-users.html')));
app.get('/admin-users.html', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-users.html')));

// --- INVENTORY PAGE ---
app.get('/admin-inventory', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-inventory.html')));
app.get('/admin-inventory.html', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-inventory.html')));

// --- SETTINGS PAGE ---
app.get('/admin-settings', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-settings.html')));
app.get('/admin-settings.html', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-settings.html')));

// --- ORDERS PAGE (Just in case you have a separate one!) ---
app.get('/admin-orders', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-orders.html')));
app.get('/admin-orders.html', (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin-orders.html')));

async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        // Important: Short timeout so it doesn't hang Vercel
        const opts = { serverSelectionTimeoutMS: 5000 }; 
        
        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
            console.log("✅ MongoDB Connected (Serverless Pool)");
            return mongooseInstance;
        }).catch(err => {
            console.error("❌ MongoDB Connection Error:", err);
            cached.promise = null;
            throw err;
        });
    }
    cached.conn = await cached.promise;
    return cached.conn;
}


// ==========================================

// ==========================================
// 🗄️ MONGODB SCHEMAS & MODELS
// ==========================================

const UserSchema = new mongoose.Schema({
    name: String,
    phone: { type: String, unique: true },
    email: String,
    address: String,
    city: String,
    state: String,
    pin: String,
    password: String
});
const User = mongoose.model('User', UserSchema);

const OrderSchema = new mongoose.Schema({
    id: { type: String, unique: true }, 
    customer: String,
    customerPhone: String,
    customerAddress: String,
    customerPin: String,
    items: String, 
    total: String,
    status: String,
    date: String,
    timestamp: String,
    // 🔥 NEW FIELDS
    deliveryDate: String,
    deliveryTime: String,
    isTimeAnomaly: { type: Boolean, default: false } 
});
const Order = mongoose.model('Order', OrderSchema);

const InventorySchema = new mongoose.Schema({
    cat: String,
    name: String,
    desc: String,
    price: String,
    weight: String,
    time: String,
    img: String,
    // 🔥 NEW: Added ratings object so the Amazon-style UI works
    ratings: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 }
    }
});
const Inventory = mongoose.model('Inventory', InventorySchema);

const SettingsSchema = new mongoose.Schema({
    // Keeping your original setup untouched so nothing breaks
    config: String, 

    // 🔥 THE NEW GALLERY UPGRADE 🔥
    gallery: {
        // Seasonal Theme Controls
        theme: {
            bgColor: { type: String, default: '#FAFAFA' },
            accentColor: { type: String, default: '#E23744' },
            textColor: { type: String, default: '#1C1C1C' },
            customCSS: { type: String, default: '' } 
        },
        // Dynamic Texts
        texts: {
            heroTitle: { type: String, default: 'Our Masterpieces' },
            heroSub: { type: String, default: 'A visual journey through our finest 100% eggless creations.' },
            magicTitle: { type: String, default: 'Behind the Magic' },
            magicDesc: { type: String, default: 'Every cake is a labor of love...' }
        },
        // The Actual Grid Images
        items: [{
            category: String, 
            url: String,      
            title: String,    
            btnText: { type: String, default: 'Order Similar' },
            link: { type: String, default: 'menu.html' }
        }]
    }
});

const Settings = mongoose.model('Settings', SettingsSchema);

const PromoSchema = new mongoose.Schema({
    code: { type: String, unique: true },
    discount: Number,
    isActive: { type: Boolean, default: true }
});
const Promo = mongoose.model('Promo', PromoSchema);

// --- SETTINGS BOOTSTRAPPER (The Auto-Rescue) ---
async function initializeDefaultSettings() {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings({ config: "{}" });
    }

    let existingSettings = JSON.parse(settings.config);
    let needsUpdate = false;

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
    if (!existingSettings.categories) {
        existingSettings.categories = ["cakes", "cupcakes", "cookies", "brownies", "pastries", "hampers", "chocolates"];
        needsUpdate = true;
    }
    if (!existingSettings.announcements || existingSettings.announcements.length === 0) {
        existingSettings.announcements = [
            "✨ We have freshly baked Cakes!",
            "🔥 Chocolate Cookie is our Best Selling cookie!"
        ];
        needsUpdate = true;
    }
    if (!existingSettings.promoCards || existingSettings.promoCards.length === 0) {
        existingSettings.promoCards = [
            { color: "pink", icon: "🎉", title: "Party Combos", desc: "Save 15% on Cake + Cupcake bundles!" },
            { color: "dark", icon: "🍫", title: "Midnight Cravings", desc: "Late night delivery now active in Delhi." },
            { color: "gold", icon: "🎂", title: "Custom Creations", desc: "Personalize your dream cake today." }
        ];
        needsUpdate = true;
    }
    if (!existingSettings.banners || existingSettings.banners.length === 0) {
        existingSettings.banners = [
            "https://images.unsplash.com/photo-1557925923-33b251dc32d6?w=1200&q=80",
            "https://images.unsplash.com/photo-1495147466023-af5c19cb6211?w=1200&q=80"
        ];
        needsUpdate = true;
    }
    if (!existingSettings.adminPass) existingSettings.adminPass = "cake";
    if (!existingSettings.pincodes) existingSettings.pincodes = "110";
    if (!existingSettings.footerText) existingSettings.footerText = "&copy; 2026 CONFETTINCAKE. All rights reserved.";

    if (needsUpdate) {
        settings.config = JSON.stringify(existingSettings);
        await settings.save();
        console.log("✅ Database missing data successfully restored via MongoDB!");
    }
}


// ==========================================
// 📧 EMAIL TRANSPORTER SETUP (Placeholder)
// ==========================================
// Note: Configure this with your actual credentials when ready
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your_email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your_app_password'
    }
});


// ==========================================
// 🚀 BACKEND APIs (Mongoose Rewrites)
// ==========================================

// --- UTILITY FORMATTER ---
// Maps MongoDB _id to id so your frontend doesn't break
const formatDoc = (doc) => {
    const obj = doc.toObject();
    
    // 🔥 FIX: If it is an Order with our custom 'ORD-' ID, preserve it!
    // Otherwise, safely map the MongoDB _id to id.
    if (obj.id && obj.id.startsWith('ORD-')) {
        // Do nothing, keep the clean original ID
    } else {
        obj.id = obj._id.toString();
    }
    
    return obj;
};

// 1. SIGN UP API
app.post('/api/auth/signup', async (req, res) => {
    const { name, phone, address, pin, city, state, password } = req.body;
    
    try {
        const existingUser = await User.findOne({ phone });
        if (existingUser) return res.status(400).json({ error: "Phone number already registered!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, phone, address, pin, city, state, password: hashedPassword });
        await newUser.save();
        
        res.json({ message: "Registration successful", user: formatDoc(newUser) });
    } catch (error) {
        res.status(500).json({ error: "Server error during signup." });
    }
});

// 2. LOGIN API (Passwordless)
app.post('/api/auth/login', async (req, res) => {
    const { phone } = req.body;
    try {
        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ error: "Account not found. Please sign up." });

        const userObj = formatDoc(user);
        delete userObj.password;
        res.json({ message: "Login successful", user: userObj });
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
});

// 👤 UPDATE USER PROFILE
app.put('/api/auth/update', async (req, res) => {
    const { originalPhone, name, phone, address, pin, city, state, password } = req.body;
    if (!originalPhone || !name || !phone) return res.status(400).json({ error: "Missing required fields" });

    try {
        let updateData = { name, phone, address, pin, city, state };
        
        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, await bcrypt.genSalt(10));
        }

        const updatedUser = await User.findOneAndUpdate({ phone: originalPhone }, updateData, { new: true });
        if (!updatedUser) return res.status(500).json({ error: "Failed to update user." });

        if (originalPhone !== phone) {
            await Order.updateMany({ customerPhone: originalPhone }, { customerPhone: phone });
        }

        res.json({ success: true, user: formatDoc(updatedUser) });
    } catch (err) {
        res.status(500).json({ error: "Phone number might already be in use." });
    }
});

// ADMIN DASHBOARD API
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const orders = await Order.find();
        const totalUsers = await User.countDocuments();
        // Return exactly as frontend expects
        res.json({ orders: orders.map(formatDoc), totalUsers });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// ==========================================
// 🍰 INVENTORY APIs
// ==========================================
app.get('/api/inventory', async (req, res) => {
    try {
        const items = await Inventory.find();
        res.json(items.map(formatDoc));
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/admin/inventory', async (req, res) => {
    try {
        // 🔥 NEW: Force every new cake to start with 0 reviews
        const productData = {
            ...req.body,
            ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
        const newItem = new Inventory(productData);
        await newItem.save();
        res.json({ message: "Product added to database", id: newItem._id });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.put('/api/admin/inventory/:id', async (req, res) => {
    try {
        await Inventory.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Product updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.delete('/api/admin/inventory/:id', async (req, res) => {
    try {
        await Inventory.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// ==========================================
// 📦 ORDERS APIs
// ==========================================
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ timestamp: -1 });
        res.json(orders.map(formatDoc));
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.put('/api/admin/orders/:id', async (req, res) => {
    try {
        // We use finding by the custom 'id' field (ORD-123), not _id
        await Order.findOneAndUpdate({ id: req.params.id }, { status: req.body.status });
        res.json({ message: "Order status updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        await Order.findOneAndDelete({ id: req.params.id });
        res.json({ message: "Order deleted" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.get('/api/orders/:phone', async (req, res) => {
    try {
        const orders = await Order.find({ customerPhone: req.params.phone }).sort({ timestamp: -1 });
        res.json(orders.map(formatDoc));
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.get('/api/my-orders', async (req, res) => {
    if (!req.query.phone) return res.status(400).json({ error: "Phone number required" });
    try {
        const orders = await Order.find({ customerPhone: req.query.phone });
        res.json(orders.map(formatDoc));
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// ==========================================
// 👥 USERS APIs (Admin)
// ==========================================
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ _id: -1 });
        res.json(users.map(formatDoc));
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.put('/api/users/:phone', async (req, res) => {
    const { name, address, pin, password } = req.body;
    try {
        let updateData = { name, address, pin };
        if (password && password.trim() !== "") {
            updateData.password = await bcrypt.hash(password, await bcrypt.genSalt(10));
        }
        await User.findOneAndUpdate({ phone: req.params.phone }, updateData);
        res.json({ message: "Profile updated!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update profile." });
    }
});

// ==========================================
// ⚙️ SETTINGS APIs
// ==========================================
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await Settings.findOne();
        res.json(settings ? JSON.parse(settings.config) : {});
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/admin/settings', async (req, res) => {
    try {
        const newConfig = JSON.stringify(req.body);
        await Settings.findOneAndUpdate({}, { config: newConfig }, { upsert: true });
        res.json({ message: "Settings saved to database" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// ==========================================
// 🎟️ PROMO CODE APIs
// ==========================================
app.get('/api/admin/promos', async (req, res) => {
    try {
        const promos = await Promo.find().sort({ _id: -1 });
        res.json(promos.map(formatDoc));
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/admin/promos', async (req, res) => {
    try {
        const newPromo = new Promo({
            code: req.body.code.toUpperCase().trim(),
            discount: req.body.discount
        });
        await newPromo.save();
        res.json({ message: "Promo code created!", id: newPromo._id });
    } catch (err) {
        res.status(400).json({ error: "Code might already exist!" });
    }
});

app.delete('/api/admin/promos/:id', async (req, res) => {
    try {
        await Promo.findByIdAndDelete(req.params.id);
        res.json({ message: "Promo deleted" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/promos/validate', async (req, res) => {
    try {
        const cleanCode = req.body.code.toUpperCase().trim();
        const promo = await Promo.findOne({ code: cleanCode, isActive: true });
        if (!promo) return res.status(400).json({ error: "Invalid or expired promo code." });
        res.json({ message: "Promo applied!", discount: promo.discount });
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

// ==========================================
// 🛒 CHECKOUT API & EMAIL AUTOMATION
// ==========================================
app.post('/api/orders/new', async (req, res) => {
    const { customer, customerPhone, customerAddress, customerPin, items, total, customerEmail } = req.body;

    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const date = new Date().toLocaleDateString();
    const timestamp = new Date().toISOString();

    try {
        const newOrder = new Order({
            id: orderId,
            customer, customerPhone, customerAddress, customerPin,
            items, total, status: 'pending', date, timestamp
        });
        await newOrder.save();

        // 📧 --- NODEMAILER AUTOMATION --- 📧
        const adminMail = {
            from: '"ConfettinCake Bot" <confettincake.admin@gmail.com>',
            to: 'confettincake.admin@gmail.com', 
            subject: `🚨 NEW ORDER: ${total} from ${customer}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; background: #FFF7EA; border-radius: 10px;">
                    <h2 style="color: #FF6B81;">New Order Alert! 🎂</h2>
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Customer:</strong> ${customer} (${customerPhone})</p>
                    <p><strong>Address:</strong> ${customerAddress}, Delhi-${customerPin}</p>
                    <p><strong>Total Value:</strong> <span style="color: #48BB78; font-size: 1.2em;">${total}</span></p>
                </div>
            `
        };

        transporter.sendMail(adminMail, (err) => {
            if(err) console.log("Admin email failed (check credentials):", err.message);
        });

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
                    </div>
                `
            };
            transporter.sendMail(customerMail, (err) => {
                if(err) console.log("Customer receipt failed:", err.message);
            });
        }

        res.json({ message: "Order placed successfully!", orderId: orderId });
    } catch (err) {
        res.status(500).json({ error: "Failed to save order to database." });
    }
});

// ==========================================
// 🔥 FETCH TRENDING PRODUCTS (Smart Algorithm)
// ==========================================
app.get('/api/trending', async (req, res) => {
    try {
        const orders = await Order.find({ status: 'delivered' });
        let counts = {};
        
        orders.forEach(o => {
            try {
                let items = JSON.parse(o.items);
                items.forEach(i => { counts[i.name] = (counts[i.name] || 0) + i.qty; });
            } catch(e){}
        });
        
        let topNames = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
        const inv = await Inventory.find();
        
        let trending = [];
        topNames.forEach(name => {
            let prod = inv.find(p => p.name === name);
            if (prod) trending.push(formatDoc(prod));
        });
        
        if (trending.length < 3) {
            let remaining = 3 - trending.length;
            let available = inv.filter(p => !trending.find(t => t.name === p.name));
            available.sort(() => 0.5 - Math.random()); 
            let randomAdditions = available.slice(0, remaining).map(formatDoc);
            trending.push(...randomAdditions);
        }
        res.json(trending);
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// 🔥 ADMIN ROUTE: Inject Custom Ratings for the Pitch
app.post('/api/admin/inventory/:id/rate', async (req, res) => {
    try {
        const productId = req.params.id;
        const { stars, count } = req.body; 

        // Validate the input
        if (!stars || stars < 1 || stars > 5) {
            return res.status(400).json({ error: "Stars must be between 1 and 5." });
        }

        // Define exactly which star level we are incrementing
        const updateField = `ratings.${stars}`;

        // Tell MongoDB to increment that specific star count by the amount you provide
        // (Assuming you are using Mongoose, change 'Inventory' to your actual model name)
        const updatedProduct = await Inventory.findByIdAndUpdate(
            productId,
            { $inc: { [updateField]: Number(count) } },
            { new: true } // Returns the updated document
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: "Product not found." });
        }

        res.json({ success: true, message: `Added ${count} x ${stars}-Star ratings!`, product: updatedProduct });

    } catch (error) {
        console.error("Rating Injection Error:", error);
        res.status(500).json({ error: "Database connection failed." });
    }
});

// ==========================================
// 🖥️ FRONTEND HOSTING
// ==========================================
app.use(express.static(path.join(__dirname, '/')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
// Render requires binding to 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running live on port ${PORT}`);
});