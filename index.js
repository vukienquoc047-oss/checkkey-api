const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve UI folder
app.use(express.static(path.join(__dirname, "public")));

// =====================
// LOAD / SAVE DATABASE
// =====================
function loadKeys() {
    // Nếu file chưa tồn tại, trả về object rỗng
    if (!fs.existsSync("keys.json")) {
        fs.writeFileSync("keys.json", JSON.stringify({}, null, 2)); 
        return {};
    }
    return JSON.parse(fs.readFileSync("keys.json", "utf8"));
}

function saveKeys(data) {
    fs.writeFileSync("keys.json", JSON.stringify(data, null, 2));
}

// Random ký tự
function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

/* =======================================================
   API CHECK KEY (QUAN TRỌNG: Dành cho Tool C++)
   Method: POST
   Endpoint: /api/check
   ======================================================= */
app.post("/api/check", (req, res) => {
    const { key, hwid } = req.body;
    
    // Kiểm tra dữ liệu gửi lên
    if (!key || !hwid) {
        return res.json({ status: "error", msg: "Thiếu dữ liệu Key hoặc HWID!" });
    }

    const db = loadKeys();

    // 1. Kiểm tra Key có tồn tại không
    if (!db[key]) {
        return res.json({ status: "error", msg: "Key không tồn tại hoặc sai!" });
    }

    // 2. Kiểm tra xem Key có bị khoá không
    if (db[key].locked) {
        return res.json({ status: "error", msg: "Key đã bị khoá bởi Admin!" });
    }

    // 3. Xử lý HWID (Chống dùng chung key)
    
    // Trường hợp 1: Key mới tinh, chưa dính HWID -> Kích hoạt cho máy này
    if (!db[key].hwid) {
        db[key].hwid = hwid; // Gắn HWID
        
        // Ghi lịch sử
        db[key].history.push({
            time: new Date().toLocaleString(),
            action: "activate",
            note: "Kích hoạt lần đầu",
            status: "success"
        });
        
        saveKeys(db); // Lưu database
        return res.json({ status: "success", msg: "Kích hoạt thành công (Máy mới)!" });
    }

    // Trường hợp 2: Key đã có HWID -> Kiểm tra có đúng máy cũ không
    if (db[key].hwid !== hwid) {
        return res.json({ status: "error", msg: "Lỗi: Key này đã kích hoạt trên máy khác!" });
    }

    // Trường hợp 3: Đúng Key, Đúng HWID -> Cho qua
    return res.json({ status: "success", msg: "Key hợp lệ! Welcome back." });
});


/* =======================================================
   API TẠO KEY — POST /api/create
   ======================================================= */
app.post("/api/create", (req, res) => {
    let { duration, amount, note } = req.body;

    amount = parseInt(amount);

    if (!duration || !amount || amount < 1)
        return res.json({ success: false, message: "Thiếu dữ liệu!" });

    const db = loadKeys();
    const created = [];

    for (let i = 0; i < amount; i++) {
        // Tạo format Key: 1DAY-QUOCDZJ2K2-XXXXX
        const key = `${duration.toUpperCase()}-QUOCDZJ2K2-${randomString(10)}`;

        db[key] = {
            duration,
            hwid: null,     // Chưa kích hoạt thì HWID là null
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
   API XEM LỊCH SỬ KEY — GET /api/key/history?key=xxx
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
   API XEM TẤT CẢ KEY — GET /api/keys
   ======================================================= */
app.get("/api/keys", (req, res) => {
    const db = loadKeys();
    return res.json({ success: true, data: db });
});

/* =======================================================
   API XOÁ KEY — DELETE /api/key/delete
   ======================================================= */
app.delete("/api/key/delete", (req, res) => {
    const { key } = req.body;
    const db = loadKeys();

    if (!db[key]) {
        return res.json({ success: false, message: "Key không tồn tại!" });
    }

    delete db[key];
    saveKeys(db);

    return res.json({
        success: true,
        message: "Đã xoá key thành công!"
    });
});

/* =======================================================
   API RESET HWID (Tùy chọn thêm: Để reset máy cho khách)
   POST /api/key/reset-hwid
   ======================================================= */
app.post("/api/key/reset-hwid", (req, res) => {
    const { key } = req.body;
    const db = loadKeys();

    if (!db[key]) return res.json({ success: false, message: "Key không tồn tại!" });

    db[key].hwid = null; // Xóa HWID cũ
    db[key].history.push({
        time: new Date().toLocaleString(),
        action: "reset_hwid",
        note: "Admin reset HWID",
        status: "ok"
    });

    saveKeys(db);
    return res.json({ success: true, message: "Đã Reset HWID thành công!" });
});


/* =======================================================
   UI ROUTES  
   ======================================================= */
app.get("/", (req, res) => {
    // Nếu bạn muốn trang chủ hiện Dashboard luôn thì đổi thành:
    // res.sendFile(path.join(__dirname, "public", "admin.html"));
    res.send("License Admin API is Running...");
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

app.get("/all-keys", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "all-keys.html"))
);

/* =======================================================
   START SERVER
   ======================================================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API running on port:", PORT));
