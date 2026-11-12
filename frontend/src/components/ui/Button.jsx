import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon.jsx'

/**
 * Nút dùng chung.
 * variant: primary | secondary | ghost | danger | link
 * size: md (48px mobile / 44px desktop) | sm (40px – nút phụ desktop)
 * Truyền `to` để render như liên kết nội bộ.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    block = false,
    to,
    href,
    className = '',
    children,
    type = 'button',
    disabled,
    ...rest
  },
  ref
) {
  const cls = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block ? 'btn--block' : '',
    !children ? 'btn--icon-only' : '',
    loading ? 'is-loading' : '',
    className
  ].filter(Boolean).join(' ')

  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {iconRight ? <Icon name={iconRight} /> : null}
    </>
  )

  if (to && !disabled) {
    return <Link ref={ref} to={to} className={cls} {...rest}>{content}</Link>
  }
  if (href && !disabled) {
    return <a ref={ref} href={href} className={cls} {...rest}>{content}</a>
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  )
})

/** Nút chỉ có biểu tượng – bắt buộc có nhãn cho công cụ đọc màn hình. */
export const IconButton = forwardRef(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', className = '', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`btn btn--${variant} btn--${size} btn--icon-only ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
})
