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
function getProfile() {
  try { var r = localStorage.getItem("user_profile"); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function saveProfile(p) { localStorage.setItem("user_profile", JSON.stringify(p)); }
function clearProfile() {
  localStorage.removeItem("user_profile");
  localStorage.removeItem("user_leads");
  localStorage.removeItem("user_cart");
  localStorage.removeItem("user_saved_profiles");
}
function isLoggedIn() { return !!getProfile(); }
function requireAuth() {
  if (!isLoggedIn()) {
    Swal.fire({
      icon: "info", title: "Login Required", text: "Please login or sign up to continue",
      confirmButtonText: "Login", confirmButtonColor: "#1a73e8",
      showCancelButton: true, cancelButtonText: "Sign Up Free"
    }).then(function(r) {
      if (r.isConfirmed) window.location.href = "login.html";
      else if (r.dismiss === Swal.DismissReason.cancel) window.location.href = "signup.html";
    });
    return false;
  }
  return true;
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
// SMART PRICING - based on number of profiles (leads) in cart
// 1-4 profiles = ₹99 each
// 5 profiles   = ₹399 (save ₹96)
// 6-9 profiles = ₹399 + extras at ₹99 each
// 10 profiles  = ₹699 (save ₹291)
// ============================================================

function calculateSmartPrice(totalLeads) {
  if (totalLeads <= 0) return { total: 0, perLead: 0, breakdown: [], savings: 0, originalTotal: 0 };
  var originalTotal = totalLeads * 99;

  if (totalLeads <= 4) {
    return { total: originalTotal, perLead: 99, breakdown: [{ desc: totalLeads + ' × ₹99', amount: originalTotal }], savings: 0, originalTotal: originalTotal };
  }
  if (totalLeads === 5) {
    return { total: 399, perLead: 80, breakdown: [{ desc: '5 Lead Package', amount: 399 }], savings: originalTotal - 399, originalTotal: originalTotal };
  }
  if (totalLeads < 10) {
    var extra = totalLeads - 5;
    var extraCost = extra * 99;
    var total = 399 + extraCost;
    return {
      total: total, perLead: Math.round(total / totalLeads),
      breakdown: [
        { desc: '5 Lead Package', amount: 399 },
        { desc: extra + ' × ₹99', amount: extraCost }
      ],
      savings: originalTotal - total, originalTotal: originalTotal
    };
  }
  if (totalLeads === 10) {
    return { total: 699, perLead: 70, breakdown: [{ desc: '10 Lead Package', amount: 699 }], savings: originalTotal - 699, originalTotal: originalTotal };
  }
  var packs = Math.floor(totalLeads / 10);
  var remainder = totalLeads % 10;
  var packCost = packs * 699;
  if (remainder === 0) {
    return { total: packCost, perLead: Math.round(packCost / totalLeads), breakdown: [{ desc: packs + ' × 10 Lead Package', amount: packCost }], savings: originalTotal - packCost, originalTotal: originalTotal };
  }
  if (remainder <= 4) {
    var remCost = remainder * 99;
    return {
      total: packCost + remCost, perLead: Math.round((packCost + remCost) / totalLeads),
      breakdown: [{ desc: packs + ' × 10 Lead Package', amount: packCost }, { desc: remainder + ' × ₹99', amount: remCost }],
      savings: originalTotal - (packCost + remCost), originalTotal: originalTotal
    };
  }
  if (remainder === 5) {
    return {
      total: packCost + 399, perLead: Math.round((packCost + 399) / totalLeads),
      breakdown: [{ desc: packs + ' × 10 Lead Package', amount: packCost }, { desc: '5 Lead Package', amount: 399 }],
      savings: originalTotal - (packCost + 399), originalTotal: originalTotal
    };
  }
  var rem5pack = 399;
  var remExtras = (remainder - 5) * 99;
  var grandTotal = packCost + rem5pack + remExtras;
  return {
    total: grandTotal, perLead: Math.round(grandTotal / totalLeads),
    breakdown: [{ desc: packs + ' × 10 Lead Package', amount: packCost }, { desc: '5 Lead Package', amount: rem5pack }, { desc: (remainder - 5) + ' × ₹99', amount: remExtras }],
    savings: originalTotal - grandTotal, originalTotal: originalTotal
  };
}

// Get smart price for current cart
function getCartPricing() {
  var count = getCartCount();
  return calculateSmartPrice(count);
}

// ---- Lead packages (info cards only, NOT cart items) ----
var LEAD_PACKAGES = [
  { id: "lead_1",  leads: 1,  price: 99,  label: "1 Lead",   per: 99,  desc: "Try it out",                    savings: null,  color: "blue",   popular: false },
  { id: "lead_5",  leads: 5,  price: 399, label: "5 Leads",  per: 80,  desc: "Best for getting started",      savings: "20%",  color: "orange", popular: true },
  { id: "lead_10", leads: 10, price: 699, label: "10 Leads", per: 70,  desc: "Best value overall",            savings: "30%",  color: "green",  popular: false }
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
    box.innerHTML =
      '<div class="auth-actions">' +
        '<a href="cart.html" class="btn-nav-login" style="display:flex;align-items:center;gap:6px;position:relative;text-decoration:none">' +
          '<i class="fa-solid fa-shopping-cart"></i> ' +
          '<span>Cart</span>' +
          (cartCount > 0 ? '<span class="cart-badge" style="background:var(--accent);color:#fff;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;min-width:18px;text-align:center">' + cartCount + '</span>' : '') +
        '</a>' +
        '<a href="profile.html" style="display:flex;align-items:center;gap:8px;text-decoration:none;padding:6px 12px;border-radius:var(--radius-full);transition:var(--transition)" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'transparent\'">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#2979ff);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">' + initial + '</div>' +
          '<span style="font-size:13px;font-weight:600;color:var(--text-primary);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (profile.displayName || "Account") + '</span>' +
        '</a>' +
        '<button class="btn-nav-login" onclick="logoutUser()" style="color:var(--danger);border:none;font-size:12px;padding:6px 10px">' +
          '<i class="fa-solid fa-right-from-bracket"></i>' +
        '</button>' +
      '</div>';
  } else {
    box.innerHTML =
      '<div class="dropdown auth-dropdown">' +
        '<button class="btn-nav-login auth-dd-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
          '<i class="fa-regular fa-circle-user"></i> Account' +
          '<i class="fa-solid fa-chevron-down dd-caret"></i>' +
        '</button>' +
        '<ul class="dropdown-menu dropdown-menu-end auth-menu">' +
          '<li><a class="dropdown-item" href="login.html"><i class="fa-solid fa-right-to-bracket"></i> Login</a></li>' +
          '<li><hr class="dropdown-divider"></li>' +
          '<li><a class="dropdown-item" href="signup.html"><i class="fa-solid fa-user-plus"></i> Sign Up Free</a></li>' +
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
      Swal.fire({ icon: "success", title: "Logged Out", timer: 1000, showConfirmButton: false });
      setTimeout(function() { window.location.href = "index.html"; }, 1000);
    }
  });
}

function getNavHTML(activePage) {
  return '<nav class="navbar navbar-expand-lg navbar-modern">' +
    '<div class="container">' +
      '<button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#navMenu"><span class="navbar-toggler-icon"></span></button>' +
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