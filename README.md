# Vinet · ViNews Studio

Ứng dụng kiểm duyệt dữ liệu và gán nhãn ảnh–văn bản cho nhóm ViNewsCLIPpings. Chạy trên **Next.js + Netlify**, lưu mã nguồn ở GitHub.

## Dự án đang sử dụng

- Website: https://vinet-studio.netlify.app
- Mã nguồn: https://github.com/ngophatneknha/Vinet
- Quản lý deploy: https://app.netlify.com/projects/vinet-studio/deploys
- Nhánh phát hành: `main`. Netlify đã liên kết repository; không cần tạo lại project.

Sửa file trên GitHub, chọn **Commit changes** vào `main`, rồi xem tiến trình tại trang deploy. Chỉ bản build thành công mới thay website đang chạy. Bộ raw được nhập riêng sau khi đăng nhập quản trị; không nằm trong GitHub.

## Cấu hình khi dựng lại dự án

1. Trong Netlify, chọn **Add new project → Import an existing project → GitHub → ngophatneknha/Vinet**.
2. Chọn nhánh **main**, thư mục gốc để trống. `netlify.toml` đã khai báo lệnh build `npm run build:netlify` và thư mục xuất `.next`.
3. Bật **Netlify Database** cho dự án, bật **Identity**, đặt biến môi trường `OWNER_EMAIL` bằng email của điều phối viên. Database được Netlify cung cấp riêng; không dán connection string vào mã nguồn.
4. Trong Identity, giữ xác nhận email, bật Google/GitHub nếu muốn. Người đăng ký mới chưa được xem dữ liệu cho đến khi điều phối viên thêm đúng email vào danh sách thành viên.
5. Chạy deploy. Nếu lần build đầu chưa có Database, bật Database rồi chọn Retry deploy. Migration được áp dụng trước khi phát hành mã và không tự xóa dữ liệu.
6. Đăng nhập bằng email `OWNER_EMAIL`: hệ thống cấp quyền điều phối viên lần đầu. Thêm thành viên, nhập dữ liệu và mở đợt pilot.

Sau khi liên kết repository, sửa file bằng nút bút chì trên GitHub hoặc nhấn `.` để mở github.dev, rồi **Commit changes** vào `main`. Netlify tự build và phát hành thay đổi. GitHub Actions chạy kiểm tra mã và nghiệp vụ trên mỗi push/PR. Với thay đổi lớn, dùng branch + Pull Request để xem Deploy Preview trước khi merge.

**Chạy ứng dụng trong GitHub:** dùng **Code → Codespaces → Create codespace**, rồi `npm run dev`. github.dev là trình chỉnh sửa, không phải máy chủ chạy ứng dụng. Các chức năng dữ liệu/đăng nhập cần Netlify Dev hoặc cấu hình dịch vụ tương ứng; không có tài khoản hay dữ liệu giả được tự cấp quyền khi chạy local.

## Dữ liệu và tài khoản

- GitHub lưu mã nguồn và cấu hình, không chứa 25.000 bài raw, khoảng 24 GB ảnh, khóa API hoặc mật khẩu.
- Netlify Database (PostgreSQL) lưu bài báo, quyết định, phân công, phiếu gán nhãn và nhật ký.
- Netlify Blobs lưu ảnh trong store riêng `vinews-images`; không đặt ảnh vào `public/`. API kiểm tra thành viên trước khi đọc.
- Netlify Identity xác thực người dùng; quyền ứng dụng được kiểm tra lại từ database ở mỗi yêu cầu. Header nhận diện của Sites/ChatGPT không còn được tin cậy.
- Dữ liệu trên Sites cũ không tự chuyển sang Netlify. Nhập bộ raw qua mục **Nhập dữ liệu** sau khi cấu hình dịch vụ. Nếu đã có phiếu gán nhãn trên Sites cũ, cần xuất và chuyển các phiếu riêng trước khi sử dụng chính thức.

### Nhập raw

Chọn `manifest_import_25000.jsonl.gz` đã kèm cờ kiểm tra và thư mục `images` từ máy đang giữ bộ dữ liệu. Nếu dùng manifest gốc, chọn thêm danh sách bài thiếu kho ảnh. Chỉ bài có đủ ảnh trên kho mới được giao duyệt.

Mỗi ảnh được chia thành phần tối đa **4 MB** để phù hợp giới hạn upload của Netlify Functions. Máy chủ ghép lại, kiểm tra định dạng và SHA-256, rồi mới ghi trạng thái sẵn sàng. Giới hạn ảnh 20 MB phù hợp bộ raw hiện tại (ảnh lớn nhất khoảng 19,9 MB). Nếu gián đoạn, chọn lại tệp và tiếp tục; bài và ảnh đã hoàn tất được bỏ qua. Giữ tab mở khi nhập/xuất dữ liệu.

Với bộ raw lớn trên máy quản trị, `scripts/import-local.mjs` hỗ trợ nhập tiếp qua chính API production. Script kiểm tra đủ 25.000 bài, 64.686 bản ghi ảnh và 61.456 tệp, bỏ qua phần đã nhập, tải ảnh theo từng phần khi cần và đối soát kho Blobs khi kết thúc. Cần cung cấp `VINEWS_IMPORT_TOKEN`, `NETLIFY_AUTH_TOKEN` và `DATABASE_URL` qua biến môi trường; kết nối database chỉ dùng để đọc và đối soát. Không lưu các khóa vào GitHub. Thu hồi khóa nhập sau khi tải xong.

305 bài đang thiếu kho ảnh bị chặn duyệt đạt ở vòng đầu. Điều phối viên có thể nhập bổ sung ảnh vào bài chưa giao/đang kiểm định. Người kiểm định phải đối chiếu đầy đủ, kiểm tra số ảnh còn thiếu và ghi bằng chứng trước khi duyệt đạt.

### Quy trình nhóm

1. Duyệt bài và từng ảnh: giữ/loại/cần kiểm tra, loại ảnh, caption và lý do.
2. Nhóm tiền xử lý xác minh sự kiện; điều phối viên gán `event_id` cho bài đã duyệt.
3. Tạo đợt pilot 300–500 cặp, nhập JSONL `{ "article_id": "…", "image_id": "…" }` từ các bài/ảnh đã duyệt.
4. Hai người khác nhau gán nhãn độc lập, trả lời sáu câu theo Guideline V2, chấm 0/1/2 và ghi URL bằng chứng.
5. Hai nhãn chính giống nhau được chốt đồng thuận. Bất đồng và nhãn phụ chuyển người thứ ba kiểm định. Giữ nguyên hai phiếu ban đầu.
6. Xuất raw, cặp/nhãn và nhật ký theo từng trang để tránh giới hạn thời gian/dung lượng của Functions. Mốc độ khó 0–3/4–7/8–12 là tạm, cần hiệu chỉnh sau pilot.

Gợi ý 6 người: 1 điều phối viên, 3 người gán nhãn và 2 người kiểm định. Thu hồi bản nháp khi cần phân công lại; phiếu đã gửi không ghi đè.

**Chưa phải benchmark đã chứng nhận:** vẫn cần QC 50–100 bài/nguồn theo SOP, kiểm tra rò rỉ sự kiện/cụm ảnh giữa train/val/test và kiểm tra thủ công 100% test. File xuất giữ `split=null`, `test_reviewed=false`. Chỉ hai nhãn chính được đánh dấu đủ điều kiện nhãn; ba nhãn phụ lưu riêng.

## Phát triển

Node 22 trở lên:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

`npm test` chạy PostgreSQL bằng PGlite trong bộ nhớ: migration, khóa nhiệm vụ, ràng buộc hai người, rollback, chuyển bất đồng, bất biến phiếu; thêm kiểm tra câu hỏi, bằng chứng và toàn vẹn ảnh lớn. Không chạy test vào database production.

Khi đổi schema: sửa `db/schema.ts`, chạy `npm run db:generate`, kiểm tra SQL mới trong `db/migrations/` rồi commit. Không sửa migration đã chạy. Netlify build gọi `scripts/migrate.mjs`, dùng transaction và khóa để ngăn hai deploy áp dụng migration đồng thời.

Để chạy đầy đủ dịch vụ local, dùng Netlify CLI với dự án đã liên kết (`netlify dev`) hoặc cấu hình PostgreSQL phát triển riêng. Không đưa dữ liệu production vào Deploy Preview công khai. Kiểm tra chính sách nhánh database/Identity trước khi mời người ngoài.

## Các file thường chỉnh

| Nhu cầu | File |
|---|---|
| Giao diện trang làm việc | `app/studio/studio.tsx` |
| Màu, bố cục, responsive | `app/globals.css` |
| Đăng nhập | `app/login/page.tsx` |
| Sáu câu, nhãn, độ khó | `lib/rules.ts` |
| Quyền và xử lý nhiệm vụ | `app/api/work/route.ts`, `lib/server.ts` |
| Schema database | `db/schema.ts` |
| Cấu hình triển khai | `netlify.toml` |

## Sao lưu và vận hành

Giữ nguyên bộ raw trên ổ D. Xuất cả ba loại JSONL định kỳ, giữ bản sao ảnh riêng và dùng snapshot database khi cần. Chốt/tạm dừng đợt trong lúc xuất bản dữ liệu nghiên cứu để tránh thay đổi nhãn giữa các trang xuất. Kiểm tra hạn mức lưu trữ/băng thông Netlify cho khoảng 24 GB ảnh trước khi tải toàn bộ; mã nguồn không cam kết dung lượng này miễn phí.

Tài liệu nền tảng: [Next.js trên Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Database](https://docs.netlify.com/build/data-and-storage/netlify-database/api/), [Identity](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/), [Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).
