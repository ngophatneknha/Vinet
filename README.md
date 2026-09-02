# ViNews Studio

Ứng dụng cho ViNewsCLIPpings: duyệt raw → gom sự kiện → tạo cặp → hai lượt gán nhãn độc lập → kiểm định → xuất kết quả.

## Vận hành

1. Chủ dự án đăng nhập bằng email cấu hình `OWNER_EMAIL`, được cấp quyền điều phối viên một lần. Thêm email của nhóm ở **Thành viên**. Thao tác này không gửi email mời.
2. **Nhập dữ liệu**: chọn `manifest_import_25000.jsonl.gz` và thư mục `images`. Manifest được đọc từng dòng; bốn ảnh tải đồng thời. Chạy lại bỏ qua bản đã nhập. Không đưa kho ảnh lên Git hoặc thư mục public.
3. Dashboard hiển thị số bài/ảnh thực sự có trong D1/R2. Chỉ bài đủ ảnh trên kho dùng chung mới được giao. Metadata đã nhập không đồng nghĩa ảnh đã tải đủ.
4. Mỗi người **Duyệt raw**: đối chiếu bài gốc, tất cả ảnh, caption, loại ảnh, lý do và kết luận. Lưu nháp trước khi nghỉ. Gửi xong khóa kết quả.
5. 305 mã bài thiếu ảnh từ báo cáo 02/09/2026 được tích hợp phía máy chủ. Không thể duyệt đạt vòng đầu. Điều phối viên nhập manifest phục hồi với **Bổ sung ảnh** để thêm ảnh vào bài chờ/đang kiểm định, không ghi đè nguồn. Người kiểm định khác người duyệt ban đầu xác nhận đủ ảnh và ghi bằng chứng.
6. Nhóm tiền xử lý gom sự kiện theo tài liệu. Điều phối viên gán `event_id` cho bài đã duyệt, tạo đợt pilot và nhập cặp JSONL gồm `article_id`, `image_id`. Không suy nhãn từ cặp cùng bài.
7. Mỗi cặp có hai người khác nhau, giữ kín kết quả trước khi gửi. Sáu câu lấy nguyên văn Guideline V2. Ghi 0/1/2 từng câu, lý do và URL bằng chứng cho nhãn chính.
8. Hai nhãn chính giống nhau được chốt đồng thuận. Mọi bất đồng và nhãn phụ vào hàng đợi kiểm định. Người thứ ba kết luận; hai phiếu ban đầu được giữ nguyên.
9. Điều phối viên có thể tạm dừng đợt, thu hồi bản nháp kèm lý do, khóa thành viên và xuất JSONL raw/cặp/nhật ký.

## Tổ chức nhóm

Gợi ý 6 người: 1 điều phối viên, 3 người gán nhãn và 2 người kiểm định. Mọi vai trò có thể làm lượt độc lập; người kiểm định chỉ xử lý cặp mình chưa gửi nhãn. Pilot 300–500 cặp trước đợt chính. Rà soát ca biên hằng tuần.

Độ khó tạm: tổng sáu điểm 0–12; 0–3 dễ, 4–7 trung bình, 8–12 khó. Tính lại phân vị 33/34/33 sau pilot và cập nhật quy tắc; không xem mốc tạm là ngưỡng đã hiệu chỉnh.

## Giới hạn và sao lưu

- Ứng dụng lưu kiểm duyệt, không tự chứng nhận 25.000 bài đạt QC. Nhóm vẫn phải lấy 50–100 bài/nguồn và đo ngưỡng SOP.
- Chưa tự gom cụm hoặc chia tập. Xuất giữ `split=null`, `test_reviewed=false`. Trước benchmark kiểm tra rò rỉ sự kiện/cụm ảnh và kiểm tra thủ công 100% test.
- Ba nhãn phụ giữ riêng, `benchmark_eligible=false`. Hai nhãn chính đã chốt chỉ đủ điều kiện nhãn, chưa có nghĩa đã đủ điều kiện chia tập.
- Truy cập Internet có hai lớp: quyền Site và danh sách thành viên ứng dụng. Nếu chủ dự án duyệt Site public thì trang đăng nhập được mở; dữ liệu vẫn cần thành viên được cấp quyền.
- Giữ bản gốc trên D. Xuất ba loại JSONL định kỳ. Bản xuất nhãn không thay thế bản sao kho ảnh.
- `IMPORT_TOKEN` tùy chọn chỉ nhập dữ liệu, không đọc ảnh/nhãn và không vượt lớp quyền Sites. Nhập bằng trình duyệt đang đăng nhập không cần token.

## Phát triển và kiểm tra

Node >=22.13, `npm ci`, `npm run db:generate` sau thay đổi schema, `npm run build`. D1 dùng prepared statements; R2 lưu ảnh theo SHA-256; migration nằm trong `drizzle/`. Không tạo schema trong request.

Harness riêng, chỉ ở local port 3001:

```
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc --persist-to .wrangler/test-state
npx wrangler dev --config dist/server/wrangler.json --port 3001 --ip 127.0.0.1 --persist-to .wrangler/test-state --var OWNER_EMAIL:test-owner@example.test
python scripts/test_workflow.py
```

Harness mô phỏng header danh tính của dispatcher, chỉ local. Không mở trực tiếp Worker local lên Internet. Dev server Sites tự loại header giả và dùng tài khoản thử riêng.

Đã kiểm tra HTTP với Worker/D1/R2 local: quyền truy cập, CSRF, SHA ảnh, nhận đồng thời, lưu nháp, phiếu bất biến, hai slot, bất đồng, người thứ ba, xuất nguyên bản và khóa tài khoản. Chưa kiểm tra giao diện bằng trình duyệt. Hai công cụ WebMCP đọc tiến độ/mở hướng dẫn chưa được xác minh ở môi trường hỗ trợ; không có công cụ tự gán nhãn.
