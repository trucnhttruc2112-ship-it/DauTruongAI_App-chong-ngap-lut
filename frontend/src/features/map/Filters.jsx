import { useEffect, useState } from 'react'
import { ChoiceGroup } from '../../components/ui/Field.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { SheetDialog } from '../../components/ui/Dialog.jsx'
import { SEVERITY, VERIFICATION, TIME_FILTER, SEVERITY_ORDER } from '../../locales/vi/labels.js'
import { AREAS } from '../../services/api.js'
import { DEFAULT_FILTERS, countActiveFilters } from './mapState.jsx'

const sevOptions = SEVERITY_ORDER.map((s) => ({ value: s, label: SEVERITY[s] }))
const timeOptions = Object.entries(TIME_FILTER).map(([value, label]) => ({ value, label }))
const areaOptions = AREAS.map((a) => ({ value: a, label: a }))
const verifyOptions = ['verified', 'checking', 'unchecked'].map((v) => ({ value: v, label: VERIFICATION[v] }))

/** Các nhóm lọc: mức ngập, thời gian ghi nhận, khu vực, trạng thái xác minh (mục 6.4). */
export function FilterFields({ value, onChange }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v })
  return (
    <div className="filter-fields">
      <ChoiceGroup legend="Mức ngập" multiple value={value.severities} onChange={set('severities')} options={sevOptions} size="sm" columns={2} />
      <ChoiceGroup
        legend="Thời gian ghi nhận"
        hint="Đây là bộ lọc xem, không phải thời hạn dữ liệu còn chính xác."
        value={value.time}
        onChange={set('time')}
        options={timeOptions}
        size="sm"
        columns={2}
      />
      <ChoiceGroup legend="Khu vực" multiple value={value.areas} onChange={set('areas')} options={areaOptions} size="sm" columns={2} />
      <ChoiceGroup legend="Trạng thái xác minh" multiple value={value.verification} onChange={set('verification')} options={verifyOptions} size="sm" columns={1} />
    </div>
  )
}

/** Trên điện thoại mở bộ lọc thành bảng riêng, có Áp dụng và số bộ lọc đang dùng. */
export function FilterSheet({ open, onClose, value, onApply }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { if (open) setDraft(value) }, [open, value])
  const n = countActiveFilters(draft)
  return (
    <SheetDialog
      open={open}
      onClose={onClose}
      title="Bộ lọc"
      footer={
        <>
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_FILTERS)}>Xóa bộ lọc</Button>
          <Button variant="primary" onClick={() => { onApply(draft); onClose() }}>
            Áp dụng{n ? ` (${n})` : ''}
          </Button>
        </>
      }
    >
      <FilterFields value={draft} onChange={setDraft} />
    </SheetDialog>
  )
}

/** Tóm tắt bộ lọc đang dùng dạng chip – bấm để bỏ. */
export function ActiveFilterChips({ value, onChange }) {
  const chips = []
  if (value.time !== '24h') chips.push({ key: 'time', label: TIME_FILTER[value.time], clear: () => onChange({ ...value, time: '24h' }) })
  value.severities.forEach((s) => chips.push({ key: `s-${s}`, label: SEVERITY[s], clear: () => onChange({ ...value, severities: value.severities.filter((x) => x !== s) }) }))
  value.areas.forEach((a) => chips.push({ key: `a-${a}`, label: a, clear: () => onChange({ ...value, areas: value.areas.filter((x) => x !== a) }) }))
  value.verification.forEach((v) => chips.push({ key: `v-${v}`, label: VERIFICATION[v], clear: () => onChange({ ...value, verification: value.verification.filter((x) => x !== v) }) }))
  if (!chips.length) return null
  return (
    <ul className="chips" aria-label="Bộ lọc đang dùng">
      {chips.map((c) => (
        <li key={c.key}>
          <button type="button" className="chip" onClick={c.clear} aria-label={`Bỏ lọc ${c.label}`}>
            <span>{c.label}</span>
            <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
