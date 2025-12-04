const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve UI folder
app.use(express.static(path.join(__dirname, "public")));

function loadKeys() {
    if (!fs.existsSync("keys.json")) return {};
    return JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

function saveKeys(data) {
    fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// Hàm random ký tự
function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

/* =======================================================
   API TẠO KEY — /api/create
   ======================================================= */
app.post("/api/create", (req, res) => {
    let { duration, amount, note } = req.body;

    amount = parseInt(amount);

    if (!duration || !amount || amount < 1)
        return res.json({ success: false, message: "Thiếu dữ liệu!" });

    const db = loadKeys();
    const created = [];

    for (let i = 0; i < amount; i++) {
        const key = `${duration.toUpperCase()}-QUOCDZJ2K2-${randomString(10)}`;

        db[key] = {
            duration,
            hwid: null,
            locked: false,
            note: note || "",
            history: [
                {
                    time: new Date().toLocaleString(),
                    action: "create",
                    note: note || "",
                    status: "ok"
                }
            ]
        };

        created.push(key);
    }

    saveKeys(db);

    return res.json({
        success: true,
        message: "Tạo key thành công!",
        keys: created
    });
});

/* =======================================================
   API XEM LỊCH SỬ KEY — /api/key/history
   ======================================================= */
app.get("/api/key/history", (req, res) => {
    const key = req.query.key;
    const db = loadKeys();

    if (!db[key])
        return res.json({ success: false, message: "Key không tồn tại!" });

    return res.json({
        success: true,
        data: db[key].history || []
    });
});

/* =======================================================
   UI ROUTES  
   ======================================================= */
app.get("/", (req, res) => {
    res.send("License Admin API OK");
});

app.get("/admin", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "admin.html"))
);

app.get("/create", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "create.html"))
);

app.get("/history", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "history.html"))
);

/* =======================================================
   START SERVER
   ======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API running on port:", PORT));
