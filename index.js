const express = require("express");
const fs = require("fs");
const app = express();
app.use(express.json());

// Load keys from JSON file
function loadKeys() {
  return JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

// Save keys back to JSON file
function saveKeys(data) {
  fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// Simple in-file key database example:
// You can edit keys.json manually to add / edit / delete keys.
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

  // First time bind HWID
  if (info.hwid === null) {
    info.hwid = hwid;
    saveKeys(keys);
    return res.json({ status: "success", msg: "Key hợp lệ (đã bind HWID lần đầu)" });
  }

  // Wrong HWID
  if (info.hwid !== hwid) {
    return res.json({ status: "fail", msg: "HWID không khớp" });
  }

  // Everything OK
  return res.json({ status: "success", msg: "Key hợp lệ" });
});

// Use port from env (Railway / Replit / etc.) or default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("License Key API đang chạy trên port", PORT);
});