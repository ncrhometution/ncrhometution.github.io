// ============================================================
// Firebase Auth Utility Module
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

// ---- Profile helpers ----
function getProfile() {
  try {
    const raw = localStorage.getItem("user_profile");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveProfile(profile) {
  localStorage.setItem("user_profile", JSON.stringify(profile));
}

function clearProfile() {
  localStorage.removeItem("user_profile");
  localStorage.removeItem("user_leads");
}

function isLoggedIn() {
  return !!getProfile();
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// ---- Lead wallet ----
function getLeads() {
  return parseInt(localStorage.getItem("user_leads") || "0", 10);
}

function addLeads(count) {
  const current = getLeads();
  localStorage.setItem("user_leads", String(current + count));
}

function useLead() {
  const current = getLeads();
  if (current <= 0) return false;
  localStorage.setItem("user_leads", String(current - 1));
  return true;
}

// ---- Lead packages ----
const LEAD_PACKAGES = [
  { id: "lead_1",  leads: 1,  price: 99,  label: "1 Lead",   desc: "Perfect for trying out",       savings: null },
  { id: "lead_5",  leads: 5,  price: 399, label: "5 Leads",  desc: "Most popular choice",          savings: "20%" },
  { id: "lead_10", leads: 10, price: 699, label: "10 Leads", desc: "Best value for serious tutors", savings: "30%" }
];

// ---- Render auth buttons for any page ----
function renderAuthButtons(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return;

  const profile = getProfile();
  if (profile) {
    const initial = (profile.displayName || profile.email || "U").charAt(0).toUpperCase();
    box.innerHTML = 
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<a href="cart.html" class="btn-nav-login" style="position:relative">' +
          '<i class="fa-solid fa-shopping-cart"></i> Cart ' +
          '<span id="cartBadge" style="background:var(--accent);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:2px">' + getLeads() + '</span>' +
        '</a>' +
        '<a href="profile.html" style="display:flex;align-items:center;gap:8px;text-decoration:none">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#2979ff);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">' + initial + '</div>' +
          '<span style="font-size:13px;font-weight:600;color:var(--text-primary)">' + (profile.displayName || "Account") + '</span>' +
        '</a>' +
        '<button class="btn-nav-login" onclick="logoutUser()" style="background:var(--danger-light);color:var(--danger);border-color:transparent;font-size:12px;padding:6px 12px">' +
          '<i class="fa-solid fa-right-from-bracket"></i> Logout' +
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
    text: "You will be signed out of your account",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc3545",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Yes, Logout"
  }).then(result => {
    if (result.isConfirmed) {
      // Sign out of Firebase if available
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut();
      }
      clearProfile();
      localStorage.removeItem("admin_token");
      Swal.fire({ icon: "success", title: "Logged Out", timer: 1000, showConfirmButton: false });
      setTimeout(() => { window.location.href = "index.html"; }, 1000);
    }
  });
}

// ---- Cart helpers ----
function getCart() {
  try {
    const raw = localStorage.getItem("user_cart");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem("user_cart", JSON.stringify(cart));
}

function addToCart(packageId) {
  const pkg = LEAD_PACKAGES.find(p => p.id === packageId);
  if (!pkg) return false;
  const cart = getCart();
  // Check if already in cart
  const existing = cart.find(i => i.id === packageId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: pkg.id, label: pkg.label, price: pkg.price, leads: pkg.leads, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  return true;
}

function removeFromCart(packageId) {
  let cart = getCart();
  cart = cart.filter(i => i.id !== packageId);
  saveCart(cart);
  updateCartBadge();
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function getCartLeadCount() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (item.leads * item.qty), 0);
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = getLeads();
}