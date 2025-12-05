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
   RANDOM 10–15 CHARACTERS
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
   GET EXPIRE DATE (ISO + UTC+7)
========================*/
function getExpireDate(duration) {
    const daysMap = {
        "1DAY": 1,
        "7DAY": 7,
        "30DAY": 30,
        "90DAY": 90,
        "365DAY": 365
    };

    const days = daysMap[duration] || 1;

    // thời điểm hiện tại (UTC)
    const now = new Date();

    // cộng thêm số ngày
    now.setUTCDate(now.getUTCDate() + days);

    // chuyển sang giờ VN
    const expire = new Date(now.getTime() + 7 * 3600 * 1000);

    // TRẢ VỀ ĐÚNG DẠNG ISO → JS PARSE CHUẨN
    return expire.toISOString();
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

    // PARSE NGÀY HẾT HẠN CHUẨN
    const expireAt = new Date(db[key].expireAt);
    const nowVN = new Date(Date.now() + 7 * 3600 * 1000);

    if (nowVN > expireAt)
        return res.json({ status: "error", msg: "Key đã hết hạn!" });

    // KÍCH HOẠT LẦN ĐẦU
    if (!db[key].hwid) {
        db[key].hwid = hwid;

        db[key].history.push({
            time: new Date().toISOString(),
            action: "activate",
            status: "success"
        });

        saveKeys(db);
        return res.json({ status: "success", msg: "Kích hoạt thành công!" });
    }

    if (db[key].hwid !== hwid)
        return res.json({ status: "error", msg: "Key đã kích hoạt trên máy khác!" });

    return res.json({ status: "success", msg: "Key hợp lệ!" });
});

/* =======================
   CREATE KEY
========================*/
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
            expireAt: getExpireDate(duration), // ISO format chuẩn
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
   OTHER API
========================*/
app.get("/api/keys", (req, res) => {
    res.json({ success: true, data: loadKeys() });
});

app.get("/api/key/history", (req, res) => {
    const { key } = req.query;

    if (!key)
        return res.json({ success: false, message: "Thiếu key!" });

    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    res.json({ success: true, data: db[key].history || [] });
});

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

app.post("/api/key/reset-hwid", (req, res) => {
    const { key } = req.body;
    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].hwid = null;
    db[key].history.push({
        time: new Date().toISOString(),
        action: "reset-hwid",
        status: "ok"
    });

    saveKeys(db);
    res.json({ success: true, message: "Reset HWID thành công!" });
});

app.post("/api/key/renew", (req, res) => {
    const { key, duration } = req.body;
    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].duration = duration;
    db[key].expireAt = getExpireDate(duration);

    db[key].history.push({
        time: new Date().toISOString(),
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
