(function(){
  "use strict";

  /* ================= KONFIGURASI API ================= */
  // Ganti sesuai alamat backend-mu. Kalau frontend & backend di-deploy
  // bersamaan (backend yang serve file HTML ini), bisa diganti jadi '/api'.
  var API_BASE = 'http://localhost:3000/api';
  var TOKEN_KEY = 'gnr_token';
  var USERNAME_KEY = 'gnr_username';

  var HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var HARI_SINGKAT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  var BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Spt','Okt','Nov','Des'];
  var EMOJI = { Makanan:'🍖', Mainan:'🎾', Aksesoris:'🎀', Perawatan:'🧴' };

  function rupiah(n){ n = Math.round(n||0); return "Rp " + n.toLocaleString('id-ID'); }
  function fmtWaktu(d){ d = new Date(d); return String(d.getHours()).padStart(2,'0') + '.' + String(d.getMinutes()).padStart(2,'0'); }
  function fmtTanggalPanjang(d){
    d = new Date(d);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }
  function sameDay(a,b){ a=new Date(a); b=new Date(b); return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

  /* ================= API HELPER ================= */
  async function apiFetch(path, options){
    options = options || {};
    var headers = Object.assign({ 'Content-Type':'application/json' }, options.headers || {});
    var token = localStorage.getItem(TOKEN_KEY);
    if(token) headers['Authorization'] = 'Bearer ' + token;

    var res;
    try{
      res = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
    }catch(e){
      throw new Error('Tidak bisa terhubung ke server. Pastikan backend menyala.');
    }

    var data = null;
    try{ data = await res.json(); }catch(e){ /* response kosong, abaikan */ }

    if(!res.ok){
      var msg = (data && data.message) ? data.message : ('Terjadi kesalahan (' + res.status + ').');
      var err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ================= STATE (di memori, data asli ada di MySQL) ================= */
  var state = {
    auth: { loggedIn:false, username:"" },
    products: [],
    transactions: [],
    dashboard: null,
    cart: []
  };

  var kasirActiveCat = "Semua";
  var kasirSearch = "";
  var barangSearch = "";
  var barangFilterKategori = "";
  var barangFilterStatus = "";
  var paymentMethod = null;
  var lihatSemuaTx = false;

  /* ---------------- TOAST ---------------- */
  var toastTimer;
  function showToast(msg){
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2600);
  }

  /* ---------------- STOCK STATUS ---------------- */
  function statusOf(p){
    if(p.stok <= 0) return "Habis";
    if(p.stok <= 5) return "Menipis";
    return "Aman";
  }
  function statusPillHtml(status){
    var cls = status==="Aman"?"status-aman":(status==="Menipis"?"status-menipis":"status-habis");
    return '<span class="status-pill '+cls+'"><span class="dot"></span>Stok '+status+'</span>';
  }

  /* ================= VIEW / LOGIN ================= */
  function showView(name){
    document.getElementById('view-login').classList.toggle('active', name==='login');
    document.getElementById('view-app').classList.toggle('active', name==='app');
  }

  function updateProfileUI(username){
    document.getElementById('profile-name').textContent = username;
    document.getElementById('profile-dropdown-name').textContent = username;
    document.getElementById('avatar-initial').textContent = username.charAt(0).toUpperCase();
    document.getElementById('welcome-msg').textContent = "Welcome Back " + username + "!";
  }

  function doLogout(){
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    state.auth = { loggedIn:false, username:"" };
    state.products = []; state.transactions = []; state.dashboard = null; state.cart = [];
    closeDropdowns();
    showView('login');
    document.getElementById('login-form').reset();
  }

  document.getElementById('login-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var u = document.getElementById('login-username').value.trim();
    var p = document.getElementById('login-password').value.trim();
    var errEl = document.getElementById('login-error');
    if(!u || !p){
      errEl.textContent = 'Username & password tidak boleh kosong.';
      errEl.classList.add('show');
      return;
    }
    errEl.classList.remove('show');

    var submitBtn = this.querySelector('button[type="submit"]');
    var originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Masuk...';

    try{
      var data = await apiFetch('/auth/login', {
        method:'POST',
        body: JSON.stringify({ username:u, password:p })
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USERNAME_KEY, data.user.username);
      state.auth = { loggedIn:true, username:data.user.username };
      updateProfileUI(data.user.username);
      showView('app');
      await renderAll();
    }catch(err){
      errEl.textContent = err.message || 'Username atau password salah.';
      errEl.classList.add('show');
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  document.getElementById('btn-forgot').addEventListener('click', function(){
    alert('Fitur reset password belum tersedia pada demo ini. Silakan hubungi admin toko.');
  });

  document.getElementById('btn-logout').addEventListener('click', doLogout);

  /* ================= NAV ================= */
  document.querySelectorAll('.navlink').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.navlink').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var page = btn.getAttribute('data-page');
      document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
      document.getElementById('page-'+page).classList.add('active');
      closeDropdowns();
      if(page==='beranda') renderBeranda();
      if(page==='kasir'){ renderKasirCats(); renderKasirProducts(); renderCart(); }
      if(page==='barang') renderBarang();
    });
  });

  /* ================= TOPBAR: profile / bell ================= */
  function closeDropdowns(){
    document.getElementById('profile-dropdown').classList.remove('show');
    document.getElementById('bell-dropdown').classList.remove('show');
  }
  document.getElementById('profile-btn').addEventListener('click', function(e){
    e.stopPropagation();
    document.getElementById('bell-dropdown').classList.remove('show');
    document.getElementById('profile-dropdown').classList.toggle('show');
  });
  document.getElementById('bell-btn').addEventListener('click', function(e){
    e.stopPropagation();
    document.getElementById('profile-dropdown').classList.remove('show');
    renderBellDropdown();
    document.getElementById('bell-dropdown').classList.toggle('show');
  });
  document.addEventListener('click', closeDropdowns);

  function renderBellDropdown(){
    var low = state.products.filter(function(p){ return statusOf(p)!=='Aman'; });
    var el = document.getElementById('bell-dropdown');
    var html = '<div class="dropdown-title">Notifikasi Stok</div>';
    if(low.length===0){
      html += '<div class="dropdown-empty">Semua stok dalam kondisi aman 👍</div>';
    } else {
      low.slice(0,6).forEach(function(p){
        var st = statusOf(p);
        var color = st==='Habis' ? 'var(--danger)' : 'var(--warning)';
        html += '<div class="dropdown-item"><span class="dot" style="background:'+color+'"></span>'+
                '<span>'+p.nama+' — stok '+p.stok+' ('+st+')</span></div>';
      });
    }
    el.innerHTML = html;
  }
  function updateBellDot(){
    var low = state.products.filter(function(p){ return statusOf(p)!=='Aman'; });
    document.getElementById('bell-dot').style.display = low.length>0 ? 'block' : 'none';
  }

  /* ================= DATE CHIPS ================= */
  function renderDateChips(){
    var t = fmtTanggalPanjang(new Date());
    document.getElementById('date-chip-text').textContent = t;
    document.getElementById('date-chip-text-2').textContent = t;
  }

  /* ================= BERANDA ================= */
  function renderBeranda(){
    var dash = state.dashboard || {
      totalPenjualanHariIni:0, jumlahTransaksiHariIni:0, totalStok:0, stokMenipisAtauHabis:0, grafik7Hari:[]
    };

    document.getElementById('stat-penjualan').textContent = rupiah(dash.totalPenjualanHariIni);
    document.getElementById('stat-penjualan-cap').textContent = 'Total transaksi ' + dash.jumlahTransaksiHariIni + ' transaksi';
    document.getElementById('stat-stok').innerHTML = dash.totalStok + ' <small>item</small>';
    document.getElementById('stat-low').innerHTML = dash.stokMenipisAtauHabis + ' <small>produk</small>';

    // grafik 7 hari terakhir: isi tanggal yang kosong dengan 0
    var byDate = {};
    (dash.grafik7Hari || []).forEach(function(row){
      var d = new Date(row.tanggal);
      var key = d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
      byDate[key] = Number(row.total)||0;
    });
    var days = [];
    for(var i=6;i>=0;i--){
      var d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      var key = d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
      days.push({ date:d, total: byDate[key]||0, isToday: i===0 });
    }
    var max = Math.max.apply(null, days.map(function(d){ return d.total; }).concat([1]));
    var wrap = document.getElementById('chart-wrap');
    wrap.innerHTML = days.map(function(d){
      var h = Math.max(6, Math.round((d.total/max)*100));
      return '<div class="chart-bar-col">'+
        '<div class="chart-bar'+(d.isToday?' today':'')+'" style="height:'+h+'%" title="'+rupiah(d.total)+'"></div>'+
        '<div class="chart-label">'+(d.isToday?'Ini':HARI_SINGKAT[d.date.getDay()])+'</div>'+
      '</div>';
    }).join('');

    var kemarin = days[days.length-2].total;
    var totalPenjualan = dash.totalPenjualanHariIni;
    var noteEl = document.getElementById('chart-note');
    if(kemarin<=0 && totalPenjualan>0){
      noteEl.innerHTML = '↗ Penjualan hari ini tercatat ' + rupiah(totalPenjualan);
    } else if(kemarin>0){
      var pct = Math.round(((totalPenjualan-kemarin)/kemarin)*100);
      noteEl.innerHTML = (pct>=0?'↗ Penjualan hari ini naik '+pct+'%':'↘ Penjualan hari ini turun '+Math.abs(pct)+'%') + ' dibanding kemarin';
    } else {
      noteEl.innerHTML = 'Belum ada transaksi tercatat.';
    }

    renderRecentTx();
    updateBellDot();
  }

  function renderRecentTx(){
    var body = document.getElementById('recent-tx-body');
    var sorted = state.transactions.slice().sort(function(a,b){ return b.waktu-a.waktu; });
    var list = lihatSemuaTx ? sorted : sorted.slice(0,5);
    if(list.length===0){
      body.innerHTML = '<tr><td colspan="4" class="empty-row">Belum ada transaksi.</td></tr>';
      return;
    }
    body.innerHTML = list.map(function(t){
      return '<tr><td>'+t.nama+'</td><td>'+t.qty+'</td><td>'+rupiah(t.total)+'</td><td>'+fmtWaktu(t.waktu)+'</td></tr>';
    }).join('');
  }
  document.getElementById('btn-lihat-semua').addEventListener('click', function(){
    lihatSemuaTx = !lihatSemuaTx;
    this.textContent = lihatSemuaTx ? 'Lihat teratas ⌃' : 'Lihat semua ⌄';
    renderRecentTx();
  });
  document.getElementById('stat-low-link').addEventListener('click', function(){
    document.querySelector('.navlink[data-page="barang"]').click();
    barangFilterStatus = 'Menipis';
    document.getElementById('barang-filter-status').value = '';
    renderBarang();
  });

  /* ================= KASIR ================= */
  var KATEGORI_LIST = ["Semua","Makanan","Mainan","Aksesoris","Perawatan"];
  function renderKasirCats(){
    var wrap = document.getElementById('kasir-cats');
    wrap.innerHTML = KATEGORI_LIST.map(function(c){
      return '<button class="cat-tab'+(c===kasirActiveCat?' active':'')+'" data-cat="'+c+'">'+c+'</button>';
    }).join('');
    wrap.querySelectorAll('.cat-tab').forEach(function(b){
      b.addEventListener('click', function(){
        kasirActiveCat = b.getAttribute('data-cat');
        renderKasirCats(); renderKasirProducts();
      });
    });
  }

  function renderKasirProducts(){
    var grid = document.getElementById('kasir-product-grid');
    var q = kasirSearch.trim().toLowerCase();
    var list = state.products.filter(function(p){
      var okCat = kasirActiveCat==='Semua' || p.kategori===kasirActiveCat;
      var okSearch = !q || p.nama.toLowerCase().indexOf(q)>-1 || p.sku.toLowerCase().indexOf(q)>-1;
      return okCat && okSearch;
    });
    if(list.length===0){
      grid.innerHTML = '<div class="empty-row" style="grid-column:1/-1;">Produk tidak ditemukan.</div>';
      return;
    }
    grid.innerHTML = list.map(function(p){
      var disabled = p.stok<=0 ? 'disabled' : '';
      var label = p.stok<=0 ? 'Stok Habis' : '+ Tambah';
      return '<div class="product-card">'+
        '<div class="product-thumb">'+(EMOJI[p.kategori]||'📦')+'</div>'+
        '<div class="product-name">'+p.nama+'</div>'+
        '<div class="product-price">'+rupiah(p.jual)+'</div>'+
        '<div class="product-stock">Stok: '+p.stok+'</div>'+
        '<button class="btn-add" data-id="'+p.id+'" '+disabled+'>'+label+'</button>'+
      '</div>';
    }).join('');
    grid.querySelectorAll('.btn-add').forEach(function(b){
      b.addEventListener('click', function(){ addToCart(Number(b.getAttribute('data-id'))); });
    });
  }

  function addToCart(productId){
    var product = state.products.find(function(p){ return p.id===productId; });
    if(!product) return;
    var line = state.cart.find(function(c){ return c.productId===productId; });
    var currentQty = line ? line.qty : 0;
    if(currentQty+1 > product.stok){
      showToast('Stok "'+product.nama+'" tidak mencukupi.');
      return;
    }
    if(line){ line.qty += 1; }
    else{ state.cart.push({ productId:productId, qty:1 }); }
    renderCart();
  }
  function changeQty(productId, delta){
    var line = state.cart.find(function(c){ return c.productId===productId; });
    if(!line) return;
    var product = state.products.find(function(p){ return p.id===productId; });
    var newQty = line.qty + delta;
    if(newQty<=0){
      state.cart = state.cart.filter(function(c){ return c.productId!==productId; });
    } else if(product && newQty>product.stok){
      showToast('Stok "'+product.nama+'" tidak mencukupi.');
      return;
    } else {
      line.qty = newQty;
    }
    renderCart();
  }
  function removeFromCart(productId){
    state.cart = state.cart.filter(function(c){ return c.productId!==productId; });
    renderCart();
  }

  function renderCart(){
    var rowsEl = document.getElementById('cart-rows');
    var countChip = document.getElementById('cart-count-chip');
    var totalEl = document.getElementById('cart-total');
    var checkoutBtn = document.getElementById('btn-checkout');

    if(state.cart.length===0){
      rowsEl.innerHTML = '<div class="cart-empty">Keranjang masih kosong.<br>Pilih produk untuk mulai transaksi.</div>';
      countChip.textContent = '0 item';
      totalEl.textContent = rupiah(0);
      checkoutBtn.disabled = true;
      return;
    }
    var total = 0;
    var totalQty = 0;
    var html = state.cart.map(function(c){
      var product = state.products.find(function(p){ return p.id===c.productId; });
      if(!product) return '';
      var lineTotal = product.jual * c.qty;
      total += lineTotal; totalQty += c.qty;
      return '<div class="cart-row">'+
        '<div class="cart-info"><div class="nm">'+product.nama+'</div><div class="pr">'+rupiah(product.jual)+'</div></div>'+
        '<div class="qty-ctl">'+
          '<button data-act="dec" data-id="'+product.id+'">−</button>'+
          '<span>'+c.qty+'</span>'+
          '<button data-act="inc" data-id="'+product.id+'">+</button>'+
        '</div>'+
        '<div class="cart-total-line">'+rupiah(lineTotal)+'</div>'+
        '<button class="trash-btn" data-act="del" data-id="'+product.id+'" title="Hapus">'+
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'+
        '</button>'+
      '</div>';
    }).join('');
    rowsEl.innerHTML = html;
    countChip.textContent = totalQty + ' item';
    totalEl.textContent = rupiah(total);
    checkoutBtn.disabled = !paymentMethod;

    rowsEl.querySelectorAll('[data-act="inc"]').forEach(function(b){ b.addEventListener('click', function(){ changeQty(Number(b.getAttribute('data-id')), 1); }); });
    rowsEl.querySelectorAll('[data-act="dec"]').forEach(function(b){ b.addEventListener('click', function(){ changeQty(Number(b.getAttribute('data-id')), -1); }); });
    rowsEl.querySelectorAll('[data-act="del"]').forEach(function(b){ b.addEventListener('click', function(){ removeFromCart(Number(b.getAttribute('data-id'))); }); });
  }

  document.querySelectorAll('.pay-btn').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.pay-btn').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      paymentMethod = b.getAttribute('data-method');
      document.getElementById('btn-checkout').disabled = state.cart.length===0;
    });
  });

  document.getElementById('kasir-search').addEventListener('input', function(){
    kasirSearch = this.value; renderKasirProducts();
  });

  document.getElementById('btn-checkout').addEventListener('click', async function(){
    if(state.cart.length===0 || !paymentMethod) return;
    var btn = this;
    btn.disabled = true;
    var originalLabel = btn.textContent;
    btn.textContent = 'Memproses...';

    var items = state.cart.map(function(c){ return { productId:c.productId, qty:c.qty }; });

    try{
      var result = await apiFetch('/transactions/checkout', {
        method:'POST',
        body: JSON.stringify({ items:items, metode:paymentMethod })
      });

      state.cart = [];
      paymentMethod = null;
      document.querySelectorAll('.pay-btn').forEach(function(x){ x.classList.remove('active'); });

      await Promise.all([ loadProducts(), loadTransactions(), loadDashboard() ]);
      renderCart();
      renderKasirProducts();
      renderBarang();
      renderBeranda();

      showReceipt(result.items, result.total, result.metode, result.waktu, result.txId);
      showToast('Transaksi berhasil disimpan.');
    }catch(err){
      showToast(err.message || 'Gagal memproses transaksi.');
    }finally{
      btn.disabled = state.cart.length===0 || !paymentMethod;
      btn.textContent = originalLabel;
    }
  });

  function showReceipt(lines, total, metode, waktu, txId){
    var html = '<div class="receipt-head"><span class="paw">🐾</span><h3>GnR PetHouse</h3><p>Jl. Kenari Indah No. 12, Bandung</p></div>';
    lines.forEach(function(l){
      html += '<div class="receipt-line item-name"><span>'+l.nama+'</span><span>'+rupiah(l.total)+'</span></div>'+
              '<div class="receipt-line item-sub"><span>'+l.qty+' x '+rupiah(l.harga)+'</span><span></span></div>';
    });
    html += '<div class="receipt-total"><span>Total</span><span>'+rupiah(total)+'</span></div>';
    html += '<div class="receipt-meta">Metode: '+metode+' &nbsp;•&nbsp; '+fmtTanggalPanjang(waktu)+' '+fmtWaktu(waktu)+'<br>No. Transaksi: '+String(txId).toUpperCase()+'</div>';
    document.getElementById('receipt-content').innerHTML = html;
    openModal('modal-struk');
  }
  document.getElementById('btn-print-struk').addEventListener('click', function(){ window.print(); });

  /* ================= BARANG ================= */
  function renderBarang(){
    document.getElementById('barang-last-updated').textContent = 'Last Updated: ' + fmtTanggalPanjang(new Date()) + ', ' + fmtWaktu(new Date());
    var body = document.getElementById('barang-table-body');
    var q = barangSearch.trim().toLowerCase();
    var list = state.products.filter(function(p){
      var okSearch = !q || p.nama.toLowerCase().indexOf(q)>-1 || p.sku.toLowerCase().indexOf(q)>-1;
      var okKategori = !barangFilterKategori || p.kategori===barangFilterKategori;
      var okStatus = !barangFilterStatus || statusOf(p)===barangFilterStatus;
      return okSearch && okKategori && okStatus;
    });
    if(list.length===0){
      body.innerHTML = '<tr><td colspan="9" class="empty-row">Barang tidak ditemukan.</td></tr>';
      return;
    }
    body.innerHTML = list.map(function(p){
      var status = statusOf(p);
      var restockBtn = status!=='Aman' ? '<button class="btn-restock" data-id="'+p.id+'">Restock</button>' : '';
      return '<tr>'+
        '<td><div class="prod-thumb-sm">'+(EMOJI[p.kategori]||'📦')+'</div></td>'+
        '<td style="font-weight:700;">'+p.nama+'</td>'+
        '<td>'+p.sku+'</td>'+
        '<td>'+p.kategori+'</td>'+
        '<td>'+rupiah(p.modal)+'</td>'+
        '<td>'+rupiah(p.jual)+'</td>'+
        '<td style="font-weight:700;">'+p.stok+' item</td>'+
        '<td>'+statusPillHtml(status)+'</td>'+
        '<td><div class="row-actions">'+
          '<button class="edit" data-id="'+p.id+'" title="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>'+
          '<button class="del" data-id="'+p.id+'" title="Hapus"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>'+
          restockBtn+
        '</div></td>'+
      '</tr>';
    }).join('');

    body.querySelectorAll('.edit').forEach(function(b){ b.addEventListener('click', function(){ openEditBarang(Number(b.getAttribute('data-id'))); }); });
    body.querySelectorAll('.del').forEach(function(b){ b.addEventListener('click', function(){ deleteBarang(Number(b.getAttribute('data-id'))); }); });
    body.querySelectorAll('.btn-restock').forEach(function(b){ b.addEventListener('click', function(){ openRestock(Number(b.getAttribute('data-id'))); }); });
  }

  document.getElementById('barang-search').addEventListener('input', function(){ barangSearch = this.value; renderBarang(); });
  document.getElementById('barang-filter-kategori').addEventListener('change', function(){ barangFilterKategori = this.value; renderBarang(); });
  document.getElementById('barang-filter-status').addEventListener('change', function(){
    var map = { "":"", "Aman":"Aman", "Menipis":"Menipis", "Habis":"Habis" };
    barangFilterStatus = map[this.value] || "";
    renderBarang();
  });

  /* ---- modal helpers ---- */
  function openModal(id){ document.getElementById(id).classList.add('show'); }
  function closeModal(id){ document.getElementById(id).classList.remove('show'); }
  document.querySelectorAll('[data-close]').forEach(function(b){
    b.addEventListener('click', function(){ closeModal(b.getAttribute('data-close')); });
  });
  document.querySelectorAll('.modal-overlay').forEach(function(ov){
    ov.addEventListener('click', function(e){ if(e.target===ov) closeModal(ov.id); });
  });

  document.getElementById('btn-tambah-barang').addEventListener('click', function(){
    document.getElementById('modal-barang-title').textContent = 'Tambah Barang Baru';
    document.getElementById('form-barang').reset();
    document.getElementById('fb-id').value = '';
    openModal('modal-barang');
  });
  function openEditBarang(id){
    var p = state.products.find(function(x){ return x.id===id; });
    if(!p) return;
    document.getElementById('modal-barang-title').textContent = 'Edit Barang';
    document.getElementById('fb-id').value = p.id;
    document.getElementById('fb-nama').value = p.nama;
    document.getElementById('fb-sku').value = p.sku;
    document.getElementById('fb-kategori').value = p.kategori;
    document.getElementById('fb-modal').value = p.modal;
    document.getElementById('fb-jual').value = p.jual;
    document.getElementById('fb-stok').value = p.stok;
    openModal('modal-barang');
  }
  document.getElementById('btn-simpan-barang').addEventListener('click', async function(){
    var id = document.getElementById('fb-id').value;
    var nama = document.getElementById('fb-nama').value.trim();
    var sku = document.getElementById('fb-sku').value.trim();
    var kategori = document.getElementById('fb-kategori').value;
    var modal = Number(document.getElementById('fb-modal').value)||0;
    var jual = Number(document.getElementById('fb-jual').value)||0;
    var stok = Number(document.getElementById('fb-stok').value)||0;
    if(!nama || !sku){ showToast('Nama dan SKU wajib diisi.'); return; }

    var btn = this;
    btn.disabled = true;
    var payload = { nama:nama, sku:sku, kategori:kategori, modal:modal, jual:jual, stok:stok };

    try{
      if(id){
        await apiFetch('/products/'+id, { method:'PUT', body: JSON.stringify(payload) });
        showToast('Barang berhasil diperbarui.');
      } else {
        await apiFetch('/products', { method:'POST', body: JSON.stringify(payload) });
        showToast('Barang baru berhasil ditambahkan.');
      }
      closeModal('modal-barang');
      await refreshAfterProductChange();
    }catch(err){
      showToast(err.message || 'Gagal menyimpan barang.');
    }finally{
      btn.disabled = false;
    }
  });

  async function deleteBarang(id){
    var p = state.products.find(function(x){ return x.id===id; });
    if(!p) return;
    if(!confirm('Hapus barang "'+p.nama+'" dari inventaris?')) return;
    try{
      await apiFetch('/products/'+id, { method:'DELETE' });
      state.cart = state.cart.filter(function(c){ return c.productId!==id; });
      await refreshAfterProductChange();
      renderCart();
      showToast('Barang berhasil dihapus.');
    }catch(err){
      showToast(err.message || 'Gagal menghapus barang.');
    }
  }

  function openRestock(id){
    var p = state.products.find(function(x){ return x.id===id; });
    if(!p) return;
    document.getElementById('rs-id').value = p.id;
    document.getElementById('restock-info').textContent = p.nama + ' — stok saat ini: ' + p.stok + ' item';
    document.getElementById('rs-jumlah').value = '';
    openModal('modal-restock');
  }
  document.getElementById('btn-simpan-restock').addEventListener('click', async function(){
    var id = document.getElementById('rs-id').value;
    var jumlah = Number(document.getElementById('rs-jumlah').value)||0;
    if(jumlah<=0){ showToast('Masukkan jumlah stok yang valid.'); return; }

    var btn = this;
    btn.disabled = true;
    try{
      await apiFetch('/products/'+id+'/restock', { method:'PATCH', body: JSON.stringify({ jumlah:jumlah }) });
      closeModal('modal-restock');
      await refreshAfterProductChange();
      showToast('Stok berhasil ditambahkan.');
    }catch(err){
      showToast(err.message || 'Gagal menambah stok.');
    }finally{
      btn.disabled = false;
    }
  });

  async function refreshAfterProductChange(){
    try{
      await Promise.all([ loadProducts(), loadDashboard() ]);
    }catch(err){
      showToast(err.message || 'Gagal memuat ulang data.');
    }
    renderBarang();
    renderKasirProducts();
    renderCart();
    renderBeranda();
  }

  /* ================= GLOBAL SEARCH (topbar) ================= */
  document.getElementById('global-search').addEventListener('input', function(){
    var val = this.value;
    var activePage = document.querySelector('.page.active').id;
    if(activePage==='page-kasir'){
      kasirSearch = val; document.getElementById('kasir-search').value = val; renderKasirProducts();
    } else if(activePage==='page-barang'){
      barangSearch = val; document.getElementById('barang-search').value = val; renderBarang();
    }
  });

  /* ================= DATA LOADERS ================= */
  async function loadProducts(){
    state.products = await apiFetch('/products');
  }
  async function loadTransactions(){
    var rows = await apiFetch('/transactions');
    state.transactions = rows.map(function(t){
      return {
        id: t.id,
        txId: t.tx_id,
        productId: t.product_id,
        nama: t.nama,
        qty: t.qty,
        harga: t.harga,
        total: t.total,
        metode: t.metode,
        waktu: new Date(t.waktu).getTime()
      };
    });
  }
  async function loadDashboard(){
    state.dashboard = await apiFetch('/dashboard/summary');
  }

  /* ================= INIT ================= */
  async function renderAll(){
    try{
      await Promise.all([ loadProducts(), loadTransactions(), loadDashboard() ]);
    }catch(err){
      if(err.status===401){
        showToast('Sesi berakhir, silakan login kembali.');
        doLogout();
        return;
      }
      showToast(err.message || 'Gagal memuat data dari server.');
    }
    renderDateChips();
    renderKasirCats();
    renderKasirProducts();
    renderCart();
    renderBarang();
    renderBeranda();
    updateBellDot();
  }

  (async function init(){
    var token = localStorage.getItem(TOKEN_KEY);
    var username = localStorage.getItem(USERNAME_KEY);
    if(token && username){
      state.auth = { loggedIn:true, username:username };
      updateProfileUI(username);
      showView('app');
      await renderAll();
    } else {
      showView('login');
    }
  })();
})();