// Gioi han cung tuyet doi cho tung thong so, KHONG phu thuoc admin nhap gi — dam bao
// admin khong the tu lam hong trai nghiem cua moi khach cung luc (vd 0 hoac am cho
// nhung truong khong duoc phep vi se gay chia-cho-0/loi hinh hoc phia client).
const ABSOLUTE_BOUNDS = {
  gap: { min: -500, max: 500 },
  depth: { min: 0.2, max: 100 },
  textFontSize: { min: 1, max: 500 },
  emojiFontSize: { min: 1, max: 500 },
  emojiNudge: { min: -500, max: 500 },
  bgOffset: { min: 0, max: 200 },
  bgDepth: { min: 0.1, max: 100 },
  ringHole: { min: 0.5, max: 200 },
  ringWall: { min: 0.2, max: 100 },
  ringPos: { min: 0, max: 100 },
  ringInset: { min: 0, max: 200 },
};

export function validateLimitUpdate(paramKey, body) {
  const bounds = ABSOLUTE_BOUNDS[paramKey];
  if (!bounds) return { ok: false, error: `Không nhận diện được thông số "${paramKey}".` };

  const min = Number(body?.min);
  const max = Number(body?.max);
  const step = Number(body?.step);
  const def = Number(body?.default);
  const unit = body?.unit;
  const label = body?.label;

  for (const [name, val] of [['min', min], ['max', max], ['step', step], ['default', def]]) {
    if (!Number.isFinite(val)) return { ok: false, error: `Giá trị "${name}" phải là số hợp lệ.` };
  }
  if (min < bounds.min || max > bounds.max) {
    return {
      ok: false,
      error: `Giới hạn phải nằm trong khoảng an toàn kỹ thuật [${bounds.min}, ${bounds.max}] của thông số này.`,
    };
  }
  if (min > max) return { ok: false, error: '"min" phải nhỏ hơn hoặc bằng "max".' };
  if (def < min || def > max) return { ok: false, error: '"default" phải nằm trong khoảng [min, max].' };
  if (step <= 0) return { ok: false, error: '"step" phải lớn hơn 0.' };
  if (typeof label !== 'string' || !label.trim()) return { ok: false, error: 'Thiếu "label".' };
  if (typeof unit !== 'string') return { ok: false, error: '"unit" phải là chuỗi (có thể rỗng).' };

  return { ok: true, value: { min, max, step, default: def, unit, label: label.trim() } };
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function validateColorInput(body) {
  const series = body?.series;
  const name = body?.name;
  const hex = body?.hex;
  const sortOrder = Number(body?.sort_order);

  if (typeof series !== 'string' || !series.trim() || series.length > 100) {
    return { ok: false, error: 'Thiếu "series" hoặc quá dài (tối đa 100 ký tự).' };
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 100) {
    return { ok: false, error: 'Thiếu "name" hoặc quá dài (tối đa 100 ký tự).' };
  }
  if (typeof hex !== 'string' || !HEX_RE.test(hex)) {
    return { ok: false, error: '"hex" phải đúng định dạng #RRGGBB.' };
  }

  return {
    ok: true,
    value: {
      series: series.trim(),
      name: name.trim(),
      hex: hex.toUpperCase(),
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  };
}
