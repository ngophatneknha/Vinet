# Tự tạo và gán nhãn cặp âm khó

Mọi thành viên đang hoạt động có thể dùng **Tự tạo cặp âm khó** trong thanh bên.

1. Điều phối viên mở đợt pilot/chính và gán mã sự kiện đã xác minh cho các bài được duyệt đạt tại **Dữ liệu & sự kiện**.
2. Thành viên chọn bài văn bản, tìm bài nguồn khác và chọn một ảnh được giữ. Đọc toàn văn, caption và mở nguồn để đối chiếu. Hai bài cần khác sự kiện; ảnh đã có trong bài văn bản không dùng làm ảnh thay thế.
3. Chọn chiến lược theo tài liệu 01_Docs: N3 cùng loại sự kiện; N4 trùng thực thể; N5 sai thời gian; N6 sai địa điểm; N7 sai đối tượng. Ghi cả điểm giống và điểm khác, kèm URL bằng chứng.
4. Bấm **Tạo cặp & gán nhãn thủ công**. Ứng dụng lưu nguồn gốc và dành lượt đầu cho người tạo, sau đó mở phiếu V2. Lý do/bằng chứng được mang sang phiếu để chỉnh sửa. Trả lời đủ 6 câu, chấm mức không chắc chắn 0/1/2 và tự chọn nhãn; có thể lưu nháp.
5. Người thứ hai nhận cặp trong **Gán nhãn cặp**, chỉ thấy ảnh/văn bản/nguồn và phiếu của mình. Chiến lược, lý do đề xuất và kết quả của người đầu được giữ kín trong lượt độc lập.
6. Hai nhãn chính đồng thuận mới chốt tự động; bất đồng hoặc nhãn phụ đi vào kiểm định người thứ ba theo quy trình hiện có. Thiếu bằng chứng phải chọn Mơ hồ, không ép Ngoài ngữ cảnh.

“Ứng viên âm khó” mô tả cách xây dựng mẫu, không phải nhãn cuối hay kết luận độ khó. Điểm D_gán_nhãn là tổng 6 mức không chắc chắn; ngưỡng tạm: 0–3 Dễ, 4–7 Trung bình, 8–12 Khó. Hiệu chỉnh theo phân vị sau pilot đúng hướng dẫn V2.

Mục này hiển thị 40 cặp gần nhất do chính bạn tạo, hỗ trợ mở lại phiếu. Điều phối viên xuất toàn bộ bằng **Xuất & nhật ký → Cặp & toàn bộ nhãn**: `construction` lưu người tạo, chiến lược, lý do và URL bằng chứng; `image_source` lưu bài và sự kiện nguồn ảnh. Các cặp nhập theo cách cũ có `construction: null`. Không tự chia train/validation/test.

Tính năng chỉ dùng bài và ảnh trong kho đã được nhóm duyệt. Không tải thêm dữ liệu, tự gán sự kiện, tự tạo đợt hoặc sửa 60 kết quả duyệt raw đã chuyển sang tài khoản mới.

## Triển khai

Migration bổ sung `0002_manual_hard_negatives.sql` tạo bảng `manual_pair_proposals`; không sửa bảng dữ liệu hiện có. Tạo cặp, lưu nguồn gốc, cấp bản nháp và ghi nhật ký nằm trong cùng giao dịch. Cặp trùng/không đủ điều kiện không để lại bản ghi phụ. Migration chạy qua quy trình Netlify hiện tại; không bật lại cơ chế khôi phục dữ liệu.

Kiểm tra tự động: `npm test` bao gồm các điều kiện raw/ảnh/sự kiện/đợt, cặp trùng, hoàn tác giao dịch, giữ kín đề xuất và hai lượt gán nhãn độc lập.
