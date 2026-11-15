const Rokori = {
  token: localStorage.getItem('rokori_token') || null,
  user: JSON.parse(localStorage.getItem('rokori_user') || 'null'),
  socket: null,

  async api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token && user) {
      localStorage.setItem('rokori_token', token);
      localStorage.setItem('rokori_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('rokori_token');
      localStorage.removeItem('rokori_user');
    }
  },

  logout() {
    this.setSession(null, null);
    window.location.href = '/index.html';
  },

  toast(message, type = 'success') {
    let container = document.getElementById('rokori-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rokori-toast-container';
      container.className = 'fixed top-16 right-5 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `${type === 'error' ? 'bg-red-600' : 'bg-[#00B06F]'} text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-xl transition-all duration-300`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
  },

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  renderSvgIcon(iconKey) {
    const icons = {
      dominus: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><path d="M12 28L32 12L52 28V44C52 50 32 54 32 54C32 54 12 50 12 44V28Z" fill="#0284C7" stroke="#38BDF8" stroke-width="3"/><path d="M22 28L32 18L42 28V38C42 43 32 46 32 46C32 46 22 43 22 38V28Z" fill="#38BDF8"/><circle cx="32" cy="32" r="5" fill="#FFFFFF"/></svg>`,
      valkyrie: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><path d="M8 20L24 16L32 26L40 16L56 20C56 36 44 48 32 50C20 48 8 36 8 20Z" fill="#94A3B8" stroke="#CBD5E1" stroke-width="2"/><path d="M4 14C12 12 22 18 24 24L16 28L4 14Z" fill="#E2E8F0"/><path d="M60 14C52 12 42 18 40 24L48 28L60 14Z" fill="#E2E8F0"/></svg>`,
      headphones: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><path d="M16 34V24C16 15.163 23.163 8 32 8C40.837 8 48 15.163 48 24V34" fill="none" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/><rect x="12" y="30" width="8" height="16" rx="4" fill="#D97706"/><rect x="44" y="30" width="8" height="16" rx="4" fill="#D97706"/></svg>`,
      horns: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><path d="M20 42C12 36 10 24 14 16C18 24 24 32 30 38L20 42Z" fill="#1E293B" stroke="#475569" stroke-width="2"/><path d="M44 42C52 36 54 24 50 16C46 24 40 32 34 38L44 42Z" fill="#1E293B" stroke="#475569" stroke-width="2"/><circle cx="32" cy="36" r="8" fill="#0F172A" stroke="#334155" stroke-width="2"/></svg>`,
      fedora: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><ellipse cx="32" cy="42" rx="26" ry="8" fill="#334155" stroke="#64748B" stroke-width="2"/><path d="M18 38C18 24 22 16 32 16C42 16 46 24 46 38H18Z" fill="#1E293B"/><rect x="18" y="34" width="28" height="5" fill="#EAB308"/></svg>`,
      face_epic: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><circle cx="32" cy="32" r="26" fill="#FACC15" stroke="#CA8A04" stroke-width="3"/><path d="M20 24L28 28M44 24L36 28" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/><path d="M20 40C24 46 40 46 44 40" fill="none" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/></svg>`,
      face_stitch: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><circle cx="32" cy="32" r="26" fill="#94A3B8" stroke="#64748B" stroke-width="3"/><circle cx="22" cy="26" r="4" fill="#1E293B"/><circle cx="42" cy="26" r="4" fill="#1E293B"/><path d="M22 42H42M28 38V46M36 38V46" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/></svg>`,
      coil: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><ellipse cx="32" cy="20" rx="16" ry="6" fill="none" stroke="#38BDF8" stroke-width="5"/><ellipse cx="32" cy="32" rx="16" ry="6" fill="none" stroke="#0EA5E9" stroke-width="5"/><ellipse cx="32" cy="44" rx="16" ry="6" fill="none" stroke="#0284C7" stroke-width="5"/></svg>`,
      sword: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><path d="M14 50L50 14" stroke="#94A3B8" stroke-width="6" stroke-linecap="round"/><path d="M12 52L20 44" stroke="#D97706" stroke-width="6" stroke-linecap="round"/><rect x="38" y="8" width="6" height="6" transform="rotate(45 41 11)" fill="#38BDF8"/></svg>`,
      visor: `<svg viewBox="0 0 64 64" class="w-16 h-16 drop-shadow-lg"><path d="M14 28C14 24 20 20 32 20C44 20 50 24 50 28V36C50 40 44 42 32 42C20 42 14 40 14 36V28Z" fill="#3B82F6" stroke="#60A5FA" stroke-width="3"/></svg>`
    };
    return icons[iconKey] || icons['fedora'];
  },

  initSocket() {
    if (typeof io === 'undefined') return;
    this.socket = io({ auth: { token: this.token } });

    this.socket.on('global_announcement', (ann) => {
      let b = document.getElementById('global-announcement-banner');
      if (!ann || !ann.message) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement('div');
        b.id = 'global-announcement-banner';
        b.className = 'bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold px-4 py-2 text-center shadow-md z-50 relative';
        document.body.prepend(b);
      }
      b.innerHTML = `📢 ${this.escapeHtml(ann.author)}: ${this.escapeHtml(ann.message)}`;
    });

    this.socket.on('ruxbux_stipend', ({ amount }) => {
      if (!this.user) return;
      this.user.korbux += amount;
      this.setSession(this.token, this.user);
      const navBal = document.getElementById('nav-korbux-count');
      if (navBal) navBal.textContent = this.user.korbux.toLocaleString();
    });

    this.socket.on('new_trade_offer', ({ from }) => {
      this.toast(`🤝 New trade offer received from ${from}!`);
    });
  },

  async initShell(activePage = 'marketplace') {
    if (this.token) {
      try {
        const res = await this.api('/api/auth/me');
        this.setSession(this.token, res.user);
        if (res.announcement) {
          const b = document.createElement('div');
          b.id = 'global-announcement-banner';
          b.className = 'bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold px-4 py-2 text-center shadow-md z-50 relative';
          b.innerHTML = `📢 ${this.escapeHtml(res.announcement.author)}: ${this.escapeHtml(res.announcement.message)}`;
          document.body.prepend(b);
        }
      } catch (_) { this.setSession(null, null); }
    }

    this.injectNavbar(activePage);
    this.injectSidebar(activePage);
    this.injectAuthModal();
    this.injectCurrencyModal();
    this.initSocket();
  },

  injectNavbar(activePage) {
    const header = document.getElementById('rokori-navbar');
    if (!header) return;
    const u = this.user;
    const isStaff = u && ['MODERATOR', 'ADMIN', 'OWNER'].includes(u.role);

    header.innerHTML = `
      <nav class="fixed top-0 left-0 right-0 h-14 bg-[#191B1D] border-b border-[#2B2D31] px-4 flex items-center justify-between z-40">
        <div class="flex items-center gap-4">
          <button id="sidebar-toggle-btn" class="p-2 rounded-lg hover:bg-[#2B2D31] text-white lg:hidden">☰</button>
          <a href="/index.html" class="flex items-center gap-2.5">
            <span class="rokori-logo-mark"></span>
            <span class="font-black text-xl tracking-tight">ROKORI</span>
          </a>
          <div class="hidden md:flex items-center gap-1 ml-3">
            <a href="/index.html" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${activePage === 'marketplace' ? 'bg-[#2B2D31] text-white' : 'text-[#BDBEBE] hover:text-white'}">Marketplace</a>
            <a href="/trade.html" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${activePage === 'trade' ? 'bg-[#2B2D31] text-white' : 'text-[#BDBEBE] hover:text-white'}">Trade Hub</a>
            <a href="/inventory.html" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${activePage === 'inventory' ? 'bg-[#2B2D31] text-white' : 'text-[#BDBEBE] hover:text-white'}">Inventory & Sell</a>
            <a href="/create.html" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${activePage === 'create' ? 'bg-[#2B2D31] text-white' : 'text-[#BDBEBE] hover:text-white'}">Create UGC</a>
          </div>
        </div>
        <div class="flex items-center gap-3">
          ${u ? `
            <button onclick="Rokori.openCurrencyModal()" class="flex items-center gap-1.5 bg-[#232527] border border-[#2B2D31] hover:border-[#00B06F] px-3.5 py-1.5 rounded-full text-sm font-bold transition">
              <span class="w-4 h-4 rounded-full bg-[#00B06F] text-[10px] flex items-center justify-center text-white">R</span>
              <span id="nav-korbux-count">${u.korbux.toLocaleString()}</span>
            </button>
            <span class="text-sm font-bold hidden sm:inline">${this.escapeHtml(u.username)}</span>
            ${isStaff ? `<a href="/admin.html" class="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold">🛡️ ${u.role}</a>` : ''}
            <button onclick="Rokori.logout()" class="text-xs text-[#BDBEBE] hover:text-white font-semibold px-2">Log Out</button>
          ` : `
            <button onclick="Rokori.openAuthModal('login')" class="px-3.5 py-1.5 bg-[#232527] rounded-lg text-sm font-semibold">Log In</button>
            <button onclick="Rokori.openAuthModal('register')" class="px-3.5 py-1.5 bg-[#00B06F] rounded-lg text-sm font-bold">Sign Up</button>
          `}
        </div>
      </nav>
    `;
    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
      document.getElementById('rokori-sidebar')?.classList.toggle('-translate-x-full');
    });
  },

  injectSidebar(activePage) {
    const aside = document.getElementById('rokori-sidebar');
    if (!aside) return;
    const u = this.user;
    const isStaff = u && ['MODERATOR', 'ADMIN', 'OWNER'].includes(u.role);
    const links = [
      { id: 'marketplace', label: 'UGC Marketplace', icon: '🛍️', href: '/index.html' },
      { id: 'trade', label: 'P2P Trade Hub', icon: '🤝', href: '/trade.html' },
      { id: 'inventory', label: 'Inventory & Sell', icon: '🎒', href: '/inventory.html' },
      { id: 'create', label: 'Create & Publish UGC', icon: '🛠️', href: '/create.html' }
    ];
    if (isStaff) links.push({ id: 'admin', label: 'Admin Panel', icon: '🛡️', href: '/admin.html' });

    aside.className = 'fixed top-14 left-0 bottom-0 w-56 bg-[#191B1D] border-r border-[#2B2D31] p-3 flex flex-col justify-between z-30 transition-transform -translate-x-full lg:translate-x-0';
    aside.innerHTML = `
      <div class="space-y-1">
        ${links.map(l => `
          <a href="${l.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activePage === l.id ? 'bg-[#2B2D31] text-white' : 'text-[#BDBEBE] hover:text-white hover:bg-[#2B2D31]'}">
            <span>${l.icon}</span><span>${l.label}</span>
          </a>
        `).join('')}
      </div>
      <div class="pt-3 border-t border-[#2B2D31] text-[11px] text-[#BDBEBE] px-2">
        <div class="font-bold text-white mb-0.5">Rokori Economy</div>
        <div>+1 Ruxbux every 10 mins</div>
      </div>
    `;
  },

  injectAuthModal() {
    if (document.getElementById('rokori-auth-modal')) return;
    const div = document.createElement('div');
    div.id = 'rokori-auth-modal';
    div.className = 'fixed inset-0 modal-backdrop hidden items-center justify-center z-50 p-4';
    div.innerHTML = `
      <div class="bg-[#232527] border border-[#2B2D31] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onclick="document.getElementById('rokori-auth-modal').classList.add('hidden')" class="absolute top-4 right-4 text-[#BDBEBE] font-bold">✕</button>
        <div class="flex items-center gap-2.5 mb-5"><span class="rokori-logo-mark"></span><h2 id="auth-modal-title" class="text-xl font-black">Log In</h2></div>
        <div class="flex gap-2 mb-5 bg-[#111216] p-1 rounded-xl">
          <button id="tab-login-btn" onclick="Rokori.openAuthModal('login')" class="flex-1 py-1.5 rounded-lg text-sm font-bold bg-[#2B2D31] text-white">Log In</button>
          <button id="tab-register-btn" onclick="Rokori.openAuthModal('register')" class="flex-1 py-1.5 rounded-lg text-sm font-bold text-[#BDBEBE]">Sign Up</button>
        </div>
        <form id="auth-modal-form" class="space-y-3.5">
          <div id="auth-username-group" class="hidden">
            <label class="block text-xs font-bold text-[#BDBEBE] uppercase mb-1">Username</label>
            <input id="auth-username" type="text" placeholder="e.g. TraderKing" class="w-full bg-[#111216] border border-[#2B2D31] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none" />
          </div>
          <div>
            <label id="auth-id-label" class="block text-xs font-bold text-[#BDBEBE] uppercase mb-1">Username or Email</label>
            <input id="auth-identifier" type="text" required placeholder="Enter username or email" class="w-full bg-[#111216] border border-[#2B2D31] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none" />
          </div>
          <div>
            <label class="block text-xs font-bold text-[#BDBEBE] uppercase mb-1">Password</label>
            <input id="auth-password" type="password" required placeholder="Min 6 characters" class="w-full bg-[#111216] border border-[#2B2D31] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none" />
          </div>
          <p id="auth-error-msg" class="text-red-400 text-xs font-semibold hidden"></p>
          <button id="auth-submit-btn" type="submit" class="w-full bg-[#00B06F] text-white font-bold py-2.5 rounded-lg">Log In</button>
        </form>
      </div>
    `;
    document.body.appendChild(div);

    let mode = 'login';
    this.openAuthModal = (targetMode = 'login') => {
      mode = targetMode;
      const modal = document.getElementById('rokori-auth-modal');
      modal.classList.remove('hidden'); modal.classList.add('flex');
      document.getElementById('auth-error-msg').classList.add('hidden');
      if (mode === 'register') {
        document.getElementById('auth-modal-title').textContent = 'Join Rokori';
        document.getElementById('auth-username-group').classList.remove('hidden');
        document.getElementById('auth-id-label').textContent = 'Email';
        document.getElementById('auth-submit-btn').textContent = 'Sign Up (+500 Ruxbux)';
        document.getElementById('tab-register-btn').className = 'flex-1 py-1.5 rounded-lg text-sm font-bold bg-[#2B2D31] text-white';
        document.getElementById('tab-login-btn').className = 'flex-1 py-1.5 rounded-lg text-sm font-bold text-[#BDBEBE]';
      } else {
        document.getElementById('auth-modal-title').textContent = 'Log In';
        document.getElementById('auth-username-group').classList.add('hidden');
        document.getElementById('auth-id-label').textContent = 'Username or Email';
        document.getElementById('auth-submit-btn').textContent = 'Log In';
        document.getElementById('tab-login-btn').className = 'flex-1 py-1.5 rounded-lg text-sm font-bold bg-[#2B2D31] text-white';
        document.getElementById('tab-register-btn').className = 'flex-1 py-1.5 rounded-lg text-sm font-bold text-[#BDBEBE]';
      }
    };

    document.getElementById('auth-modal-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('auth-error-msg');
      errEl.classList.add('hidden');
      try {
        const identifier = document.getElementById('auth-identifier').value.trim();
        const password = document.getElementById('auth-password').value;
        const res = mode === 'register'
          ? await this.api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: document.getElementById('auth-username').value.trim(), email: identifier, password }) })
          : await this.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
        this.setSession(res.token, res.user);
        window.location.reload();
      } catch (err) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    });
  },

  injectCurrencyModal() {
    if (document.getElementById('rokori-currency-modal')) return;
    const div = document.createElement('div');
    div.id = 'rokori-currency-modal';
    div.className = 'fixed inset-0 modal-backdrop hidden items-center justify-center z-50 p-4';
    div.innerHTML = `
      <div class="bg-[#232527] border border-[#2B2D31] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onclick="document.getElementById('rokori-currency-modal').classList.add('hidden')" class="absolute top-4 right-4 text-[#BDBEBE] font-bold">✕</button>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-[#00B06F] flex items-center justify-center font-black text-white text-lg">R</div>
          <div><h3 class="text-lg font-black">Ruxbux Treasury</h3><p class="text-xs text-[#BDBEBE]">Earn Ruxbux via trading, UGC sales & 10-min stipends</p></div>
        </div>
        <div class="bg-[#111216] border border-[#2B2D31] rounded-xl p-4 mb-4 flex items-center justify-between">
          <div><div class="text-xs text-[#BDBEBE]">Balance</div><div id="modal-korbux-balance" class="text-2xl font-black text-[#00B06F]">${this.user ? this.user.korbux.toLocaleString() : 0} Ruxbux</div></div>
          <button onclick="Rokori.claimStipend()" class="bg-[#00B06F] hover:bg-[#009960] text-white font-bold text-xs px-4 py-2 rounded-lg">Claim Daily +50</button>
        </div>
        <p class="text-xs text-[#BDBEBE]">⏱️ Automated Stipend: +1 Ruxbux is deposited every 10 minutes automatically.</p>
      </div>
    `;
    document.body.appendChild(div);
    this.openCurrencyModal = () => {
      if (!this.user) return this.openAuthModal('login');
      document.getElementById('modal-korbux-balance').textContent = `${this.user.korbux.toLocaleString()} Ruxbux`;
      document.getElementById('rokori-currency-modal').classList.remove('hidden');
      document.getElementById('rokori-currency-modal').classList.add('flex');
    };
  },

  async claimStipend() {
    try {
      const res = await this.api('/api/auth/stipend', { method: 'POST' });
      this.user.korbux = res.korbux;
      this.setSession(this.token, this.user);
      document.getElementById('nav-korbux-count').textContent = res.korbux.toLocaleString();
      document.getElementById('modal-korbux-balance').textContent = `${res.korbux.toLocaleString()} Ruxbux`;
      this.toast(res.message);
    } catch (err) { this.toast(err.message, 'error'); }
  }
};
