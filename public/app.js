// === CẤU HÌNH API SERVER ===
const API_BASE = "https://checkkey-api.onrender.com";

// === Gọi API tạo key ===
async function createKey() {
    const days = document.getElementById("days").value;
    const amount = document.getElementById("amount").value;
    const note = document.getElementById("note").value;

    try {
        const res = await fetch(`${API_BASE}/create-key`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ days, amount, note })
        });

        const data = await res.json();
        alert(data.message || "Tạo key thành công!");
    } catch (err) {
        alert("Không kết nối được server!");
        console.error(err);
    }
}
