import { forwardRef, useId, useState } from 'react'
import { Icon } from './Icon.jsx'

/** Khung chung cho ô nhập: nhãn thật, gợi ý, lỗi gắn với trường. */
function FieldShell({ id, label, hint, error, required, optional, children, className = '' }) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label ? (
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? <span className="field__req" aria-hidden="true"> *</span> : null}
          {optional ? <span className="field__opt"> (không bắt buộc)</span> : null}
        </label>
      ) : null}
      {hint ? <p className="field__hint" id={`${id}-hint`}>{hint}</p> : null}
      {children}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

function describedBy(id, hint, error) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
}

export const TextField = forwardRef(function TextField(
  { label, hint, error, required, optional, id: idProp, className, type = 'text', leadingIcon, ...rest },
  ref
) {
  const auto = useId()
  const id = idProp || auto
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} optional={optional} className={className}>
      <div className={`input-wrap ${leadingIcon ? 'has-leading' : ''}`}>
        {leadingIcon ? <Icon name={leadingIcon} className="input-wrap__icon" /> : null}
        <input
          ref={ref}
          id={id}
          type={type}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          required={required}
          {...rest}
        />
      </div>
    </FieldShell>
  )
})

export const PasswordField = forwardRef(function PasswordField(
  { label, hint, error, required, id: idProp, className, ...rest },
  ref
) {
  const auto = useId()
  const id = idProp || auto
  const [shown, setShown] = useState(false)
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="input-wrap has-trailing">
        <input
          ref={ref}
          id={id}
          type={shown ? 'text' : 'password'}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          required={required}
          {...rest}
        />
        <button
          type="button"
          className="input-wrap__toggle"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={id}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size={18} />
          <span>{shown ? 'Ẩn' : 'Hiện'}</span>
        </button>
      </div>
    </FieldShell>
  )
})

export const TextArea = forwardRef(function TextArea(
  { label, hint, error, required, optional, id: idProp, className, rows = 3, ...rest },
  ref
) {
  const auto = useId()
  const id = idProp || auto
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} optional={optional} className={className}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className="input input--textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...rest}
      />
    </FieldShell>
  )
})

export const Select = forwardRef(function Select(
  { label, hint, error, required, id: idProp, className, options = [], children, ...rest },
  ref
) {
  const auto = useId()
  const id = idProp || auto
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="select-wrap">
        <select
          ref={ref}
          id={id}
          className="input input--select"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          required={required}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
          {children}
        </select>
        <Icon name="chevron-down" className="select-wrap__chevron" />
      </div>
    </FieldShell>
  )
})

/**
 * Nhóm lựa chọn dạng nút (radio thật bên dưới) – dùng cho chế độ giao diện,
 * mức ngập người gửi quan sát, phương tiện...
 */
export function ChoiceGroup({
  legend, name, value, onChange, options, multiple = false, hint, error, columns, className = '', size = 'md'
}) {
  const auto = useId()
  const isOn = (v) => (multiple ? (value || []).includes(v) : value === v)
  const toggle = (v) => {
    if (!multiple) return onChange(v)
    const set = new Set(value || [])
    set.has(v) ? set.delete(v) : set.add(v)
    onChange(Array.from(set))
  }
  return (
    <fieldset className={`choice-group ${error ? 'has-error' : ''} ${className}`} aria-describedby={hint ? `${auto}-hint` : undefined}>
      {legend ? <legend className="field__label">{legend}</legend> : null}
      {hint ? <p className="field__hint" id={`${auto}-hint`}>{hint}</p> : null}
      <div className={`choice-group__items choice-group--${size}`} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
        {options.map((o) => (
          <label key={o.value} className={`choice ${isOn(o.value) ? 'is-on' : ''} ${o.disabled ? 'is-disabled' : ''}`}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={name || auto}
              value={o.value}
              checked={isOn(o.value)}
              disabled={o.disabled}
              onChange={() => toggle(o.value)}
            />
            {o.icon ? <Icon name={o.icon} size={18} /> : null}
            <span className="choice__text">
              <span className="choice__label">{o.label}</span>
              {o.description ? <span className="choice__desc">{o.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="field__error"><Icon name="error" size={16} /><span>{error}</span></p>
      ) : null}
    </fieldset>
  )
}

export function Checkbox({ label, description, checked, onChange, id: idProp, ...rest }) {
  const auto = useId()
  const id = idProp || auto
  return (
    <div className="checkbox">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} {...rest} />
      <label htmlFor={id}>
        <span className="checkbox__label">{label}</span>
        {description ? <span className="checkbox__desc">{description}</span> : null}
      </label>
    </div>
  )
}
