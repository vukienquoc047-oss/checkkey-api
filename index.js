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

function randomString(len) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

app.post("/api/check", (req, res) => {
    const { key, hwid } = req.body;
    if (!key || !hwid) return res.json({ status: "error", msg: "Thiếu dữ liệu!" });

    const db = loadKeys();
    if (!db[key]) return res.json({ status: "error", msg: "Key không tồn tại!" });
    if (db[key].locked) return res.json({ status: "error", msg: "Key bị khóa!" });

    if (!db[key].hwid) {
        db[key].hwid = hwid;
        db[key].history.push({
            time: new Date().toLocaleString(),
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

app.post("/api/create", (req, res) => {
    let { duration, amount, note } = req.body;
    amount = parseInt(amount);

    if (!duration || !amount || amount < 1)
        return res.json({ success: false, message: "Thiếu dữ liệu!" });

    const db = loadKeys();
    const created = [];

    for (let i = 0; i < amount; i++) {
        const key = `${duration}-${randomString(12)}`;
        db[key] = {
            duration,
            hwid: null,
            locked: false,
            note: note || "",
            history: [
                {
                    time: new Date().toLocaleString(),
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

app.get("/", (req, res) => res.send("API is running"));

// 🔥 PHẦN QUAN TRỌNG NHẤT CHO RENDER
const PORT = process.env.PORT;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server started on port:", PORT);
});
