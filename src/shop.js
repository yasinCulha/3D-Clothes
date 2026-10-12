const PRODUCT = { id: 'akatsuki-itachi', name: 'Akatsuki Pelerini — Itachi Edition', price: 2499.9 };
const FREE_SHIPPING = 750;
const STORAGE_KEY = 'akatsuki-cart-v1';

const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
const $ = (id) => document.getElementById(id);

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* gizli sekme vb. */ }
}

export function setupShop({ onDrawerToggle } = {}) {
  let cart = loadCart();
  let size = null;

  const sizes = $('sizes');
  const qty = $('qty');
  const drawer = $('cart-drawer');
  const backdrop = $('drawer-backdrop');
  let toastTimer;

  const toast = (msg) => {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  };

  // ---- Beden seçimi ----
  sizes.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-size]');
    if (!b || b.disabled) return;
    size = b.dataset.size;
    sizes.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    $('size-label').textContent = size;
    $('size-error').hidden = true;
  });
  sizes.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', 'false'));

  // ---- Adet ----
  const clampQty = (v) => Math.max(1, Math.min(10, Number.parseInt(v, 10) || 1));
  $('qty-minus').addEventListener('click', () => { qty.value = clampQty(qty.value - 1); });
  $('qty-plus').addEventListener('click', () => { qty.value = clampQty(+qty.value + 1); });
  qty.addEventListener('change', () => { qty.value = clampQty(qty.value); });

  // ---- Sepet ----
  function render() {
    const list = $('cart-items');
    list.innerHTML = '';
    let total = 0;
    let count = 0;
    for (const item of cart) {
      total += item.price * item.qty;
      count += item.qty;
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <div class="cart-thumb">暁</div>
        <div>
          <h4>${item.name}</h4>
          <div class="meta">Beden: ${item.size} · Adet: ${item.qty}</div>
        </div>
        <div class="right">
          <b>${fmt.format(item.price * item.qty)}</b>
          <button class="remove" data-key="${item.key}">Kaldır</button>
        </div>`;
      list.appendChild(li);
    }
    $('cart-empty').hidden = cart.length > 0;
    $('cart-total').textContent = fmt.format(total);
    $('checkout').disabled = cart.length === 0;
    $('shipping-note').textContent = total === 0 ? ''
      : total >= FREE_SHIPPING ? 'Kargo ücretsiz 🎉'
      : `Ücretsiz kargo için ${fmt.format(FREE_SHIPPING - total)} daha ekleyin.`;
    const badge = $('cart-count');
    badge.textContent = count;
  }

  $('cart-items').addEventListener('click', (e) => {
    const b = e.target.closest('.remove');
    if (!b) return;
    cart = cart.filter((i) => i.key !== b.dataset.key);
    saveCart(cart);
    render();
  });

  $('add-to-cart').addEventListener('click', () => {
    if (!size) {
      $('size-error').hidden = false;
      sizes.classList.remove('shake');
      void sizes.offsetWidth;
      sizes.classList.add('shake');
      return;
    }
    const key = `${PRODUCT.id}-${size}`;
    const n = clampQty(qty.value);
    const existing = cart.find((i) => i.key === key);
    if (existing) existing.qty = Math.min(10, existing.qty + n);
    else cart.push({ key, ...PRODUCT, size, qty: n });
    saveCart(cart);
    render();
    const badge = $('cart-count');
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
    toast(`Sepete eklendi · ${size} beden`);
    openDrawer();
  });

  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    onDrawerToggle?.(true);
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    onDrawerToggle?.(false);
  }
  $('cart-open').addEventListener('click', openDrawer);
  $('cart-close').addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  $('checkout').addEventListener('click', () => toast('Bu bir demo mağazadır — ödeme alınmaz.'));

  // ---- Beden tablosu ----
  const dlg = $('size-guide');
  $('size-guide-open').addEventListener('click', () => dlg.showModal());
  $('size-guide-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  render();
  return { openDrawer, closeDrawer, toast };
}
