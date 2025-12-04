const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve UI from /public
app.use(express.static(path.join(__dirname, "public")));

// Root check
app.get("/", (req, res) => {
    res.send("License Admin API OK");
});

// Admin UI
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Login UI
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// CREATE
app.get("/create", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "create.html"));
});

// RENEW
app.get("/renew", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "renew.html"));
});

// HISTORY
app.get("/history", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "history.html"));
});

// LOCK KEY
app.get("/lock", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "lock.html"));
});

// RESET HWID
app.get("/reset-hwid", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "reset-hwid.html"));
});

// API CHECK KEY
function loadKeys() {
  return JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

function saveKeys(data) {
  fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

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

  if (info.hwid === null) {
    info.hwid = hwid;
    saveKeys(keys);
    return res.json({ status: "success", msg: "Key hợp lệ (bind HWID lần đầu)" });
  }

  if (info.hwid !== hwid) {
    return res.json({ status: "fail", msg: "HWID không khớp" });
  }

  return res.json({ status: "success", msg: "Key hợp lệ" });
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("License Admin API chạy trên port", PORT);
});
