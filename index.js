const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   LOAD / SAVE DATABASE
========================*/
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

/* =======================
   RANDOM KEY
========================*/
function randomKeySegment() {
    const len = Math.floor(Math.random() * 6) + 10;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < len; i++)
        out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

const FIXED_ID = "QUOCDZJ2K2";

/* =======================
   PARSE DURATION (HỖ TRỢ 1d / 1DAY)
========================*/
function parseDuration(text) {
    if (!text) return 1;

    text = text.toUpperCase().trim();

    const map = {
        "1DAY": 1, "1D": 1,
        "7DAY": 7, "7D": 7,
        "30DAY": 30, "30D": 30,
        "90DAY": 90, "90D": 90,
        "365DAY": 365, "365D": 365
    };

    if (map[text]) return map[text];

    // fallback auto: parse số
    const m = text.match(/(\d+)/);
    if (m) return parseInt(m[1]);

    return 1;
}

/* =======================
   TIME FORMAT FUNCTIONS
========================*/

// Convert ISO UTC → Date VN
function toVNDate(iso) {
    const d = new Date(iso);
    return new Date(d.getTime() + 7 * 3600 * 1000);
}

// Format: DD/MM/YYYY HH:mm (GMT+7)
function formatVN(iso) {
    const d = toVNDate(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${h}:${m} (GMT+7)`;
}

// Thời gian còn lại
function timeLeft(iso) {
    const now = new Date();
    const ex = new Date(iso);

    let diff = ex - now;
    if (diff <= 0) return "Hết hạn";

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    diff %= (24 * 60 * 60 * 1000);

    const hours = Math.floor(diff / (60 * 60 * 1000));
    diff %= (60 * 60 * 1000);

    const minutes = Math.floor(diff / (60 * 1000));

    return `${days} ngày ${hours} giờ ${minutes} phút`;
}

/* =======================
   CHECK KEY
========================*/
app.post("/api/check", (req, res) => {
    const { key, hwid } = req.body;

    if (!key || !hwid)
        return res.json({ status: "error", msg: "Thiếu dữ liệu!" });

    const db = loadKeys();

    if (!db[key])
        return res.json({ status: "error", msg: "Key không tồn tại!" });

    if (db[key].locked)
        return res.json({ status: "error", msg: "Key bị khóa!" });

    const now = new Date();

    // =====================
    // KÍCH HOẠT LẦN ĐẦU
    // =====================
    if (!db[key].hwid) {
        db[key].hwid = hwid;

        const days = parseDuration(db[key].duration);
        const expire = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        db[key].activatedAt = now.toISOString();
        db[key].expireAt = expire.toISOString();

        db[key].history.push({
            time: now.toISOString(),
            action: "activate",
            status: "success"
        });

        saveKeys(db);

        return res.json({
            status: "success",
            msg: "Kích hoạt thành công!",
            expireAt: db[key].expireAt,
            expireAtVN: formatVN(db[key].expireAt),
            timeLeft: timeLeft(db[key].expireAt)
        });
    }

    // =====================
    // SAI HWID
    // =====================
    if (db[key].hwid !== hwid)
        return res.json({ status: "error", msg: "Key đã kích hoạt trên máy khác!" });

    // =====================
    // KIỂM TRA HẾT HẠN
    // =====================
    const expireAt = new Date(db[key].expireAt);

    if (now > expireAt)
        return res.json({ status: "error", msg: "Key đã hết hạn!" });

    return res.json({
        status: "success",
        msg: "Key hợp lệ!",
        expireAt: db[key].expireAt,
        expireAtVN: formatVN(db[key].expireAt),
        timeLeft: timeLeft(db[key].expireAt)
    });
});

/* =======================
   CREATE KEY
========================*/
app.post("/api/create", (req, res) => {
    let { duration, amount, note } = req.body;
    amount = parseInt(amount);

    if (!duration || !amount || amount < 1)
        return res.json({ success: false, message: "Thiếu dữ liệu!" });

    duration = duration.toUpperCase(); // chuẩn hóa

    const db = loadKeys();
    const created = [];

    for (let i = 0; i < amount; i++) {
        const key = `${duration}-${FIXED_ID}-${randomKeySegment()}`;

        db[key] = {
            duration,
            expireAt: null,
            activatedAt: null,
            hwid: null,
            locked: false,
            note: note || "",
            history: [
                {
                    time: new Date().toISOString(),
                    action: "create",
                    status: "ok"
                }
            ]
        };

        created.push(key);
    }

    saveKeys(db);
    res.json({ success: true, keys: created });
});

/* =======================
   GET ALL KEYS (WITH FORMATTED_TIME)
========================*/
app.get("/api/keys", (req, res) => {
    const db = loadKeys();

    for (let k in db) {
        if (db[k].expireAt) {
            db[k].expireAtVN = formatVN(db[k].expireAt);
            db[k].timeLeft = timeLeft(db[k].expireAt);
        } else {
            db[k].expireAtVN = "Chưa kích hoạt";
            db[k].timeLeft = "Chưa kích hoạt";
        }
    }

    res.json({ success: true, data: db });
});

/* =======================
   KEY HISTORY
========================*/
app.get("/api/key/history", (req, res) => {
    const { key } = req.query;

    if (!key)
        return res.json({ success: false, message: "Thiếu key!" });

    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    res.json({ success: true, data: db[key].history || [] });
});

/* =======================
   LOCK KEY
========================*/
app.post("/api/key/lock", (req, res) => {
    const { key, reason } = req.body;
    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].locked = true;

    db[key].history.push({
        time: new Date().toISOString(),
        action: "lock",
        note: reason || "",
        status: "locked"
    });

    saveKeys(db);
    res.json({ success: true, message: "Khoá key thành công!" });
});

/* =======================
   RESET HWID
========================*/
app.post("/api/key/reset-hwid", (req, res) => {
    const { key } = req.body;
    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].hwid = null;
    db[key].activatedAt = null;
    db[key].expireAt = null;

    db[key].history.push({
        time: new Date().toISOString(),
        action: "reset-hwid",
        status: "ok"
    });

    saveKeys(db);
    res.json({ success: true, message: "Reset HWID thành công!" });
});

/* =======================
   RENEW KEY
========================*/
app.post("/api/key/renew", (req, res) => {
    const { key, duration } = req.body;
    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].duration = duration.toUpperCase();

    if (db[key].activatedAt) {
        const days = parseDuration(db[key].duration);
        const expire = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        db[key].expireAt = expire.toISOString();
    }

    db[key].history.push({
        time: new Date().toISOString(),
        action: "renew",
        note: duration,
        status: "ok"
    });

    saveKeys(db);
    res.json({ success: true, message: "Gia hạn thành công!" });
});

/* =======================
   DELETE KEY
========================*/
app.delete("/api/key/delete", (req, res) => {
    const { key } = req.body;
    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    delete db[key];
    saveKeys(db);

    res.json({ success: true, message: "Xoá key thành công!" });
});

/* =======================
   SERVER
========================*/
app.get("/", (req, res) => res.send("API is running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server started on port:", PORT);
});
