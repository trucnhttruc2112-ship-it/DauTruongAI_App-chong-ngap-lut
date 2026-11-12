import crypto from 'crypto';
import floodPointRepo from '../repositories/floodPointRepo.js';
import eventRepo from '../repositories/eventRepo.js';
import { formatContractB } from './floodPointQueryService.js';

// Thao tac cua phuong (trang quan ly NV2) tren 1 diem ngap
export const WARD_ACTIONS = [
  'receive', 'request-info', 'verify', 'invalid', 'in-progress', 'close',
  'hide', 'confirm-clear', 'confirm-active', 'note', 'add-info',
];

function openEvent(point, now) {
  if (eventRepo.findOpenEvent(point.id)) return;
  eventRepo.insert({
    id: `ev_${crypto.randomUUID()}`,
    floodPointId: point.id,
    startedAt: now,
    endedAt: null,
    endReason: null,
    isDemo: point.isDemo ? 1 : 0,
  });
}

function closeEvent(point, now, reason, fields) {
  const ev = eventRepo.findOpenEvent(point.id);
  if (!ev) return;
  eventRepo.closeEvent(ev.id, now, reason);
  fields.floodEventCount = (point.floodEventCount || 0) + 1;
}

export function applyWardAction(id, body) {
  const { action, reason, version, closeOutcome, actor } = body;
  const p = floodPointRepo.findById(id);
  if (!p) return { error: 'NOT_FOUND' };
  if (version != null && version !== p.version) {
    return { error: 'VERSION_CONFLICT', point: formatContractB(p) };
  }

  const now = new Date().toISOString();
  const note = reason ? `: ${reason}` : '';
  const fields = {};
  let text = '';
  let kind = 'processing';

  switch (action) {
    case 'receive':
      fields.processingStatus = 'received';
      text = 'Đã tiếp nhận, bắt đầu kiểm tra';
      break;
    case 'request-info':
      fields.processingStatus = 'needs-info';
      text = `Yêu cầu bổ sung${note}`;
      break;
    case 'verify':
      if (p.status === 'pending' || p.status === 'rejected') {
        fields.status = 'active';
        openEvent(p, now);
      }
      if (p.processingStatus === 'submitted') fields.processingStatus = 'received';
      fields.publication = null;
      text = `Xác nhận thông tin${note}. Công khai trên bản đồ`;
      kind = 'verification';
      break;
    case 'invalid':
      fields.status = 'rejected';
      closeEvent(p, now, 'ward_rejected', fields);
      text = `Đánh dấu không hợp lệ${note}`;
      kind = 'verification';
      break;
    case 'in-progress':
      fields.processingStatus = 'in-progress';
      text = 'Chuyển sang Đang xử lý';
      break;
    case 'close':
      fields.processingStatus = 'closed';
      if (closeOutcome === 'confirmed-clear') {
        fields.status = 'resolved';
        closeEvent(p, now, 'ward_closed', fields);
      }
      text = `Đóng báo cáo${note}${closeOutcome === 'confirmed-clear' ? '. Đã xác nhận hết ngập' : ''}`;
      break;
    case 'hide':
      fields.publication = 'hidden';
      text = `Ẩn khỏi bản đồ công khai${note}`;
      kind = 'publication';
      break;
    case 'confirm-clear':
      fields.status = 'resolved';
      closeEvent(p, now, 'ward_confirmed_ended', fields);
      text = `Xác nhận hết ngập${note}`;
      kind = 'condition';
      break;
    case 'confirm-active':
      fields.status = 'active';
      openEvent(p, now);
      text = `Xác nhận vẫn còn ngập${note}`;
      kind = 'condition';
      break;
    case 'note':
      text = `Phản hồi cho người gửi${note}`;
      kind = 'feedback';
      break;
    case 'add-info':
      fields.processingStatus = 'received';
      text = `Người gửi đã bổ sung thông tin${note}`;
      break;
    default:
      return { error: 'INVALID_ACTION' };
  }

  const history = [{ at: now, actor: actor || 'Phường', text, kind }, ...p.history].slice(0, 50);
  const updated = floodPointRepo.update(id, {
    ...fields,
    historyJson: JSON.stringify(history),
    version: p.version + 1,
    lastUpdatedAt: now,
  });
  return { point: formatContractB(updated) };
}
