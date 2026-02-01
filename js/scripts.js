// ================== CONFIG ==================
// ✅ Usamos Google Sheets API (sin Apps Script) => NO CORS
const SPREADSHEET_ID = "1LqDeOHlXDaHSuEYHp3a_e8AF8ZC30lsTe20EC60oP5Q";
const SHEET_NAME = "Recetas"; // pestaña/hoja

// ================== CONFIG OAUTH (GIS) ==================
// Client ID (Recetas)
const OAUTH_CLIENT_ID = "67288443136-ejrcp541j16m5j9npnblvlpalu09u0oo.apps.googleusercontent.com";

// Pedimos openid/email/profile + userinfo + 1 scope extra para que "Testing" respete test users.
// (mismo criterio que tu Lista de Compras)
const OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  // ✅ leer/escribir en la planilla
  "https://www.googleapis.com/auth/spreadsheets"
].join(" ");


// LocalStorage OAuth
const LS_OAUTH = "recetas_oauth_token_v1";        // {access_token, expires_at}
const LS_OAUTH_EMAIL = "recetas_oauth_email_v1";  // email hint


// ================== HEADER: TÍTULO ==================
const header = document.querySelector("header")

const seccionTitulo = document.createElement("section")
seccionTitulo.classList = "titulo"
header.appendChild(seccionTitulo)

const h1 = document.createElement("h1")
h1.innerText = "RECETAS"
seccionTitulo.appendChild(h1)

// ================== HEADER: ESTADO + ACCIONES (OAuth) ==================
// (Copiado del estilo de "Comidas": pill + Conectar + Refresh)
const headerRow2 = document.createElement("div");
headerRow2.className = "header-row-2";
seccionTitulo.appendChild(headerRow2);

// pill estado
const syncPill = document.createElement("div");
syncPill.className = "sync-pill";
syncPill.innerHTML = `<span class="sync-dot"></span><span class="sync-text">Cargando…</span>`;
headerRow2.appendChild(syncPill);

// acciones (botones)
const headerActions = document.createElement("div");
headerActions.className = "header-actions";
headerRow2.appendChild(headerActions);

const btnConnect = document.createElement("button");
btnConnect.className = "btn-connect";
btnConnect.type = "button";
btnConnect.textContent = "Conectar";
headerActions.appendChild(btnConnect);

const btnRefresh = document.createElement("button");
btnRefresh.className = "btn-refresh";
btnRefresh.type = "button";
btnRefresh.textContent = "↻";
btnRefresh.title = "Reintentar conexión";
btnRefresh.style.display = "none";
headerActions.appendChild(btnRefresh);

function setSync(state, text) {
  syncPill.classList.remove("ok", "saving", "offline");
  if (state) syncPill.classList.add(state);
  syncPill.querySelector(".sync-text").textContent = text;
}

// ================== UI: estado conectado ==================
let connectedEmail = "";

function setConnectedEmail(email) {
  connectedEmail = (email || "").toString().toLowerCase().trim();
  const isConnected = !!connectedEmail;

  // el botón cambia según estado real
  btnConnect.textContent = isConnected ? "Cambiar cuenta" : "Conectar";
  btnConnect.title = isConnected ? `Conectado: ${connectedEmail}` : "Conectar";
  btnConnect.dataset.connected = isConnected ? "1" : "0";
}

// ================== MAIN ==================
const main = document.querySelector("main")

// ------- Sección para agregar receta -------
const seccionAgregar = document.createElement("section")
seccionAgregar.classList = "agregarReceta"
main.appendChild(seccionAgregar)

// Campo: título de la receta
const labelTitulo = document.createElement("label")
labelTitulo.innerText = "Título de la receta:"
labelTitulo.htmlFor = "titulo-receta"
seccionAgregar.appendChild(labelTitulo)

const inputTitulo = document.createElement("input")
inputTitulo.type = "text"
inputTitulo.id = "titulo-receta"
inputTitulo.placeholder = "Ej: Tarta de atún"
seccionAgregar.appendChild(inputTitulo)

// Campo: autor de la receta
const labelAutor = document.createElement("label")
labelAutor.innerText = "Autor:"
labelAutor.htmlFor = "autor-receta"
seccionAgregar.appendChild(labelAutor)

const inputAutor = document.createElement("input")
inputAutor.type = "text"
inputAutor.id = "autor-receta"
inputAutor.placeholder = "Ej: Mauricio"
seccionAgregar.appendChild(inputAutor)


// Campo: lista de ingredientes / pasos
const labelLista = document.createElement("label")
labelLista.innerText = "Ingredientes / pasos (uno por línea o separados por comas):"
labelLista.htmlFor = "lista-receta"
seccionAgregar.appendChild(labelLista)

const textareaLista = document.createElement("textarea")
textareaLista.id = "lista-receta"
textareaLista.rows = 5
textareaLista.placeholder = "Ej:\n2 huevos\n1 taza de leche\n1 pizca de sal"
seccionAgregar.appendChild(textareaLista)

// Campo: instrucciones de preparación (opcional)
const labelPrep = document.createElement("label")
labelPrep.innerText = "Instrucciones de preparación (opcional):"
labelPrep.htmlFor = "prep-receta"
seccionAgregar.appendChild(labelPrep)

const textareaPreparacion = document.createElement("textarea")
textareaPreparacion.id = "prep-receta"
textareaPreparacion.rows = 4
textareaPreparacion.placeholder = "Ej:\n1) Mezclá todo...\n2) Llevá al horno 40 min...\n(este campo es opcional)"
seccionAgregar.appendChild(textareaPreparacion)

// Botón: agregar receta
const buttonAgregar = document.createElement("button")
buttonAgregar.innerText = "Agregar receta"
seccionAgregar.appendChild(buttonAgregar)

// ------- Mural de recetas -------
const muralRecetas = document.createElement("section")
muralRecetas.classList = "mural-recetas"
main.appendChild(muralRecetas)

// ================== HELPERS UI AUTH (estilo Comidas) ==================
function showNeedConnectUI(message = "Necesita Conectar") {
  setSync("offline", message);
  setConnectedEmail("");
  btnConnect.disabled = false;
  btnRefresh.style.display = "inline-block";
}

function showConnectedUI(message = "Listo ✅") {
  setSync("ok", message);
  btnRefresh.style.display = "none";
  btnConnect.disabled = false;
}

// ================== OAUTH STATE ==================
let tokenClient = null;
let oauthAccessToken = "";
let oauthExpiresAt = 0;

// lock anti-carreras
let connectInFlight = null;
function isConnectBusy() { return !!connectInFlight; }

function isTokenValid() {
  return !!oauthAccessToken && Date.now() < (oauthExpiresAt - 10_000);
}

function loadStoredOAuth() {
  try {
    const raw = localStorage.getItem(LS_OAUTH);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed?.access_token || !parsed?.expires_at) return null;
    return { access_token: parsed.access_token, expires_at: Number(parsed.expires_at) };
  } catch { return null; }
}
function saveStoredOAuth(access_token, expires_at) {
  try { localStorage.setItem(LS_OAUTH, JSON.stringify({ access_token, expires_at })); } catch {}
}
function clearStoredOAuth() {
  try { localStorage.removeItem(LS_OAUTH); } catch {}
}

function loadStoredOAuthEmail() {
  try { return String(localStorage.getItem(LS_OAUTH_EMAIL) || "").trim().toLowerCase(); }
  catch { return ""; }
}
function saveStoredOAuthEmail(email) {
  try { localStorage.setItem(LS_OAUTH_EMAIL, (email || "").toString()); } catch {}
}
function clearStoredOAuthEmail() {
  try { localStorage.removeItem(LS_OAUTH_EMAIL); } catch {}
}

// ================== DEBUG: EXPIRAR TOKEN (para probar auto-reconnect) ==================
// Uso rápido en consola:
//   expirarTokenAhora()              -> expira token en memoria y prueba reconexión silent
//   expirarTokenAhora({ hard: true }) -> además borra localStorage y fuerza reconexión total
//   expirarTokenAhora({ hard: true, noReload: true }) -> no recarga recetas (solo prueba token)
window.expirarTokenAhora = async function expirarTokenAhora(opts = {}) {
  const hard = !!opts.hard;         // true = borrar localStorage también
  const noReload = !!opts.noReload; // true = no llamar cargarRecetasDesdeAPI()

  console.log("[TEST] Expirando token...", { hard, noReload });

  // 1) Expirar en memoria
  oauthExpiresAt = 0;
  oauthAccessToken = oauthAccessToken || ""; // deja el string, pero expira por expiresAt

  // 2) Opcional: borrar el token persistido (para forzar reconectar de verdad)
  if (hard) {
    clearStoredOAuth();
    // si querés además borrar el hint email, descomentá:
    // clearStoredOAuthEmail();
  }

  // 3) Reflejar UI (opcional, para que veas el estado)
  try { setSync("offline", "Token expirado (test)"); } catch {}

  // 4) Probar reconexión SILENT + recargar
  try {
    console.log("[TEST] Intentando reconectar SILENT...");
    const r = await runConnectFlow({ interactive: false, prompt: "" });
    console.log("[TEST] runConnectFlow result:", r);

    if (!noReload) {
      console.log("[TEST] Recargando recetas...");
      await cargarRecetasDesdeAPI();
      console.log("[TEST] OK: recetas recargadas");
    } else {
      console.log("[TEST] OK: noReload=true, no recargué recetas");
    }
  } catch (e) {
    console.warn("[TEST] Falló la reconexión silent:", e);
  }
};

async function fetchUserEmailFromToken(accessToken) {
  const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!r.ok) throw new Error("No se pudo obtener userinfo");
  const data = await r.json();
  return (data?.email || "").toString();
}

function initOAuth() {
  if (!window.google?.accounts?.oauth2?.initTokenClient) {
    throw new Error("GIS no está cargado (falta gsi/client en HTML)");
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: OAUTH_CLIENT_ID,
    scope: OAUTH_SCOPES,
    include_granted_scopes: true,
    use_fedcm_for_prompt: true,
    callback: () => {}
  });
}

// prompt: "" (silent), "consent", "select_account"
function requestAccessToken({ prompt, hint } = {}) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("OAuth no inicializado"));

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("popup_timeout_or_closed"));
    }, 45_000);

    tokenClient.callback = (resp) => {
      if (done) return;
      done = true;
      clearTimeout(timer);

      if (!resp || resp.error) {
        const err = String(resp?.error || "oauth_error");
        const sub = String(resp?.error_subtype || "");
        const msg = (err + (sub ? `:${sub}` : "")).toLowerCase();

        const e = new Error(err);
        e.isCanceled =
          msg.includes("popup_closed") ||
          msg.includes("popup_closed_by_user") ||
          msg.includes("access_denied") ||
          msg.includes("user_cancel") ||
          msg.includes("interaction_required");

        return reject(e);
      }

      const accessToken = resp.access_token;
      const expiresIn = Number(resp.expires_in || 3600);
      const expiresAt = Date.now() + (expiresIn * 1000);

      oauthAccessToken = accessToken;
      oauthExpiresAt = expiresAt;
      saveStoredOAuth(accessToken, expiresAt);

      resolve({ access_token: accessToken, expires_at: expiresAt });
    };

    const req = {};
    if (prompt !== undefined) req.prompt = prompt;
    if (hint && String(hint).includes("@")) req.hint = hint;

    try { tokenClient.requestAccessToken(req); }
    catch (e) { clearTimeout(timer); reject(e); }
  });
}

// allowInteractive=false => NO popup
async function ensureOAuthToken(allowInteractive = false, interactivePrompt = "consent") {
  // 1) token en memoria
  if (isTokenValid()) return oauthAccessToken;

  // 2) token guardado válido
  const stored = loadStoredOAuth();
  if (stored?.access_token && stored?.expires_at && Date.now() < (stored.expires_at - 10_000)) {
    oauthAccessToken = stored.access_token;
    oauthExpiresAt = Number(stored.expires_at);
    return oauthAccessToken;
  }

  const hintEmail = (loadStoredOAuthEmail() || "").trim().toLowerCase();

  // corte: si no es interactivo y no hay hint => no llamar GIS
  if (!allowInteractive && !hintEmail) throw new Error("TOKEN_NEEDS_INTERACTIVE");

  // 3) silent
  try {
    await requestAccessToken({ prompt: "", hint: hintEmail || undefined });
    if (isTokenValid()) return oauthAccessToken;
  } catch (e) {
    if (!allowInteractive) throw new Error("TOKEN_NEEDS_INTERACTIVE");
  }

  // 4) interactivo
  await requestAccessToken({ prompt: interactivePrompt ?? "consent", hint: hintEmail || undefined });
  if (!isTokenValid()) throw new Error("TOKEN_NEEDS_INTERACTIVE");

  return oauthAccessToken;
}

// ================== API client (POST text/plain JSON) ==================
async function apiPost_(payload) {
  // payload: { mode, access_token, ... }
  const mode = (payload?.mode || "").toString().toLowerCase();
  const token = (payload?.access_token || "").toString();
  if (!token) return { ok: false, error: "auth_required" };

  const sheetEsc = encodeURIComponent(SHEET_NAME);

  // helper: parsear items desde celda (puede venir como JSON ["a","b"] o texto "a, b")
  function parseItemsCell_(cellValue) {
    const s = (cellValue ?? "").toString().trim();
    if (!s) return [];
    // intenta JSON
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(x => (x ?? "").toString()).filter(Boolean);
    } catch {}
    // fallback: separar por coma
    return s.split(",").map(x => x.trim()).filter(Boolean);
  }

  try {
    // ---------- WHOAMI ----------
    if (mode === "whoami") {
      const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return { ok: false, error: "whoami_failed" };
      const data = await r.json();
      return { ok: true, email: (data?.email || "").toString().toLowerCase().trim() };
    }

    // ---------- GET (listar recetas) ----------
    if (mode === "get") {
      // Tu Sheet real (según captura):
      // A=titulo | B=items | C=autor | D=preparacion | E=timestamp
      const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SPREADSHEET_ID)}` +
        `/values/${sheetEsc}!A2:E?majorDimension=ROWS`;

      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const txt = await r.text();
      if (!r.ok) return { ok: false, error: "get_failed", detail: txt.slice(0, 800) };

      const json = JSON.parse(txt);
      const values = Array.isArray(json?.values) ? json.values : [];

      const recetas = values
        .filter(row => (row?.[0] || "").toString().trim() !== "")
        .map(row => {
          const titulo = (row?.[0] || "").toString();
          const itemsCell = (row?.[1] || "").toString();
          const autor = (row?.[2] || "").toString();
          const preparacion = (row?.[3] || "").toString();
          const createdAt = (row?.[4] || "").toString();

          const items = parseItemsCell_(itemsCell);

          return { titulo, autor, items, preparacion, createdAt };
        });

      // más nueva a más vieja (append agrega abajo)
      recetas.reverse();

      return { ok: true, recetas };
    }

    // ---------- ADD ----------
    if (mode === "add") {
      const titulo = (payload?.titulo || "").toString().trim();
      const autor = (payload?.autor || "").toString().trim() || "Anónimo";
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const preparacion = (payload?.preparacion || "").toString();

      if (!titulo) return { ok: false, error: "bad_request", detail: "titulo requerido" };
      const cleanItems = items.map(x => (x || "").toString().trim()).filter(Boolean);
      if (cleanItems.length === 0) return { ok: false, error: "bad_request", detail: "items requerido" };

      const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SPREADSHEET_ID)}` +
        `/values/${sheetEsc}!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      // Guardamos en el orden REAL de tu Sheet:
      // A=titulo | B=items (json) | C=autor | D=preparacion | E=timestamp
      const row = [
        titulo,
        JSON.stringify(cleanItems),
        autor,
        preparacion || "",
        new Date().toISOString()
      ];

      const body = { values: [row] };

      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const txt = await r.text();
      if (!r.ok) return { ok: false, error: "add_failed", detail: txt.slice(0, 800) };

      return { ok: true, saved: true };
    }

    // ---------- PING ----------
    if (mode === "ping") return { ok: true, pong: true };

    return { ok: false, error: "bad_mode" };
  } catch (e) {
    return { ok: false, error: "network_error", detail: String(e?.message || e) };
  }
}

// ================== API call wrapper (usa OAuth token + apiPost_) ==================
async function apiCall(mode, payload = {}, opts = {}) {
  const allowInteractive = !!opts.allowInteractive;

  // asegura token (silent o interactive según opts)
  let token = await ensureOAuthToken(allowInteractive, opts.interactivePrompt || "consent");

  const body = { mode, access_token: token, ...(payload || {}) };

  let data = await apiPost_(body);

  // retry si falta scope / auth / whoami
  if (!data?.ok && (data?.error === "missing_scope" || data?.error === "auth_required" || data?.error === "whoami_failed")) {
    token = await ensureOAuthToken(true, "consent");
    body.access_token = token;
    data = await apiPost_(body);
  }

  return data || { ok: false, error: "empty_response" };
}

// ================== VERIFY BACKEND (whoami) + guardar email/hint ==================
async function verifyBackendAccessOrThrow(allowInteractive) {
  const who = await apiCall("whoami", {}, { allowInteractive });
  if (!who?.ok) throw new Error(who?.error || "whoami_failed");

  // guardo email (hint) para reconexión silenciosa
  const email = (who?.email || "").toString().toLowerCase().trim();
  if (email) saveStoredOAuthEmail(email);

  // actualiza UI conectado
  setConnectedEmail(email);

  // pill corto (no mostrar email largo)
  if (email) setSync("ok", "Listo ✅");

  return who;
}

async function runConnectFlow({ interactive, prompt } = { interactive: false, prompt: "consent" }) {
  if (connectInFlight) return connectInFlight;

  connectInFlight = (async () => {
    try {
      setSync("saving", interactive ? "Conectando…" : "Reconectando…");

      // 1) token (silent o interactive)
      await ensureOAuthToken(!!interactive, prompt || "consent");

      // 2) whoami (valida + guarda email + actualiza botón)
      await verifyBackendAccessOrThrow(!!interactive);

      // 3) listo (NO cargar recetas acá para evitar recursión)
      setSync("ok", "Listo ✅");
      btnRefresh.style.display = "none";

      return { ok: true };
    } catch (e) {
      setConnectedEmail("");

      const msg = String(e?.message || e || "");
      if (msg === "TOKEN_NEEDS_INTERACTIVE") {
        showNeedConnectUI("Necesita Conectar");
        return { ok: false, needsInteractive: true };
      }
      if (e?.isCanceled) {
        setSync("offline", "Conexión cancelada");
        btnRefresh.style.display = "inline-block";
        return { ok: false, canceled: true };
      }

      showNeedConnectUI("Necesita Conectar");
      return { ok: false, error: msg };
    } finally {
      connectInFlight = null;
    }
  })();

  return connectInFlight;
}

// ================== UI: Conectar / Refresh (estilo Comidas) ==================
btnConnect.addEventListener("click", () => {
  // En localhost: no intentar OAuth ni API (CORS). Solo avisar.
  try {
    setSync("saving", "Abriendo Google…");

    const hintEmail = (loadStoredOAuthEmail() || "").trim().toLowerCase();

    // abre el popup inmediatamente (gesto de usuario)
    requestAccessToken({
      prompt: "select_account",
      hint: hintEmail || undefined
    })
      .then(async () => {
        // token ya guardado en oauthAccessToken/oauthExpiresAt
        await verifyBackendAccessOrThrow(true);
        btnRefresh.style.display = "none";
        await cargarRecetasDesdeAPI();
      })
      .catch((e) => {
        if (e?.isCanceled) setSync("offline", "Conexión cancelada");
        else setSync("offline", "Necesita Conectar");

        btnRefresh.style.display = "inline-block";
        console.warn("No se pudo conectar:", e);
      });

  } catch (e) {
    setSync("offline", "Necesita Conectar");
    btnRefresh.style.display = "inline-block";
    console.warn("Error abriendo popup:", e);
  }
});

btnRefresh.addEventListener("click", async () => {
  // reintentar sin popup (silent)
  await runConnectFlow({ interactive: false, prompt: "" });
  await cargarRecetasDesdeAPI();
});

// ================== FUNCIONES API ==================

// Cargar recetas desde Google Sheets (vía Apps Script)
async function cargarRecetasDesdeAPI() {
  try {
    setSync("saving", "Cargando…");

    const resp = await apiCall("get", {}, { allowInteractive: false });
    if (!resp?.ok) {
      console.error("GET recetas FAIL:", resp);

      const err = String(resp?.error || "");
      if (err === "auth_required" || err === "missing_scope" || err === "whoami_failed") {
        showNeedConnectUI("Necesita Conectar");
      } else {
        setSync("offline", "No se pudo cargar");
        btnRefresh.style.display = "inline-block";
      }
      return;
    }

    const recetas = Array.isArray(resp?.recetas) ? resp.recetas : [];

    muralRecetas.innerHTML = "";

    recetas.forEach((receta, index) => {
      const card = document.createElement("article");
      card.classList.add("receta-card");

      if (index % 2 === 0) card.classList.add("receta-oscura");
      else card.classList.add("receta-clara");

      const titulo = document.createElement("h2");
      titulo.innerText = receta.titulo;
      card.appendChild(titulo);

      const autor = document.createElement("p");
      autor.classList.add("autor-receta");
      autor.innerText = "Autor: " + (receta.autor || "Sin autor");
      card.appendChild(autor);

      const ul = document.createElement("ul");
      (receta.items || []).forEach(textoItem => {
        const li = document.createElement("li");
        li.innerText = textoItem;
        ul.appendChild(li);
      });
      card.appendChild(ul);

      if ((receta.preparacion || "").trim() !== "") {
        const subtituloPrep = document.createElement("h3");
        subtituloPrep.classList.add("prep-titulo");
        subtituloPrep.innerText = "Preparación";
        card.appendChild(subtituloPrep);

        const ol = document.createElement("ol");
        ol.classList.add("prep-lista");

        const pasos = receta.preparacion.split("\n").map(p => p.trim()).filter(p => p !== "");
        pasos.forEach(pasoTexto => {
          const liPaso = document.createElement("li");
          liPaso.innerText = pasoTexto;
          ol.appendChild(liPaso);
        });

        card.appendChild(ol);
      }

      const btnCopiar = document.createElement("button");
      btnCopiar.innerText = "Copiar receta";
      btnCopiar.classList.add("btn-copiar-receta");

      btnCopiar.addEventListener("click", () => {
        let texto = receta.titulo + "\n\n" + (receta.items || []).join("\n");
        if ((receta.preparacion || "").trim() !== "") {
          texto += "\n\nPreparación:\n" + receta.preparacion.trim();
        }

        navigator.clipboard.writeText(texto)
          .then(() => {
            btnCopiar.innerText = "¡Copiado!";
            setTimeout(() => btnCopiar.innerText = "Copiar receta", 1500);
          })
          .catch(() => alert("No se pudo copiar 😢"));
      });

      card.appendChild(btnCopiar);
      muralRecetas.appendChild(card);
    });

    showConnectedUI("Listo ✅");
    btnRefresh.style.display = "none";
  } catch (err) {
    console.error("Error al cargar recetas", err);

    const msg = String(err?.message || err || "");
    if (msg === "TOKEN_NEEDS_INTERACTIVE") {
      showNeedConnectUI("Necesita Conectar");
      return;
    }

    setSync("offline", "No se pudo cargar");
    btnRefresh.style.display = "inline-block";
  }
}


// Agregar receta nueva a la hoja (usando GET con modo=add)
async function agregarRecetaAPI(titulo, textoLista) {
  const tituloLimpio = (titulo || "").trim();
  const textoLimpio = (textoLista || "").trim();
  const autorLimpio = (inputAutor.value || "Anónimo").trim();
  const prepLimpia  = (textareaPreparacion.value || "").trim();

  if (!tituloLimpio || !textoLimpio) return;

  let items = textoLimpio.includes("\n") ? textoLimpio.split("\n") : textoLimpio.split(",");
  items = items.map(t => t.trim()).filter(t => t !== "");
  if (!items.length) return;

  try {
    // si no hay token, intentamos silent primero; si no se puede, mostramos popup
    const r0 = await runConnectFlow({ interactive: false, prompt: "" });
    if (!r0?.ok && r0?.needsInteractive) {
      const r1 = await runConnectFlow({ interactive: true, prompt: "consent" });
      if (!r1?.ok) return;
    }

    const resp = await apiCall("add", {
      titulo: tituloLimpio,
      autor: autorLimpio,
      items,
      preparacion: prepLimpia
    }, { allowInteractive: false });

    if (!resp?.ok) {
      console.error("ADD receta FAIL:", resp);
      alert("No se pudo guardar la receta.");
      return;
    }

    await cargarRecetasDesdeAPI();
  } catch (err) {
    console.error("Error al agregar receta", err);
  }
}

// ================== EVENTOS ==================

// Click en "Agregar receta"
buttonAgregar.addEventListener("click", () => {
  agregarRecetaAPI(inputTitulo.value, textareaLista.value)
  inputTitulo.value = ""
  textareaLista.value = ""
  inputAutor.value = ""
  textareaPreparacion.value = ""   // 👈 NUEVO
  inputTitulo.focus()
})


// Enter en título -> pasa al textarea
inputTitulo.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault()
    textareaLista.focus()
  }
})

// Cargar al iniciar
window.addEventListener("load", async () => {
  // OAuth init + cargar token guardado
  try {
    initOAuth();

    const stored = loadStoredOAuth();
    if (stored?.access_token && Date.now() < (stored.expires_at - 10_000)) {
      oauthAccessToken = stored.access_token;
      oauthExpiresAt = stored.expires_at;
    }
  } catch (e) {
    console.error("OAuth init error:", e);
  }

  // Estado inicial
  setSync("saving", "Cargando…");

  // Auto-sync al cargar (SIN popup)
  if (navigator.onLine !== false) {
    const hint = loadStoredOAuthEmail();
    const stored = loadStoredOAuth();

    if (hint || (stored?.access_token && stored?.expires_at)) {
      await runConnectFlow({ interactive: false, prompt: "" });
      // después de conectar, cargamos recetas
      await cargarRecetasDesdeAPI();
    } else {
      showNeedConnectUI("Necesita Conectar");
    }
  } else {
    setSync("offline", "Sin conexión");
    btnRefresh.style.display = "none";
  }
});

// auto-refresh token silencioso (evita pedir reconectar manual)
setInterval(async () => {
  try {
    if (document.visibilityState !== "visible") return;
    if (isConnectBusy()) return;
    if (!oauthAccessToken) return;

    // si falta poco para expirar, intento silencioso
    if (Date.now() < (oauthExpiresAt - 120_000)) return;

    await ensureOAuthToken(false);

    // si logró renovar, refresco datos sin popup
    if (isTokenValid()) {
      await runConnectFlow({ interactive: false, prompt: "" });
      await cargarRecetasDesdeAPI();
    }
  } catch {}
}, 20_000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!isTokenValid()) return;

  runConnectFlow({ interactive: false, prompt: "" })
    .then(() => cargarRecetasDesdeAPI())
    .catch(() => {});
});

