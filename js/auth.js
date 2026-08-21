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

// ---- Profile helpers (localStorage) ----
function getProfile() {
  try { var r = localStorage.getItem("user_profile"); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function saveProfile(p) { localStorage.setItem("user_profile", JSON.stringify(p)); }
function clearProfile() {
  localStorage.removeItem("user_profile");
  localStorage.removeItem("user_leads");
  localStorage.removeItem("user_cart");
}
function isLoggedIn() { return !!getProfile(); }
function requireAuth(redirectUrl) {
  if (!isLoggedIn()) {
    Swal.fire({
      icon: "info",
      title: "Login Required",
      text: "Please login or sign up to continue",
      confirmButtonText: "Login",
      confirmButtonColor: "#1a73e8",
      showCancelButton: true,
      cancelButtonText: "Sign Up Free"
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
    Swal.fire({
      icon: "success",
      title: "Welcome, " + name + "!",
      text: "Successfully logged in",
      timer: 2500,
      showConfirmButton: false,
      toast: true,
      position: "top-end"
    });
    // Remove ?welcome=1 from URL
    var url = new URL(window.location);
    url.searchParams.delete("welcome");
    window.history.replaceState({}, "", url);
  }
}

// ---- Lead wallet ----
function getLeads() { return parseInt(localStorage.getItem("user_leads") || "0", 10); }
function setLeads(n) { localStorage.setItem("user_leads", String(n)); }
function addLeads(count) { setLeads(getLeads() + count); }
function useLead() {
  var c = getLeads();
  if (c <= 0) return false;
  setLeads(c - 1);
  syncCartToFirestore();
  return true;
}

// ---- Lead packages ----
var LEAD_PACKAGES = [
  { id: "lead_1",  leads: 1,  price: 99,  label: "1 Lead",   per: 99,  desc: "Try it out",          savings: null,  color: "blue",   icon: "fa-solid fa-bolt" },
  { id: "lead_5",  leads: 5,  price: 399, label: "5 Leads",  per: 80,  desc: "Best for getting started", savings: "20%",  color: "orange", popular: true, icon: "fa-solid fa-fire" },
  { id: "lead_10", leads: 10, price: 699, label: "10 Leads", per: 70,  desc: "Best value overall",   savings: "30%",  color: "green",  icon: "fa-solid fa-crown" }
];

// ---- Cart (localStorage) ----
function getCart() { try { var r = localStorage.getItem("user_cart"); return r ? JSON.parse(r) : []; } catch(e) { return []; } }
function saveCart(c) { localStorage.setItem("user_cart", JSON.stringify(c)); }
function addToCart(pkgId) {
  var pkg = LEAD_PACKAGES.find(function(p) { return p.id === pkgId; });
  if (!pkg) return false;
  var cart = getCart();
  var ex = cart.find(function(i) { return i.id === pkgId; });
  if (ex) ex.qty += 1;
  else cart.push({ id: pkg.id, label: pkg.label, price: pkg.price, leads: pkg.leads, qty: 1 });
  saveCart(cart);
  syncCartToFirestore();
  return true;
}
function removeFromCart(pkgId) {
  var cart = getCart().filter(function(i) { return i.id !== pkgId; });
  saveCart(cart);
  syncCartToFirestore();
}
function clearCart() { saveCart([]); syncCartToFirestore(); }
function getCartTotal() { return getCart().reduce(function(s, i) { return s + (i.price * i.qty); }, 0); }
function getCartLeadCount() { return getCart().reduce(function(s, i) { return s + (i.leads * i.qty); }, 0); }
function getCartItemCount() { return getCart().reduce(function(s, i) { return s + i.qty; }, 0); }

// ---- Saved profiles (viewed contacts) ----
function getSavedProfiles() { try { var r = localStorage.getItem("user_saved_profiles"); return r ? JSON.parse(r) : []; } catch(e) { return []; } }
function saveProfileToList(profile) {
  var list = getSavedProfiles();
  if (!list.find(function(p) { return p.id === profile.id && p.type === profile.type; })) {
    list.push(profile);
    localStorage.setItem("user_saved_profiles", JSON.stringify(list));
    syncSavedToFirestore();
  }
}
function removeSavedProfile(id, type) {
  var list = getSavedProfiles().filter(function(p) { return !(p.id === id && p.type === type); });
  localStorage.setItem("user_saved_profiles", JSON.stringify(list));
  syncSavedToFirestore();
}
function isProfileSaved(id, type) {
  return getSavedProfiles().some(function(p) { return p.id === id && p.type === type; });
}

// ---- Firestore sync ----
function syncCartToFirestore() {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  var profile = getProfile();
  if (!profile || !profile.uid) return;
  firebase.firestore().collection("users").doc(profile.uid).set({
    cart: getCart(),
    leads: getLeads(),
    savedProfiles: getSavedProfiles(),
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(function() {});
}

function syncSavedToFirestore() {
  syncCartToFirestore();
}

function loadCartFromFirestore() {
  return new Promise(function(resolve) {
    if (typeof firebase === 'undefined' || !firebase.firestore) { resolve(); return; }
    var profile = getProfile();
    if (!profile || !profile.uid) { resolve(); return; }
    firebase.firestore().collection("users").doc(profile.uid).get()
      .then(function(doc) {
        if (doc.exists) {
          var data = doc.data();
          if (data.cart && data.cart.length > 0) saveCart(data.cart);
          if (typeof data.leads === 'number') setLeads(data.leads);
          if (data.savedProfiles && data.savedProfiles.length > 0) {
            localStorage.setItem("user_saved_profiles", JSON.stringify(data.savedProfiles));
          }
          // Also restore profile fields from Firestore
          if (data.mobile_no && !profile.mobile_no) profile.mobile_no = data.mobile_no;
          if (data.displayName && !profile.displayName) profile.displayName = data.displayName;
          if (data.role && !profile.role) profile.role = data.role;
          saveProfile(profile);
        }
        resolve();
      })
      .catch(function() { resolve(); });
  });
}

// ---- Save full profile to Firestore ----
function syncProfileToFirestore() {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  var profile = getProfile();
  if (!profile || !profile.uid) return;
  firebase.firestore().collection("users").doc(profile.uid).set({
    displayName: profile.displayName,
    email: profile.email,
    mobile_no: profile.mobile_no,
    role: profile.role,
    cart: getCart(),
    leads: getLeads(),
    savedProfiles: getSavedProfiles(),
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(function() {});
}

// ---- Update profile fields ----
function updateProfile(fields) {
  var profile = getProfile();
  if (!profile) return false;
  Object.assign(profile, fields);
  saveProfile(profile);
  syncProfileToFirestore();
  return true;
}

// ---- Render auth buttons for any page ----
function renderAuthButtons(containerId) {
  var box = document.getElementById(containerId);
  if (!box) return;
  var profile = getProfile();
  if (profile) {
    var initial = (profile.displayName || profile.email || "U").charAt(0).toUpperCase();
    box.innerHTML =
      '<div class="auth-actions">' +
        '<a href="cart.html" class="btn-nav-login" style="display:flex;align-items:center;gap:6px;position:relative">' +
          '<i class="fa-solid fa-shopping-cart"></i> ' +
          '<span>Cart</span>' +
          '<span class="cart-badge" style="background:var(--accent);color:#fff;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;min-width:18px;text-align:center">' + getLeads() + '</span>' +
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
      '<a href="login.html" class="btn-nav-login">Login</a>' +
      '<a href="signup.html" class="btn-nav-signup">Sign Up Free</a>';
  }
}

// ---- Logout ----
function logoutUser() {
  Swal.fire({
    title: "Logout?",
    text: "You will be signed out",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc3545",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Yes, Logout"
  }).then(function(result) {
    if (result.isConfirmed) {
      syncProfileToFirestore();
      if (typeof firebase !== 'undefined' && firebase.auth) firebase.auth().signOut();
      clearProfile();
      localStorage.removeItem("admin_token");
      localStorage.removeItem("user_saved_profiles");
      Swal.fire({ icon: "success", title: "Logged Out", timer: 1000, showConfirmButton: false });
      setTimeout(function() { window.location.href = "index.html"; }, 1000);
    }
  });
}

// ---- Nav HTML template ----
function getNavHTML(activePage) {
  return '<nav class="navbar navbar-expand-lg navbar-modern">' +
    '<div class="container">' +
      '<a href="index.html" class="navbar-brand">' +
        '<span class="brand-icon"><i class="fa-solid fa-graduation-cap"></i></span>' +
        'NCR Home Tuition' +
      '</a>' +
      '<button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#navMenu"><span class="navbar-toggler-icon"></span></button>' +
      '<div class="collapse navbar-collapse" id="navMenu">' +
        '<ul class="navbar-nav mx-auto">' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='home'?' active':'') + '" href="index.html">Home</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='how'?' active':'') + '" href="how-it-works.html">How It Works</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='student'?' active':'') + '" href="student-register.html">I Need a Tutor</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='tutor'?' active':'') + '" href="tutor-register.html">Join as Tutor</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='find'?' active':'') + '" href="findbyidtutor.html">Find Tutor</a></li>' +
          '<li class="nav-item"><a class="nav-link' + (activePage==='cart'?' active':'') + '" href="cart.html"><i class="fa-solid fa-shopping-cart"></i> Cart</a></li>' +
        '</ul>' +
        '<div class="auth-actions" id="authButtons"></div>' +
      '</div>' +
    '</div>' +
  '</nav>';
}

// ---- Footer HTML template ----
function getFooterHTML() {
  return '<footer class="footer"><div class="container"><div class="footer-bottom">&copy; 2026 NCR Home Tuition. All rights reserved.</div></div></footer>';
}