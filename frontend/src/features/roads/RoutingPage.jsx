import { Button } from '../../components/ui/Button.jsx'
import { TextField, ChoiceGroup } from '../../components/ui/Field.jsx'
import { Notice, EmptyState, PageHeader, Card } from '../../components/ui/Feedback.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { APP_CONFIG } from '../../app/config.js'
import '../../styles/pages.css'

/**
 * Tìm đường mở rộng (mục 10). Chỉ bật khi có dịch vụ tính tuyến và dữ liệu ngập phù hợp.
 * Hiển thị được nền bản đồ không đồng nghĩa tính được tuyến tránh ngập.
 */
export default function RoutingPage() {
  if (APP_CONFIG.routingEnabled) {
    // Phần này chỉ chạy khi nhóm đã nối dịch vụ tính tuyến thật.
    return null
  }
  return (
    <div className="page page--narrow">
      <PageHeader
        title="Tìm đường"
        description="Tính tuyến tránh các đoạn đang ngập."
        back={<Button variant="ghost" icon="chevron-left" to="/duong-bi-anh-huong">Đường bị ảnh hưởng</Button>}
      />

      <Notice tone="info" title="Chức năng chưa được bật">
        Dịch vụ tính tuyến chưa sẵn sàng trong bản này, nên nút Tìm tuyến không hoạt động và không đưa ra tuyến đường giả.
      </Notice>

      <Card className="disabled-form" aria-disabled="true">
        <div className="card__head">
          <h2 className="card__title">Biểu mẫu dự kiến</h2>
          <span className="badge badge--neutral badge--sm">Chưa bật</span>
        </div>
        <div className="disabled-form__fields">
          <TextField label="Điểm đi" placeholder="Chọn trên bản đồ hoặc nhập địa điểm" disabled />
          <div className="row">
            <Button variant="ghost" icon="swap" disabled aria-label="Đổi chiều điểm đi và điểm đến" />
          </div>
          <TextField label="Điểm đến" placeholder="Chọn trên bản đồ hoặc nhập địa điểm" disabled />
          <ChoiceGroup
            legend="Phương tiện"
            value="car"
            onChange={() => {}}
            disabled
            options={[
              { value: 'bike', label: 'Xe máy', icon: 'bike' },
              { value: 'car', label: 'Ô tô', icon: 'car' }
            ]}
            columns={2}
          />
          <Button variant="primary" icon="map" disabled>Tìm tuyến</Button>
        </div>
      </Card>

      <EmptyState
        icon="road"
        title="Trong lúc chờ, dùng danh sách đường bị ảnh hưởng"
        description="Danh sách giúp bạn tránh các đoạn đã có dữ liệu ngập, không phụ thuộc vào thao tác trên marker nhỏ."
        actions={<Button variant="primary" icon="road" to="/duong-bi-anh-huong">Xem đường bị ảnh hưởng</Button>}
      />

      <Notice tone="demo">
        <span className="row"><Icon name="info" size={16} /> Khi dịch vụ tính tuyến được bật, kết quả sẽ tối đa 2–3 phương án, mỗi phương án có độ dài, thời gian ước tính, điểm ảnh hưởng và độ mới dữ liệu. Tuyến không có báo cáo không được coi là đã xác nhận không ngập.</span>
      </Notice>
    </div>
  )
}
