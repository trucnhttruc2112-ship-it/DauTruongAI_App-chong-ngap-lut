import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Notice } from '../../components/ui/Feedback.jsx'
import { APP_CONFIG } from '../../app/config.js'
import { validatePhotoFile, downscalePhoto } from '../../services/api.js'
import { PHOTO_SOURCE } from '../../locales/vi/labels.js'
import { formatFull } from '../../utils/time.js'

/**
 * Bước 1 – Cung cấp ảnh (mục 7.1, 7.5, 13.5).
 * - Chụp ảnh là hành động chính; Chọn ảnh có sẵn là phụ.
 * - Camera dùng getUserMedia, dừng stream sau khi chụp hoặc thoát.
 * - Từ chối quyền / không có camera: không giữ khung đen, đưa lựa chọn phù hợp.
 * - Ảnh thư viện không tự gắn giờ gửi thành giờ chụp.
 */
export function PhotoCapture({ photo, onChange, allowLibrary = true }) {
  const [mode, setMode] = useState('idle') // idle | camera | processing
  const [camError, setCamError] = useState(null) // denied | unavailable | null
  const [fileError, setFileError] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const libraryInput = useRef(null)
  const captureInput = useRef(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
  useEffect(() => stopCamera, [])

  async function openCamera() {
    setCamError(null)
    setFileError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      // Không có API camera: dùng gợi ý capture của HTML (không bảo đảm ảnh vừa chụp)
      captureInput.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false
      })
      streamRef.current = stream
      setMode('camera')
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch (err) {
      stopCamera()
      setMode('idle')
      setCamError(err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }

  async function takeShot() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setMode('processing')
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    stopCamera()
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    const { dataUrl } = await downscalePhoto(blob)
    onChange({ dataUrl, source: 'camera', capturedAt: new Date().toISOString(), size: blob.size })
    setMode('idle')
  }

  function cancelCamera() {
    stopCamera()
    setMode('idle')
  }

  async function onFile(file, source) {
    setFileError(null)
    if (!file) return
    const e = validatePhotoFile(file)
    if (e) { setFileError(e); return }
    setMode('processing')
    try {
      const { dataUrl } = await downscalePhoto(file)
      onChange({
        dataUrl,
        source,
        // Ảnh qua input capture: ghi giờ ứng dụng nhận ảnh; ảnh thư viện: để người dùng khai báo
        capturedAt: source === 'camera' ? new Date().toISOString() : null,
        size: file.size
      })
    } catch (_) {
      setFileError('Không đọc được ảnh này. Vui lòng thử ảnh khác.')
    }
    setMode('idle')
  }

  const hiddenInputs = (
    <>
      <input
        ref={captureInput}
        type="file"
        accept={APP_CONFIG.photo.acceptTypes.join(',')}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { onFile(e.target.files?.[0], 'camera'); e.target.value = '' }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept={APP_CONFIG.photo.acceptTypes.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { onFile(e.target.files?.[0], 'library'); e.target.value = '' }}
      />
    </>
  )

  /* ---- Đang mở camera ---- */
  if (mode === 'camera') {
    return (
      <div className="camera">
        <video ref={videoRef} className="camera__video" playsInline muted aria-label="Khung camera" />
        <div className="camera__bar">
          <Button variant="ghost" className="camera__cancel" onClick={cancelCamera}>Hủy</Button>
          <button type="button" className="camera__shutter" onClick={takeShot} aria-label="Chụp ảnh">
            <span />
          </button>
          <span className="camera__spacer" />
        </div>
      </div>
    )
  }

  /* ---- Đã có ảnh: xem trước + Chụp lại / Đổi ảnh + nguồn ảnh ---- */
  if (photo) {
    return (
      <div className="stack">
        <figure className="photo-frame">
          <img src={photo.dataUrl} alt="Ảnh hiện trường đã chọn" />
          <figcaption className="photo-frame__tag">
            <Icon name={photo.source === 'camera' ? 'camera' : 'image'} size={14} />
            {PHOTO_SOURCE[photo.source]}
          </figcaption>
        </figure>
        <p className="small muted">
          {photo.capturedAt
            ? <>Thời gian chụp do website ghi nhận: <time dateTime={photo.capturedAt}>{formatFull(photo.capturedAt)}</time></>
            : 'Ảnh có sẵn: bạn sẽ khai báo thời điểm quan sát ở bước tiếp theo.'}
        </p>
        <div className="actions-bar actions-bar--stretch">
          <Button variant="secondary" icon="camera" onClick={openCamera}>Chụp lại</Button>
          {allowLibrary ? (
            <Button variant="secondary" icon="image" onClick={() => libraryInput.current?.click()}>Đổi ảnh</Button>
          ) : null}
        </div>
        {fileError ? <Notice tone="error" live>{fileError}</Notice> : null}
        {hiddenInputs}
      </div>
    )
  }

  /* ---- Chưa có ảnh ---- */
  return (
    <div className="stack">
      {camError === 'denied' ? (
        <Notice tone="warning" title="Website chưa được phép dùng camera" live>
          Mở cài đặt trình duyệt → Quyền của trang → bật Camera, rồi bấm Chụp ảnh lại.
          {allowLibrary ? ' Bạn cũng có thể chọn ảnh có sẵn trên thiết bị.' : ' Báo cáo cần ảnh chụp trực tiếp nên cần quyền camera.'}
        </Notice>
      ) : null}
      {camError === 'unavailable' ? (
        <Notice tone="info" title="Không tìm thấy camera trên thiết bị này" live>
          {allowLibrary ? 'Bạn có thể chọn ảnh có sẵn để tiếp tục.' : 'Báo cáo cần ảnh chụp trực tiếp; vui lòng dùng thiết bị có camera.'}
        </Notice>
      ) : null}
      {fileError ? <Notice tone="error" live>{fileError}</Notice> : null}

      <div className="photo-choice-grid">
        <button type="button" className="photo-choice photo-choice--primary" onClick={openCamera} disabled={mode === 'processing'}>
          <Icon name="camera" size={32} />
          <span className="photo-choice__label">Chụp ảnh</span>
          <span className="photo-choice__desc">Chụp trực tiếp tại nơi ngập</span>
        </button>
        {allowLibrary ? (
          <button type="button" className="photo-choice" onClick={() => libraryInput.current?.click()} disabled={mode === 'processing'}>
            <Icon name="image" size={32} />
            <span className="photo-choice__label">Chọn ảnh có sẵn</span>
            <span className="photo-choice__desc">Cần khai báo thời điểm quan sát</span>
          </button>
        ) : null}
      </div>
      {mode === 'processing' ? <p className="small muted" role="status">Đang xử lý ảnh…</p> : null}
      <p className="small muted">
        Một ảnh JPEG, PNG hoặc WebP, tối đa {APP_CONFIG.photo.maxBytes / 1024 / 1024} MB. Ảnh được thu nhỏ trước khi gửi; ảnh gốc trên thiết bị không bị thay đổi.
      </p>
      {hiddenInputs}
    </div>
  )
}
