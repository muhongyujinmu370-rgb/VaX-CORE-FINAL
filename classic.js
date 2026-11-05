/* =====================================================
   VaX CORE official
   PERSONAL FITNESS SYSTEM
   JavaScript Ver.4.1
===================================================== */

"use strict";

/* ---------- 基本設定・データ ---------- */

const ACCOUNTS_KEY = "vax_accounts_v41";
const CURRENT_ACCOUNT_KEY = "vax_current_account_v41";
const STORAGE_PREFIX = "vax_core_data_v41_";

const defaultExercises = [
  {id:"ex1",name:"腕立て伏せ",category:"胸",type:"bodyweight"},
  {id:"ex2",name:"スクワット",category:"脚",type:"bodyweight"},
  {id:"ex3",name:"腹筋",category:"腹筋",type:"bodyweight"},
  {id:"ex4",name:"懸垂",category:"背中",type:"bodyweight"},
  {id:"ex5",name:"ダンベルカール",category:"腕",type:"weight"},
  {id:"ex6",name:"ダンベルプレス",category:"胸",type:"weight"},
  {id:"ex7",name:"プランク",category:"腹筋",type:"time"}
];

const defaultSettings = {
  soundEnabled:true,
  soundVolume:0.5,
  soundType:"beep",
  defaultSets:3,
  defaultRest:60
};

/* ---------- アカウント管理 ---------- */

function loadAccounts() {
  try {
    const list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch(e) {
    return [];
  }
}

function saveAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function getCurrentAccountId() {
  return localStorage.getItem(CURRENT_ACCOUNT_KEY) || "";
}

function setCurrentAccountId(id) {
  if (id) localStorage.setItem(CURRENT_ACCOUNT_KEY, id);
  else localStorage.removeItem(CURRENT_ACCOUNT_KEY);
}

function storageKeyFor(accountId) {
  return STORAGE_PREFIX + accountId;
}

function loadData() {
  const accountId = getCurrentAccountId();
  if (!accountId) {
    return {
      records:[],
      exercises:defaultExercises.map(x=>({...x})),
      settings:{...defaultSettings},
      ghosts:[],
      workoutPlans:[]
    };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeyFor(accountId)));
    if (saved && typeof saved === "object") {
      return {
        records:Array.isArray(saved.records) ? saved.records : [],
        exercises:Array.isArray(saved.exercises) ? saved.exercises : defaultExercises.map(x=>({...x})),
        settings:{...defaultSettings,...(saved.settings || {})},
        ghosts:Array.isArray(saved.ghosts) ? saved.ghosts : [],
        workoutPlans:Array.isArray(saved.workoutPlans) ? saved.workoutPlans : []
      };
    }
  } catch(e) {
    console.warn("保存データの読み込みに失敗しました",e);
  }
  return {
    records:[],
    exercises:defaultExercises.map(x=>({...x})),
    settings:{...defaultSettings},
    ghosts:[],
    workoutPlans:[]
  };
}

let appData = loadData();

function saveData() {
  const accountId = getCurrentAccountId();
  if (!accountId) return;
  try {
    localStorage.setItem(storageKeyFor(accountId), JSON.stringify(appData));
  } catch(e) {
    toast("保存に失敗しました。容量を確認してください。");
    console.error(e);
  }
}

function createAccount() {
  const num = Math.floor(Math.random() * 2000) + 1;
  const name = "player" + num;
  const id = "acc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  const accounts = loadAccounts();
  accounts.push({ id, name, createdAt: Date.now() });
  saveAccounts(accounts);
  setCurrentAccountId(id);
  appData = {
    records:[],
    exercises:defaultExercises.map(x=>({...x})),
    settings:{...defaultSettings},
    ghosts:[],
    workoutPlans:[]
  };
  saveData();
  // v4 profile also per account
  v4 = {...v4Default, name};
  saveV4();
  return { id, name };
}

function logoutAccount() {
  setCurrentAccountId("");
  appData = {
    records:[],
    exercises:defaultExercises.map(x=>({...x})),
    settings:{...defaultSettings},
    ghosts:[],
    workoutPlans:[]
  };
  v4 = {...v4Default};
  location.reload();
}

function switchAccount(id) {
  const accounts = loadAccounts();
  if (!accounts.some(a => a.id === id)) return false;
  setCurrentAccountId(id);
  location.reload();
  return true;
}

/* ---------- 共通処理 ---------- */

const $ = id => document.getElementById(id);

function setText(id,value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setHTML(id,value) {
  const el = $(id);
  if (el) el.innerHTML = value;
}

function show(id,visible) {
  const el = $(id);
  if (el) el.hidden = !visible;
}

function numberValue(id,fallback=0) {
  const el = $(id);
  const n = el ? Number(el.value) : fallback;
  return Number.isFinite(n) ? n : fallback;
}

function pad(n) {
  return String(Math.max(0,Math.floor(n))).padStart(2,"0");
}

function formatTime(seconds) {
  seconds = Math.max(0,Math.floor(seconds));
  return pad(Math.floor(seconds/60))+":"+pad(seconds%60);
}

function dateKey(date=new Date()) {
  return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate());
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "日付不明";
  return d.getFullYear()+"/"+pad(d.getMonth()+1)+"/"+pad(d.getDate());
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(()=>el.classList.remove("show"),2500);
}

function makeId() {
  return "id_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
}

/* ---------- サウンド ---------- */

let audioContext = null;

function playBeep(freq=750,duration=0.12) {
  if (!appData.settings?.soundEnabled && getCurrentAccountId()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = audioContext || new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = freq;
    const vol = Math.max(0,Math.min(1,Number(appData.settings?.soundVolume)||0.5))*0.16;
    gain.gain.value = vol;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+duration);
    oscillator.stop(audioContext.currentTime+duration);
  } catch(e) {
    console.warn("サウンドを再生できません",e);
  }
}

/** かっこいい起動音（上昇アルペジオ + パワーコード風） */
function playStartupSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = audioContext || new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();
    const ctx = audioContext;
    const now = ctx.currentTime;
    const vol = 0.18;
    const notes = [220, 277, 330, 440, 554]; // A3 → C# → E → A4 → C#
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === notes.length - 1 ? "triangle" : "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(vol, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.28);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.32);
    });
    // 最後に低いベース音
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = "sine";
    bass.frequency.value = 110;
    bg.gain.setValueAtTime(0.0001, now + 0.35);
    bg.gain.exponentialRampToValueAtTime(0.12, now + 0.38);
    bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    bass.connect(bg);
    bg.connect(ctx.destination);
    bass.start(now + 0.35);
    bass.stop(now + 0.95);
  } catch(e) {
    console.warn("起動音を再生できません", e);
  }
}

function speak(message) {
  if (!appData.settings.soundEnabled) return;
  if (!("speechSynthesis" in window)) {
    playBeep();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "ja-JP";
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const japanese = voices.filter(v=>v.lang && v.lang.toLowerCase().startsWith("ja"));
    if (japanese.length) {
      const selected = appData.settings.soundType === "female" ? japanese[japanese.length-1] : japanese[0];
      utterance.voice = selected;
    }
    window.speechSynthesis.speak(utterance);
  } catch(e) {
    playBeep();
  }
}

function notifySound(message="") {
  if (appData.settings.soundType === "beep") {
    playBeep(850,0.16);
  } else {
    speak(message || "次の動作です");
  }
}

/* ---------- ページ切り替え ---------- */

function goPage(page) {
  const target=$(page);
  if (!target || !target.classList.contains("page")) return;
  document.querySelectorAll(".page").forEach(el=>{
    const active=el===target;
    el.hidden=!active;
    el.classList.toggle("active",active);
    el.setAttribute("aria-hidden",String(!active));
  });
  document.querySelectorAll(".nav-btn").forEach(el=>{
    const active=el.dataset.page===page;
    el.classList.toggle("active",active);
    el.setAttribute("aria-current",active?"page":"false");
  });
  window.scrollTo({top:0,behavior:"smooth"});
  if (page==="home") updateHome();
  if (page==="history") renderHistory();
  if (page==="workout") updateWorkoutExercise();
}

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach(btn=>{
    btn.addEventListener("click",()=>goPage(btn.dataset.page));
  });
  document.querySelectorAll("[data-go]").forEach(btn=>{
    btn.addEventListener("click",()=>goPage(btn.dataset.go));
  });
}

/* ---------- ホーム ---------- */

function updateHome() {
  const now = new Date();
  setText("currentDate",now.getFullYear()+"年"+(now.getMonth()+1)+"月"+now.getDate()+"日");
  setText("homeDate",now.getFullYear()+"年"+(now.getMonth()+1)+"月"+now.getDate()+"日");

  const records = appData.records;
  const days = [...new Set(records.map(r=>r.date))];
  const month = dateKey().slice(0,7);
  const monthDays = [...new Set(records.filter(r=>r.date.startsWith(month)).map(r=>r.date))];

  const totalReps = records.reduce((sum,r)=>sum+(Number(r.reps)||0),0);
  const totalVolume = records.reduce((sum,r)=>sum+(Number(r.weight)||0)*(Number(r.reps)||0),0);

  setText("totalDays",days.length);
  setText("totalReps",totalReps.toLocaleString("ja-JP"));
  setText("totalVolume",totalVolume.toFixed(1));
  setText("monthDays",monthDays.length);
  setText("exerciseCount",appData.exercises.length);

  const latest = records.slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))[0];
  setText("lastDate",latest ? formatDate(latest.date) : "---");

  const recent = $("recentActivity");
  if (recent) {
    if (!records.length) {
      recent.textContent = "まだトレーニング記録がありません。";
    } else {
      recent.innerHTML = records.slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,5).map(r=>
        `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--border)">
          <span><b>${escapeHTML(r.exercise)}</b><br><small>${escapeHTML(formatDate(r.date))}</small></span>
          <span>${recordSummary(r)}</span>
        </div>`
      ).join("");
    }
  }
}

/* ---------- 種目選択 ---------- */

function renderExerciseOptions() {
  const select = $("wExercise");
  const filter = $("historyFilter");
  const chart = $("chartExercise");
  const old = select ? select.value : "";
  const oldFilter = filter ? filter.value : "";
  const oldChart = chart ? chart.value : "";

  const options = appData.exercises.map(e=>
    `<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)}</option>`
  ).join("");

  if (select) select.innerHTML = options || `<option value="">種目を登録してください</option>`;
  if (filter) filter.innerHTML = `<option value="">すべての種目</option>`+options;
  if (chart) chart.innerHTML = options;

  if (select && appData.exercises.some(e=>e.id===old)) select.value=old;
  if (filter && appData.exercises.some(e=>e.id===oldFilter)) filter.value=oldFilter;
  if (chart && appData.exercises.some(e=>e.id===oldChart)) chart.value=oldChart;

  updateWorkoutExercise();
  renderExerciseList();
}

function getSelectedExercise() {
  return appData.exercises.find(e=>e.id===$("wExercise")?.value) || appData.exercises[0] || null;
}

function updateWorkoutExercise() {
  const exercise = getSelectedExercise();
  if (!exercise) {
    show("weightedFields",false);
    show("tempoFields",false);
    show("repPanel",false);
    show("timePanel",false);
    return;
  }

  setText("wTypeBadge",exercise.type==="weight" ? "重量・回数式" : exercise.type==="time" ? "時間式" : "自重・回数式");
  setText("wCategory",exercise.category || "");

  show("weightedFields",exercise.type==="weight");
  show("tempoFields",exercise.type!=="time");
  show("repPanel",exercise.type!=="time");
  show("timePanel",exercise.type==="time");

  const previous = appData.records.filter(r=>r.exerciseId===exercise.id).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))[0];
  if (previous) {
    setText("previousRecord",formatDate(previous.date)+" · "+recordSummary(previous));
  } else {
    setText("previousRecord","記録なし");
  }
}

/* ---------- 種目管理 ---------- */

function clearExerciseForm() {
  if ($("editExerciseId")) $("editExerciseId").value="";
  if ($("exerciseName")) $("exerciseName").value="";
  if ($("exerciseCategory")) $("exerciseCategory").value="胸";
  if ($("exerciseType")) $("exerciseType").value="bodyweight";
}

function renderExerciseList() {
  const box = $("exerciseList");
  if (!box) return;

  if (!appData.exercises.length) {
    box.textContent="種目が登録されていません。";
    return;
  }

  box.innerHTML = appData.exercises.map(e=>`
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <div>
        <b>${escapeHTML(e.name)}</b>
        <div class="help-text">${escapeHTML(e.category)} · ${e.type==="weight"?"重量・回数式":e.type==="time"?"時間式":"自重・回数式"}</div>
      </div>
      <div class="actions">
        <button data-edit-ex="${escapeHTML(e.id)}">編集</button>
        <button class="btn-danger" data-delete-ex="${escapeHTML(e.id)}">削除</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-edit-ex]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const e=appData.exercises.find(x=>x.id===btn.dataset.editEx);
      if (!e) return;
      $("editExerciseId").value=e.id;
      $("exerciseName").value=e.name;
      $("exerciseCategory").value=e.category;
      $("exerciseType").value=e.type;
      toast("編集内容を入力してください");
      window.scrollTo({top:0,behavior:"smooth"});
    });
  });

  box.querySelectorAll("[data-delete-ex]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const e=appData.exercises.find(x=>x.id===btn.dataset.deleteEx);
      if (!e || !confirm(`「${e.name}」を削除しますか？\n過去の記録は残ります。`)) return;
      appData.exercises=appData.exercises.filter(x=>x.id!==e.id);
      saveData();
      renderExerciseOptions();
      toast("種目を削除しました");
    });
  });
}

function saveExercise() {
  const name=$("exerciseName")?.value.trim();
  const category=$("exerciseCategory")?.value || "その他";
  const type=$("exerciseType")?.value || "bodyweight";
  if (!name) return toast("種目名を入力してください");

  const editId=$("editExerciseId")?.value;
  if (editId) {
    const e=appData.exercises.find(x=>x.id===editId);
    if (e) Object.assign(e,{name,category,type});
    toast("種目を更新しました");
  } else {
    appData.exercises.push({id:makeId(),name,category,type});
    toast("種目を追加しました");
  }

  saveData();
  clearExerciseForm();
  renderExerciseOptions();
}

/* ---------- トレーニング（簡易メニュー） ---------- */

let session = null;
let repCount = 0;
let exerciseSeconds = 0;
let exerciseTimerId = null;
let sessionTimerId = null;
let sessionElapsed = 0;
let sessionStartedAt = 0;
let planItems = []; // {exerciseId, name, sets, reps, type}
let planIndex = 0;

function addPlanRow(prefill) {
  const box = $("workoutPlanList");
  if (!box) return;
  const row = document.createElement("div");
  row.className = "plan-row";
  const exOptions = appData.exercises.map(e =>
    `<option value="${escapeHTML(e.id)}" ${prefill?.exerciseId===e.id?"selected":""}>${escapeHTML(e.name)}</option>`
  ).join("");
  row.innerHTML = `
    <div class="field">
      <label>種目</label>
      <select class="plan-exercise">${exOptions || '<option value="">種目を登録してください</option>'}</select>
    </div>
    <div class="field">
      <label>セット数</label>
      <input class="plan-sets" type="number" min="1" max="30" value="${prefill?.sets || 3}">
    </div>
    <div class="field">
      <label>回数 / 秒</label>
      <input class="plan-reps" type="number" min="1" value="${prefill?.reps || 10}">
    </div>
    <button type="button" class="btn-danger plan-remove">削除</button>
  `;
  row.querySelector(".plan-remove").addEventListener("click", () => {
    row.remove();
  });
  box.appendChild(row);
}

function collectPlan() {
  const box = $("workoutPlanList");
  if (!box) return [];
  const rows = [...box.querySelectorAll(".plan-row")];
  return rows.map(row => {
    const exerciseId = row.querySelector(".plan-exercise")?.value;
    const exercise = appData.exercises.find(e => e.id === exerciseId);
    const sets = Math.max(1, Math.min(30, Number(row.querySelector(".plan-sets")?.value) || 3));
    const reps = Math.max(1, Number(row.querySelector(".plan-reps")?.value) || 10);
    if (!exercise) return null;
    return { exerciseId: exercise.id, name: exercise.name, type: exercise.type, sets, reps, weight: 0 };
  }).filter(Boolean);
}

function startSession() {
  if (!getCurrentAccountId()) return toast("先にアカウント連携してください");
  planItems = collectPlan();
  if (!planItems.length) {
    // fallback: single selected exercise
    const exercise = getSelectedExercise();
    if (!exercise) return toast("メニューに種目を追加してください");
    planItems = [{
      exerciseId: exercise.id,
      name: exercise.name,
      type: exercise.type,
      sets: Math.max(1, numberValue("wSets", 3)),
      reps: 10,
      weight: 0
    }];
  }
  if (session) {
    if (!confirm("現在のトレーニングを終了して新しく開始しますか？")) return;
    finishSession(false);
  }

  planIndex = 0;
  const first = planItems[0];
  const sets = first.sets;
  session={
    exerciseId:first.exerciseId,
    exercise:first.name,
    type:first.type,
    weight:first.weight || 0,
    targetSets:sets,
    currentSet:1,
    targetReps: first.reps,
    memo:$("wMemo")?.value.trim() || "",
    startedAt:Date.now(),
    sets:[],
    planItems: planItems.slice()
  };
  if ($("currentPlanLabel")) {
    $("currentPlanLabel").textContent = `種目: ${first.name}（目安 ${first.reps}${first.type==="time"?"秒":"回"}）`;
  }

  repCount=0;
  exerciseSeconds=0;
  sessionElapsed=0;
  sessionStartedAt=Date.now();

  clearInterval(sessionTimerId);
  sessionTimerId=setInterval(()=>{
    if (!session) return;
    sessionElapsed=Math.floor((Date.now()-sessionStartedAt)/1000);
    setText("sessionClock",formatTime(sessionElapsed));
    setText("globalSessionClock",formatTime(sessionElapsed));
  },500);

  const gst = $("globalSessionTimer");
  if (gst) gst.hidden = false;
  setText("globalSessionClock","00:00");

  setText("sessionStatus","トレーニング中");
  setText("saveStatus","セットを記録できます");
  updateRepDisplay();
  updateSetLabel();
  updateWorkoutExercise();
  setText("exerciseTimer","00:00");
  toast("トレーニング開始！");
  notifySound("トレーニング開始");
  aiAutoComment("start");
}

function updateRepDisplay() {
  setText("repCount",repCount);
}

function updateSetLabel() {
  if (!session) {
    setText("setLabel","1 / "+numberValue("wSets",3)+" セット");
    return;
  }
  setText("setLabel",session.currentSet+" / "+session.targetSets+" セット");
  const progress=$("setProgress");
  if (progress) progress.style.width=((session.currentSet-1)/session.targetSets*100)+"%";
}

function addRep() {
  if (!session || session.type==="time") return toast("先にトレーニングを開始してください");
  repCount++;
  updateRepDisplay();
  playBeep(620,0.055);
}

function undoRep() {
  if (repCount<=0) return;
  repCount--;
  updateRepDisplay();
}

function resetRep() {
  if (!confirm("現在の回数をリセットしますか？")) return;
  repCount=0;
  updateRepDisplay();
}

function toggleExerciseTimer() {
  if (!session || session.type!=="time") return toast("時間式の種目を選んで開始してください");
  if (exerciseTimerId) {
    clearInterval(exerciseTimerId);
    exerciseTimerId=null;
    setText("exerciseTimerBtn","計測再開");
    return;
  }

  setText("exerciseTimerBtn","一時停止");
  exerciseTimerId=setInterval(()=>{
    exerciseSeconds++;
    setText("exerciseTimer",formatTime(exerciseSeconds));
  },1000);
}

function resetExerciseTimer() {
  clearInterval(exerciseTimerId);
  exerciseTimerId=null;
  exerciseSeconds=0;
  setText("exerciseTimer","00:00");
  setText("exerciseTimerBtn","計測開始");
}

function saveCurrentSet() {
  if (!session) return toast("先にトレーニングを開始してください");

  const reps=session.type==="time" ? exerciseSeconds : repCount;
  if (reps<=0) return toast("回数または時間を記録してください");

  session.sets.push({
    set:session.currentSet,
    reps,
    weight:session.weight,
    seconds:session.type==="time" ? exerciseSeconds : 0
  });

  setText("saveStatus",`第${session.currentSet}セットを保存しました`);
  playBeep(950,0.14);
  aiAutoComment("set");

  if (session.currentSet>=session.targetSets) {
    // 次のメニュー種目へ
    if (session.planItems && planIndex < session.planItems.length - 1) {
      planIndex++;
      const next = session.planItems[planIndex];
      session.exerciseId = next.exerciseId;
      session.exercise = next.name;
      session.type = next.type;
      session.weight = next.weight || 0;
      session.targetSets = next.sets;
      session.targetReps = next.reps;
      session.currentSet = 1;
      repCount = 0;
      exerciseSeconds = 0;
      updateRepDisplay();
      resetExerciseTimer();
      updateSetLabel();
      if ($("currentPlanLabel")) {
        $("currentPlanLabel").textContent = `種目: ${next.name}（目安 ${next.reps}${next.type==="time"?"秒":"回"}）`;
      }
      toast(`次の種目：${next.name}`);
      const rest = numberValue("wRest", appData.settings.defaultRest);
      if (rest > 0) startRestTimer(rest);
      return;
    }
    toast("全メニュー完了！トレーニングを終了できます");
    finishSession(true);
    return;
  }

  session.currentSet++;
  repCount=0;
  exerciseSeconds=0;
  updateRepDisplay();
  resetExerciseTimer();
  updateSetLabel();

  const rest=numberValue("wRest",appData.settings.defaultRest);
  if (rest>0) startRestTimer(rest);
}

function finishSession(showMessage=true) {
  if (!session) return;

  clearInterval(sessionTimerId);
  sessionTimerId=null;
  clearInterval(exerciseTimerId);
  exerciseTimerId=null;
  clearInterval(tempoTimerId);
  tempoTimerId=null;
  clearInterval(restTimerId);
  restTimerId=null;

  if (session.sets.length) {
    const record={
      id:makeId(),
      date:dateKey(),
      timestamp:Date.now(),
      exerciseId:session.exerciseId,
      exercise:session.exercise,
      type:session.type,
      weight:session.weight,
      sets:session.sets.map(x=>({...x})),
      reps:session.sets.reduce((sum,x)=>sum+(session.type==="time"?0:x.reps),0),
      seconds:session.sets.reduce((sum,x)=>sum+(x.seconds||0),0),
      memo:session.memo,
      duration:sessionElapsed
    };
    appData.records.push(record);
    saveData();
    if(typeof v4Refresh==="function" && $("v4Points")) v4Refresh();
  }

  session=null;
  repCount=0;
  updateRepDisplay();
  updateSetLabel();
  setText("sessionStatus","待機中");
  setText("saveStatus","トレーニング記録を保存しました");
  setText("sessionClock","00:00");
  setText("tempoStatus","待機中");
  setText("restStatus","待機中");
  setText("restDisplay",formatTime(numberValue("wRest",60)));
  const gst = $("globalSessionTimer");
  if (gst) gst.hidden = true;
  setText("globalSessionClock","00:00");
  updateHome();
  renderHistory();
  if (showMessage) {
    toast("トレーニングを保存しました！");
    aiAutoComment("finish");
  }
}

function recordSummary(r) {
  if (r.type==="time") return formatTime(r.seconds||0);
  const sets=(r.sets||[]).length;
  return (r.weight>0 ? r.weight+"kg · " : "")+(r.reps||0)+"回 · "+sets+"セット";
}

/* ---------- テンポタイマー ---------- */

let tempoTimerId=null;
let tempoPhase="down";
let tempoRemaining=0;
let tempoCount=0;

function startTempo() {
  if (tempoTimerId) return;

  const down=Math.max(1,numberValue("wDown",3));
  const up=Math.max(1,numberValue("wUp",1));
  if (tempoRemaining<=0) {
    tempoPhase="down";
    tempoRemaining=down;
    tempoCount=0;
  }

  setText("tempoStatus",tempoPhase==="down"?"下げる":"上げる");
  setText("tempoBtn","一時停止");

  tempoTimerId=setInterval(()=>{
    tempoRemaining--;
    setText("tempoDisplay",formatTime(tempoRemaining));
    if (tempoRemaining<=0) {
      if (tempoPhase==="down") {
        tempoPhase="up";
        tempoRemaining=up;
        notifySound("上げる");
      } else {
        tempoPhase="down";
        tempoRemaining=down;
        tempoCount++;
        notifySound("次の回");
      }
      setText("tempoStatus",tempoPhase==="down"?"下げる":"上げる");
      setText("tempoDisplay",formatTime(tempoRemaining));
    }
  },1000);
}

function stopTempo() {
  clearInterval(tempoTimerId);
  tempoTimerId=null;
  tempoPhase="down";
  tempoRemaining=0;
  tempoCount=0;
  setText("tempoDisplay","00:00");
  setText("tempoStatus","待機中");
  setText("tempoBtn","開始");
}

/* ---------- 休憩タイマー ---------- */

let restTimerId=null;
let restRemaining=0;

function startRestTimer(seconds=numberValue("wRest",60)) {
  clearInterval(restTimerId);
  restRemaining=Math.max(1,Math.floor(seconds));
  setText("restDisplay",formatTime(restRemaining));
  setText("restStatus","休憩中");
  setText("startRestBtn","一時停止");
  aiAutoComment("rest");

  restTimerId=setInterval(()=>{
    restRemaining--;
    setText("restDisplay",formatTime(restRemaining));
    if (restRemaining<=0) {
      clearInterval(restTimerId);
      restTimerId=null;
      setText("restStatus","休憩終了！");
      setText("startRestBtn","もう一度開始");
      notifySound("休憩終了です");
      toast("休憩終了！");
      aiAutoComment("restEnd");
    }
  },1000);
}

function toggleRestTimer() {
  if (restTimerId) {
    clearInterval(restTimerId);
    restTimerId=null;
    setText("restStatus","一時停止中");
    setText("startRestBtn","再開");
  } else {
    startRestTimer(restRemaining>0?restRemaining:numberValue("wRest",60));
  }
}

function stopRestTimer() {
  clearInterval(restTimerId);
  restTimerId=null;
  restRemaining=0;
  setText("restDisplay",formatTime(numberValue("wRest",60)));
  setText("restStatus","待機中");
  setText("startRestBtn","休憩開始");
}

/* ---------- HIIT ---------- */

let hiitTimerId=null;
let hiitRunning=false;
let hiitPaused=false;
let hiitPhase="work";
let hiitRemaining=20;
let hiitRound=1;
let hiitWork=20;
let hiitRest=10;
let hiitRounds=8;

function updateHiitDisplay() {
  setText("hiitDisplay",formatTime(hiitRemaining));
  setText("hiitPhase",hiitPhase==="work"?"WORK OUT":"REST");
  setText("hiitRoundLabel",`ROUND ${hiitRound} / ${hiitRounds}`);
  const progress=$("hiitProgress");
  if (progress) {
    const total=hiitRounds*(hiitWork+hiitRest);
    const done=(hiitRound-1)*(hiitWork+hiitRest)+(hiitPhase==="work"?(hiitWork-hiitRemaining):hiitWork+(hiitRest-hiitRemaining));
    progress.style.width=(total?Math.min(100,done/total*100):0)+"%";
  }
}

function startHiit() {
  if (hiitRunning && hiitPaused) {
    hiitPaused=false;
    runHiitTimer();
    setText("hiitStatus","再開しました");
    return;
  }
  if (hiitRunning) return;

  hiitWork=Math.max(1,Math.min(3600,numberValue("hiitWork",20)));
  hiitRest=Math.max(0,Math.min(3600,numberValue("hiitRest",10)));
  hiitRounds=Math.max(1,Math.min(100,numberValue("hiitRounds",8)));

  hiitPhase="work";
  hiitRemaining=hiitWork;
  hiitRound=1;
  hiitRunning=true;
  hiitPaused=false;

  setText("hiitStatus","HIIT実行中");
  updateHiitDisplay();
  notifySound("スタート");
  runHiitTimer();
}

function runHiitTimer() {
  clearInterval(hiitTimerId);
  hiitTimerId=setInterval(()=>{
    if (!hiitRunning || hiitPaused) return;
    hiitRemaining--;
    updateHiitDisplay();

    if (hiitRemaining<=0) {
      if (hiitPhase==="work") {
        if (hiitRest>0) {
          hiitPhase="rest";
          hiitRemaining=hiitRest;
          notifySound("休憩です");
        } else {
          nextHiitRound();
        }
      } else {
        nextHiitRound();
      }
      updateHiitDisplay();
    } else if (hiitRemaining<=3) {
      playBeep(500,0.06);
    }
  },1000);
}

function nextHiitRound() {
  if (hiitRound>=hiitRounds) {
    stopHiit(true);
    return;
  }
  hiitRound++;
  hiitPhase="work";
  hiitRemaining=hiitWork;
  notifySound("運動開始");
}

function pauseHiit() {
  if (!hiitRunning) return;
  hiitPaused=!hiitPaused;
  setText("pauseHiitBtn",hiitPaused?"再開":"一時停止");
  setText("hiitStatus",hiitPaused?"一時停止中":"HIIT実行中");
}

function stopHiit(completed=false) {
  clearInterval(hiitTimerId);
  hiitTimerId=null;
  hiitRunning=false;
  hiitPaused=false;
  if (completed) {
    setText("hiitStatus","全ラウンド完了！");
    notifySound("お疲れさまでした");
    toast("HIIT完了！");
    const history=$("hiitHistory");
    if (history) {
      const item=document.createElement("p");
      item.textContent=formatDate(new Date())+" · "+hiitRounds+"ラウンド完了";
      history.prepend(item);
    }
  } else {
    setText("hiitStatus","終了しました");
  }
  setText("pauseHiitBtn","一時停止");
  setText("hiitPhase",completed?"COMPLETE":"READY");
  setText("hiitDisplay",formatTime(hiitWork||20));
  setText("hiitRoundLabel",`ROUND 1 / ${hiitRounds||8}`);
  const progress=$("hiitProgress");
  if (progress) progress.style.width=completed?"100%":"0%";
}

/* ---------- おやすみモード 300秒 ---------- */

const sleepStages=[
  {
    name:"全身を伸ばして脱力",
    duration:30,
    instruction:"仰向けになり、全身をゆっくり伸ばしてから力を抜きます。5秒伸ばし、5秒脱力を3回繰り返します。",
    icon:"☾",
    phases:[
      {duration:5,label:"ゆっくり伸ばす"},
      {duration:5,label:"力を抜く"},
      {duration:5,label:"ゆっくり伸ばす"},
      {duration:5,label:"力を抜く"},
      {duration:5,label:"ゆっくり伸ばす"},
      {duration:5,label:"力を抜く"}
    ]
  },
  {
    name:"膝の抱え込み",
    duration:60,
    instruction:"仰向けで片膝を胸の方へゆっくり引き寄せます。無理に引っ張らず、自然に呼吸します。",
    icon:"🧘",
    phases:[
      {duration:30,label:"右脚"},
      {duration:30,label:"左脚"}
    ]
  },
  {
    name:"片脚折りたたみ",
    duration:90,
    instruction:"片脚を後ろに折りたたみ、太ももの前側をゆっくり伸ばします。膝に違和感がある場合は中止し、無理に押し込まないでください。",
    icon:"🧘",
    phases:[
      {duration:45,label:"右脚"},
      {duration:45,label:"左脚"}
    ]
  },
  {
    name:"仰向けカエルのポーズ",
    duration:90,
    instruction:"仰向けになり、両足の裏を合わせます。膝は自然に開き、股関節を無理に押し下げずに呼吸します。",
    icon:"☾",
    phases:[
      {duration:90,label:"ゆっくり呼吸"}
    ]
  },
  {
    name:"そのまま就寝モード",
    duration:30,
    instruction:"脚を自然な位置に戻し、全身の力を抜きます。呼吸を整えながら、ゆっくり休みましょう。",
    icon:"🌙",
    phases:[
      {duration:30,label:"おやすみなさい"}
    ]
  }
];

let sleepTimerId=null;
let sleepRunning=false;
let sleepPaused=false;
let sleepStageIndex=0;
let sleepStageElapsed=0;
let sleepTotalElapsed=0;

function currentSleepPhase() {
  const stage=sleepStages[sleepStageIndex];
  let elapsed=sleepStageElapsed;
  for (let i=0;i<stage.phases.length;i++) {
    if (elapsed<stage.phases[i].duration) {
      return {
        index:i,
        label:stage.phases[i].label,
        remaining:stage.phases[i].duration-elapsed
      };
    }
    elapsed-=stage.phases[i].duration;
  }
  return {index:stage.phases.length-1,label:"完了",remaining:0};
}

function updateSleepDisplay() {
  const stage=sleepStages[sleepStageIndex];
  const phase=currentSleepPhase();
  const totalRemaining=300-sleepTotalElapsed;

  setText("sleepClock",formatTime(totalRemaining));
  setText("sleepStageLabel",`STEP 0${sleepStageIndex+1} / 05`);
  setText("sleepExerciseName",stage.name);
  setText("sleepInstruction",stage.instruction);
  setText("sleepPhaseTime",formatTime(phase.remaining));
  setText("sleepPhaseLabel",phase.label);
  setText("sleepPoseIcon",stage.icon);

  const progress=$("sleepProgress");
  if (progress) progress.style.width=(sleepTotalElapsed/300*100)+"%";

  sleepStages.forEach((s,i)=>{
    const el=$("sleepStep"+i);
    if (!el) return;
    el.classList.toggle("active",i===sleepStageIndex);
    el.classList.toggle("done",i<sleepStageIndex);
    const status=el.querySelector(".step-status");
    if (status) status.textContent=i<sleepStageIndex?"完了":i===sleepStageIndex?"実行中":"待機";
  });
}

function startSleep() {
  if (sleepRunning && sleepPaused) {
    sleepPaused=false;
    runSleepTimer();
    setText("sleepPauseBtn","一時停止");
    setText("sleepMessage","再開しました");
    return;
  }
  if (sleepRunning) return;

  sleepRunning=true;
  sleepPaused=false;
  sleepStageIndex=0;
  sleepStageElapsed=0;
  sleepTotalElapsed=0;
  setText("sleepStartBtn","実行中");
  setText("sleepMessage","ゆっくり進めましょう");
  updateSleepDisplay();
  notifySound("おやすみモード開始");
  runSleepTimer();
}

function runSleepTimer() {
  clearInterval(sleepTimerId);
  sleepTimerId=setInterval(()=>{
    if (!sleepRunning || sleepPaused) return;

    sleepStageElapsed++;
    sleepTotalElapsed++;

    if (sleepTotalElapsed>=300) {
      stopSleep(true);
      return;
    }

    if (sleepStageElapsed>=sleepStages[sleepStageIndex].duration) {
      sleepStageIndex++;
      sleepStageElapsed=0;
      notifySound(sleepStages[sleepStageIndex].name);
    } else {
      const before=currentSleepPhase();
      if (before.remaining===0) playBeep(600,0.08);
    }

    updateSleepDisplay();
  },1000);
}

function pauseSleep() {
  if (!sleepRunning) return;
  sleepPaused=!sleepPaused;
  setText("sleepPauseBtn",sleepPaused?"再開":"一時停止");
  setText("sleepMessage",sleepPaused?"一時停止中":"実行中");
}

function skipSleep() {
  if (!sleepRunning) return toast("おやすみモードを開始してください");
  sleepTotalElapsed+=sleepStages[sleepStageIndex].duration-sleepStageElapsed;
  sleepStageIndex++;
  sleepStageElapsed=0;
  if (sleepStageIndex>=sleepStages.length || sleepTotalElapsed>=300) {
    stopSleep(true);
    return;
  }
  updateSleepDisplay();
  notifySound(sleepStages[sleepStageIndex].name);
}

function stopSleep(completed=false) {
  clearInterval(sleepTimerId);
  sleepTimerId=null;
  sleepRunning=false;
  sleepPaused=false;

  if (completed) {
    sleepTotalElapsed=300;
    setText("sleepClock","00:00");
    setText("sleepMessage","お疲れさまでした。おやすみなさい。");
    setText("sleepStageLabel","COMPLETE");
    setText("sleepExerciseName","おやすみなさい");
    setText("sleepInstruction","今日もお疲れさまでした。ゆっくり休みましょう。");
    setText("sleepPhaseTime","00:00");
    const progress=$("sleepProgress");
    if (progress) progress.style.width="100%";
    notifySound("お疲れさまでした");
  } else {
    setText("sleepClock","05:00");
    setText("sleepMessage","終了しました");
    setText("sleepStageLabel","READY TO SLEEP");
    setText("sleepExerciseName","準備完了");
    setText("sleepInstruction","スタートを押して始めましょう。");
    setText("sleepPhaseTime","00:30");
    const progress=$("sleepProgress");
    if (progress) progress.style.width="0%";
    sleepStages.forEach((s,i)=>{
      const el=$("sleepStep"+i);
      if (el) el.classList.remove("active","done");
      const status=el?.querySelector(".step-status");
      if (status) status.textContent="待機";
    });
  }

  setText("sleepStartBtn","もう一度開始");
  setText("sleepPauseBtn","一時停止");
}

/* ---------- 履歴・カレンダー ---------- */

let calendarDate=new Date();

function renderHistory() {
  renderCalendar();
  renderHistoryTable();
  renderChart();
}

function renderCalendar() {
  const box=$("calendar");
  if (!box) return;

  const year=calendarDate.getFullYear();
  const month=calendarDate.getMonth();
  setText("calendarTitle",year+"年"+(month+1)+"月");

  const first=new Date(year,month,1);
  const last=new Date(year,month+1,0);
  const days=["日","月","火","水","木","金","土"];
  const recorded=new Set(appData.records.map(r=>r.date));

  let html=days.map(d=>`<div class="calendar-day">${d}</div>`).join("");
  for (let i=0;i<first.getDay();i++) html+="<div></div>";

  for (let day=1;day<=last.getDate();day++) {
    const key=year+"-"+pad(month+1)+"-"+pad(day);
    const has=recorded.has(key);
    html+=`<div class="calendar-cell ${has?"has-record":""}" title="${has?"トレーニング記録あり":""}">${day}${has?" ●":""}</div>`;
  }
  box.innerHTML=html;
}

function renderHistoryTable() {
  const body=$("historyTable");
  if (!body) return;
  const filter=$("historyFilter")?.value || "";

  const records=appData.records.slice()
    .filter(r=>!filter || r.exerciseId===filter)
    .sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));

  body.innerHTML=records.map(r=>`
    <tr>
      <td>${escapeHTML(formatDate(r.date))}</td>
      <td>${escapeHTML(r.exercise)}</td>
      <td>${escapeHTML(recordSummary(r))}</td>
      <td>${(r.sets||[]).length}</td>
      <td><button data-delete-record="${escapeHTML(r.id)}">削除</button></td>
    </tr>
  `).join("");

  show("historyEmpty",records.length===0);

  body.querySelectorAll("[data-delete-record]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if (!confirm("この記録を削除しますか？")) return;
      appData.records=appData.records.filter(r=>r.id!==btn.dataset.deleteRecord);
      saveData();
      renderHistory();
      updateHome();
      if(typeof v4Refresh==="function" && $("v4Points")) v4Refresh();
      toast("記録を削除しました");
    });
  });
}

function renderChart() {
  const box=$("chartArea");
  if (!box) return;
  const id=$("chartExercise")?.value;
  const records=appData.records.filter(r=>r.exerciseId===id).slice().sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));

  if (!records.length) {
    box.textContent="この種目の記録はまだありません。";
    return;
  }

  const values=records.map(r=>r.type==="time"?(r.seconds||0):(r.reps||0));
  const max=Math.max(...values,1);

  box.innerHTML=records.slice(-12).map((r,i)=>{
    const value=values[records.indexOf(r)];
    const width=Math.max(3,value/max*100);
    return `<div style="margin:12px 0">
      <div class="row"><small>${escapeHTML(formatDate(r.date))}</small><b>${value}${r.type==="time"?"秒":"回"}</b></div>
      <div class="progress"><div style="width:${width}%;height:100%;background:linear-gradient(90deg,#3987ff,#16c79a);border-radius:20px"></div></div>
    </div>`;
  }).join("");
}

function calculateRM() {
  const weight=numberValue("rmWeight",0);
  const reps=numberValue("rmReps",0);
  if (weight<=0 || reps<1 || reps>30) {
    setText("rmResult","重量と回数を正しく入力してください");
    return;
  }
  const rm=weight*(1+reps/30);
  setText("rmResult",rm.toFixed(1)+" kg");
}

/* ---------- 設定 ---------- */

function loadSettingsToUI() {
  const s=appData.settings;
  if ($("soundEnabled")) $("soundEnabled").checked=!!s.soundEnabled;
  if ($("soundVolume")) $("soundVolume").value=s.soundVolume;
  if ($("soundType")) $("soundType").value=s.soundType;
  if ($("defaultSets")) $("defaultSets").value=s.defaultSets;
  if ($("defaultRest")) $("defaultRest").value=s.defaultRest;
}

function saveSettings() {
  appData.settings={
    soundEnabled:$("soundEnabled")?.checked ?? true,
    soundVolume:Math.max(0,Math.min(1,numberValue("soundVolume",0.5))),
    soundType:$("soundType")?.value || "beep",
    defaultSets:Math.max(1,Math.min(30,numberValue("defaultSets",3))),
    defaultRest:Math.max(0,Math.min(3600,numberValue("defaultRest",60)))
  };
  saveData();
  toast("設定を保存しました");
}

function testSound() {
  if ($("soundType")?.value==="beep") {
    playBeep(900,0.2);
  } else {
    speak("VaX CORE。サウンドテストです。");
  }
}

/* ---------- JSONバックアップ ---------- */

function downloadFile(filename,content,type) {
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportJSON() {
  downloadFile("VaX_CORE_backup_"+dateKey()+".json",JSON.stringify({...appData,v4Profile:v4},null,2),"application/json");
  toast("JSONバックアップを作成しました");
}

function importJSONFile(file) {
  if (!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const data=JSON.parse(reader.result);
      if (!data || !Array.isArray(data.records) || !Array.isArray(data.exercises)) {
        throw new Error("データ形式が違います");
      }
      if (!confirm("現在の記録・種目・設定を読み込んだデータに置き換えますか？")) return;
      appData={
        records:data.records,
        exercises:data.exercises,
        settings:{...defaultSettings,...(data.settings||{})}
      };
      if(data.v4Profile && typeof data.v4Profile==="object"){v4={...v4Default,...data.v4Profile};saveV4();}
      saveData();
      initializeUI();
      if(typeof v4Refresh==="function" && $("v4Points")) v4Refresh();
      toast("バックアップを復元しました");
    } catch(e) {
      alert("JSONの読み込みに失敗しました。\n"+e.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- CSV ---------- */

function csvEscape(value) {
  return '"'+String(value??"").replace(/"/g,'""')+'"';
}

function exportCSV() {
  const rows=[["date","exercise","type","weight","reps","seconds","sets","memo"]];
  appData.records.forEach(r=>{
    rows.push([
      r.date,r.exercise,r.type,r.weight,r.reps,r.seconds,
      (r.sets||[]).length,r.memo
    ]);
  });
  const csv="\uFEFF"+rows.map(row=>row.map(csvEscape).join(",")).join("\r\n");
  downloadFile("VaX_CORE_records_"+dateKey()+".csv",csv,"text/csv;charset=utf-8");
  toast("CSVを書き出しました");
}

function parseCSVLine(line) {
  const result=[];
  let value="",quoted=false;
  for (let i=0;i<line.length;i++) {
    const c=line[i];
    if (c==='"' && quoted && line[i+1]==='"') {
      value+='"'; i++;
    } else if (c==='"') {
      quoted=!quoted;
    } else if (c==="," && !quoted) {
      result.push(value); value="";
    } else {
      value+=c;
    }
  }
  result.push(value);
  return result;
}

function importCSVFile(file) {
  if (!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const lines=String(reader.result).replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
      if (lines.length<2) throw new Error("データがありません");
      const header=parseCSVLine(lines[0]);
      const index=key=>header.indexOf(key);
      const imported=[];

      for (let i=1;i<lines.length;i++) {
        const row=parseCSVLine(lines[i]);
        const exercise=row[index("exercise")];
        if (!exercise) continue;
        const date=row[index("date")] || dateKey();
        const type=row[index("type")] || "bodyweight";
        const weight=Number(row[index("weight")])||0;
        const reps=Number(row[index("reps")])||0;
        const seconds=Number(row[index("seconds")])||0;
        const exerciseData=appData.exercises.find(e=>e.name===exercise);
        imported.push({
          id:makeId(),
          date,
          timestamp:new Date(date).getTime()||Date.now(),
          exerciseId:exerciseData?.id || "",
          exercise,
          type,
          weight,
          reps,
          seconds,
          sets:[],
          memo:row[index("memo")]||""
        });
      }

      if (!imported.length) throw new Error("読み込める記録がありません");
      if (!confirm(`${imported.length}件の記録を追加しますか？`)) return;
      appData.records.push(...imported);
      saveData();
      updateHome();
      renderHistory();
      toast(imported.length+"件を読み込みました");
    } catch(e) {
      alert("CSVの読み込みに失敗しました。\n"+e.message);
    }
  };
  reader.readAsText(file,"UTF-8");
}

/* ---------- 全データ初期化 ---------- */

function clearAllData() {
  if (!confirm("すべての記録・種目・設定を初期化しますか？")) return;
  if (!confirm("この操作は元に戻せません。本当に初期化しますか？")) return;

  appData={
    records:[],
    exercises:defaultExercises.map(x=>({...x})),
    settings:{...defaultSettings}
  };
  v4={...v4Default};saveV4();localStorage.removeItem("v4_combat_level");
  saveData();
  stopHiit(false);
  stopSleep(false);
  stopTempo();
  stopRestTimer();
  if (session) finishSession(false);
  initializeUI();
  if(typeof v4Refresh==="function" && $("v4Points")) v4Refresh();
  toast("データを初期化しました");
}

/* ---------- イベント登録 ---------- */

function bindEvents() {
  $("wExercise")?.addEventListener("change",updateWorkoutExercise);

  $("addPlanRowBtn")?.addEventListener("click", () => addPlanRow());
  $("startSessionBtn")?.addEventListener("click",startSession);
  $("addRepBtn")?.addEventListener("click",addRep);
  $("undoRepBtn")?.addEventListener("click",undoRep);
  $("resetValueBtn")?.addEventListener("click",resetRep);
  $("exerciseTimerBtn")?.addEventListener("click",toggleExerciseTimer);
  $("resetExerciseTimerBtn")?.addEventListener("click",resetExerciseTimer);
  $("saveSetBtn")?.addEventListener("click",saveCurrentSet);
  $("finishSessionBtn")?.addEventListener("click",()=>finishSession(true));

  $("tempoBtn")?.addEventListener("click",()=>{
    if (tempoTimerId) {
      clearInterval(tempoTimerId);
      tempoTimerId=null;
      setText("tempoBtn","再開");
      setText("tempoStatus","一時停止中");
    } else {
      startTempo();
    }
  });
  $("stopTempoBtn")?.addEventListener("click",stopTempo);

  $("startRestBtn")?.addEventListener("click",toggleRestTimer);
  $("stopRestBtn")?.addEventListener("click",stopRestTimer);

  $("startHiitBtn")?.addEventListener("click",startHiit);
  $("pauseHiitBtn")?.addEventListener("click",pauseHiit);
  $("stopHiitBtn")?.addEventListener("click",()=>stopHiit(false));

  $("sleepStartBtn")?.addEventListener("click",startSleep);
  $("sleepPauseBtn")?.addEventListener("click",pauseSleep);
  $("sleepSkipBtn")?.addEventListener("click",skipSleep);
  $("sleepStopBtn")?.addEventListener("click",()=>stopSleep(false));

  $("saveExerciseBtn")?.addEventListener("click",saveExercise);
  $("clearExerciseBtn")?.addEventListener("click",clearExerciseForm);

  $("prevMonthBtn")?.addEventListener("click",()=>{
    calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);
    renderCalendar();
  });
  $("nextMonthBtn")?.addEventListener("click",()=>{
    calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);
    renderCalendar();
  });

  $("historyFilter")?.addEventListener("change",renderHistoryTable);
  $("chartExercise")?.addEventListener("change",renderChart);
  $("calcRMBtn")?.addEventListener("click",calculateRM);

  $("soundTestBtn")?.addEventListener("click",testSound);
  $("saveSettingsBtn")?.addEventListener("click",saveSettings);

  $("exportJSONBtn")?.addEventListener("click",exportJSON);
  $("importJSONBtn")?.addEventListener("click",()=>$("jsonFile")?.click());
  $("jsonFile")?.addEventListener("change",e=>{
    importJSONFile(e.target.files[0]);
    e.target.value="";
  });

  $("exportCSVBtn")?.addEventListener("click",exportCSV);
  $("importCSVBtn")?.addEventListener("click",()=>$("csvFile")?.click());
  $("csvFile")?.addEventListener("change",e=>{
    importCSVFile(e.target.files[0]);
    e.target.value="";
  });

  $("clearDataBtn")?.addEventListener("click",clearAllData);
}

/* ---------- 初期化 ---------- */

function initializeUI() {
  renderExerciseOptions();
  loadSettingsToUI();
  updateHome();
  renderHistory();
  updateSetLabel();

  setText("hiitDisplay",formatTime(numberValue("hiitWork",20)));
  setText("hiitRoundLabel","ROUND 1 / "+numberValue("hiitRounds",8));
  setText("sleepClock","05:00");
  setText("sleepPhaseTime","00:30");
  setText("restDisplay",formatTime(numberValue("wRest",60)));
  setText("sessionClock","00:00");
  setText("repCount","0");
  setText("tempoDisplay","00:00");

  updateWorkoutExercise();

  const planBox = $("workoutPlanList");
  if (planBox && !planBox.children.length) {
    addPlanRow();
  }
}

function initVaXCore() {
  buildV4Shell();
  setupNavigation();
  bindEvents();
  const initialPage=document.querySelector(".page.active")?.id || "home";
  goPage(initialPage);
  initializeUI();
  v4Initialize();

  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
  }

  console.log("VaX CORE official Ver.3.2 initialized.");
}


/* ================= VaX CORE Ver.4.0 EXTENSION ================= */
const V4_PREFIX = "vax_core_v4_profile_";
const v4Default = {
  name:"player", weightLogs:[], quote:"", missionDates:[],
  missionHistory:[], customQuotes:[], unlockedBadges:[]
};
function v4Key(){
  const id = getCurrentAccountId();
  return id ? V4_PREFIX + id : null;
}
function loadV4(){
  const key = v4Key();
  if (!key) return {...v4Default};
  try { return {...v4Default,...JSON.parse(localStorage.getItem(key)||"{}")}; }
  catch(e){ return {...v4Default}; }
}
function saveV4(){
  const key = v4Key();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(v4));
}
let v4 = loadV4();
const v4Titles=[
  [0,"Beginner","始まりの一歩"],
  [100,"Rookie","習慣の芽生え"],
  [300,"Challenger","挑む者"],
  [700,"Fighter","鍛えし者"],
  [1500,"Warrior","戦士の称号"],
  [3000,"Elite","精鋭の証"],
  [5000,"Master","極めた者"],
  [10000,"Legend","伝説の領域"],
  [20000,"VaX CORE","頂点に立つ者"]
];
function v4Stats(){
  const records=appData.records||[];
  const setCount=records.reduce((n,r)=>n+(r.sets||[]).length,0);
  const seconds=records.reduce((n,r)=>n+(Number(r.duration)||0),0);
  const coachPts=(v4.coachBonusLogs||[]).reduce((n,x)=>n+(Number(x.pts)||0),0);
  const points=records.reduce((n,r)=>{
    const sets=(r.sets||[]).length;
    const mins=Math.floor((Number(r.duration)||0)/600);
    const reps=Number(r.reps)||0;
    return n+sets*10+(sets?20:0)+Math.min(20,Math.floor(reps/10)*2)+Math.min(30,mins*10);
  },0)+(v4.missionHistory||[]).filter(x=>x.done).length*10+coachPts;
  const level=Math.floor(points/100)+1;
  let title=v4Titles[0], next=null;
  v4Titles.forEach(t=>{if(points>=t[0])title=t; else if(!next)next=t;});
  return {points,level,title:title[1],titleSub:title[2]||"",next,setCount,seconds};
}
function v4Esc(s){return escapeHTML(s);}
function v4AddPage(id,label,icon){
  const nav=$("sidebar"),main=$("mainContent");
  if(!nav.querySelector(`[data-page="${id}"]`)){
    const b=document.createElement("button");b.type="button";b.className="nav-btn";b.dataset.page=id;b.textContent=icon+" "+label;nav.appendChild(b);
  }
  if(!$(id)){
    const s=document.createElement("section");s.id=id;s.className="page";s.hidden=true;main.insertBefore(s,main.querySelector(".footer"));
  }
}
function buildV4Shell(){
  const header=document.querySelector(".header");
  if(header&&!$("v4PlayerButton")){
    const b=document.createElement("button");b.id="v4PlayerButton";b.className="v4-player-button";
    b.innerHTML='<span class="v4-avatar">V</span><span><b id="v4HeaderName">VaX Player</b><small id="v4HeaderLevel">LEVEL 1</small></span>';
    header.appendChild(b);
  }
  ["status","weight","auto","missions","combat","ghostcreate","ghost","restgame"].forEach((id,i)=>v4AddPage(id,["STATUS","体重管理","おまかせ","ミッション","CORE TRAINING","ゴースト作成","GHOST MATCH","休憩ゲーム"][i],["◆","⚖","◈","✦","⚡","👻","◉","🎮"][i]));
  const settings=$("settings");
  if(settings&&!$("v4QuoteSettings")){
    const q=document.createElement("div");q.className="card";q.id="v4QuoteSettings";
    q.innerHTML='<div class="card-title">起動時の応援メッセージ</div><div class="field"><label for="v4QuoteInput">メッセージを追加</label><input id="v4QuoteInput" maxlength="80" placeholder="例：今日も一歩ずつ進もう"></div><button type="button" class="btn" id="v4AddQuote">追加</button><div id="v4QuoteList" class="help-text"></div>';
    settings.insertBefore(q,settings.querySelector(".card:last-of-type"));
  }
  $("status").innerHTML=`
    <div class="eyebrow">PLAYER STATUS</div><h1>PLAYER PROFILE</h1><p class="subtitle">積み重ねた記録が、あなたのプロフィールになる。</p>
    <div class="card v4-profile">
      <div class="v4-avatar large">V</div>
      <div>
        <div class="card-title">PLAYER NAME</div>
        <h2 id="v4ProfileName">VaX Player</h2>
      </div>
    </div>
    <div class="card title-showcase">
      <div class="card-title">CURRENT TITLE</div>
      <div class="title-showcase-name" id="v4Title">Beginner</div>
      <div class="title-showcase-sub" id="v4TitleSub">始まりの一歩</div>
      <div class="row" style="margin-top:14px">
        <span class="help-text">次の称号まで</span>
        <b id="v4NextLabel">100 pt</b>
      </div>
      <div class="progress"><div class="progress-fill" id="v4TitleProgress"></div></div>
      <p class="help-text" id="v4ProgressText"></p>
    </div>
    <div class="grid stats-grid">
      <div class="card stat-card"><div class="card-title">LEVEL</div><div class="stat" id="v4Level">1</div></div>
      <div class="card stat-card"><div class="card-title">TOTAL POINTS</div><div class="stat" id="v4Points">0</div><small>pt</small></div>
      <div class="card stat-card"><div class="card-title">TOTAL SETS</div><div class="stat" id="v4Sets">0</div><small>sets</small></div>
      <div class="card stat-card"><div class="card-title">TRAINING TIME</div><div class="stat stat-small" id="v4Time">00:00</div></div>
    </div>
    <div class="card">
      <div class="card-title">称号一覧</div>
      <p class="help-text" style="margin-top:0">ポイントを貯めて称号を解放しよう。現在の称号は強調表示されます。</p>
      <div id="v4TitleList" class="title-list"></div>
    </div>
    <div class="card"><div class="card-title">BADGE COLLECTION</div><div id="v4Badges" class="v4-badges"></div></div>
    <div class="card"><div class="card-title">PLAYER SETTINGS</div><div class="field"><label for="v4NameInput">プレイヤー名</label><input id="v4NameInput" maxlength="24" placeholder="プレイヤー名"></div><div class="actions"><button class="btn" id="v4SaveName">名前を保存</button><button class="btn btn-danger" id="v4LogoutBtn">ログアウト</button></div><p class="help-text">ログアウトしても記録はアカウントごとに残ります。</p></div>`;
  $("weight").innerHTML=`
    <div class="eyebrow">BODY LOG</div><h1>体重管理</h1><p class="subtitle">体重の変化を記録して、長期的な傾向を確認しよう。</p>
    <div class="card"><div class="field"><label for="v4WeightInput">今日の体重 (kg)</label><input id="v4WeightInput" type="number" min="1" max="500" step="0.1" placeholder="例：50.0"></div><div class="field"><label for="v4WeightMemo">メモ（任意）</label><input id="v4WeightMemo" maxlength="100" placeholder="体調やコンディションなど"></div><button class="btn" id="v4SaveWeight">記録する</button></div>
    <div class="card"><div class="row"><b>体重推移</b><select id="v4WeightRange"><option value="30">直近30件</option><option value="90">直近90件</option><option value="all">すべて</option></select></div><div id="v4WeightChart" class="v4-chart"></div><div id="v4WeightEmpty" class="empty-message">まだ体重記録がありません。</div></div>
    <div class="card"><div class="card-title">記録履歴</div><div id="v4WeightList"></div></div>`;
  $("auto").innerHTML=`
    <div class="eyebrow">AUTO TRAINING</div><h1>おまかせコース</h1><p class="subtitle">その日のコンディションに合わせて、無理のないメニューを提案します。</p>
    <div class="card"><div class="field"><label for="v4Fatigue">現在の疲労度：<b id="v4FatigueLabel">5 / 10</b></label><input id="v4Fatigue" type="range" min="1" max="10" value="5"></div><div class="field"><label for="v4Equipment">器具</label><select id="v4Equipment"><option value="body">器具を使わない</option><option value="equipment">器具を使う</option><option value="both">どちらでも</option></select></div><p class="help-text">疲労度が高い場合は、軽い種目や短いメニューを優先します。痛みや体調不良がある場合は開始せず休みましょう。</p><button class="btn" id="v4AutoStart">メニューを作成して開始</button></div>
    <div class="card v4-auto-card"><div class="card-title" id="v4AutoState">READY</div><h2 id="v4AutoExercise">準備完了</h2><div class="timer-display" id="v4AutoTimer">00:00</div><p id="v4AutoInfo" class="status-text">開始すると種目・回数・休憩を自動で案内します。</p><div class="progress"><div class="progress-fill" id="v4AutoProgress"></div></div><div class="actions"><button id="v4AutoPause">一時停止</button><button id="v4AutoSkip">次へ</button><button class="btn btn-danger" id="v4AutoStop">STOP</button></div></div>`;
  $("missions").innerHTML=`
    <div class="eyebrow">DAILY QUEST</div><h1>デイリーミッション</h1><p class="subtitle">参加するかどうかは自由。達成すると10ポイント獲得。</p>
    <div class="card">
      <div class="card-title">TODAY'S MISSION</div>
      <h2 id="v4MissionName">今日のミッション</h2>
      <p id="v4MissionDesc" class="help-text"></p>
      <span class="badge">REWARD +10 PT</span>
      <div class="field">
        <label for="v4MissionEquip">器具</label>
        <select id="v4MissionEquip">
          <option value="both">どちらでも</option>
          <option value="body">器具なし</option>
          <option value="equipment">器具あり</option>
        </select>
      </div>
      <div class="actions">
        <button class="btn" id="v4MissionJoin">実行（ランダム種目を選出）</button>
        <button id="v4MissionSkip">今日はやらない</button>
      </div>
      <p id="v4MissionStatus" class="status-text"></p>
      <button class="btn" id="v4MissionCompleteBtn" hidden style="margin-top:12px">ミッション完了 → +10 PT</button>
    </div>
    <div class="card"><div class="card-title">ミッション履歴</div><div id="v4MissionHistory"></div></div>`;
  $("combat").innerHTML=`
    <div class="eyebrow">SPECIAL COURSES</div>
    <h1>CORE TRAINING</h1>
    <p class="subtitle">最初から解放。コースを選んで挑戦しよう。</p>
    <div class="grid" id="combatCourseSelect">
      <button type="button" class="card quick-card combat-course-btn" data-course="spiderman">
        <span class="quick-icon">🕷</span>
        <h3>スパイダーマンコース</h3>
        <p>爆発力・着地・全身連動</p>
      </button>
      <button type="button" class="card quick-card combat-course-btn" data-course="polarbear">
        <span class="quick-icon">🐻</span>
        <h3>白熊コース</h3>
        <p>体幹・壁押し・重心制御</p>
      </button>
      <button type="button" class="card quick-card combat-course-btn" data-course="bakumote">
        <span class="quick-icon">🔥</span>
        <h3>瀑モテコース</h3>
        <p>臀筋・体幹・心肺の実践メニュー</p>
      </button>
    </div>
    <div class="card" id="combatDetailCard" hidden>
      <div class="row">
        <h2 id="v4CombatTitle" style="margin:0">コース</h2>
        <button type="button" id="combatBackBtn">コース一覧へ</button>
      </div>
      <p id="v4CombatDesc" class="help-text"></p>
      <div id="v4CombatTasks" class="combat-task-list"></div>
      <div class="actions" style="margin-top:16px">
        <button class="btn" id="v4CombatComplete">このコースを完了</button>
      </div>
      <p class="help-text">痛みが出たら中止。回数・時間は自分のペースで調整してください。</p>
      <p id="v4CombatDoneNote" class="status-text"></p>
    </div>`;
  $("ghostcreate").innerHTML=`
    <div class="eyebrow">CREATE GHOST</div>
    <h1>ゴースト作成</h1>
    <p class="subtitle">限界まで挑戦した記録をゴーストとして保存。ゴーストマッチで対戦相手にできます。</p>
    <div class="card">
      <div class="field"><label for="gcName">ゴースト名</label><input id="gcName" maxlength="40" placeholder="例：自己ベスト 腕立て"></div>
      <div class="field"><label for="gcExercise">種目</label><select id="gcExercise"></select></div>
      <div class="field"><label for="gcSets">セット数</label><input id="gcSets" type="number" min="1" max="50" value="3"></div>
      <div class="field"><label for="gcReps">1セットあたりの回数（または秒）</label><input id="gcReps" type="number" min="1" value="10"></div>
      <div class="field"><label for="gcMemo">メモ</label><input id="gcMemo" maxlength="100" placeholder="限界までやった記録"></div>
      <button class="btn" id="gcSaveBtn">ゴーストとして保存</button>
      <p class="help-text">ここで保存したゴーストは「GHOST MATCH」で選択できます。</p>
    </div>
    <div class="card"><div class="card-title">保存済みゴースト</div><div id="gcList"></div></div>`;
  $("ghost").innerHTML=`
    <div class="eyebrow">GHOST MATCH</div>
    <h1>過去の自分と対戦</h1>
    <p class="subtitle">作成したゴースト、または過去の記録と勝負しよう。</p>
    <div class="card">
      <div class="field"><label for="v4GhostSelect">対戦するゴースト</label><select id="v4GhostSelect"></select></div>
      <button class="btn" id="v4GhostStart">ゴーストマッチ開始</button>
    </div>
    <div class="card" id="v4GhostBattle" hidden>
      <div class="ghost-battle-banner" id="ghostBattleBanner">過去の自分の最高記録を塗り替えろ！</div>
      <p id="v4GhostBattleInfo" class="help-text"></p>
      <button class="btn btn-danger" id="v4GhostEndBtn">終了する</button>
    </div>
    <div class="card" id="v4GhostResult" hidden></div>`;
  $("restgame").innerHTML=`
    <div class="eyebrow">REST ARCADE</div>
    <h1>休憩ゲーム</h1>
    <p class="subtitle">1日3回まで。クリアするごとに +5pt。好きなゲームを選んで遊べます。</p>
    <div class="card">
      <div class="row">
        <div><span class="card-title">今日の残り</span><div class="stat stat-small" id="rgRemain">3</div></div>
        <div><span class="card-title">今日のクリア</span><div class="stat stat-small" id="rgClears">0</div></div>
      </div>
      <p id="rgTodayInfo" class="help-text">クリア成功時のみ回数を消費し、+5pt 入ります。</p>
    </div>
    <div class="grid" id="rgSelect">
      <button type="button" class="card quick-card" data-rg="reaction">
        <span class="quick-icon">🔴</span>
        <h3>反射テスト</h3>
        <p>赤丸出現から0.3秒以内</p>
      </button>
      <button type="button" class="card quick-card" data-rg="tensec">
        <span class="quick-icon">⏱</span>
        <h3>10秒ぴったり</h3>
        <p>±0.2秒以内でクリア</p>
      </button>
      <button type="button" class="card quick-card" data-rg="hold">
        <span class="quick-icon">✋</span>
        <h3>3秒ホールド</h3>
        <p>2.8〜3.2秒で離す</p>
      </button>
      <button type="button" class="card quick-card" data-rg="color">
        <span class="quick-icon">🎯</span>
        <h3>色タッチ</h3>
        <p>指定色だけ素早くタップ</p>
      </button>
    </div>
    <div class="card rest-game-card" id="rgPlayCard" hidden>
      <div class="row">
        <h2 id="rgGameTitle" style="margin:0">ゲーム</h2>
        <button type="button" id="rgBackBtn">一覧へ</button>
      </div>
      <p id="rgExplain" class="help-text"></p>
      <div class="rg-stage" id="rgStage">
        <div class="rg-center" id="rgCenterLabel">READY</div>
        <div class="rg-dot" id="rgDot" hidden></div>
      </div>
      <p id="rgStatus" class="status-text" style="text-align:center"></p>
      <div class="timer-display" id="rgPrecision" style="font-size:28px">0.000</div>
      <div class="actions" style="justify-content:center">
        <button type="button" class="btn" id="rgStartBtn">スタート</button>
        <button type="button" id="rgActionBtn">タップ</button>
      </div>
    </div>`;

  const welcome=document.createElement("div");welcome.id="v4Welcome";welcome.className="v4-welcome";
  const hasAccount = !!getCurrentAccountId();
  welcome.innerHTML=`<div class="v4-welcome-inner v4-welcome-simple">
    <div class="v4-welcome-mark">VaX <span>CORE</span></div>
    <p class="v4-welcome-lead" id="v4WelcomeQuote">${hasAccount ? "おかえりなさい" : "アカウントを作成して開始"}</p>
    <button class="btn" id="v4Enter">${hasAccount ? "開始する" : "アカウント作成して開始"}</button>
  </div>`;
  if (hasAccount) welcome.classList.add("hide");
  document.body.appendChild(welcome);

  // 常時表示のトレーニング経過時間（右上）
  if (!$("globalSessionTimer")) {
    const timerBar = document.createElement("div");
    timerBar.id = "globalSessionTimer";
    timerBar.className = "global-session-timer";
    timerBar.hidden = true;
    timerBar.innerHTML = `<span class="gst-label">TRAINING</span><span id="globalSessionClock">00:00</span>`;
    document.body.appendChild(timerBar);
  }

  // ミッション完了トースト（右上）
  if (!$("missionToast")) {
    const mt = document.createElement("div");
    mt.id = "missionToast";
    mt.className = "mission-toast";
    mt.innerHTML = `<b>+10 PT</b><span>ミッション完了！</span>`;
    document.body.appendChild(mt);
  }
}
let v4Auto={items:[],index:0,left:0,interval:null,paused:false,mission:false};
function v4StartAuto(items,mission=false){
  v4StopAuto(false);v4Auto={items,index:0,left:0,interval:null,paused:false,mission};v4RunAutoStep();
}
function v4RunAutoStep(){
  if(v4Auto.index>=v4Auto.items.length){v4StopAuto(false);$("v4AutoState").textContent="COMPLETED";$("v4AutoExercise").textContent="コース完了！";$("v4AutoInfo").textContent="お疲れさまでした。";if(v4Auto.mission)v4CompleteMission();return;}
  const item=v4Auto.items[v4Auto.index];v4Auto.left=item.seconds;
  $("v4AutoState").textContent=item.rest?"REST":"TRAINING";$("v4AutoExercise").textContent=item.name;
  $("v4AutoInfo").textContent=item.rest?"休憩中 · "+item.seconds+"秒":"目安："+item.reps+"回 · 自分のペースで実施";
  $("v4AutoTimer").textContent=formatTime(item.seconds);$("v4AutoProgress").style.width=(v4Auto.index/v4Auto.items.length*100)+"%";
  clearInterval(v4Auto.interval);v4Auto.interval=setInterval(()=>{if(v4Auto.paused)return;v4Auto.left--; $("v4AutoTimer").textContent=formatTime(v4Auto.left);if(v4Auto.left<=0){clearInterval(v4Auto.interval);v4Auto.index++;v4RunAutoStep();}},1000);
}
function v4StopAuto(showToast=true){
  clearInterval(v4Auto.interval);v4Auto.interval=null;
  if(showToast){$("v4AutoState").textContent="STOPPED";$("v4AutoInfo").textContent="コースを停止しました。";toast("おまかせコースを停止しました");}
}
function v4MakeAutoItems(){
  const fatigue=Number($("v4Fatigue").value),mode=$("v4Equipment").value;
  if(fatigue>=9)return [{name:"回復コース：軽いストレッチ",reps:"無理のない範囲",seconds:30},{name:"休憩・水分補給",seconds:60+Math.floor(Math.random()*31),rest:true}];
  let pool=appData.exercises.filter(e=>mode==="both"||(mode==="body"?e.type!=="weight":e.type==="weight"));
  if(!pool.length)pool=appData.exercises.filter(e=>e.type!=="weight");
  if(!pool.length)return [];
  const count=fatigue>=8?2:fatigue>=5?3:4;
  const shuffled=pool.slice().sort(()=>Math.random()-.5).slice(0,Math.min(count,pool.length));
  const items=[];
  shuffled.forEach((e,i)=>{items.push({name:e.name,reps:fatigue>=8?5+Math.floor(Math.random()*4):8+Math.floor(Math.random()*5),seconds:fatigue>=8?25:35+Math.floor(Math.random()*16)});if(i<shuffled.length-1)items.push({name:"休憩",seconds:60+Math.floor(Math.random()*31),rest:true});});
  return items;
}
function v4MissionToday(){
  const tasks=["好きな種目を1種類、無理のない範囲で行う","軽い体幹トレーニングを行う","いつも行う種目を丁寧なフォームで1セット行う","軽いフットワークとバランス運動を行う"];
  const idx=Math.abs([...dateKey()].reduce((a,c)=>a+c.charCodeAt(0),0))%tasks.length;
  return {name:tasks[idx],desc:"自分の体調に合わせて実施。途中でやめても大丈夫です。"};
}
function showMissionToast(msg){
  const el = $("missionToast");
  if (!el) return;
  el.querySelector("span").textContent = msg || "ミッション完了！";
  el.classList.add("show");
  clearTimeout(showMissionToast._t);
  showMissionToast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function v4CompleteMission(){
  if(v4.missionDates.includes(dateKey()))return;
  v4.missionDates.push(dateKey());
  v4.missionHistory.push({date:dateKey(),done:true});
  saveV4();
  v4Refresh();
  if ($("v4MissionStatus")) $("v4MissionStatus").textContent="達成！ +10 pt";
  showMissionToast("ミッション完了！ +10 PT");
  toast("ミッション達成！ +10 pt");
  playBeep(880, 0.2);
}
function v4Refresh(){
  const s=v4Stats(),next=s.next?s.next[0]:s.points;
  $("v4HeaderName").textContent=v4.name;$("v4HeaderLevel").textContent="LEVEL "+s.level;
  $("v4ProfileName").textContent=v4.name;$("v4NameInput").value=v4.name;
  setText("v4Title", s.title);
  setText("v4TitleSub", s.titleSub || "");
  $("v4Level").textContent=s.level;$("v4Points").textContent=s.points.toLocaleString("ja-JP");
  $("v4Sets").textContent=s.setCount;$("v4Time").textContent=formatTime(s.seconds);
  const prev=v4Titles.filter(t=>s.points>=t[0]).slice(-1)[0][0],goal=s.next?s.next[0]:prev;
  $("v4NextLabel").textContent=s.next?(s.next[0]-s.points)+" pt で「"+s.next[1]+"」":"MAX";
  $("v4TitleProgress").style.width=s.next?Math.min(100,(s.points-prev)/(goal-prev)*100)+"%":"100%";
  $("v4ProgressText").textContent=s.next
    ? `現在 ${s.points} pt ／ 次の称号「${s.next[1]}」まであと ${s.next[0]-s.points} pt`
    : "すべての称号を獲得しました！";
  const list=$("v4TitleList");
  if(list){
    list.innerHTML=v4Titles.map(t=>{
      const unlocked=s.points>=t[0];
      const current=s.title===t[1];
      return `<div class="title-list-item ${unlocked?"unlocked":"locked"} ${current?"current":""}">
        <div class="title-list-main">
          <b>${v4Esc(t[1])}</b>
          <small>${v4Esc(t[2]||"")}</small>
        </div>
        <div class="title-list-meta">
          <span>${t[0].toLocaleString("ja-JP")} pt</span>
          <span class="title-list-state">${current?"装備中":(unlocked?"解放済":"未解放")}</span>
        </div>
      </div>`;
    }).join("");
  }
  const badges=[["FIRST","初記録",appData.records.length>=1],["SETS 10","10セット達成",s.setCount>=10],["SETS 50","50セット達成",s.setCount>=50],["TIME 1H","累計1時間",s.seconds>=3600],["WEIGHT","体重を記録",v4.weightLogs.length>0],["QUEST","ミッション達成",v4.missionHistory.some(x=>x.done)]];
  const combatBtn=document.querySelector('[data-page="combat"]');
  if(combatBtn){combatBtn.disabled=false;combatBtn.textContent="⚡ CORE TRAINING";}
  $("v4Badges").innerHTML=badges.map(b=>`<div class="v4-badge ${b[2]?"earned":""}"><b>${b[0]}</b><small>${b[1]}</small></div>`).join("");
  v4RenderWeight();v4RenderMissions();v4RenderGhostOptions();
}
function v4RenderWeight(){
  const logs=v4.weightLogs.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const limit=$("v4WeightRange")?.value||"30",data=limit==="all"?logs:logs.slice(-Number(limit));
  $("v4WeightEmpty").hidden=logs.length>0;
  $("v4WeightList").innerHTML=logs.slice().reverse().slice(0,20).map(x=>`<div class="row v4-list-row"><span>${v4Esc(x.date)}<small>${v4Esc(x.memo||"")}</small></span><b>${Number(x.weight).toFixed(1)} kg</b></div>`).join("")||"記録なし";
  const box=$("v4WeightChart");if(!data.length){box.innerHTML="";return;}
  const vals=data.map(x=>x.weight),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const width=640,height=220,pad=28,step=data.length>1?(width-pad*2)/(data.length-1):0;
  const pts=data.map((x,i)=>`${pad+i*step},${height-pad-((x.weight-min)/range)*(height-pad*2)}`).join(" ");
  box.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="体重推移グラフ" class="v4-weight-svg"><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" stroke="#34445c"/><polyline points="${pts}" fill="none" stroke="#65a4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${data.map((x,i)=>{const cx=pad+i*step,cy=height-pad-((x.weight-min)/range)*(height-pad*2);return `<circle cx="${cx}" cy="${cy}" r="5" fill="#16c79a"/><text x="${cx}" y="${Math.max(16,cy-12)}" text-anchor="middle" fill="#f2f6ff" font-size="12">${x.weight.toFixed(1)}</text>`;}).join("")}</svg><div class="v4-chart-dates"><span>${data[0].date}</span><span>${data[data.length-1].date}</span></div>`;
}
function v4RenderMissions(){
  const done=v4.missionDates.includes(dateKey()),skipped=v4.missionHistory.some(x=>x.date===dateKey()&&x.skipped),m=v4MissionToday();
  $("v4MissionName").textContent=m.name;$("v4MissionDesc").textContent=m.desc;
  $("v4MissionJoin").disabled=done||skipped;$("v4MissionSkip").disabled=done||skipped;
  $("v4MissionStatus").textContent=done?"本日のミッションは達成済みです。":(skipped?"今日は参加しない設定です。":"参加するか選んでください。");
  $("v4MissionHistory").innerHTML=v4.missionHistory.slice().reverse().slice(0,10).map(x=>`<div class="row v4-list-row"><span>${x.date}</span><b>${x.done?"+10 pt":x.skipped?"不参加":"—"}</b></div>`).join("")||"履歴はありません。";
}
function v4RenderGhostOptions(){
  const gcSel = $("gcExercise");
  if (gcSel) {
    const old = gcSel.value;
    gcSel.innerHTML = appData.exercises.map(e=>`<option value="${v4Esc(e.id)}">${v4Esc(e.name)}</option>`).join("");
    if (appData.exercises.some(e=>e.id===old)) gcSel.value = old;
  }
  const list = $("gcList");
  if (list) {
    const ghosts = appData.ghosts || [];
    list.innerHTML = ghosts.length
      ? ghosts.slice().reverse().map(g =>
          `<div class="row v4-list-row">
            <span><b>${v4Esc(g.name)}</b><small>${v4Esc(g.exercise)} · ${g.sets}セット × ${g.reps}</small></span>
            <button data-del-ghost="${v4Esc(g.id)}" class="btn-danger">削除</button>
          </div>`
        ).join("")
      : `<p class="empty-message">まだゴーストがありません。</p>`;
    list.querySelectorAll("[data-del-ghost]").forEach(btn => {
      btn.addEventListener("click", () => {
        appData.ghosts = (appData.ghosts || []).filter(g => g.id !== btn.dataset.delGhost);
        saveData();
        v4RenderGhostOptions();
        toast("ゴーストを削除しました");
      });
    });
  }
  const sel = $("v4GhostSelect");
  if (sel) {
    const ghosts = appData.ghosts || [];
    sel.innerHTML = ghosts.length
      ? ghosts.map(g => `<option value="${v4Esc(g.id)}">${v4Esc(g.name)}（${v4Esc(g.exercise)} ${g.sets}×${g.reps}）</option>`).join("")
      : `<option value="">ゴーストを作成してください</option>`;
  }
}
/* ---------- AIコーチ（ルールベース） ---------- */
const AI_MODE_KEY = "vax_ai_mode_on";
let aiChatMinimized = false;
let aiLastAutoAt = 0;

function isAiModeOn() {
  return localStorage.getItem(AI_MODE_KEY) === "1";
}

function setAiModeOn(on) {
  localStorage.setItem(AI_MODE_KEY, on ? "1" : "0");
  const panel = $("aiChatPanel");
  if (panel) panel.hidden = !on;
  const toggle = $("aiModeToggle");
  if (toggle) toggle.checked = !!on;
  if (on && $("aiChatBody") && !$("aiChatBody").children.length) {
    aiPush("assistant", aiGreeting());
  }
}

function aiPush(role, text) {
  const body = $("aiChatBody");
  if (!body) return;
  const div = document.createElement("div");
  div.className = "ai-msg " + (role === "user" ? "ai-msg-user" : "ai-msg-bot");
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

/** コーチ加点（1日上限あり・頑張ったときだけ） */
function aiCoachBonus(amount, reason) {
  if (!isAiModeOn() || !getCurrentAccountId()) return 0;
  if (!v4.coachBonusLogs) v4.coachBonusLogs = [];
  const today = dateKey();
  const todayTotal = v4.coachBonusLogs
    .filter(x => x.date === today)
    .reduce((n, x) => n + (Number(x.pts) || 0), 0);
  const remain = Math.max(0, 30 - todayTotal); // 1日最大 +30
  const give = Math.min(amount, remain);
  if (give <= 0) {
    aiPush("assistant", "今日のコーチ加点枠は使い切ってる。また明日、中身のある練習で勝負だ。");
    return 0;
  }
  v4.coachBonusLogs.push({ date: today, pts: give, reason: reason || "", at: Date.now() });
  saveV4();
  v4Refresh();
  showMissionToast(`コーチ加点 +${give} PT`);
  return give;
}

function aiGreeting() {
  const s = typeof v4Stats === "function" ? v4Stats() : { points: 0, level: 1, title: "Beginner" };
  const name = v4?.name || "お前";
  const days = [...new Set((appData.records || []).map(r => r.date))].length;
  return `${name}、来たか。Lv.${s.level}（${s.title}）・${s.points}pt・記録${days}日。雑談してる暇があるならメニューを組め。今日の課題は「手を抜かないこと」だ。`;
}

function aiAutoComment(eventType) {
  return; // AIモード廃止。休憩ゲームへ移行
  if (!isAiModeOn()) return;
  const now = Date.now();
  if (now - aiLastAutoAt < 4000 && eventType !== "start" && eventType !== "finish") return;
  aiLastAutoAt = now;
  const name = session?.exercise || "";
  const setsDone = session?.sets?.length || 0;
  const lines = {
    start: [
      `${name || "メニュー"}、始めるぞ。最初から雑にやるな。フォーム確認。`,
      `スタート。回数より「丁寧さ」が先。サボるなら帰れ。`,
      `${name}開始。呼吸を整えて、一回一回を数えろ。`
    ],
    set: [
      `セット記録、いいぞ。休憩は短く、次も同じ質で行け。`,
      `一セット積んだ。まだ終わりじゃない。集中維持。`,
      `保存確認。楽したセットは自分にバレてるぞ。`
    ],
    rest: [
      `休憩だ。スマホ見るな。次のセットのイメージだけ持て。`,
      `レスト中。肩の力を抜け。ダラダラ休むな。`,
      `休むのも練習のうち。呼吸を整えて次へ備えろ。`
    ],
    restEnd: [
      `休憩終了。言い訳なしで次のセット。`,
      `立て。次、行くぞ。`
    ],
    finish: [
      `メニュー完了。よくやった。クールダウンと水分、忘れるな。`,
      `今日はちゃんと手を動かしたな。その積み重ねが強くなる。`
    ],
    encourage: [
      `まだいける。顎を上げて。`,
      `キツいのは効いてる証拠。フォームだけ崩すな。`,
      `根性見せろ。あと少しだ。`
    ]
  };
  const pool = lines[eventType] || lines.encourage;
  let msg = pool[Math.floor(Math.random() * pool.length)];

  // 完了時：セット数に応じて加点（頑張った分だけ）
  if (eventType === "finish") {
    let bonus = 0;
    if (setsDone >= 6) bonus = 15;
    else if (setsDone >= 3) bonus = 10;
    else if (setsDone >= 1) bonus = 5;
    if (bonus > 0) {
      const given = aiCoachBonus(bonus, "training_finish_" + setsDone);
      if (given > 0) {
        msg += ` …コーチ判断で +${given}pt。今日は認めよう。`;
      }
    } else {
      msg = "終わったのか？中身が薄い。次はちゃんとセットを積め。";
    }
  }
  // セット保存が続くとたまに小さな加点
  if (eventType === "set" && setsDone > 0 && setsDone % 3 === 0) {
    const given = aiCoachBonus(3, "set_streak_" + setsDone);
    if (given > 0) msg += ` 継続を見て +${given}pt 入れとく。`;
  }

  aiPush("assistant", msg);
}

const AI_API_KEY = "vax_ai_api_key";
const AI_API_BASE = "vax_ai_api_base";
const AI_API_MODEL = "vax_ai_api_model";
let aiChatHistory = [];

function getAiApiConfig() {
  return {
    key: localStorage.getItem(AI_API_KEY) || "",
    base: (localStorage.getItem(AI_API_BASE) || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: localStorage.getItem(AI_API_MODEL) || "gpt-4o-mini"
  };
}

function saveAiApiConfig(key, base, model) {
  if (key != null) localStorage.setItem(AI_API_KEY, key.trim());
  if (base != null) localStorage.setItem(AI_API_BASE, (base.trim() || "https://api.openai.com/v1").replace(/\/$/, ""));
  if (model != null) localStorage.setItem(AI_API_MODEL, model.trim() || "gpt-4o-mini");
}

function aiBuildSystemPrompt() {
  const s = typeof v4Stats === "function" ? v4Stats() : { points: 0, level: 1, title: "Beginner", setCount: 0 };
  const name = v4?.name || "プレイヤー";
  const days = [...new Set((appData.records || []).map(r => r.date))].length;
  const exercises = (appData.exercises || []).map(e => e.name).slice(0, 20).join("、");
  const sessionInfo = session
    ? `現在トレーニング中：${session.exercise} ${session.currentSet}/${session.targetSets}セット目`
    : "現在トレーニングはしていません";
  return `あなたはフィットネスアプリ「VaX CORE」の専属コーチAIです。
口調は部活の熱血コーチ。基本は厳しめで短く、でも質問にはちゃんと答える。
トレーニング以外の話題（雑談・勉強・悩みなど）にも答えてよい。ただし最後に一言、体づくりや今日の行動につなげる程度でよい。話題を拒否しない。
安全面：痛み・めまいがある場合は中止を促す。医療診断はしない。

プレイヤー情報：
- 名前: ${name}
- レベル: ${s.level} / 称号: ${s.title} / ポイント: ${s.points}
- 記録日数: ${days} / 総セット: ${s.setCount}
- 登録種目: ${exercises || "なし"}
- ${sessionInfo}

回答は日本語で、長すぎず読みやすく。`;
}

async function aiReply(userText) {
  const raw = String(userText || "").trim();
  if (!raw) return "何か言ってくれ。質問でも相談でもいい。";

  const cfg = getAiApiConfig();
  if (!cfg.key) {
    return "AI APIキーが未設定です。メニューの「AIモード」から APIキーを保存してください。OpenAI 互換のキーに対応しています。";
  }

  try {
    aiChatHistory.push({ role: "user", content: raw });
    if (aiChatHistory.length > 12) aiChatHistory = aiChatHistory.slice(-12);

    const res = await fetch(cfg.base + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          { role: "system", content: aiBuildSystemPrompt() },
          ...aiChatHistory
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("AI API error", res.status, errText);
      if (res.status === 401) return "APIキーが無効です。AIモード画面でキーを確認してください。";
      if (res.status === 429) return "APIの利用上限に達しています。少し待ってから再度どうぞ。";
      return `AI応答に失敗しました（${res.status}）。設定やネットワークを確認してください。`;
    }

    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) return "応答が空でした。もう一度聞いてください。";
    aiChatHistory.push({ role: "assistant", content: answer });
    return answer;
  } catch (e) {
    console.warn("AI fetch failed", e);
    return "通信エラーです。ネット接続とAPI設定を確認してください。";
  }
}

/* ---------- 休憩ゲーム（1日3回・クリア+5pt） ---------- */
const RG_PLAYS_KEY = "vax_rg_plays_";
const RG_CLEARS_KEY = "vax_rg_clears_";
const RG_MAX_PLAYS = 3;

let rg = {
  game: null,
  phase: "idle", // idle | countdown | wait | play | result
  timers: [],
  startAt: 0,
  targetColor: "",
  colorEndsAt: 0
};

function rgClearTimers() {
  rg.timers.forEach(id => clearTimeout(id));
  rg.timers = [];
  if (rg.interval) {
    clearInterval(rg.interval);
    rg.interval = null;
  }
}

function rgPlaysToday() {
  return Number(localStorage.getItem(RG_PLAYS_KEY + dateKey()) || 0);
}
function rgClearsToday() {
  return Number(localStorage.getItem(RG_CLEARS_KEY + dateKey()) || 0);
}
function rgRemain() {
  return Math.max(0, RG_MAX_PLAYS - rgPlaysToday());
}
function rgRenderLobby() {
  setText("rgRemain", String(rgRemain()));
  setText("rgClears", String(rgClearsToday()));
  setText("rgTodayInfo",
    rgRemain() > 0
      ? `残り ${rgRemain()} 回。クリア成功時のみ回数消費 & +5pt。`
      : "本日のプレイ上限に達しました。また明日挑戦できます。"
  );
}

function rgShowSelect(show) {
  const sel = $("rgSelect");
  const play = $("rgPlayCard");
  if (sel) sel.hidden = !show;
  if (play) play.hidden = show;
}

function rgSetDot(visible, color) {
  const dot = $("rgDot");
  if (!dot) return;
  dot.hidden = !visible;
  if (color) dot.style.background = color;
}

const RG_META = {
  reaction: {
    title: "反射テスト",
    explain: "スタート後、5秒カウントダウンします。その後しばらくして赤い丸が出たら、できるだけ早くタップ。出現から 0.3 秒以内でクリア。",
    action: "赤丸をタップ"
  },
  tensec: {
    title: "10秒ぴったり",
    explain: "スタートで計測開始。ちょうど10秒だと思った瞬間にタップ。4秒で表示が薄くなり、6秒で非表示。結果は 0.001 秒単位。10.000±0.200 秒でクリア。",
    action: "止める"
  },
  hold: {
    title: "3秒ホールド",
    explain: "ボタンを押したまま約3秒。離した時間が 2.800〜3.200 秒ならクリア。表示は 0.001 秒単位。",
    action: "押す / 離す"
  },
  color: {
    title: "色タッチ",
    explain: "指定された色の丸だけをタップ。違う色を押すか、制限時間内に押せないと失敗。3問中2問正解でクリア。",
    action: "色をタップ"
  }
};

function rgOpenGame(id) {
  if (!RG_META[id]) return;
  if (rgRemain() <= 0) return toast("本日の上限（3回）に達しています");
  rgClearTimers();
  rg.game = id;
  rg.phase = "idle";
  rgShowSelect(false);
  setText("rgGameTitle", RG_META[id].title);
  setText("rgExplain", RG_META[id].explain);
  setText("rgCenterLabel", "READY");
  setText("rgStatus", "スタートを押してください");
  setText("rgPrecision", "0.000");
  rgSetDot(false);
  const btn = $("rgActionBtn");
  if (btn) btn.textContent = RG_META[id].action;
}

function rgAwardClear() {
  const plays = rgPlaysToday() + 1;
  localStorage.setItem(RG_PLAYS_KEY + dateKey(), String(plays));
  localStorage.setItem(RG_CLEARS_KEY + dateKey(), String(rgClearsToday() + 1));
  if (!v4.coachBonusLogs) v4.coachBonusLogs = [];
  v4.coachBonusLogs.push({ date: dateKey(), pts: 5, reason: "restgame_" + rg.game, at: Date.now() });
  saveV4();
  if (typeof v4Refresh === "function") v4Refresh();
  showMissionToast("クリア！ +5 PT");
  playBeep(880, 0.15);
  rgRenderLobby();
}

function rgFail() {
  rg.phase = "result";
  playBeep(300, 0.1);
}

function rgStart() {
  if (!rg.game) return;
  if (rgRemain() <= 0) return toast("本日の上限です");
  if (rg.phase === "countdown" || rg.phase === "wait" || rg.phase === "play") return;
  rgClearTimers();
  rgSetDot(false);

  if (rg.game === "reaction") return rgStartReaction();
  if (rg.game === "tensec") return rgStartTensec();
  if (rg.game === "hold") return rgStartHold();
  if (rg.game === "color") return rgStartColor();
}

/* 1) 反射テスト */
function rgStartReaction() {
  rg.phase = "countdown";
  let n = 5;
  setText("rgCenterLabel", String(n));
  setText("rgStatus", "説明：赤丸が出るまで待ち、出たらすぐタップ。0.3秒以内でクリア。");
  setText("rgPrecision", "0.000");
  const tick = () => {
    n--;
    if (n > 0) {
      setText("rgCenterLabel", String(n));
      playBeep(500, 0.05);
      rg.timers.push(setTimeout(tick, 1000));
    } else {
      setText("rgCenterLabel", "…");
      setText("rgStatus", "赤丸を待て");
      rg.phase = "wait";
      const delay = 800 + Math.random() * 2200;
      rg.timers.push(setTimeout(() => {
        rg.phase = "play";
        rg.startAt = performance.now();
        rgSetDot(true, "#ff3b4a");
        setText("rgCenterLabel", "");
        setText("rgStatus", "今だ！");
        playBeep(900, 0.06);
      }, delay));
    }
  };
  playBeep(500, 0.05);
  rg.timers.push(setTimeout(tick, 1000));
}

function rgReactionTap() {
  if (rg.phase === "wait") {
    setText("rgStatus", "フライング！ 失敗");
    setText("rgCenterLabel", "FAIL");
    rgSetDot(false);
    rgFail();
    return;
  }
  if (rg.phase !== "play") return;
  const ms = performance.now() - rg.startAt;
  const sec = ms / 1000;
  setText("rgPrecision", sec.toFixed(3) + " 秒");
  rgSetDot(false);
  if (sec <= 0.3) {
    setText("rgCenterLabel", "CLEAR");
    setText("rgStatus", `反応 ${sec.toFixed(3)} 秒 ≤ 0.300 クリア！`);
    rg.phase = "result";
    rgAwardClear();
  } else {
    setText("rgCenterLabel", "FAIL");
    setText("rgStatus", `反応 ${sec.toFixed(3)} 秒 … 遅い`);
    rgFail();
  }
}

/* 2) 10秒ぴったり */
function rgStartTensec() {
  rg.phase = "play";
  rg.startAt = performance.now();
  setText("rgCenterLabel", "計測中");
  setText("rgStatus", "10秒ちょうどでタップ");
  const prec = $("rgPrecision");
  if (prec) {
    prec.style.opacity = "1";
    prec.textContent = "0.000";
  }
  rg.interval = setInterval(() => {
    const t = (performance.now() - rg.startAt) / 1000;
    if (prec) {
      if (t < 4) {
        prec.style.opacity = "1";
        prec.textContent = t.toFixed(3);
      } else if (t < 6) {
        prec.style.opacity = "0.25";
        prec.textContent = t.toFixed(3);
      } else {
        prec.style.opacity = "0";
        prec.textContent = t.toFixed(3);
      }
    }
  }, 16);
}

function rgTensecTap() {
  if (rg.phase !== "play" || rg.game !== "tensec") return;
  const t = (performance.now() - rg.startAt) / 1000;
  rgClearTimers();
  const prec = $("rgPrecision");
  if (prec) {
    prec.style.opacity = "1";
    prec.textContent = t.toFixed(3);
  }
  const diff = Math.abs(t - 10);
  if (diff <= 0.2) {
    setText("rgCenterLabel", "CLEAR");
    setText("rgStatus", `${t.toFixed(3)} 秒（誤差 ${diff.toFixed(3)}）クリア！`);
    rg.phase = "result";
    rgAwardClear();
  } else {
    setText("rgCenterLabel", "FAIL");
    setText("rgStatus", `${t.toFixed(3)} 秒（誤差 ${diff.toFixed(3)}）… ±0.200 が必要`);
    rgFail();
  }
}

/* 3) 3秒ホールド */
function rgStartHold() {
  rg.phase = "idle";
  setText("rgCenterLabel", "長押し");
  setText("rgStatus", "ボタンを押して、約3秒で離す");
  setText("rgPrecision", "0.000");
  toast("アクションボタンを押したままにしてください");
}

function rgHoldDown() {
  if (rg.game !== "hold") return;
  if (rg.phase === "play") return;
  rg.phase = "play";
  rg.startAt = performance.now();
  setText("rgCenterLabel", "HOLD");
  rg.interval = setInterval(() => {
    const t = (performance.now() - rg.startAt) / 1000;
    setText("rgPrecision", t.toFixed(3));
  }, 16);
}

function rgHoldUp() {
  if (rg.game !== "hold" || rg.phase !== "play") return;
  const t = (performance.now() - rg.startAt) / 1000;
  rgClearTimers();
  setText("rgPrecision", t.toFixed(3));
  if (t >= 2.8 && t <= 3.2) {
    setText("rgCenterLabel", "CLEAR");
    setText("rgStatus", `${t.toFixed(3)} 秒 クリア！`);
    rg.phase = "result";
    rgAwardClear();
  } else {
    setText("rgCenterLabel", "FAIL");
    setText("rgStatus", `${t.toFixed(3)} 秒 … 2.800〜3.200 が必要`);
    rgFail();
  }
}

/* 4) 色タッチ */
const RG_COLORS = [
  { name: "赤", value: "#ff3b4a" },
  { name: "青", value: "#3987ff" },
  { name: "緑", value: "#16c79a" },
  { name: "黄", value: "#ffc857" }
];
function rgStartColor() {
  rg.phase = "play";
  rg.colorRound = 0;
  rg.colorCorrect = 0;
  rgColorNext();
}
function rgColorNext() {
  if (rg.colorRound >= 3) {
    if (rg.colorCorrect >= 2) {
      setText("rgCenterLabel", "CLEAR");
      setText("rgStatus", `3問中${rg.colorCorrect}問正解！ クリア`);
      rg.phase = "result";
      rgAwardClear();
    } else {
      setText("rgCenterLabel", "FAIL");
      setText("rgStatus", `3問中${rg.colorCorrect}問正解。2問以上でクリア`);
      rgFail();
    }
    return;
  }
  rg.colorRound++;
  const target = RG_COLORS[Math.floor(Math.random() * RG_COLORS.length)];
  rg.targetColor = target.name;
  // show a random color (50% chance correct-ish delay)
  const show = RG_COLORS[Math.floor(Math.random() * RG_COLORS.length)];
  setText("rgCenterLabel", target.name);
  setText("rgStatus", `「${target.name}」が出たらタップ（${rg.colorRound}/3）`);
  rgSetDot(false);
  rg.timers.push(setTimeout(() => {
    rgSetDot(true, show.value);
    rg.shownColor = show.name;
    rg.colorEndsAt = performance.now() + 900;
    rg.timers.push(setTimeout(() => {
      if (rg.phase === "play" && rg.game === "color") {
        rgSetDot(false);
        setText("rgStatus", "時間切れ");
        rg.timers.push(setTimeout(() => rgColorNext(), 400));
      }
    }, 900));
  }, 500 + Math.random() * 700));
}
function rgColorTap() {
  if (rg.game !== "color" || rg.phase !== "play") return;
  if (!$("rgDot") || $("rgDot").hidden) return;
  rgClearTimers();
  const ok = rg.shownColor === rg.targetColor;
  rgSetDot(false);
  if (ok) {
    rg.colorCorrect++;
    setText("rgStatus", "正解！");
    playBeep(800, 0.07);
  } else {
    setText("rgStatus", "違う色！");
    playBeep(300, 0.07);
  }
  rg.timers.push(setTimeout(() => rgColorNext(), 450));
}

function rgAction() {
  if (rg.game === "reaction") return rgReactionTap();
  if (rg.game === "tensec") return rgTensecTap();
  if (rg.game === "color") return rgColorTap();
  // hold uses down/up
}

function v4Bind(){
  $("v4PlayerButton")?.addEventListener("click",()=>goPage("status"));
  $("v4Enter")?.addEventListener("click",()=>{
    playStartupSound();
    const existingId = getCurrentAccountId();
    if (!existingId) {
      const acc = createAccount();
      toast("アカウント作成完了！ " + acc.name + " で開始します");
      setTimeout(() => location.reload(), 900);
      return;
    }
    $("v4Welcome")?.classList.add("hide");
    document.body.classList.remove("v4-welcome-open");
  });
  // ログアウト
  const logoutBtn = $("v4LogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (!confirm("ログアウトしますか？\n記録はアカウントごとに保存されています。")) return;
      logoutAccount();
    });
  }
  // 休憩ゲーム
  document.querySelectorAll("[data-rg]").forEach(btn => {
    btn.addEventListener("click", () => rgOpenGame(btn.dataset.rg));
  });
  $("rgBackBtn")?.addEventListener("click", () => {
    rgClearTimers();
    rg.phase = "idle";
    rg.game = null;
    rgShowSelect(true);
    rgRenderLobby();
  });
  $("rgStartBtn")?.addEventListener("click", rgStart);
  $("rgActionBtn")?.addEventListener("click", rgAction);
  $("rgStage")?.addEventListener("click", rgAction);
  const holdBtn = $("rgActionBtn");
  if (holdBtn) {
    holdBtn.addEventListener("mousedown", rgHoldDown);
    holdBtn.addEventListener("mouseup", rgHoldUp);
    holdBtn.addEventListener("mouseleave", () => { if (rg.game === "hold" && rg.phase === "play") rgHoldUp(); });
    holdBtn.addEventListener("touchstart", e => { e.preventDefault(); rgHoldDown(); }, { passive: false });
    holdBtn.addEventListener("touchend", e => { e.preventDefault(); rgHoldUp(); }, { passive: false });
  }
  rgRenderLobby();
  $("v4AddQuote")?.addEventListener("click",()=>{const q=$("v4QuoteInput").value.trim();if(!q)return toast("メッセージを入力してください");v4.customQuotes.push(q);saveV4();$("v4QuoteInput").value="";v4RenderQuotes();toast("応援メッセージを追加しました");});
  $("v4SaveName").addEventListener("click",()=>{const n=$("v4NameInput").value.trim();if(!n)return toast("名前を入力してください");v4.name=n;saveV4();v4Refresh();toast("プレイヤー名を変更しました");});
  $("v4SaveWeight").addEventListener("click",()=>{const w=Number($("v4WeightInput").value);if(!Number.isFinite(w)||w<1||w>500)return toast("体重を正しく入力してください");v4.weightLogs.push({date:dateKey(),weight:w,memo:$("v4WeightMemo").value.trim()});saveV4();$("v4WeightInput").value="";$("v4WeightMemo").value="";v4Refresh();toast("体重を記録しました");});
  $("v4WeightRange").addEventListener("change",v4RenderWeight);
  $("v4Fatigue").addEventListener("input",e=>$("v4FatigueLabel").textContent=e.target.value+" / 10");
  $("v4AutoStart").addEventListener("click",()=>{const items=v4MakeAutoItems();if(!items.length)return toast("対象の種目がありません。種目管理で登録してください");v4StartAuto(items);});
  $("v4AutoPause").addEventListener("click",()=>{v4Auto.paused=!v4Auto.paused;$("v4AutoPause").textContent=v4Auto.paused?"再開":"一時停止";});
  $("v4AutoSkip").addEventListener("click",()=>{if(!v4Auto.items.length)return;clearInterval(v4Auto.interval);v4Auto.index++;v4RunAutoStep();});
  $("v4AutoStop").addEventListener("click",()=>{v4StopAuto(true);v4Auto.items=[];});
  $("v4MissionJoin")?.addEventListener("click",()=>{
    if(v4.missionDates.includes(dateKey()))return;
    const equip = $("v4MissionEquip")?.value || "both";
    let pool = appData.exercises.filter(e => {
      if (equip === "body") return e.type !== "weight";
      if (equip === "equipment") return e.type === "weight";
      return true;
    });
    if (!pool.length) pool = appData.exercises.slice();
    if (!pool.length) return toast("種目が登録されていません");
    const e = pool[Math.floor(Math.random() * pool.length)];
    const sets = 2 + Math.floor(Math.random() * 2);
    const reps = e.type === "time" ? 30 : (8 + Math.floor(Math.random() * 5));
    $("v4MissionStatus").textContent = `実施中：${e.name} × ${sets}セット（目安${reps}${e.type==="time"?"秒":"回"}）`;
    $("v4MissionCompleteBtn") && ($("v4MissionCompleteBtn").hidden = false);
    toast(`${e.name} を ${sets}セット行いましょう`);
  });
  $("v4MissionCompleteBtn")?.addEventListener("click", () => {
    if (v4.missionDates.includes(dateKey())) return toast("本日は既に達成済みです");
    v4CompleteMission();
    if ($("v4MissionCompleteBtn")) $("v4MissionCompleteBtn").hidden = true;
  });
  $("v4MissionSkip")?.addEventListener("click",()=>{
    if(v4.missionDates.includes(dateKey())||v4.missionHistory.some(x=>x.date===dateKey()&&x.skipped))return;
    v4.missionHistory.push({date:dateKey(),skipped:true});
    saveV4();
    v4RenderMissions();
  });
  document.querySelectorAll(".combat-course-btn").forEach(btn=>{
    btn.addEventListener("click",()=>v4ShowCombatCourse(btn.dataset.course));
  });
  $("combatBackBtn")?.addEventListener("click",()=>{
    show("combatDetailCard", false);
    const sel=$("combatCourseSelect");
    if(sel) sel.hidden=false;
  });
  $("v4CombatComplete")?.addEventListener("click",()=>{
    if(!v4CurrentCourse) return toast("コースを選択してください");
    const key="v4_course_done_"+v4CurrentCourse+"_"+dateKey();
    if(localStorage.getItem(key)==="1"){
      toast("このコースは本日すでに完了しています。明日また挑戦できます。");
      return;
    }
    localStorage.setItem(key,"1");
    v4ShowCombatCourse(v4CurrentCourse);
    showMissionToast("コース完了！ +10 PT");
    v4.missionHistory.push({date:dateKey(),done:true,course:v4CurrentCourse});
    saveV4();
    v4Refresh();
    toast("コース完了！お疲れさまでした");
    playBeep(880,0.2);
  });
  $("gcSaveBtn")?.addEventListener("click", () => {
    const name = $("gcName")?.value.trim();
    const exerciseId = $("gcExercise")?.value;
    const exercise = appData.exercises.find(e => e.id === exerciseId);
    const sets = Math.max(1, numberValue("gcSets", 3));
    const reps = Math.max(1, numberValue("gcReps", 10));
    if (!name) return toast("ゴースト名を入力してください");
    if (!exercise) return toast("種目を選択してください");
    if (!appData.ghosts) appData.ghosts = [];
    appData.ghosts.push({
      id: makeId(),
      name,
      exerciseId: exercise.id,
      exercise: exercise.name,
      sets,
      reps,
      memo: $("gcMemo")?.value.trim() || "",
      createdAt: Date.now()
    });
    saveData();
    if ($("gcName")) $("gcName").value = "";
    if ($("gcMemo")) $("gcMemo").value = "";
    v4RenderGhostOptions();
    toast("ゴーストを保存しました");
    playBeep(700, 0.15);
  });

  $("v4GhostStart")?.addEventListener("click", () => {
    const id = $("v4GhostSelect")?.value;
    const g = (appData.ghosts || []).find(x => x.id === id);
    if (!g) return toast("ゴーストを選択（または作成）してください");
    const battle = $("v4GhostBattle");
    const result = $("v4GhostResult");
    if (battle) battle.hidden = false;
    if (result) result.hidden = true;
    if ($("v4GhostBattleInfo")) {
      $("v4GhostBattleInfo").textContent =
        `対戦相手：${g.name} ／ ${g.exercise}  ${g.sets}セット × ${g.reps}`;
    }
    notifySound("ゴーストマッチ開始");
    toast("限界まで挑戦しよう！");
  });

  $("v4GhostEndBtn")?.addEventListener("click", () => {
    const battle = $("v4GhostBattle");
    const result = $("v4GhostResult");
    if (battle) battle.hidden = true;
    if (result) {
      result.hidden = false;
      result.innerHTML = `
        <div class="ghost-finish-anim">
          <h2>お疲れ様でした！</h2>
          <p class="badge">+10 PT</p>
          <p class="help-text">ゴーストマッチ完了。また挑戦しよう。</p>
        </div>`;
    }
    // +10 points via mission-like history entry
    v4.missionHistory.push({ date: dateKey(), done: true, ghost: true });
    saveV4();
    v4Refresh();
    showMissionToast("ゴーストマッチ完了！ +10 PT");
    playBeep(880, 0.2);
  });
}
function v4RenderQuotes(){
  const box=$("v4QuoteList");if(!box)return;
  box.innerHTML=(v4.customQuotes||[]).map((q,i)=>`<div class="row v4-list-row"><span>${v4Esc(q)}</span><button data-v4-delquote="${i}">削除</button></div>`).join("")||"追加したメッセージはありません。";
  box.querySelectorAll("[data-v4-delquote]").forEach(b=>b.addEventListener("click",()=>{v4.customQuotes.splice(Number(b.dataset.v4Delquote),1);saveV4();v4RenderQuotes();}));
}
const CORE_COURSES = {
  spiderman: {
    title: "スパイダーマンコース",
    desc: "爆発的なジャンプ・押し出し・片脚の着地力を鍛えるショートコース。",
    tasks: [
      { name: "バーピー・ジャンプ × 10回", detail: "ジャンプ時に膝を胸に引きつける。" },
      { name: "クラップ・プッシュアップ × 10回", detail: "地面を爆発的に押し、空中で拍手。" },
      { name: "ピストルスクワット × 左右各5回", detail: "片脚スクワット。安定した着地を意識。" }
    ]
  },
  polarbear: {
    title: "白熊コース",
    desc: "体幹の持久と、壁を使った押し出し・重心コントロール。",
    tasks: [
      { name: "仰向けプランク 60秒〜限界", detail: "最低60秒。余裕があれば限界まで。" },
      { name: "壁腕立て伏せ × 20回", detail: "深く沈み込み、爆発的に戻す。" },
      { name: "ホールド歩行 30秒", detail: "重心を限界まで下げ、頭の高さを変えずに前後に歩く。" }
    ]
  },
  bakumote: {
    title: "瀑モテコース",
    desc: "臀筋・上半身のスロー制御から、サーキット・心肺までを段階的に行う実践コース。",
    tasks: [
      { name: "A1：シングルレッグ・ヒップリフト（左右各15回）", detail: "仰向けで片膝を立て、もう片方の足を浮かせてお尻を高く突き上げる。トップで2秒キープ。" },
      { name: "A2：超スロー・プッシュアップ（15回）", detail: "5秒かけて下がり、5秒かけて上がる。大胸筋と三頭筋をじっくり効かせる。" },
      { name: "【実戦2】絶倫サーキット（約20分）", detail: "B1〜B3を休憩なしで3セット。セット間休憩45秒。" },
      { name: "B1：ワイドスタンス・深層スクワット × 25回", detail: "足を大きく開き、つま先を外に向けて限界まで深くしゃがむ。" },
      { name: "B2：プランク・ヒップツイスト 45秒", detail: "プランク姿勢からお尻を左右交互に床ギリギリまで振る。体幹の軸を保つ。" },
      { name: "B3：ヒップスラスト（加重可）× 20回", detail: "椅子に背中を預け、負荷をお腹〜股関節付近に乗せて腰を爆発的に突き上げる。" },
      { name: "【実戦3】エンドレス・ナイト（10分 AMRAP）", detail: "10分間ノンストップ。「ジャンピングスクワット15回 ＋ クランチ20回」を繰り返す。" }
    ]
  }
};
let v4CurrentCourse = null;

function v4ShowCombatCourse(id) {
  const course = CORE_COURSES[id];
  if (!course) return;
  v4CurrentCourse = id;
  const sel = $("combatCourseSelect");
  if (sel) sel.hidden = true;
  show("combatDetailCard", true);
  setText("v4CombatTitle", course.title);
  setText("v4CombatDesc", course.desc);
  const box = $("v4CombatTasks");
  if (box) {
    box.innerHTML = course.tasks.map((t, i) =>
      `<div class="combat-task-item">
        <div class="step-number">${String(i + 1).padStart(2, "0")}</div>
        <div><b>${v4Esc(t.name)}</b><small>${v4Esc(t.detail)}</small></div>
      </div>`
    ).join("");
  }
  const doneToday = localStorage.getItem("v4_course_done_" + id + "_" + dateKey()) === "1";
  const btn = $("v4CombatComplete");
  if (btn) {
    btn.textContent = doneToday ? "本日完了済み" : "このコースを完了";
    btn.disabled = doneToday;
  }
  setText("v4CombatDoneNote", doneToday ? "このコースは本日完了済みです。明日また挑戦できます。" : "完了は1日1回までです。");
}

function v4RenderCombat(){
  // 一覧表示に戻す（初期化用）
  v4CurrentCourse = null;
  const sel = $("combatCourseSelect");
  if (sel) sel.hidden = false;
  show("combatDetailCard", false);
}
function v4Initialize(){
  if(!getCurrentAccountId()){
    // 未連携時はウェルカムを強制表示
    const w = $("v4Welcome");
    if (w) {
      w.classList.remove("hide");
      document.body.classList.add("v4-welcome-open");
    }
    v4Bind();
    return;
  }
  if(!v4.name) v4.name = "player";
  if(!Array.isArray(v4.weightLogs))v4.weightLogs=[];
  if(!Array.isArray(v4.missionDates))v4.missionDates=[];
  if(!Array.isArray(v4.missionHistory))v4.missionHistory=[];
  v4Bind();v4Refresh();v4RenderCombat();v4RenderQuotes();v4RenderGhostOptions();
  const w = $("v4Welcome");
  if (w && !w.classList.contains("hide")) document.body.classList.add("v4-welcome-open");
}


const v4OriginalGoPage=goPage;
goPage=function(page){
  v4OriginalGoPage(page);
  if (page === "combat") v4RenderCombat();
};

if (document.readyState==="loading") {
  document.addEventListener("DOMContentLoaded",initVaXCore);
} else {
  initVaXCore();
}