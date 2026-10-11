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
  cornerLogoPosition: "right",
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
function bindPeopleEvents() {
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
          if (state.visible) {
            socket.emit("overlay:trigger", { type: "replay" });
            replayPreview();
          }
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
        socket.emit("overlay:selectProfile", profileId);
        socket.emit("overlay:trigger", { type: "replay" });
        paint(state);
        replayPreview();
      }),
  );
  document.querySelectorAll("#profiles .edit-person-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openProfileModal(Number(btn.dataset.id));
    };
  });
}

function people() {
  const container = $("profiles");
  if (!container || !state.profiles) return;
  const existingPersons = container.querySelectorAll(".person");
  if (existingPersons.length === state.profiles.length) {
    existingPersons.forEach((div, idx) => {
      const p = state.profiles[idx];
      div.dataset.id = p.id;
      const isActive = state.visible && state.activeMode !== "project" && p.id === state.activeProfile;
      const isInactive = !state.visible && state.activeMode !== "project" && p.id === state.activeProfile;
      div.classList.toggle("active", isActive);
      div.classList.toggle("inactive", isInactive);
      const nameEl = div.querySelector("strong");
      const roleEl = div.querySelector("small");
      if (nameEl && nameEl.textContent !== p.name) nameEl.textContent = p.name;
      if (roleEl && roleEl.textContent !== p.role) roleEl.textContent = p.role;
    });
    return;
  }
  container.innerHTML = state.profiles
    .map(
      (p) =>
        `<div class="person ${!state.visible ? "inactive" : state.activeMode !== "project" && p.id === state.activeProfile ? "active" : ""}" data-id="${p.id}">
           <div class="person-content" style="flex: 1; cursor: pointer; overflow: hidden;">
             <span class="person-text"><strong>${p.name}</strong><small>${p.role}</small></span>
           </div>
           <button class="edit-person-btn" data-id="${p.id}" aria-label="Edit Profile">⋯</button>
         </div>`,
    )
    .join("");
  bindPeopleEvents();
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
  pendingProfileOrgLogoData = "";
  pendingProfileOrgLogoName = "";

  const container = $("profileOrgLogoPreviewContainer");
  const preview = $("profileOrgLogoPreview");
  const nameLabel = $("profileOrgLogoName");
  const emptyHint = $("profileOrgLogoEmptyHint");

  const currentLogo = profile.organization_logo || profile.organizationLogo;
  if (currentLogo) {
    if (preview) {
      preview.src = currentLogo;
      preview.style.display = "block";
    }
    if (nameLabel) nameLabel.textContent = "โลโก้ปัจจุบัน";
    if (container) container.style.display = "flex";
    if (emptyHint) emptyHint.style.display = "none";
  } else {
    if (preview) {
      preview.removeAttribute("src");
      preview.style.display = "none";
    }
    if (container) container.style.display = "none";
    if (emptyHint) {
      emptyHint.textContent = "(ยังไม่มีโลโก้สำหรับบุคคลนี้)";
      emptyHint.style.display = "block";
    }
  }
}

function closeProfileModal() {
  const modal = $("profileModal");
  if (modal) modal.classList.add("hidden");
  editingProfileId = null;
  pendingProfileOrgLogoData = "";
  pendingProfileOrgLogoName = "";
  const container = $("profileOrgLogoPreviewContainer");
  const preview = $("profileOrgLogoPreview");
  const emptyHint = $("profileOrgLogoEmptyHint");
  const logoInput = $("profileOrgLogoInput");
  if (logoInput) logoInput.value = "";
  if (preview) {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
  if (container) container.style.display = "none";
  if (emptyHint) emptyHint.style.display = "none";
}
function bindProjectEvents() {
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
          if (state.visible) {
            socket.emit("overlay:trigger", { type: "replay" });
            replayPreview();
          }
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

function renderProjects() {
  const container = $("projects");
  if (!container || !state.projects) return;
  const existingProjects = container.querySelectorAll(".project");
  if (existingProjects.length === state.projects.length) {
    existingProjects.forEach((div, idx) => {
      const p = state.projects[idx];
      div.dataset.id = p.id;
      const isActive = state.visible && state.activeMode === "project" && p.id === state.activeProject;
      const isInactive = !state.visible && state.activeMode === "project" && p.id === state.activeProject;
      div.classList.toggle("active", isActive);
      div.classList.toggle("inactive", isInactive);
      const nameEl = div.querySelector("strong");
      if (nameEl && nameEl.textContent !== p.name) nameEl.textContent = p.name;
    });
    return;
  }
  container.innerHTML = state.projects
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
  bindProjectEvents();
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
let replayPreviewTimer = null;
let lastPreviewReplayTime = 0;
let lastPreviewProfileKey = null;

function replayPreview() {
  const el = $("previewThird");
  if (!el) return;
  const now = Date.now();
  if (now - lastPreviewReplayTime < 250) return;
  lastPreviewReplayTime = now;
  el.classList.remove("replay");
  void el.offsetWidth;
  el.classList.add("replay");
  clearTimeout(replayPreviewTimer);
  replayPreviewTimer = setTimeout(() => el.classList.remove("replay"), 1620);
}

function paint(s) {
  state = { ...state, ...s };
  const currentKey = `${state.activeMode || ""}-${state.activeProfile || ""}-${state.activeProject || ""}-${state.name || ""}`;
  if (lastPreviewProfileKey !== null && lastPreviewProfileKey !== currentKey && state.visible) {
    replayPreview();
  }
  lastPreviewProfileKey = currentKey;

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
    const pos = state.cornerLogoPosition === "left" ? "left" : "right";
    previewCornerLogo.classList.toggle("pos-left", pos === "left");
    previewCornerLogo.classList.toggle("pos-right", pos === "right");
    const btnR = $("cornerPosR");
    const btnL = $("cornerPosL");
    if (btnR) btnR.classList.toggle("active", pos === "right");
    if (btnL) btnL.classList.toggle("active", pos === "left");
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
  renderEmojiAutoUI(Boolean(state.emojiAuto));
  renderEmojiShareUI(Boolean(state.emojiShareEnabled));
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
$("cornerPosR")?.addEventListener("click", () => {
  if (state.cornerLogoPosition === "right") return;
  state = { ...state, cornerLogoPosition: "right", updatedAt: Date.now() };
  socket.emit("overlay:update", { cornerLogoPosition: "right" });
  paint(state);
});
$("cornerPosL")?.addEventListener("click", () => {
  if (state.cornerLogoPosition === "left") return;
  state = { ...state, cornerLogoPosition: "left", updatedAt: Date.now() };
  socket.emit("overlay:update", { cornerLogoPosition: "left" });
  paint(state);
});
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

  const payloadOrgLogo = pendingProfileOrgLogoData === "__REMOVE__"
    ? ""
    : (pendingProfileOrgLogoData || undefined);

  socket.emit(
    "overlay:saveProfile",
    { 
      id: editingProfileId, 
      name, 
      role, 
      organizationLogo: payloadOrgLogo
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
              ? { 
                  ...profile, 
                  name, 
                  role, 
                  organization_logo: payloadOrgLogo !== undefined ? payloadOrgLogo : profile.organization_logo 
                }
              : profile,
          ),
          updatedAt: Date.now(),
        };
        // If updating the active profile, also update state.name/role/organizationLogo
        if (state.activeProfile === editingProfileId) {
          state.name = name;
          state.role = role;
          if (payloadOrgLogo !== undefined) {
            state.organizationLogo = payloadOrgLogo;
          }
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
    const container = $("profileOrgLogoPreviewContainer");
    const nameLabel = $("profileOrgLogoName");
    const emptyHint = $("profileOrgLogoEmptyHint");
    if (preview) {
      preview.src = pendingProfileOrgLogoData;
      preview.style.display = "block";
    }
    if (nameLabel) {
      nameLabel.textContent = `ไฟล์ใหม่: ${file.name}`;
    }
    if (container) {
      container.style.display = "flex";
    }
    if (emptyHint) {
      emptyHint.style.display = "none";
    }
  };
  reader.readAsDataURL(file);
});
$("removeProfileOrgLogoBtn")?.addEventListener("click", () => {
  pendingProfileOrgLogoData = "__REMOVE__";
  pendingProfileOrgLogoName = "";
  const preview = $("profileOrgLogoPreview");
  const container = $("profileOrgLogoPreviewContainer");
  const emptyHint = $("profileOrgLogoEmptyHint");
  const logoInput = $("profileOrgLogoInput");
  if (logoInput) logoInput.value = "";
  if (preview) {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
  if (container) container.style.display = "none";
  if (emptyHint) {
    emptyHint.textContent = "(ตั้งค่าเป็นไม่มีโลโก้ - กด Save Profile เพื่อยืนยัน)";
    emptyHint.style.display = "block";
  }
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
socket.on("overlay:trigger", ({ type }) => {
  if (type === "replay") {
    replayPreview();
  }
});
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

// --- Floating Emoji Reactions (Livestream style) ---
const EMOJI_SVGS = {
  like: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#1877F2"/><path d="M10 17C10 16.2 10.7 15.5 11.5 15.5H13.5C14.3 15.5 15 16.2 15 17V26C15 26.8 14.3 27.5 13.5 27.5H11.5C10.7 27.5 10 26.8 10 26V17ZM16.5 27C17.5 27 19.5 27.5 21.5 27.5C24.5 27.5 25.8 26 25.8 23.5C25.8 22.8 25.5 22.1 25.1 21.5C25.8 20.8 26.2 19.8 26.2 18.8C26.2 18 25.9 17.2 25.4 16.6C25.7 15.9 25.7 15 25.1 14.3C24.3 13.5 23.2 13.5 21.7 13.5H19.5C19.8 12.5 20.5 10 20.5 8.5C20.5 7 19.5 6 18.2 6C17.2 6 16.8 6.8 16.6 7.6L16.2 11.2C15.9 13.8 14.2 15.8 13.5 16.5L16.5 17.5V27Z" fill="#FFFFFF"/></svg>`,
  heart: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#FA3E3E"/><path d="M18 27.5L16.2 25.8C9.8 20 5.5 16.1 5.5 11.3C5.5 7.4 8.5 4.5 12.4 4.5C14.6 4.5 16.7 5.5 18 7.1C19.3 5.5 21.4 4.5 23.6 4.5C27.5 4.5 30.5 7.4 30.5 11.3C30.5 16.1 26.2 20 19.8 25.8L18 27.5Z" fill="#FFFFFF"/></svg>`,
  love: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#F7B125"/><path d="M7 11C7 8.8 8.8 7 11 7C12.3 7 13.6 7.6 14.7 8.7C15.8 7.6 17.1 7 18.4 7C20.6 7 22.4 8.8 22.4 11C22.4 13.9 19.8 16.3 15.8 19.9L14.7 20.9L13.6 19.9C9.6 16.3 7 13.9 7 11Z" fill="#E0245E" transform="scale(0.58) translate(-1, 5)"/><path d="M7 11C7 8.8 8.8 7 11 7C12.3 7 13.6 7.6 14.7 8.7C15.8 7.6 17.1 7 18.4 7C20.6 7 22.4 8.8 22.4 11C22.4 13.9 19.8 16.3 15.8 19.9L14.7 20.9L13.6 19.9C9.6 16.3 7 13.9 7 11Z" fill="#E0245E" transform="scale(0.58) translate(22, 5)"/><path d="M9.5 21C9.5 26 13.3 29.5 18 29.5C22.7 29.5 26.5 26 26.5 21H9.5Z" fill="#583100"/><path d="M12.5 21C12.8 24.5 15.2 27 18 27C20.8 27 23.2 24.5 23.5 21H12.5Z" fill="#E0245E"/></svg>`,
  laugh: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#F7B125"/><path d="M8 14.5C9.5 12 12.5 12 14 14.5" stroke="#583100" stroke-width="2.2" stroke-linecap="round"/><path d="M22 14.5C23.5 12 26.5 12 28 14.5" stroke="#583100" stroke-width="2.2" stroke-linecap="round"/><path d="M9 19.5C9 26 13 29.5 18 29.5C23 29.5 27 26 27 19.5H9Z" fill="#583100"/><path d="M12 19.5C12.5 23.5 15 26 18 26C21 26 23.5 23.5 24 19.5H12Z" fill="#E0245E"/><path d="M9 19.5H27C27 21 25 22 18 22C11 22 9 21 9 19.5Z" fill="#FFFFFF"/><path d="M4.5 17C4.5 17 7 19.5 7 21.5C7 22.9 5.9 24 4.5 24C3.1 24 2 22.9 2 21.5C2 19.5 4.5 17 4.5 17Z" fill="#29B6F6"/><path d="M31.5 17C31.5 17 29 19.5 29 21.5C29 22.9 30.1 24 31.5 24C32.9 24 34 22.9 34 21.5C34 19.5 31.5 17 31.5 17Z" fill="#29B6F6"/></svg>`,
  party: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#FFFFFF"/><path d="M7 29L13 13L25 25L7 29Z" fill="#F7B125"/><path d="M13 13L16 16L10 22L7 29L13 13Z" fill="#FA3E3E"/><path d="M13 13L25 25" stroke="#D97706" stroke-width="1.5"/><circle cx="26" cy="9" r="2.2" fill="#FA3E3E"/><circle cx="21" cy="7" r="1.8" fill="#29B6F6"/><circle cx="30" cy="15" r="2" fill="#10B981"/><circle cx="27" cy="21" r="1.8" fill="#8B5CF6"/><circle cx="15" cy="6" r="1.5" fill="#F59E0B"/><path d="M19 12C22 10 25 13 28 11" stroke="#FA3E3E" stroke-width="1.8" stroke-linecap="round"/><path d="M22 17C25 16 27 19 30 18" stroke="#29B6F6" stroke-width="1.8" stroke-linecap="round"/></svg>`
};

const MAX_ACTIVE_EMOJIS = 45;

function spawnFloatingEmoji(type, container, side, size) {
  if (!container) return;
  const svgHtml = EMOJI_SVGS[type];
  if (!svgHtml) return;

  // Strict DOM cap to prevent overload during heavy spam
  while (container.children.length >= MAX_ACTIVE_EMOJIS) {
    if (container.firstElementChild) {
      container.firstElementChild.remove();
    } else break;
  }

  const el = document.createElement("div");
  el.className = "floating-emoji";
  el.innerHTML = svgHtml;

  // Set randomized emoji size (46px - 80px)
  const chosenSize = size || Math.floor(46 + Math.random() * 34);
  el.style.setProperty("--emoji-size", chosenSize + "px");

  // Assign side: randomly 'left' or 'right' if not specified
  const chosenSide = (side === "left" || side === "right") ? side : (Math.random() < 0.5 ? "left" : "right");
  el.classList.add(chosenSide === "left" ? "side-left" : "side-right");

  // Smooth gentle trajectory variables for natural medium speed
  const startXNum = Math.random() * 60 - 30;
  const startX = startXNum.toFixed(1) + "px";
  const d1 = (startXNum + (Math.random() * 16 - 8)).toFixed(1) + "px";
  const d2 = (startXNum + (Math.random() * 20 - 10)).toFixed(1) + "px";
  const d3 = (startXNum + (Math.random() * 24 - 12)).toFixed(1) + "px";
  const d4 = (startXNum + (Math.random() * 28 - 14)).toFixed(1) + "px";
  const rotStart = (Math.random() * 10 - 5).toFixed(1) + "deg";
  const rotMid = (Math.random() * 12 - 6).toFixed(1) + "deg";
  const rotEnd = (Math.random() * 14 - 7).toFixed(1) + "deg";

  el.style.setProperty("--start-x", startX);
  el.style.setProperty("--drift-1", d1);
  el.style.setProperty("--drift-2", d2);
  el.style.setProperty("--drift-3", d3);
  el.style.setProperty("--drift-4", d4);
  el.style.setProperty("--rot-start", rotStart);
  el.style.setProperty("--rot-mid", rotMid);
  el.style.setProperty("--rot-end", rotEnd);

  const duration = (2.4 + Math.random() * 0.2).toFixed(2) + "s";
  el.style.animationDuration = duration;

  let cleaned = false;
  const cleanUp = () => {
    if (cleaned) return;
    cleaned = true;
    el.remove();
  };

  el.addEventListener("animationend", cleanUp, { once: true });
  setTimeout(cleanUp, 3200);

  container.appendChild(el);
}

// Rapid spam batching queue
let emojiBatchQueue = [];
let emojiBatchTimer = null;

function triggerEmoji(type) {
  if (!EMOJI_SVGS[type]) return;

  // Randomize side (left or right) and size (46px - 80px)
  const side = Math.random() < 0.5 ? "left" : "right";
  const size = Math.floor(46 + Math.random() * 34);

  // 1. Instant local preview feedback
  const previewContainer = $("previewEmojiStream");
  if (previewContainer) {
    spawnFloatingEmoji(type, previewContainer, side, size);
  }

  // 2. Queue for batched network broadcast
  emojiBatchQueue.push({ type, side, size });

  if (!emojiBatchTimer) {
    emojiBatchTimer = setTimeout(() => {
      if (emojiBatchQueue.length > 0) {
        socket.emit("overlay:emoji", {
          items: emojiBatchQueue,
          senderId: socket.id
        });
        emojiBatchQueue = [];
      }
      emojiBatchTimer = null;
    }, 45);
  }
}

// Bind clicks to emoji reaction buttons
document.querySelectorAll(".emoji-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.emoji;
    if (type) triggerEmoji(type);
  });
});

// Auto Emoji Reaction Toggle Box UI & Listener
function renderEmojiAutoUI(enabled) {
  const btn = $("emojiAutoToggleBtn");
  const label = $("emojiAutoToggleLabel");
  const box = $("emojiAutoBox");
  if (btn) {
    btn.classList.toggle("on", enabled);
    btn.classList.toggle("off", !enabled);
    btn.setAttribute("aria-pressed", String(enabled));
  }
  if (label) {
    label.textContent = enabled ? "ON" : "OFF";
  }
  if (box) {
    box.classList.toggle("active", enabled);
  }
}

$("emojiAutoToggleBtn")?.addEventListener("click", () => {
  const next = !Boolean(state.emojiAuto);
  state = { ...state, emojiAuto: next };
  renderEmojiAutoUI(next);
  socket.emit("overlay:emojiAuto", { enabled: next });
});

// Listen for emojis from other control clients or server auto generator
socket.on("overlay:emoji", (payload) => {
  if (!payload) return;
  // If we emitted this batch ourselves, skip to avoid double spawn
  if (payload.senderId && payload.senderId === socket.id) return;

  let list = [];
  if (Array.isArray(payload.items)) {
    list = payload.items;
  } else if (Array.isArray(payload.emojis)) {
    list = payload.emojis.map((t) => typeof t === "object" ? t : { type: t, side: payload.side, size: payload.size });
  } else if (payload.type || payload.emoji) {
    list = [{ type: payload.type || payload.emoji, side: payload.side, size: payload.size }];
  }
  if (!list.length) return;

  const previewContainer = $("previewEmojiStream");
  if (!previewContainer) return;

  list.forEach((item, idx) => {
    const emojiType = typeof item === "string" ? item : item.type;
    const emojiSide = typeof item === "object" ? item.side : payload.side;
    const emojiSize = typeof item === "object" ? item.size : payload.size;
    if (idx === 0) {
      spawnFloatingEmoji(emojiType, previewContainer, emojiSide, emojiSize);
    } else {
      setTimeout(() => {
        spawnFloatingEmoji(emojiType, previewContainer, emojiSide, emojiSize);
      }, Math.min(idx * 40, 450));
    }
  });
});

// Emoji Share Link Toggle & Copy Logic
function renderEmojiShareUI(enabled) {
  const btn = $("emojiShareToggleBtn");
  const label = $("emojiShareToggleLabel");
  const box = $("emojiShareBox");
  if (btn) {
    btn.classList.toggle("on", enabled);
    btn.classList.toggle("off", !enabled);
    btn.setAttribute("aria-pressed", String(enabled));
  }
  if (label) {
    label.textContent = enabled ? "ON" : "OFF";
  }
  if (box) {
    box.classList.toggle("active", enabled);
  }
}

$("emojiShareToggleBtn")?.addEventListener("click", () => {
  const next = !Boolean(state.emojiShareEnabled);
  state = { ...state, emojiShareEnabled: next };
  renderEmojiShareUI(next);
  socket.emit("overlay:emojiShareToggle", { enabled: next });

  // When toggled ON, automatically copy the share link to clipboard
  if (next) {
    const isCh2 = (CHANNEL || "1") === "2";
    const shareUrl = `${window.location.origin}/${isCh2 ? "emoji2.html" : "emoji.html"}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  }
});


