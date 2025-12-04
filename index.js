const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== LOAD & SAVE DATA ======
function loadKeys() {
    try {
        return JSON.parse(fs.readFileSync("keys.json", "utf8"));
    } catch (err) {
        return {};
    }
}

function saveKeys(data) {
    fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// ====== SERVE UI ======
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.send("License Admin UI Running OK");
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ======================================================
// =============== API TẠO KEY ===========================
// ======================================================

app.post("/api/key/create", (req, res) => {
    const { duration, count, note } = req.body;
    if (!duration || !count) {
        return res.json({ success: false, message: "Thiếu dữ liệu!" });
    }

    const keys = loadKeys();
    const list = [];

    for (let i = 0; i < count; i++) {
        const key = "KEY-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        keys[key] = {
            duration,
            note: note || "",
            hwid: null,
            locked: false,
            history: []
        };
        list.push(key);

        keys[key].history.push({
            time: new Date().toLocaleString(),
            action: "create",
            note: note || "",
            status: "ok"
        });
    }

    saveKeys(keys);
    return res.json({ success: true, message: "Tạo key thành công!", keys: list });
});

// ======================================================
// =============== API GIA HẠN KEY ========================
// ======================================================

app.post("/api/key/renew", (req, res) => {
    const { key, duration } = req.body;
    const keys = loadKeys();

    if (!keys[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    keys[key].duration = duration;
    keys[key].history.push({
        time: new Date().toLocaleString(),
        action: "renew",
        note: duration,
        status: "ok"
    });

    saveKeys(keys);
    res.json({ success: true, message: "Gia hạn key thành công!" });
});

// ======================================================
// =============== API KHÓA KEY ===========================
// ======================================================

app.post("/api/key/lock", (req, res) => {
    const { key } = req.body;
    const keys = loadKeys();

    if (!keys[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    keys[key].locked = true;
    keys[key].history.push({
        time: new Date().toLocaleString(),
        action: "lock",
        note: "Khoá key",
        status: "locked"
    });

    saveKeys(keys);
    res.json({ success: true, message: "Khóa key thành công!" });
});

// ======================================================
// =============== API RESET HWID ========================
// ======================================================

app.post("/api/key/reset-hwid", (req, res) => {
    const { key } = req.body;
    const keys = loadKeys();

    if (!keys[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    keys[key].hwid = null;
    keys[key].history.push({
        time: new Date().toLocaleString(),
        action: "reset_hwid",
        note: "Reset HWID",
        status: "ok"
    });

    saveKeys(keys);
    res.json({ success: true, message: "Reset HWID thành công!" });
});

// ======================================================
// =============== API LỊCH SỬ ============================
// ======================================================

app.get("/api/key/history", (req, res) => {
    const { key } = req.query;
    const keys = loadKeys();

    if (!keys[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    return res.json({ success: true, data: keys[key].history });
});

// ======================================================
// =============== API CHECK KEY CLIENT ==================
// ======================================================

app.post("/api/check", (req, res) => {
    const { key, hwid } = req.body;

    const keys = loadKeys();

    if (!keys[key]) return res.json({ status: "fail", msg: "Key không tồn tại" });

    if (keys[key].locked) return res.json({ status: "fail", msg: "Key đã bị khóa!" });

    if (keys[key].hwid === null) {
        keys[key].hwid = hwid;
        saveKeys(keys);
        return res.json({ status: "success", msg: "Bind HWID lần đầu thành công!" });
    }

    if (keys[key].hwid !== hwid) {
        return res.json({ status: "fail", msg: "Sai HWID!" });
    }

    return res.json({ status: "success", msg: "Key hợp lệ!" });
});

// ======================================================

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API running on port", PORT));
