const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==== Load & Save JSON Database ====
function loadKeys() {
    return JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

function saveKeys(data) {
    fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// ====================== API CHECK KEY ======================
app.post("/api/check", (req, res) => {
    const { key, hwid } = req.body;

    if (!key || !hwid) {
        return res.json({ status: "error", msg: "Thiếu key hoặc HWID" });
    }

    const keys = loadKeys();

    if (!keys[key]) {
        return res.json({ status: "fail", msg: "Key không tồn tại" });
    }

    const info = keys[key];

    if (info.locked) {
        return res.json({ status: "fail", msg: "Key đã bị khoá" });
    }

    // First time bind HWID
    if (info.hwid === null) {
        info.hwid = hwid;
        saveKeys(keys);
        return res.json({ status: "success", msg: "Key hợp lệ (lần đầu bind HWID)" });
    }

    if (info.hwid !== hwid) {
        return res.json({ status: "fail", msg: "HWID không khớp" });
    }

    if (Date.now() > info.expire) {
        return res.json({ status: "fail", msg: "Key đã hết hạn" });
    }

    return res.json({ status: "success", msg: "Key hợp lệ" });
});

// ====================== API TẠO KEY ======================
app.post("/api/create", (req, res) => {
    const { days, quantity, note } = req.body;

    if (!days || !quantity) {
        return res.json({ status: "error", msg: "Thiếu tham số." });
    }

    const keys = loadKeys();
    const newKeys = [];

    for (let i = 0; i < quantity; i++) {
        const key = "KEY-" + Math.random().toString(36).substring(2, 10).toUpperCase();

        keys[key] = {
            hwid: null,
            expire: Date.now() + days * 86400000,
            note: note || "",
            locked: false
        };

        newKeys.push(key);
    }

    saveKeys(keys);
    res.json({ status: "success", msg: "Tạo key thành công!", keys: newKeys });
});

// ====================== API GIA HẠN KEY ======================
app.post("/api/renew", (req, res) => {
    const { key, days } = req.body;

    const keys = loadKeys();
    if (!keys[key]) return res.json({ status: "error", msg: "Key không tồn tại" });

    keys[key].expire += days * 86400000;
    saveKeys(keys);

    res.json({ status: "success", msg: "Gia hạn thành công!" });
});

// ====================== API KHÓA KEY ======================
app.post("/api/lock", (req, res) => {
    const { key } = req.body;

    const keys = loadKeys();
    if (!keys[key]) return res.json({ status: "error", msg: "Key không tồn tại" });

    keys[key].locked = true;
    saveKeys(keys);

    res.json({ status: "success", msg: "Đã khoá key!" });
});

// ====================== API RESET HWID ======================
app.post("/api/reset-hwid", (req, res) => {
    const { key } = req.body;

    const keys = loadKeys();
    if (!keys[key]) return res.json({ status: "error", msg: "Key không tồn tại" });

    keys[key].hwid = null;
    saveKeys(keys);

    res.json({ status: "success", msg: "Reset HWID thành công!" });
});

// ====================== API XEM TẤT CẢ KEY ======================
app.get("/api/history", (req, res) => {
    const data = loadKeys();
    res.json({ status: "success", data });
});

// ====================== UI (Admin Panel) ======================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.send("License Admin API OK");
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("License Key API đang chạy trên port", PORT);
});
