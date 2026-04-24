# Order-to-Stock App V5

Bản V5 bổ sung ràng buộc trạng thái để tránh thất lạc dữ liệu.

## Trạng thái đơn hàng

1. PENDING: Đang đợi xử lý
2. FACTORY_ORDERED: Đã order hàng từ nhà máy
3. FACTORY_RECEIVED: Đã có hàng từ nhà máy
4. DELIVERING: Đang giao hàng
5. COMPLETED: Order đã hoàn thành
6. RETURNED: Order hoàn về
7. CANCELLED: Khách đã hủy order

## Luồng chuyển trạng thái hợp lệ

PENDING -> FACTORY_ORDERED -> FACTORY_RECEIVED -> DELIVERING -> COMPLETED
PENDING -> FACTORY_ORDERED -> FACTORY_RECEIVED -> DELIVERING -> RETURNED
PENDING -> DELIVERING -> COMPLETED
PENDING -> DELIVERING -> RETURNED
PENDING -> CANCELLED
FACTORY_ORDERED -> CANCELLED, chỉ khi chưa nhận hàng từ nhà máy.

Không được quay ngược trạng thái sau khi đã giao hàng.

## Hàng nhà máy

NEED_ORDER -> ORDERED -> RECEIVED
NEED_ORDER -> CANCELLED
ORDERED -> CANCELLED

Nếu đã RECEIVED thì không thể hủy.
Hàng đã nhận từ nhà máy không tính là tồn kho chung, vì đang thuộc đơn hàng cụ thể.
Nếu giao không thành công và chuyển RETURNED, hàng mới cộng vào tồn kho.
