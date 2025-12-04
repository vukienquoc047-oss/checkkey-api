# License Key API

API check key cực đơn giản dùng Node.js + Express.

## Endpoint

`POST /api/check`

Body (JSON):

```json
{
  "key": "ABC123",
  "hwid": "HWID-123"
}
```

Response:

- Thành công (lần đầu): key sẽ được bind với HWID đó.
- Thành công (đã bind đúng HWID): trả về `Key hợp lệ`.
- Sai HWID / sai key: trả về lỗi tương ứng.
