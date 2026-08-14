// ===== Tien ich chung =====
async function api(path, options) {
  const res = await fetch(path, {
    headers: options?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new Error(data?.error || `Lỗi HTTP ${res.status}`);
  return data;
}

function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === 'text') node.textContent = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  });
  (children || []).forEach(c => node.appendChild(c));
  return node;
}

function showMsg(elId, message, isError) {
  const node = document.getElementById(elId);
  node.textContent = message || '';
  node.className = isError ? 'error-msg' : 'ok-msg';
}

// ===== Phien dang nhap + dieu huong =====
async function checkSession() {
  try {
    const data = await api('/api/admin/session');
    document.getElementById('whoAmI').textContent = data.username ? `Đăng nhập: ${data.username}` : '';
    return true;
  } catch {
    window.location.href = 'login.html';
    return false;
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
  window.location.href = 'login.html';
});

document.querySelectorAll('.sidenav button').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.section === 'customer') { window.open('/', '_blank'); return; }
    document.querySelectorAll('.sidenav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
  });
});

// ===== Gioi han thong so =====
async function loadLimits() {
  const rows = await api('/api/admin/limits');
  const tbody = document.querySelector('#limitsTable tbody');
  tbody.innerHTML = '';

  rows.forEach(row => {
    const labelInput = el('input', { type: 'text', value: row.label });
    const minInput = el('input', { type: 'number', value: row.min_value, step: 'any' });
    const maxInput = el('input', { type: 'number', value: row.max_value, step: 'any' });
    const stepInput = el('input', { type: 'number', value: row.step_value, step: 'any' });
    const defaultInput = el('input', { type: 'number', value: row.default_value, step: 'any' });
    const unitInput = el('input', { type: 'text', value: row.unit });

    const saveBtn = el('button', { className: 'btn small primary', text: 'Lưu' });
    saveBtn.addEventListener('click', async () => {
      showMsg('limitsMsg', '', false);
      try {
        await api(`/api/admin/limits/${row.param_key}`, {
          method: 'PUT',
          body: JSON.stringify({
            label: labelInput.value,
            min: Number(minInput.value),
            max: Number(maxInput.value),
            step: Number(stepInput.value),
            default: Number(defaultInput.value),
            unit: unitInput.value,
          }),
        });
        showMsg('limitsMsg', `Đã lưu "${row.param_key}".`, false);
      } catch (err) {
        showMsg('limitsMsg', err.message, true);
      }
    });

    const tr = el('tr', {}, [
      el('td', { text: row.param_key }),
      el('td', {}, [labelInput]),
      el('td', { className: 'num' }, [minInput]),
      el('td', { className: 'num' }, [maxInput]),
      el('td', { className: 'num' }, [stepInput]),
      el('td', { className: 'num' }, [defaultInput]),
      el('td', { className: 'num' }, [unitInput]),
      el('td', { className: 'actions' }, [saveBtn]),
    ]);
    tbody.appendChild(tr);
  });
}

// ===== Mau nhua =====
async function loadColors() {
  const rows = await api('/api/admin/colors');
  const container = document.getElementById('colorsContainer');
  container.innerHTML = '';

  const bySeries = new Map();
  rows.forEach(r => {
    if (!bySeries.has(r.series)) bySeries.set(r.series, []);
    bySeries.get(r.series).push(r);
  });

  bySeries.forEach((colors, series) => {
    const table = el('table', { className: 'grid' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Màu' }), el('th', { text: 'Tên' }), el('th', { text: 'Thứ tự' }),
        el('th', { text: 'Hoạt động' }), el('th', {}),
      ])]),
    ]);
    const tbody = el('tbody');
    table.appendChild(tbody);

    colors.forEach(c => {
      const hexInput = el('input', { type: 'color', value: c.hex });
      const nameInput = el('input', { type: 'text', value: c.name });
      const orderInput = el('input', { type: 'number', value: c.sort_order, style: 'width:70px' });
      const activeInput = el('input', { type: 'checkbox', checked: !!c.active });

      const saveBtn = el('button', { className: 'btn small', text: 'Lưu' });
      saveBtn.addEventListener('click', async () => {
        showMsg('colorsMsg', '', false);
        try {
          await api(`/api/admin/colors/${c.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              series, name: nameInput.value, hex: hexInput.value,
              sort_order: Number(orderInput.value), active: activeInput.checked,
            }),
          });
          showMsg('colorsMsg', `Đã lưu "${nameInput.value}".`, false);
        } catch (err) {
          showMsg('colorsMsg', err.message, true);
        }
      });

      const delBtn = el('button', { className: 'btn small danger', text: 'Xoá' });
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Xoá màu "${c.name}"?`)) return;
        try {
          await api(`/api/admin/colors/${c.id}`, { method: 'DELETE' });
          loadColors();
        } catch (err) {
          showMsg('colorsMsg', err.message, true);
        }
      });

      tbody.appendChild(el('tr', {}, [
        el('td', {}, [hexInput]),
        el('td', {}, [nameInput]),
        el('td', {}, [orderInput]),
        el('td', {}, [activeInput]),
        el('td', { className: 'actions' }, [saveBtn, delBtn]),
      ]));
    });

    // them mau moi vao series nay
    const addName = el('input', { type: 'text', placeholder: 'Tên màu mới' });
    const addHex = el('input', { type: 'color', value: '#ffffff' });
    const addBtn = el('button', { className: 'btn small primary', text: '+ Thêm vào series này' });
    addBtn.addEventListener('click', async () => {
      if (!addName.value.trim()) { showMsg('colorsMsg', 'Nhập tên màu trước.', true); return; }
      try {
        await api('/api/admin/colors', {
          method: 'POST',
          body: JSON.stringify({ series, name: addName.value, hex: addHex.value, sort_order: colors.length }),
        });
        loadColors();
      } catch (err) {
        showMsg('colorsMsg', err.message, true);
      }
    });

    const block = el('div', { className: 'series-block' }, [
      el('h3', { text: `${series} (${colors.length})` }),
      table,
      el('div', { className: 'add-row' }, [
        el('div', { className: 'grow-2' }, [addName]),
        el('div', { style: 'flex:0 0 60px;' }, [addHex]),
        el('div', { style: 'flex:0 0 auto;' }, [addBtn]),
      ]),
    ]);
    container.appendChild(block);
  });
}

document.getElementById('addSeriesBtn').addEventListener('click', async () => {
  const series = document.getElementById('newSeriesName').value.trim();
  const name = document.getElementById('newSeriesColorName').value.trim();
  const hex = document.getElementById('newSeriesColorHex').value;
  if (!series || !name) { showMsg('colorsMsg', 'Nhập tên series và tên màu.', true); return; }
  try {
    await api('/api/admin/colors', { method: 'POST', body: JSON.stringify({ series, name, hex, sort_order: 0 }) });
    document.getElementById('newSeriesName').value = '';
    document.getElementById('newSeriesColorName').value = '';
    loadColors();
  } catch (err) {
    showMsg('colorsMsg', err.message, true);
  }
});

// ===== Font =====
function renderFontTable(tableId, fonts, role) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';

  fonts.forEach(f => {
    const defaultRadio = el('input', { type: 'radio', name: `default-${role}`, checked: !!f.is_default });
    defaultRadio.addEventListener('change', async () => {
      try {
        await api(`/api/admin/fonts/${f.id}`, { method: 'PUT', body: JSON.stringify({ is_default: true }) });
        loadFonts();
      } catch (err) {
        showMsg('fontsMsg', err.message, true);
      }
    });

    const activeInput = el('input', { type: 'checkbox', checked: !!f.active });
    activeInput.addEventListener('change', async () => {
      try {
        await api(`/api/admin/fonts/${f.id}`, { method: 'PUT', body: JSON.stringify({ active: activeInput.checked }) });
        showMsg('fontsMsg', '', false);
      } catch (err) {
        activeInput.checked = !activeInput.checked;
        showMsg('fontsMsg', err.message, true);
      }
    });

    const delBtn = el('button', { className: 'btn small danger', text: 'Xoá' });
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Xoá font "${f.display_name}"?`)) return;
      try {
        await api(`/api/admin/fonts/${f.id}`, { method: 'DELETE' });
        loadFonts();
      } catch (err) {
        showMsg('fontsMsg', err.message, true);
      }
    });

    tbody.appendChild(el('tr', {}, [
      el('td', { text: f.display_name }),
      el('td', { text: f.format }),
      el('td', {}, [defaultRadio]),
      el('td', {}, [activeInput]),
      el('td', { className: 'actions' }, [delBtn]),
    ]));
  });
}

async function loadFonts() {
  const rows = await api('/api/admin/fonts');
  renderFontTable('fontsTextTable', rows.filter(f => f.role === 'text'), 'text');
  renderFontTable('fontsEmojiTable', rows.filter(f => f.role === 'emoji'), 'emoji');
}

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const role = document.getElementById('uploadRole').value;
  const name = document.getElementById('uploadName').value;
  const fileInput = document.getElementById('uploadFile');
  const file = fileInput.files[0];
  if (!file) { showMsg('uploadMsg', 'Chọn 1 file .ttf/.otf trước.', true); return; }

  const form = new FormData();
  form.append('role', role);
  form.append('display_name', name);
  form.append('file', file);

  showMsg('uploadMsg', 'Đang upload...', false);
  try {
    await api('/api/admin/fonts', { method: 'POST', body: form });
    document.getElementById('uploadName').value = '';
    fileInput.value = '';
    showMsg('uploadMsg', 'Đã upload thành công.', false);
    loadFonts();
  } catch (err) {
    showMsg('uploadMsg', err.message, true);
  }
});

// ===== Doi mat khau =====
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showMsg('passwordMsg', 'Mật khẩu mới nhập lại không khớp.', true);
    return;
  }
  try {
    await api('/api/admin/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    showMsg('passwordMsg', 'Đã đổi mật khẩu thành công.', false);
    document.getElementById('passwordForm').reset();
  } catch (err) {
    showMsg('passwordMsg', err.message, true);
  }
});

// ===== Khoi dong =====
(async function boot() {
  const loggedIn = await checkSession();
  if (!loggedIn) return;
  await Promise.all([loadLimits(), loadColors(), loadFonts()]);
})();
