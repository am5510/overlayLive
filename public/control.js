const CHANNEL =
  document.body?.dataset?.channel ||
  (window.location.pathname.includes("2") ? "2" : "1");
const socket = io({ query: { channel: CHANNEL } });
let state = {
  visible: true,
  theme: "cyan",
  name: "",
  role: "",
  profiles: [],
  activeProfile: 1,
  cornerLogo: "logo1",
  customLogo: "",
  customLogoName: "",
  organizationName: "LIVE STUDIO",
  organizationRole: "BROADCAST UNIT",
  organizationLogo: "",
  organizationLogoName: "",
};
const $ = (id) => document.getElementById(id);
let pendingLogoData = "";
let pendingLogoName = "";
let pendingOrgLogoData = "";
let pendingOrgLogoName = "";
let pendingProfileOrgLogoData = "";
let pendingProfileOrgLogoName = "";
let pendingProjectLogoData = "";
let pendingProjectLogoName = "";
let editingProfileId = null;
let editingProjectId = null;
function people() {
  $("profiles").innerHTML = state.profiles
    .map(
      (p) =>
        `<div class="person ${!state.visible ? "inactive" : state.activeMode !== "project" && p.id === state.activeProfile ? "active" : ""}" data-id="${p.id}">
           <div class="person-content" style="flex: 1; cursor: pointer; overflow: hidden;">
             <span class="person-text"><strong>${p.name}</strong><small>${p.role}</small></span>
           </div>
           <button class="edit-person-btn" data-id="${p.id}" aria-label="Edit Profile">...</button>
         </div>`,
    )
    .join("");
  document.querySelectorAll(".person-content").forEach(
    (b) =>
      (b.onclick = () => {
        const personDiv = b.closest(".person");
        const profileId = Number(personDiv.dataset.id);
        const sameProfile = state.activeMode !== "project" && profileId === state.activeProfile;
        if (sameProfile) {
          state = { ...state, visible: !state.visible, updatedAt: Date.now() };
          socket.emit("overlay:update", { visible: state.visible });
          paint(state);
          return;
        }
        const profile = state.profiles.find((p) => p.id === profileId);
        if (!profile) return;
        state = {
          ...state,
          ...profile,
          organizationLogo: profile.organization_logo ?? state.organizationLogo,
          activeProfile: profile.id,
          activeMode: "profile",
          visible: true,
          updatedAt: Date.now(),
        };
        socket.emit("overlay:update", {
          ...state,
          organizationLogo: profile.organization_logo ?? state.organizationLogo,
        });
        paint(state);
      }),
  );
  document.querySelectorAll("#profiles .edit-person-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openProfileModal(Number(btn.dataset.id));
    };
  });
}
function openProfileModal(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return;
  editingProfileId = profileId;
  const modal = $("profileModal");
  if (modal) modal.classList.remove("hidden");
  const nameInput = $("name");
  if (nameInput) nameInput.value = profile.name;
  const roleInput = $("role");
  if (roleInput) roleInput.value = profile.role;
  const status = $("saveStatus");
  if (status) status.textContent = "";
  
  const logoInput = $("profileOrgLogoInput");
  if (logoInput) logoInput.value = "";
  const preview = $("profileOrgLogoPreview");
  if (preview) preview.style.display = "none";
  pendingProfileOrgLogoData = "";
  pendingProfileOrgLogoName = "";
}

function closeProfileModal() {
  const modal = $("profileModal");
  if (modal) modal.classList.add("hidden");
  editingProfileId = null;
  pendingProfileOrgLogoData = "";
  pendingProfileOrgLogoName = "";
}
function renderProjects() {
  if (!state.projects) return;
  $("projects").innerHTML = state.projects
    .map(
      (p) =>
        `<div class="project ${!state.visible ? "inactive" : state.activeMode === "project" && p.id === state.activeProject ? "active" : ""}" data-id="${p.id}">
           <div class="project-content" style="flex: 1; min-width: 0; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;">
             ${p.logo ? `<img src="${p.logo}" alt="" style="width: 24px; height: 24px; object-fit: contain; border-radius: 4px; flex-shrink: 0;" />` : ""}
             <strong>${p.name}</strong>
           </div>
           <button class="edit-person-btn edit-project-btn" data-id="${p.id}" aria-label="Edit Project">⋯</button>
         </div>`,
    )
    .join("");
  document.querySelectorAll(".project-content").forEach(
    (b) =>
      (b.onclick = () => {
        const projectDiv = b.closest(".project");
        const projectId = Number(projectDiv.dataset.id);
        const sameProject = state.activeMode === "project" && projectId === state.activeProject;
        if (sameProject) {
          state = { ...state, visible: !state.visible, updatedAt: Date.now() };
          socket.emit("overlay:update", { visible: state.visible });
          paint(state);
          return;
        }
        const project = state.projects.find((p) => p.id === projectId);
        if (!project) return;
        state = {
          ...state,
          name: project.name,
          role: "",
          organizationLogo: project.logo || state.organizationLogo || "",
          activeProject: project.id,
          activeMode: "project",
          visible: true,
          updatedAt: Date.now(),
        };
        socket.emit("overlay:selectProject", projectId);
        socket.emit("overlay:trigger", { type: "replay" });
        paint(state);
        replayPreview();
      }),
  );
  document.querySelectorAll(".edit-project-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const projectId = Number(btn.dataset.id);
      openProjectModal(projectId);
    };
  });
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function openProjectModal(projectId) {
  const project = state.projects?.find((p) => p.id === projectId);
  if (!project) return;
  editingProjectId = projectId;
  const modal = $("projectModal");
  if (modal) modal.classList.remove("hidden");
  const nameInput = $("projectNameInput");
  if (nameInput) {
    nameInput.value = project.name;
    setTimeout(() => autoResizeTextarea(nameInput), 0);
  }
  const status = $("projectSaveStatus");
  if (status) status.textContent = "";
  const logoInput = $("projectLogoInput");
  if (logoInput) logoInput.value = "";
  const preview = $("projectLogoPreview");
  if (preview) {
    if (project.logo) {
      preview.src = project.logo;
      preview.style.display = "block";
    } else {
      preview.removeAttribute("src");
      preview.style.display = "none";
    }
  }
  pendingProjectLogoData = "";
  pendingProjectLogoName = "";
}

function closeProjectModal() {
  const modal = $("projectModal");
  if (modal) modal.classList.add("hidden");
  editingProjectId = null;
  pendingProjectLogoData = "";
  pendingProjectLogoName = "";
}

function renderCornerLogos() {
  document.querySelectorAll(".logo").forEach((button) => {
    const active = state.cornerLogo !== "none";
    button.classList.toggle("active", active);
    if (state.customLogo) {
      button.innerHTML = `<img src="${state.customLogo}" alt="logo1" style="max-width:100%;max-height:100%;object-fit:contain;" />`;
    } else {
      button.textContent = button.dataset.logo || "logo1";
    }
  });
}
function applyStageScale() {
  const stage = document.querySelector(".preview") || document.body;
  const rect = stage.getBoundingClientRect();
  const scale = Math.min(rect.width / 1920, rect.height / 1080) || 1;
  document.documentElement.style.setProperty("--stage-scale", scale.toFixed(4));
}
function openLogoModal() {
  const modal = $("logoModal");
  if (modal) modal.classList.remove("hidden");
  const preview = $("logoPreview");
  if (preview && state.customLogo) {
    preview.src = state.customLogo;
    preview.style.display = "block";
  }
}
function closeLogoModal() {
  const modal = $("logoModal");
  if (modal) modal.classList.add("hidden");
  const input = $("logoUploadInput");
  if (input) input.value = "";
  pendingLogoData = "";
  pendingLogoName = "";
  const preview = $("logoPreview");
  if (preview) {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
}
function openOrganizationModal() {
  const modal = $("organizationModal");
  if (modal) modal.classList.remove("hidden");
}
function closeOrganizationModal() {
  const modal = $("organizationModal");
  if (modal) modal.classList.add("hidden");
  const nameInput = $("organizationNameInput");
  if (nameInput) nameInput.value = state.organizationName || "LIVE STUDIO";
  const roleInput = $("organizationRoleInput");
  if (roleInput) roleInput.value = state.organizationRole || "BROADCAST UNIT";
  const input = $("organizationLogoInput");
  if (input) input.value = "";
  pendingOrgLogoData = "";
  pendingOrgLogoName = "";
  const preview = $("orgLogoPreview");
  if (preview) {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
}
function replayPreview() {
  const el = $("previewThird");
  if (!el) return;
  el.classList.remove("replay");
  void el.offsetWidth;
  el.classList.add("replay");
  setTimeout(() => el.classList.remove("replay"), 1620);
}
function paint(s) {
  state = { ...state, ...s };
  $("pname").textContent = state.name;
  $("prole").textContent = state.role;
  const orgName = $("orgName");
  if (orgName) orgName.textContent = state.organizationName || "LIVE STUDIO";
  const orgRole = $("orgRole");
  if (orgRole) orgRole.textContent = state.organizationRole || "BROADCAST UNIT";
  const orgLogo = $("orgLogo");
  if (orgLogo) {
    if (state.organizationLogo) {
      orgLogo.src = state.organizationLogo;
      orgLogo.style.display = "block";
    } else {
      orgLogo.removeAttribute("src");
      orgLogo.style.display = "none";
    }
  }
  const previewCornerLogo = $("previewCornerLogo");
  const previewCornerLogoImage = $("previewCornerLogoImage");
  if (previewCornerLogo && previewCornerLogoImage) {
    if (state.customLogo) {
      previewCornerLogoImage.src = state.customLogo;
      previewCornerLogoImage.style.display = "block";
    }
    previewCornerLogo.classList.toggle(
      "hidden",
      state.cornerLogo === "none" || !state.customLogo,
    );
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        previewCornerLogo.style.transition = "";
      }),
    );
  }
  const themeInput = $("theme");
  if (themeInput) themeInput.value = state.theme;
  const previewThird = $("previewThird");
  if (previewThird) {
    previewThird.classList.toggle("hidden", !state.visible);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        previewThird.classList.remove("no-transition");
      }),
    );
  }
  const defaultAccent =
    state.theme === "pink"
      ? "#ff4ca0"
      : state.theme === "lime"
        ? "#b9ff70"
        : "#42e8e0";
  const orgBlockColor = state.orgBlockColor || "#dce5fc";
  const accentColor = state.accentColor || defaultAccent;
  const contentColor = state.contentColor || "#1b2238";

  document.documentElement.style.setProperty("--org-bg", orgBlockColor);
  document.documentElement.style.setProperty("--cyan", accentColor);
  document.documentElement.style.setProperty("--content-bg", contentColor);

  const orgPicker = $("orgBlockColorPicker");
  const orgDot = $("orgBlockColorDot");
  if (orgPicker) orgPicker.value = orgBlockColor;
  if (orgDot) orgDot.style.background = orgBlockColor;

  const accentPicker = $("accentColorPicker");
  const accentDot = $("accentColorDot");
  if (accentPicker) accentPicker.value = accentColor;
  if (accentDot) accentDot.style.background = accentColor;

  const contentPicker = $("contentColorPicker");
  const contentDot = $("contentColorDot");
  if (contentPicker) contentPicker.value = contentColor;
  if (contentDot) contentDot.style.background = contentColor;

  const liveOn = state.liveEnabled !== false;
  const liveToggleBtn = $("liveToggleBtn");
  const liveToggleLabel = $("liveToggleLabel");
  if (liveToggleBtn) {
    liveToggleBtn.classList.toggle("on", liveOn);
    liveToggleBtn.classList.toggle("off", !liveOn);
    liveToggleBtn.setAttribute("aria-pressed", String(liveOn));
  }
  if (liveToggleLabel) {
    liveToggleLabel.textContent = liveOn ? "ON" : "OFF";
  }

  const previewQaOverlay = $("previewQaOverlay");
  const previewQaText = $("previewQaText");
  if (previewQaOverlay && previewQaText) {
    const isQaVisible = state.qaVisible !== false && state.activeQa != null;
    previewQaOverlay.classList.toggle("hidden", !isQaVisible);
    
    if (state.qaList && state.activeQa) {
      const q = state.qaList.find((item) => item.id === state.activeQa);
      if (q) {
        previewQaText.textContent = q.question;
      }
    }
    
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        previewQaOverlay.classList.remove("no-transition");
      })
    );
  }

  document.querySelectorAll(".qa-btn").forEach((btn) => {
    btn.classList.toggle("active", state.qaVisible !== false && Number(btn.dataset.id) === state.activeQa);
  });
  renderCornerLogos();
  renderProjects();
  people();
  renderTimerUI();
  applyStageScale();
}
$("liveToggleBtn")?.addEventListener("click", () => {
  const nextLiveEnabled = state.liveEnabled === false;
  state = { ...state, liveEnabled: nextLiveEnabled, updatedAt: Date.now() };
  socket.emit("overlay:update", { liveEnabled: nextLiveEnabled });
  paint(state);
});
[
  ["orgBlockColorPicker", "orgBlockColor"],
  ["accentColorPicker", "accentColor"],
  ["contentColorPicker", "contentColor"],
].forEach(([pickerId, stateKey]) => {
  const picker = $(pickerId);
  if (picker) {
    picker.addEventListener("input", (e) => {
      const val = e.target.value;
      state = { ...state, [stateKey]: val, updatedAt: Date.now() };
      socket.emit("overlay:update", { [stateKey]: val });
      paint(state);
    });
  }
});
document.querySelectorAll(".logo").forEach(
  (button) =>
    (button.onclick = () => {
      const nextCornerLogo = state.cornerLogo === "none" ? (state.customLogo ? "custom" : button.dataset.logo) : "none";
      state = {
        ...state,
        cornerLogo: nextCornerLogo,
        updatedAt: Date.now(),
      };
      socket.emit("overlay:update", {
        cornerLogo: nextCornerLogo,
        customLogo: state.customLogo || "",
        customLogoName: state.customLogoName || "",
      });
      paint(state);
    }),
);
function showSave(result) {
  const label = $("saveStatus");
  if (!label) return;
  label.textContent = result.ok
    ? "✓ Saved to Supabase"
    : "Save failed: " + result.message;
  label.style.color = result.ok ? "#078b53" : "#d82741";
}
const saveProfile = () => {
  const button = $("saveProfile");
  if (!button || editingProfileId === null) return;
  const name = ($("name")?.value ?? "").trim();
  const role = ($("role")?.value ?? "").trim();
  if (!name || !role) {
    showSave({ ok: false, message: "Name and role are required" });
    return;
  }
  button.disabled = true;
  button.textContent = "SAVING…";
  socket.emit(
    "overlay:saveProfile",
    { 
      id: editingProfileId, 
      name, 
      role, 
      organizationLogo: pendingProfileOrgLogoData || undefined 
    },
    (result) => {
      button.disabled = false;
      button.textContent = "Save Profile";
      showSave(result);
      if (result.ok) {
        state = {
          ...state,
          profiles: state.profiles.map((profile) =>
            profile.id === editingProfileId
              ? { ...profile, name, role, organization_logo: pendingProfileOrgLogoData || profile.organization_logo }
              : profile,
          ),
          updatedAt: Date.now(),
        };
        // If updating the active profile, also update state.name/role
        if (state.activeProfile === editingProfileId) {
          state.name = name;
          state.role = role;
        }
        
        pendingProfileOrgLogoData = "";
        pendingProfileOrgLogoName = "";

        paint(state);
        setTimeout(closeProfileModal, 1000);
      }
    },
  );
};
window.addEventListener("resize", applyStageScale);
applyStageScale();
$("openLogoUpload")?.addEventListener("click", openLogoModal);
$("closeLogoModal")?.addEventListener("click", closeLogoModal);
$("cancelLogoUpload")?.addEventListener("click", closeLogoModal);
$("organizationMenuButton")?.addEventListener("click", openOrganizationModal);
$("closeOrganizationModal")?.addEventListener("click", closeOrganizationModal);
$("cancelOrganizationChanges")?.addEventListener(
  "click",
  closeOrganizationModal,
);
$("closeProfileModal")?.addEventListener("click", closeProfileModal);
$("cancelProfileChanges")?.addEventListener("click", closeProfileModal);
$("closeProjectModal")?.addEventListener("click", closeProjectModal);
$("cancelProjectChanges")?.addEventListener("click", closeProjectModal);

function showProjectSave(result) {
  const label = $("projectSaveStatus");
  if (!label) return;
  label.textContent = result.ok
    ? "✓ Saved"
    : "Save failed: " + result.message;
  label.style.color = result.ok ? "#078b53" : "#d82741";
}

const saveProject = () => {
  const button = $("saveProject");
  if (!button || editingProjectId === null) return;
  const name = ($("projectNameInput")?.value ?? "").trim();
  if (!name) {
    showProjectSave({ ok: false, message: "Project name is required" });
    return;
  }
  button.disabled = true;
  button.textContent = "SAVING…";
  socket.emit(
    "overlay:saveProject",
    {
      id: editingProjectId,
      name,
      logo: pendingProjectLogoData || undefined,
    },
    (result) => {
      button.disabled = false;
      button.textContent = "Save Project";
      showProjectSave(result);
      if (result.ok) {
        const updatedLogo = pendingProjectLogoData || state.projects.find((p) => p.id === editingProjectId)?.logo;
        state = {
          ...state,
          projects: state.projects.map((proj) =>
            proj.id === editingProjectId
              ? { ...proj, name, logo: updatedLogo }
              : proj,
          ),
          ...(state.activeMode === "project" && state.activeProject === editingProjectId
            ? { name, role: "", ...(updatedLogo ? { organizationLogo: updatedLogo } : {}) }
            : {}),
          updatedAt: Date.now(),
        };
        pendingProjectLogoData = "";
        pendingProjectLogoName = "";
        paint(state);
        setTimeout(closeProjectModal, 800);
      }
    },
  );
};
const saveProjectButton = $("saveProject");
if (saveProjectButton) {
  saveProjectButton.onclick = saveProject;
}
$("projectNameInput")?.addEventListener("input", (event) => {
  autoResizeTextarea(event.target);
});
$("projectLogoInput")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showProjectSave({ ok: false, message: "Please select an image file" });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingProjectLogoData = String(reader.result);
    pendingProjectLogoName = file.name;
    const preview = $("projectLogoPreview");
    if (preview) {
      preview.src = pendingProjectLogoData;
      preview.style.display = "block";
    }
  };
  reader.readAsDataURL(file);
});
$("logoUploadInput")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showSave({ ok: false, message: "Please select an image file" });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingLogoData = String(reader.result);
    pendingLogoName = file.name;
    const preview = $("logoPreview");
    if (preview) {
      preview.src = pendingLogoData;
      preview.style.display = "block";
    }
  };
  reader.readAsDataURL(file);
});
$("profileOrgLogoInput")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showSave({ ok: false, message: "Please select an image file" });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingProfileOrgLogoData = String(reader.result);
    pendingProfileOrgLogoName = file.name;
    const preview = $("profileOrgLogoPreview");
    if (preview) {
      preview.src = pendingProfileOrgLogoData;
      preview.style.display = "block";
    }
  };
  reader.readAsDataURL(file);
});
$("organizationLogoInput")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showSave({ ok: false, message: "Please select an image file" });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingOrgLogoData = String(reader.result);
    pendingOrgLogoName = file.name;
    const preview = $("orgLogoPreview");
    if (preview) {
      preview.src = pendingOrgLogoData;
      preview.style.display = "block";
    }
  };
  reader.readAsDataURL(file);
});
$("applyLogoUpload")?.addEventListener("click", () => {
  if (!pendingLogoData) {
    showSave({ ok: false, message: "Please choose an image first" });
    return;
  }
  state = {
    ...state,
    cornerLogo: "custom",
    customLogo: pendingLogoData,
    customLogoName: pendingLogoName,
    updatedAt: Date.now(),
  };
  socket.emit("overlay:update", {
    cornerLogo: "custom",
    customLogo: pendingLogoData,
    customLogoName: pendingLogoName,
  });
  paint(state);
  closeLogoModal();
});
$("applyOrganizationChanges")?.addEventListener("click", () => {
  const name =
    ($("organizationNameInput")?.value ?? "").trim() || "LIVE STUDIO";
  const role =
    ($("organizationRoleInput")?.value ?? "").trim() || "BROADCAST UNIT";
  const payload = {
    organizationName: name,
    organizationRole: role,
    organizationLogo: pendingOrgLogoData || state.organizationLogo || "",
    organizationLogoName:
      pendingOrgLogoName || state.organizationLogoName || "",
    updatedAt: Date.now(),
  };
  state = { ...state, ...payload };
  socket.emit("overlay:update", payload);
  paint(state);
  closeOrganizationModal();
});
socket.on("overlay:state", paint);
const saveButton = $("saveProfile");
if (saveButton) {
  saveButton.onclick = saveProfile;
}
const themeSelect = $("theme");
if (themeSelect)
  themeSelect.onchange = (e) =>
    socket.emit("overlay:update", { theme: e.target.value });

const RING_CIRC = 779.115;
const VALID_TIMER_POSITIONS = [
  "top-left",
  "bottom-left",
  "center",
  "top-right",
  "bottom-right",
];

function getTimerState() {
  const t = state.timer || {};
  const pos = VALID_TIMER_POSITIONS.includes(t.position)
    ? t.position
    : "center";
  return {
    visible: Boolean(t.visible),
    mode: ["stopwatch", "countdown", "clock"].includes(t.mode) ? t.mode : "countdown",
    clockType: t.clockType === "digital" ? "digital" : "analog",
    position: pos,
    showBg: t.showBg !== undefined ? Boolean(t.showBg) : true,
    durationSec: Math.max(1, Number(t.durationSec) || 600),
    baseSec:
      t.baseSec !== undefined && t.baseSec !== null
        ? Math.max(0, Number(t.baseSec))
        : Math.max(1, Number(t.durationSec) || 600),
    running: Boolean(t.running),
    startedAt: t.startedAt ? Number(t.startedAt) : null,
  };
}

function computeCurrentTimerSeconds(t) {
  const deltaSec =
    t.running && t.startedAt ? Math.max(0, (Date.now() - t.startedAt) / 1000) : 0;
  if (t.mode === "stopwatch") {
    return Math.max(0, t.baseSec + deltaSec);
  }
  return Math.max(0, t.baseSec - deltaSec);
}

function updateTimerState(patch) {
  const nextTimer = { ...getTimerState(), ...patch };
  state = { ...state, timer: nextTimer, updatedAt: Date.now() };
  socket.emit("overlay:update", { timer: nextTimer });
  paint(state);
}

function renderTimerUI() {
  const t = getTimerState();
  const previewTimer = $("previewTimerOverlay");
  const previewRing = $("previewTimerRingProgress");
  const previewDigits = $("previewTimerDigits");
  const previewSublabel = $("previewTimerSublabel");
  const previewStatusBadge = $("previewTimerStatusBadge");

  const currentSec = computeCurrentTimerSeconds(t);
  let displaySec = 0;
  let progress = 1;
  let finished = false;

  if (t.mode === "stopwatch") {
    displaySec = Math.floor(currentSec);
    progress = currentSec === 0 ? 0 : (currentSec % 60) / 60;
    if (previewSublabel) previewSublabel.textContent = "ELAPSED";
  } else {
    displaySec = t.running ? Math.ceil(currentSec) : Math.round(currentSec);
    progress = Math.max(0, Math.min(1, currentSec / t.durationSec));
    finished = currentSec <= 0;
    if (previewSublabel) previewSublabel.textContent = "REMAINING";
  }

  
  let formatted = "";
  if (t.mode === "clock") {
    const d = new Date();
    formatted = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } else {
    const mins = Math.floor(displaySec / 60);
    const secs = displaySec % 60;
    formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }


  if (previewDigits) {
    if (t.mode === "clock" && t.clockType === "digital") {
      const d = new Date();
      previewDigits.innerHTML = `<div class="flip-block">${String(d.getHours()).padStart(2, "0")}</div><div class="flip-block">${String(d.getMinutes()).padStart(2, "0")}</div>`;
    } else {
      previewDigits.textContent = formatted;
    }
  }
  const panelReadout = $("timerPanelReadout");
  if (panelReadout) {
    if (t.mode === "clock" && t.clockType === "digital") {
      const d = new Date();
      panelReadout.innerHTML = `<div class="timer-digits small-flip" style="display:flex; gap:6px; margin:0;"><div class="flip-block">${String(d.getHours()).padStart(2, "0")}</div><div class="flip-block">${String(d.getMinutes()).padStart(2, "0")}</div></div>`;
    } else {
      panelReadout.textContent = formatted;
    }
  }

  if (previewRing) {
    previewRing.style.strokeDashoffset = (RING_CIRC * (1 - progress)).toFixed(2);
  }

  const effectivelyRunning = Boolean(t.running && !finished);

  if (previewTimer) {
    if (previewTimer.dataset.pos !== t.position) {
      previewTimer.dataset.pos = t.position;
    }
    previewTimer.classList.toggle("has-bg", Boolean(t.showBg));
    previewTimer.classList.toggle("hidden", !t.visible);
    previewTimer.classList.toggle("finished", finished && t.mode !== "stopwatch");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        previewTimer.classList.remove("no-transition");
      }),
    );
  }

  document.querySelectorAll(".timer-pos-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pos === t.position);
  });

  const bgOn = Boolean(t.showBg);
  const bgToggleBtn = $("timerBgToggleBtn");
  const bgToggleLabel = $("timerBgToggleLabel");
  if (bgToggleBtn) {
    bgToggleBtn.classList.toggle("on", bgOn);
    bgToggleBtn.classList.toggle("off", !bgOn);
    bgToggleBtn.setAttribute("aria-pressed", String(bgOn));
  }
  if (bgToggleLabel) {
    bgToggleLabel.textContent = bgOn ? "ON" : "OFF";
  }

  if (previewStatusBadge) {
    const wantMode = effectivelyRunning ? "running" : "paused";
    if (previewStatusBadge.dataset.mode !== wantMode) {
      previewStatusBadge.dataset.mode = wantMode;
      previewStatusBadge.innerHTML = effectivelyRunning
        ? '<span class="timer-pause-bars"><span></span><span></span></span>'
        : '<span class="timer-play-triangle"></span>';
    }
  }

  const visibleBtn = $("timerVisibleBtn");
  if (visibleBtn) {
    visibleBtn.classList.toggle("active", t.visible);
    visibleBtn.textContent = "ON Air";
  }

  const modeCountdownBtn = $("timerModeCountdown");
  const modeStopwatchBtn = $("timerModeStopwatch");
  if (modeCountdownBtn)
    modeCountdownBtn.classList.toggle("active", t.mode === "countdown");
  if (modeStopwatchBtn)
    modeStopwatchBtn.classList.toggle("active", t.mode === "stopwatch");
  const modeClockBtn = $("timerModeClock");
  if (modeClockBtn) modeClockBtn.classList.toggle("active", t.mode === "clock");


    const countdownConfig = $("timerCountdownConfig");
  if (countdownConfig)
    countdownConfig.classList.toggle("hidden", t.mode === "stopwatch" || t.mode === "clock");

  const clockConfig = $("timerClockConfig");
  if (clockConfig)
    clockConfig.classList.toggle("hidden", t.mode !== "clock");

    const btnAnalog = $("clockTypeAnalog");
  const btnDigital = $("clockTypeDigital");
  if (btnAnalog && btnDigital) {
    btnAnalog.classList.toggle("active", t.clockType !== "digital");
    btnDigital.classList.toggle("active", t.clockType === "digital");
  }

  const previewAnalogClock = $("previewAnalogClock");
  if (previewAnalogClock) {
    const isAnalog = t.mode === "clock" && t.clockType !== "digital";
    previewAnalogClock.classList.toggle("hidden", !isAnalog);
    if (previewDigits) previewDigits.style.display = isAnalog ? "none" : "";
    if (previewSublabel) previewSublabel.style.display = isAnalog ? "none" : "";
    
    if (isAnalog) {
      const d = new Date();
      const hr = d.getHours() % 12;
      const min = d.getMinutes();
      const sec = d.getSeconds();
      const ms = d.getMilliseconds();
      const hrDeg = (hr + min / 60) * 30;
      const minDeg = (min + sec / 60) * 6;
      const secDeg = (sec + ms / 1000) * 6;
      
      const hHand = $("previewHourHand");
      const mHand = $("previewMinHand");
      const sHand = $("previewSecondHand");
      if (hHand) hHand.style.transform = `translateX(-50%) rotate(${hrDeg}deg)`;
      if (mHand) mHand.style.transform = `translateX(-50%) rotate(${minDeg}deg)`;
      if (sHand) sHand.style.transform = `translateX(-50%) rotate(${secDeg}deg)`;
    }
  }


  const startPauseBtn = $("timerStartPauseBtn");
  if (startPauseBtn) {
    startPauseBtn.classList.toggle("running", effectivelyRunning);
    startPauseBtn.innerHTML = effectivelyRunning ? `<span style="display: inline-block;">⏸</span>` : `<span style="display: inline-block; transform: translate(4px, 1px);">▶</span>`;
  }
  if (startPauseBtn) startPauseBtn.style.display = t.mode === "clock" ? "none" : "";
  const resetBtn = $("timerResetBtn");
  if (resetBtn) resetBtn.style.display = t.mode === "clock" ? "none" : "";
}

function toggleTimerStartPause() {
  const t = getTimerState();
  const currentSec = computeCurrentTimerSeconds(t);
  const finished = t.mode === "countdown" && currentSec <= 0;
  const effectivelyRunning = t.running && !finished;

  if (effectivelyRunning) {
    updateTimerState({
      baseSec: currentSec,
      running: false,
      startedAt: null,
    });
  } else {
    const nextBase =
      t.mode === "countdown" && currentSec <= 0 ? t.durationSec : currentSec;
    updateTimerState({
      baseSec: nextBase,
      running: true,
      startedAt: Date.now(),
    });
  }
}

$("timerVisibleBtn")?.addEventListener("click", () => {
  const t = getTimerState();
  updateTimerState({ visible: !t.visible });
});

$("timerModeCountdown")?.addEventListener("click", () => {
  const t = getTimerState();
  if (t.mode === "countdown") return;
  updateTimerState({
    mode: "countdown",
    baseSec: t.durationSec,
    running: false,
    startedAt: null,
  });
});

$("timerModeStopwatch")?.addEventListener("click", () => {
  const t = getTimerState();
  if (t.mode === "stopwatch") return;
  updateTimerState({
    mode: "stopwatch",
    baseSec: 0,
    running: false,
    startedAt: null,
  });
});

document.querySelectorAll(".timer-pos-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const pos = btn.dataset.pos;
    if (!VALID_TIMER_POSITIONS.includes(pos)) return;
    updateTimerState({ position: pos });
  });
});

$("timerBgToggleBtn")?.addEventListener("click", () => {
  const t = getTimerState();
  updateTimerState({ showBg: !t.showBg });
});

$("timerSetBtn")?.addEventListener("click", () => {
  const mins = Math.max(0, parseInt($("timerMinInput")?.value || "0", 10) || 0);
  const secs = Math.max(
    0,
    Math.min(59, parseInt($("timerSecInput")?.value || "0", 10) || 0),
  );
  const totalSec = Math.max(1, mins * 60 + secs);
  updateTimerState({
    mode: "countdown",
    durationSec: totalSec,
    baseSec: totalSec,
    running: false,
    startedAt: null,
  });
});

document.querySelectorAll(".timer-preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!btn.hasAttribute("data-sec")) return;
    const totalSec = Math.max(1, Number(btn.dataset.sec) || 300);
    const minInput = $("timerMinInput");
    const secInput = $("timerSecInput");
    if (minInput) minInput.value = String(Math.floor(totalSec / 60));
    if (secInput) secInput.value = String(totalSec % 60).padStart(2, "0");
    updateTimerState({
      mode: "countdown",
      durationSec: totalSec,
      baseSec: totalSec,
      running: false,
      startedAt: null,
    });
  });
});

$("timerStartPauseBtn")?.addEventListener("click", toggleTimerStartPause);
$("previewTimerStatusBadge")?.addEventListener("click", toggleTimerStartPause);

$("timerResetBtn")?.addEventListener("click", () => {
  const t = getTimerState();
  updateTimerState({
    baseSec: t.mode === "stopwatch" ? 0 : t.durationSec,
    running: false,
    startedAt: null,
  });
});

setInterval(renderTimerUI, 100);
setInterval(() => {
  fetch("/ping").catch(() => {});
}, 240000);


document.querySelectorAll('.clock-face').forEach(function(face) { 
  if(face.querySelector('.clock-number')) return; 
  for(var i=1; i<=12; i++) { 
    var n = document.createElement('div'); 
    n.className = 'clock-number num-' + i; 
    n.innerHTML = '<span>' + i + '</span>'; 
    face.appendChild(n); 
  } 
});
function updateClockModes() {
  document.querySelectorAll('.timer-overlay, #previewTimerOverlay').forEach(function(el) {
    var t = typeof currentState !== 'undefined' ? currentState.timer : (typeof getTimerState === 'function' ? getTimerState() : null);
    if(t) {
      var isClock = t.mode === 'clock';
      var isDigitalClock = isClock && t.clockType === 'digital';
      var isAnalogClock = isClock && t.clockType !== 'digital';
      el.classList.toggle('digital-clock-mode', isDigitalClock);
      el.classList.toggle('analog-clock-mode', isAnalogClock);
    }
  });
}
setInterval(updateClockModes, 200);

timerModeClock?.addEventListener("click", () => {
  const t = getTimerState();
  if (t.mode === "clock") return;
  updateTimerState({
    mode: "clock",
    clockType: "analog",
    running: false,
    startedAt: null,
  });
});
clockTypeAnalog?.addEventListener("click", () => { updateTimerState({ clockType: "analog" }); });
clockTypeDigital?.addEventListener("click", () => { updateTimerState({ clockType: "digital" }); });


// --- Q&A Logic ---
document.querySelectorAll(".qa-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = Number(btn.dataset.id);
    if (state.activeQa === id && state.qaVisible !== false) {
      state = { ...state, qaVisible: false, updatedAt: Date.now() };
      socket.emit("overlay:update", { qaVisible: false });
      paint(state);
    } else {
      state = { ...state, activeQa: id, qaVisible: true, updatedAt: Date.now() };
      // Note: intentionally removed activeMode: "qa" so it doesn't interfere with profiles/projects if they are independent
      socket.emit("overlay:selectQa", id);
      paint(state);
    }
  });
});

const editQaBtn = $("editQaBtn");
if (editQaBtn) {
  editQaBtn.addEventListener("click", () => {
    const modal = $("qaModal");
    if (modal) modal.classList.remove("hidden");
    const status = $("qaSaveStatus");
    if (status) status.textContent = "";
    
    // Fill inputs
    for (let i = 1; i <= 4; i++) {
      const input = $("qaInput" + i);
      const qObj = state.qaList?.find((q) => q.id === i);
      if (input) {
        input.value = qObj ? qObj.question : "";
        setTimeout(() => autoResizeTextarea(input), 0);
      }
    }
  });
}

const closeQaModalBtn = $("closeQaModal");
const cancelQaChangesBtn = $("cancelQaChanges");
function closeQaModal() {
  const modal = $("qaModal");
  if (modal) modal.classList.add("hidden");
}
if (closeQaModalBtn) closeQaModalBtn.addEventListener("click", closeQaModal);
if (cancelQaChangesBtn) cancelQaChangesBtn.addEventListener("click", closeQaModal);

const saveQaBtn = $("saveQa");
if (saveQaBtn) {
  saveQaBtn.addEventListener("click", () => {
    const status = $("qaSaveStatus");
    if (status) {
      status.textContent = "Saving...";
      status.style.color = "#475569";
    }
    saveQaBtn.disabled = true;
    
    const qaList = [];
    for (let i = 1; i <= 4; i++) {
      const input = $("qaInput" + i);
      qaList.push({ id: i, question: input ? input.value : "" });
    }
    
    socket.emit("overlay:saveQa", { qaList }, (res) => {
      saveQaBtn.disabled = false;
      if (res && res.ok) {
        if (status) {
          status.textContent = "? Saved to Supabase";
          status.style.color = "#10b981";
        }
        setTimeout(closeQaModal, 1500);
      } else {
        if (status) {
          status.textContent = "? Save failed";
          status.style.color = "#ef4444";
        }
      }
    });
  });
}

// --- SVG Close Buttons ---
document.querySelectorAll(".close-btn").forEach(btn => {
  btn.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>`;
});
