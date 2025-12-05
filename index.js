const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function loadKeys() {
    try {
        return JSON.parse(fs.readFileSync("keys.json", "utf8"));
    } catch {
        return {};
    }
}

function saveKeys(data) {
    fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// RANDOM 10–15 ký tự
function randomKeySegment() {
    const len = Math.floor(Math.random() * 6) + 10; // 10 → 15 ký tự
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < len; i++)
        out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

// PHẦN GIỮA CỐ ĐỊNH
const FIXED_ID = "QUOCDZJ2K2";


// CHECK
app.post("/api/check", (req, res) => {
    const { key, hwid } = req.body;
    if (!key || !hwid) return res.json({ status: "error", msg: "Thiếu dữ liệu!" });

    const db = loadKeys();
    if (!db[key]) return res.json({ status: "error", msg: "Key không tồn tại!" });
    if (db[key].locked) return res.json({ status: "error", msg: "Key bị khóa!" });

    if (!db[key].history) db[key].history = [];

    if (!db[key].hwid) {
        db[key].hwid = hwid;
        db[key].history.push({ time: new Date().toLocaleString(), action: "activate", status: "success" });
        saveKeys(db);
        return res.json({ status: "success", msg: "Kích hoạt thành công!" });
    }

    if (db[key].hwid !== hwid)
        return res.json({ status: "error", msg: "Key đã kích hoạt trên máy khác!" });

    return res.json({ status: "success", msg: "Key hợp lệ!" });
});


// ----------------------------------------------------
// CREATE — BẢN ĐÃ FIX THEO ĐÚNG FORMAT 1DAY-QUOCDZJ2K2-XXXXX
// ----------------------------------------------------
app.post("/api/create", (req, res) => {
    let { duration, amount, note } = req.body;
    amount = parseInt(amount);

    if (!duration || !amount || amount < 1)
        return res.json({ success: false, message: "Thiếu dữ liệu!" });

    const db = loadKeys();
    const created = [];

    for (let i = 0; i < amount; i++) {

        // 🎯 TẠO KEY ĐÚNG FORMAT
        const key = `${duration}-${FIXED_ID}-${randomKeySegment()}`;

        db[key] = {
            duration,
            hwid: null,
            locked: false,
            note: note || "",
            history: [
                { time: new Date().toLocaleString(), action: "create", status: "ok" }
            ]
        };

        created.push(key);
    }

    saveKeys(db);
    res.json({ success: true, keys: created });
});


// ================= ADD MISSING ROUTES =================

// ALL KEYS
app.get("/api/keys", (req, res) => {
    const db = loadKeys();
    res.json({ success: true, data: db });
});

// HISTORY
app.get("/api/key/history", (req, res) => {
    const { key } = req.query;
    if (!key) return res.json({ success: false, message: "Thiếu key!" });

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    res.json({ success: true, data: db[key].history || [] });
});

// LOCK
app.post("/api/key/lock", (req, res) => {
    const { key, reason } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].locked = true;

    db[key].history.push({
        time: new Date().toLocaleString(),
        action: "lock",
        note: reason || "",
        status: "locked"
    });

    saveKeys(db);
    res.json({ success: true, message: "Khoá key thành công!" });
});

// RESET HWID
app.post("/api/key/reset-hwid", (req, res) => {
    const { key } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].hwid = null;

    db[key].history.push({
        time: new Date().toLocaleString(),
        action: "reset-hwid",
        status: "ok"
    });

    saveKeys(db);
    res.json({ success: true, message: "Reset HWID thành công!" });
});

// RENEW
app.post("/api/key/renew", (req, res) => {
    const { key, duration } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].duration = duration;

    db[key].history.push({
        time: new Date().toLocaleString(),
        action: "renew",
        note: duration,
        status: "ok"
    });

    saveKeys(db);
    res.json({ success: true, message: "Gia hạn thành công!" });
});

// DELETE KEY
app.delete("/api/key/delete", (req, res) => {
    const { key } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    delete db[key];
    saveKeys(db);

    res.json({ success: true, message: "Xoá key thành công!" });
});


// UI routes
function sendPage(res, file) {
    res.sendFile(path.join(__dirname, "public", file));
}

app.get("/", (req, res) => res.send("API is running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server started on port:", PORT);
});
