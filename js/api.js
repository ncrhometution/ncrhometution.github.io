// ============================================================
// NCR Home Tuition - API Layer (FastAPI backend)
// Base: https://ncrhomr.vercel.app/
// ============================================================

var API_BASE = "https://ncrhomr.vercel.app/";

// ---- Endpoint map ----
var APIS = {
  home:            API_BASE,
  adminCreate:     API_BASE + "admin/create",
  adminLogin:      API_BASE + "admin/login",
  student:         API_BASE + "student",
  tutor:           API_BASE + "tutor",
  students:        API_BASE + "students",
  tutors:          API_BASE + "tutors",
  search:          API_BASE + "search",
  cities:          API_BASE + "cities",
  tutorById:       function(id) { return API_BASE + "tutor/" + encodeURIComponent(id); },
  studentById:     function(id) { return API_BASE + "student/" + encodeURIComponent(id); },
  experienceOpts:  API_BASE + "experience-options",
  sortOpts:        API_BASE + "sort-options",
  createOrder:     API_BASE + "payments/create-order",
  verifyPayment:   API_BASE + "payments/verify",
  webhook:         API_BASE + "payments/webhook",
  payments:        API_BASE + "payments",
  myPayments:      API_BASE + "payments/my",
  myPurchased:     API_BASE + "payments/my/profiles",
  adminLeads:      API_BASE + "admin/leads",
  adminLead:       function(leadType, id) { return API_BASE + "admin/leads/" + encodeURIComponent(leadType) + "/" + encodeURIComponent(id); },
  adminLeadStatus: function(leadType, id) { return API_BASE + "admin/leads/" + encodeURIComponent(leadType) + "/" + encodeURIComponent(id) + "/status"; },
  paymentById:     function(id) { return API_BASE + "payments/" + encodeURIComponent(id); },
  paymentByOrder:  function(id) { return API_BASE + "payments/order/" + encodeURIComponent(id); },
  paymentByRzp:    function(id) { return API_BASE + "payments/razorpay/" + encodeURIComponent(id); }
};

// ---- Error type ----
function APIError(message, status, detail) {
  this.name = "APIError";
  this.message = message || "Something went wrong";
  this.status = status || 0;
  this.detail = detail || null;
}
APIError.prototype = Object.create(Error.prototype);
APIError.prototype.constructor = APIError;

// ---- Friendly error messages ----
function getErrorMessage(err) {
  if (!err) return "Something went wrong. Please try again.";
  if (err instanceof APIError) {
    if (err.status === 0) return "Cannot reach the server. Check your internet connection and try again.";
    if (err.status === 401) return "Unauthorized. Please check your credentials.";
    if (err.status === 404) return "Not found. The record may have been removed.";
    if (err.status === 400) return err.message || "Invalid request. Please check your input.";
    if (err.status >= 500) return "Server error. Please try again in a moment.";
    return err.message || "Request failed.";
  }
  if (err && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

// ---- Core fetch wrapper ----
// api(path, { method, body, admin, params })
//  - body: object -> JSON.stringify + Content-Type header
//  - admin: true -> attach X-Admin-Token from localStorage
//  - params: object -> appended as query string
function api(path, opts) {
  opts = opts || {};
  var url = path;
  if (opts.params) {
    var qs = new URLSearchParams();
    Object.keys(opts.params).forEach(function(k) {
      var v = opts.params[k];
      if (v !== undefined && v !== null && v !== "") qs.append(k, v);
    });
    var s = qs.toString();
    if (s) url += (url.indexOf("?") === -1 ? "?" : "&") + s;
  }

  var headers = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.admin) {
    var token = getAdminToken();
    if (token) headers["X-Admin-Token"] = token;
  }

  return fetch(url, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  }).then(function(res) {
    return res.json().catch(function() { return {}; }).then(function(data) {
      if (!res.ok) {
        var msg = data.detail;
        if (msg && typeof msg === "object" && msg.message) msg = msg.message;
        if (typeof msg === "string") {
          throw new APIError(msg, res.status, data);
        }
        throw new APIError("Request failed (" + res.status + ")", res.status, data);
      }
      return data;
    });
  });
}

// ---- Admin token helpers ----
function getAdminToken() {
  try { return localStorage.getItem("admin_token") || ""; } catch (e) { return ""; }
}
function setAdminToken(token) {
  try { localStorage.setItem("admin_token", token); } catch (e) {}
}
function clearAdminToken() {
  try { localStorage.removeItem("admin_token"); } catch (e) {}
}
function isAdminLoggedIn() { return !!getAdminToken(); }

// ---- Admin ----
function adminLogin(username, password) {
  return api(APIS.adminLogin, { method: "POST", body: { username: username, password: password } });
}

// ---- Leads (student / tutor registration) ----
function submitLead(type, payload) {
  var endpoint = type === "tutor" ? APIS.tutor : APIS.student;
  return api(endpoint, { method: "POST", body: payload });
}

// ---- Search ----
function searchProfiles(params) {
  return api(APIS.search, { params: params });
}
function getCities() {
  return api(APIS.cities);
}
function getProfileById(type, id) {
  var t = String(type || "").toLowerCase();
  var endpoint = t === "tutor" ? APIS.tutorById(id) : APIS.studentById(id);
  return api(endpoint, { admin: isAdminLoggedIn() });
}

// ---- Payments ----
// createOrder({ email, mobile_no, amount, currency, user_type, user_ids })
function createOrder(payload) {
  return api(APIS.createOrder, { method: "POST", body: payload });
}
// verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature })
function verifyPayment(payload) {
  return api(APIS.verifyPayment, { method: "POST", body: payload });
}
// listPayments({ page, per_page, status, user_type, user_id }) - admin only
function listPayments(params) {
  return api(APIS.payments, { params: params, admin: true });
}
function getPaymentByOrder(orderId) {
  return api(APIS.paymentByOrder(orderId));
}
function getPaymentByRazorpay(paymentId) {
  return api(APIS.paymentByRzp(paymentId));
}
// getMyPayments(email, mobileNo, status) - public: all payment attempts for this buyer
// status optional: created, paid, authorized, failed, refunded
function getMyPayments(email, mobileNo, status) {
  return api(APIS.myPayments, { params: { email: email, mobile_no: mobileNo, status: status } });
}
// getMyPurchasedProfiles(email, mobileNo) - public: purchased profiles (full records incl. contact)
function getMyPurchasedProfiles(email, mobileNo) {
  return api(APIS.myPurchased, { params: { email: email, mobile_no: mobileNo } });
}

// ---- Admin: lead management ----
// listAdminLeads({ type: 'tutor'|'student', page, per_page, status, q }) - admin only
// Falls back to /students or /tutors if /admin/leads is not deployed yet.
function listAdminLeads(params) {
  return api(APIS.adminLeads, { params: params, admin: true }).catch(function(err) {
    if (err.status === 404) {
      var endpoint = String(params.type || "").toLowerCase() === "student" ? APIS.students : APIS.tutors;
      return api(endpoint, { params: { page: params.page || 1, per_page: params.per_page || 15 }, admin: true }).then(function(data) {
        return {
          status: "success",
          total: data.total || 0,
          page: data.page || 1,
          per_page: data.per_page || 15,
          data: data.data || []
        };
      });
    }
    throw err;
  });
}
// updateAdminLead(leadType, id, fields) - admin only
// Falls back to PUT /student/{id} or PUT /tutor/{id} if /admin/leads is not deployed.
function updateAdminLead(leadType, id, fields) {
  return api(APIS.adminLead(leadType, id), { method: "PUT", body: fields, admin: true }).catch(function(err) {
    if (err.status === 404) {
      var endpoint = String(leadType || "").toLowerCase() === "student" ? APIS.studentById(id) : APIS.tutorById(id);
      return api(endpoint, { method: "PUT", body: fields });
    }
    throw err;
  });
}
// changeAdminLeadStatus(leadType, id, status) - admin only
// Falls back to PUT /student/{id} or PUT /tutor/{id} with status field.
function changeAdminLeadStatus(leadType, id, status) {
  return api(APIS.adminLeadStatus(leadType, id), { method: "PATCH", body: { status: status }, admin: true }).catch(function(err) {
    if (err.status === 404) {
      var endpoint = String(leadType || "").toLowerCase() === "student" ? APIS.studentById(id) : APIS.tutorById(id);
      return api(endpoint, { method: "PUT", body: { status: status } });
    }
    throw err;
  });
}
// deleteAdminLead(leadType, id) - admin only
// No fallback: DELETE endpoints don't exist on the old deployed backend.
function deleteAdminLead(leadType, id) {
  return api(APIS.adminLead(leadType, id), { method: "DELETE", admin: true });
}

// ---- Razorpay checkout ----
// Loads checkout.js once, then opens the checkout for a created order.
// order = response of createOrder: { key_id, amount, currency, razorpay_order_id, ... }
// opts  = { name, description, prefill: {name,email,contact}, themeColor, onSuccess, onDismiss, onFailed }
function initPayments() {
  return new Promise(function(resolve, reject) {
    if (typeof Razorpay !== "undefined") { resolve(); return; }
    var s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = function() { resolve(); };
    s.onerror = function() { reject(new APIError("Could not load Razorpay checkout. Please try again.")); };
    document.head.appendChild(s);
  });
}

function openCheckout(order, opts) {
  opts = opts || {};
  return initPayments().then(function() {
    return new Promise(function(resolve, reject) {
      var options = {
        key: order.key_id,
        amount: order.amount,          // paise
        currency: order.currency || "INR",
        name: opts.name || "NCR Home Tuition",
        description: opts.description || "",
        image: opts.image || "favicon.svg",
        order_id: order.razorpay_order_id,
        prefill: opts.prefill || {},
        theme: { color: opts.themeColor || "#f59e0b" },
        handler: function(response) {
          resolve(response);           // { razorpay_payment_id, razorpay_order_id, razorpay_signature }
        },
        modal: {
          ondismiss: function() {
            reject(new APIError("Payment cancelled", 0, { cancelled: true }));
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.on("payment.failed", function(resp) {
        reject(new APIError("Payment failed. Please try again.", 0, resp));
      });
      rzp.open();
    });
  });
}

// ---- Lead wallet helpers (local, mirrors auth.js) ----
function getLeadsLocal() {
  try { return parseInt(localStorage.getItem("user_leads") || "0", 10); } catch (e) { return 0; }
}
function addLeadsLocal(count) {
  try { localStorage.setItem("user_leads", String(getLeadsLocal() + count)); } catch (e) {}
}