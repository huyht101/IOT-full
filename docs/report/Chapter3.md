# Chương 3: Xây dựng hệ thống

## 3.1. Giới thiệu chương

Chương này trình bày quá trình xây dựng hệ thống IoT Dashboard ở mức triển khai thực tế, bám sát phiên bản MVP cuối cùng trong mã nguồn hiện tại. Nội dung chương tập trung vào bốn nhóm thành phần chính: cơ sở dữ liệu MySQL, backend Express, frontend React + Vite và môi trường chạy thử với MQTT broker cùng ESP32.

Khác với phần đặc tả yêu cầu hay mô hình thiết kế mức khái niệm, chương này mô tả hệ thống theo đúng trạng thái triển khai cuối cùng của repository. Vì vậy, các nội dung như cấu trúc bảng dữ liệu, API, cơ chế ingest telemetry, điều khiển thiết bị, auto-refresh lịch sử, cũng như automation chạy phía frontend đều được mô tả theo đúng hành vi đang có trong mã nguồn.

## 3.2. Thiết kế và xây dựng cơ sở dữ liệu

### 3.2.1. Mục tiêu thiết kế dữ liệu

Cơ sở dữ liệu của hệ thống được thiết kế với các mục tiêu chính sau:

- Lưu trữ trạng thái hiện tại của thiết bị và cảm biến để phục vụ Dashboard.
- Lưu trữ lịch sử hành động điều khiển thiết bị để phục vụ Action History.
- Lưu trữ lịch sử telemetry của cảm biến để phục vụ Sensor History và biểu đồ Dashboard.
- Giữ cho mô hình dữ liệu gọn, rõ ràng, phù hợp với phạm vi MVP một bo ESP32.
- Bảo đảm timestamp chuẩn của hệ thống do backend gán, tránh phụ thuộc vào thời gian từ thiết bị.

Trong phiên bản cuối, hệ thống duy trì đúng 6 bảng dữ liệu, không bổ sung bảng phụ cho automation hay đa thiết bị, nhằm giữ kiến trúc đơn giản và phù hợp mục tiêu demo.

### 3.2.2. Lược đồ cơ sở dữ liệu

Tệp khởi tạo cơ sở dữ liệu hiện tại là `SQL/init.sql`. Script này:

- thiết lập `time_zone = '+00:00'`
- xóa và tạo lại cơ sở dữ liệu `iot_demo`
- tạo 6 bảng chính
- seed dữ liệu thiết bị và cảm biến ban đầu
- seed trạng thái thiết bị ban đầu ở trạng thái tắt

Sáu bảng hiện có gồm:

1. `devices`
2. `actions`
3. `sensor_readings`
4. `device_state`
5. `sensor_state`
6. `sensors`

Thiết kế này tách riêng dữ liệu trạng thái hiện tại và dữ liệu lịch sử. Cách tách này giúp Dashboard truy vấn nhanh trên bảng state, trong khi các trang lịch sử và biểu đồ vẫn có thể dùng bảng history.

### 3.2.3. Mô tả các bảng

#### Bảng `devices`

Bảng `devices` lưu thông tin danh mục thiết bị điều khiển. Trong trạng thái hiện tại, dữ liệu seed gồm ba thiết bị:

- `LED1`
- `LED2`
- `LED3`

Các trường quan trọng:

- `device_id`: khóa chính tự tăng
- `device_code`: mã thiết bị duy nhất
- `device_name`: tên hiển thị
- `device_type`: loại thiết bị, hiện tại là `LED`
- `is_active`: cờ kích hoạt
- `created_at`, `updated_at`: thời gian tạo/cập nhật bản ghi

#### Bảng `device_state`

Bảng `device_state` lưu trạng thái hiện tại của từng thiết bị. Đây là bảng phục vụ trực tiếp cho Dashboard vì luôn phản ánh trạng thái gần nhất mà backend biết được.

Các trường quan trọng:

- `device_id`: khóa chính đồng thời là khóa ngoại tới `devices`
- `state`: trạng thái hiện tại, chỉ nhận giá trị `0` hoặc `1`
- `updated_at`: thời điểm backend cập nhật trạng thái
- `last_action_id`: action gần nhất liên quan đến trạng thái hiện tại

Trong MVP, bảng này được cập nhật từ hai nguồn:

- ACK thành công để phản hồi UI nhanh
- telemetry full snapshot để đồng bộ với trạng thái phần cứng thực tế

#### Bảng `actions`

Bảng `actions` lưu lịch sử các hành động điều khiển thiết bị. Mỗi lần gọi API toggle thành công ở mức tạo lệnh, hệ thống sẽ tạo một bản ghi `PENDING`, sau đó cập nhật sang `SUCCESS` hoặc `FAIL` tùy theo kết quả publish/ACK/timeout.

Các trường chính:

- `action_id`: khóa chính tự tăng
- `device_id`: khóa ngoại tới `devices`
- `action`: hành động điều khiển, hiện tại là `on` hoặc `off`
- `status`: trạng thái xử lý gồm `PENDING`, `SUCCESS`, `FAIL`
- `requested_at`: thời điểm backend tạo action
- `acked_at`: thời điểm action được chốt kết quả

Bảng này là nguồn dữ liệu cho Action History và cũng liên kết tới `device_state.last_action_id`.

#### Bảng `sensors`

Bảng `sensors` lưu danh mục cảm biến. Dữ liệu seed hiện tại gồm:

- `TEMP` – Temperature – đơn vị `°C`
- `HUM` – Humidity – đơn vị `%`
- `LIGHT` – Light – đơn vị `raw`

Các trường quan trọng:

- `sensor_id`
- `sensor_code`
- `sensor_type`
- `sensor_name`
- `unit`
- `is_active`

#### Bảng `sensor_readings`

Bảng `sensor_readings` lưu toàn bộ lịch sử giá trị cảm biến theo thời gian. Mỗi lần ingest telemetry hợp lệ, backend sẽ thêm bản ghi mới cho từng sensor hợp lệ trong payload.

Các trường chính:

- `reading_id`: khóa chính tự tăng
- `sensor_id`: khóa ngoại tới `sensors`
- `ts`: thời điểm backend ghi nhận bản ghi
- `value_num`: giá trị số của cảm biến

Bảng này là nguồn dữ liệu chính cho:

- Sensor History
- biểu đồ realtime trên Dashboard

#### Bảng `sensor_state`

Bảng `sensor_state` lưu giá trị hiện tại mới nhất của từng cảm biến, tương tự vai trò của `device_state` đối với thiết bị.

Các trường chính:

- `sensor_id`: khóa chính đồng thời là khóa ngoại tới `sensors`
- `ts`: thời điểm đo gần nhất mà backend chấp nhận
- `value_num`: giá trị hiện tại
- `updated_at`: thời điểm cập nhật state

Script khởi tạo không seed dữ liệu cho bảng này. Bảng chỉ được cập nhật sau lần telemetry hợp lệ đầu tiên.

### 3.2.4. Quan hệ giữa các bảng

Quan hệ giữa các bảng được xây dựng theo hướng đơn giản nhưng đủ dùng cho MVP:

- `actions.device_id` tham chiếu `devices.device_id`
- `device_state.device_id` tham chiếu `devices.device_id`
- `device_state.last_action_id` tham chiếu `actions.action_id`
- `sensor_readings.sensor_id` tham chiếu `sensors.sensor_id`
- `sensor_state.sensor_id` tham chiếu `sensors.sensor_id`

Về mặt logic:

- một thiết bị có nhiều action
- một thiết bị có một bản ghi trạng thái hiện tại
- một cảm biến có nhiều bản ghi lịch sử
- một cảm biến có một bản ghi trạng thái hiện tại

Thiết kế này giúp dễ truy vấn cho cả hai nhu cầu:

- truy vấn nhanh trạng thái hiện tại
- truy vấn lịch sử phân trang và lọc tìm kiếm

### 3.2.5. Chỉ mục, ràng buộc và dữ liệu khởi tạo

Hệ thống hiện tại sử dụng nhiều chỉ mục để hỗ trợ truy vấn trạng thái và lịch sử:

- `devices`: unique index theo `device_code`
- `sensors`: unique index theo `sensor_code`
- `actions`:
  - `idx_actions_device_req`
  - `idx_actions_device_status_req`
  - `idx_actions_status_req`
  - `idx_actions_req`
- `sensor_readings`:
  - `idx_sensor_readings_sensor_ts`
  - `idx_sensor_readings_ts`
- `device_state`:
  - `idx_device_state_last_action`

Các ràng buộc quan trọng:

- khóa ngoại giữa các bảng danh mục và bảng state/history
- `device_state.state` có `CHECK (state IN (0, 1))`
- `device_code` và `sensor_code` là duy nhất

Dữ liệu khởi tạo trong script hiện tại gồm:

- 3 thiết bị: `LED1`, `LED2`, `LED3`
- 3 cảm biến: `TEMP`, `HUM`, `LIGHT`
- 3 bản ghi `device_state` ban đầu ở trạng thái `0`

### 3.2.6. Nguyên tắc timestamp trong hệ thống

Nguyên tắc timestamp là một phần quan trọng của hệ thống:

- Backend là nguồn gán timestamp chuẩn cho cơ sở dữ liệu.
- MySQL được cấu hình làm việc với UTC.
- Node.js backend cũng dùng `TZ=UTC` trong `.env.example`.
- Khi ingest telemetry, backend tạo một `serverNow` dùng chung trong transaction để ghi vào `sensor_readings`, `sensor_state` và `device_state`.
- Khi xử lý toggle, `requested_at` và `acked_at` cũng do backend gán.

Biến `ts_ms` trong payload telemetry chỉ có vai trò:

- hỗ trợ debug
- hỗ trợ phân tích thứ tự bản tin
- hỗ trợ phát hiện reboot nếu cần trong tương lai

`ts_ms` không phải timestamp chuẩn để lưu vào DB.

Một điểm cần lưu ý là frontend hiện hiển thị thời gian theo quy ước cố định UTC+07 để phù hợp bối cảnh demo, trong khi dữ liệu backend vẫn lưu và trả về theo ISO UTC. Vì vậy:

- DB timestamp chuẩn vẫn là UTC
- hiển thị và tìm kiếm thời gian trong History đang bám theo quy ước hiển thị UTC+07 của giao diện

## 3.3. Tài liệu API

### 3.3.1. Tổng quan API

Backend hiện có 5 endpoint chính:

- `GET /api/v1/dashboard`
- `GET /api/v1/dashboard/realtime?since=...`
- `POST /api/v1/devices/:device_id/toggle`
- `GET /api/v1/actions`
- `GET /api/v1/sensor-readings`

Tất cả response đều dùng wrapper thống nhất:

- Thành công: `ok: true`, `data`, `meta` nếu có
- Lỗi: `ok: false`, `error.code`, `error.message`, và có thể kèm `data`

Thiết kế wrapper thống nhất giúp frontend xử lý lỗi đơn giản hơn và cũng thuận lợi cho việc mô tả API trong tài liệu, Postman và OpenAPI.

### 3.3.2. API Dashboard

API Dashboard gồm hai endpoint:

#### `GET /api/v1/dashboard`

Chức năng:

- lấy danh sách thiết bị hiện tại
- lấy trạng thái cảm biến hiện tại
- lấy tập điểm biểu đồ trong cửa sổ 3 giờ gần nhất
- lấy `last_ts` phục vụ polling tiếp theo

Response trả về:

- `devices`
- `sensors`
- `chart_pts`
- `last_ts`

#### `GET /api/v1/dashboard/realtime`

Endpoint này nhận tham số `since` và trả về:

- `devices`
- `sensors`
- `new_pts`
- `new_last_ts`

Frontend dùng endpoint này theo chu kỳ 2 giây để mô phỏng realtime bằng polling. Đây là một đặc điểm quan trọng của hệ thống hiện tại: Dashboard không dùng WebSocket hay SSE.

### 3.3.3. API điều khiển thiết bị

Endpoint điều khiển thiết bị là:

- `POST /api/v1/devices/:device_id/toggle`

Body request có dạng:

```json
{
  "action": "on"
}
```

Hành vi thực tế:

1. Backend kiểm tra `device_id` và `action`.
2. Backend khóa thiết bị trong transaction và kiểm tra `DEVICE_BUSY`.
3. Backend tạo action trạng thái `PENDING`.
4. Backend publish lệnh MQTT tới topic command.
5. Hệ thống chờ ACK hoặc timeout.
6. Nếu ACK success thì action được cập nhật thành `SUCCESS`.
7. Nếu publish lỗi, ACK false hoặc timeout thì action được cập nhật thành `FAIL`.

Các trường hợp lỗi quan trọng:

- `DEVICE_BUSY`
- MQTT publish fail
- ACK trả về `success = false`
- ACK timeout

Late ACK sau khi action đã timeout hoặc thất bại sẽ bị bỏ qua.

### 3.3.4. API Action History

Endpoint:

- `GET /api/v1/actions`

Action History hỗ trợ:

- phân trang bằng `page`, `page_size`
- tìm kiếm tổng quát bằng `q`
- lọc theo `device_type`, `status`, `device_code`, `action`
- lọc khoảng thời gian bằng `from`, `to`
- sắp xếp bằng `sort_by`, `sort_dir`

Hành vi tìm kiếm `q` ở phiên bản cuối:

- tìm theo thời gian hiển thị của `requested_at` theo định dạng `YYYY-MM-DD HH:mm:ss` ở UTC+07
- tìm theo `device_code`
- tìm theo `device_name`
- nếu `q` là số, tìm thêm theo `action_id` và `device_id`

Điều này cho phép người dùng nhập các chuỗi như:

- `2026-03-29`
- `2026-03-29 19:30`
- `2026-03-29T19:30`
- `LED1`
- `12`

Mặc định, Action History sắp xếp theo `requested_at desc`.

Ngoài ra, Action History trên frontend còn tự làm mới mỗi 5 giây khi trang đang mở, nhưng đây là logic frontend chứ không làm thay đổi hợp đồng API.

### 3.3.5. API Sensor History

Endpoint:

- `GET /api/v1/sensor-readings`

Sensor History hỗ trợ:

- phân trang
- tìm kiếm tổng quát bằng `q`
- lọc theo `sensor_type`, `sensor_code`
- lọc theo khoảng thời gian `from`, `to`
- sắp xếp bằng `sort_by`, `sort_dir`

Điểm đáng chú ý của phiên bản cuối là `q` có thể tìm trên tất cả các trường hiển thị của bảng:

- `reading_id`
- `sensor_code`
- `sensor_name`
- `sensor_type`
- `value_num`
- chuỗi thời gian hiển thị `ts` theo định dạng `YYYY-MM-DD HH:mm:ss` ở UTC+07

Ví dụ các chuỗi tìm kiếm hợp lệ:

- `15`
- `TEMP`
- `temperature`
- `28.4`
- `1830`
- `2026-03-29`
- `2026-03-29 19:30`

Khác với phiên bản cũ, thứ tự mặc định của Sensor History hiện là:

- `reading_id desc`

Frontend cũng tự làm mới trang Sensor History sau mỗi 5 giây trong khi người dùng đang ở trang này.

### 3.3.6. Công cụ kiểm thử API

Repository hiện đã có đầy đủ các artifact phục vụ kiểm thử và tài liệu hóa API:

- Postman collection: `docs/postman/IOT_MVP.postman_collection.json`
- Postman environment: `docs/postman/IOT_Local.postman_environment.json`
- API markdown: `docs/api/API.md`
- OpenAPI nhẹ: `docs/api/openapi.yaml`

Các artifact này có vai trò:

- hỗ trợ kiểm thử thủ công
- hỗ trợ demo
- làm tài liệu tham khảo cho báo cáo
- giúp đồng bộ mô tả API với code hiện tại

## 3.4. Xây dựng Backend

### 3.4.1. Công nghệ và cấu trúc backend

Backend được xây dựng bằng Node.js theo kiểu CommonJS, sử dụng Express làm web framework.

Các công nghệ và thư viện chính:

- `express`
- `mysql2/promise`
- `mqtt`
- `dotenv`
- `cors`
- `morgan`
- `nodemon`

Cấu trúc backend hiện tại gồm các nhóm thư mục chính:

- `config`: cấu hình DB và MQTT
- `routes`: định nghĩa endpoint
- `controllers`: xử lý request/response
- `services`: nghiệp vụ chính
- `repositories`: truy vấn DB
- `utils`: validation, time, api response
- `middleware`: xử lý route not found và error handler

Kiến trúc này đơn giản nhưng rõ ràng, đủ cho MVP và dễ bảo trì khi cần mở rộng thêm logic.

### 3.4.2. Luồng ingest telemetry

Luồng ingest telemetry hiện tại hoạt động như sau:

1. MQTT subscriber lắng nghe topic telemetry.
2. Khi có message, hệ thống parse JSON an toàn.
3. Backend kiểm tra payload có phải object hợp lệ hay không.
4. `ts_ms` được kiểm tra là số hữu hạn.
5. `temp`, `hum`, `light` được chuẩn hóa theo logic hiện tại.
6. `devices[]` phải là mảng và phải chứa full snapshot của toàn bộ thiết bị đang active.
7. Backend tải danh sách active devices và active sensors từ DB.
8. Backend xác thực không thiếu thiết bị, không trùng code, không có state ngoài `0` hoặc `1`.
9. Backend mở transaction và tạo `serverNow`.
10. Với từng cảm biến hợp lệ:
    - insert vào `sensor_readings`
    - upsert vào `sensor_state`
11. Với từng thiết bị trong snapshot:
    - cập nhật `device_state`

Một số quy tắc đáng chú ý:

- `temp` có thể `null`
- `hum` có thể `null`
- `light` bắt buộc phải là số
- telemetry luôn là full snapshot cho `devices[]`

Nếu payload telemetry sai định dạng, backend sẽ log cảnh báo và bỏ qua bản tin thay vì làm crash tiến trình.

### 3.4.3. Luồng điều khiển thiết bị và ACK

Luồng toggle thiết bị là phần quan trọng nhất của backend.

Trình tự xử lý:

1. Controller kiểm tra `device_id` và request body.
2. Service tạo transaction để:
   - khóa thiết bị
   - kiểm tra có action pending hay không
   - tạo action mới ở trạng thái `PENDING`
3. Backend đăng ký action vào `pendingAckMap` trong bộ nhớ.
4. Backend publish bản tin MQTT command.
5. Hệ thống chờ kết quả ACK hoặc timeout.

Khi có ACK:

- nếu `success = true`, backend cập nhật action sang `SUCCESS` và cập nhật `device_state`
- nếu `success = false`, backend cập nhật action sang `FAIL`

Nếu không có ACK trong thời gian `ACK_TIMEOUT_MS`, action bị đánh dấu `FAIL`.

Một điểm cải tiến quan trọng trong mã nguồn hiện tại là quá trình chốt ACK đã được làm an toàn hơn:

- tránh xóa pending entry quá sớm
- hạn chế trường hợp DB còn `PENDING` nhưng bộ nhớ lại không còn entry theo dõi
- late ACK sau khi action đã thất bại hoặc timeout sẽ bị bỏ qua

### 3.4.4. Xử lý truy vấn lịch sử

Hai luồng truy vấn lịch sử được tách riêng:

- Action History
- Sensor History

Mỗi luồng đều gồm:

- parse query trong `validation.js`
- service gọi song song `count` và `list`
- repository build điều kiện `WHERE`, `ORDER BY`, `LIMIT`, `OFFSET`

Điểm đáng chú ý:

- `sort_by` dùng whitelist, không cho phép chèn trực tiếp tên cột tùy ý
- `sort_dir` chỉ cho phép `asc` hoặc `desc`
- `page_size` bị chặn tối đa `100`

Trong phiên bản cuối, hai repository history dùng `pool.query(...)` cho list query có `LIMIT ? OFFSET ?`, vì đường đi prepared statement `execute(...)` đã gây lỗi runtime với MySQL hiện tại.

Ngoài ra, tìm kiếm theo thời gian ở hai trang history đã được căn chỉnh với thời gian hiển thị trên frontend bằng quy ước UTC+07, giúp người dùng có thể copy thời gian đang thấy trên UI để tìm kiếm.

### 3.4.5. Xử lý lỗi và validation

Backend hiện có cơ chế xử lý lỗi tập trung thông qua:

- `AppError`
- `errorHandler`
- `notFound`

Các lỗi phổ biến:

- `VALIDATION_ERROR`
- `INVALID_JSON`
- `NOT_FOUND`
- `DEVICE_NOT_FOUND`
- `DEVICE_BUSY`
- `ACTION_FAILED`
- `INTERNAL_ERROR`

Validation hiện tại bao gồm:

- body toggle chỉ chấp nhận `action = on | off`
- `device_id` phải là số nguyên dương
- `since` của realtime không được ở tương lai
- `from` phải nhỏ hơn hoặc bằng `to`
- `sort_by` phải thuộc whitelist của từng endpoint
- `q` có giới hạn độ dài

Thiết kế này giúp frontend nhận được thông báo lỗi có cấu trúc rõ ràng, đồng thời tránh để lỗi validation rơi xuống mức SQL hoặc runtime bất ngờ.

## 3.5. Xây dựng Frontend

### 3.5.1. Công nghệ và cấu trúc frontend

Frontend được xây dựng bằng React 18 với Vite.

Các thư viện chính:

- `react`
- `react-router-dom`
- `recharts`
- `lucide-react`

Giao diện dùng CSS Modules để cô lập style theo component.

Cấu trúc frontend hiện tại tập trung vào các nhóm:

- `pages`
- `components`
- `api`
- `context`
- `automation`
- `utils`
- `constants`

Một điểm quan trọng trong kiến trúc frontend là `DashboardRuntimeProvider` ở cấp ứng dụng. Provider này giúp:

- tải Dashboard lần đầu
- polling realtime toàn cục
- chạy automation FE-only toàn cục
- chia sẻ trạng thái dashboard cho trang Dashboard

### 3.5.2. Dashboard

Dashboard là trang chính của hệ thống, gồm ba khu vực lớn:

- các thẻ sensor metric
- khối điều khiển thiết bị và chọn rule automation
- khối biểu đồ môi trường realtime

Đặc điểm của Dashboard ở phiên bản cuối:

- sử dụng dữ liệu thật từ backend
- polling `GET /api/v1/dashboard/realtime` mỗi 2 giây
- biểu đồ hiển thị cả temperature, humidity và light
- thiết bị có thể điều khiển thủ công bằng nút toggle
- màu sắc thẻ cảm biến thay đổi theo giá trị cảm biến

Ngoài ra, dashboard còn là nơi người dùng chọn rule automation cho từng thiết bị. Tuy nhiên, việc chạy automation không còn phụ thuộc vào việc trang Dashboard có đang mở hay không.

### 3.5.3. Action History

Action History hiển thị bảng lịch sử điều khiển thiết bị với các chức năng:

- tìm kiếm bằng `q`
- lọc theo thiết bị
- lọc theo action
- lọc theo status
- phân trang server-side
- auto-refresh mỗi 5 giây khi trang mở

Tìm kiếm hiện tại hỗ trợ:

- thời gian hiển thị của `requested_at`
- `device_code`
- `device_name`
- `action_id`
- `device_id`

Việc auto-refresh giúp trang Action History tự hiển thị thêm action mới khi automation toàn cục hoặc thao tác thủ công tạo ra action trong lúc người dùng đang ở trang này.

### 3.5.4. Sensor History

Sensor History hiển thị bảng lịch sử cảm biến với các chức năng:

- tìm kiếm tổng quát bằng `q`
- sắp xếp tăng/giảm theo `reading_id`
- phân trang server-side
- auto-refresh mỗi 5 giây khi trang mở

Điểm nổi bật của phiên bản cuối là ô tìm kiếm có thể tìm theo toàn bộ các trường đang hiển thị:

- ID
- Sensor
- Type
- Value
- Time

Việc hỗ trợ tìm theo thời gian hiển thị giúp trải nghiệm thực tế tốt hơn, vì người dùng có thể dùng chính timestamp nhìn thấy trên giao diện để lọc dữ liệu.

### 3.5.5. Profile

Trang Profile trong hệ thống hiện tại là trang tĩnh phục vụ demo giao diện. Trang này không gọi backend API, nhưng đóng vai trò:

- hoàn thiện cấu trúc một dashboard admin
- cung cấp khu vực tài nguyên như PDF report, API docs, GitHub và Figma
- hỗ trợ trình bày trong demo hoặc báo cáo

### 3.5.6. Cơ chế automation FE-only

Automation ở phiên bản MVP cuối cùng được triển khai hoàn toàn ở frontend.

Các đặc điểm chính:

- rule được lưu trong `localStorage`
- rule áp dụng theo từng thiết bị
- mọi thiết bị đều có thể chọn `None`, `Rule 1`, `Rule 2`, `Rule 3`
- runner automation chạy toàn cục ở cấp ứng dụng
- automation vẫn hoạt động khi người dùng rời Dashboard và chuyển sang Action History, Sensor History hoặc Profile

Ba rule hiện tại:

- Rule 1: nếu `temp > 30` thì bật, ngược lại tắt
- Rule 2: nếu `light < 1000` thì bật, ngược lại tắt
- Rule 3: nếu `hum > 80` thì tắt, ngược lại bật

Để tránh spam toggle:

- frontend kiểm tra trạng thái thiết bị hiện tại
- kiểm tra thiết bị đang có request pending hay không
- ghi nhớ desired state đã thử gần nhất

Hạn chế quan trọng:

- automation chỉ chạy khi SPA đang mở
- đóng trình duyệt hoặc tab thì automation dừng
- backend chưa lưu hay quản lý rule automation

## 3.6. Môi trường triển khai và chạy thử

### 3.6.1. Backend

Backend chạy bằng Node.js với các script hiện tại:

- `npm run dev`
- `npm start`
- `npm run check`

Các cấu hình runtime backend được lấy từ `.env`, trong đó các biến quan trọng là:

- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `MQTT_URL`
- `MQTT_TOPIC_TELEMETRY`
- `MQTT_TOPIC_CMD`
- `MQTT_TOPIC_ACK`
- `ACK_TIMEOUT_MS`
- `TZ`

### 3.6.2. Frontend

Frontend chạy trong thư mục `frontend` với các script:

- `npm run dev`
- `npm run build`
- `npm run preview`

Biến môi trường chính:

- `VITE_API_BASE_URL`

Mặc định frontend sẽ gọi backend tại:

- `http://127.0.0.1:4000`

### 3.6.3. Broker MQTT

MQTT broker được dùng để kết nối ESP32 và backend. Cấu hình mặc định hiện tại là:

- `mqtt://127.0.0.1:1884`

Ba topic chính:

- telemetry: `iot/demo/esp32_01/telemetry`
- command: `iot/demo/esp32_01/cmd`
- ack: `iot/demo/esp32_01/ack`

Backend sẽ:

- subscribe telemetry
- subscribe ack
- publish command

### 3.6.4. Database

Database sử dụng MySQL 8.x. Toàn bộ schema và dữ liệu khởi tạo nằm trong:

- `SQL/init.sql`

Lệnh khởi tạo thường dùng:

```powershell
Get-Content .\SQL\init.sql | mysql -u root -p
```

Đây là bước bắt buộc trước khi chạy backend lần đầu trên máy mới.

### 3.6.5. ESP32

ESP32 trong MVP có vai trò:

- gửi telemetry chu kỳ
- nhận command từ backend
- phản hồi ACK cho action điều khiển

Payload telemetry hiện tại được thiết kế theo dạng snapshot đầy đủ thiết bị. Điều này giúp backend đồng bộ lại trạng thái phần cứng thật từ telemetry, thay vì chỉ dựa vào ACK.

## 3.7. Tiểu kết chương

Chương 3 đã trình bày quá trình xây dựng hệ thống IoT Dashboard theo đúng trạng thái triển khai cuối cùng của repository. Hệ thống hiện có cơ sở dữ liệu gọn với 6 bảng, backend Express xử lý telemetry, toggle và truy vấn lịch sử, cùng frontend React + Vite cung cấp Dashboard, Action History, Sensor History, Profile và cơ chế automation FE-only.

Điểm nổi bật của phiên bản hiện tại là:

- Dashboard cập nhật bằng polling
- telemetry được ingest theo full snapshot
- điều khiển thiết bị có cơ chế ACK và timeout rõ ràng
- Action History và Sensor History đều hỗ trợ auto-refresh
- tìm kiếm lịch sử đã được căn chỉnh với dữ liệu hiển thị thực tế trên giao diện

Những nền tảng này tạo ra một MVP hoàn chỉnh, đủ để phục vụ demo, kiểm thử tích hợp, và làm cơ sở cho các bước phát triển tiếp theo ở các chương sau.
