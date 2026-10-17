import * as THREE from 'three';
import { buildSkillActivities } from './skill-activities.js';
import {
  etecMissionVisualState,
  etecTreeProgress,
  isEtecMissionDone,
  materiaProgress,
  skillVisualState
} from './progress.js';
import { materializeNode } from './bncc-tree.js';

const DRAG_CLICK_THRESHOLD = 8;
const CORE_INDEX = 0;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.2;
const ZOOM_LAYER = 1;
const ZOOM_MINDMAP = 0.78;
const CAMERA_BASE_Z = 14;

function ringPositions(count, radius, yFactor = 0.5, zFactor = 0.14) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    out.push([Math.cos(a) * radius, Math.sin(a) * radius * yFactor, Math.sin(a) * radius * zFactor]);
  }
  return out;
}

function skillOrbitPositions(count) {
  if (count <= 14) {
    const r = Math.max(8.5, 6.5 + count * 0.4);
    return ringPositions(count, r, 0.34, 0.2);
  }
  const out = [];
  const rings = count > 42 ? 3 : 2;
  let idx = 0;
  const base = Math.min(22, 9 + count * 0.48);
  for (let ring = 0; ring < rings; ring++) {
    const remaining = count - idx;
    const ringsLeft = rings - ring;
    const inRing = Math.ceil(remaining / ringsLeft);
    const r = base * (0.52 + (ring / (rings - 1 || 1)) * 0.48);
    for (let j = 0; j < inRing && idx < count; j++, idx++) {
      const a = (j / inRing) * Math.PI * 2 - Math.PI / 2 + ring * 0.35;
      out.push([Math.cos(a) * r, Math.sin(a) * r * 0.3, Math.sin(a) * r * 0.18]);
    }
  }
  return out;
}

function questionOrbitPositions(count) {
  const radius = Math.max(8.5, count * 0.44);
  return ringPositions(count, radius, 0.34, 0.2);
}

function orbitPositions(count, { questionLayer = false } = {}) {
  if (questionLayer) return questionOrbitPositions(count);
  return skillOrbitPositions(count);
}

function mindMapPositions(count) {
  const radius = Math.min(7.4, 5.1 + count * 0.52);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const wobble = 0.85 + (i % 3) * 0.08;
    out.push([
      Math.cos(a) * radius * wobble,
      Math.sin(a) * radius * 0.38,
      Math.sin(a) * radius * 0.28
    ]);
  }
  return out;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  });
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineHeight));
}

function sphereCenterTexture(materia) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 512);
  x.fillStyle = 'rgba(5, 20, 55, 0.55)';
  x.beginPath();
  x.arc(256, 256, 200, 0, Math.PI * 2);
  x.fill();
  x.font = 'bold 36px system-ui';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#ffffff';
  x.shadowColor = '#0a1a3d';
  x.shadowBlur = 14;
  wrapCanvasText(x, materia, 256, 256, 420, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function progressBadgeTexture(done, total, unit = 'BNCC') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 72;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 72);
  x.fillStyle = 'rgba(8, 16, 36, 0.9)';
  x.beginPath();
  x.roundRect(16, 28, 224, 14, 7);
  x.fill();
  x.fillStyle = '#2a4068';
  x.fillRect(20, 32, 216, 6);
  const w = total ? (done / total) * 216 : 0;
  x.fillStyle = done === total && total ? '#81f1df' : '#f0c14b';
  if (w > 0) x.fillRect(20, 32, w, 6);
  const label = unit === 'feitas' ? `${done} de ${total} feitas` : total ? `${done}/${total} BNCC` : '—';
  x.fillStyle = done === total && total ? '#81f1df' : '#e8f2ff';
  x.textAlign = 'center';
  let size = 20;
  x.font = `bold ${size}px system-ui`;
  while (size > 13 && x.measureText(label).width > 230) {
    size -= 1;
    x.font = `bold ${size}px system-ui`;
  }
  x.fillText(label, 128, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function applyPlanetVisual(sphere, halo, baseColor, visualState) {
  const mat = sphere.material;
  const c = baseColor ?? 0x88aaff;
  if (visualState === 'pending') {
    mat.color.setHex(0x4a5568);
    mat.emissive.setHex(0x1a2230);
    mat.emissiveIntensity = 0.06;
    mat.metalness = 0.05;
    halo.material.color.setHex(0x5a6478);
    halo.material.opacity = 0.35;
    return;
  }
  const tint = visualState === 'partial' ? 0x8aa8c8 : c;
  mat.color.setHex(tint);
  mat.emissive.setHex(c);
  mat.emissiveIntensity = visualState === 'done' ? 0.38 : visualState === 'linked' ? 0.32 : 0.2;
  mat.metalness = 0.12;
  if (visualState === 'linked') {
    halo.material.color.setHex(0xffd76a);
    halo.material.opacity = 1;
  } else if (visualState === 'done') {
    halo.material.color.setHex(0x81f1df);
    halo.material.opacity = 0.95;
  } else {
    halo.material.color.setHex(c);
    halo.material.opacity = visualState === 'partial' ? 0.65 : 0.8;
  }
}

function labelTexture(text, emoji, sub = 'TOQUE PARA EXPLORAR', subColor = '#cfe5ff') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 160);
  x.font = 'bold 48px system-ui';
  x.textAlign = 'center';
  x.fillStyle = '#fff';
  x.shadowColor = '#000';
  x.shadowBlur = 10;
  const line = `${emoji} ${text}`;
  x.fillText(line.length > 22 ? `${line.slice(0, 21)}\u2026` : line, 256, 78);
  x.shadowBlur = 0;
  x.font = 'bold 34px system-ui';
  x.fillStyle = subColor;
  x.fillText(sub, 256, 125);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
    if (obj.material?.map) obj.material.map.dispose();
  });
}

function isEtecBranchNode(node) {
  if (!node || node.etecMission) return false;
  if (node.id === 'prep-etec') return true;
  if (typeof node.id === 'string' && node.id.startsWith('etec-')) return true;
  return node.cat === 'Missão ETEC';
}

function missionCaption(node, progress) {
  if (!progress || !node?.etecMission) return null;
  return isEtecMissionDone(progress, node)
    ? { text: 'FEITO', color: '#81f1df' }
    : { text: 'FALTA', color: '#ffd59a' };
}

function etecFolderCaption(node, progress) {
  if (!progress || !isEtecBranchNode(node)) return null;
  const p = etecTreeProgress(node, progress);
  if (!p.total) return null;
  if (p.done === p.total) return { text: 'TUDO FEITO', color: '#81f1df' };
  if (p.done === 0) return { text: `0 de ${p.total} feitas`, color: '#ffd59a' };
  return { text: `${p.done} de ${p.total} feitas`, color: '#f0c14b' };
}

function nodeCaption(node, progress) {
  return missionCaption(node, progress) || etecFolderCaption(node, progress);
}

function etecLabelName(node) {
  if (node?.etecQuestion) {
    return node.name;
  }
  const name = node?.name || '';
  if (!isEtecBranchNode(node)) return name;
  const parts = name.split(/\s+[—–-]\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function paintLabel(sprite, node, sub, color) {
  const prev = sprite.material.map;
  sprite.material.map = labelTexture(etecLabelName(node), node.emoji || '🪐', sub, color);
  sprite.material.needsUpdate = true;
  prev?.dispose();
}

function resolveVisualState(node, progress) {
  if (node.etecMission) return etecMissionVisualState(progress, node);
  if (isEtecBranchNode(node)) {
    const p = etecTreeProgress(node, progress);
    if (p.total && p.done >= p.total) return 'done';
    return 'default';
  }
  if (node.bnccSkill) return skillVisualState(progress, node);
  if (node.children?.length && node.children.some((c) => c.bnccSkill)) {
    const p = materiaProgress(progress, node);
    if (p.total && p.done >= p.total) return 'done';
    if (p.done > 0) return 'partial';
  }
  return 'default';
}

function createPlanetMesh(node, { radius = 0.72, sub, subColor, centerMateria, hubBlue, visualState = 'default', progressBadge }) {
  let labelSprite = null;
  const color = hubBlue ? 0x3d7ee8 : (node.color ?? 0x88aaff);
  const g = new THREE.Group();
  g.userData.node = node;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 40, 32),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: hubBlue ? 0.35 : 0.18,
      roughness: 0.28,
      metalness: 0.12
    })
  );
  g.add(sphere);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.25, 0.025, 8, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  halo.rotation.x = 1.0;
  g.add(halo);
  if (!hubBlue) applyPlanetVisual(sphere, halo, color, visualState);
  if (centerMateria) {
    const face = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sphereCenterTexture(centerMateria),
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    );
    face.position.set(0, 0, radius + 0.55);
    face.scale.set(radius * 3.2, radius * 3.2, 1);
    face.renderOrder = 999;
    g.add(face);
  } else {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture(etecLabelName(node), node.emoji || '🪐', sub, subColor),
        transparent: true,
        depthTest: false
      })
    );
    spr.position.y = -(radius + 0.45);
    spr.scale.set(2.4, 0.78, 1);
    g.add(spr);
    labelSprite = spr;
  }
  if (progressBadge && progressBadge.total > 0) {
    const etecBadge = progressBadge.unit === 'feitas';
    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: progressBadgeTexture(progressBadge.done, progressBadge.total, progressBadge.unit),
        transparent: true,
        depthTest: false
      })
    );
    badge.position.y = radius + (etecBadge ? 0.62 : 0.55);
    badge.scale.set(etecBadge ? 1.95 : 1.5, etecBadge ? 0.55 : 0.42, 1);
    g.add(badge);
  }
  return { group: g, sphere, node, halo, visualState, labelSprite };
}

export function createUniverse(host, treeRoot, { onLeafSelect, onNavigate, progress }) {
  const cameraPan = new THREE.Vector2();
  const targetCameraPan = new THREE.Vector2();
  let scene;
  let camera;
  let renderer;
  let raycaster;
  let mouse;
  let root;
  let coreMesh;
  let orbitGroup;
  let linkGroup;
  const planetMeshes = [];
  let selectedSubjectButton = null;
  const navStack = [treeRoot];
  let rootLayersOpen = false;
  let viewMode = 'layer';
  let dragging = false;
  let dragLast = { x: 0, y: 0 };
  let dragStart = { x: 0, y: 0 };
  let targetRot = { x: 0, y: 0 };
  let zoom = ZOOM_LAYER;
  let targetZoom = ZOOM_LAYER;
  const mindMapLinkRefs = [];
  const clock = new THREE.Clock();

  function applyViewZoom(mode) {
    targetZoom = mode === 'mindmap' ? ZOOM_MINDMAP : ZOOM_LAYER;
    targetCameraPan.set(0, 0);
  }

  function applyCameraDistance() {
    if (!camera) return;
    camera.position.set(cameraPan.x, 1 + cameraPan.y, CAMERA_BASE_Z / zoom);
    camera.lookAt(cameraPan.x, 1 + cameraPan.y, 0);
  }

  function currentNode() {
    return navStack[navStack.length - 1];
  }

  function notifyNav() {
    onNavigate?.({ stack: [...navStack], rootLayersOpen, viewMode });
  }

  function clearLinks() {
    mindMapLinkRefs.length = 0;
    if (!linkGroup) return;
    while (linkGroup.children.length) {
      const child = linkGroup.children[0];
      linkGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  }

  function clearPlanets() {
    clearLinks();
    selectedSubjectButton = null;
    while (planetMeshes.length) {
      const p = planetMeshes.pop();
      orbitGroup.remove(p.group);
      disposeGroup(p.group);
    }
  }

  function planetOpts(node, base = {}) {
    const visualState = progress ? resolveVisualState(node, progress) : 'default';
    let progressBadge = null;
    if (progress && !isEtecBranchNode(node) && (node.lazyKey || node.children?.some((c) => c.bnccSkill || c.etecMission))) {
      if (node.lazyKey && !node._materialized) {
        const recs = node.skillCount ?? 0;
        if (recs > 0) progressBadge = { done: 0, total: recs };
      } else {
        const p = materiaProgress(progress, node);
        if (p.total > 0) progressBadge = p;
      }
    }
    return { ...base, visualState, progressBadge };
  }

  function addPlanetAt(node, position, opts) {
    const p = createPlanetMesh(node, planetOpts(node, opts));
    p.group.position.set(...position);
    p.baseX = position[0];
    p.baseY = position[1];
    p.baseZ = position[2];
    p.phase = Math.random() * Math.PI * 2;
    orbitGroup.add(p.group);
    planetMeshes.push(p);
    return p;
  }

  function linkLineDynamic(getA, getB, color = 0x5a8fd4, opacity = 0.55) {
    const geo = new THREE.BufferGeometry().setFromPoints([getA(), getB()]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.Line(geo, mat);
    linkGroup.add(line);
    mindMapLinkRefs.push({ line, getA, getB });
  }

  function updateDynamicLinks() {
    mindMapLinkRefs.forEach(({ line, getA, getB }) => {
      line.geometry.setFromPoints([getA(), getB()]);
      line.geometry.attributes.position.needsUpdate = true;
    });
  }

  function toggleSubjectLinks(button) {
    clearLinks();
    if (selectedSubjectButton === button) {
      selectedSubjectButton = null;
      planetMeshes
        .filter((planet) => planet.node.etecSubjectButton)
        .forEach((planet) => {
          planet.sphere.material.emissiveIntensity = 0.18;
          planet.halo.material.opacity = 0.8;
        });
      return;
    }

    selectedSubjectButton = button;
    planetMeshes
      .filter((planet) => planet.node.etecSubjectButton)
      .forEach((planet) => {
        const selected = planet === button;
        planet.sphere.material.emissiveIntensity = selected ? 0.9 : 0.18;
        planet.halo.material.opacity = selected ? 1 : 0.55;
      });

    const subject = button.node.materia;
    planetMeshes
      .filter((planet) => planet.node.etecQuestion && planet.node.materias?.includes(subject))
      .forEach((planet) => {
        linkLineDynamic(
          () => button.group.position.clone(),
          () => planet.group.position.clone(),
          button.node.color,
          0.9
        );
      });
  }

  async function buildPlanets(nodes) {
    clearPlanets();
    viewMode = 'layer';
    applyViewZoom('layer');
    if (!nodes.length) {
      notifyNav();
      return;
    }
    const skillLayer = nodes.length > 0 && nodes.every((n) => n.bnccSkill || n.etecMission);
    const questionLayer = nodes.length > 0 && nodes.every((n) => n.etecQuestion);
    const temasLayer = nodes.some((n) => n.temasIndice);
    const positions = orbitPositions(nodes.length, { skillLayer, questionLayer });
    if (questionLayer) {
      targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_LAYER, 1.05 - nodes.length * 0.01));
    } else if (skillLayer) {
      targetZoom = Math.max(0.45, Math.min(ZOOM_LAYER, 1.05 - nodes.length * 0.007));
    } else if (temasLayer && nodes.length > 14) {
      targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_LAYER, 15 / nodes.length));
    }
    const skillRadius = nodes.length > 28 ? 0.46 : nodes.length > 16 ? 0.52 : nodes.length > 10 ? 0.58 : 0.64;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const hasKids = node.children?.length || node.lazyKey;
      const hasMap = node.mindMap?.length || node.bnccSkill || node.etecMission;
      const caption = nodeCaption(node, progress);
      let sub = caption ? caption.text : 'TOQUE PARA APRENDER';
      if (!caption && hasKids) sub = 'ENTRAR NA CAMADA';
      else if (!caption && (node.bnccSkill || node.etecMission)) sub = 'ABRIR RECURSOS';
      else if (!caption && hasMap) sub = 'ABRIR MAPA DE IDEIAS';
      addPlanetAt(node, positions[i], {
        sub,
        subColor: caption?.color,
        radius: skillLayer ? skillRadius : 0.72
      });
      if (skillLayer && i > 0 && i % 10 === 0) {
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    if (questionLayer) {
      const subjectOrder = [
        'Português',
        'Matemática',
        'Biologia',
        'Física',
        'Química',
        'Geografia',
        'História',
        'Ciências da Natureza'
      ];
      const subjects = [...new Set(nodes.flatMap((node) => node.materias || []))].sort(
        (a, b) => subjectOrder.indexOf(a) - subjectOrder.indexOf(b)
      );
      const buttonPositions = ringPositions(subjects.length, 3.8, 0.78, 0.06);
      const subjectColors = [0x6eabff, 0xffb65c, 0x74e36f, 0xf27ec4, 0xc9a0ff, 0x65c8ff, 0xe8a87c, 0x81f1df];
      subjects.forEach((subject, index) => {
        addPlanetAt(
          {
            id: `etec-subject-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: subject,
            emoji: '●',
            color: subjectColors[index % subjectColors.length],
            cat: 'Matéria ETEC',
            materia: subject,
            etecSubjectButton: true
          },
          buttonPositions[index],
          { radius: 0.38, sub: 'VER QUESTÕES', subColor: '#eaf4ff' }
        );
      });
    }
    notifyNav();
  }

  function buildMindMap(hub) {
    clearPlanets();
    viewMode = 'mindmap';
    applyViewZoom('mindmap');
    const nodes = hub.mindMap || [];
    const materia = hub.materia || hub.facts?.[0] || hub.cat || hub.name;
    const hubPlanet = addPlanetAt(hub, [0, 0, 0], {
      radius: 1.05,
      hubBlue: true,
      centerMateria: materia
    });
    hubPlanet.isHub = true;
    const positions = mindMapPositions(nodes.length);
    const byId = new Map([[hub.id, hubPlanet]]);
    const hubPos = () => hubPlanet.group.position.clone();
    nodes.forEach((node, i) => {
      const p = addPlanetAt(node, positions[i], {
        radius: 0.56,
        sub: node.mindMap?.length ? 'APROFUNDAR MAPA' : 'TOQUE PARA DETALHES'
      });
      byId.set(node.id, p);
      linkLineDynamic(hubPos, () => p.group.position.clone());
    });
    nodes.forEach((node) => {
      const from = byId.get(node.id);
      if (!from || !node.links?.length) return;
      node.links.forEach((linkId) => {
        const to = byId.get(linkId);
        if (!to || to === from) return;
        linkLineDynamic(
          () => from.group.position.clone(),
          () => to.group.position.clone(),
          0x81f1df,
          0.45
        );
      });
    });
    notifyNav();
  }

  function showNodeChildren(node) {
    buildPlanets(node.children || []);
  }

  function refreshProgressVisuals() {
    planetMeshes.forEach((p) => {
      if (p.isHub) return;
      const visualState = progress ? resolveVisualState(p.node, progress) : 'default';
      const color = p.node.color ?? 0x88aaff;
      applyPlanetVisual(p.sphere, p.halo, color, visualState);
      p.visualState = visualState;
      const caption = nodeCaption(p.node, progress);
      if (caption && p.labelSprite) paintLabel(p.labelSprite, p.node, caption.text, caption.color);
    });
  }

  function navigateInto(node) {
    materializeNode(node);
    if (node.children?.length) {
      navStack.push(node);
      showNodeChildren(node);
      return;
    }
    if (node.mediaKind) {
      onLeafSelect(node);
      return;
    }
    if (node.etecQuestion) {
      navStack.push(node);
      buildMindMap({
        id: `${node.id}-hub`,
        name: node.name,
        emoji: node.emoji,
        materia: `Questão ${node.questao} · ${node.prova}`,
        summary: node.summary,
        etecQuestion: true,
        mindMap: buildSkillActivities(node)
      });
      return;
    }
    if (node.bnccSkill || node.etecMission) {
      navStack.push(node);
      const activities = buildSkillActivities(node);
      buildMindMap({
        id: `${node.id}-hub`,
        name: node.code || node.name,
        emoji: node.emoji,
        materia: node.materia || node.cat,
        summary: node.summary,
        code: node.code,
        questao: node.questao,
        prova: node.prova,
        tema: node.tema,
        etecMission: node.etecMission,
        hasProvaQuiz: node.hasProvaQuiz,
        mindMap: activities
      });
      if (node.etecMission && node.hasProvaQuiz) {
        const quiz = activities.find((a) => a.mediaKind === 'quiz');
        if (quiz) requestAnimationFrame(() => onLeafSelect(quiz));
      }
      return;
    }
    if (node.mindMap?.length) {
      navStack.push(node);
      buildMindMap(node);
      return;
    }
    onLeafSelect(node);
  }

  function navigateUp() {
    if (viewMode === 'mindmap' && navStack.length > 1) {
      navStack.pop();
      const node = currentNode();
      buildPlanets(node.children || []);
      notifyNav();
      return;
    }
    if (navStack.length > 1) {
      navStack.pop();
      showNodeChildren(currentNode());
      return;
    }
    if (rootLayersOpen) {
      rootLayersOpen = false;
      clearPlanets();
      viewMode = 'layer';
      notifyNav();
    }
  }

  function openRootLayers() {
    rootLayersOpen = true;
    navStack.length = 0;
    navStack.push(treeRoot);
    showNodeChildren(treeRoot);
  }

  function handlePick(hits) {
    if (!hits.length) return;
    const obj = hits[0].object;
    if (obj === coreMesh) {
      if (!rootLayersOpen && navStack.length === 1 && navStack[0].id === treeRoot.id) {
        openRootLayers();
      } else {
        navigateUp();
      }
      return;
    }
    const hit = planetMeshes.find((p) => p.sphere === obj);
    if (!hit) return;
    if (hit.node.etecSubjectButton) {
      toggleSubjectLinks(hit);
      return;
    }
    if (viewMode === 'mindmap') {
      onLeafSelect(hit.node);
      return;
    }
    navigateInto(hit.node);
  }

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050817);
    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
    camera.position.set(0, 1, 14);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0x9bbaff, 1.5));
    const light = new THREE.PointLight(0xffffff, 100);
    light.position.set(0, 5, 8);
    scene.add(light);
    root = new THREE.Group();
    scene.add(root);
    const starGeo = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 1300; i++) {
      positions.push((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 70, (Math.random() - 0.5) * 80);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xb9d8ff, size: 0.09 })));
    coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 2),
      new THREE.MeshStandardMaterial({
        color: 0x4de0cd,
        emissive: 0x0c6d86,
        emissiveIntensity: 1.2,
        metalness: 0.1,
        roughness: 0.3
      })
    );
    root.add(coreMesh);
    root.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.65, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x33e6db, transparent: true, opacity: 0.09, side: THREE.BackSide })
      )
    );
    const dna = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const a = i * 0.55;
      const y = (i - 10.5) * 0.12;
      for (let strand = 0; strand < 2; strand++) {
        const angle = a + strand * Math.PI;
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 12),
          new THREE.MeshStandardMaterial({
            color: strand ? 0x9d85ff : 0x79f4d9,
            emissive: strand ? 0x3a2478 : 0x12665d
          })
        );
        m.position.set(Math.cos(angle) * 0.65, y, Math.sin(angle) * 0.65);
        dna.add(m);
      }
    }
    root.add(dna);
    orbitGroup = new THREE.Group();
    linkGroup = new THREE.Group();
    root.add(orbitGroup);
    orbitGroup.add(linkGroup);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    const el = renderer.domElement;
    el.style.cursor = 'default';
    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      dragLast = { ...dragStart };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragLast.x;
      const dy = e.clientY - dragLast.y;
      targetRot.y += dx * 0.006;
      targetRot.x += dy * 0.004;
      targetRot.x = Math.max(-0.65, Math.min(0.65, targetRot.x));
      dragLast = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      dragging = false;
      if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > DRAG_CLICK_THRESHOLD) return;
      const r = el.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const targets = [coreMesh, ...planetMeshes.map((p) => p.sphere)];
      const hits = raycaster.intersectObjects(targets, false);
      // A click recenters the view so planets that drifted off-screen after
      // zooming can be found again; selection/navigation still uses the hit.
      targetZoom = ZOOM_LAYER;
      targetCameraPan.set(0, 0);
      handlePick(hits);
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        camera.updateMatrixWorld();
        raycaster.setFromCamera(mouse, camera);
        const zoomPoint = raycaster.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
          new THREE.Vector3()
        );
        const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom - e.deltaY * 0.002));
        if (zoomPoint && nextZoom !== zoom) {
          const shift = 1 - zoom / nextZoom;
          targetCameraPan.x = cameraPan.x + (zoomPoint.x - cameraPan.x) * shift;
          targetCameraPan.y = cameraPan.y + (zoomPoint.y - 1 - cameraPan.y) * shift;
        }
        targetZoom = nextZoom;
      },
      { passive: false }
    );
    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    notifyNav();
    animate();
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!renderer) return;
    const t = clock.getElapsedTime();
    if (root) {
      root.rotation.y += (targetRot.y - root.rotation.y) * 0.045;
      root.rotation.x += (targetRot.x - root.rotation.x) * 0.045;
      root.children[CORE_INDEX].rotation.y = t * 0.15;
      root.children[1].scale.setScalar(1 + Math.sin(t * 1.5) * 0.035);
      root.children[2].rotation.y = t * 0.22;
      const map = viewMode === 'mindmap';
      const floatY = map ? 0.2 : 0.06;
      const drift = map ? 0.22 : 0;
      planetMeshes.forEach((p, i) => {
        const ph = p.phase ?? i;
        const bx = p.baseX ?? p.group.position.x;
        const by = p.baseY ?? p.group.position.y;
        const bz = p.baseZ ?? p.group.position.z;
        p.group.position.y = by + Math.sin(t * 1.35 + ph) * floatY;
        if (drift) {
          p.group.position.x = bx + Math.sin(t * 0.75 + ph) * drift;
          p.group.position.z = bz + Math.cos(t * 0.65 + ph) * drift;
        }
        if (p.isHub) {
          const pulse = 1 + Math.sin(t * 1.8) * 0.04;
          p.sphere.scale.setScalar(pulse);
        }
        p.group.rotation.y = t * (map ? 0.08 : 0.12) + i * 0.3;
        p.halo.rotation.z = t * 0.18 + i;
      });
      if (mindMapLinkRefs.length) updateDynamicLinks();
      cameraPan.lerp(targetCameraPan, 0.12);
      zoom += (targetZoom - zoom) * 0.16;
      applyCameraDistance();
    }
    renderer.render(scene, camera);
  }

  return {
    start() {
      if (!renderer) init();
    },
    goUp() {
      navigateUp();
    },
    refreshProgress() {
      refreshProgressVisuals();
    },
    rebuildCurrentLayer() {
      if (viewMode === 'mindmap') {
        refreshProgressVisuals();
        return;
      }
      const node = currentNode();
      const children = node.children || [];
      const skillLayer =
        children.length > 0 && children.every((n) => n.bnccSkill || n.etecMission);
      if (skillLayer) {
        refreshProgressVisuals();
        return;
      }
      if (planetMeshes.length && children.length && children.length <= 20) {
        buildPlanets(children);
        return;
      }
      if (rootLayersOpen && node.id === treeRoot.id && treeRoot.children?.length <= 12) {
        buildPlanets(treeRoot.children);
        return;
      }
      refreshProgressVisuals();
    }
  };
}
