const canvas = document.querySelector("#plotCanvas");
const ctx = canvas.getContext("2d");
const assignCard = document.querySelector("#assignCard");
const updateCard = document.querySelector("#updateCard");
const nextStepButton = document.querySelector("#nextStepButton");
const runButton = document.querySelector("#runButton");
const resetButton = document.querySelector("#resetButton");
const spreadSlider = document.querySelector("#spreadSlider");
const clusterInput = document.querySelector("#clusterInput");
const centroidInput = document.querySelector("#centroidInput");
const newPointsButton = document.querySelector("#newPointsButton");
const newCentroidsButton = document.querySelector("#newCentroidsButton");
const mseValue = document.querySelector("#mseValue");
const iterationStatus = document.querySelector("#iterationStatus");

const colors = [
  "#2f8dcb",
  "#43a047",
  "#f57c00",
  "#8e44ad",
  "#d83a4f",
  "#00a6a6",
  "#6c63ff",
  "#8a6d3b",
];

const state = {
  points: [],
  centroids: [],
  clusterCount: 3,
  centroidCount: 3,
  nextAction: "assign",
  iteration: 0,
  mse: null,
  running: false,
  dragCentroidIndex: -1,
};

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function pointDistanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function generateClusteredPoints(clusterCount, randomness) {
  const points = [];
  const totalPoints = 330;
  const centers = Array.from({ length: clusterCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / clusterCount - Math.PI / 2;
    const radius = clusterCount <= 1 ? 0 : rand(0.22, 0.38);
    return {
      x: 0.5 + Math.cos(angle) * radius + rand(-0.08, 0.08),
      y: 0.5 + Math.sin(angle) * radius + rand(-0.08, 0.08),
    };
  });

  const randomRatio = randomness / 100;
  const clusteredTotal = Math.round(totalPoints * (1 - randomRatio * 0.72));
  const randomTotal = totalPoints - clusteredTotal;

  for (let i = 0; i < clusteredTotal; i += 1) {
    const center = centers[i % centers.length];
    const spread = 0.026 + randomRatio * 0.075;
    points.push({
      x: clamp(center.x + gaussian() * spread, 0.015, 0.985),
      y: clamp(center.y + gaussian() * spread, 0.015, 0.985),
      cluster: null,
    });
  }

  for (let i = 0; i < randomTotal; i += 1) {
    points.push({ x: rand(0.015, 0.985), y: rand(0.015, 0.985), cluster: null });
  }

  return shuffle(points);
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function generateCentroids(count) {
  return Array.from({ length: count }, (_, index) => ({
    x: rand(0.25, 0.78),
    y: rand(0.62, 0.88),
    color: colors[index % colors.length],
  }));
}

function resetAlgorithm(keepPoints = true, keepCentroids = true) {
  if (!keepPoints) {
    state.points = generateClusteredPoints(state.clusterCount, Number(spreadSlider.value));
  }

  if (!keepCentroids) {
    state.centroids = generateCentroids(state.centroidCount);
  }

  state.points.forEach((point) => {
    point.cluster = null;
  });
  state.nextAction = "assign";
  state.iteration = 0;
  state.mse = null;
  stopAutoRun();
  render();
}

function assignPoints() {
  if (!state.centroids.length) return;

  state.points.forEach((point) => {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    state.centroids.forEach((centroid, index) => {
      const distance = pointDistanceSquared(point, centroid);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    point.cluster = closestIndex;
  });

  updateMse();
  state.nextAction = "update";
  render();
}

function updateCentroids() {
  const groups = state.centroids.map(() => ({ x: 0, y: 0, count: 0 }));

  state.points.forEach((point) => {
    if (point.cluster === null || !groups[point.cluster]) return;
    groups[point.cluster].x += point.x;
    groups[point.cluster].y += point.y;
    groups[point.cluster].count += 1;
  });

  state.centroids.forEach((centroid, index) => {
    const group = groups[index];
    if (group.count === 0) {
      centroid.x = rand(0.08, 0.92);
      centroid.y = rand(0.08, 0.92);
      return;
    }

    centroid.x = group.x / group.count;
    centroid.y = group.y / group.count;
  });

  state.iteration += 1;
  updateMse();
  state.nextAction = "assign";
  render();
}

function updateMse() {
  if (!state.points.length || !state.centroids.length) {
    state.mse = null;
    return;
  }

  const total = state.points.reduce((sum, point) => {
    if (point.cluster === null || !state.centroids[point.cluster]) return sum;
    return sum + pointDistanceSquared(point, state.centroids[point.cluster]);
  }, 0);

  const assignedPoints = state.points.filter((point) => point.cluster !== null).length;
  state.mse = assignedPoints ? total / assignedPoints : null;
}

function handleNextStep() {
  if (state.nextAction === "assign") {
    assignPoints();
  } else {
    updateCentroids();
  }
}

function runAutomatically() {
  if (state.running) {
    stopAutoRun();
    return;
  }

  state.running = true;
  runButton.textContent = "Pause";
  handleNextStep();
  state.autoTimer = window.setInterval(handleNextStep, 850);
}

function stopAutoRun() {
  if (state.autoTimer) {
    window.clearInterval(state.autoTimer);
  }

  state.running = false;
  state.autoTimer = null;
  runButton.textContent = "Auto run";
}

function resizeCanvasForDisplay() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.round(rect.width * dpr);
  const nextHeight = Math.round(rect.height * dpr);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function toCanvasPoint(point) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: point.x * rect.width,
    y: point.y * rect.height,
  };
}

function fromPointerEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function nearestCentroidIndex(pointer) {
  const rect = canvas.getBoundingClientRect();
  const hitRadius = 20;

  for (let i = state.centroids.length - 1; i >= 0; i -= 1) {
    const centroid = toCanvasPoint(state.centroids[i]);
    const pointerPx = { x: pointer.x * rect.width, y: pointer.y * rect.height };
    const distance = Math.hypot(pointerPx.x - centroid.x, pointerPx.y - centroid.y);
    if (distance <= hitRadius) return i;
  }

  return -1;
}

function drawGrid(width, height) {
  ctx.save();
  ctx.strokeStyle = "#eef1f5";
  ctx.lineWidth = 1;

  for (let i = 1; i < 8; i += 1) {
    const position = (width / 8) * i;
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(width, position);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPoints(width, height) {
  state.points.forEach((point) => {
    const assigned = point.cluster !== null && state.centroids[point.cluster];
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, assigned ? 4.6 : 4.2, 0, Math.PI * 2);
    ctx.fillStyle = assigned ? state.centroids[point.cluster].color : "#050505";
    ctx.globalAlpha = assigned ? 0.84 : 1;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawCentroidTriangle(x, y, color) {
  const size = 18;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x - size * 0.92, y + size * 0.86);
  ctx.lineTo(x + size * 0.92, y + size * 0.86);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#27313b";
  ctx.lineWidth = 1.6;
  ctx.fill();
  ctx.stroke();
}

function drawCentroids(width, height) {
  state.centroids.forEach((centroid) => {
    drawCentroidTriangle(centroid.x * width, centroid.y * height, centroid.color);
  });
}

function drawAssignmentLines(width, height) {
  if (state.nextAction !== "update") return;

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  state.points.forEach((point) => {
    if (point.cluster === null || !state.centroids[point.cluster]) return;
    const centroid = state.centroids[point.cluster];
    ctx.strokeStyle = centroid.color;
    ctx.beginPath();
    ctx.moveTo(point.x * width, point.y * height);
    ctx.lineTo(centroid.x * width, centroid.y * height);
    ctx.stroke();
  });
  ctx.restore();
}

function render() {
  resizeCanvasForDisplay();
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);
  drawAssignmentLines(width, height);
  drawPoints(width, height);
  drawCentroids(width, height);

  assignCard.classList.toggle("active", state.nextAction === "assign");
  updateCard.classList.toggle("active", state.nextAction === "update");
  nextStepButton.textContent =
    state.nextAction === "assign" ? "Find closest centroid" : "Update centroid";
  mseValue.textContent = state.mse === null ? "belum dihitung" : state.mse.toFixed(5);
  iterationStatus.textContent = `Iterasi ${state.iteration}`;
}

function syncCountsFromInputs() {
  state.clusterCount = clamp(Number(clusterInput.value) || 1, 1, 8);
  state.centroidCount = clamp(Number(centroidInput.value) || 1, 1, 8);
  clusterInput.value = state.clusterCount;
  centroidInput.value = state.centroidCount;
}

nextStepButton.addEventListener("click", handleNextStep);
runButton.addEventListener("click", runAutomatically);
resetButton.addEventListener("click", () => resetAlgorithm(true, true));

spreadSlider.addEventListener("input", () => {
  syncCountsFromInputs();
  resetAlgorithm(false, true);
});

clusterInput.addEventListener("change", () => {
  syncCountsFromInputs();
  resetAlgorithm(false, true);
});

centroidInput.addEventListener("change", () => {
  syncCountsFromInputs();
  resetAlgorithm(true, false);
});

newPointsButton.addEventListener("click", () => {
  syncCountsFromInputs();
  resetAlgorithm(false, true);
});

newCentroidsButton.addEventListener("click", () => {
  syncCountsFromInputs();
  resetAlgorithm(true, false);
});

canvas.addEventListener("pointerdown", (event) => {
  const pointer = fromPointerEvent(event);
  const centroidIndex = nearestCentroidIndex(pointer);

  if (centroidIndex >= 0) {
    state.dragCentroidIndex = centroidIndex;
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  state.points.push({ x: pointer.x, y: pointer.y, cluster: null });
  state.nextAction = "assign";
  state.mse = null;
  stopAutoRun();
  render();
});

canvas.addEventListener("pointermove", (event) => {
  if (state.dragCentroidIndex < 0) return;
  const pointer = fromPointerEvent(event);
  const centroid = state.centroids[state.dragCentroidIndex];
  centroid.x = pointer.x;
  centroid.y = pointer.y;
  state.nextAction = "assign";
  state.mse = null;
  render();
});

canvas.addEventListener("pointerup", (event) => {
  if (state.dragCentroidIndex >= 0) {
    canvas.releasePointerCapture(event.pointerId);
  }
  state.dragCentroidIndex = -1;
});

canvas.addEventListener("pointercancel", () => {
  state.dragCentroidIndex = -1;
});

window.addEventListener("resize", render);

syncCountsFromInputs();
state.points = generateClusteredPoints(state.clusterCount, Number(spreadSlider.value));
state.centroids = generateCentroids(state.centroidCount);
render();
