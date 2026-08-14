# label3d

Công cụ tạo mẫu in 3D từ chữ + emoji (nhãn/móc khoá) → xuất file STL, kèm dashboard quản
trị để cấu hình giới hạn thông số in, màu nhựa và font chữ.

## Cấu trúc

- `font-to-3d-demo.html` — bản demo gốc, chạy độc lập trong trình duyệt (không cần
  server), dùng làm bản đối chiếu/tham khảo cho phần logic dựng hình 3D.
- `server/` — ứng dụng đầy đủ dùng cho kinh doanh: trang khách hàng + dashboard quản trị,
  backend Node.js/Express, dữ liệu lưu MySQL. **Xem [server/README.md](server/README.md)
  để biết cách cài đặt và chạy (Docker Compose hoặc Node trực tiếp).**
- `docker-compose.yml` — chạy toàn bộ stack (app + MySQL) bằng 1 lệnh, xem hướng dẫn trong
  `server/README.md`.
- `CherryBombOne-Regular.ttf`, `NotoEmoji-VariableFont_wght.ttf` — 2 font mặc định, dùng
  làm dữ liệu seed ban đầu cho `server/`.

## Bắt đầu nhanh

```bash
cp .env.example .env     # sua mat khau MySQL / SESSION_SECRET
docker compose up -d --build
docker compose logs app  # xem mat khau admin tu sinh luc dau tien
```

Truy cập trang khách tại `http://localhost:7788/`, dashboard quản trị tại
`http://localhost:7788/admin/login.html`.
