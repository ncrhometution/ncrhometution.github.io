// ============================================================
// NCR Home Tuition - Auth + Cart + Firestore Sync Module
// ============================================================

// ---- Firebase Config ----
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAe9z_iKfZ0xQb2q2dF5vY5CMtxQldUP3M",
  authDomain: "ncrhometuitions-48e19.firebaseapp.com",
  projectId: "ncrhometuitions-48e19",
  storageBucket: "ncrhometuitions-48e19.firebasestorage.app",
  messagingSenderId: "959092582322",
  appId: "1:959092582322:web:c1b82f73db01f4585066ab"
};

// ---- Init Firebase (safe to call multiple times) ----
function initFirebase() {
  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function() {});
  }
}

// ---- Profile helpers (localStorage) ----
// Session lifetime: like Gmail, the user stays logged in across browser restarts
// while active. A sliding 30-day expiry is refreshed on activity (see touchSession).
var SESSION_DAYS = 30;
var SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
var SESSION_TOUCH_MS = 60 * 60 * 1000; // refresh at most once per hour

function getProfile() {
  try { var r = localStorage.getItem("user_profile"); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function saveProfile(p) {
  if (p && typeof p === "object") {
    if (!p.session_started) p.session_started = Date.now();
    // Respect a server-provided expiry (OTP login); otherwise apply the sliding default.
    if (!p.expires_at) p.expires_at = Date.now() + SESSION_MS;
  }
  try { localStorage.setItem("user_profile", JSON.stringify(p)); } catch(e) {}
}
function clearProfile() {
  localStorage.removeItem("user_profile");
  localStorage.removeItem("user_leads");
  localStorage.removeItem("user_cart");
  localStorage.removeItem("user_saved_profiles");
  localStorage.removeItem("user_purchased_leads");
  try { localStorage.removeItem("user_token"); } catch(e) {}
}
// Gmail-like sliding session: extend the expiry on activity (throttled to once/hour).
function touchSession() {
  var p = getProfile();
  if (!p) return;
  var now = Date.now();
  if (p.last_touch && (now - p.last_touch) < SESSION_TOUCH_MS) return;
  p.last_touch = now;
  p.expires_at = now + SESSION_MS;
  try { localStorage.setItem("user_profile", JSON.stringify(p)); } catch(e) {}
}
// Returns true when the stored session has passed its expiry (and clears it).
function sessionExpired() {
  var p = getProfile();
  if (!p) return false;
  if (p.expires_at && Date.now() > p.expires_at) { clearProfile(); return true; }
  return false;
}
// isLoggedIn() also enforces expiry, so an expired session behaves as logged out.
function isLoggedIn() {
  var p = getProfile();
  if (!p) return false;
  if (p.expires_at && Date.now() > p.expires_at) { clearProfile(); return false; }
  return true;
}
// True when the current session was created by mobile OTP (no Firebase user).
// Such sessions must NOT be cleared by Firebase's onAuthStateChanged(null) handler.
function isOtpSession() {
  var p = getProfile();
  return !!(p && p.uid && String(p.uid).indexOf("ph_") === 0);
}
// Refresh the session expiry whenever the user interacts with the page.
function bindSessionActivity() {
  var events = ["click", "keydown", "touchstart", "scroll"];
  events.forEach(function(ev) {
    document.addEventListener(ev, function() { if (getProfile()) touchSession(); }, { passive: true });
  });
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSessionActivity);
  } else {
    bindSessionActivity();
  }
}

// Current page name (for ?redirect= back-navigation after login/signup)
function currentPageName() {
  return window.location.pathname.split("/").pop() || "index.html";
}
// Full back-navigation target: page name + query string (e.g. data.html?id=TECH255&type=tutor),
// so after login/signup the user returns to the SAME lead/page instead of a blank page.
// Any existing redirect= param is stripped to avoid nested redirects.
// ALSO stores the target in localStorage (auth_return_to) so the stage survives even if
// the URL param is lost (redirects, popups, direct login.html visits).
function loginRedirectQuery() {
  var page = currentPageName();
  var q = (window.location.search || "").replace(/[?&]redirect=[^&]*/g, "");
  var target = page + q;
  try { localStorage.setItem("auth_return_to", target); } catch(e) {}
  return "?redirect=" + encodeURIComponent(target);
}

// STRICT login prompt: cannot be dismissed by outside click, Escape, or the
// close button. The user must choose Login or Sign Up Free.
function requireAuth() {
  if (!isLoggedIn()) {
    Swal.fire({
      icon: "info", title: "Login Required", text: "Please login or sign up to continue",
      confirmButtonText: "Login", confirmButtonColor: "#0f766e",
      showCancelButton: true, cancelButtonText: "Sign Up Free",
      allowOutsideClick: false, allowEscapeKey: false, showCloseButton: false,
      animation: false
    }).then(function(r) {
      if (r.isConfirmed) window.location.href = "login.html" + loginRedirectQuery();
      else if (r.dismiss === Swal.DismissReason.cancel) window.location.href = "signup.html" + loginRedirectQuery();
    });
    return false;
  }
  return true;
}

// PAGE-LEVEL GATE: call on protected pages. Without login the page content is
// hidden and a STRICT modal is shown (no outside click / Escape / close button).
// Returns true when the visitor is logged in, false otherwise.
function requireLoginPage() {
  if (isLoggedIn()) return true;
  Swal.fire({
    icon: "info", title: "Login Required", text: "Please login or sign up to continue",
    confirmButtonText: "Login", confirmButtonColor: "#0f766e",
    showCancelButton: true, cancelButtonText: "Sign Up Free",
    allowOutsideClick: false, allowEscapeKey: false, showCloseButton: false,
    animation: false,
    didOpen: function() {
      // Hide all page content so nothing is accessible without login
      var container = document.querySelector(".swal2-container");
      Array.prototype.forEach.call(document.body.children, function(child) {
        if (child !== container && child.tagName !== "SCRIPT" && child.tagName !== "STYLE" && child.tagName !== "LINK") {
          child.style.display = "none";
        }
      });
    }
  }).then(function(r) {
    if (r.isConfirmed) window.location.href = "login.html" + loginRedirectQuery();
    else if (r.dismiss === Swal.DismissReason.cancel) window.location.href = "signup.html" + loginRedirectQuery();
  });
  return false;
}

// ---- Visit tracking (fire-and-forget, never blocks the page) ----
// Sends one POST /visit per page load so the admin panel can show
// website visits and which pages are popular.
function trackVisit() {
  try {
    var payload = { page: currentPageName(), referrer: document.referrer || "" };
    var profile = getProfile();
    if (profile && profile.uid) payload.user_id = profile.uid;
    var url = "https://ncrhomr.vercel.app/visit";
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(function() {});
    }
  } catch(e) {}
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", trackVisit);
} else {
  trackVisit();
}

// ---- Welcome toast on reload after login ----
function checkWelcomeToast() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("welcome") === "1") {
    var profile = getProfile();
    var name = profile ? (profile.displayName || profile.email || "there") : "there";
    Swal.fire({ icon: "success", title: "Welcome, " + name + "!", text: "Successfully logged in", timer: 2500, showConfirmButton: false, toast: true, position: "top-end" });
    var url = new URL(window.location);
    url.searchParams.delete("welcome");
    window.history.replaceState({}, "", url);
  }
}

// ---- Lead wallet (purchased leads) ----
function getLeads() { return parseInt(localStorage.getItem("user_leads") || "0", 10); }
function setLeads(n) { localStorage.setItem("user_leads", String(n)); }
function addLeads(count) { setLeads(getLeads() + count); }
// Spend one lead; returns true if a lead was available and consumed
function useLead() {
  var leads = getLeads();
  if (leads <= 0) return false;
  setLeads(leads - 1);
  syncCartToFirestore();
  return true;
}

// ============================================================
// CART = list of tutor/student profiles you want to contact
// Each profile = 1 lead = ₹99 base (with smart pricing)
// ============================================================

// ---- Cart helpers ----
function getCart() {
  try { var r = localStorage.getItem("user_cart"); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
function saveCart(c) { localStorage.setItem("user_cart", JSON.stringify(c)); }

// Add a tutor/student profile to cart
function addProfileToCart(profile) {
  var cart = getCart();
  // Check if already in cart
  var exists = cart.find(function(item) { return item.id === profile.id && item.type === profile.type; });
  if (exists) return false; // already added
  cart.push({
    id: profile.id,
    type: profile.type,
    name: profile.name || "",
    city: profile.city || "",
    course: profile.course || "",
    subject: profile.subject || "",
    experience: profile.experience || "",
    preferred_mode: profile.preferred_mode || "",
    language: profile.language || "",
    addedAt: new Date().toISOString()
  });
  saveCart(cart);
  syncCartToFirestore();
  return true;
}

// Remove a profile from cart
function removeProfileFromCart(id, type) {
  var cart = getCart().filter(function(item) { return !(item.id === id && item.type === type); });
  saveCart(cart);
  syncCartToFirestore();
}

// Check if profile is in cart
function isInCart(id, type) {
  return getCart().some(function(item) { return item.id === id && item.type === type; });
}

// Get cart count (number of profiles)
function getCartCount() { return getCart().length; }

// ============================================================
// PRICING
// Student leads = ₹99 each, Tutor (teacher) leads = ₹49 each.
// Package discount (applies to BOTH rates):
//   1-4 leads  = full price
//   5-9 leads  = 20% off
//   10+ leads  = 30% off
// ============================================================

function leadBasePrice(type) {
  return (String(type || "").toLowerCase() === "student") ? 99 : 49;
}

function calculateSmartPrice(input) {
  // Accepts an array of leads [{type}] or a number of leads (legacy: treated as tutors).
  var leads = Array.isArray(input) ? input : [];
  if (!Array.isArray(input)) {
    var n = Math.max(0, Number(input) || 0);
    for (var i = 0; i < n; i++) leads.push({ type: "tutor" });
  }
  var count = leads.length;
  if (count <= 0) return { total: 0, perLead: 0, breakdown: [], savings: 0, originalTotal: 0 };

  var subtotal = leads.reduce(function(sum, l) { return sum + leadBasePrice(l && l.type); }, 0);

  var rate = 0, label = "";
  if (count >= 10) { rate = 0.30; label = "10+ Lead Package"; }
  else if (count >= 5) { rate = 0.20; label = "5+ Lead Package"; }

  var discount = Math.round(subtotal * rate);
  var total = subtotal - discount;

  var breakdown = [{ desc: "Subtotal (" + count + " lead" + (count > 1 ? "s" : "") + ")", amount: subtotal }];
  if (discount > 0) {
    breakdown.push({ desc: label + " (" + Math.round(rate * 100) + "% off)", amount: -discount });
  }

  return {
    total: total,
    perLead: count > 0 ? Math.round(total / count) : 0,
    breakdown: breakdown,
    savings: discount,
    originalTotal: subtotal
  };
}

// Get smart price for current cart
function getCartPricing() {
  return calculateSmartPrice(getCart());
}

// ---- Lead packages (info cards only, NOT cart items) ----
// Discount tiers apply to both student (₹99) and tutor (₹49) leads.
var LEAD_PACKAGES = [
  { id: "lead_1",  leads: 1,  label: "1-4 Leads",  savings: null, popular: false },
  { id: "lead_5",  leads: 5,  label: "5+ Leads",   savings: "20%", popular: true },
  { id: "lead_10", leads: 10, label: "10+ Leads",  savings: "30%", popular: false }
];

// ============================================================
// SAVED PROFILES (bookmarks, separate from cart)
// ============================================================
function getSavedProfiles() { try { var r = localStorage.getItem("user_saved_profiles"); return r ? JSON.parse(r) : []; } catch(e) { return []; } }
function saveProfileToList(profile) {
  var list = getSavedProfiles();
  if (!list.find(function(p) { return p.id === profile.id && p.type === profile.type; })) {
    list.push(profile);
    localStorage.setItem("user_saved_profiles", JSON.stringify(list));
    syncCartToFirestore();
  }
}
function removeSavedProfile(id, type) {
  var list = getSavedProfiles().filter(function(p) { return !(p.id === id && p.type === type); });
  localStorage.setItem("user_saved_profiles", JSON.stringify(list));
  syncCartToFirestore();
}
function isProfileSaved(id, type) {
  return getSavedProfiles().some(function(p) { return p.id === id && p.type === type; });
}

// ============================================================
// PURCHASED LEADS (profiles bought via payment)
// Source of truth: backend GET /payments/my/profiles, matched
// by the logged-in user's email + mobile_no + status=paid.
// localStorage is only a cache for instant display / offline.
// ============================================================
function getPurchasedLeads() {
  try { var r = localStorage.getItem("user_purchased_leads"); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
function savePurchasedLeads(list) { localStorage.setItem("user_purchased_leads", JSON.stringify(list)); }
function addPurchasedLeads(profiles) {
  var list = getPurchasedLeads();
  (profiles || []).forEach(function(p) {
    if (p && p.id && !list.find(function(x) { return x.id === p.id && x.type === p.type; })) {
      list.push(p);
    }
  });
  savePurchasedLeads(list);
  syncCartToFirestore();
}
function isPurchased(id, type) {
  return getPurchasedLeads().some(function(p) { return p.id === id && p.type === type; });
}

// Fetch purchased leads from the backend, matched by the logged-in
// user's email + mobile_no + payment status = paid.
// Returns a Promise resolving to the purchased list (also cached).
function fetchPurchasedLeads() {
  return new Promise(function(resolve) {
    var profile = getProfile();
    if (!profile || !profile.email || !profile.mobile_no) { resolve(getPurchasedLeads()); return; }
    getMyPurchasedProfiles(profile.email, profile.mobile_no)
      .then(function(res) {
        var items = (res && res.data) || [];
        var list = items.map(function(it) {
          var prof = it.profile || {};
          var pay = it.payment || {};
          return {
            id: prof.id,
            type: it.type || "tutor",
            name: prof.name || "Unknown",
            city: prof.city || "",
            course: prof.course || "",
            subject: prof.subject || "",
            qualification: prof.qualification || "",
            experience_years: prof.experience_years,
            preferred_mode: prof.preferred_mode,
            language: prof.language,
            email: prof.email || "",
            mobile_no: prof.mobile_no || "",
            purchasedAt: pay.paid_at || pay.created_at || "",
            paymentId: pay.id || "",
            amount: pay.amount || 0,
            razorpay_payment_id: pay.razorpay_payment_id || ""
          };
        });
        savePurchasedLeads(list);
        syncCartToFirestore();
        resolve(list);
      })
      .catch(function() { resolve(getPurchasedLeads()); });
  });
}

// ============================================================
// MY PAYMENT HISTORY (all attempts: tried, paid, failed, etc.)
// Source of truth: backend GET /payments/my (matched by the
// logged-in user's email + mobile_no). localStorage is a cache.
// ============================================================
function getMyPaymentsCache() {
  try { var r = localStorage.getItem("user_payments"); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
function saveMyPaymentsCache(list) { localStorage.setItem("user_payments", JSON.stringify(list)); }

// Fetch ALL payment attempts for the logged-in user from the backend.
// Returns a Promise resolving to the payment list (also cached).
function fetchMyPayments() {
  return new Promise(function(resolve) {
    var profile = getProfile();
    if (!profile || !profile.email || !profile.mobile_no) { resolve(getMyPaymentsCache()); return; }
    getMyPayments(profile.email, profile.mobile_no)
      .then(function(res) {
        var list = (res && res.data) || [];
        saveMyPaymentsCache(list);
        resolve(list);
      })
      .catch(function() { resolve(getMyPaymentsCache()); });
  });
}

// ============================================================
// FIRESTORE SYNC
// ============================================================
function syncCartToFirestore() {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  var profile = getProfile();
  if (!profile || !profile.uid) return;
  // Only sync cart/leads/savedProfiles - NEVER overwrite profile fields with empty values
  firebase.firestore().collection("users").doc(profile.uid).set({
    cart: getCart(),
    leads: getLeads(),
    savedProfiles: getSavedProfiles(),
    purchasedLeads: getPurchasedLeads(),
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(function(err) { console.warn("Firestore sync failed:", err.message); });
}
function syncProfileToFirestore() {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  var profile = getProfile();
  if (!profile || !profile.uid) return;
  // Only write profile fields that have actual values - never overwrite with empty
  var fields = { lastUpdated: firebase.firestore.FieldValue.serverTimestamp() };
  if (profile.displayName) fields.displayName = profile.displayName;
  if (profile.email) fields.email = profile.email;
  if (profile.mobile_no) fields.mobile_no = profile.mobile_no;
  if (profile.role) fields.role = profile.role;
  if (typeof profile.leads === 'number') fields.leads = profile.leads;
  fields.cart = getCart();
  fields.savedProfiles = getSavedProfiles();
  fields.purchasedLeads = getPurchasedLeads();
  firebase.firestore().collection("users").doc(profile.uid).set(fields, { merge: true }).catch(function(err) { console.warn("Firestore profile sync failed:", err.message); });
}

function loadFromFirestore() {
  return new Promise(function(resolve) {
    if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.auth) { resolve(); return; }
    var user = firebase.auth().currentUser;
    if (!user) { resolve(); return; }
    firebase.firestore().collection("users").doc(user.uid).get()
      .then(function(doc) {
        if (doc.exists) {
          var data = doc.data();
          var profile = getProfile();
          if (profile) {
            if (data.mobile_no) profile.mobile_no = data.mobile_no;
            if (data.displayName) profile.displayName = data.displayName;
            if (data.role) profile.role = data.role;
            saveProfile(profile);
          }
          if (data.cart && data.cart.length > 0) saveCart(data.cart);
          if (typeof data.leads === 'number') setLeads(data.leads);
          if (data.savedProfiles && data.savedProfiles.length > 0) {
            localStorage.setItem("user_saved_profiles", JSON.stringify(data.savedProfiles));
          }
          if (data.purchasedLeads && data.purchasedLeads.length > 0) {
            localStorage.setItem("user_purchased_leads", JSON.stringify(data.purchasedLeads));
          }
        }
        resolve();
      })
      .catch(function(err) { console.warn("Firestore load failed:", err.message); resolve(); });
  });
}

function updateProfile(fields) {
  var profile = getProfile();
  if (!profile) return false;
  Object.assign(profile, fields);
  saveProfile(profile);
  syncProfileToFirestore();
  return true;
}

// ============================================================
// RENDER AUTH BUTTONS + NAV
// ============================================================
function renderAuthButtons(containerId) {
  var box = document.getElementById(containerId);
  if (!box) return;
  var profile = getProfile();
  var cartCount = getCartCount();
  if (profile) {
    var initial = (profile.displayName || profile.email || "U").charAt(0).toUpperCase();
    var name = profile.displayName || "Account";
    var email = profile.email || "";
    var mobile = profile.mobile_no || "";
    var role = profile.role ? (profile.role === "tutor" ? "Home Tutor" : "Student / Parent") : "";
    box.innerHTML =
      '<div class="auth-actions">' +
        '<a href="cart.html" class="btn-nav-login" style="display:flex;align-items:center;gap:6px;position:relative;text-decoration:none">' +
          '<i class="fa-solid fa-shopping-cart"></i> ' +
          '<span>Cart</span>' +
          (cartCount > 0 ? '<span class="cart-badge" style="background:var(--accent);color:#fff;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;min-width:18px;text-align:center">' + cartCount + '</span>' : '') +
        '</a>' +
        '<div class="dropdown">' +
          '<button class="profile-avatar-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
            '<div class="profile-avatar">' + initial + '</div>' +
            '<span class="acct-label">' + name + '</span>' +
            '<i class="fa-solid fa-chevron-down dd-caret"></i>' +
          '</button>' +
          '<ul class="dropdown-menu dropdown-menu-end profile-menu">' +
            '<li class="profile-head">' +
              '<div class="profile-avatar-lg">' + initial + '</div>' +
              '<div style="min-width:0">' +
                '<div class="profile-name">' + name + '</div>' +
                (email ? '<div class="profile-email">' + email + '</div>' : '') +
                '<div class="profile-meta">' + (mobile ? '<i class="fa-solid fa-phone"></i> ' + mobile + ' ' : '') + (role ? '<i class="fa-solid fa-user-tag"></i> ' + role : '') + '</div>' +
              '</div>' +
            '</li>' +
            '<li><hr class="dropdown-divider"></li>' +
            '<li><a class="dropdown-item" href="profile.html"><i class="fa-solid fa-user"></i> My Profile</a></li>' +
            '<li><a class="dropdown-item" href="cart.html"><i class="fa-solid fa-shopping-cart"></i> My Cart' + (cartCount > 0 ? ' <span class="cart-badge" style="background:var(--accent);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:700">' + cartCount + '</span>' : '') + '</a></li>' +
            '<li><a class="dropdown-item" href="profile.html#purchased"><i class="fa-solid fa-circle-check"></i> Purchased Leads</a></li>' +
            '<li><hr class="dropdown-divider"></li>' +
            '<li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="logoutUser()"><i class="fa-solid fa-right-from-bracket"></i> Logout</a></li>' +
          '</ul>' +
        '</div>' +
      '</div>';
  } else {
    box.innerHTML =
      '<div class="dropdown auth-dropdown">' +
        '<button class="btn-nav-login auth-dd-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
          '<i class="fa-regular fa-circle-user"></i> <span class="acct-label">Account</span>' +
          '<i class="fa-solid fa-chevron-down dd-caret"></i>' +
        '</button>' +
        '<ul class="dropdown-menu dropdown-menu-end auth-menu">' +
          '<li><a class="dropdown-item" href="login.html' + loginRedirectQuery() + '"><i class="fa-solid fa-right-to-bracket"></i> Login</a></li>' +
          '<li><hr class="dropdown-divider"></li>' +
          '<li><a class="dropdown-item" href="signup.html' + loginRedirectQuery() + '"><i class="fa-solid fa-user-plus"></i> Sign Up Free</a></li>' +
        '</ul>' +
      '</div>';
  }
}

function logoutUser() {
  Swal.fire({
    title: "Logout?", text: "You will be signed out", icon: "warning",
    showCancelButton: true, confirmButtonColor: "#dc3545", cancelButtonColor: "#6c757d", confirmButtonText: "Yes, Logout"
  }).then(function(result) {
    if (result.isConfirmed) {
      syncProfileToFirestore();
      if (typeof firebase !== 'undefined' && firebase.auth) firebase.auth().signOut();
      clearProfile();
      localStorage.removeItem("admin_token");
      try { localStorage.removeItem("auth_return_to"); } catch(e) {}
      Swal.fire({ icon: "success", title: "Logged Out", timer: 1000, showConfirmButton: false });
      setTimeout(function() { window.location.href = "index.html"; }, 1000);
    }
  });
}

function getNavHTML(activePage) {
  return '<nav class="navbar navbar-expand-lg navbar-modern">' +
    '<div class="container">' +
      '<button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#navMenu"><i class="fa-solid fa-bars"></i></button>' +
      '<a href="index.html" class="navbar-brand"><span class="brand-icon"><i class="fa-solid fa-graduation-cap"></i></span>NCR Home Tuition</a>' +
      '<div class="collapse navbar-collapse" id="navMenu">' +
        '<ul class="navbar-nav mx-auto">' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='home'?' active':'') + '" href="index.html">Home</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='how'?' active':'') + '" href="how-it-works.html">How It Works</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='student'?' active':'') + '" href="student-register.html">I Need a Tutor</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='tutor'?' active':'') + '" href="tutor-register.html">Join as Tutor</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='find'?' active':'') + '" href="findbyidtutor.html">Find Tutor</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='cart'?' active':'') + '" href="cart.html"><i class="fa-solid fa-shopping-cart"></i> Cart</a></li>' +
        '</ul>' +
      '</div>' +
      '<div class="auth-actions" id="authButtons"></div>' +
    '</div>' +
  '</nav>';
}

function getFooterHTML() {
  return '<footer class="footer"><div class="container"><div class="footer-bottom">&copy; 2026 NCR Home Tuition. All rights reserved.</div></div></footer>';
}