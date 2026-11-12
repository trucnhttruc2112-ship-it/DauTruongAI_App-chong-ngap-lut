import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { createBandoMap } from '../../../../bando/map.js'
import { Button } from '../../components/ui/Button.jsx'
import { Notice } from '../../components/ui/Feedback.jsx'
import { iconSvgString } from '../../components/ui/Icon.jsx'
import { APP_CONFIG } from '../../app/config.js'
import { isInsideSupportedArea, reverseLookup } from '../../services/api.js'
import { LOCATION_SOURCE } from '../../locales/vi/labels.js'

const pinIcon = L.divIcon({
  className: '',
  html: `<span class="fm-pick">${iconSvgString('pin', 40, '#1D4ED8')}</span>`,
  iconSize: [40, 48],
  iconAnchor: [20, 46]
})

/**
 * Bước 2 – Xác nhận vị trí (mục 7.2). Bản đồ nhỏ, Dùng vị trí của tôi hoặc Chọn trên bản đồ.
 * Luôn cần xác nhận; chọn tay thì nhãn là "Vị trí do người gửi chọn".
 * GPS bị từ chối/sai số lớn không chặn báo cáo.
 */
export function LocationPicker({ value, onChange, error }) {
  const el = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const accCircle = useRef(null)
  const lookupId = useRef(0)
  const [picking, setPicking] = useState(!value?.lat)
  const [gps, setGps] = useState({ busy: false, error: null })
  const valueRef = useRef(value)
  valueRef.current = value

  const place = async (lat, lng, source, accuracy = null) => {
    const requestId = ++lookupId.current
    const inside = isInsideSupportedArea(lat, lng)
    onChange({ ...valueRef.current, lat, lng, source, accuracy, inside, confirmed: false })
    const rev = await reverseLookup(lat, lng)
    // Gợi ý đến muộn không được ghi đè lần chọn mới, tên người dùng sửa hoặc xác nhận vừa đánh dấu.
    if (requestId === lookupId.current && rev && !valueRef.current?.placeEdited &&
        valueRef.current?.lat === lat && valueRef.current?.lng === lng) {
      onChange({ ...valueRef.current, place: rev.name, area: rev.area })
    }
  }

  useEffect(() => {
    const start = value?.lat ? [value.lat, value.lng] : APP_CONFIG.map.center
    const { map: m } = createBandoMap(L, el.current, {
      center: start,
      zoom: value?.lat ? 17 : 14,
      mapOptions: { zoomControl: true, attributionControl: true },
      tileUrl: APP_CONFIG.map.tileUrl,
      tileOptions: { attribution: APP_CONFIG.map.attribution, maxZoom: 19 },
      scale: false
    })
    m.attributionControl.setPrefix(false)
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => { lookupId.current += 1; ro.disconnect(); m.remove(); map.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Chọn điểm bằng chạm bản đồ khi đang ở chế độ chọn
  useEffect(() => {
    const m = map.current
    if (!m) return
    const onClick = (e) => { if (picking) place(e.latlng.lat, e.latlng.lng, 'manual') }
    m.on('click', onClick)
    el.current.classList.toggle('is-picking', picking)
    return () => { m.off('click', onClick) }
  }, [picking]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vẽ marker + vòng độ chính xác
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!value?.lat) {
      marker.current?.remove(); marker.current = null
      accCircle.current?.remove(); accCircle.current = null
      return
    }
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], { icon: pinIcon, draggable: true, keyboard: true, title: 'Vị trí điểm ngập – kéo để chỉnh' }).addTo(m)
      marker.current.on('dragend', () => {
        const p = marker.current.getLatLng()
        place(p.lat, p.lng, 'manual')
      })
    } else {
      marker.current.setLatLng([value.lat, value.lng])
    }
    accCircle.current?.remove(); accCircle.current = null
    if (value.accuracy) {
      accCircle.current = L.circle([value.lat, value.lng], { radius: value.accuracy, color: '#1D4ED8', weight: 1, fillOpacity: 0.08 }).addTo(m)
    }
  }, [value?.lat, value?.lng, value?.accuracy]) // eslint-disable-line react-hooks/exhaustive-deps

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGps({ busy: false, error: 'Thiết bị không hỗ trợ định vị. Hãy chọn điểm trên bản đồ.' })
      setPicking(true)
      return
    }
    setGps({ busy: true, error: null })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setGps({ busy: false, error: null })
        setPicking(false)
        map.current?.flyTo([latitude, longitude], 17, { duration: 0.5 })
        place(latitude, longitude, 'gps', Math.round(accuracy))
      },
      () => {
        setGps({ busy: false, error: 'Chưa lấy được vị trí của bạn. Hãy chạm vào bản đồ để chọn điểm ngập.' })
        setPicking(true)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    )
  }

  const lowAccuracy = value?.source === 'gps' && value?.accuracy > 100

  return (
    <div className="stack">
      <div className="actions-bar actions-bar--stretch">
        <Button variant="secondary" icon="locate" onClick={useMyLocation} loading={gps.busy}>Dùng vị trí của tôi</Button>
        <Button
          variant={picking ? 'primary' : 'secondary'}
          icon="pin"
          aria-pressed={picking}
          onClick={() => setPicking((p) => !p)}
        >
          {picking ? 'Đang chọn trên bản đồ' : 'Chọn trên bản đồ'}
        </Button>
      </div>
      {gps.error ? <Notice tone="warning" live>{gps.error}</Notice> : null}
      {picking ? <p className="small muted" role="status">Chạm vào bản đồ để đặt vị trí điểm ngập. Có thể kéo ghim để chỉnh.</p> : null}

      <div ref={el} className="mini-map" role="application" aria-label="Bản đồ chọn vị trí điểm ngập" />

      {value?.lat ? (
        <p className="small">
          <strong>{LOCATION_SOURCE[value.source]}</strong>
          {value.accuracy ? <span className="muted"> · sai số khoảng {value.accuracy} m</span> : null}
          <span className="muted"> · {value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>
        </p>
      ) : null}
      {lowAccuracy ? (
        <Notice tone="warning">Sai số GPS lớn. Hãy kéo ghim đến đúng chỗ hoặc chọn trên bản đồ.</Notice>
      ) : null}
      {value?.lat && value.inside === false ? (
        <Notice tone="info">Vị trí này chưa thuộc khu vực có dữ liệu của dự án. Bạn vẫn có thể gửi để kiểm tra.</Notice>
      ) : null}
      {error ? <p className="field__error">{error}</p> : null}
    </div>
  )
}
