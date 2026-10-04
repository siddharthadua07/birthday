import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, particles, composer, controls;
let time = 0;
let isAnimationEnabled = true;
let currentTheme = 'molten';
let morphTarget = 0;
let morphProgress = 0;
let autoSequence = true;
let sequenceStartTime = 0;
let sequenceFinished = false;
let lastAutoStage = -1;
const particleCount = 10000;

// Overlay Image meshes & textures
let cakeMesh, sumanaMesh;
let cakeTexture, sumanaTexture;
let textOverlayElement = null;

// Background Audio
let bgAudio = null;

const themes = {
  molten: {
    name: 'Molten',
    colors: [
      new THREE.Color(0xff4800),
      new THREE.Color(0xff8c00),
      new THREE.Color(0xd73a00),
      new THREE.Color(0x3d1005),
      new THREE.Color(0xffc600)
    ],
    bloom: { strength: 0.35, radius: 0.45, threshold: 0.7 }
  },
  cosmic: {
    name: 'Cosmic',
    colors: [
      new THREE.Color(0x6a0dad),
      new THREE.Color(0x9370db),
      new THREE.Color(0x4b0082),
      new THREE.Color(0x8a2be2),
      new THREE.Color(0xdda0dd)
    ],
    bloom: { strength: 0.4, radius: 0.5, threshold: 0.65 }
  },
  emerald: {
    name: 'Emerald',
    colors: [
      new THREE.Color(0x00ff7f),
      new THREE.Color(0x3cb371),
      new THREE.Color(0x2e8b57),
      new THREE.Color(0x00fa9a),
      new THREE.Color(0x98fb98)
    ],
    bloom: { strength: 0.3, radius: 0.6, threshold: 0.75 }
  },
  roseRed: {
    name: 'Rose Red',
    colors: [
      new THREE.Color(0xff0043),
      new THREE.Color(0xff1744),
      new THREE.Color(0xd50000),
      new THREE.Color(0xff4081),
      new THREE.Color(0xff6b81)
    ],
    bloom: { strength: 0.45, radius: 0.55, threshold: 0.6 }
  }
};

document.addEventListener('DOMContentLoaded', init);

function initBackgroundMusic() {
  bgAudio = new Audio('1.mp3');
  bgAudio.loop = true;
  bgAudio.volume = 1.0;

  const playPromise = bgAudio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Browser autoplay policy agar block kare toh first interaction par automatically start hoga
      const startAudioOnInteraction = () => {
        bgAudio.play();
        window.removeEventListener('click', startAudioOnInteraction);
        window.removeEventListener('touchstart', startAudioOnInteraction);
        window.removeEventListener('keydown', startAudioOnInteraction);
      };
      window.addEventListener('click', startAudioOnInteraction);
      window.addEventListener('touchstart', startAudioOnInteraction);
      window.addEventListener('keydown', startAudioOnInteraction);
    });
  }
}

function createStarPath(particleIndex, totalParticles) {
  const numStarPoints = 5;
  const outerRadius = 35;
  const innerRadius = 15;
  const scale = 1.0;
  const zDepth = 4;

  const starVertices = [];
  for (let i = 0; i < numStarPoints; i++) {
    let angle = (i / numStarPoints) * Math.PI * 2 - Math.PI / 2;
    starVertices.push(new THREE.Vector2(outerRadius * Math.cos(angle), outerRadius * Math.sin(angle)));
    angle += Math.PI / numStarPoints;
    starVertices.push(new THREE.Vector2(innerRadius * Math.cos(angle), innerRadius * Math.sin(angle)));
  }

  const numSegments = starVertices.length;
  const t_path = (particleIndex / totalParticles) * numSegments;
  const segmentIndex = Math.floor(t_path) % numSegments;
  const segmentProgress = t_path - Math.floor(t_path);

  const startVertex = starVertices[segmentIndex];
  const endVertex = starVertices[(segmentIndex + 1) % numSegments];

  const x = THREE.MathUtils.lerp(startVertex.x, endVertex.x, segmentProgress);
  const y = THREE.MathUtils.lerp(startVertex.y, endVertex.y, segmentProgress);
  const z = Math.sin((particleIndex / totalParticles) * Math.PI * 4) * (zDepth / 2);

  const jitterStrength = 0.2;
  return new THREE.Vector3(
    x * scale + (Math.random() - 0.5) * jitterStrength,
    y * scale + (Math.random() - 0.5) * jitterStrength,
    z + (Math.random() - 0.5) * jitterStrength * 0.5
  );
}

function createHeartPath(particleIndex, totalParticles) {
  const t = (particleIndex / totalParticles) * Math.PI * 2;
  const scale = 2.2;

  let x = 16 * Math.pow(Math.sin(t), 3);
  let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 *
    Math.cos(3 * t) - Math.cos(4 * t);

  const finalX = x * scale;
  const finalY = y * scale;
  const z = Math.sin(t * 4) * 2;

  const jitterStrength = 0.2;
  return new THREE.Vector3(
    finalX + (Math.random() - 0.5) * jitterStrength,
    finalY + (Math.random() - 0.5) * jitterStrength,
    z + (Math.random() - 0.5) * jitterStrength * 0.5
  );
}

function createTypingUI() {
  textOverlayElement = document.createElement('div');
  textOverlayElement.id = 'birthday-text-overlay';
  textOverlayElement.style.position = 'fixed';
  textOverlayElement.style.top = '12%';
  textOverlayElement.style.left = '50%';
  textOverlayElement.style.transform = 'translateX(-50%)';
  textOverlayElement.style.textAlign = 'center';
  textOverlayElement.style.fontFamily = "'Montserrat', 'Cinzel', 'Poppins', sans-serif";
  textOverlayElement.style.fontWeight = '700';
  textOverlayElement.style.letterSpacing = '5px';
  textOverlayElement.style.color = '#fff6d5';
  textOverlayElement.style.textShadow = '0 0 10px #ffaa00, 0 0 25px #ff7700, 0 0 40px #ff3300';
  textOverlayElement.style.fontSize = '32px';
  textOverlayElement.style.lineHeight = '1.5';
  textOverlayElement.style.zIndex = '9999';
  textOverlayElement.style.pointerEvents = 'none';
  textOverlayElement.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
  textOverlayElement.style.whiteSpace = 'pre-line';
  textOverlayElement.innerHTML = '';
  document.body.appendChild(textOverlayElement);
}

function setupHeartImages() {
  const textureLoader = new THREE.TextureLoader();
  cakeTexture = textureLoader.load('cake.png');
  sumanaTexture = textureLoader.load('sumana.png');

  // Heart center ke hisab se 1:1 square plane
  const planeGeo = new THREE.PlaneGeometry(36, 36);

  // Cake Plane
  const cakeMaterial = new THREE.MeshBasicMaterial({
    map: cakeTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  cakeMesh = new THREE.Mesh(planeGeo, cakeMaterial);
  cakeMesh.position.set(0, 4, 0); // Heart shape ke visual center par align
  cakeMesh.scale.set(0.01, 0.01, 0.01);
  scene.add(cakeMesh);

  // Sumana Plane
  const sumanaMaterial = new THREE.MeshBasicMaterial({
    map: sumanaTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  sumanaMesh = new THREE.Mesh(planeGeo, sumanaMaterial);
  sumanaMesh.position.set(0, 4, 0);
  sumanaMesh.scale.set(0.01, 0.01, 0.01);
  scene.add(sumanaMesh);
}

function updateTypingText(elapsed) {
  if (!textOverlayElement) return;

  const fullText = "HAPPY BIRTHDAY\nSUMANA";
  const typeDuration = 9.0; // 9 second tak poora type hoga (Emerald aane se pehle)
  const fadeOutStart = 13.0; // 13s par fade out shuru
  const fadeOutEnd = 14.8; // 15s (Heart morph) se theek pehle invisible

  if (elapsed < typeDuration) {
    const charsToShow = Math.floor((elapsed / typeDuration) * fullText.length);
    textOverlayElement.innerText = fullText.slice(0, charsToShow);
    textOverlayElement.style.opacity = '1';
    textOverlayElement.style.textShadow = '0 0 10px #ffcc00, 0 0 20px #ff8800';
  } else if (elapsed < fadeOutStart) {
    // Highlighted glow state (Typing complete, bright gold highlight)
    textOverlayElement.innerText = fullText;
    textOverlayElement.style.opacity = '1';
    textOverlayElement.style.textShadow = '0 0 20px #ffffff, 0 0 40px #ffaa00, 0 0 60px #ff3300';
    textOverlayElement.style.transform = 'translateX(-50%) scale(1.05)';
  } else if (elapsed < fadeOutEnd) {
    // Fade out before heart morph
    const fadeProgress = (elapsed - fadeOutStart) / (fadeOutEnd - fadeOutStart);
    textOverlayElement.style.opacity = (1 - fadeProgress).toString();
    textOverlayElement.style.transform = `translateX(-50%) scale(${1.05 - fadeProgress * 0.15})`;
  } else {
    textOverlayElement.style.opacity = '0';
    textOverlayElement.innerText = '';
  }
}

function updateHeartCenterImages(elapsed) {
  if (!cakeMesh || !sumanaMesh) return;

  // Phase 1: 15s to 25s (Heart morph & hold) -> cake.png zooms and appears
  if (elapsed >= 15 && elapsed < 25) {
    const p1 = (elapsed - 15) / 10.0; // 0 to 1
    const zoomScale = THREE.MathUtils.lerp(0.2, 1.0, Math.min(1, p1 * 1.2));
    const opacityVal = Math.min(1.0, p1 * 1.5);

    cakeMesh.scale.set(zoomScale, zoomScale, zoomScale);
    cakeMesh.material.opacity = opacityVal;

    sumanaMesh.material.opacity = 0;
    sumanaMesh.scale.set(0.1, 0.1, 0.1);
  }
  // Phase 2: 25s onwards (Heart Complete) -> cake.png crossfades into sumana.png
  else if (elapsed >= 25 && elapsed < 30) {
    const crossFadeTime = (elapsed - 25) / 5.0; // 0 to 1

    // Cake fades out & scales slightly
    cakeMesh.material.opacity = Math.max(0, 1.0 - crossFadeTime * 1.5);
    cakeMesh.scale.set(1.0 + crossFadeTime * 0.1, 1.0 + crossFadeTime * 0.1, 1.0);

    // Sumana fades in & zooms smoothly to fit 1:1 heart frame
    const sumanaScale = THREE.MathUtils.lerp(0.4, 1.0, crossFadeTime);
    sumanaMesh.scale.set(sumanaScale, sumanaScale, sumanaScale);
    sumanaMesh.material.opacity = Math.min(1.0, crossFadeTime * 1.4);
  }
  // Phase 3: 30s+ -> Final hold with subtle gentle breath
  else if (elapsed >= 30) {
    cakeMesh.material.opacity = 0;
    const finalPulse = 1.0 + Math.sin((elapsed - 30) * 2.0) * 0.02;
    sumanaMesh.scale.set(finalPulse, finalPulse, finalPulse);
    sumanaMesh.material.opacity = 1.0;
  } else {
    cakeMesh.material.opacity = 0;
    sumanaMesh.material.opacity = 0;
  }
}

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.z = 90;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('container').appendChild(renderer.domElement);

  // createUI();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.rotateSpeed = 0.3;
  controls.minDistance = 30;
  controls.maxDistance = 300;
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.15;

  // Right-click allow karne ke liye OrbitControls se right click hata diya
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: null
  };

  // Browser standard right-click context menu allow karein
  renderer.domElement.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
  }, false);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  scene.userData.bloomPass = bloomPass;

  createParticleSystem();
  setupHeartImages();
  createTypingUI();
  initBackgroundMusic();

  window.addEventListener('resize', onWindowResize);

  setTheme(currentTheme);
  startAutoSequence();
  animate();
}

function createUI() {
  const controlsDiv = document.getElementById('controls');
  controlsDiv.innerHTML = '';

  const themeSelector = document.createElement('div');
  themeSelector.id = 'theme-selector';
  Object.keys(themes).forEach((themeKey) => {
    const button = document.createElement('button');
    button.className = 'theme-btn';
    button.dataset.theme = themeKey;
    button.textContent = themes[themeKey].name;
    button.addEventListener('click', () => setTheme(themeKey));
    themeSelector.appendChild(button);
  });
  controlsDiv.appendChild(themeSelector);

  const separator1 = document.createElement('div');
  separator1.className = 'separator';
  controlsDiv.appendChild(separator1);

  const actionSelector = document.createElement('div');
  actionSelector.id = 'action-selector';

  const morphBtn = document.createElement('button');
  morphBtn.className = 'action-btn';
  morphBtn.textContent = 'Morph';
  morphBtn.addEventListener('click', () => {
    morphBtn.classList.toggle('active');
    morphTarget = morphTarget === 0 ? 1 : 0;
  });
  actionSelector.appendChild(morphBtn);
  controlsDiv.appendChild(actionSelector);

  const separator2 = document.createElement('div');
  separator2.className = 'separator';
  controlsDiv.appendChild(separator2);

  const toggleOption = document.createElement('div');
  toggleOption.className = 'toggle-option';

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle-switch';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'animateToggle';
  toggleInput.checked = true;
  toggleInput.addEventListener('change', (e) => {
    isAnimationEnabled = e.target.checked;
  });

  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'toggle-slider';

  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleSlider);

  const labelForToggle = document.createElement('label');
  labelForToggle.htmlFor = 'animateToggle';
  labelForToggle.textContent = 'Animate';

  toggleOption.appendChild(toggleLabel);
  toggleOption.appendChild(labelForToggle);
  controlsDiv.appendChild(toggleOption);
}

function startAutoSequence() {
  autoSequence = true;
  sequenceFinished = false;
  lastAutoStage = -1;

  sequenceStartTime = time;

  // Start from Molten
  setTheme('molten');

  // Start as Star
  morphTarget = 0;

  // Animation always ON
  isAnimationEnabled = true;
}

function updateAutoSequence() {
  if (!autoSequence || sequenceFinished) return;

  const elapsed = time - sequenceStartTime;

  // Text Typing and Images dynamic controller
  updateTypingText(elapsed);
  updateHeartCenterImages(elapsed);

  let stage = 0;

  // 0 - 5 sec (Molten Theme)
  if (elapsed < 5) {
    stage = 0;
  }
  // 5 - 10 sec (Cosmic Theme)
  else if (elapsed < 10) {
    stage = 1;
  }
  // 10 - 15 sec (Emerald Theme - Star finishes)
  else if (elapsed < 15) {
    stage = 2;
  }
  // 15 - 20 sec (Heart Morph begins)
  else if (elapsed < 20) {
    stage = 3;
  }
  // 20 - 25 sec (Heart Hold & Rose Red transition)
  else if (elapsed < 25) {
    stage = 4;
  }
  // 25 - 30 sec (Cake fades out, Sumana image blooms)
  else {
    stage = 5;
  }

  // Only change theme/morph when stage changes
  if (stage !== lastAutoStage) {
    lastAutoStage = stage;

    switch (stage) {
      // MOLTEN
      case 0:
        setTheme('molten');
        morphTarget = 0;
        break;

      // COSMIC
      case 1:
        setTheme('cosmic');
        morphTarget = 0;
        break;

      // EMERALD (Star final color)
      case 2:
        setTheme('emerald');
        morphTarget = 0;
        break;

      // MORPH START (Start transforming to heart in Emerald)
      case 3:
        setTheme('emerald');
        morphTarget = 1;
        break;

      // HEART HOLD -> Changes to Rose Red as Heart forms!
      case 4:
        setTheme('roseRed');
        morphTarget = 1;
        break;

      // FINAL HEART in Rose Red
      case 5:
        setTheme('roseRed');
        morphTarget = 1;
        break;
    }
  }

  // Final heart pulse
  if (stage >= 4 && particles) {
    const pulseTime = elapsed - 20;
    particles.scale.set(1, 1, 1);
  }

  // After 30 seconds -> COMPLETE
  if (elapsed >= 30) {
    sequenceFinished = true;
    autoSequence = false;
    morphTarget = 1;
    setTheme('roseRed');

    if (particles) {
      particles.scale.set(1, 1, 1);
    }

    console.log("❤️ Animation Complete");
  }
}

function createParticleSystem() {
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const starPositions = new Float32Array(particleCount * 3);
  const heartPositions = new Float32Array(particleCount * 3);
  const disintegrationOffsets = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    const starPos = createStarPath(i, particleCount);
    const heartPos = createHeartPath(i, particleCount);

    positions[i3] = starPos.x;
    positions[i3 + 1] = starPos.y;
    positions[i3 + 2] = starPos.z;

    starPositions[i3] = starPos.x;
    starPositions[i3 + 1] = starPos.y;
    starPositions[i3 + 2] = starPos.z;

    heartPositions[i3] = heartPos.x;
    heartPositions[i3 + 1] = heartPos.y;
    heartPositions[i3 + 2] = heartPos.z;

    const { color, size } = getAttributesForParticle(i);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    sizes[i] = size;

    const offsetStrength = 30 + Math.random() * 40;
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1);

    disintegrationOffsets[i3] = Math.sin(theta) * Math.cos(phi) * offsetStrength;
    disintegrationOffsets[i3 + 1] = Math.sin(theta) * Math.sin(phi) * offsetStrength;
    disintegrationOffsets[i3 + 2] = Math.cos(theta) * offsetStrength * 0.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('starPosition', new THREE.BufferAttribute(starPositions, 3));
  geometry.setAttribute('heartPosition', new THREE.BufferAttribute(heartPositions, 3));
  geometry.setAttribute('disintegrationOffset', new THREE.BufferAttribute(disintegrationOffsets, 3));

  const texture = createParticleTexture();
  const material = new THREE.PointsMaterial({
    size: 2.8,
    map: texture,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    alphaTest: 0.01
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);
}

function getAttributesForParticle(i) {
  const t = i / particleCount;
  const colorPalette = themes[currentTheme].colors;

  const colorProgress = (t * colorPalette.length * 1.5 + time * 0.05) % colorPalette.length;
  const colorIndex1 = Math.floor(colorProgress);
  const colorIndex2 = (colorIndex1 + 1) % colorPalette.length;
  const blendFactor = colorProgress - colorIndex1;

  const color1 = colorPalette[colorIndex1];
  const color2 = colorPalette[colorIndex2];
  const baseColor = new THREE.Color().lerpColors(color1, color2, blendFactor);

  const color = baseColor.clone().multiplyScalar(0.65 + Math.random() * 0.55);
  const size = 0.65 + Math.random() * 0.6;

  return { color, size };
}

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size * 0.45;
  const innerRadius = size * 0.2;
  const numPoints = 5;

  context.beginPath();
  context.moveTo(centerX, centerY - outerRadius);
  for (let i = 0; i < numPoints; i++) {
    const outerAngle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
    context.lineTo(centerX + outerRadius * Math.cos(outerAngle), centerY + outerRadius * Math.sin(outerAngle));
    const innerAngle = outerAngle + Math.PI / numPoints;
    context.lineTo(centerX + innerRadius * Math.cos(innerAngle), centerY + innerRadius * Math.sin(innerAngle));
  }
  context.closePath();

  const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 220, 0.9)');
  gradient.addColorStop(0.6, 'rgba(255, 200, 150, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');

  context.fillStyle = gradient;
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function animateParticles() {
  if (!particles || !isAnimationEnabled) return;

  const positions = particles.geometry.attributes.position.array;
  const starPositions = particles.geometry.attributes.starPosition.array;
  const heartPositions = particles.geometry.attributes.heartPosition.array;
  const particleColors = particles.geometry.attributes.color.array;
  const particleSizes = particles.geometry.attributes.size.array;
  const disintegrationOffsets = particles.geometry.attributes.disintegrationOffset.array;

  morphProgress += (morphTarget - morphProgress) * 0.04;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const iSize = i;

    const homeX = THREE.MathUtils.lerp(starPositions[i3], heartPositions[i3], morphProgress);
    const homeY = THREE.MathUtils.lerp(starPositions[i3 + 1], heartPositions[i3 + 1], morphProgress);
    const homeZ = THREE.MathUtils.lerp(starPositions[i3 + 2], heartPositions[i3 + 2], morphProgress);

    let disintegrationAmount = 0;

    // Sequence complete hone par disintegration band rahegi taaki Heart clear dikhe
    if (!sequenceFinished) {
      const disintegrationCycleTime = 20.0;
      const particleCycleOffset = (i / particleCount) * disintegrationCycleTime * 0.5;
      const cycleProgress = ((time * 0.6 + particleCycleOffset) % disintegrationCycleTime) / disintegrationCycleTime;

      const stablePhaseEnd = 0.5;
      const disintegrateStartPhase = stablePhaseEnd;
      const disintegrateFullPhase = stablePhaseEnd + 0.15;
      const holdPhaseEnd = disintegrateFullPhase + 0.1;

      if (cycleProgress < stablePhaseEnd) {
        disintegrationAmount = 0;
      } else if (cycleProgress < disintegrateFullPhase) {
        disintegrationAmount = (cycleProgress - disintegrateStartPhase) / (disintegrateFullPhase - disintegrateStartPhase);
      } else if (cycleProgress < holdPhaseEnd) {
        disintegrationAmount = 1.0;
      } else {
        disintegrationAmount = 1.0 - (cycleProgress - holdPhaseEnd) / (1.0 - holdPhaseEnd);
      }

      disintegrationAmount = Math.sin(disintegrationAmount * Math.PI * 0.5);
    }

    let currentTargetX = homeX;
    let currentTargetY = homeY;
    let currentTargetZ = homeZ;
    let currentLerpFactor = 0.085;

    if (disintegrationAmount > 0.001) {
      currentTargetX = homeX + disintegrationOffsets[i3] * disintegrationAmount;
      currentTargetY = homeY + disintegrationOffsets[i3 + 1] * disintegrationAmount;
      currentTargetZ = homeZ + disintegrationOffsets[i3 + 2] * disintegrationAmount;
      currentLerpFactor = 0.045 + disintegrationAmount * 0.02;
    }

    positions[i3] += (currentTargetX - positions[i3]) * currentLerpFactor;
    positions[i3 + 1] += (currentTargetY - positions[i3 + 1]) * currentLerpFactor;
    positions[i3 + 2] += (currentTargetZ - positions[i3 + 2]) * currentLerpFactor;

    const { color: baseParticleColor, size: baseParticleSize } = getAttributesForParticle(i);

    let brightnessFactor =
      (0.65 + Math.sin((i / particleCount) * Math.PI * 7 + time * 1.3) * 0.35) * (1 - disintegrationAmount * 0.75);
    brightnessFactor *= 0.85 + Math.sin(time * 7 + i * 0.5) * 0.15;

    particleColors[i3] = baseParticleColor.r * brightnessFactor;
    particleColors[i3 + 1] = baseParticleColor.g * brightnessFactor;
    particleColors[i3 + 2] = baseParticleColor.b * brightnessFactor;

    let currentSize = baseParticleSize * (1 - disintegrationAmount * 0.9);
    currentSize *= 0.8 + Math.sin(time * 5 + i * 0.3) * 0.2;
    particleSizes[iSize] = Math.max(0.05, currentSize);
  }

  particles.geometry.attributes.position.needsUpdate = true;
  particles.geometry.attributes.color.needsUpdate = true;
  particles.geometry.attributes.size.needsUpdate = true;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function setTheme(themeName) {
  if (!themes[themeName]) return;
  currentTheme = themeName;

  document.body.className = `theme-${currentTheme}`;
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === themeName);
  });

  const theme = themes[currentTheme];
  const bloomPass = scene.userData.bloomPass;
  if (bloomPass) {
    bloomPass.strength = theme.bloom.strength;
    bloomPass.radius = theme.bloom.radius;
    bloomPass.threshold = theme.bloom.threshold;
  }

  updateParticleColorsAndSizes();
}

function updateParticleColorsAndSizes() {
  if (!particles) return;

  const pColors = particles.geometry.attributes.color.array;
  const pSizes = particles.geometry.attributes.size.array;

  for (let i = 0; i < particleCount; i++) {
    const { color, size } = getAttributesForParticle(i);
    pColors[i * 3] = color.r;
    pColors[i * 3 + 1] = color.g;
    pColors[i * 3 + 2] = color.b;
    pSizes[i] = size;
  }

  particles.geometry.attributes.color.needsUpdate = true;
  particles.geometry.attributes.size.needsUpdate = true;
}

function animate() {
  requestAnimationFrame(animate);

  time += 0.02;

  controls.update();

  if (isAnimationEnabled) {
    updateAutoSequence();
    animateParticles();
  }

  // Camera face karte huye images sync rahein
  if (cakeMesh && sumanaMesh) {
    cakeMesh.quaternion.copy(camera.quaternion);
    sumanaMesh.quaternion.copy(camera.quaternion);
  }

  composer.render();
}