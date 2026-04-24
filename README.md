# Order-to-Stock Inventory App - Supabase Fixed Version

Ban nay sua dung luong nghiep vu:

1. Tao don hang se tao 1 order duy nhat trong bang `orders`.
2. Tat ca san pham trong don duoc luu thanh cac dong trong bang `order_items`.
3. Neu san pham thieu kho, dong do xuat hien trong tab Kho/NM.
4. Nut `Da order NM` chi doi `order_items.factory_status = ORDERED` de tranh dat trung.
5. Nut `Da nhan hang` chi cong ton kho theo `factory_qty` va doi `factory_status = RECEIVED`.
6. He thong khong tu giao hang sau khi nhan hang. Nguoi dung phai quay lai tab Don hang va bam `Giao hang`.
7. Khi bam `Giao hang`, transaction moi tru ton kho.
8. Neu giao that bai/hoan hang, transaction cong lai ton kho.
9. Upload anh san pham len Supabase Storage bucket `product-images`, khong nhap URL thu cong.

## Cach cai dat

1. Giai nen source.
2. Vao Supabase Dashboard > SQL Editor.
3. Copy toan bo `supabase/setup.sql` va chay.
4. Mo `index.html` bang server tinh, vi du:

```bash
python -m http.server 5500
```

5. Nhap:

```txt
SUPABASE_URL: https://xxxx.supabase.co
SUPABASE_KEY: anon/public key
Storage Bucket: product-images
```

Khong nhap URL co `/rest/v1`.

## Neu da chay ban cu

Nen chay lai `supabase/setup.sql`. File SQL moi se tao bang `order_items`, migrate du lieu cu neu co cot `orders.product_id`, roi xoa cot cu de khong bi tao moi 1 san pham thanh 1 don rieng.

Neu trinh duyet con luu cau hinh cu, mo Console va chay:

```js
localStorage.clear()
```
