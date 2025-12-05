const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ======================================
// LOAD / SAVE DB
// ======================================
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

// ======================================
// RANDOM 10–15 ký tự cuối
// ======================================
function randomKeySegment() {
    const len = Math.floor(Math.random() * 6) + 10; // 10 → 15 ký tự
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < len; i++)
        out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

// ======================================
// PHẦN GIỮA CỐ ĐỊNH
// ======================================
const FIXED_ID = "QUOCDZJ2K2";

// ======================================
// ⭐ HÀM TÍNH NGÀY HẾT HẠN UTC+7 (CHUẨN CHÍNH XÁC)
// ======================================
function getExpireDate(duration) {
    const now = new Date();

    const daysMap = {
        "1DAY": 1,
        "7DAY": 7,
        "30DAY": 30,
        "90DAY": 90,
        "365DAY": 365
    };

    const addDays = daysMap[duration] || 1;
    now.setDate(now.getDate() + addDays);

    // Tính sang múi giờ Việt Nam (UTC+7)
    const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);

    const yyyy = vn.getFullYear();
    const mm = String(vn.getMonth() + 1).padStart(2, "0");
    const dd = String(vn.getDate()).padStart(2, "0");

    const hh = String(vn.getHours()).padStart(2, "0");
    const mi = String(vn.getMinutes()).padStart(2, "0");
    const ss = String(vn.getSeconds()).padStart(2, "0");

    return `${dd}/${mm}/${yyyy}, ${hh}:${mi}:${ss}`;
}

// ======================================
// CHECK KEY
// ======================================
app.post("/api/check", (req, res) => {
    const { key, hwid } = req.body;
    if (!key || !hwid) return res.json({ status: "error", msg: "Thiếu dữ liệu!" });

    const db = loadKeys();
    if (!db[key]) return res.json({ status: "error", msg: "Key không tồn tại!" });
    if (db[key].locked) return res.json({ status: "error", msg: "Key bị khóa!" });

    // CHECK HẾT HẠN theo GMT+7
    const expireAt = new Date(new Date(db[key].expireAt).getTime());
    const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);

    if (nowVN > expireAt) {
        return res.json({ status: "error", msg: "Key đã hết hạn!" });
    }

    if (!db[key].history) db[key].history = [];

    // Kích hoạt lần đầu
    if (!db[key].hwid) {
        db[key].hwid = hwid;
        db[key].history.push({
            time: getExpireDate("0DAY"),
            action: "activate",
            status: "success"
        });
        saveKeys(db);
        return res.json({ status: "success", msg: "Kích hoạt thành công!" });
    }

    // Sai máy
    if (db[key].hwid !== hwid)
        return res.json({ status: "error", msg: "Key đã kích hoạt trên máy khác!" });

    return res.json({ status: "success", msg: "Key hợp lệ!" });
});

// ======================================
// CREATE KEY
// ======================================
app.post("/api/create", (req, res) => {
    let { duration, amount, note } = req.body;
    amount = parseInt(amount);

    if (!duration || !amount || amount < 1)
        return res.json({ success: false, message: "Thiếu dữ liệu!" });

    const db = loadKeys();
    const created = [];

    for (let i = 0; i < amount; i++) {
        const key = `${duration}-${FIXED_ID}-${randomKeySegment()}`;

        db[key] = {
            duration,
            expireAt: getExpireDate(duration),
            hwid: null,
            locked: false,
            note: note || "",
            history: [
                {
                    time: getExpireDate("0DAY"),
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

// ======================================
// API KHÁC
// ======================================
app.get("/api/keys", (req, res) => {
    const db = loadKeys();
    res.json({ success: true, data: db });
});

app.get("/api/key/history", (req, res) => {
    const { key } = req.query;
    if (!key) return res.json({ success: false, message: "Thiếu key!" });

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    res.json({ success: true, data: db[key].history || [] });
});

app.post("/api/key/lock", (req, res) => {
    const { key, reason } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].locked = true;

    db[key].history.push({
        time: getExpireDate("0DAY"),
        action: "lock",
        note: reason || "",
        status: "locked"
    });

    saveKeys(db);
    res.json({ success: true, message: "Khoá key thành công!" });
});

app.post("/api/key/reset-hwid", (req, res) => {
    const { key } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].hwid = null;

    db[key].history.push({
        time: getExpireDate("0DAY"),
        action: "reset-hwid",
        status: "ok"
    });

    saveKeys(db);
    res.json({ success: true, message: "Reset HWID thành công!" });
});

app.post("/api/key/renew", (req, res) => {
    const { key, duration } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].duration = duration;
    db[key].expireAt = getExpireDate(duration);

    db[key].history.push({
        time: getExpireDate("0DAY"),
        action: "renew",
        note: duration,
        status: "ok"
    });

    saveKeys(db);
    res.json({ success: true, message: "Gia hạn thành công!" });
});

app.delete("/api/key/delete", (req, res) => {
    const { key } = req.body;

    const db = loadKeys();
    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    delete db[key];
    saveKeys(db);

    res.json({ success: true, message: "Xoá key thành công!" });
});

app.get("/", (req, res) => res.send("API is running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server started on port:", PORT);
});
