const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve public UI
app.use(express.static(path.join(__dirname, "public")));

function loadKeys() {
    if (!fs.existsSync("keys.json")) return {};
    return JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

function saveKeys(data) {
    fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// Hàm tạo ký tự random
function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

// API tạo key
app.post("/api/create", (req, res) => {
    let { duration, amount, note } = req.body;
    amount = parseInt(amount);

    if (!duration || !amount || amount < 1) {
        return res.json({ success: false, message: "Thiếu dữ liệu!" });
    }

    const db = loadKeys();
    let createdKeys = [];

    for (let i = 0; i < amount; i++) {
        const key = `${duration.toUpperCase()}-QUOCDZJ2K2-${randomString(10)}`;

        db[key] = {
            duration,
            note: note || "",
            hwid: null,
            locked: false,
            history: [
                {
                    time: new Date().toLocaleString(),
                    action: "create",
                    note: note || "",
                    status: "ok"
                }
            ]
        };

        createdKeys.push(key);
    }

    saveKeys(db);

    return res.json({
        success: true,
        message: "Tạo key thành công!",
        keys: createdKeys
    });
});

// API xem lịch sử
app.get("/api/history", (req, res) => {
    const db = loadKeys();
    let list = [];

    for (const key in db) {
        if (db[key].history && db[key].history.length > 0) {
            list.push({
                key,
                history: db[key].history
            });
        }
    }

    res.json(list);
});

// Routes UI
app.get("/", (req, res) => res.send("License Admin API OK"));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/create", (req, res) => res.sendFile(path.join(__dirname, "public", "create.html")));
app.get("/history", (req, res) => res.sendFile(path.join(__dirname, "public", "history.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("API running on:", PORT);
});
