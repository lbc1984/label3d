# Printer3D Server

Backend + dashboard quản trị cho công cụ tạo mẫu in 3D (Font/Emoji → STL). Dữ liệu (giới
hạn thông số, màu nhựa, font) lưu trong **MySQL**; file font upload lưu trên đĩa.

## Cấu trúc

- `public/index.html` — trang khách hàng (giữ nguyên toàn bộ logic dựng 3D/xuất STL của bản demo gốc, chỉ đổi nguồn cấu hình từ hardcode sang fetch API).
- `public/admin/` — dashboard quản trị (đăng nhập, giới hạn thông số, màu nhựa, font chữ).
- `src/` — server Express (API, kết nối MySQL, auth, upload font).
- `data/` — file font đã upload + session (tự tạo lúc chạy, **không commit** — đã có trong `.gitignore`). Không còn chứa database (đã chuyển sang MySQL).

## Cách 1 — Chạy bằng Docker Compose (khuyến nghị)

Từ **thư mục gốc dự án** (`Printer3D/`, phía trên `server/`):

```bash
cp .env.example .env     # sua MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD / SESSION_SECRET
docker compose up -d --build
docker compose logs app  # xem mat khau admin tu sinh (chi hien 1 lan luc seed dau tien)
```

Stack gồm 2 container: `db` (MySQL 8.0, volume `mysql_data`) và `app` (Node, volume
`app_data` mount vào `server/data` để font/session sống sót qua lần restart). App chỉ
khởi động sau khi MySQL healthcheck pass.

Mặc định truy cập tại `http://localhost:7788/` (đổi qua biến `APP_PORT` trong `.env` nếu
cổng này đang bị chiếm — máy nào cũng nên kiểm tra bằng `docker ps` trước).

Dừng: `docker compose down` (giữ volume, dữ liệu còn nguyên). Xoá sạch để làm lại từ đầu:
`docker compose down -v`.

## Cách 2 — Chạy trực tiếp bằng Node (cần tự có MySQL)

```bash
cd server
npm install
cp .env.example .env   # sua MYSQL_HOST/USER/PASSWORD/DATABASE tro toi MySQL that + SESSION_SECRET
npm start
```

## Lần chạy đầu tiên (cả 2 cách)

Server tự chạy migration + seed dữ liệu mặc định (11 giới hạn thông số, 88 màu nhựa Bambu
Lab, 2 font gốc CherryBombOne + NotoEmoji), và **in ra console mật khẩu admin tự sinh** —
chỉ hiện DUY NHẤT 1 lần lúc này:

```
[seed]   username: admin
[seed]   password: <mật khẩu ngẫu nhiên>
```

**Lưu lại mật khẩu này ngay** rồi vào `http://localhost:<PORT>/admin/login.html` đăng nhập
và đổi mật khẩu mới ở mục "Đổi mật khẩu".

Nếu quên mật khẩu, đặt lại qua terminal (không cần biết mật khẩu cũ):

```bash
# chay truc tiep bang Node:
npm run reset-admin-password -- "MatKhauMoiToiThieu8KyTu"
# hoac dang chay bang Docker Compose:
docker compose exec app npm run reset-admin-password -- "MatKhauMoiToiThieu8KyTu"
```

## Biến môi trường

**Dùng Docker Compose** → sửa `.env` ở **thư mục gốc** (`Printer3D/.env`, cạnh
`docker-compose.yml`):

| Biến | Ý nghĩa |
|---|---|
| `APP_PORT` | Cổng truy cập trên máy thật (mặc định 7788) |
| `MYSQL_ROOT_PASSWORD` | Mật khẩu root của container MySQL |
| `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Database/user app dùng để kết nối |
| `SESSION_SECRET` | Bắt buộc — chuỗi ngẫu nhiên ≥32 ký tự |
| `COOKIE_SECURE` | `true` **chỉ khi** đã có nginx/reverse proxy HTTPS thật phía trước — xem cảnh báo bên dưới |
| `ADMIN_PASSWORD` | Tuỳ chọn — đặt sẵn mật khẩu admin lúc seed lần đầu |
| `FONTS_MAX_TOTAL_MB` | Tổng dung lượng tối đa thư mục font (mặc định 200MB) |

**Chạy trực tiếp bằng Node** → sửa `server/.env`, thêm các biến `MYSQL_HOST`/`MYSQL_PORT`
trỏ tới MySQL thật (xem `server/.env.example`).

> **`COOKIE_SECURE`**: để `false` khi còn truy cập qua HTTP thường (kể cả `http://<ip-vps>:PORT`
> chưa gắn domain/TLS). Nếu bật `true` mà chưa thật sự có HTTPS, trình duyệt sẽ không bao
> giờ gửi lại cookie session — hậu quả là đăng nhập báo thành công nhưng dashboard vẫn coi
> như chưa đăng nhập (đây là lỗi từng gặp thực tế khi build, đã sửa bằng cách tách biến này
> khỏi `NODE_ENV`).

## Trang

- Khách hàng: `http://localhost:<PORT>/`
- Đăng nhập quản trị: `http://localhost:<PORT>/admin/login.html`
- Dashboard: `http://localhost:<PORT>/admin/index.html`

## Lưu ý khi triển khai thật (đưa lên internet cho khách dùng)

- Đặt cả stack sau **nginx reverse proxy + HTTPS** (Let's Encrypt/certbot); chỉ expose
  cổng `APP_PORT` ra ngoài qua nginx, không expose thẳng MySQL. Đặt `client_max_body_size`
  ở nginx khớp giới hạn upload font (10MB/file).
- Bật `COOKIE_SECURE=true` **chỉ sau khi** HTTPS đã chạy thật (xem cảnh báo ở trên).
- Đổi `SESSION_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` thành giá trị ngẫu nhiên
  thật, không dùng giá trị mẫu trong `.env.example`.
- Giới hạn min/max thông số chỉ chặn thao tác kéo slider bình thường trên UI (rào chắn kỹ
  thuật/UX), **không phải sandbox chống người cố tình sửa DOM/console** — vì mô hình 3D và
  xuất STL chạy hoàn toàn phía trình duyệt.

## Scripts (khi chạy trực tiếp bằng Node trong `server/`)

```bash
npm start                      # chay server
npm run dev                    # chay voi nodemon (tu restart khi sua code)
npm run seed                   # seed thu cong (idempotent, khong lam sao neu da co du lieu)
npm run reset-admin-password   # dat lai mat khau admin qua terminal
```
