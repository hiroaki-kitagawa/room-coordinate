"use strict";

const GRID = { columns: 10, rows: 8 };
const BLOCKED_CELLS = new Set(["4,6", "5,6", "4,7", "5,7"]);

const FURNITURE = [
  { id: "bed", name: "ベッド", image: "images/bed.png", width: 2, height: 3, limit: 1, required: true },
  { id: "table", name: "テーブル", image: "images/table.png", width: 2, height: 2, limit: 1, required: true },
  { id: "chair", name: "チェア", image: "images/chair.png", width: 1, height: 1, limit: 4 },
  { id: "sofa", name: "ソファ", image: "images/sofa.png", width: 3, height: 2, limit: 1 },
  { id: "plant", name: "観葉植物", image: "images/houseplants.png", width: 1, height: 1, limit: 3 },
  { id: "rug", name: "ラグ", image: "images/rug.png", width: 4, height: 2, limit: 1 }
];

const state = { placed: [], drag: null, selectedInstanceId: null, nextId: 1 };

const elements = {
  editor: document.querySelector("#editorScreen"),
  actionbar: document.querySelector("#actionbar"),
  list: document.querySelector("#furnitureList"),
  room: document.querySelector("#room"),
  layer: document.querySelector("#furnitureLayer"),
  preview: document.querySelector("#dropPreview"),
  ghost: document.querySelector("#dragGhost"),
  status: document.querySelector("#statusMessage"),
  count: document.querySelector("#placedCount"),
  requirements: document.querySelector("#requirementList"),
  complete: document.querySelector("#completeButton"),
  flip: document.querySelector("#flipButton"),
  rotate: document.querySelector("#rotateButton"),
  reset: document.querySelector("#resetButton"),
  dialog: document.querySelector("#resetDialog"),
  completion: document.querySelector("#completionScreen"),
  completedRoom: document.querySelector("#completedRoom"),
  edit: document.querySelector("#editButton"),
  startOver: document.querySelector("#startOverButton")
};

function definition(type) {
  return FURNITURE.find((item) => item.id === type);
}

function furnitureArt(item) {
  return `<span class="furniture-art ${item.id}" aria-hidden="true">
    <img src="${item.image}" alt="" draggable="false" />
  </span>`;
}

function dimensions(item, rotation = 0) {
  return rotation % 180 === 0
    ? { width: item.width, height: item.height }
    : { width: item.height, height: item.width };
}

function renderCatalog() {
  elements.list.innerHTML = FURNITURE.map((item) => {
    const used = state.placed.filter((placed) => placed.type === item.id).length;
    const disabled = used >= item.limit;
    return `
      <button class="catalog-item" type="button" data-type="${item.id}"
        aria-label="${item.name}を追加。${item.width}かける${item.height}マス"
        title="${disabled ? `${item.name}はこれ以上置けません` : `${item.name}をドラッグして配置`}"
        ${disabled ? "disabled" : ""}>
        ${item.required ? '<span class="required-badge">必須</span>' : ""}
        ${furnitureArt(item)}
        <span class="catalog-item-name">${item.name}</span>
      </button>`;
  }).join("");

  elements.list.querySelectorAll(".catalog-item").forEach((button) => {
    button.addEventListener("pointerdown", beginCatalogDrag);
    button.addEventListener("keydown", handleCatalogKeyboard);
  });
}

function renderPlaced(justPlacedId = null) {
  elements.layer.innerHTML = state.placed.map((placed) => {
    const item = definition(placed.type);
    const size = dimensions(item, placed.rotation);
    const selected = placed.instanceId === state.selectedInstanceId;
    const rotated = placed.rotation % 180 !== 0;
    const hasRotation = (placed.rotation || 0) !== 0;
    const artStyle = hasRotation ? `--rotated-art-width:${rotated ? item.width / item.height * 100 : 100}%;--rotated-art-height:${rotated ? item.height / item.width * 100 : 100}%;--furniture-rotation:${placed.rotation}deg;--flip-scale:${placed.flipped ? -1 : 1};` : "";
    return `
      <button class="placed-item ${placed.instanceId === justPlacedId ? "just-placed" : ""} ${selected ? "selected" : ""} ${hasRotation ? "rotated" : ""} ${placed.flipped ? "flipped" : ""}"
        type="button" data-instance="${placed.instanceId}" aria-label="${item.name}。矢印キーで移動、Rキーで回転、Fキーで左右反転" aria-pressed="${selected}"
        style="left:${placed.x * 10}%;top:${placed.y * 12.5}%;width:${size.width * 10}%;height:${size.height * 12.5}%;${artStyle}">
        ${furnitureArt(item)}<span class="item-label">${item.name}・${placed.rotation || 0}度</span>
      </button>`;
  }).join("");

  elements.layer.querySelectorAll(".placed-item").forEach((button) => {
    button.addEventListener("pointerdown", beginPlacedDrag);
    button.addEventListener("keydown", handlePlacedKeyboard);
  });
  updateProgress();
}

function updateProgress() {
  const requirements = FURNITURE.filter((item) => item.required);
  const allMet = requirements.every((item) => state.placed.some((placed) => placed.type === item.id));
  elements.requirements.innerHTML = requirements.map((item) => {
    const met = state.placed.some((placed) => placed.type === item.id);
    return `<span class="requirement ${met ? "met" : ""}">${item.name}を1つ</span>`;
  }).join("");
  elements.complete.disabled = !allMet;
  elements.complete.title = allMet ? "お部屋を完成する" : "必須の家具をすべて置いてください";
  elements.flip.disabled = !state.selectedInstanceId;
  elements.flip.title = state.selectedInstanceId ? "選択した家具を左右反転" : "反転する家具を選んでください";
  elements.rotate.disabled = !state.selectedInstanceId;
  elements.rotate.title = state.selectedInstanceId ? "選択した家具を90度回転" : "回転する家具を選んでください";
  elements.count.textContent = `${state.placed.length}個`;
  renderCatalog();
}

function beginCatalogDrag(event) {
  if (event.button !== 0 || event.currentTarget.disabled) return;
  const item = definition(event.currentTarget.dataset.type);
  startDrag(event, item, null);
}

function beginPlacedDrag(event) {
  if (event.button !== 0) return;
  const placed = state.placed.find((item) => item.instanceId === event.currentTarget.dataset.instance);
  if (!placed) return;
  startDrag(event, definition(placed.type), placed);
  event.currentTarget.classList.add("drag-source");
}

function startDrag(event, item, placed) {
  event.preventDefault();
  state.drag = {
    item,
    instanceId: placed?.instanceId ?? null,
    original: placed ? { x: placed.x, y: placed.y } : null,
    rotation: placed?.rotation ?? 0,
    flipped: placed?.flipped ?? false,
    startX: event.clientX,
    startY: event.clientY,
    hasMoved: false,
    candidate: null,
    valid: false,
    reason: "部屋の中に置いてください"
  };
  elements.room.classList.add("is-dragging", "outside");
  elements.ghost.innerHTML = furnitureArt(item);
  const roomRect = elements.room.getBoundingClientRect();
  const size = dimensions(item, state.drag.rotation);
  elements.ghost.style.width = `${Math.max(54, roomRect.width * size.width / GRID.columns)}px`;
  elements.ghost.style.height = `${Math.max(48, roomRect.height * size.height / GRID.rows)}px`;
  elements.ghost.style.setProperty("--ghost-rotation", `${state.drag.rotation}deg`);
  elements.ghost.style.setProperty("--ghost-flip", state.drag.flipped ? -1 : 1);
  elements.ghost.hidden = false;
  moveGhost(event.clientX, event.clientY);
  setStatus(`${item.name}を置く場所を選んでね`, "");
  window.addEventListener("pointermove", continueDrag, { passive: false });
  window.addEventListener("pointerup", finishDrag, { once: true });
  window.addEventListener("pointercancel", cancelDrag, { once: true });
}

function continueDrag(event) {
  if (!state.drag) return;
  event.preventDefault();
  moveGhost(event.clientX, event.clientY);
  if (!state.drag.hasMoved) {
    const distance = Math.hypot(event.clientX - state.drag.startX, event.clientY - state.drag.startY);
    if (distance < 5) return;
    state.drag.hasMoved = true;
  }
  updateCandidate(event.clientX, event.clientY);
}

function moveGhost(x, y) {
  elements.ghost.style.left = `${x}px`;
  elements.ghost.style.top = `${y}px`;
}

function updateCandidate(clientX, clientY) {
  const rect = elements.room.getBoundingClientRect();
  const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  elements.room.classList.toggle("outside", !inside);
  if (!inside) {
    state.drag.candidate = null;
    state.drag.valid = false;
    state.drag.reason = "部屋の中に置いてください";
    elements.preview.hidden = true;
    setStatus(state.drag.reason, "error");
    return;
  }

  const cellWidth = rect.width / GRID.columns;
  const cellHeight = rect.height / GRID.rows;
  const size = dimensions(state.drag.item, state.drag.rotation);
  const x = Math.round((clientX - rect.left) / cellWidth - size.width / 2);
  const y = Math.round((clientY - rect.top) / cellHeight - size.height / 2);
  const result = validatePlacement(state.drag.item, x, y, state.drag.instanceId, state.drag.rotation);
  state.drag.candidate = { x, y };
  state.drag.valid = result.valid;
  state.drag.reason = result.reason;
  showPreview(x, y, state.drag.item, result.valid);
  setStatus(result.valid ? "ここに置けます" : result.reason, result.valid ? "success" : "error");
}

function validatePlacement(item, x, y, ignoredInstance = null, rotation = 0) {
  const size = dimensions(item, rotation);
  if (x < 0 || y < 0 || x + size.width > GRID.columns || y + size.height > GRID.rows) {
    return { valid: false, reason: "部屋の中に置いてください" };
  }
  for (let dy = 0; dy < size.height; dy += 1) {
    for (let dx = 0; dx < size.width; dx += 1) {
      if (BLOCKED_CELLS.has(`${x + dx},${y + dy}`)) return { valid: false, reason: "ドアの前には置けません" };
    }
  }
  const overlaps = state.placed.some((placed) => {
    if (placed.instanceId === ignoredInstance) return false;
    const other = definition(placed.type);
    const otherSize = dimensions(other, placed.rotation);
    return x < placed.x + otherSize.width && x + size.width > placed.x && y < placed.y + otherSize.height && y + size.height > placed.y;
  });
  if (overlaps) return { valid: false, reason: "ほかの家具と重なっています" };

  return { valid: true, reason: "" };
}

function showPreview(x, y, item, valid) {
  const size = dimensions(item, state.drag?.rotation ?? 0);
  elements.preview.hidden = false;
  elements.preview.className = `drop-preview ${valid ? "valid" : "invalid"}`;
  elements.preview.dataset.mark = valid ? "✓" : "×";
  elements.preview.style.left = `${x * 10}%`;
  elements.preview.style.top = `${y * 12.5}%`;
  elements.preview.style.width = `${size.width * 10}%`;
  elements.preview.style.height = `${size.height * 12.5}%`;
}

function finishDrag() {
  if (!state.drag) return;
  if (state.drag.instanceId && !state.drag.hasMoved) {
    const instanceId = state.drag.instanceId;
    clearDrag();
    selectFurniture(instanceId);
    return;
  }
  if (state.drag.valid && state.drag.candidate) {
    let instanceId = state.drag.instanceId;
    if (instanceId) {
      const target = state.placed.find((placed) => placed.instanceId === instanceId);
      target.x = state.drag.candidate.x;
      target.y = state.drag.candidate.y;
      target.rotation = state.drag.rotation;
    } else {
      instanceId = `furniture-${state.nextId++}`;
      state.placed.push({ instanceId, type: state.drag.item.id, rotation: state.drag.rotation, flipped: state.drag.flipped, ...state.drag.candidate });
    }
    const itemName = state.drag.item.name;
    state.selectedInstanceId = instanceId;
    clearDrag();
    renderPlaced(instanceId);
    document.querySelector(`[data-instance="${instanceId}"]`)?.focus({ preventScroll: true });
    setStatus(`${itemName}を置きました`, "success");
  } else {
    const reason = state.drag.reason;
    clearDrag();
    renderPlaced();
    setStatus(reason, "error");
  }
}

function cancelDrag() {
  if (!state.drag) return;
  clearDrag();
  renderPlaced();
  setStatus("移動をキャンセルしました", "");
}

function clearDrag() {
  state.drag = null;
  elements.ghost.hidden = true;
  elements.preview.hidden = true;
  elements.room.classList.remove("is-dragging", "outside");
  window.removeEventListener("pointermove", continueDrag);
  window.removeEventListener("pointerup", finishDrag);
  window.removeEventListener("pointercancel", cancelDrag);
}

function handleCatalogKeyboard(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const item = definition(event.currentTarget.dataset.type);
  for (let y = 0; y < GRID.rows; y += 1) {
    for (let x = 0; x < GRID.columns; x += 1) {
      if (validatePlacement(item, x, y).valid) {
        const instanceId = `furniture-${state.nextId++}`;
        state.placed.push({ instanceId, type: item.id, rotation: 0, flipped: false, x, y });
        renderPlaced(instanceId);
        setStatus(`${item.name}を空いている場所に置きました`, "success");
        return;
      }
    }
  }
  setStatus(`${item.name}を置ける場所がありません`, "error");
}

function handlePlacedKeyboard(event) {
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    state.selectedInstanceId = event.currentTarget.dataset.instance;
    flipSelected();
    return;
  }
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    state.selectedInstanceId = event.currentTarget.dataset.instance;
    rotateSelected();
    return;
  }
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!directions[event.key]) return;
  event.preventDefault();
  const placed = state.placed.find((item) => item.instanceId === event.currentTarget.dataset.instance);
  const item = definition(placed.type);
  const [dx, dy] = directions[event.key];
  const x = placed.x + dx;
  const y = placed.y + dy;
  const result = validatePlacement(item, x, y, placed.instanceId, placed.rotation);
  if (result.valid) {
    placed.x = x;
    placed.y = y;
    renderPlaced();
    document.querySelector(`[data-instance="${placed.instanceId}"]`)?.focus();
    setStatus(`${item.name}を移動しました`, "success");
  } else {
    setStatus(result.reason, "error");
  }
}

function setStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status-message ${type}`.trim();
}

function resetRoom() {
  state.placed = [];
  state.selectedInstanceId = null;
  state.nextId = 1;
  renderPlaced();
  setStatus("家具を選んで、部屋に置いてみよう", "");
}

function showCompletion() {
  if (elements.complete.disabled) return;
  elements.completedRoom.innerHTML = state.placed.map((placed) => {
    const item = definition(placed.type);
    const size = dimensions(item, placed.rotation);
    const rotated = placed.rotation % 180 !== 0;
    const hasRotation = (placed.rotation || 0) !== 0;
    const artStyle = hasRotation ? `--rotated-art-width:${rotated ? item.width / item.height * 100 : 100}%;--rotated-art-height:${rotated ? item.height / item.width * 100 : 100}%;--furniture-rotation:${placed.rotation}deg;--flip-scale:${placed.flipped ? -1 : 1};` : "";
    return `<div class="placed-item ${hasRotation ? "rotated" : ""} ${placed.flipped ? "flipped" : ""}" style="left:${placed.x * 10}%;top:${placed.y * 12.5}%;width:${size.width * 10}%;height:${size.height * 12.5}%;${artStyle}">${furnitureArt(item)}</div>`;
  }).join("");
  elements.editor.hidden = true;
  elements.actionbar.hidden = true;
  elements.completion.hidden = false;
  elements.completion.querySelector("h1").focus({ preventScroll: true });
}

function returnToEditor() {
  elements.completion.hidden = true;
  elements.editor.hidden = false;
  elements.actionbar.hidden = false;
  elements.complete.focus();
}

function selectFurniture(instanceId) {
  state.selectedInstanceId = instanceId;
  renderPlaced();
  const placed = state.placed.find((item) => item.instanceId === instanceId);
  if (placed) setStatus(`${definition(placed.type).name}を選択しました。回転・左右反転ができます`, "");
}

function rotateSelected() {
  const placed = state.placed.find((item) => item.instanceId === state.selectedInstanceId);
  if (!placed) return;
  const item = definition(placed.type);
  const nextRotation = ((placed.rotation || 0) + 90) % 360;
  const result = validatePlacement(item, placed.x, placed.y, placed.instanceId, nextRotation);
  if (!result.valid) {
    setStatus(`回転できません：${result.reason}`, "error");
    return;
  }
  placed.rotation = nextRotation;
  renderPlaced();
  document.querySelector(`[data-instance="${placed.instanceId}"]`)?.focus();
  setStatus(`${item.name}を${nextRotation}度に回転しました`, "success");
}

function flipSelected() {
  const placed = state.placed.find((item) => item.instanceId === state.selectedInstanceId);
  if (!placed) return;
  placed.flipped = !placed.flipped;
  const item = definition(placed.type);
  renderPlaced();
  document.querySelector(`[data-instance="${placed.instanceId}"]`)?.focus();
  setStatus(`${item.name}を左右反転しました`, "success");
}

elements.reset.addEventListener("click", () => elements.dialog.showModal());
elements.flip.addEventListener("click", flipSelected);
elements.rotate.addEventListener("click", rotateSelected);
elements.dialog.addEventListener("close", () => { if (elements.dialog.returnValue === "confirm") resetRoom(); });
elements.complete.addEventListener("click", showCompletion);
elements.edit.addEventListener("click", returnToEditor);
elements.startOver.addEventListener("click", () => { resetRoom(); returnToEditor(); });
window.addEventListener("blur", cancelDrag);

renderPlaced();
