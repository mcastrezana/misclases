/* ================================================
   MisClases — app.js  (Motor completo de la app)
   LocalStorage como BD  |  PWA-ready
   ================================================ */

const App = (() => {

/* ─── ESTADO GLOBAL ─── */
let currentUser = null;    // { role:'teacher'|'student', id, name }
let currentStudentGroup = null;
let currentGroupId = null; // para vistas de detalle
let currentActivityId = null;
let previousTeacherSection = 'groups';
let attendanceTempData = {};
let participationTempData = {};

/* ─── ALMACENAMIENTO ─── */
const DB = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  getTeacher: () => DB.get('teacher_profile') || { name:'Mtra. Nombre Apellido', phone:'', email:'', pass:'1234' },
  getRubrics: () => DB.get('rubrics') || {
    bach: [
      { key:'asistencia', label:'Asistencia', pct:10 },
      { key:'participacion', label:'Participación', pct:20 },
      { key:'actividades', label:'Actividades', pct:20 },
      { key:'tareas', label:'Tareas', pct:10 },
      { key:'proyecto', label:'Proyecto Integrador', pct:40 }
    ],
    lic: [
      { key:'asistencia', label:'Asistencia', pct:10 },
      { key:'participacion', label:'Participación', pct:10 },
      { key:'tareas', label:'Tareas', pct:10 },
      { key:'actividades', label:'Actividades', pct:10 },
      { key:'colaborativo', label:'Trabajo Colaborativo', pct:20 },
      { key:'autogestion', label:'Autogestión y Autoaprendizaje', pct:20 },
      { key:'desarrollo', label:'Desarrollo Personal', pct:20 },
      { key:'proyecto', label:'Proyecto Integrador', pct:20 }
    ]
  },
  getProjectWeights: () => DB.get('project_weights') || { teorico:50, expo:50 },
  getGroups: () => DB.get('groups') || [],
  setGroups: (g) => DB.set('groups', g),
  getGroup: (id) => (DB.getGroups()).find(g => g.id === id),
  getActivities: () => DB.get('activities') || [],
  setActivities: (a) => DB.set('activities', a),
  getActivitiesByGroup: (gid) => DB.getActivities().filter(a => a.groupId === gid),
  getActivity: (id) => DB.getActivities().find(a => a.id === id),
  getSubmissions: () => DB.get('submissions') || [],
  setSubmissions: (s) => DB.set('submissions', s),
  getSubmissionsByActivity: (aid) => DB.getSubmissions().filter(s => s.activityId === aid),
  getSubmission: (aid, studentName) => DB.getSubmissions().find(s => s.activityId === aid && s.studentName === studentName),
  getAttendance: () => DB.get('attendance') || [],
  setAttendance: (a) => DB.set('attendance', a),
  getWallPosts: () => DB.get('wall_posts') || [],
  setWallPosts: (p) => DB.set('wall_posts', p),
  getLogs: () => DB.get('interaction_logs') || [],
  addLog: (entry) => {
    const logs = DB.getLogs();
    logs.unshift({ ...entry, ts: Date.now() });
    if (logs.length > 500) logs.length = 500;
    DB.set('interaction_logs', logs);
  },
  getGrades: () => DB.get('grades') || {},
  setGrades: (g) => DB.set('grades', g)
};

/* ─── UTILIDADES ─── */
const uid = () => Math.random().toString(36).substr(2,9);
const fmt = (d) => new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
const fmtTs = (ts) => new Date(ts).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const norm = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

function toast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 2500);
}

function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay'))
    document.getElementById('modal-overlay').classList.remove('active');
}

/* ─── PANTALLAS ─── */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

/* ─── SPLASH ─── */
function initSplash() {
  // Forzar transicion aunque haya error
  function doTransition() {
    try {
      const splash = document.getElementById('splash');
      if (splash) splash.classList.remove('active');
      const saved = DB.get('current_session');
      if (saved && saved.role) {
        currentUser = saved;
        if (currentUser.role === 'teacher') loadTeacherApp();
        else loadStudentApp();
      } else {
        showScreen('login');
      }
    } catch(e) {
      console.error('initSplash error:', e);
      showScreen('login');
    }
  }
  setTimeout(doTransition, 1200);
  // Respaldo: si en 3s sigue en splash, forzar login
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash && splash.classList.contains('active')) {
      splash.classList.remove('active');
      showScreen('login');
    }
  }, 3000);
}

/* ─── AUTH DOCENTE ─── */
function login() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const prof = DB.getTeacher();
  if ((u === prof.email || u === 'admin' || u === 'maestra') && p === prof.pass) {
    currentUser = { role:'teacher', id:'teacher', name: prof.name };
    DB.set('current_session', currentUser);
    loadTeacherApp();
  } else {
    const e = document.getElementById('login-error');
    e.textContent = 'Usuario o contraseña incorrectos'; e.style.display='block';
  }
}

function logout() {
  DB.set('current_session', null);
  currentUser = null;
  showScreen('login');
}

/* ─── AUTH ESTUDIANTE ─── */
function goStudentLogin() { showScreen('student-login'); showStudentStep(3); }

function studentLoginDirect() {
  const userInput = (document.getElementById('student-login-name')?.value || '').trim();
  const pass = document.getElementById('student-login-passw')?.value || '';
  const code = (document.getElementById('student-group-code-login')?.value || '').trim().toUpperCase();
  const errEl = document.getElementById('student-login-error');
  if (errEl) errEl.style.display = 'none';
  if (!userInput || !pass) {
    if(errEl){errEl.textContent='Ingresa tu usuario y contrasena';errEl.style.display='block';}
    return;
  }
  // Buscar en todos los grupos si no se proporciona código, o en el grupo específico
  const groups = DB.getGroups();
  let foundMatch = null, foundGroup = null;
  const searchGroups = code ? groups.filter(g => g.code === code) : groups;
  if (code && searchGroups.length === 0) {
    if(errEl){errEl.textContent='Codigo de grupo no encontrado';errEl.style.display='block';}
    return;
  }
  for (const group of searchGroups) {
    const students = group.students || [];
    const match = students.find(s => s.registered && (
      (s.username && norm(s.username) === norm(userInput)) ||
      norm(s.name) === norm(userInput)
    ));
    if (match) { foundMatch = match; foundGroup = group; break; }
  }
  if (!foundMatch) {
    if(errEl){errEl.textContent='Usuario no encontrado. Verifica tu usuario o registrate.';errEl.style.display='block';}
    return;
  }
  if (foundMatch.pass !== pass) {
    if(errEl){errEl.textContent='Contrasena incorrecta';errEl.style.display='block';}
    return;
  }
  currentStudentGroup = foundGroup;
  DB.addLog({ who: foundMatch.name, action: 'Inicio de sesion', groupId: foundGroup.id });
  currentUser = { role:'student', id: foundMatch.name, name: foundMatch.name, groupId: foundGroup.id };
  DB.set('current_session', currentUser);
  loadStudentApp();
}

function toggleTeacherLogin() {
  const sec = document.getElementById('teacher-login-section');
  if (!sec) return;
  const visible = sec.style.display !== 'none';
  sec.style.display = visible ? 'none' : 'block';
  if (!visible) setTimeout(() => document.getElementById('login-user')?.focus(), 100);
}

function studentCheckCode() {
  const raw = document.getElementById('student-group-code').value.trim();
  const code = raw.toUpperCase();
  const group = DB.getGroups().find(g => g.code.toUpperCase() === code);
  if (!group) { toast('Codigo de grupo no encontrado. Verifica mayusculas y espacios.', 'error'); return; }
  currentStudentGroup = group;
  window.currentStudentGroup = group; // también en window para el parche
  const sub = document.getElementById('student-login-subtitle');
  if (sub) sub.textContent = 'Grupo: ' + group.name;
  showStudentStep(2);
}

function showStudentStep(n) {
  [1,2,3,4].forEach(i => {
    const el = document.getElementById('student-login-step' + i);
    if (el) el.style.display = i === n ? 'block' : 'none';
  });
  // Update subtitle
  const sub = document.getElementById('student-login-subtitle');
  if (sub) {
    const labels = {
      1: 'Registro — Codigo de grupo',
      2: 'Registro — Tus datos',
      3: 'Ingresa a tu cuenta',
      4: 'Reglamento y firma'
    };
    if (labels[n]) sub.textContent = labels[n];
  }
}

function studentRegister() {
  const name = document.getElementById('student-reg-name').value.trim();
  const phone = document.getElementById('student-reg-phone').value.trim();
  const pass = document.getElementById('student-reg-pass').value;
  const errEl = document.getElementById('student-reg-error');
  errEl.style.display = 'none';
  if (!name || !phone || pass.length < 6) {
    errEl.textContent = 'Completa todos los campos (contraseña mínimo 6 caracteres)';
    errEl.style.display = 'block'; return;
  }
  const group = currentStudentGroup;
  const students = group.students || [];
  const match = students.find(s => norm(s.name) === norm(name));
  if (!match) {
    errEl.textContent = '⚠️ Tu nombre no coincide con la lista. Verifica cómo apareces en la lista de asistencia.';
    errEl.style.display = 'block'; return;
  }
  if (match.registered) {
    errEl.textContent = 'Ya existe una cuenta con ese nombre. Usa la opción de iniciar sesión.';
    errEl.style.display = 'block'; return;
  }
  match.registered = true; match.phone = phone; match.pass = pass;
  const groups = DB.getGroups();
  const gi = groups.findIndex(g => g.id === group.id);
  groups[gi] = group; DB.setGroups(groups);
  DB.addLog({ who: name, action: 'Registro en portal', groupId: group.id });
  toast('¡Cuenta creada! Bienvenid@', 'success');
  currentUser = { role:'student', id: match.name, name: match.name, groupId: group.id };
  DB.set('current_session', currentUser);
  loadStudentApp();
}

function studentLogin() {
  const name = document.getElementById('student-login-name').value.trim();
  const pass = document.getElementById('student-login-passw').value;
  const errEl = document.getElementById('student-login-error');
  errEl.style.display = 'none';
  const group = currentStudentGroup;
  if (!group) { errEl.textContent = 'Primero ingresa el código de grupo'; errEl.style.display='block'; return; }
  const students = group.students || [];
  const match = students.find(s => norm(s.name) === norm(name));
  if (!match || !match.registered) {
    errEl.textContent = 'Alumno no encontrado o no registrado. ¿Necesitas registrarte?';
    errEl.style.display='block'; return;
  }
  if (match.pass !== pass) {
    errEl.textContent = 'Contraseña incorrecta'; errEl.style.display='block'; return;
  }
  DB.addLog({ who: name, action: 'Inicio de sesión', groupId: group.id });
  currentUser = { role:'student', id: match.name, name: match.name, groupId: group.id };
  DB.set('current_session', currentUser);
  loadStudentApp();
}

/* ─── CARGAR APP DOCENTE ─── */
function loadTeacherApp() {
  showScreen('teacher');
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'});
  const prof = DB.getTeacher();
  document.getElementById('teacher-greeting').textContent = `Hola, ${prof.name.split(' ')[0] || 'Maestra'}`;
  loadTeacherDashboard();
  loadGroupSelects();
  loadRubricEditor();
  loadProfileForm();
  showTeacherSection('dashboard');
}

/* ─── NAVEGACIÓN DOCENTE ─── */
function showTeacherSection(name) {
  document.querySelectorAll('.t-section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('t-' + name);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.section === name);
  });
  if (name === 'groups') renderGroups();
  if (name === 'attendance') prepareAttendanceSection();
  if (name === 'participation') prepareParticipationSection();
  if (name === 'grades') prepareGradesSection();
  if (name === 'wall') renderWallPosts();
  if (name === 'profile') { loadRubricEditor(); loadProfileForm(); loadExportSelect(); }
  if (name === 'dashboard') loadTeacherDashboard();
}

/* ─── DASHBOARD DOCENTE ─── */
function loadTeacherDashboard() {
  const groups = DB.getGroups();
  const activities = DB.getActivities();
  const submissions = DB.getSubmissions();
  const pending = submissions.filter(s => !s.grade && s.fileData);
  const wa = submissions.filter(s => s.waRequest && !s.reopened);
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-val">${groups.length}</div><div class="stat-lbl">Grupos activos</div></div>
    <div class="stat-card"><div class="stat-val">${groups.reduce((a,g)=>(a+(g.students||[]).length),0)}</div><div class="stat-lbl">Alumnos</div></div>
    <div class="stat-card"><div class="stat-val">${activities.length}</div><div class="stat-lbl">Actividades</div></div>
    <div class="stat-card"><div class="stat-val">${pending.length}</div><div class="stat-lbl">Por revisar</div></div>
  `;
  const pl = document.getElementById('pending-list');
  if (pending.length === 0) {
    pl.innerHTML = '<p class="empty-state" style="padding:16px 0"><span class="empty-icon">✓</span><p>Sin entregas pendientes</p></p>';
  } else {
    pl.innerHTML = pending.slice(0,8).map(s => {
      const act = DB.getActivity(s.activityId);
      return `<div class="pending-item" onclick="App.openActivityDetail('${s.activityId}')">
        <div class="pi-dot"></div>
        <div style="flex:1"><div class="pi-name">${s.studentName}</div><div class="pi-act">${act ? act.title : ''}${s.late ? ' · ⏰ Fuera de tiempo' : ''}</div></div>
      </div>`;
    }).join('');
  }
  const wl = document.getElementById('whatsapp-list');
  if (wa.length === 0) {
    wl.innerHTML = '<p style="font-size:13px;color:var(--text3);padding:8px 0">Sin solicitudes pendientes</p>';
  } else {
    wl.innerHTML = wa.map(s => {
      const act = DB.getActivity(s.activityId);
      const group = DB.getGroup(act ? act.groupId : '');
      const prof = DB.getTeacher();
      const waLink = `https://wa.me/52${prof.phone}?text=${encodeURIComponent(`Hola maestra, soy ${s.studentName} del grupo ${group?group.name:''} y le solicito que me abra nuevamente la actividad "${act?act.title:''}"` )}`;
      return `<div class="pending-item">
        <div class="pi-dot" style="background:var(--green)"></div>
        <div style="flex:1"><div class="pi-name">${s.studentName}</div><div class="pi-act">${act ? act.title : ''}</div></div>
        <button class="btn-accent sm" onclick="App.reopenSubmission('${s.activityId}','${s.studentName}',this)">Abrir</button>
      </div>`;
    }).join('');
  }
}

function reopenSubmission(actId, studentName, btn) {
  const subs = DB.getSubmissions();
  const i = subs.findIndex(s => s.activityId === actId && s.studentName === studentName);
  if (i >= 0) { subs[i].reopened = true; subs[i].fileData = null; subs[i].waRequest = false; DB.setSubmissions(subs); }
  DB.addLog({ who: 'Docente', action: `Reabrió actividad para ${studentName}`, groupId: '' });
  toast('Actividad reabierta', 'success'); loadTeacherDashboard();
}

/* ─── GRUPOS ─── */
function loadGroupSelects() {
  const groups = DB.getGroups();
  ['att-group-select','part-group-select','grades-group-select','wall-group-select','export-group-select'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = el.id === 'wall-group-select' ? '<option value="all">Todos los grupos</option>' : '<option value="">Selecciona grupo...</option>';
    el.innerHTML = first + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  });
}

function renderGroups(showArchived) {
  let groups = DB.getGroups();
  const container = document.getElementById('groups-list');
  // Ordenar: activos primero (por fecha de creacion descendente), archivados al final
  groups = [...groups].sort((a,b) => {
    if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
    return (b.createdAt||0) - (a.createdAt||0);
  });
  const visible = showArchived ? groups : groups.filter(g => !g.archived);
  const archivedCount = groups.filter(g => g.archived).length;

  if (visible.length === 0 && groups.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">⬡</span><p>Aún no tienes grupos.<br>Crea el primero.</p></div>`;
    return;
  }

  const toggleArchBtn = archivedCount > 0 ? `<button class="btn-outline" style="width:100%;margin-bottom:12px;font-size:12px" onclick="App.renderGroups(${!showArchived})">${showArchived ? 'Ocultar archivados' : 'Mostrar archivados (' + archivedCount + ')'}</button>` : '';

  container.innerHTML = toggleArchBtn + visible.map(g => {
    const students = g.students || [];
    const registered = students.filter(s => s.registered).length;
    const acts = DB.getActivitiesByGroup(g.id).length;
    const archivedStyle = g.archived ? 'opacity:0.5;' : '';
    return `<div class="group-card ${g.level === 'lic' ? 'lic' : ''} ${g.archived ? 'archived' : ''}" style="${archivedStyle}">
      <div class="card-header" onclick="App.openGroupDetail('${g.id}')" style="cursor:pointer">
        <div style="flex:1">
          <div class="group-name">${g.name} ${g.archived ? '<span class="badge badge-gray" style="font-size:9px">ARCHIVADO</span>' : ''}</div>
          <div class="card-sub">${g.subject || 'Materia'}</div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent);margin-top:3px">Codigo: ${g.code}</div>
        </div>
        <span class="badge ${g.level === 'lic' ? 'badge-blue' : 'badge-yellow'}">${g.level === 'lic' ? 'Licenciatura' : 'Bachillerato'}</span>
      </div>
      <div class="group-meta" style="margin-top:8px">
        <span class="badge badge-gray">${students.length} alumnos (${registered} reg.)</span>
        <span class="badge badge-gray">${acts} actividades</span>
      </div>
      <div class="group-info-row">
        <span>📅 ${fmt(g.startDate)} — ${fmt(g.endDate)}</span>
        <span>🕐 ${g.days ? g.days.join(',') : ''}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-accent sm" onclick="event.stopPropagation();App.showEditGroup('${g.id}')">✏️ Editar</button>
        <button class="btn-outline" style="font-size:12px;padding:6px 10px" onclick="event.stopPropagation();App.toggleArchiveGroup('${g.id}')">${g.archived ? '↩ Activar' : '📦 Archivar'}</button>
        <button class="btn-danger" style="font-size:12px;padding:6px 10px;margin-left:auto" onclick="event.stopPropagation();App.deleteGroup('${g.id}')">🗑 Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

function showCreateGroup() {
  showModal(`
    <div class="modal-title">Nuevo Grupo</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label>Nombre del grupo</label><input type="text" id="ng-name" placeholder="ej. MAT 2024-A" oninput="App.suggestCode(this.value)" /></div>
      <div class="form-group"><label>Materia</label><input type="text" id="ng-subject" placeholder="Cálculo Diferencial" /></div>
      <div class="form-group"><label>Nivel</label>
        <select id="ng-level">
          <option value="bach">Bachillerato</option>
          <option value="lic">Licenciatura</option>
        </select>
      </div>
      <div class="form-group"><label>Fecha inicio</label><input type="date" id="ng-start" /></div>
      <div class="form-group"><label>Fecha fin</label><input type="date" id="ng-end" /></div>
      <div class="form-group"><label>Días de clase</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px" id="ng-days-wrap">
          ${['Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => `<label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" value="${d}" name="ngday" />${d}</label>`).join('')}
        </div>
      </div>
      <div class="form-group"><label>Horas por día</label><input type="number" id="ng-hours" value="2" min="1" max="8" /></div>
      <div class="form-group">
        <label>Código de acceso para alumnos (editable)</label>
        <input type="text" id="ng-code" placeholder="ej. MAT2024A" style="text-transform:uppercase;font-family:var(--font-mono)" />
        <small style="font-size:11px;color:var(--text2);margin-top:3px;display:block">Este es el código que compartirás con tus alumnos para que se registren.</small>
      </div>
      <div class="form-group">
        <label>Lista de alumnos (uno por línea, apellidos nombre)</label>
        <textarea id="ng-students" rows="6" placeholder="González Pérez Juan\nMartínez López Ana\nRamírez Torres Luis"></textarea>
      </div>
      <button class="btn-primary full" onclick="App.createGroup()">Crear Grupo</button>
    </div>
  `);
}

function createGroup() {
  const name = document.getElementById('ng-name').value.trim();
  const subject = document.getElementById('ng-subject').value.trim();
  const level = document.getElementById('ng-level').value;
  const startDate = document.getElementById('ng-start').value;
  const endDate = document.getElementById('ng-end').value;
  const days = [...document.querySelectorAll('input[name="ngday"]:checked')].map(c => c.value);
  const hours = document.getElementById('ng-hours').value;
  const studentsRaw = document.getElementById('ng-students').value.trim().split('\n').filter(l => l.trim());
  if (!name || !subject || !startDate || !endDate) { toast('Completa nombre, materia y fechas', 'error'); return; }
  // Código = lo que escribió el docente en el campo, o el nombre tal cual
  const codeField = document.getElementById('ng-code')?.value.trim();
  const code = (codeField || name.trim()).toUpperCase();
  if (!code) { toast('Ingresa un nombre de grupo', 'error'); return; }
  if (DB.getGroups().find(g => g.code === code)) { toast('Ese codigo ya existe, elige otro', 'error'); return; }
  const students = studentsRaw.map(l => ({ name: l.trim(), registered: false, phone: '', pass: '' }));
  const group = { id: uid(), name, subject, level, startDate, endDate, days, hours, code, students, createdAt: Date.now(), archived: false };
  const groups = DB.getGroups(); groups.push(group); DB.setGroups(groups);
  DB.addLog({ who: 'Docente', action: `Creó grupo ${name}`, groupId: group.id });
  toast(`Grupo "${name}" creado`, 'success');
  closeModal(); renderGroups(); loadGroupSelects(); loadTeacherDashboard();
}



/* ─── CONFIG DE GRUPO ─── */
function toggleGroupConfig(gid, key) {
  const groups = DB.getGroups();
  const i = groups.findIndex(g => g.id === gid);
  if (i < 0) return;
  const current = groups[i][key] !== false;
  groups[i][key] = !current;
  DB.setGroups(groups);
  const newVal = groups[i][key];
  toast(newVal ? 'Activado' : 'Desactivado', 'success');
  const btnId = key === 'showGrades' ? 'cfg-btn-grades' : 'cfg-btn-att';
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.textContent = newVal ? 'Activado' : 'Desactivado';
    btn.style.background = newVal ? 'var(--green)' : 'var(--bg4)';
    btn.style.color = newVal ? 'white' : 'var(--text2)';
    btn.style.borderColor = newVal ? 'var(--green)' : 'var(--border)';
  }
}

function toggleGroupConfigBtn(btn) {
  const gid = btn.dataset.gid;
  const key = btn.dataset.key;
  if (!gid || !key) return;
  toggleGroupConfig(gid, key);
}

function previewGroupLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._pendingGroupLogo = e.target.result;
    const prev = document.getElementById('eg-logo-preview');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:60px;height:60px;border-radius:8px;object-fit:contain;background:white;padding:4px;margin-top:8px" />`;
  };
  reader.readAsDataURL(file);
}

/* ─── TABS ASISTENCIA / PARTICIPACIÓN ─── */
function switchAttTab(tab, btn) {
  document.querySelectorAll('.att-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const gid = document.getElementById('att-group-select')?.value;
  if (!gid) { toast('Selecciona un grupo primero', 'error'); return; }
  if (tab === 'asistencia') {
    document.getElementById('att-import-section').style.display = 'block';
    loadAttendanceList();
  } else if (tab === 'participacion') {
    document.getElementById('att-import-section').style.display = 'none';
    document.getElementById('att-save-btn-wrap').style.display = 'none';
    openParticipation(gid);
  } else if (tab === 'resumen') {
    document.getElementById('att-import-section').style.display = 'none';
    const group = DB.getGroup(gid);
    const wrap = document.getElementById('attendance-list-wrap');
    if (wrap && group) wrap.innerHTML = renderAttendanceSummary(group);
    document.getElementById('att-save-btn-wrap').style.display = 'none';
  }
}

/* ─── EDITAR / ARCHIVAR / ELIMINAR GRUPOS ─── */
function suggestCode(name) {
  const el = document.getElementById('ng-code');
  if (!el || el.dataset.manual === 'true') return;
  el.value = name.trim(); // Mantener mayúsculas/minúsculas del nombre
  el.addEventListener('input', () => el.dataset.manual = 'true', { once: true });
}

function toggleArchiveGroup(gid) {
  const groups = DB.getGroups();
  const i = groups.findIndex(g => g.id === gid);
  if (i < 0) return;
  groups[i].archived = !groups[i].archived;
  DB.setGroups(groups);
  const action = groups[i].archived ? 'archivado' : 'activado';
  toast(`Grupo ${action}`, 'success');
  renderGroups();
  loadGroupSelects();
}

function deleteGroup(gid) {
  const group = DB.getGroup(gid);
  if (!group) return;
  if (!confirm('¿Eliminar el grupo "' + group.name + '" y todos sus datos? Esto no se puede deshacer.')) return;
  const groups = DB.getGroups().filter(g => g.id !== gid);
  DB.setGroups(groups);
  toast('Grupo eliminado');
  renderGroups();
  loadGroupSelects();
  loadTeacherDashboard();
}

function showEditGroup(gid) {
  const group = DB.getGroup(gid);
  if (!group) return;
  showModal(`
    <div class="modal-title">Editar Grupo</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label>Nombre del grupo</label><input type="text" id="eg-name" value="${group.name}" /></div>
      <div class="form-group"><label>Materia</label><input type="text" id="eg-subject" value="${group.subject||''}" /></div>
      <div class="form-group"><label>Nivel</label>
        <select id="eg-level">
          <option value="bach" ${group.level==='bach'?'selected':''}>Bachillerato</option>
          <option value="lic" ${group.level==='lic'?'selected':''}>Licenciatura</option>
        </select>
      </div>
      <div class="form-group"><label>Codigo de acceso</label>
        <input type="text" id="eg-code" value="${group.code}" style="text-transform:uppercase;font-family:var(--font-mono)" />
        <small style="font-size:11px;color:var(--yellow);margin-top:3px;display:block">Si cambias el codigo, comparte el nuevo con tus alumnos.</small>
      </div>
      <div class="form-group"><label>Fecha inicio</label><input type="date" id="eg-start" value="${group.startDate||''}" /></div>
      <div class="form-group"><label>Fecha fin</label><input type="date" id="eg-end" value="${group.endDate||''}" /></div>
      <div class="form-group"><label>Dias de clase</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          ${['Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => `<label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" value="${d}" name="egday" ${(group.days||[]).includes(d)?'checked':''}/>${d}</label>`).join('')}
        </div>
      </div>
      <div class="form-group"><label>Horas por dia</label><input type="number" id="eg-hours" value="${group.hours||2}" min="1" max="8" /></div>
      <div class="form-group">
        <label>Logo de la escuela (opcional)</label>
        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          ${group.logo ? `<img src="${group.logo}" style="width:48px;height:48px;border-radius:8px;object-fit:contain;background:white;padding:2px" />` : ''}
          <label class="upload-area" for="eg-logo-input" style="flex:1;padding:10px">
            <span style="font-size:12px">${group.logo ? 'Cambiar logo' : 'Subir logo'}</span>
            <input type="file" id="eg-logo-input" accept="image/*" onchange="App.previewGroupLogo(this)" />
          </label>
        </div>
        <div id="eg-logo-preview"></div>
      </div>
      <div class="form-group">
        <label>Color de fondo del grupo</label>
        <select id="eg-theme">
          <option value="dark" ${(!group.theme||group.theme==='dark')?'selected':''}>Oscuro (default)</option>
          <option value="light" ${group.theme==='light'?'selected':''}>Claro</option>
          <option value="navy" ${group.theme==='navy'?'selected':''}>Azul marino</option>
          <option value="forest" ${group.theme==='forest'?'selected':''}>Verde</option>
        </select>
      </div>
      <button class="btn-primary full" onclick="App.saveEditGroup('${gid}')">Guardar cambios</button>
    </div>
  `);
}

function saveEditGroup(gid) {
  const groups = DB.getGroups();
  const i = groups.findIndex(g => g.id === gid);
  if (i < 0) return;
  const newCode = (document.getElementById('eg-code')?.value.trim().toUpperCase()||'').replace(/\s+/g,'');
  // Verificar codigo unico (excluyendo el propio grupo)
  if (newCode && groups.find(g => g.code === newCode && g.id !== gid)) {
    toast('Ese código ya existe en otro grupo', 'error'); return;
  }
  groups[i].name = document.getElementById('eg-name')?.value.trim() || groups[i].name;
  groups[i].subject = document.getElementById('eg-subject')?.value.trim() || groups[i].subject;
  groups[i].level = document.getElementById('eg-level')?.value || groups[i].level;
  groups[i].code = newCode || groups[i].code;
  groups[i].startDate = document.getElementById('eg-start')?.value || groups[i].startDate;
  groups[i].endDate = document.getElementById('eg-end')?.value || groups[i].endDate;
  groups[i].days = [...document.querySelectorAll('input[name="egday"]:checked')].map(c => c.value);
  groups[i].hours = document.getElementById('eg-hours')?.value || groups[i].hours;
  const themeEl = document.getElementById('eg-theme');
  if(themeEl) groups[i].theme = themeEl.value;
  // Logo
  const logoData = window._pendingGroupLogo;
  if(logoData) { groups[i].logo = logoData; window._pendingGroupLogo = null; }
  DB.setGroups(groups);
  DB.addLog({ who: 'Docente', action: `Editó grupo ${groups[i].name}`, groupId: gid });
  toast('Grupo actualizado', 'success');
  closeModal(); renderGroups(); loadGroupSelects();
}

/* ─── DETALLE DE GRUPO ─── */
function openGroupDetail(gid) {
  currentGroupId = gid;
  const group = DB.getGroup(gid);
  if (!group) return;
  showTeacherSection('group-detail');
  renderGroupDetail(group);
}

function renderGroupDetail(group) {
  const acts = DB.getActivitiesByGroup(group.id);
  const rubrics = DB.getRubrics();
  const rubric = rubrics[group.level] || rubrics.bach;
  const prof = DB.getTeacher();
  const shareLink = `${location.href.split('?')[0]}?group=${group.code}`;
  const qrDataUrl = generateQRDataURL(shareLink, 150);

  document.getElementById('group-detail-content').innerHTML = `
    <div class="card-header" style="margin-bottom:16px">
      <div>
        <div style="font-size:22px;font-weight:800">${group.name}</div>
        <div style="color:var(--text2);font-size:13px">${group.subject}</div>
      </div>
      <span class="badge ${group.level === 'lic' ? 'badge-blue' : 'badge-yellow'}">${group.level === 'lic' ? 'Licenciatura' : 'Bachillerato'}</span>
    </div>

    <div class="detail-tabs">
      <button class="detail-tab active" onclick="App.switchDetailTab(this,'dt-students')">Alumnos</button>
      <button class="detail-tab" onclick="App.switchDetailTab(this,'dt-activities')">Actividades</button>
      <button class="detail-tab" onclick="App.switchDetailTab(this,'dt-attendance')">Asistencia</button>
      <button class="detail-tab" onclick="App.switchDetailTab(this,'dt-config')">Config</button>
      <button class="detail-tab" onclick="App.switchDetailTab(this,'dt-share')">Compartir</button>
      <button class="detail-tab" onclick="App.switchDetailTab(this,'dt-logs')">Bitácora</button>
    </div>

    <!-- ALUMNOS -->
    <div id="dt-students" class="detail-panel active">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;color:var(--text2)">${(group.students||[]).length} en lista, ${(group.students||[]).filter(s=>s.registered).length} registrados</span>
        <button class="btn-accent sm" onclick="App.showAddStudents('${group.id}')">+ Agregar</button>
      </div>
      ${(group.students||[]).map((s,i) => `
        <div class="att-row" style="cursor:default">
          <div class="att-name">${s.name}</div>
          ${s.registered ? `<span class="badge badge-green">Registrado</span>` : `<span class="badge badge-gray">Sin registro</span>`}
          <button class="btn-danger" onclick="App.removeStudent('${group.id}',${i})">✕</button>
        </div>
      `).join('') || '<p class="empty-state" style="padding:16px 0">Lista vacía</p>'}
    </div>

    <!-- ACTIVIDADES -->
    <div id="dt-activities" class="detail-panel">
      <div style="margin-bottom:12px">
        <button class="btn-accent sm" onclick="App.openCreateActivity('${group.id}')">+ Nueva actividad</button>
      </div>
      ${acts.length === 0 ? '<p class="empty-state" style="padding:16px 0"><span class="empty-icon">◈</span><p>Sin actividades</p></p>' :
        acts.map(a => `
          <div class="activity-card" onclick="App.openActivityDetail('${a.id}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div class="act-title">${a.title}</div>
              <span class="badge ${getBadgeForType(a.type)}">${getLabelForType(a.type, group.level)}</span>
            </div>
            <div class="act-meta">Entrega: ${a.dueDate ? fmtTs(a.dueDate) : 'Sin fecha'} · ${a.targetAll ? 'Todo el grupo' : 'Individual'}</div>
            <div class="act-footer">
              <span style="font-size:12px;color:var(--text2)">${DB.getSubmissionsByActivity(a.id).filter(s=>s.fileData||s.waSent).length} / ${a.targetAll ? (group.students||[]).length : (a.targets||[]).length} entregadas</span>
              <span class="badge badge-gray">${a.points || 10} pts</span>
            </div>
          </div>
        `).join('')}
    </div>

    <!-- ASISTENCIA RESUMEN -->
    <div id="dt-attendance" class="detail-panel">
      <button class="btn-accent sm" style="margin-bottom:12px" onclick="App.showTeacherSection('attendance')">Ir a pasar lista →</button>
      ${renderAttendanceSummary(group)}
    </div>

    <!-- CONFIG -->
    <div id="dt-config" class="detail-panel">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg3);padding:16px;border-radius:var(--radius-sm)">
          <div>
            <div style="font-size:14px;font-weight:700">Alumnos pueden ver sus calificaciones</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px">Si está desactivado, los alumnos ven candado</div>
          </div>
          <button id="cfg-btn-grades" data-gid="${group.id}" data-key="showGrades" onclick="App.toggleGroupConfigBtn(this)"
            style="padding:8px 20px;border-radius:20px;border:2px solid;font-weight:700;font-size:13px;cursor:pointer;transition:all .2s;background:${group.showGrades!==false?'var(--green)':'var(--bg4)'};color:${group.showGrades!==false?'white':'var(--text2)'};border-color:${group.showGrades!==false?'var(--green)':'var(--border)'}">
            ${group.showGrades!==false?'Activado':'Desactivado'}
          </button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg3);padding:16px;border-radius:var(--radius-sm)">
          <div>
            <div style="font-size:14px;font-weight:700">Alumnos pueden ver la asistencia</div>
          </div>
          <button id="cfg-btn-att" data-gid="${group.id}" data-key="showAttendance" onclick="App.toggleGroupConfigBtn(this)"
            style="padding:8px 20px;border-radius:20px;border:2px solid;font-weight:700;font-size:13px;cursor:pointer;transition:all .2s;background:${group.showAttendance!==false?'var(--green)':'var(--bg4)'};color:${group.showAttendance!==false?'white':'var(--text2)'};border-color:${group.showAttendance!==false?'var(--green)':'var(--border)'}">
            ${group.showAttendance!==false?'Activado':'Desactivado'}
          </button>
        </div>
      </div>
    </div>

    <!-- COMPARTIR -->
    <div id="dt-share" class="detail-panel">
      <div class="qr-container">
        <p style="font-size:14px;margin-bottom:8px">Comparte este código o QR con tus alumnos para que se registren:</p>
        <p style="font-size:12px;color:var(--text2);margin-bottom:12px">Si el codigo no coincide con el nombre del grupo, ve a <b>✏️ Editar</b> y cambia el codigo manualmente.</p>
        <div class="qr-code">${qrDataUrl ? `<img src="${qrDataUrl}" style="width:100%;height:100%;border-radius:8px" />` : `<p>Instala la app para ver QR</p>`}</div>
        <p style="font-size:13px;color:var(--text2);margin-top:8px">Código de grupo:</p>
        <div class="code-display">${group.code}</div>
        <p style="font-size:11px;color:var(--text3);margin-top:12px;line-height:1.5">Al acceder, los alumnos deben escribir su nombre <strong>exactamente</strong> como aparece en la lista.</p>
        <button class="btn-accent sm" style="margin-top:12px" onclick="App.copyCode('${group.code}')">Copiar código</button>
      </div>
    </div>

    <!-- BITÁCORA -->
    <div id="dt-logs" class="detail-panel">
      <div class="interaction-log">
        ${DB.getLogs().filter(l=>l.groupId===group.id).slice(0,50).map(l => `
          <div class="log-entry">
            <span class="log-time">${fmtTs(l.ts)}</span>
            <span class="log-who">${l.who}</span>
            <span class="log-action">${l.action}</span>
          </div>
        `).join('') || '<p style="color:var(--text3);font-size:12px;padding:8px 0">Sin registros</p>'}
      </div>
    </div>
  `;
}

function switchDetailTab(btn, panelId) {
  btn.closest('.t-section').querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  btn.closest('.t-section').querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
}

function renderAttendanceSummary(group) {
  const allAtt = DB.getAttendance().filter(a => a.groupId === group.id)
    .sort((a,b) => a.date.localeCompare(b.date));
  if (allAtt.length === 0) return '<p style="color:var(--text3);font-size:13px">No hay asistencias registradas</p>';
  const students = group.students || [];
  const attSymbol = (v) => {
    if(!v||v==='?') return `<span style="color:var(--text3);font-size:14px">⚠</span>`;
    if(v==='A') return `<span style="color:var(--green);font-size:15px">✓</span>`;
    if(v==='F') return `<span style="color:var(--red);font-size:15px">✗</span>`;
    if(v==='R') return `<span style="color:var(--yellow);font-size:13px">⏰</span>`;
    if(v==='J') return `<span style="color:var(--blue);font-size:13px">J</span>`;
    return v;
  };
  const dateHeaders = allAtt.map(d => `<th style="font-size:10px;white-space:nowrap;padding:6px 4px">${d.date.slice(5)}</th>`).join('');
  const rows = students.map(s => {
    let A=0,R=0,J=0,F=0;
    const cells = allAtt.map(day => {
      const r = (day.records||{})[s.name];
      if(r==='A')A++; else if(r==='R')R++; else if(r==='J')J++; else if(r)F++;
      return `<td style="text-align:center;padding:4px">${attSymbol(r)}</td>`;
    }).join('');
    const total = allAtt.length;
    const score = total>0 ? Math.round(((A*10+R*8+J*8)/(total*10))*100) : 0;
    return `<tr>
      <td style="font-size:11px;font-weight:600;white-space:nowrap;padding:6px 8px;position:sticky;left:0;background:var(--bg2)">${s.name}</td>
      ${cells}
      <td style="text-align:center;padding:4px"><span style="font-size:10px;color:var(--green)">A:${A}</span></td>
      <td style="text-align:center;padding:4px"><span style="font-size:10px;color:var(--red)">F:${F}</span></td>
      <td style="text-align:center;padding:4px"><span style="font-size:10px;color:var(--yellow)">R:${R}</span></td>
      <td style="text-align:center;padding:4px"><span class="badge ${score>=70?'badge-green':'badge-red'}" style="font-size:9px">${score}%</span></td>
    </tr>`;
  }).join('');
  return `<div style="overflow-x:auto;margin-top:8px">
    <table style="border-collapse:collapse;width:100%;font-size:11px">
      <thead><tr style="background:var(--bg3)">
        <th style="text-align:left;padding:6px 8px;position:sticky;left:0;background:var(--bg3)">Alumno</th>
        ${dateHeaders}
        <th style="font-size:10px;padding:4px">A</th>
        <th style="font-size:10px;padding:4px">F</th>
        <th style="font-size:10px;padding:4px">R</th>
        <th style="font-size:10px;padding:4px">%</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function showAddStudents(gid) {
  showModal(`
    <div class="modal-title">Agregar Alumnos</div>
    <div class="form-group">
      <label>Alumnos (uno por línea)</label>
      <textarea id="add-stu-list" rows="8" placeholder="González Pérez Juan\nMartínez López Ana"></textarea>
    </div>
    <button class="btn-primary full" onclick="App.addStudents('${gid}')">Agregar</button>
  `);
}

function addStudents(gid) {
  const raw = document.getElementById('add-stu-list').value.trim().split('\n').filter(l=>l.trim());
  const groups = DB.getGroups();
  const gi = groups.findIndex(g => g.id === gid);
  if (gi < 0) return;
  raw.forEach(name => {
    if (!groups[gi].students.find(s => norm(s.name) === norm(name)))
      groups[gi].students.push({ name: name.trim(), registered: false, phone:'', pass:'' });
  });
  DB.setGroups(groups);
  toast(`${raw.length} alumnos agregados`, 'success');
  closeModal(); openGroupDetail(gid);
}

function removeStudent(gid, idx) {
  if (!confirm('¿Eliminar alumno?')) return;
  const groups = DB.getGroups();
  const gi = groups.findIndex(g => g.id === gid);
  groups[gi].students.splice(idx, 1); DB.setGroups(groups);
  toast('Alumno eliminado'); openGroupDetail(gid);
}

function copyCode(code) {
  navigator.clipboard?.writeText(code).then(() => toast('Código copiado', 'success')).catch(() => toast('Código: ' + code));
}

/* ─── QR simple (ASCII art en SVG, no deps) ─── */
function generateQRDataURL(text, size) {
  // Usar API gratuita de QR
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=ffffff&color=1a1f2e&margin=10`;
}

/* ─── ACTIVIDADES ─── */
function getBadgeForType(type) {
  const m = { asistencia:'badge-green', participacion:'badge-purple', actividades:'badge-yellow', tareas:'badge-blue', proyecto:'badge-red', colaborativo:'badge-blue', autogestion:'badge-purple', desarrollo:'badge-green' };
  return m[type] || 'badge-gray';
}
function getLabelForType(type, level) {
  const m = { asistencia:'Asistencia', participacion:'Participación', actividades:'Actividad', tareas:'Tarea', proyecto:'Proyecto', colaborativo:'T. Colaborativo', autogestion:'Autogestión', desarrollo:'Desarrollo Personal' };
  return m[type] || type;
}

function openCreateActivity(gid) {
  const groups = DB.getGroups();
  if (groups.length === 0) { toast('Primero crea un grupo', 'error'); return; }
  const groupId = gid || currentGroupId || groups[0].id;
  const group = DB.getGroup(groupId);
  const isLic = group && group.level === 'lic';

  const typeOptions = isLic ? `
    <option value="actividades">Actividad (normal)</option>
    <option value="tareas">Tarea</option>
    <option value="colaborativo">Trabajo Colaborativo</option>
    <option value="autogestion">Autogestión/Autoaprendizaje</option>
    <option value="desarrollo">Desarrollo Personal</option>
    <option value="proyecto">Proyecto Integrador</option>
    <option value="participacion">Participación</option>
  ` : `
    <option value="actividades">Actividad</option>
    <option value="tareas">Tarea</option>
    <option value="proyecto">Proyecto Integrador</option>
    <option value="participacion">Participación</option>
  `;

  const students = group ? (group.students || []) : [];

  showModal(`
    <div class="modal-title">Nueva Actividad</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label>Grupo</label>
        <select id="ca-group" onchange="App.onActivityGroupChange(this)">
          ${groups.map(g=>`<option value="${g.id}" ${g.id===groupId?'selected':''}>${g.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Título de la actividad</label><input type="text" id="ca-title" placeholder="Ej. Ejercicio 1 — Límites" /></div>
      <div class="form-group"><label>Instrucciones / Descripción</label><textarea id="ca-desc" rows="3" placeholder="Describe qué deben hacer los alumnos..."></textarea></div>
      <div class="form-group"><label>Tipo (rúbrica)</label><select id="ca-type">${typeOptions}</select></div>
      <div class="form-group"><label>Puntaje máximo</label><input type="number" id="ca-points" value="10" min="1" max="100" /></div>
      <div class="form-group"><label>Fecha y hora límite de entrega</label><input type="datetime-local" id="ca-due" /></div>
      <div class="form-group">
        <label>Asignar a</label>
        <select id="ca-target">
          <option value="all">Todo el grupo</option>
          <option value="individual">Alumnos específicos</option>
        </select>
      </div>
      <div id="ca-individual-wrap" style="display:none">
        <div class="form-group"><label>Selecciona alumnos</label>
          <div id="ca-student-checks" style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto">
            ${students.map(s=>`<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="castu" value="${s.name}" />${s.name}</label>`).join('')}
          </div>
        </div>
      </div>
      <button class="btn-primary full" onclick="App.createActivity()">Crear Actividad</button>
    </div>
  `);
  document.getElementById('ca-target').addEventListener('change', function() {
    document.getElementById('ca-individual-wrap').style.display = this.value === 'individual' ? 'block' : 'none';
  });
}

function onActivityGroupChange(sel) {
  // Actualizar opciones de tipo según nivel del grupo
  const group = DB.getGroup(sel.value);
  if (!group) return;
  const isLic = group.level === 'lic';
  const typeEl = document.getElementById('ca-type');
  if (isLic) {
    typeEl.innerHTML = `<option value="actividades">Actividad (normal)</option><option value="tareas">Tarea</option><option value="colaborativo">Trabajo Colaborativo</option><option value="autogestion">Autogestión/Autoaprendizaje</option><option value="desarrollo">Desarrollo Personal</option><option value="proyecto">Proyecto Integrador</option><option value="participacion">Participación</option>`;
  } else {
    typeEl.innerHTML = `<option value="actividades">Actividad</option><option value="tareas">Tarea</option><option value="proyecto">Proyecto Integrador</option><option value="participacion">Participación</option>`;
  }
  // Actualizar lista de alumnos
  const students = group.students || [];
  document.getElementById('ca-student-checks').innerHTML = students.map(s=>`<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="castu" value="${s.name}" />${s.name}</label>`).join('');
}

function createActivity() {
  const groupId = document.getElementById('ca-group').value;
  const title = document.getElementById('ca-title').value.trim();
  const desc = document.getElementById('ca-desc').value.trim();
  const type = document.getElementById('ca-type').value;
  const points = parseInt(document.getElementById('ca-points').value) || 10;
  const due = document.getElementById('ca-due').value;
  const targetMode = document.getElementById('ca-target').value;
  const targets = targetMode === 'individual' ? [...document.querySelectorAll('input[name="castu"]:checked')].map(c=>c.value) : [];
  if (!title) { toast('Escribe un título', 'error'); return; }
  const activity = {
    id: uid(), groupId, title, desc, type, points,
    dueDate: due ? new Date(due).getTime() : null,
    targetAll: targetMode === 'all', targets,
    createdAt: Date.now()
  };
  const acts = DB.getActivities(); acts.push(activity); DB.setActivities(acts);
  DB.addLog({ who: 'Docente', action: `Creó actividad "${title}"`, groupId });
  toast(`Actividad "${title}" creada`, 'success');
  closeModal();
  if (currentGroupId === groupId) openGroupDetail(groupId);
}

/* ─── DETALLE DE ACTIVIDAD (Docente) ─── */
function openActivityDetail(aid) {
  currentActivityId = aid;
  previousTeacherSection = document.querySelector('.t-section.active')?.id?.replace('t-','') || 'groups';
  showTeacherSection('activity-detail');
  renderActivityDetail(aid);
}

function goBackFromActivity() {
  showTeacherSection(previousTeacherSection);
  if (previousTeacherSection === 'group-detail') openGroupDetail(currentGroupId);
}

function renderActivityDetail(aid) {
  const act = DB.getActivity(aid);
  if (!act) return;
  const group = DB.getGroup(act.groupId);
  const subs = DB.getSubmissionsByActivity(aid);
  const students = act.targetAll ? (group?.students || []) : (act.targets||[]).map(t=>({name:t}));
  const isLate = act.dueDate && Date.now() > act.dueDate;
  const projW = DB.getProjectWeights();

  document.getElementById('activity-detail-content').innerHTML = `
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <h2 style="font-size:20px;font-weight:800">${act.title}</h2>
        <span class="badge ${getBadgeForType(act.type)}">${getLabelForType(act.type, group?.level)}</span>
      </div>
      <p style="color:var(--text2);font-size:13px;margin-top:6px">${act.desc || ''}</p>
      <p style="color:var(--text3);font-size:12px;font-family:var(--font-mono);margin-top:6px">
        Entrega: ${act.dueDate ? fmtTs(act.dueDate) : 'Sin fecha'} ${isLate ? '⏰ <span style="color:var(--red)">Pasada</span>' : ''}
      </p>
    </div>
    <div class="detail-tabs">
      <button class="detail-tab active" onclick="App.switchDetailTab(this,'ad-submissions')">Entregas</button>
      <button class="detail-tab" onclick="App.switchDetailTab(this,'ad-grades')">Calificar</button>
      <button class="detail-tab" onclick="App.switchDetailTab(this,'ad-edit')">Editar</button>
    </div>

    <!-- ENTREGAS -->
    <div id="ad-submissions" class="detail-panel active">
      ${students.map(s => {
        const sub = subs.find(ss => ss.studentName === s.name);
        return `<div class="card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:14px;font-weight:700">${s.name}</div>
              ${sub ? `
                <div style="font-size:11px;color:var(--text2);font-family:var(--font-mono)">${fmtTs(sub.submittedAt)}</div>
                ${sub.late ? '<span class="badge badge-red">Fuera de tiempo</span>' : '<span class="badge badge-green">A tiempo</span>'}
                ${sub.waRequest ? '<span class="badge badge-yellow" style="margin-left:4px">Solicitud WA</span>' : ''}
                ${sub.comment ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;background:var(--bg3);padding:6px;border-radius:6px">💬 ${sub.comment}</div>` : ''}
              ` : '<span class="badge badge-gray">Sin entregar</span>'}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
              ${sub && sub.fileData ? `<a href="${sub.fileData}" download="${s.name}_${act.title}" class="btn-accent sm">⬇ Archivo</a>` : ''}
              ${sub && sub.waSent ? '<span class="badge badge-yellow">Por WA</span>' : ''}
              ${sub ? `<button class="btn-danger" onclick="App.reopenSubmission('${act.id}','${s.name}',this)">Reabrir</button>` : ''}
            </div>
          </div>
          ${sub && !sub.grade ? `<div style="margin-top:10px;display:flex;gap:8px;align-items:center">
            <input type="number" min="0" max="${act.points}" class="grade-input" id="gi-${s.name.replace(/\s/g,'_')}" placeholder="0-${act.points}" />
            <input type="text" style="flex:1;font-size:12px" placeholder="Comentario (opcional)" id="gc-${s.name.replace(/\s/g,'_')}" />
            <button class="btn-accent sm" onclick="App.gradeSubmission('${act.id}','${s.name}')">Guardar</button>
          </div>` : sub && sub.grade ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px">
            <span class="badge badge-green">Calificado: ${sub.grade}/${act.points}</span>
            ${sub.teacherComment ? `<span style="font-size:11px;color:var(--text2)">${sub.teacherComment}</span>` : ''}
            <button class="btn-outline" style="padding:4px 8px;font-size:11px" onclick="App.editGrade('${act.id}','${s.name}')">Editar</button>
          </div>` : ''}
        </div>`;
      }).join('') || '<p class="empty-state">Sin alumnos asignados</p>'}
    </div>

    <!-- CALIFICAR BATCH -->
    <div id="ad-grades" class="detail-panel">
      ${act.type === 'proyecto' ? `
        <p style="font-size:13px;color:var(--text2);margin-bottom:4px">Proyecto Integrador — captura parte <b>Teórica</b> y <b>Exposición</b> por separado.</p>
        <p style="font-size:12px;color:var(--accent);margin-bottom:12px">Ponderación: ${projW ? projW.teorico : 50}% Teórico / ${projW ? projW.expo : 50}% Exposición</p>
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:6px;padding:0 4px">
          <span style="font-size:11px;font-weight:700;color:var(--text2)">ALUMNO</span>
          <span style="font-size:11px;font-weight:700;color:var(--text2);width:70px;text-align:center">TEÓRICO (/10)</span>
          <span style="font-size:11px;font-weight:700;color:var(--text2);width:70px;text-align:center">EXPOSICIÓN (/10)</span>
        </div>
        ${students.map(s => {
          const sg = (DB.getGrades()[act.groupId] || {})[s.name] || {};
          return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:var(--bg3);border-radius:8px">' +
            '<div style="font-size:13px;font-weight:600">' + s.name + '</div>' +
            '<input type="number" min="0" max="10" step="0.1" class="grade-input" style="width:70px;text-align:center" id="pt-' + s.name.replace(/[^a-zA-Z0-9]/g,'_') + '" value="' + (sg.proyecto_teorico !== undefined ? sg.proyecto_teorico : '') + '" placeholder="-" />' +
            '<input type="number" min="0" max="10" step="0.1" class="grade-input" style="width:70px;text-align:center" id="pe-' + s.name.replace(/[^a-zA-Z0-9]/g,'_') + '" value="' + (sg.proyecto_expo !== undefined ? sg.proyecto_expo : '') + '" placeholder="-" />' +
          '</div>';
        }).join('')}
        <button class="btn-primary full" style="margin-top:8px" onclick="App.saveProyectoGrades('${aid}')">Guardar calificaciones del proyecto</button>
      ` : `
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Captura rápida de calificaciones</p>
        ${students.map(s => {
          const sub = subs.find(ss => ss.studentName === s.name);
          return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
            '<div style="flex:1;font-size:13px;font-weight:600">' + s.name + '</div>' +
            '<input type="number" min="0" max="' + act.points + '" class="grade-input" id="bg-' + s.name.replace(/\s/g,'_') + '" value="' + (sub && sub.grade ? sub.grade : '') + '" placeholder="-" />' +
            '<span style="font-size:11px;color:var(--text2)">/' + act.points + '</span>' +
          '</div>';
        }).join('')}
        <button class="btn-primary full" style="margin-top:12px" onclick="App.saveBatchGrades('${aid}')">Guardar todas</button>
      `}
    </div>

    <!-- EDITAR ACTIVIDAD -->
    <div id="ad-edit" class="detail-panel">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group"><label>Título</label><input type="text" id="ae-title" value="${act.title}" /></div>
        <div class="form-group"><label>Descripción</label><textarea id="ae-desc" rows="3">${act.desc||''}</textarea></div>
        <div class="form-group"><label>Puntaje máximo</label><input type="number" id="ae-points" value="${act.points}" /></div>
        <div class="form-group"><label>Fecha límite</label><input type="datetime-local" id="ae-due" value="${act.dueDate ? new Date(act.dueDate).toISOString().slice(0,16) : ''}" /></div>
        <button class="btn-accent full" onclick="App.updateActivity('${aid}')">Guardar cambios</button>
        <button class="btn-danger" onclick="App.deleteActivity('${aid}')">Eliminar actividad</button>
      </div>
    </div>
  `;
}

function gradeSubmission(actId, studentName) {
  const key = studentName.replace(/\s/g,'_');
  const gradeEl = document.getElementById('gi-'+key);
  const commentEl = document.getElementById('gc-'+key);
  const act = DB.getActivity(actId);
  const grade = parseFloat(gradeEl?.value);
  if (isNaN(grade) || grade < 0 || grade > act.points) { toast('Calificación inválida', 'error'); return; }
  const subs = DB.getSubmissions();
  const i = subs.findIndex(s => s.activityId === actId && s.studentName === studentName);
  if (i >= 0) { subs[i].grade = grade; subs[i].teacherComment = commentEl?.value || ''; DB.setSubmissions(subs); }
  DB.addLog({ who: 'Docente', action: `Calificó a ${studentName}: ${grade}/${act.points}`, groupId: act.groupId });
  toast('Calificación guardada', 'success'); renderActivityDetail(actId);
}

function editGrade(actId, studentName) {
  const subs = DB.getSubmissions();
  const i = subs.findIndex(s => s.activityId === actId && s.studentName === studentName);
  if (i >= 0) { subs[i].grade = null; DB.setSubmissions(subs); }
  renderActivityDetail(actId);
}

function saveProyectoGrades(actId) {
  const act = DB.getActivity(actId);
  if (!act) return;
  const group = DB.getGroup(act.groupId);
  const students = act.targetAll ? (group?.students||[]) : (act.targets||[]).map(t=>({name:t}));
  const grades = DB.getGrades();
  if (!grades[act.groupId]) grades[act.groupId] = {};
  let saved = 0;
  students.forEach(s => {
    const key = s.name.replace(/[^a-zA-Z0-9]/g,'_');
    const tEl = document.getElementById('pt-' + key);
    const eEl = document.getElementById('pe-' + key);
    if (!grades[act.groupId][s.name]) grades[act.groupId][s.name] = {};
    if (tEl && tEl.value !== '') {
      grades[act.groupId][s.name].proyecto_teorico = parseFloat(tEl.value);
      saved++;
    }
    if (eEl && eEl.value !== '') {
      grades[act.groupId][s.name].proyecto_expo = parseFloat(eEl.value);
      saved++;
    }
  });
  DB.setGrades(grades);
  toast('Proyecto guardado — ' + (saved/2|0) + ' alumnos', 'success');
  renderActivityDetail(actId);
}

function saveBatchGrades(actId) {
  const act = DB.getActivity(actId);
  const group = DB.getGroup(act.groupId);
  const students = act.targetAll ? (group?.students||[]) : (act.targets||[]).map(t=>({name:t}));
  const subs = DB.getSubmissions();
  let saved = 0;
  students.forEach(s => {
    const key = s.name.replace(/\s/g,'_');
    const el = document.getElementById('bg-'+key);
    if (!el || el.value === '') return;
    const grade = parseFloat(el.value);
    if (isNaN(grade)) return;
    const i = subs.findIndex(ss => ss.activityId === actId && ss.studentName === s.name);
    if (i >= 0) { subs[i].grade = grade; }
    else { subs.push({ activityId: actId, studentName: s.name, grade, submittedAt: Date.now(), late: false }); }
    saved++;
  });
  DB.setSubmissions(subs);
  toast(`${saved} calificaciones guardadas`, 'success');
  renderActivityDetail(actId);
}

function updateActivity(aid) {
  const acts = DB.getActivities();
  const i = acts.findIndex(a => a.id === aid);
  if (i < 0) return;
  acts[i].title = document.getElementById('ae-title').value.trim() || acts[i].title;
  acts[i].desc = document.getElementById('ae-desc').value.trim();
  acts[i].points = parseInt(document.getElementById('ae-points').value) || acts[i].points;
  const due = document.getElementById('ae-due').value;
  acts[i].dueDate = due ? new Date(due).getTime() : null;
  DB.setActivities(acts);
  toast('Actividad actualizada', 'success'); renderActivityDetail(aid);
}

function deleteActivity(aid) {
  if (!confirm('¿Eliminar esta actividad? No se puede deshacer.')) return;
  const acts = DB.getActivities().filter(a => a.id !== aid); DB.setActivities(acts);
  toast('Actividad eliminada'); goBackFromActivity();
}

/* ─── ASISTENCIA ─── */
function prepareAttendanceSection() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('att-date').value = today;
  document.getElementById('att-import-section').style.display = 'block';
  loadAttendanceList();
}

function loadAttendanceList() {
  const gid = document.getElementById('att-group-select').value;
  const dateEl = document.getElementById('att-date');
  if (!dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  const date = dateEl.value;
  const wrap = document.getElementById('attendance-list-wrap');
  const saveWrap = document.getElementById('att-save-btn-wrap');
  if (!gid || !date) { wrap.innerHTML = ''; saveWrap.style.display='none'; return; }
  const group = DB.getGroup(gid);
  if (!group) return;
  const students = group.students || [];
  // Cargar asistencia existente
  const existing = DB.getAttendance().find(a => a.groupId === gid && a.date === date);
  attendanceTempData = existing ? { ...existing.records } : {};
  wrap.innerHTML = `<div class="att-list">${students.map(s => {
    const val = attendanceTempData[s.name] || '';
    return `<div class="att-row">
      <div class="att-name">${s.name}</div>
      <div class="att-btns">
        ${['A','R','J','F'].map(opt => `<button class="att-btn ${val===opt?'active-'+opt:''}" id="att-${s.name.replace(/\s/g,'_')}-${opt}" onclick="App.setAttendance('${s.name}','${opt}','${gid}','${date}')">${opt}</button>`).join('')}
      </div>
    </div>`;
  }).join('')}</div>`;
  saveWrap.style.display = 'block';
}

function setAttendance(studentName, status, gid, date) {
  attendanceTempData[studentName] = status;
  const key = studentName.replace(/\s/g,'_');
  ['A','R','J','F'].forEach(opt => {
    const btn = document.getElementById(`att-${key}-${opt}`);
    if (btn) { btn.className = 'att-btn' + (opt === status ? ' active-'+opt : ''); }
  });
}

function saveAttendance() {
  const gid = document.getElementById('att-group-select').value;
  const date = document.getElementById('att-date').value;
  if (!gid || !date) return;
  const att = DB.getAttendance();
  const i = att.findIndex(a => a.groupId === gid && a.date === date);
  const entry = { groupId: gid, date, records: { ...attendanceTempData }, savedAt: Date.now() };
  if (i >= 0) att[i] = entry; else att.push(entry);
  DB.setAttendance(att);
  DB.addLog({ who: 'Docente', action: `Asistencia guardada ${date}`, groupId: gid });
  toast('Asistencia guardada', 'success');
}

function quickAttendance() {
  const groups = DB.getGroups();
  if (groups.length === 0) { toast('No hay grupos', 'error'); return; }
  showTeacherSection('attendance');
  if (groups.length > 0) {
    document.getElementById('att-group-select').value = groups[0].id;
    loadAttendanceList();
  }
}

function importAttendancePDF(input) {
  const file = input.files[0];
  if (!file) return;
  const gid = document.getElementById('att-group-select').value;
  const group = DB.getGroup(gid);
  if (!group) { toast('Selecciona un grupo primero', 'error'); return; }
  const today = new Date().toISOString().split('T')[0];
  // El PDF del portal ICEP es imagen escaneada - no tiene texto seleccionable
  // Mostrar opciones: captura rápida por alumno, o ingresar manualmente
  const students = group.students || [];
  const studentRows = students.map(s => {
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
      '<div style="flex:1;font-size:12px;font-weight:600">' + s.name + '</div>' +
      '<div style="display:flex;gap:4px">' +
        ['A','R','J','F'].map(opt =>
          '<button onclick="App.setImportAtt(this,\'' + s.name.replace(/'/g,"\'") + '\')" data-val="' + opt + '" ' +
          'style="width:32px;height:32px;border-radius:6px;border:1.5px solid var(--border);background:var(--bg3);font-weight:700;font-size:12px;cursor:pointer">' +
          opt + '</button>'
        ).join('') +
      '</div>' +
    '</div>';
  }).join('');
  showModal(
    '<div class="modal-title">Captura rapida de asistencia</div>' +
    '<p style="font-size:12px;color:var(--text2);margin-bottom:12px">El PDF del portal es una imagen y no permite copiar texto. Usa esta captura rapida: selecciona A/R/J/F para cada alumno.</p>' +
    '<div class="form-group"><label>Fecha</label><input type="date" id="imp-date" value="' + today + '" /></div>' +
    '<div style="max-height:350px;overflow-y:auto;margin-bottom:12px">' + studentRows + '</div>' +
    '<button class="btn-primary full" onclick="App.confirmImportAtt(' + JSON.stringify(gid) + ')" >Guardar asistencia</button>'
  );
  window._importAttData = {};
}

function setImportAtt(btn, studentName) {
  const val = btn.dataset.val;
  const row = btn.closest('div[style*="border-bottom"]');
  row.querySelectorAll('button[data-val]').forEach(b => {
    b.style.background = 'var(--bg3)';
    b.style.color = 'var(--text)';
    b.style.borderColor = 'var(--border)';
  });
  const colors = {A:'var(--green)',R:'var(--yellow)',J:'var(--blue)',F:'var(--red)'};
  btn.style.background = colors[val] || 'var(--accent)';
  btn.style.color = 'white';
  btn.style.borderColor = colors[val] || 'var(--accent)';
  if (!window._importAttData) window._importAttData = {};
  window._importAttData[studentName] = val;
}

function confirmImportAtt(btnOrGid) {
  const gid = (typeof btnOrGid === 'string') ? btnOrGid : (btnOrGid?.dataset?.gid || '');
  const date = document.getElementById('imp-date')?.value;
  if (!date) { toast('Selecciona la fecha', 'error'); return; }
  const records = window._importAttData || {};
  const count = Object.keys(records).length;
  if (count === 0) { toast('Selecciona al menos una asistencia', 'error'); return; }
  const att = DB.getAttendance();
  const i = att.findIndex(a => a.groupId === gid && a.date === date);
  const entry = { groupId: gid, date, records, savedAt: Date.now() };
  if (i >= 0) att[i] = entry; else att.push(entry);
  DB.setAttendance(att);
  closeModal();
  toast(count + ' registros guardados para ' + date, 'success');
  loadAttendanceList();
}

function runImportPDF(gid) {
  const text = document.getElementById('imp-text')?.value || '';
  const date = document.getElementById('imp-date')?.value;
  if (!text.trim() || !date) { toast('Faltan datos', 'error'); return; }
  const group = DB.getGroup(gid);
  if (!group) return;
  const students = group.students || [];
  const records = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const norm2 = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').trim();
  students.forEach(s => {
    const sn = norm2(s.name);
    const words = sn.split(' ').filter(w => w.length > 2);
    const matchLine = lines.find(l => {
      const ln = norm2(l);
      return words.filter(w => ln.includes(w)).length >= Math.min(2, words.length);
    });
    if (!matchLine) return;
    const li = lines.indexOf(matchLine);
    const ctx = lines.slice(Math.max(0,li-1), li+3).join(' ').toLowerCase();
    if (ctx.includes('inasistencia') || ctx.match(/tache|falta|[✗✕×x]/) ) records[s.name] = 'F';
    else if (ctx.includes('retardo') || ctx.match(/reloj|tarde/)) records[s.name] = 'R';
    else if (ctx.includes('justificad')) records[s.name] = 'J';
    else if (ctx.includes('asistencia') || ctx.match(/palomita|check|presente/)) records[s.name] = 'A';
  });
  const found = Object.keys(records).length;
  if (found === 0) {
    toast('No se encontraron coincidencias. Verifica el texto pegado.', 'error');
    return;
  }
  const att = DB.getAttendance();
  const i = att.findIndex(a => a.groupId === gid && a.date === date);
  const entry = { groupId: gid, date, records, savedAt: Date.now(), importedFromPDF: true };
  if (i >= 0) att[i] = entry; else att.push(entry);
  DB.setAttendance(att);
  closeModal();
  toast(found + ' registros importados para ' + date, 'success');
  loadAttendanceList();
}

/* ─── PARTICIPACIÓN ─── */
function openParticipation(gid) {
  const group = DB.getGroup(gid);
  if (!group) return;
  const date = document.getElementById('att-date')?.value || new Date().toISOString().split('T')[0];
  const existing = DB.get('participation_' + gid + '_' + date) || {};
  participationTempData = { ...existing };
  const students = group.students || [];
  const wrap = document.getElementById('attendance-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <p style="font-size:12px;color:var(--text2);margin:8px 0 12px">
      Toca <b>+</b> cada vez que el alumno participe. Se guarda junto con la fecha seleccionada.
    </p>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${students.map(s => {
        const count = participationTempData[s.name] || 0;
        return `<div class="part-row">
          <div class="part-name">${s.name}</div>
          <div class="part-counter">
            <button class="part-dec" onclick="App.changeParticipation('${s.name}',-1,'${gid}','${date}')">−</button>
            <div class="part-count-display" id="pc-${s.name.replace(/[^a-zA-Z0-9]/g,'_')}">${count}</div>
            <button class="part-inc" onclick="App.changeParticipation('${s.name}',1,'${gid}','${date}')">+</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  document.getElementById('att-save-btn-wrap').style.display = 'block';
  document.getElementById('att-save-btn-wrap').innerHTML =
    `<button class="btn-primary full" onclick="App.saveParticipation('${gid}','${date}')">Guardar participacion</button>`;
}

function changeParticipation(btnOrName, delta, gid, date, useSection) {
  let studentName, displayEl;
  // Si se pasa botón (desde sección participación)
  if (btnOrName && typeof btnOrName === 'object' && btnOrName.tagName) {
    const btn = btnOrName;
    const row = btn.closest('.part-row');
    displayEl = row.querySelector('[id^="pc2-"]');
    if(!displayEl) displayEl = row.querySelector('[id^="pc-"]');
    if(!displayEl) return;
    studentName = displayEl.dataset.name;
    gid = displayEl.dataset.gid;
    date = displayEl.dataset.date;
  } else {
    studentName = btnOrName;
    const key = (studentName||'').replace(/[^a-zA-Z0-9]/g,'_');
    displayEl = document.getElementById((useSection ? 'pc2-' : 'pc-') + key);
  }
  if(!studentName) return;
  participationTempData[studentName] = Math.max(0, (participationTempData[studentName]||0) + delta);
  if(displayEl) displayEl.textContent = participationTempData[studentName];
}

function prepareParticipationSection() {
  loadGroupSelects();
  const dateEl = document.getElementById('part-date');
  if(dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  const gid = document.getElementById('part-group-select')?.value;
  if(gid) loadParticipationSection(gid);
}

function loadParticipationSection(gid) {
  if(!gid) gid = document.getElementById('part-group-select')?.value;
  if(!gid) return;
  const dateEl = document.getElementById('part-date');
  if(dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  const date = dateEl?.value || new Date().toISOString().split('T')[0];
  const group = DB.getGroup(gid);
  if(!group) return;
  const existing = DB.get('participation_' + gid + '_' + date) || {};
  participationTempData = {...existing};
  const students = group.students || [];
  const wrap = document.getElementById('participation-list-wrap');
  if(!wrap) return;
  if(students.length === 0) {
    wrap.innerHTML = '<p class="empty-state">No hay alumnos en este grupo</p>';
    return;
  }
  wrap.innerHTML = students.map(function(s) {
    var count = participationTempData[s.name] || 0;
    var key = s.name.replace(/[^a-zA-Z0-9]/g,'_');
    var safeName = s.name.replace(/"/g,'&quot;');
    return '<div class="part-row"><div class="part-name">' + s.name + '</div><div class="part-counter"><button class="part-dec" onclick="App.changeParticipation(this,1*-1)">-</button><div class="part-count-display" id="pc2-' + key + '" data-name="' + safeName + '" data-gid="' + gid + '" data-date="' + date + '">' + count + '</div><button class="part-inc" onclick="App.changeParticipation(this,1)">+</button></div></div>';
  }).join('');
  const saveBtn = document.getElementById('part-save-btn');
  if(saveBtn) saveBtn.style.display = 'block';
}

function saveParticipationSection() {
  const gid = document.getElementById('part-group-select')?.value;
  const date = document.getElementById('part-date')?.value;
  if(!gid || !date) { toast('Selecciona grupo y fecha', 'error'); return; }
  saveParticipation(gid, date);
  toast('Participacion guardada', 'success');
}

function saveParticipation(gid, date) {
  DB.set('participation_' + gid + '_' + date, participationTempData);
  // Calcular calificaciones de participación
  const vals = Object.values(participationTempData).map(Number);
  const max = Math.max(...vals, 1);
  const grades = DB.getGrades();
  if (!grades[gid]) grades[gid] = {};
  Object.entries(participationTempData).forEach(([name, count]) => {
    if (!grades[gid][name]) grades[gid][name] = {};
    // Acumular días de participación
    if (!grades[gid][name]._part_days) grades[gid][name]._part_days = [];
    const di = grades[gid][name]._part_days.findIndex(d => d.date === date);
    const dayScore = Math.round((count / max) * 10);
    if (di >= 0) grades[gid][name]._part_days[di] = { date, score: dayScore };
    else grades[gid][name]._part_days.push({ date, score: dayScore });
    // Promedio de participación
    const scores = grades[gid][name]._part_days.map(d => d.score);
    grades[gid][name].participacion = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
  });
  DB.setGrades(grades);
}

/* ─── CALIFICACIONES ─── */
function prepareGradesSection() {
  loadGroupSelects();
}

function loadGradesView() {
  const gid = document.getElementById('grades-group-select').value;
  const container = document.getElementById('grades-view');
  if (!container) return;
  if (!gid) { container.innerHTML = ''; return; }
  const group = DB.getGroup(gid);
  if (!group) return;
  const rubrics = DB.getRubrics();
  const rubric = rubrics[group.level] || rubrics.bach;
  const students = group.students || [];
  const grades = DB.getGrades();
  const gGrades = grades[gid] || {};
  const projW = DB.getProjectWeights();

  // Botón participación rápida
  const partBtn = `<button class="btn-accent sm" style="margin-bottom:12px" onclick="App.openParticipation('${gid}')">+ Participación de hoy</button>`;

  // Tabla
  const cols = rubric.map(r => `<th>${r.label}<br/><span style="color:var(--text3);font-size:9px">${r.pct}%</span></th>`).join('') + '<th>FINAL</th>';
  const rows = students.map(s => {
    const sg = gGrades[s.name] || {};
    const cells = rubric.map(r => {
      if (r.key === 'asistencia') {
        const att = DB.getAttendance().filter(a => a.groupId === gid);
        let total = 0, sum = 0;
        att.forEach(day => {
          const rec = (day.records||{})[s.name];
          if (rec) { total++; sum += rec==='A'?10:rec==='R'||rec==='J'?8:0; }
        });
        const score = total > 0 ? Math.round(sum/total) : '-';
        return `<td><span class="final-grade">${score}</span></td>`;
      }
      if (r.key === 'participacion') {
        const score = sg.participacion !== undefined ? sg.participacion : '-';
        return `<td><span class="final-grade">${score}</span></td>`;
      }
      if (r.key === 'proyecto') {
        // Buscar actividades de tipo proyecto para calcular
        const projActs = DB.getActivitiesByGroup(gid).filter(a => a.type === 'proyecto');
        let tScore = sg.proyecto_teorico;
        let eScore = sg.proyecto_expo;
        // Si hay actividades de proyecto con subtipos, usar esas
        projActs.forEach(a => {
          const sub = DB.getSubmission(a.id, s.name);
          if(!sub || sub.grade===undefined) return;
          if(a.proyectoTipo==='teorico') tScore = sub.grade/a.points*10;
          else if(a.proyectoTipo==='exposicion') eScore = sub.grade/a.points*10;
        });
        const t = tScore !== undefined ? tScore : '';
        const e = eScore !== undefined ? eScore : '';
        const final = (t!=='' && e!=='') ? Math.round((parseFloat(t)*projW.teorico + parseFloat(e)*projW.expo)/100*10)/10 : '-';
        return `<td style="min-width:140px">
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <label style="font-size:9px;color:var(--text2)">T</label>
            <input type="number" min="0" max="10" step="0.1" class="grade-input" style="width:44px" value="${t}" onchange="App.setProjectGrade('${gid}','${s.name}','teorico',this.value)" placeholder="-" />
            <label style="font-size:9px;color:var(--text2)">E</label>
            <input type="number" min="0" max="10" step="0.1" class="grade-input" style="width:44px" value="${e}" onchange="App.setProjectGrade('${gid}','${s.name}','expo',this.value)" placeholder="-" />
          </div>
          <div style="font-size:10px;color:var(--accent);margin-top:3px">= ${final} (${projW.teorico}%T/${projW.expo}%E)</div>
        </td>`;
      }
      // Promedio de actividades del tipo
      const acts = DB.getActivitiesByGroup(gid).filter(a => a.type === r.key);
      if (acts.length === 0) {
        const manual = sg[r.key];
        return `<td><input type="number" class="grade-input" value="${manual||''}" onchange="App.setManualGrade('${gid}','${s.name}','${r.key}',this.value)" placeholder="-" /></td>`;
      }
      const subs = acts.map(a => {
        const sub = DB.getSubmission(a.id, s.name);
        return sub && sub.grade !== undefined ? sub.grade / a.points * 10 : null;
      }).filter(v => v !== null);
      const avg = subs.length > 0 ? Math.round(subs.reduce((a,b)=>a+b,0)/subs.length*10)/10 : '-';
      return `<td><span class="final-grade">${avg}</span></td>`;
    }).join('');

    // Calcular final
    let finalScore = 0, totalPct = 0;
    rubric.forEach(r => {
      let val = null;
      if (r.key === 'asistencia') {
        const att = DB.getAttendance().filter(a => a.groupId === gid);
        let total = 0, sum = 0;
        att.forEach(day => { const rec=(day.records||{})[s.name]; if(rec){total++;sum+=rec==='A'?10:rec==='R'||rec==='J'?8:0;} });
        val = total > 0 ? sum/total : null;
      } else if (r.key === 'participacion') {
        val = sg.participacion !== undefined ? sg.participacion : null;
      } else if (r.key === 'proyecto') {
        const t = sg.proyecto_teorico; const e = sg.proyecto_expo;
        if (t !== undefined && e !== undefined) val = (t*projW.teorico + e*projW.expo)/100;
      } else {
        const acts = DB.getActivitiesByGroup(gid).filter(a => a.type === r.key);
        if (acts.length > 0) {
          const subs = acts.map(a => { const sub=DB.getSubmission(a.id,s.name); return sub&&sub.grade!==undefined?sub.grade/a.points*10:null; }).filter(v=>v!==null);
          if (subs.length > 0) val = subs.reduce((a,b)=>a+b,0)/subs.length;
        } else { val = sg[r.key] !== undefined ? sg[r.key] : null; }
      }
      if (val !== null) { finalScore += (val * r.pct / 100); totalPct += r.pct; }
    });
    const finalDisplay = totalPct > 0 ? Math.round((finalScore / totalPct * 100) * 10) / 10 : '-';
    return `<tr><td style="font-size:12px;font-weight:600;white-space:nowrap">${s.name}</td>${cells}<td class="final-grade" style="font-size:14px">${finalDisplay}</td></tr>`;
  }).join('');

  container.innerHTML = `${partBtn}<div class="grades-scroll"><table><thead><tr><th>Alumno</th>${cols}</tr></thead><tbody>${rows}</tbody></table></div>
  <p style="font-size:11px;color:var(--text3);margin-top:8px">Proyecto: T=Teórico, E=Exposición. Las celdas editables se guardan automáticamente.</p>`;
}

function setManualGrade(gid, studentName, key, value) {
  const grades = DB.getGrades();
  if (!grades[gid]) grades[gid] = {};
  if (!grades[gid][studentName]) grades[gid][studentName] = {};
  grades[gid][studentName][key] = parseFloat(value) || 0;
  DB.setGrades(grades);
}

function setProjectGrade(gid, studentName, sub, value) {
  const grades = DB.getGrades();
  if (!grades[gid]) grades[gid] = {};
  if (!grades[gid][studentName]) grades[gid][studentName] = {};
  grades[gid][studentName]['proyecto_'+sub] = parseFloat(value) || 0;
  DB.setGrades(grades);
}

/* ─── MURO ─── */
function postWallMessage() {
  const msg = document.getElementById('wall-message').value.trim();
  const gid = document.getElementById('wall-group-select').value;
  if (!msg) { toast('Escribe un mensaje', 'error'); return; }
  const prof = DB.getTeacher();
  const posts = DB.getWallPosts();
  posts.unshift({ id: uid(), author: prof.name, groupId: gid, message: msg, ts: Date.now() });
  DB.setWallPosts(posts);
  document.getElementById('wall-message').value = '';
  toast('Publicado', 'success'); renderWallPosts();
}

function renderWallPosts(containerId = 'wall-posts') {
  const posts = DB.getWallPosts();
  const el = document.getElementById(containerId);
  if (!el) return;
  const groups = DB.getGroups();
  if (posts.length === 0) { el.innerHTML = '<p class="empty-state"><span class="empty-icon">◎</span><p>Sin publicaciones</p></p>'; return; }
  el.innerHTML = posts.map(p => {
    const group = groups.find(g => g.id === p.groupId);
    return `<div class="wall-post">
      <div class="wall-post-header">
        <span class="wall-post-author">${p.author}</span>
        <span class="wall-post-date">${fmtTs(p.ts)}</span>
      </div>
      <div class="wall-post-body">${p.message}</div>
      <div class="wall-post-group">→ ${p.groupId === 'all' ? 'Todos los grupos' : (group ? group.name : p.groupId)}</div>
    </div>`;
  }).join('');
}

/* ─── PERFIL / RÚBRICAS ─── */
function loadProfileForm() {
  const prof = DB.getTeacher();
  document.getElementById('prof-name').value = prof.name || '';
  document.getElementById('prof-phone').value = prof.phone || '';
  document.getElementById('prof-email').value = prof.email || '';
}

function saveProfile() {
  const prof = DB.getTeacher();
  prof.name = document.getElementById('prof-name').value.trim() || prof.name;
  prof.phone = document.getElementById('prof-phone').value.trim();
  prof.email = document.getElementById('prof-email').value.trim();
  DB.set('teacher_profile', prof);
  document.getElementById('teacher-greeting').textContent = `Hola, ${prof.name.split(' ')[0]}`;
  toast('Perfil guardado', 'success');
}

function loadRubricEditor() {
  const rubrics = DB.getRubrics();
  ['bach','lic'].forEach(level => {
    const container = document.getElementById('rubric-'+level+'-items');
    if (!container) return;
    container.innerHTML = rubrics[level].map((r,i) => `
      <div class="rubric-row">
        <label><input type="text" value="${r.label}" id="rl-${level}-${i}" style="background:transparent;border:none;border-bottom:1px solid var(--border);padding:4px;width:100%;font-size:13px" /></label>
        <input type="number" id="rp-${level}-${i}" value="${r.pct}" min="0" max="100" />
        <span style="font-size:12px;color:var(--text2)">%</span>
      </div>
    `).join('');
  });
  const pw = DB.getProjectWeights();
  document.getElementById('proj-teorico').value = pw.teorico;
  document.getElementById('proj-expo').value = pw.expo;
}

function saveRubrics() {
  const rubrics = DB.getRubrics();
  ['bach','lic'].forEach(level => {
    rubrics[level].forEach((r,i) => {
      r.label = document.getElementById(`rl-${level}-${i}`)?.value || r.label;
      r.pct = parseInt(document.getElementById(`rp-${level}-${i}`)?.value) || r.pct;
    });
  });
  const totalBach = rubrics.bach.reduce((a,r)=>a+r.pct,0);
  const totalLic = rubrics.lic.reduce((a,r)=>a+r.pct,0);
  if (totalBach !== 100) { toast(`Bachillerato suma ${totalBach}%, debe ser 100%`, 'error'); return; }
  if (totalLic !== 100) { toast(`Licenciatura suma ${totalLic}%, debe ser 100%`, 'error'); return; }
  DB.set('rubrics', rubrics); toast('Rúbricas guardadas', 'success');
}

function saveProjectWeights() {
  const t = parseInt(document.getElementById('proj-teorico').value) || 50;
  const e = parseInt(document.getElementById('proj-expo').value) || 50;
  if (t + e !== 100) { toast('Teórico + Exposición deben sumar 100%', 'error'); return; }
  DB.set('project_weights', { teorico:t, expo:e });
  toast('Pesos del proyecto guardados', 'success');
}

function loadExportSelect() {
  const groups = DB.getGroups();
  const el = document.getElementById('export-group-select');
  if (el) el.innerHTML = '<option value="">Selecciona grupo...</option>' + groups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
}

/* ─── EXPORTAR ─── */
function exportGrades(format) {
  const gid = document.getElementById('export-group-select').value;
  if (!gid) { toast('Selecciona un grupo', 'error'); return; }
  const group = DB.getGroup(gid);
  const rubrics = DB.getRubrics();
  const rubric = rubrics[group.level] || rubrics.bach;
  const students = group.students || [];
  const grades = DB.getGrades()[gid] || {};
  const projW = DB.getProjectWeights();

  const headers = ['Nombre', ...rubric.map(r => r.label + ' ('+r.pct+'%)'), 'Calificación Final'];
  const rows = students.map(s => {
    const sg = grades[s.name] || {};
    const cells = rubric.map(r => {
      if (r.key === 'asistencia') {
        const att = DB.getAttendance().filter(a => a.groupId === gid);
        let total=0,sum=0; att.forEach(d=>{const rec=(d.records||{})[s.name];if(rec){total++;sum+=rec==='A'?10:rec==='R'||rec==='J'?8:0;}});
        return total>0 ? Math.round(sum/total) : '';
      }
      if (r.key === 'participacion') return sg.participacion !== undefined ? sg.participacion : '';
      if (r.key === 'proyecto') {
        const t=sg.proyecto_teorico,e=sg.proyecto_expo;
        return (t!==undefined&&e!==undefined) ? Math.round((t*projW.teorico+e*projW.expo)/100) : '';
      }
      const acts=DB.getActivitiesByGroup(gid).filter(a=>a.type===r.key);
      if(acts.length>0){const subs=acts.map(a=>{const sub=DB.getSubmission(a.id,s.name);return sub&&sub.grade!==undefined?sub.grade/a.points*10:null;}).filter(v=>v!==null);return subs.length>0?Math.round(subs.reduce((a,b)=>a+b,0)/subs.length*10)/10:'';}
      return sg[r.key]!==undefined?sg[r.key]:'';
    });
    // Final
    let finalScore=0,totalPct=0;
    rubric.forEach((r,ri)=>{const v=parseFloat(cells[ri]);if(!isNaN(v)){finalScore+=v*r.pct/100;totalPct+=r.pct;}});
    const final=totalPct>0?Math.round(finalScore/totalPct*100*10)/10:'';
    return [s.name, ...cells, final];
  });

  const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

  if (format === 'csv') {
    const blob = new Blob(['\ufeff'+csvContent], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${group.name}_calificaciones.csv`; a.click();
    toast('CSV descargado', 'success');
  } else {
    // XLSX simple usando CSV con extensión xlsx (Excel puede abrirlo)
    const blob = new Blob(['\ufeff'+csvContent], { type:'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${group.name}_calificaciones.xlsx`; a.click();
    toast('XLSX descargado', 'success');
  }
}

/* ─── APP ESTUDIANTE ─── */
function loadStudentApp() {
  showScreen('student');
  const group = DB.getGroup(currentUser.groupId);
  currentStudentGroup = group;
  document.getElementById('student-greeting').textContent = `Hola, ${currentUser.name.split(' ').pop()}`;
  renderStudentDashboard();
  loadStudentActivities();
  renderStudentGrades();
  renderWallPosts('s-wall-posts');
  showStudentSection('s-dashboard');
}

function showStudentSection(name) {
  document.querySelectorAll('#screen-student .t-section').forEach(s => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  document.querySelectorAll('#screen-student .nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  if (name === 's-wall') renderWallPosts('s-wall-posts');
  if (name === 's-grades') renderStudentGrades();
  if (name === 's-activities') loadStudentActivities();
}

function renderStudentDashboard() {
  const group = currentStudentGroup;
  const prof = DB.getTeacher();
  if (!group) return;
  document.getElementById('s-group-info-card').innerHTML = `
    <div class="teacher-info-card">
      <div class="ti-name">📚 ${group.subject}</div>
      <div class="ti-row">👤 ${prof.name || 'Maestra'}</div>
      ${prof.phone ? `<div class="ti-row">📱 <a href="https://wa.me/52${prof.phone}" target="_blank">WhatsApp: ${prof.phone}</a></div>` : ''}
      <div class="ti-row">📅 ${fmt(group.startDate)} — ${fmt(group.endDate)}</div>
      <div class="ti-row">⬡ ${group.name}</div>
    </div>
  `;
  // Próximas actividades
  const now = Date.now();
  const acts = DB.getActivitiesByGroup(group.id).filter(a => {
    if (!a.targetAll && !(a.targets||[]).includes(currentUser.name)) return false;
    const sub = DB.getSubmission(a.id, currentUser.name);
    return !sub || (!sub.fileData && !sub.waSent);
  }).sort((a,b) => (a.dueDate||Infinity) - (b.dueDate||Infinity)).slice(0,3);
  document.getElementById('s-upcoming-activities').innerHTML = acts.length === 0 ? '<p class="empty-state"><span class="empty-icon">✓</span><p>¡Sin pendientes!</p></p>' :
    `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--text2);margin-bottom:10px">Próximas entregas</h3>` +
    acts.map(a => {
      const isLate = a.dueDate && now > a.dueDate;
      return `<div class="activity-card" onclick="App.openStudentActivity('${a.id}')">
        <div class="act-title">${a.title}</div>
        <div class="act-meta">${a.dueDate ? fmtTs(a.dueDate) : 'Sin fecha límite'}</div>
        ${isLate ? '<span class="badge badge-red">Fuera de tiempo</span>' : ''}
      </div>`;
    }).join('');
}

function filterStudentActivities(filter) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadStudentActivities(filter);
}

function loadStudentActivities(filter='pending') {
  const group = currentStudentGroup;
  if (!group) return;
  const now = Date.now();
  let acts = DB.getActivitiesByGroup(group.id).filter(a => a.targetAll || (a.targets||[]).includes(currentUser.name));
  acts = acts.filter(a => {
    const sub = DB.getSubmission(a.id, currentUser.name);
    const submitted = sub && (sub.fileData || sub.waSent);
    if (filter === 'pending') return !submitted;
    if (filter === 'submitted') return submitted;
    return true;
  });
  const container = document.getElementById('s-activities-list');
  if (acts.length === 0) { container.innerHTML = '<div class="empty-state"><span class="empty-icon">◈</span><p>Sin actividades en esta categoría</p></div>'; return; }
  container.innerHTML = acts.map(a => {
    const sub = DB.getSubmission(a.id, currentUser.name);
    const submitted = sub && (sub.fileData || sub.waSent);
    const isLate = a.dueDate && now > a.dueDate;
    return `<div class="activity-card" onclick="App.openStudentActivity('${a.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="act-title">${a.title}</div>
        ${submitted ? '<span class="badge badge-green">Entregada</span>' : isLate ? '<span class="badge badge-red">Vencida</span>' : '<span class="badge badge-yellow">Pendiente</span>'}
      </div>
      <div class="act-meta">${getLabelForType(a.type)} · ${a.dueDate ? fmtTs(a.dueDate) : 'Sin fecha'}</div>
      ${sub && sub.grade !== undefined ? `<div style="margin-top:8px"><span class="badge badge-green">Calificación: ${sub.grade}/${a.points}</span> ${sub.teacherComment ? `<span style="font-size:11px;color:var(--text2);margin-left:6px">${sub.teacherComment}</span>` : ''}</div>` : ''}
    </div>`;
  }).join('');
}

function openStudentActivity(aid) {
  currentActivityId = aid;
  const act = DB.getActivity(aid);
  const group = currentStudentGroup;
  const sub = DB.getSubmission(aid, currentUser.name);
  const isLate = act.dueDate && Date.now() > act.dueDate;
  const submitted = sub && (sub.fileData || sub.waSent);
  let content = `
    <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">${act.title}</h2>
    <span class="badge ${getBadgeForType(act.type)}">${getLabelForType(act.type)}</span>
    <p style="color:var(--text2);font-size:13px;margin:12px 0">${act.desc || ''}</p>
    <p style="font-size:12px;font-family:var(--font-mono);color:var(--text3)">Fecha límite: ${act.dueDate ? fmtTs(act.dueDate) : 'Sin fecha'}</p>
    ${isLate ? '<div class="error-msg" style="margin:8px 0">⏰ La fecha límite ha pasado. Tu entrega quedará marcada como fuera de tiempo.</div>' : ''}
    ${sub && sub.grade !== undefined ? `<div style="margin:12px 0;padding:12px;background:var(--bg3);border-radius:var(--radius-sm)"><strong>Calificación:</strong> ${sub.grade}/${act.points}${sub.teacherComment ? ` · ${sub.teacherComment}` : ''}</div>` : ''}
  `;

  // Autogestión / Desarrollo Personal → autoevaluación
  if (['autogestion','desarrollo'].includes(act.type)) {
    const existing = sub ? (sub.autoeval || 0) : 0;
    content += `
      <div style="margin:16px 0">
        <p style="font-size:13px;font-weight:700;margin-bottom:8px">${act.type === 'autogestion' ? 'Autoevaluación de Autogestión y Aprendizaje' : 'Autoevaluación de Desarrollo Personal'}</p>
        <p style="font-size:12px;color:var(--text2);margin-bottom:10px">Califica tu desempeño del 1 al 5 estrellas:</p>
        <div class="autoeval-stars">
          ${[1,2,3,4,5].map(i => `<span class="autoeval-star ${existing>=i?'active':''}" onclick="App.setAutoeval(${i})" data-val="${i}">★</span>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:6px" id="autoeval-label">${getAutoEvalLabel(existing)}</div>
        <div class="form-group" style="margin-top:12px"><label>Reflexión / Evidencia (opcional)</label><textarea id="stu-comment" rows="3" placeholder="Describe lo que aprendiste, evidencias, actividades realizadas...">${sub ? (sub.comment||'') : ''}</textarea></div>
        <input type="hidden" id="autoeval-val" value="${existing}" />
      </div>
    `;
  } else {
    content += `<div class="form-group" style="margin:12px 0"><label>Comentario (opcional)</label><textarea id="stu-comment" rows="2" placeholder="Agrega un comentario a tu entrega...">${sub ? (sub.comment||'') : ''}</textarea></div>`;
  }

  if (!submitted || sub?.reopened) {
    content += `
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
        <label class="upload-area" for="stu-file-upload">
          <span>📎 Adjuntar archivo / foto</span>
          <small style="color:var(--text3)">Imagen, PDF, Word, etc.</small>
          <input type="file" id="stu-file-upload" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" onchange="App.previewStudentFile(this)" />
        </label>
        <div id="stu-file-preview" style="display:none;font-size:13px;color:var(--green)"></div>
        <div style="display:flex;gap:10px;align-items:center">
          <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer">
            <input type="checkbox" id="stu-wa-check" onchange="App.toggleWASubmit(this)" />
            Ya lo envié por WhatsApp
          </label>
        </div>
        <button class="btn-primary full" onclick="App.submitStudentActivity('${aid}')">Entregar</button>
      </div>
    `;
  } else {
    const prof = DB.getTeacher();
    content += `
      <div style="margin-top:16px;padding:12px;background:var(--bg3);border-radius:var(--radius-sm)">
        <p style="color:var(--green);font-weight:700;margin-bottom:8px">✓ Actividad entregada ${sub.late ? '(fuera de tiempo)' : 'a tiempo'}</p>
        ${sub.waSent ? '<p style="font-size:13px;color:var(--text2)">Enviada por WhatsApp</p>' : ''}
        <p style="font-size:12px;color:var(--text3);margin-top:8px">¿Enviaste algo incorrecto? Solicita a tu maestra que reabra la actividad:</p>
        ${prof.phone ? `<a href="https://wa.me/52${prof.phone}?text=${encodeURIComponent(`Maestra, soy ${currentUser.name}, necesito que reabra la actividad "${act.title}"`)}" target="_blank" class="btn-accent sm" style="display:inline-block;margin-top:8px;text-decoration:none">📱 Solicitar por WhatsApp</a>` : ''}
        <button class="btn-outline" style="margin-top:8px;width:100%" onclick="App.requestReopen('${aid}')">Solicitar reapertura en portal</button>
      </div>
    `;
  }

  document.getElementById('s-activity-submit-content').innerHTML = content;
  showStudentSection('s-activity-submit');
  document.getElementById('s-activity-submit').querySelector('.back-btn')?.addEventListener('click', () => showStudentSection('s-activities'));
  window._currentAutoeval = sub ? (sub.autoeval || 0) : 0;
}

let _currentAutoeval = 0;
function setAutoeval(val) {
  _currentAutoeval = val;
  document.getElementById('autoeval-val').value = val;
  document.querySelectorAll('.autoeval-star').forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= val));
  document.getElementById('autoeval-label').textContent = getAutoEvalLabel(val);
}
function getAutoEvalLabel(val) {
  const labels = ['','Necesito mejorar','Regular, en proceso','Bien, cumplí lo esperado','Muy bien, superé expectativas','Excelente, logro total'];
  return labels[val] || '';
}

function previewStudentFile(input) {
  const file = input.files[0];
  const preview = document.getElementById('stu-file-preview');
  if (file) { preview.style.display='block'; preview.textContent = '✓ ' + file.name + ' (' + Math.round(file.size/1024) + ' KB)'; }
}

function toggleWASubmit(cb) {
  document.getElementById('stu-file-upload').disabled = cb.checked;
}

function submitStudentActivity(aid) {
  const act = DB.getActivity(aid);
  const isLate = act.dueDate && Date.now() > act.dueDate;
  const fileInput = document.getElementById('stu-file-upload');
  const waCheck = document.getElementById('stu-wa-check');
  const comment = document.getElementById('stu-comment')?.value || '';
  const autoevalVal = parseInt(document.getElementById('autoeval-val')?.value || '0');
  const hasFile = fileInput && fileInput.files.length > 0;
  const isWA = waCheck && waCheck.checked;
  if (!hasFile && !isWA) { toast('Adjunta un archivo o marca que lo enviaste por WhatsApp', 'error'); return; }
  if (['autogestion','desarrollo'].includes(act.type) && autoevalVal === 0 && !isWA) { toast('Por favor califica tu desempeño con las estrellas', 'error'); return; }

  const doSubmit = (fileData) => {
    const subs = DB.getSubmissions();
    const i = subs.findIndex(s => s.activityId === aid && s.studentName === currentUser.name);
    const entry = { activityId: aid, studentName: currentUser.name, submittedAt: Date.now(), late: isLate, comment, waSent: isWA, fileData: fileData || null, autoeval: autoevalVal, reopened: false };
    if (i >= 0) subs[i] = entry; else subs.push(entry);
    DB.setSubmissions(subs);
    DB.addLog({ who: currentUser.name, action: `Entregó "${act.title}"${isLate?' (fuera de tiempo)':''}`, groupId: currentStudentGroup.id });
    toast(isLate ? '⏰ Entregado fuera de tiempo' : '✓ Entregado correctamente', 'success');
    showStudentSection('s-activities');
  };

  if (hasFile) {
    const reader = new FileReader();
    reader.onload = e => doSubmit(e.target.result);
    reader.readAsDataURL(fileInput.files[0]);
  } else { doSubmit(null); }
}

function requestReopen(aid) {
  const subs = DB.getSubmissions();
  const i = subs.findIndex(s => s.activityId === aid && s.studentName === currentUser.name);
  if (i >= 0) { subs[i].waRequest = true; DB.setSubmissions(subs); }
  DB.addLog({ who: currentUser.name, action: 'Solicitó reapertura de actividad', groupId: currentStudentGroup.id });
  toast('Solicitud enviada a la maestra', 'success');
  openStudentActivity(aid);
}

/* ─── CALIFICACIONES ALUMNO ─── */
function renderStudentGrades() {
  const group = currentStudentGroup;
  if (!group) return;
  const container = document.getElementById('s-grades-content');
  if (!container) return;
  // Verificar si el docente habilitó ver calificaciones
  const gradesVisible = group.showGrades !== false; // default: visible
  if (!gradesVisible) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔒</span><p>La docente ha deshabilitado la vista de calificaciones por el momento.</p></div>`;
    return;
  }
  const rubrics = DB.getRubrics();
  const rubric = rubrics[group.level] || rubrics.bach;
  const grades = DB.getGrades()[group.id] || {};
  const sg = grades[currentUser.name] || {};
  const projW = DB.getProjectWeights();
  const att = DB.getAttendance().filter(a => a.groupId === group.id);
  let attTotal=0,attSum=0;
  att.forEach(d=>{const r=(d.records||{})[currentUser.name];if(r){attTotal++;attSum+=r==='A'?10:r==='R'||r==='J'?8:0;}});
  const attScore = attTotal>0?Math.round(attSum/attTotal):null;

  let totalFinal=0, pctTotal=0;
  const rows = rubric.map(r => {
    let score = null;
    if (r.key === 'asistencia') score = attScore;
    else if (r.key === 'participacion') score = sg.participacion;
    else if (r.key === 'proyecto') {
      const t=sg.proyecto_teorico,e=sg.proyecto_expo;
      if(t!==undefined&&e!==undefined) score=Math.round((t*projW.teorico+e*projW.expo)/100);
    } else {
      const acts=DB.getActivitiesByGroup(group.id).filter(a=>a.type===r.key&&(a.targetAll||(a.targets||[]).includes(currentUser.name)));
      if(acts.length>0){const subs=acts.map(a=>{const sub=DB.getSubmission(a.id,currentUser.name);return sub&&sub.grade!==undefined?sub.grade/a.points*10:null;}).filter(v=>v!==null);if(subs.length>0)score=Math.round(subs.reduce((a,b)=>a+b,0)/subs.length*10)/10;}
      else score=sg[r.key];
    }
    if(score!==null&&score!==undefined){totalFinal+=score*r.pct/100;pctTotal+=r.pct;}
    const bar = score!==null&&score!==undefined ? `<div class="submission-status-bar"><div class="fill" style="width:${score*10}%"></div></div>` : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">${r.label}</div>
        <div style="font-size:11px;color:var(--text2)">${r.pct}% del total</div>
        ${bar}
      </div>
      <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:${score>=7?'var(--green)':score>=5?'var(--yellow)':'var(--red)'}">${score!==null&&score!==undefined?score:'—'}</div>
    </div>`;
  }).join('');

  const final = pctTotal>0?Math.round(totalFinal/pctTotal*100*10)/10:'—';
  container.innerHTML = `${rows}
    <div style="padding:16px;background:var(--bg3);border:2px solid var(--accent);border-radius:var(--radius);text-align:center;margin-top:12px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--text2)">Calificación final</div>
      <div style="font-size:40px;font-weight:800;font-family:var(--font-mono);color:var(--accent)">${final}</div>
    </div>`;
}

/* ─── INIT ─── */
function init() {
  document.getElementById('today-date') && (document.getElementById('today-date').textContent = '');
  // Leer parámetro de grupo en URL (para enlace de registro)
  const params = new URLSearchParams(location.search);
  const gcode = params.get('group');
  if (gcode) {
    const group = DB.getGroups().find(g => g.code === gcode);
    if (group) {
      currentStudentGroup = group;
      showScreen('student-login');
      document.getElementById('student-group-code').value = gcode;
      document.getElementById('student-login-subtitle').textContent = `Grupo: ${group.name}`;
      showStudentStep(3);
      return;
    }
  }
  initSplash();
  // Crear datos iniciales si no existen
  if (!DB.get('teacher_profile')) {
    DB.set('teacher_profile', { name:'Mtra. Nombre Apellido', phone:'', email:'admin@escuela.edu', pass:'1234' });
  }
}

/* ─── DEMO DATA ─── */
function createDemoData() {
  if (DB.getGroups().length > 0) { toast('Ya hay datos existentes'); return; }
  const group1 = { id:'grp1', name:'MAT 2024-A', subject:'Cálculo Diferencial', level:'bach', startDate:'2024-08-12', endDate:'2024-12-20', days:['Lun','Mié','Vie'], hours:2, code:'MAT2024A', students:[
    {name:'González Pérez Juan', registered:false, phone:'', pass:''},
    {name:'Martínez López Ana', registered:false, phone:'', pass:''},
    {name:'Ramírez Torres Luis', registered:false, phone:'', pass:''},
    {name:'Hernández Ruiz María', registered:false, phone:'', pass:''},
  ]};
  const group2 = { id:'grp2', name:'ING 2024-B', subject:'Álgebra Lineal', level:'lic', startDate:'2024-08-12', endDate:'2024-12-20', days:['Mar','Jue'], hours:3, code:'ING2024B', students:[
    {name:'Sánchez Mora Carlos', registered:false, phone:'', pass:''},
    {name:'López Jiménez Sofia', registered:false, phone:'', pass:''},
  ]};
  DB.setGroups([group1, group2]);
  const act1 = { id:'act1', groupId:'grp1', title:'Ejercicio 1 — Límites', desc:'Resolver los ejercicios del libro cap. 2', type:'actividades', points:10, dueDate:Date.now()+86400000, targetAll:true, targets:[], createdAt:Date.now() };
  const act2 = { id:'act2', groupId:'grp1', title:'Tarea Derivadas', desc:'Derivar las funciones del cuestionario', type:'tareas', points:10, dueDate:Date.now()-3600000, targetAll:true, targets:[], createdAt:Date.now() };
  DB.setActivities([act1, act2]);
  toast('Datos de demo creados', 'success');
  loadTeacherApp();
}

// Exponer al DOM
return { login, logout, showScreen, goStudentLogin, showStudentStep,
  studentCheckCode, studentRegister, studentLogin,
  showTeacherSection, showCreateGroup, createGroup, suggestCode,
  openGroupDetail, renderGroups, switchDetailTab, showAddStudents, addStudents, removeStudent,
  showEditGroup, saveEditGroup, toggleArchiveGroup, deleteGroup,
  copyCode, openCreateActivity, createActivity, onActivityGroupChange,
  openActivityDetail, goBackFromActivity, gradeSubmission, editGrade, saveBatchGrades, saveProyectoGrades,
  updateActivity, deleteActivity, reopenSubmission,
  prepareAttendanceSection, loadAttendanceList, setAttendance, saveAttendance,
  quickAttendance, importAttendancePDF, runImportPDF,
  openParticipation, changeParticipation, saveParticipation,
  prepareGradesSection, loadGradesView, setManualGrade, setProjectGrade,
  postWallMessage, renderWallPosts,
  saveProfile, loadRubricEditor, saveRubrics, saveProjectWeights, exportGrades, loadExportSelect,
  showStudentSection, loadStudentActivities, filterStudentActivities,
  openStudentActivity, submitStudentActivity, previewStudentFile, toggleWASubmit,
  requestReopen, setAutoeval, renderStudentGrades, renderStudentDashboard,
  loadTeacherDashboard, loadTeacherApp, loadStudentApp,
  studentLoginDirect, loadParticipationSection, prepareParticipationSection, saveParticipationSection,
  setImportAtt, confirmImportAtt,
  closeModal, createDemoData, init,
  getCurrentStudentGroup: () => currentStudentGroup
};

})();

window.App = App; // global access for onclick

/* ================================================
   PATCH: Reglamento, Reglas de Clase y Firmas
   Se agrega después del cierre original del módulo
   para inyectar funciones nuevas en App
================================================ */
Object.assign(App, (() => {

  const DB2 = {
    getReglamento: (gid) => {
      const all = JSON.parse(localStorage.getItem('reglamentos') || '{}');
      return all[gid] || null;
    },
    setReglamento: (gid, data) => {
      const all = JSON.parse(localStorage.getItem('reglamentos') || '{}');
      all[gid] = data;
      localStorage.setItem('reglamentos', JSON.stringify(all));
    },
    getFirmas: (gid) => {
      const all = JSON.parse(localStorage.getItem('firmas_reglamento') || '{}');
      return all[gid] || [];
    },
    addFirma: (gid, firma) => {
      const all = JSON.parse(localStorage.getItem('firmas_reglamento') || '{}');
      if (!all[gid]) all[gid] = [];
      all[gid].push(firma);
      localStorage.setItem('firmas_reglamento', JSON.stringify(all));
    }
  };

  const DB = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
    getGroups: () => { try { return JSON.parse(localStorage.getItem('groups')) || [] } catch { return [] } },
    getGroup: (id) => { try { return (JSON.parse(localStorage.getItem('groups'))||[]).find(g => g.id === id) } catch { return null } },
    getRubrics: () => {
      try {
        const r = JSON.parse(localStorage.getItem('rubrics'));
        if (r) return r;
      } catch(e) {}
      return {
        bach:[{key:'asistencia',label:'Asistencia',pct:10},{key:'participacion',label:'Participacion',pct:20},{key:'actividades',label:'Actividades',pct:20},{key:'tareas',label:'Tareas',pct:10},{key:'proyecto',label:'Proyecto Integrador',pct:40}],
        lic:[{key:'asistencia',label:'Asistencia',pct:10},{key:'participacion',label:'Participacion',pct:10},{key:'tareas',label:'Tareas',pct:10},{key:'actividades',label:'Actividades',pct:10},{key:'colaborativo',label:'Trabajo Colaborativo',pct:20},{key:'autogestion',label:'Autogestion y Autoaprendizaje',pct:20},{key:'desarrollo',label:'Desarrollo Personal',pct:20},{key:'proyecto',label:'Proyecto Integrador',pct:20}]
      };
    },
    addLog: (entry) => {
      const logs = JSON.parse(localStorage.getItem('interaction_logs') || '[]');
      logs.unshift({ ...entry, ts: Date.now() });
      if (logs.length > 500) logs.length = 500;
      localStorage.setItem('interaction_logs', JSON.stringify(logs));
    }
  };

  const norm = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const fmtTs = (ts) => new Date(ts).toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

  /* Construye el HTML del documento de reglamento+rubrica para mostrar al alumno */
  function buildReglamentoHTML(group) {
    const prof = DB.get('teacher_profile') || {};
    const rubrics = DB.getRubrics() || {};
    const rubric = rubrics[group.level] || rubrics['bach'] || [];
    const reg = DB2.getReglamento(group.id);
    const projW = DB.get('project_weights') || { teorico:50, expo:50 };
    const attDesc = [
      '<b>A</b> Asistencia = 10 pts',
      '<b>R</b> Retardo = 8 pts',
      '<b>J</b> Justificada = 8 pts',
      '<b>F</b> Falta = 0 pts'
    ].join(' &nbsp;|&nbsp; ');

    // Reglas
    const reglasHtml = reg && reg.reglas
      ? '<ul>' + reg.reglas.split('\n').filter(l=>l.trim()).map(l=>`<li>${l.trim()}</li>`).join('') + '</ul>'
      : '<p style="color:#888;font-style:italic">El docente no ha cargado reglas de clase aun.</p>';

    // Rubrica table
    const rubricaRows = rubric.map(r => {
      let nota = '';
      if (r.key === 'proyecto') nota = `(${projW.teorico}% Teorico / ${projW.expo}% Exposicion)`;
      if (r.key === 'autogestion' || r.key === 'desarrollo') nota = '(Autoevaluacion + evidencia)';
      return `<tr><td>${r.label} ${nota}</td><td><b>${r.pct}%</b></td></tr>`;
    }).join('');
    const nivelLabel = group.level === 'lic' ? 'Licenciatura' : 'Bachillerato';

    return `
      <h4>Datos del Curso</h4>
      <p><b>Materia:</b> ${group.subject || ''}</p>
      <p><b>Grupo:</b> ${group.name || ''}</p>
      <p><b>Docente:</b> ${prof.name || ''}</p>
      <p><b>Periodo:</b> ${group.startDate || ''} al ${group.endDate || ''}</p>
      <p><b>Nivel:</b> ${nivelLabel}</p>

      <h4>Reglas de Clase</h4>
      ${reglasHtml}

      <h4>Evaluacion de Asistencia</h4>
      <p>${attDesc}</p>

      <h4>Rubrica de Evaluacion (${nivelLabel})</h4>
      <table class="rubrica-table">
        <thead><tr><th>Criterio</th><th>Porcentaje</th></tr></thead>
        <tbody>${rubricaRows}</tbody>
        <tfoot><tr><td>TOTAL</td><td>100%</td></tr></tfoot>
      </table>

      <h4>Entrega de Actividades</h4>
      <p>Las actividades tienen fecha y hora limite. Las entregas posteriores se marcaran como <b>fuera de tiempo</b>. Las actividades se suben en el portal o se notifica via WhatsApp.</p>

      <h4>Proyecto Integrador</h4>
      <p>El proyecto se divide en: <b>${projW.teorico}% parte teorica</b> y <b>${projW.expo}% exposicion oral</b>.</p>

      ${reg && reg.reglas ? '' : ''}
      <p style="font-size:11px;color:#888;margin-top:12px;border-top:1px solid #333;padding-top:8px">
        Documento generado en MisClases. La firma electronica tiene validez como constancia de lectura y aceptacion.
      </p>
    `;
  }

  /* Docente: cargar editor de reglamento */
  function loadReglamentoEditor() {
    const gid = document.getElementById('reg-group-select')?.value;
    const preview = document.getElementById('reglamento-rubrica-preview');
    const textarea = document.getElementById('reg-reglas');
    if (!gid || !preview || !textarea) return;
    const group = DB.getGroup(gid);
    if (!group) return;
    const existing = DB2.getReglamento(gid);
    textarea.value = existing ? existing.reglas : '';
    const rubrics = DB.getRubrics() || {};
    const rubric = rubrics[group.level] || rubrics['bach'] || [];
    const projW = DB.get('project_weights') || { teorico:50, expo:50 };
    const nivelLabel = group.level === 'lic' ? 'Licenciatura' : 'Bachillerato';
    preview.innerHTML = `
      <b style="font-size:11px;text-transform:uppercase;color:var(--accent)">Rubrica ${nivelLabel} que se incluira automaticamente:</b><br/><br/>
      ${rubric.map(r => {
        let nota = r.key==='proyecto' ? ` (${projW.teorico}%T / ${projW.expo}%E)` : r.key==='autogestion'||r.key==='desarrollo' ? ' (autoevaluacion)' : '';
        return `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;background:var(--bg4);border-radius:12px;font-size:11px">${r.label}${nota} <b style="color:var(--accent)">${r.pct}%</b></span>`;
      }).join('')}
    `;
  }

  function saveReglamento() {
    const gid = document.getElementById('reg-group-select')?.value;
    const reglas = document.getElementById('reg-reglas')?.value.trim() || '';
    if (!gid) { showToast('Selecciona un grupo', 'error'); return; }
    DB2.setReglamento(gid, { reglas, updatedAt: Date.now() });
    showToast('Reglamento guardado', 'success');
    loadFirmasList();
  }

  function insertReglamentoPlantilla() {
    const ta = document.getElementById('reg-reglas');
    if (!ta) return;
    ta.value = `1. Puntualidad: Se requiere llegar a tiempo a clase. Tres retardos equivalen a una falta.
2. Respeto: Trato respetuoso hacia el docente y compañeros en todo momento.
3. Celular: Prohibido el uso del celular durante la clase salvo indicacion del docente.
4. Participacion: Se valora la participacion activa y constructiva en clase.
5. Tareas y actividades: Deben entregarse en la fecha y hora indicadas. Entregas tardias tienen consecuencias en la calificacion.
6. Trabajos en equipo: Cada integrante es responsable de su parte y del resultado final.
7. Deshonestidad academica: Copiar o plagiar un trabajo resulta en calificacion de cero sin posibilidad de reposicion.
8. Comunicacion: Cualquier problema o duda debe comunicarse directamente con el docente por los canales oficiales.`;
  }

  /* Docente: ver firmas del grupo */
  function loadFirmasList() {
    const gid = document.getElementById('firmas-group-select')?.value;
    const container = document.getElementById('firmas-list');
    if (!container) return;
    if (!gid) { container.innerHTML = '<p style="color:var(--text3);font-size:12px">Selecciona un grupo</p>'; return; }
    const group = DB.getGroup(gid);
    if (!group) return;
    const firmas = DB2.getFirmas(gid);
    const students = group.students || [];
    const firmaron = firmas.map(f => norm(f.studentName));

    const sinFirma = students.filter(s => !firmaron.includes(norm(s.name)));

    if (firmas.length === 0 && students.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:12px">Sin alumnos en el grupo</p>';
      return;
    }

    const signed = firmas.length;
    const total = students.length;

    container.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <span class="badge badge-green">${signed} firmaron</span>
        <span class="badge badge-red">${total - signed} pendientes</span>
        <button class="btn-outline" style="padding:4px 10px;font-size:11px" onclick="App.exportFirmas('${gid}')">Exportar firmas CSV</button>
      </div>
      ${sinFirma.length > 0 ? `
        <div class="no-reglamento-warn">
          <b>Sin firma:</b> ${sinFirma.map(s=>s.name).join(', ')}
        </div>` : '<div class="badge badge-green" style="display:inline-block;margin-bottom:8px">Todos firmaron</div>'}
      <div>
        ${firmas.map(f => `
          <div class="firma-record">
            <div class="fr-name">${f.studentName}</div>
            <div class="fr-meta">Firmado: ${fmtTs(f.signedAt)}</div>
            <div class="fr-firma">"${f.firmaEscrita}"</div>
            <div class="fr-badge"><span class="badge badge-green">Firma registrada</span></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function exportFirmas(gid) {
    const group = DB.getGroup(gid);
    if (!group) return;
    const firmas = DB2.getFirmas(gid);
    const rows = [['Nombre', 'Firma electronica', 'Fecha y hora', 'Grupo']];
    firmas.forEach(f => rows.push([f.studentName, f.firmaEscrita, fmtTs(f.signedAt), group.name]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `firmas_${group.name}.csv`; a.click();
    showToast('Exportado', 'success');
  }

  /* Alumno paso 2.5: validar datos y mostrar reglamento */
  function studentPreRegister() {
    const name = document.getElementById('student-reg-name')?.value.trim();
    const phone = document.getElementById('student-reg-phone')?.value.trim();
    const pass = document.getElementById('student-reg-pass')?.value || '';
    const errEl = document.getElementById('student-reg-error');
    if (errEl) errEl.style.display = 'none';

    if (!name || !phone || pass.length < 6) {
      if (errEl) { errEl.textContent = 'Completa todos los campos. Contrasena minimo 6 caracteres.'; errEl.style.display = 'block'; }
      return;
    }

    // Usar currentStudentGroup (seteado cuando el alumno puso el codigo)
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    // Buscar grupo: primero currentStudentGroup, luego por campo
    let group = window.currentStudentGroup || App.getCurrentStudentGroup?.();
    if (!group) {
      const code = document.getElementById('student-group-code')?.value.trim().toUpperCase();
      group = groups.find(g => g.code.toUpperCase() === code);
    }
    if (!group) {
      if (errEl) { errEl.textContent = 'No se encontro el grupo. Regresa y vuelve a ingresar el codigo.'; errEl.style.display = 'block'; }
      return;
    }

    const students = group.students || [];
    const match = students.find(s => norm(s.name) === norm(name));
    if (!match) {
      if (errEl) { errEl.textContent = 'Tu nombre no coincide con la lista. Escribe exactamente como aparece en lista de asistencia.'; errEl.style.display = 'block'; }
      return;
    }
    if (match.registered) {
      if (errEl) { errEl.textContent = 'Ya tienes cuenta registrada. Usa "Ya tengo cuenta" para iniciar sesion.'; errEl.style.display = 'block'; }
      return;
    }

    // Guardar referencia al grupo para el paso de firma
    window.currentStudentGroup = group;
    showStudentStep4(group);
  }

  function showStudentStep4(group) {
    // Ocultar todos los pasos
    [1,2,3,4].forEach(i => {
      const el = document.getElementById('student-login-step' + i);
      if (el) el.style.display = 'none';
    });
    const step4 = document.getElementById('student-login-step4');
    if (!step4) return;
    step4.style.display = 'block';

    const preview = document.getElementById('reglamento-doc-preview');
    if (preview) preview.innerHTML = buildReglamentoHTML(group);

    // Reset firma
    const cb = document.getElementById('firma-check');
    const btn = document.getElementById('btn-firmar');
    const fi = document.getElementById('firma-nombre');
    const errEl = document.getElementById('student-firma-error');
    if (cb) cb.checked = false;
    if (btn) btn.disabled = true;
    if (fi) fi.value = '';
    if (errEl) errEl.style.display = 'none';
  }

  function toggleFirmaBtn(cb) {
    const btn = document.getElementById('btn-firmar');
    if (btn) btn.disabled = !cb.checked;
  }

  /* Registrar alumno CON firma */
  function studentRegisterWithFirma() {
    const name = document.getElementById('student-reg-name')?.value.trim();
    const phone = document.getElementById('student-reg-phone')?.value.trim();
    const pass = document.getElementById('student-reg-pass')?.value;
    const firmaEscrita = document.getElementById('firma-nombre')?.value.trim();
    const firmaCheck = document.getElementById('firma-check')?.checked;
    const errEl = document.getElementById('student-firma-error');
    if (errEl) errEl.style.display = 'none';

    if (!firmaCheck) {
      if (errEl) { errEl.textContent = 'Debes marcar que aceptas el reglamento'; errEl.style.display = 'block'; }
      return;
    }
    if (!firmaEscrita) {
      if (errEl) { errEl.textContent = 'Escribe tu nombre como firma electronica'; errEl.style.display = 'block'; }
      return;
    }
    if (norm(firmaEscrita) !== norm(name)) {
      if (errEl) { errEl.textContent = 'La firma debe ser exactamente tu nombre: ' + name; errEl.style.display = 'block'; }
      return;
    }

    const code = document.getElementById('student-group-code')?.value.trim().toUpperCase();
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    const group = groups.find(g => g.code === code);
    if (!group) return;

    const students = group.students || [];
    const match = students.find(s => norm(s.name) === norm(name));
    if (!match) return;

    // Registrar alumno
    const usernameInput = document.getElementById('student-reg-username')?.value.trim().toLowerCase() || '';
    // Verificar username único en el grupo
    const existingUser = students.find(s => s.username && s.username === usernameInput);
    if (usernameInput && existingUser && existingUser.name !== match.name) {
      if(errEl){errEl.textContent='Ese nombre de usuario ya está en uso, elige otro';errEl.style.display='block';}
      return;
    }
    match.registered = true; match.phone = phone; match.pass = pass;
    match.username = usernameInput || norm(name).replace(/\s+/g,'').substring(0,12);
    const gi = groups.findIndex(g => g.id === group.id);
    groups[gi] = group;
    localStorage.setItem('groups', JSON.stringify(groups));

    // Guardar firma
    DB2.addFirma(group.id, {
      studentName: name,
      firmaEscrita: firmaEscrita,
      signedAt: Date.now(),
      groupId: group.id
    });

    DB.addLog({ who: name, action: 'Registro y firma de reglamento', groupId: group.id });
    showToast('Cuenta creada y reglamento firmado', 'success');

    // Login automatico
    const session = { role:'student', id: match.name, name: match.name, groupId: group.id };
    localStorage.setItem('current_session', JSON.stringify(session));

    // Llamar loadStudentApp del modulo principal
    if (window.App && window.App.loadStudentApp) {
      // Necesitamos setear currentUser en el modulo principal
      // Lo hacemos via el login flow
      document.getElementById('student-login-name').value = name;
      document.getElementById('student-login-passw').value = pass;
      window.App.studentLogin();
    }
  }

  /* Vista alumno: ver reglamento en seccion Reglas */
  function loadStudentReglamento() {
    const container = document.getElementById('s-reglamento-content');
    if (!container) return;
    const session = JSON.parse(localStorage.getItem('current_session') || 'null');
    if (!session) return;
    const group = DB.getGroup(session.groupId);
    if (!group) { container.innerHTML = '<p class="empty-state">Sin grupo asignado</p>'; return; }

    const firmas = DB2.getFirmas(group.id);
    const miFirma = firmas.find(f => norm(f.studentName) === norm(session.name));

    container.innerHTML = `
      ${miFirma ? `
        <div style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.25);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px">
          <b style="color:var(--green)">Documento firmado</b><br/>
          Firma: <i style="color:var(--accent)">"${miFirma.firmaEscrita}"</i><br/>
          <span style="font-size:11px;color:var(--text2)">${fmtTs(miFirma.signedAt)}</span>
        </div>
      ` : `<div class="no-reglamento-warn">No tienes registro de firma para este grupo.</div>`}
      <div class="reglamento-doc">${buildReglamentoHTML(group)}</div>
    `;
  }

  function showToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.className = 'toast show ' + (type||'');
    setTimeout(() => t.className = 'toast', 2500);
  }

  /* Cargar selectores de grupos en perfil */
  function loadProfileGroupSelects() {
    const groups = DB.getGroups();
    ['reg-group-select', 'firmas-group-select'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '<option value="">Grupo...</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    });
  }

  return {
    studentPreRegister,
    studentRegister: studentRegisterWithFirma,
    toggleFirmaBtn,
    loadReglamentoEditor,
    saveReglamento,
    insertReglamentoPlantilla,
    loadFirmasList,
    exportFirmas,
    loadStudentReglamento,
    loadProfileGroupSelects
  };
})());

/* Parchar showTeacherSection para cargar selectores de reglamento en perfil */
const _origShowSection = App.showTeacherSection.bind(App);
App.showTeacherSection = function(name) {
  _origShowSection(name);
  if (name === 'profile') {
    App.loadProfileGroupSelects && App.loadProfileGroupSelects();
  }
};

/* Parchar showStudentSection para cargar reglamento */
const _origStudentSection = App.showStudentSection.bind(App);
App.showStudentSection = function(name) {
  _origStudentSection(name);
  if (name === 's-reglamento') {
    App.loadStudentReglamento && App.loadStudentReglamento();
  }
};

// Init - must be after all patches
document.addEventListener('DOMContentLoaded', function() {
  if (App && App.init) App.init();
  else {
    // Fallback si App no cargó
    var s = document.getElementById('splash');
    var l = document.getElementById('screen-login');
    if(s) s.classList.remove('active');
    if(l) l.classList.add('active');
  }
});
