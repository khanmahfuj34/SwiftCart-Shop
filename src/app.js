// =====================
// SWIFTCART PRO CONFIG
// =====================
const API_BASE = "https://fakestoreapi.com";
const CART_KEY = "swiftcart_cart_pro";
const WISHLIST_KEY = "swiftcart_wishlist";
const USER_KEY = "swiftcart_user";
const ORDERS_KEY = "swiftcart_orders";

// =====================
// SAFE STORAGE HELPERS
// =====================
const SafeStorage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

// =====================
// STATE MANAGEMENT
// =====================
const State = {
  allProducts: [],
  cart: [],
  wishlist: [],
  user: null,
  orders: [],
  filteredProducts: [],
  searchQuery: "",
  sortBy: "default",
  isLoading: true,

  init() {
    this.loadFromStorage();
  },

  loadFromStorage() {
    const cart = SafeStorage.get(CART_KEY, []);
    const wishlist = SafeStorage.get(WISHLIST_KEY, []);
    const user = SafeStorage.get(USER_KEY, null);
    const orders = SafeStorage.get(ORDERS_KEY, []);

    // Schema validation: ensure cart items have required fields
    this.cart = Array.isArray(cart)
      ? cart.filter(i => i && typeof i.id === "number" && typeof i.price === "number")
      : [];

    this.wishlist = Array.isArray(wishlist) ? wishlist.filter(id => typeof id === "number") : [];
    this.user = user && typeof user.name === "string" && typeof user.email === "string" ? user : null;
    this.orders = Array.isArray(orders) ? orders : [];
  },

  saveCart()    { SafeStorage.set(CART_KEY, this.cart); },
  saveWishlist(){ SafeStorage.set(WISHLIST_KEY, this.wishlist); },
  saveUser()    { this.user ? SafeStorage.set(USER_KEY, this.user) : SafeStorage.remove(USER_KEY); },
  saveOrders()  { SafeStorage.set(ORDERS_KEY, this.orders); },

  addToCart(product, qty = 1) {
    const existing = this.cart.find(i => i.id === product.id);
    if (existing) {
      existing.qty = Math.min(999, existing.qty + qty);
    } else {
      this.cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        rating: product.rating,
        qty: qty
      });
    }
    this.saveCart();
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.id !== productId);
    this.saveCart();
  },

  updateCartQty(productId, qty) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;
    if (qty <= 0) {
      this.removeFromCart(productId);
    } else {
      item.qty = Math.min(999, qty);
      this.saveCart();
    }
  },

  toggleWishlist(productId) {
    const idx = this.wishlist.indexOf(productId);
    if (idx > -1) this.wishlist.splice(idx, 1);
    else this.wishlist.push(productId);
    this.saveWishlist();
  },

  isInWishlist(productId) { return this.wishlist.includes(productId); },

  getCartSubtotal() { return this.cart.reduce((s, i) => s + i.price * i.qty, 0); },
  getDeliveryFee()  { return this.getCartSubtotal() >= 50 ? 0 : 5; },
  getCartTotal()    { return this.getCartSubtotal() + this.getDeliveryFee(); },
  getCartItemCount(){ return this.cart.reduce((s, i) => s + i.qty, 0); },

  login(name, email) {
    this.user = { name, email, loginTime: new Date().toISOString() };
    this.saveUser();
  },
  logout() {
    this.user = null;
    this.saveUser();
  },

  addOrder(order) {
    this.orders.unshift(order);
    this.saveOrders();
  },

  clearCart() {
    this.cart = [];
    this.saveCart();
  }
};

// =====================
// SANITIZE HELPER
// =====================
const Sanitize = {
  /** Escape HTML special chars to prevent XSS from API data */
  html(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str ?? "")));
    return div.innerHTML;
  },
  /** Strip dangerous chars from user input used in DOM */
  text(str) {
    return String(str ?? "").replace(/[<>'"]/g, "").trim();
  }
};

// =====================
// UTILITY FUNCTIONS
// =====================
const Utils = {
  _debounceTimers: {},
  debounce(func, delay) {
    let timerId;
    return function (...args) {
      clearTimeout(timerId);
      timerId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  showToast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const colorMap = {
      error:   "bg-red-600 text-white",
      success: "bg-green-600 text-white",
      warning: "bg-amber-500 text-white",
      info:    "bg-blue-600 text-white"
    };
    const iconMap = {
      error:   "fa-circle-xmark",
      success: "fa-circle-check",
      warning: "fa-triangle-exclamation",
      info:    "fa-circle-info"
    };

    const toast = document.createElement("div");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg pointer-events-auto text-sm font-medium ${colorMap[type] ?? colorMap.info}`;
    toast.innerHTML = `<i class="fa-solid ${iconMap[type] ?? iconMap.info}" aria-hidden="true"></i><span>${Sanitize.html(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(16px)";
      toast.style.transition = "opacity .25s, transform .25s";
      setTimeout(() => toast.remove(), 280);
    }, duration);
  },

  shortTitle(title, max = 50) {
    if (!title) return "";
    return title.length <= max ? title : title.slice(0, max) + "…";
  },

  formatDate(dateString) {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch { return dateString; }
  },

  formatCurrency(num) {
    return "$" + (Number(num) || 0).toFixed(2);
  }
};

// =====================
// VALIDATION
// =====================
const Validate = {
  email(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()); },
  phone(v)  { return /^[\d\s\+\-\(\)]{6,20}$/.test(String(v).trim()); },
  name(v)   { return String(v).trim().length >= 2; },
  address(v){ return String(v).trim().length >= 5; }
};

// =====================
// DOM SELECTORS (lazy, cached)
// =====================
const _domCache = {};
const DOM = new Proxy({}, {
  get(_, key) {
    if (!(key in _domCache)) _domCache[key] = document.getElementById(key.replace(/([A-Z])/g, m => m)) ?? null;
    return _domCache[key];
  }
});

// Explicit lookups for elements referenced frequently
const $id = id => document.getElementById(id);

// =====================
// UI RENDERERS
// =====================
const Renderers = {
  createProductCard(product) {
    const inWishlist = State.isInWishlist(product.id);
    const title = Sanitize.html(Utils.shortTitle(product.title));
    const category = Sanitize.html(product.category);
    const image = Sanitize.html(product.image);
    const altText = Sanitize.html(product.title);
    const price = Utils.formatCurrency(product.price);
    const ratingRate = Number(product.rating?.rate ?? 0).toFixed(1);
    const ratingCount = Number(product.rating?.count ?? 0).toLocaleString();

    return `
      <article class="product-card" role="listitem">
        <!-- Wishlist btn -->
        <button
          class="wishlist-btn"
          data-wishlist-id="${product.id}"
          aria-label="${inWishlist ? "Remove from wishlist" : "Add to wishlist"}"
          title="${inWishlist ? "Remove from wishlist" : "Add to wishlist"}">
          <i class="fa-solid fa-heart text-sm ${inWishlist ? "text-red-500" : "text-gray-300"}" aria-hidden="true"></i>
        </button>

        <!-- Image -->
        <div class="card-img-wrap">
          <img src="${image}" alt="${altText}" loading="lazy" />
        </div>

        <!-- Body -->
        <div class="card-body">
          <div class="flex items-center justify-between mb-2">
            <span class="cat-badge">${category}</span>
            <span class="text-xs text-gray-400 flex items-center gap-1">
              <i class="fa-solid fa-star rating-stars" aria-hidden="true"></i>
              <span>${ratingRate}</span>
              <span class="text-gray-300">(${ratingCount})</span>
            </span>
          </div>

          <h3 class="text-sm font-semibold leading-snug min-h-[40px] text-gray-800">${title}</h3>

          <p class="text-xl font-bold price-text mt-2">${price}</p>

          <div class="flex gap-2 mt-4">
            <button
              class="btn btn-outline-brand btn-sm flex-1 text-xs rounded-lg"
              data-details-id="${product.id}"
              aria-label="View details for ${altText}">
              <i class="fa-solid fa-circle-info" aria-hidden="true"></i> Details
            </button>
            <button
              class="btn btn-brand btn-sm flex-1 text-xs rounded-lg"
              data-add-to-cart="${product.id}"
              aria-label="Add ${altText} to cart">
              <i class="fa-solid fa-cart-plus" aria-hidden="true"></i> Add
            </button>
          </div>
        </div>
      </article>
    `;
  },

  renderProducts(products) {
    const grid = $id("productsGrid");
    const skeleton = $id("skeletonLoader");
    const noState = $id("noProductsState");
    const countText = $id("countText");

    if (skeleton) skeleton.style.display = "none";

    if (!products.length) {
      if (grid) grid.innerHTML = "";
      noState?.classList.remove("hidden");
      if (countText) countText.textContent = "0 items found";
      return;
    }

    noState?.classList.add("hidden");
    if (grid) grid.innerHTML = products.map(p => this.createProductCard(p)).join("");
    if (countText) countText.textContent = `${products.length} item${products.length !== 1 ? "s" : ""} found`;
  },

  renderCartDropdown() {
    const itemCount = State.getCartItemCount();
    const subtotal  = State.getCartSubtotal();
    const delivery  = State.getDeliveryFee();

    const cartCount   = $id("cartCount");
    const cartItems   = $id("cartItemsText");
    const cartSub     = $id("cartSubtotalText");
    const cartDel     = $id("cartDeliveryText");
    const cartList    = $id("cartList");
    const wishlistCnt = $id("wishlistCount");

    if (cartCount)   cartCount.textContent   = itemCount;
    if (cartItems)   cartItems.textContent   = `${itemCount} Item${itemCount !== 1 ? "s" : ""}`;
    if (cartSub)     cartSub.textContent     = Utils.formatCurrency(subtotal);
    if (cartDel)     cartDel.textContent     = `Delivery: ${Utils.formatCurrency(delivery)}`;
    if (wishlistCnt) {
      wishlistCnt.textContent = State.wishlist.length;
      wishlistCnt.classList.toggle("hidden", State.wishlist.length === 0);
    }

    if (!cartList) return;
    if (!State.cart.length) {
      cartList.innerHTML = `<p class="text-xs text-gray-400 text-center py-2">Cart is empty</p>`;
      return;
    }

    cartList.innerHTML = State.cart.map(item => `
      <div class="cart-mini-item">
        <img src="${Sanitize.html(item.image)}" class="w-9 h-9 object-contain bg-gray-100 rounded-lg flex-shrink-0" alt="${Sanitize.html(item.title)}" />
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate text-xs">${Sanitize.html(item.title.slice(0, 22))}…</p>
          <p class="text-xs text-gray-400">${Utils.formatCurrency(item.price)} × ${item.qty}</p>
        </div>
        <div class="flex items-center bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
          <button class="px-1.5 py-1 text-gray-500 hover:bg-gray-200 transition text-xs font-bold" data-cart-minus="${item.id}" aria-label="Decrease quantity">−</button>
          <span class="w-5 text-center text-xs font-semibold">${item.qty}</span>
          <button class="px-1.5 py-1 text-gray-500 hover:bg-gray-200 transition text-xs font-bold" data-cart-plus="${item.id}" aria-label="Increase quantity">+</button>
        </div>
      </div>
    `).join("");
  },

  renderCartModal() {
    const itemCount = State.getCartItemCount();
    const subtotal  = State.getCartSubtotal();
    const delivery  = State.getDeliveryFee();
    const total     = subtotal + delivery;

    const container   = $id("modalCartContainer");
    const emptyState  = $id("emptyCartModal");
    const cartList    = $id("modalCartList");
    const itemsCount  = $id("modalItemsCount");
    const subText     = $id("modalSubtotalText");
    const delText     = $id("modalDeliveryText");
    const totalText   = $id("modalTotalText");

    if (!State.cart.length) {
      container?.classList.add("hidden");
      emptyState?.classList.remove("hidden");
      return;
    }

    container?.classList.remove("hidden");
    emptyState?.classList.add("hidden");

    if (cartList) {
      cartList.innerHTML = State.cart.map(item => `
        <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-100 transition">
          <img src="${Sanitize.html(item.image)}" class="w-16 h-16 object-contain bg-white rounded-xl p-1.5 border border-gray-100 flex-shrink-0" alt="${Sanitize.html(item.title)}" />
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-sm leading-snug">${Sanitize.html(Utils.shortTitle(item.title, 40))}</h3>
            <p class="text-xs text-gray-400 mt-0.5 capitalize">${Sanitize.html(item.category)}</p>
            <p class="text-base font-bold text-blue-600 mt-1">${Utils.formatCurrency(item.price)}</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button class="w-7 h-7 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-sm transition" data-modal-qty-minus="${item.id}" aria-label="Decrease quantity">−</button>
            <span class="w-7 text-center text-sm font-bold">${item.qty}</span>
            <button class="w-7 h-7 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-sm transition" data-modal-qty-plus="${item.id}" aria-label="Increase quantity">+</button>
          </div>
          <button class="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition flex-shrink-0" data-modal-remove-id="${item.id}" aria-label="Remove ${Sanitize.html(item.title)} from cart">
            <i class="fa-solid fa-trash text-xs" aria-hidden="true"></i>
          </button>
        </div>
      `).join("");
    }

    if (itemsCount) itemsCount.textContent = itemCount;
    if (subText)    subText.textContent    = Utils.formatCurrency(subtotal);
    if (delText)    delText.textContent    = Utils.formatCurrency(delivery);
    if (totalText)  totalText.textContent  = Utils.formatCurrency(total);
  },

  renderWishlist() {
    const wishlistProducts = State.allProducts.filter(p => State.isInWishlist(p.id));
    const content    = $id("wishlistModalContent");
    const emptyState = $id("emptyWishlistState");

    if (!wishlistProducts.length) {
      if (content) content.innerHTML = "";
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");
    if (content) {
      content.innerHTML = wishlistProducts.map(product => `
        <article class="product-card">
          <div class="card-img-wrap" style="min-height:140px">
            <img class="h-28 w-full object-contain" src="${Sanitize.html(product.image)}" alt="${Sanitize.html(product.title)}" loading="lazy" />
          </div>
          <div class="card-body">
            <h3 class="text-sm font-semibold leading-snug">${Sanitize.html(Utils.shortTitle(product.title))}</h3>
            <p class="text-lg font-bold price-text mt-1">${Utils.formatCurrency(product.price)}</p>
            <div class="flex gap-2 mt-3">
              <button class="btn btn-outline-brand btn-sm flex-1 text-xs rounded-lg" data-details-id="${product.id}" id="wishlist-view-${product.id}">
                <i class="fa-solid fa-eye" aria-hidden="true"></i> View
              </button>
              <button class="btn btn-sm flex-1 text-xs rounded-lg bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition" data-wishlist-remove="${product.id}" aria-label="Remove from wishlist">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </article>
      `).join("");

      // Close wishlist modal when clicking view so details open cleanly
      content.querySelectorAll("[data-details-id]").forEach(btn => {
        btn.addEventListener("click", () => {
          $id("wishlistModal")?.close();
        });
      });
    }
  },

  renderOrders() {
    const content    = $id("ordersListContent");
    const emptyState = $id("emptyOrdersState");

    if (!State.orders.length) {
      if (content) content.innerHTML = "";
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");
    if (content) {
      content.innerHTML = State.orders.map(order => {
        const statusColor = order.status === "PLACED" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
        const itemNames = order.items.slice(0, 2).map(i => Sanitize.html(Utils.shortTitle(i.title, 20))).join(", ");
        const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : "";
        return `
          <div class="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-blue-100 transition">
            <div class="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-gray-200">
              <div>
                <p class="font-bold text-sm font-mono">${Sanitize.html(order.id)}</p>
                <p class="text-xs text-gray-400 mt-0.5">${Utils.formatDate(order.createdAt)}</p>
              </div>
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}">${Sanitize.html(order.status)}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              ${[
                ["Items", order.itemsCount],
                ["Subtotal", Utils.formatCurrency(order.subtotal)],
                ["Delivery", Utils.formatCurrency(order.deliveryFee)],
                ["Total", Utils.formatCurrency(order.total)]
              ].map(([label, val]) => `
                <div>
                  <p class="text-[11px] text-gray-400 uppercase tracking-wide">${label}</p>
                  <p class="font-bold text-sm mt-0.5">${Sanitize.html(String(val))}</p>
                </div>
              `).join("")}
            </div>
            <div class="bg-white rounded-xl p-3 border border-gray-100 text-xs text-gray-500">
              <span class="font-medium text-gray-700">${Sanitize.html(order.customer.name)}</span> · ${Sanitize.html(itemNames)}${Sanitize.html(moreItems)}
            </div>
          </div>
        `;
      }).join("");
    }
  },

  updateUserMenu() {
    const wishlistCount = $id("wishlistCount");
    const loginLink     = $id("loginLink");
    const logoutLink    = $id("logoutLink");
    const userMenuBtn   = $id("userMenuBtn");

    if (wishlistCount) {
      wishlistCount.textContent = State.wishlist.length;
      wishlistCount.classList.toggle("hidden", State.wishlist.length === 0);
    }

    if (State.user) {
      loginLink?.classList.add("hidden");
      logoutLink?.classList.remove("hidden");
      if (userMenuBtn) {
        userMenuBtn.innerHTML = `<i class="fa-solid fa-circle-user text-blue-600 text-base" aria-hidden="true"></i>`;
        userMenuBtn.title = State.user.name;
        userMenuBtn.setAttribute("aria-label", `User menu - ${Sanitize.html(State.user.name)}`);
      }
    } else {
      loginLink?.classList.remove("hidden");
      logoutLink?.classList.add("hidden");
      if (userMenuBtn) {
        userMenuBtn.innerHTML = `<i class="fa-solid fa-user text-base" aria-hidden="true"></i>`;
        userMenuBtn.title = "Login";
        userMenuBtn.setAttribute("aria-label", "User menu");
      }
    }
  },

  updateCheckoutSummary() {
    const itemCount = State.getCartItemCount();
    const subtotal  = State.getCartSubtotal();
    const delivery  = State.getDeliveryFee();
    const total     = subtotal + delivery;

    const el = (id, val) => { const e = $id(id); if (e) e.textContent = val; };
    el("checkoutItemsText", itemCount);
    el("checkoutSubtotalText", Utils.formatCurrency(subtotal));
    el("checkoutDeliveryText", Utils.formatCurrency(delivery));
    el("checkoutTotalText", Utils.formatCurrency(total));
  }
};

// =====================
// EVENT HANDLERS
// =====================
const Handlers = {
  setupCartEvents() {
    // Delegated cart quantity/remove
    document.addEventListener("click", e => {
      // Mini dropdown cart
      const cartPlus = e.target.closest("[data-cart-plus]");
      if (cartPlus) {
        const id = Number(cartPlus.dataset.cartPlus);
        const item = State.cart.find(i => i.id === id);
        if (item) { State.updateCartQty(id, item.qty + 1); Renderers.renderCartDropdown(); Renderers.renderCartModal(); }
        return;
      }

      const cartMinus = e.target.closest("[data-cart-minus]");
      if (cartMinus) {
        const id = Number(cartMinus.dataset.cartMinus);
        const item = State.cart.find(i => i.id === id);
        if (item) { State.updateCartQty(id, item.qty - 1); Renderers.renderCartDropdown(); Renderers.renderCartModal(); }
        return;
      }

      // Modal cart
      const mqPlus = e.target.closest("[data-modal-qty-plus]");
      if (mqPlus) {
        const id = Number(mqPlus.dataset.modalQtyPlus);
        const item = State.cart.find(i => i.id === id);
        if (item) { State.updateCartQty(id, item.qty + 1); Renderers.renderCartDropdown(); Renderers.renderCartModal(); }
        return;
      }

      const mqMinus = e.target.closest("[data-modal-qty-minus]");
      if (mqMinus) {
        const id = Number(mqMinus.dataset.modalQtyMinus);
        const item = State.cart.find(i => i.id === id);
        if (item) { State.updateCartQty(id, item.qty - 1); Renderers.renderCartDropdown(); Renderers.renderCartModal(); }
        return;
      }

      const removeBtn = e.target.closest("[data-modal-remove-id]");
      if (removeBtn) {
        const id = Number(removeBtn.dataset.modalRemoveId);
        State.removeFromCart(id);
        Utils.showToast("Item removed from cart", "info");
        Renderers.renderCartDropdown();
        Renderers.renderCartModal();
      }
    });

    $id("viewCartBtn")?.addEventListener("click", () => {
      $id("cartModal")?.showModal();
    });

    $id("modalClearCartBtn")?.addEventListener("click", () => {
      if (confirm("Clear your entire cart?")) {
        State.clearCart();
        Utils.showToast("Cart cleared", "success");
        Renderers.renderCartDropdown();
        Renderers.renderCartModal();
      }
    });

    // Modal close buttons
    $id("closeCartModal")?.addEventListener("click",     () => $id("cartModal")?.close());
    $id("closeCheckoutModal")?.addEventListener("click", () => $id("checkoutModal")?.close());
    $id("closeWishlistModal")?.addEventListener("click", () => $id("wishlistModal")?.close());
    $id("closeLoginModal")?.addEventListener("click",    () => $id("loginModal")?.close());
    $id("closeOrdersModal")?.addEventListener("click",   () => $id("ordersModal")?.close());

    // "Continue shopping" shortcut buttons
    $id("cartContinueBtn")?.addEventListener("click",      () => $id("cartModal")?.close());
    $id("wishlistContinueBtn")?.addEventListener("click",  () => $id("wishlistModal")?.close());
    $id("ordersContinueBtn")?.addEventListener("click",    () => $id("ordersModal")?.close());
    $id("cancelOrderBtn")?.addEventListener("click",       () => $id("checkoutModal")?.close());
    $id("cancelLoginBtn")?.addEventListener("click",       () => $id("loginModal")?.close());

    // ESC on non-dialog product detail modal
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        const backdrop = $id("modalBackdrop");
        if (backdrop && !backdrop.classList.contains("hidden")) {
          backdrop.classList.add("hidden");
          backdrop.classList.remove("flex");
        }
      }
    });
  },

  setupProductEvents() {
    document.addEventListener("click", e => {
      const detailsBtn = e.target.closest("[data-details-id]");
      if (detailsBtn) {
        const id = Number(detailsBtn.dataset.detailsId);
        Handlers.openProductDetails(id);
        return;
      }

      const addBtn = e.target.closest("[data-add-to-cart]");
      if (addBtn) {
        const id = Number(addBtn.dataset.addToCart);
        const product = State.allProducts.find(p => p.id === id);
        if (product) {
          State.addToCart(product, 1);
          Utils.showToast(`${Utils.shortTitle(product.title, 30)} added to cart`, "success");
          Renderers.renderCartDropdown();
          Renderers.renderCartModal();
        }
        return;
      }

      const wishlistBtn = e.target.closest("[data-wishlist-id]");
      if (wishlistBtn) {
        const id = Number(wishlistBtn.dataset.wishlistId);
        State.toggleWishlist(id);
        const inWishlist = State.isInWishlist(id);
        const icon = wishlistBtn.querySelector("i");
        if (icon) {
          icon.classList.toggle("text-red-500", inWishlist);
          icon.classList.toggle("text-gray-300", !inWishlist);
        }
        wishlistBtn.setAttribute("aria-label", inWishlist ? "Remove from wishlist" : "Add to wishlist");
        Utils.showToast(inWishlist ? "Added to wishlist ♡" : "Removed from wishlist", inWishlist ? "success" : "info");
        Renderers.updateUserMenu();
        return;
      }

      const removeWishlist = e.target.closest("[data-wishlist-remove]");
      if (removeWishlist) {
        const id = Number(removeWishlist.dataset.wishlistRemove);
        State.toggleWishlist(id);
        Renderers.renderWishlist();
        Renderers.updateUserMenu();
        Utils.showToast("Removed from wishlist", "info");
      }
    });
  },

  openProductDetails(id) {
    const product = State.allProducts.find(p => p.id === id);
    if (!product) return;

    let qtyValue = 1;
    const inWishlist = State.isInWishlist(product.id);
    const modalBody = $id("modalBody");
    if (!modalBody) return;

    const title   = Sanitize.html(product.title);
    const cat     = Sanitize.html(product.category);
    const desc    = Sanitize.html(product.description);
    const img     = Sanitize.html(product.image);
    const price   = Utils.formatCurrency(product.price);
    const rate    = Number(product.rating?.rate ?? 0).toFixed(1);
    const count   = Number(product.rating?.count ?? 0).toLocaleString();

    modalBody.innerHTML = `
      <div class="grid sm:grid-cols-2 gap-6">
        <div class="bg-gray-50 rounded-2xl p-6 flex justify-center items-center border border-gray-100">
          <img class="h-52 object-contain" src="${img}" alt="${title}" />
        </div>
        <div class="flex flex-col">
          <span class="cat-badge self-start mb-3">${cat}</span>
          <h2 class="text-xl font-bold brand-font leading-snug">${title}</h2>
          <p class="mt-3 text-gray-500 text-sm leading-relaxed flex-1">${desc}</p>
          <p class="text-3xl font-extrabold price-text mt-4">${price}</p>
          <p class="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
            <i class="fa-solid fa-star text-yellow-400" aria-hidden="true"></i>
            ${rate} / 5 · ${count} reviews
          </p>
          <div class="mt-5 flex items-center gap-3">
            <span class="font-semibold text-sm">Qty:</span>
            <div class="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <button class="qty-decrease px-3 py-2 hover:bg-gray-100 transition text-sm font-bold" aria-label="Decrease quantity">−</button>
              <input type="number" class="qty-input w-12 text-center bg-transparent text-sm font-semibold border-x border-gray-200 py-2 focus:outline-none" value="1" min="1" max="999" aria-label="Quantity" />
              <button class="qty-increase px-3 py-2 hover:bg-gray-100 transition text-sm font-bold" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <div class="flex gap-2 mt-5">
            <button class="btn btn-brand flex-1 add-to-cart-btn rounded-xl">
              <i class="fa-solid fa-cart-plus mr-1.5" aria-hidden="true"></i> Add to Cart
            </button>
            <button class="wishlist-detail-btn w-12 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition" aria-label="${inWishlist ? "Remove from wishlist" : "Add to wishlist"}" title="Wishlist">
              <i class="fa-solid fa-heart ${inWishlist ? "text-red-500" : "text-gray-300"}" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    const qtyInput         = modalBody.querySelector(".qty-input");
    const qtyIncrease      = modalBody.querySelector(".qty-increase");
    const qtyDecrease      = modalBody.querySelector(".qty-decrease");
    const addBtn           = modalBody.querySelector(".add-to-cart-btn");
    const wishlistDetailBtn= modalBody.querySelector(".wishlist-detail-btn");
    const backdrop         = $id("modalBackdrop");

    qtyIncrease.addEventListener("click", () => {
      qtyValue = Math.min(999, qtyValue + 1);
      qtyInput.value = qtyValue;
    });
    qtyDecrease.addEventListener("click", () => {
      qtyValue = Math.max(1, qtyValue - 1);
      qtyInput.value = qtyValue;
    });
    qtyInput.addEventListener("change", () => {
      qtyValue = Math.max(1, Math.min(999, parseInt(qtyInput.value) || 1));
      qtyInput.value = qtyValue;
    });

    addBtn.addEventListener("click", () => {
      State.addToCart(product, qtyValue);
      Utils.showToast(`${qtyValue}× ${Utils.shortTitle(product.title, 25)} added`, "success");
      Renderers.renderCartDropdown();
      Renderers.renderCartModal();
      backdrop.classList.add("hidden");
      backdrop.classList.remove("flex");
    });

    wishlistDetailBtn.addEventListener("click", () => {
      State.toggleWishlist(product.id);
      const inWl = State.isInWishlist(product.id);
      const icon = wishlistDetailBtn.querySelector("i");
      icon.classList.toggle("text-red-500", inWl);
      icon.classList.toggle("text-gray-300", !inWl);
      wishlistDetailBtn.setAttribute("aria-label", inWl ? "Remove from wishlist" : "Add to wishlist");
      Utils.showToast(inWl ? "Added to wishlist ♡" : "Removed from wishlist", "success");
      Renderers.updateUserMenu();
    });

    backdrop.classList.remove("hidden");
    backdrop.classList.add("flex");

    // Focus trap / close on backdrop click
    backdrop.addEventListener("click", function handler(e) {
      if (e.target === backdrop) {
        backdrop.classList.add("hidden");
        backdrop.classList.remove("flex");
        backdrop.removeEventListener("click", handler);
      }
    });
  },

  setupSearchAndSort() {
    const searchInput  = $id("searchInput");
    const sortDropdown = $id("sortDropdown");

    if (searchInput) {
      const debouncedSearch = Utils.debounce(() => {
        State.searchQuery = searchInput.value.toLowerCase().trim();
        Handlers.filterProducts();
      }, 280);
      searchInput.addEventListener("input", debouncedSearch);
    }

    if (sortDropdown) {
      sortDropdown.addEventListener("change", () => {
        State.sortBy = sortDropdown.value;
        Handlers.filterProducts();
      });
    }

    $id("clearSearchBtn")?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      State.searchQuery = "";
      Handlers.filterProducts();
    });
  },

  filterProducts() {
    let results = [...State.allProducts];

    if (State.searchQuery) {
      results = results.filter(p =>
        p.title.toLowerCase().includes(State.searchQuery) ||
        p.category.toLowerCase().includes(State.searchQuery)
      );
    }

    switch (State.sortBy) {
      case "price-low":  results.sort((a, b) => a.price - b.price); break;
      case "price-high": results.sort((a, b) => b.price - a.price); break;
      case "rating":     results.sort((a, b) => b.rating.rate - a.rating.rate); break;
    }

    // If a category is active, apply it too
    if (State._activeCategory && State._activeCategory !== "all") {
      results = results.filter(p => p.category === State._activeCategory);
    }

    State.filteredProducts = results;
    Renderers.renderProducts(results);
  },

  setupWishlistButton() {
    $id("wishlistBtn")?.addEventListener("click", () => {
      Renderers.renderWishlist();
      $id("wishlistModal")?.showModal();
    });
  },

  setupCheckout() {
    $id("checkoutBtn")?.addEventListener("click", () => {
      if (!State.cart.length) {
        Utils.showToast("Your cart is empty", "warning");
        return;
      }
      if (!State.user) {
        $id("cartModal")?.close();
        $id("loginModal")?.showModal();
        Utils.showToast("Please sign in to checkout", "info");
        return;
      }
      if (State.user) {
        const nameEl  = $id("checkoutName");
        const emailEl = $id("checkoutEmail");
        if (nameEl)  nameEl.value  = Sanitize.text(State.user.name);
        if (emailEl) emailEl.value = Sanitize.text(State.user.email);
      }
      Renderers.updateCheckoutSummary();
      $id("cartModal")?.close();
      $id("checkoutModal")?.showModal();
    });

    $id("confirmOrderBtn")?.addEventListener("click", () => {
      Handlers.processCheckout();
    });
  },

  processCheckout() {
    const name    = Sanitize.text($id("checkoutName")?.value ?? "");
    const email   = ($id("checkoutEmail")?.value ?? "").trim();
    const phone   = ($id("checkoutPhone")?.value ?? "").trim();
    const address = Sanitize.text($id("checkoutAddress")?.value ?? "");
    const payment = document.querySelector("input[name='paymentMethod']:checked")?.value ?? "";

    // Validation
    if (!Validate.name(name)) {
      Handlers.showCheckoutMessage("Please enter a valid full name (at least 2 characters).", "error"); return;
    }
    if (!Validate.email(email)) {
      Handlers.showCheckoutMessage("Please enter a valid email address.", "error"); return;
    }
    if (!Validate.phone(phone)) {
      Handlers.showCheckoutMessage("Please enter a valid phone number.", "error"); return;
    }
    if (!Validate.address(address)) {
      Handlers.showCheckoutMessage("Please enter a complete delivery address.", "error"); return;
    }
    if (!payment) {
      Handlers.showCheckoutMessage("Please select a payment method.", "error"); return;
    }

    const subtotal = State.getCartSubtotal();
    const delivery = State.getDeliveryFee();
    const total    = subtotal + delivery;

    const order = {
      id:        "SC-" + Date.now(),
      createdAt: new Date().toISOString(),
      items:     State.cart.map(item => ({
        id: item.id, title: item.title, price: item.price, qty: item.qty, category: item.category
      })),
      itemsCount:  State.getCartItemCount(),
      subtotal,
      deliveryFee: delivery,
      total,
      customer:  { name, email, phone, address },
      paymentMethod: payment,
      status: "PLACED"
    };

    State.addOrder(order);
    State.clearCart();
    Renderers.renderCartDropdown();
    Handlers.showCheckoutMessage(`✓ Order placed! ID: ${Sanitize.html(order.id)}`, "success");

    setTimeout(() => {
      $id("checkoutModal")?.close();
      $id("checkoutForm")?.reset();
      $id("checkoutMessage")?.classList.add("hidden");
      Utils.showToast("Order placed successfully! 🎉", "success");
    }, 1600);
  },

  showCheckoutMessage(message, type = "info") {
    const el = $id("checkoutMessage");
    if (!el) return;
    const colorMap = {
      error:   "bg-red-50 text-red-700 border border-red-200",
      success: "bg-green-50 text-green-700 border border-green-200",
      info:    "bg-blue-50 text-blue-700 border border-blue-200"
    };
    el.innerHTML = `<div class="rounded-xl px-4 py-3 text-sm font-medium ${colorMap[type] ?? colorMap.info}">${Sanitize.html(message)}</div>`;
    el.classList.remove("hidden");
  },

  setupAuth() {
    $id("loginLink")?.addEventListener("click", e => {
      e.preventDefault();
      $id("loginModal")?.showModal();
    });

    $id("logoutLink")?.addEventListener("click", e => {
      e.preventDefault();
      State.logout();
      Renderers.updateUserMenu();
      Utils.showToast("Logged out. See you soon!", "success");
    });

    $id("ordersLink")?.addEventListener("click", e => {
      e.preventDefault();
      if (!State.user) {
        Utils.showToast("Please sign in to view orders", "warning");
        $id("loginModal")?.showModal();
        return;
      }
      Renderers.renderOrders();
      $id("ordersModal")?.showModal();
    });

    $id("loginForm")?.addEventListener("submit", e => {
      e.preventDefault();
      const name  = Sanitize.text($id("loginName")?.value ?? "");
      const email = ($id("loginEmail")?.value ?? "").trim();

      const nameErr  = $id("loginNameError");
      const emailErr = $id("loginEmailError");

      let valid = true;
      if (!Validate.name(name)) {
        nameErr?.classList.remove("hidden"); valid = false;
      } else { nameErr?.classList.add("hidden"); }

      if (!Validate.email(email)) {
        emailErr?.classList.remove("hidden"); valid = false;
      } else { emailErr?.classList.add("hidden"); }

      if (!valid) return;

      State.login(name, email);
      Renderers.updateUserMenu();
      $id("loginForm")?.reset();
      $id("loginModal")?.close();
      Utils.showToast(`Welcome, ${Sanitize.html(name)}! 👋`, "success");
    });

    // Newsletter
    $id("newsletterForm")?.addEventListener("submit", e => {
      e.preventDefault();
      const emailVal = ($id("newsletterEmail")?.value ?? "").trim();
      if (!Validate.email(emailVal)) {
        Utils.showToast("Please enter a valid email address", "warning"); return;
      }
      Utils.showToast("Thanks for subscribing! 🎉", "success");
      $id("newsletterForm")?.reset();
    });
  },

  setupNavbar() {
    const navLinks       = $id("navLinks");
    const mobileNavLinks = $id("mobileNavLinks");

    const setActiveNav = label => {
      [navLinks, mobileNavLinks].forEach(nav => {
        nav?.querySelectorAll("a").forEach(link => {
          const isActive = link.textContent.trim() === label;
          link.classList.toggle("active", isActive);
        });
      });
    };

    window.scrollToSection = id => {
      $id(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleNavClick = (e, link, isMobile = false) => {
      e.preventDefault();
      const text    = link.textContent.trim();
      const hrefId  = link.getAttribute("href")?.replace("#", "") ?? "";
      setActiveNav(text);
      if (hrefId) {
        $id(hrefId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (isMobile) {
        // Close DaisyUI dropdown by blurring
        document.activeElement?.blur();
      }
    };

    navLinks?.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", e => handleNavClick(e, link, false));
    });
    mobileNavLinks?.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", e => handleNavClick(e, link, true));
    });

    setActiveNav("Home");

    // Hero buttons (no inline onclick)
    $id("heroShopBtn")?.addEventListener("click", () => {
      $id("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveNav("Products");
    });
    $id("heroAboutBtn")?.addEventListener("click", () => {
      $id("about")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveNav("About");
    });
  },

  setupModalClose() {
    const backdrop = $id("modalBackdrop");
    const closeBtn = $id("modalClose");
    closeBtn?.addEventListener("click", () => {
      backdrop?.classList.add("hidden");
      backdrop?.classList.remove("flex");
    });
  },

  renderCategories(categories) {
    const container = $id("categoryButtons");
    if (!container) return;

    container.innerHTML = `
      <button type="button" class="cat-pill active" data-cat="all" role="listitem" aria-pressed="true">All</button>
      ${categories.map(cat => `
        <button type="button" class="cat-pill" data-cat="${Sanitize.html(cat)}" role="listitem" aria-pressed="false">
          ${Sanitize.html(cat)}
        </button>
      `).join("")}
    `;

    container.addEventListener("click", e => {
      const btn = e.target.closest("button[data-cat]");
      if (!btn) return;
      const category = btn.dataset.cat;
      Handlers.filterByCategory(category);
      Handlers.setActiveCategory(category);
    });
  },

  filterByCategory(category) {
    State._activeCategory = category;
    if (category === "all") {
      State.filteredProducts = [...State.allProducts];
      const sortEl = $id("sortDropdown");
      if (sortEl) sortEl.value = "default";
      State.sortBy = "default";
    }
    Handlers.filterProducts();
    const productsTitle = $id("productsTitle");
    if (productsTitle) {
      productsTitle.textContent = category === "all" ? "All Products" : category.charAt(0).toUpperCase() + category.slice(1);
    }
  },

  setActiveCategory(activeCat) {
    const container = $id("categoryButtons");
    container?.querySelectorAll("button[data-cat]").forEach(btn => {
      const isActive = btn.dataset.cat === activeCat;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  },

  renderTrending() {
    const trendingGrid = $id("trendingGrid");
    if (!trendingGrid) return;
    const sorted = [...State.allProducts]
      .sort((a, b) => b.rating.rate - a.rating.rate)
      .slice(0, 3);
    trendingGrid.innerHTML = sorted.map(p => Renderers.createProductCard(p)).join("");
  }
};

// =====================
// LOADERS
// =====================
const Loaders = {
  async loadAllProducts() {
    try {
      State.isLoading = true;
      const skeletonEl = $id("skeletonLoader");
      if (skeletonEl) skeletonEl.style.display = "grid";
      const res  = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      State.allProducts    = data;
      State.filteredProducts = data;
      Renderers.renderProducts(data);
      Handlers.renderTrending();
      return data;
    } catch (err) {
      console.error("Error loading products:", err);
      Utils.showToast("Failed to load products. Please refresh.", "error");
      const skeletonEl = $id("skeletonLoader");
      if (skeletonEl) skeletonEl.style.display = "none";
      return [];
    } finally {
      State.isLoading = false;
    }
  },

  async loadCategories() {
    try {
      const res        = await fetch(`${API_BASE}/products/categories`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const categories = await res.json();
      Handlers.renderCategories(categories);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  }
};

// =====================
// INITIALIZATION
// =====================
async function init() {
  State.init();
  Renderers.updateUserMenu();
  Renderers.renderCartDropdown();

  await Loaders.loadAllProducts();
  await Loaders.loadCategories();

  Handlers.setupNavbar();
  Handlers.setupCartEvents();
  Handlers.setupProductEvents();
  Handlers.setupSearchAndSort();
  Handlers.setupWishlistButton();
  Handlers.setupCheckout();
  Handlers.setupAuth();
  Handlers.setupModalClose();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
