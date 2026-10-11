# Ms Trâm English Hub · Ôn Từ Vựng THPTQG & ĐGNL

Ứng dụng web ôn tập từ vựng tiếng Anh chuyên đề phục vụ học sinh luyện thi THPTQG và ĐGNL, thiết kế riêng cho **Ms Trâm English Hub**. Hoạt động hoàn hảo trên cả **điện thoại** lẫn **máy tính** mà không cần cài đặt bất kỳ phần mềm nào.

---

## 👩‍🏫 HƯỚNG DẪN DÀNH CHO CÔ TRÂM (Đọc là làm được ngay)

### 1. Cách lấy link gửi học sinh cả lớp vào học (Quan trọng nhất)
Sau khi đưa dự án lên GitHub, cô làm theo các bước sau để lấy link gửi cho học sinh:

1. Vào trang GitHub của dự án > bấm mục **Settings** (ở thanh menu trên cùng).
2. Nhìn sang cột bên trái, bấm vào mục **Pages**.
3. Cô sẽ thấy ngay một khung thông báo có đường link của trang web:  
   👉 **`https://<tên-tài-khoản>.github.io/thptqg-tuvung-career/`**
4. Cô nhấn nút **Copy** (sao chép link) rồi gửi vào nhóm Zalo hoặc Facebook của lớp.
5. **Học sinh chỉ cần nhấp vào link là học được ngay** trên cả điện thoại (iPhone, Android) lẫn máy tính (Laptop, PC) mà không cần đăng nhập hay cài đặt gì!

*(Mẹo: Khi dạy học trên lớp nếu máy tính không có mạng, cô vẫn có thể nhấp đúp trực tiếp vào file `index.html` trong máy tính để mở trang web dạy học hoàn toàn offline).*

---

### 2. Cách tạo và thêm một chuyên đề từ vựng mới (Chỉ 4 bước đơn giản)

Cô không cần biết viết code, chỉ cần làm theo các bước sau:

* **Bước 1: Soạn bảng từ vựng trên Excel hoặc Google Sheets**
  * Gồm các cột: `Từ vựng | Phiên âm | Từ loại | Nghĩa tiếng Việt | Bài số | Câu ví dụ | Dạng từ đúng | Đồng nghĩa | Trái nghĩa`.
  * *(Thứ tự cột thế nào cũng được, hệ thống sẽ tự nhận diện thông minh).*

* **Bước 2: Mở công cụ nhập liệu**
  * Nhấp đúp mở file `studio.html` trên máy tính (hoặc bấm chữ **"Teacher Studio"** ở chân trang web).

* **Bước 3: Dán bảng và tạo dữ liệu**
  * Quét chọn bảng trên Excel, nhấn `Ctrl + C` (Sao chép).
  * Sang trang `studio.html`, nhấn `Ctrl + V` (Dán) vào ô nhập rồi bấm **"Kiểm tra & Tạo dữ liệu"**.
  * Điền tên chuyên đề (ví dụ: *Environment & Green Energy*).

* **Bước 4: Lưu file và cập nhật vào web**
  * Bấm nút **"💾 Tải về file .js"** và lưu vào thư mục: `data/topics/` (ví dụ: `environment.js`).
  * Mở file `index.html` bằng Notepad, kéo xuống dòng cuối cùng và thêm 1 dòng nạp file:
    ```html
    <script src="data/topics/environment.js"></script>
    ```
  * Nhấn `Ctrl + S` để lưu `index.html`. Đẩy lên GitHub (hoặc nhờ người hỗ trợ đẩy lên) là **đường link của cả lớp tự động cập nhật chuyên đề mới** ngay lập tức!

---

### 3. Tóm tắt các tính năng học tập cho học sinh (Trên cả PC & Điện thoại)

* 📇 **Thẻ ghi nhớ (Flashcards):** Lật thẻ xem nghĩa, phát âm chuẩn bản xứ. Có nút **`▶ Tự động`** để thẻ tự đọc và tự lật rảnh tay.
* ❓ **Trắc nghiệm 4 lựa chọn (Quiz):** 10 câu hỏi ngẫu nhiên bám sát đề thi. Trên máy tính hỗ trợ bấm phím `1, 2, 3, 4` hoặc `A, B, C, D` để chọn nhanh.
* ✏️ **Điền từ vào câu (Gap-fill):** Luyện ngữ cảnh bài đọc thực tế với câu trích dẫn chuẩn đề thi.
* ⌨️ **Luyện gõ từ (Chính tả):** Nghe phát âm, xem nghĩa tiếng Việt rồi gõ từ vào ô để khắc phục lỗi sai chính tả trong bài thi.
* ⚡ **Ghép từ phản xạ (Mini-game):** Nối nhanh 5 từ tiếng Anh với 5 nghĩa tiếng Việt có đồng hồ bấm giờ tính giây kích thích phản xạ.
* 📋 **Danh sách từ & In ấn:** Xem toàn bộ từ vựng; có nút **`🖨️ In / Lưu PDF`** tự động dàn trang 2 cột A4 chuẩn đẹp để cô in ra giấy phát cho cả lớp.
* ⭐ **Từ vựng gắn sao:** Bấm ngôi sao trên từ để lưu lại các từ khó nhớ và chỉ ôn riêng nhóm từ này.
* 📱 **Tối ưu Mobile:** Trên điện thoại, thanh menu học tập nằm cố định ở đáy màn hình, học sinh bấm bằng 1 ngón tay cái cực kỳ tiện như ứng dụng di động.
* 📸 **Báo cáo kết quả gửi Zalo:** Làm xong bài có nút tự sao chép kết quả (điểm số, thời gian, từ làm sai) để học sinh dán gửi thẳng vào Zalo cô Trâm.
* 📞 **Hotline & Zalo:** Nhấp vào số điện thoại trên web là hệ thống tự copy số để dán vào Zalo tiện lợi.

---

## 📁 Cấu trúc thư mục dự án

```text
thptqg-tuvung-career/
├── index.html          # Trang học tập chính dành cho học sinh
├── studio.html         # Công cụ nhập từ vựng từ Excel dành cho cô giáo
├── 404.html            # Trang điều hướng dự phòng cho GitHub Pages
├── .nojekyll           # File cấu hình giúp GitHub Pages chạy mượt mà 100%
├── README.md           # Hướng dẫn chi tiết cho cô giáo và học sinh
├── AGENTS.md           # Hướng dẫn kỹ thuật kiến trúc cho các AI Agent
├── assets/
│   └── logo.svg        # Logo thương hiệu Ms Trâm English Hub
├── css/
│   ├── style.css       # Giao diện trang học sinh (Dark/Light mode, Mobile bottom bar)
│   └── studio.css      # Giao diện công cụ nhập liệu cho cô giáo
├── data/
│   └── topics/         # Thư mục chứa các bộ từ vựng (career.js, environment.js)
│       ├── career.js
│       ├── career.md
│       ├── environment.js
│       └── environment.md
└── js/
    ├── parser.js       # Bộ giải mã bảng Markdown thông minh
    ├── data.js         # Bộ quản lý nạp đa chuyên đề
    ├── app.js          # Logic học tập (6 chế độ, âm thanh, sao chép, bản đồ)
    └── studio.js       # Logic nhận diện bảng Excel tự động
```

---

## 📍 Thông tin trung tâm & 2 Cơ sở học

* **Cơ sở 1:** 12 Lê Đình Chinh – Quy Nhơn Nam, Gia Lai
* **Cơ sở 2:** 32 Chu Văn An – Quy Nhơn, Gia Lai
* **Hotline tư vấn:** 0898 123 696
* **Zalo cô Trâm:** 0792 951 529
* **Fanpage Facebook:** [Ms Trâm English Class](https://www.facebook.com/mstramengclass)
