import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const MM = 1;
const ENCLOSURE = { width: 124.5, depth: 124.5, height: 88.9, wall: 3.0, floor: 3.2 };
const INNER = { minX: -56, maxX: 56, minZ: -56, maxZ: 56 };
const GROUP_ORDER = [
  'Enclosure', 'Controller', 'Display subsystem', 'Sensors', 'Power and controls',
  'Solar charging', 'Mounting', 'Connectors', 'Wiring and harnesses'
];

const palette = {
  bg: 0x11161d,
  primary: 0x4ed7c8,
  accent: 0xffb85c,
  white: 0xf4f7fb,
  enclosure: 0x8794a3,
  clear: 0xdcefff,
  pcbBlue: 0x17669f,
  pcbBlack: 0x15191f,
  pcbRed: 0xc4322f,
  pcbGreen: 0x1c6c4c,
  gold: 0xd8ad43,
  copper: 0xb7682d,
  steel: 0xbac3cb,
  black: 0x15191d,
  battery: 0xc5c8ca,
  screen: 0xdbe1d7,
};

const wireColors = {
  '3V3_MAIN': '#e43f3f',
  GND: '#191919',
  GNSS_TX: '#9d5cff',
  GNSS_RX: '#49a6ff',
  RVC_RX: '#2ed0b2',
  LCD_SCLK: '#f2c14e',
  LCD_SI: '#f28f3b',
  LCD_SCS: '#00b8d9',
  LCD_EXTCOMIN: '#ea6fbb',
  LCD_DISP: '#8bc34a',
  LCD_5V: '#ff2d2d',
  C_DISP: '#d7d7d7',
  C_VDDA: '#d7d7d7',
  C_VDD: '#d7d7d7',
  ZERO: '#ef5350',
  ZERO_GND: '#202020',
  POWER_EN: '#fb8c00',
  POWER_EN_GND: '#202020',
  USB_EXT: '#6d7b8c',
  BATTERY: '#c62828',
  SOLAR_IN_POS: '#ff7043',
  SOLAR_IN_NEG: '#1f1f1f',
  SOLAR_BAT_POS: '#ff3d00',
  SOLAR_TO_BAT: '#ff8f00',
  SOLAR_BAT_NEG: '#1f1f1f',
  RELAY_VBUS: '#ef5350',
  RELAY_GND: '#202020',
  RELAY_TRIGGER: '#ab47bc',
};

const state = {
  renderer: null,
  labelRenderer: null,
  scene: null,
  perspectiveCamera: null,
  orthoCamera: null,
  camera: null,
  orbit: null,
  transform: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  components: new Map(),
  connectorObjects: new Map(),
  selectedId: null,
  activeTool: 'orbit',
  projection: 'perspective',
  wireRoutes: [],
  wireGroup: null,
  labelsVisible: true,
  exploded: false,
  routeTimer: null,
  initialized: false,
  userInteracting: false,
  cadMode: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const viewport = $('#viewport');

function makeMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.48,
    metalness: options.metalness ?? 0.05,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    transmission: options.transmission ?? 0,
    thickness: options.thickness ?? 0,
    clearcoat: options.clearcoat ?? 0.15,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.35,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
  });
}

function box(w, h, d, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(r, h, material, position = [0, 0, 0], rotation = [0, 0, 0], segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addEdges(mesh, color = 0x26333f, opacity = 0.72) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 25),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(edges);
  return edges;
}

function componentRoot(id) {
  const root = new THREE.Group();
  root.name = id;
  root.userData.componentId = id;
  return root;
}

function addLabel(root, text, offset = [0, 12, 0]) {
  const element = document.createElement('div');
  element.className = 'label';
  element.textContent = text;
  const label = new CSS2DObject(element);
  label.position.set(...offset);
  label.userData.isLabel = true;
  root.add(label);
  return label;
}

function addConnectorVisual(root, connector, componentId) {
  const type = connector.type || 'pad';
  let mesh;
  const mat = makeMaterial(type.includes('SMA') ? palette.gold : type.includes('USB') ? palette.steel : 0xe6e9ec, {
    metalness: type.includes('SMA') || type.includes('USB') ? .75 : .12,
    roughness: .28,
  });
  if (type.includes('SMA') || type.includes('U.FL')) {
    mesh = cylinder(type.includes('SMA') ? 2.5 : 1.4, type.includes('SMA') ? 4 : 1.2, mat, connector.local, [Math.PI / 2, 0, 0], 24);
  } else if (type.includes('JST') || type.includes('Qwiic')) {
    mesh = box(6, 3.4, 4.2, mat, connector.local);
  } else if (type.includes('USB')) {
    mesh = box(8.8, 3.4, 6.2, mat, connector.local);
  } else if (type.includes('FPC')) {
    mesh = box(16, 2, 4.5, mat, connector.local);
  } else if (type.includes('switch') || type.includes('lug')) {
    mesh = cylinder(1.2, 3.4, mat, connector.local, [Math.PI / 2, 0, 0], 16);
  } else {
    mesh = cylinder(.9, 1.2, mat, connector.local, [Math.PI / 2, 0, 0], 12);
  }
  mesh.name = `${componentId}:${connector.id}`;
  mesh.userData.componentId = componentId;
  mesh.userData.connectorId = connector.id;
  mesh.userData.isConnector = true;
  root.add(mesh);
  state.connectorObjects.set(`${componentId}.${connector.id}`, mesh);
  return mesh;
}

function registerComponent(def) {
  const root = def.root;
  root.position.fromArray(def.position || [0, 0, 0]);
  root.rotation.set(...(def.rotation || [0, 0, 0]));
  root.userData.componentId = def.id;
  root.traverse((obj) => {
    if (obj.isMesh || obj.isLine || obj.isLineSegments) {
      obj.userData.componentId = def.id;
    }
  });
  def.connectors = def.connectors || [];
  def.connectors.forEach((connector) => addConnectorVisual(root, connector, def.id));
  if (def.label !== false) addLabel(root, def.shortLabel || def.name, def.labelOffset || [0, (def.dimensions?.height || 10) / 2 + 6, 0]);
  state.scene.add(root);
  state.components.set(def.id, {
    state: def.initialState || 'solid',
    opacity: def.initialState === 'translucent' ? .23 : 1,
    original: { position: root.position.clone(), rotation: root.rotation.clone(), scale: root.scale.clone() },
    ...def,
  });
  applyComponentState(def.id, def.initialState || 'solid', false);
  return root;
}

function createEnclosure() {
  const shell = componentRoot('enclosure-shell');
  const mat = makeMaterial(palette.enclosure, { roughness: .62, metalness: 0, opacity: .48, transparent: true, transmission: .08, thickness: 1 });
  const floor = box(ENCLOSURE.width, ENCLOSURE.floor, ENCLOSURE.depth, mat, [0, ENCLOSURE.floor / 2, 0]);
  addEdges(floor, 0x435160, .65); shell.add(floor);
  const wallH = ENCLOSURE.height - 8;
  const wallY = ENCLOSURE.floor + wallH / 2;
  const back = box(ENCLOSURE.width, wallH, ENCLOSURE.wall, mat, [0, wallY, -ENCLOSURE.depth / 2 + ENCLOSURE.wall / 2]);
  const front = box(ENCLOSURE.width, wallH, ENCLOSURE.wall, mat, [0, wallY, ENCLOSURE.depth / 2 - ENCLOSURE.wall / 2]);
  const left = box(ENCLOSURE.wall, wallH, ENCLOSURE.depth - 2 * ENCLOSURE.wall, mat, [-ENCLOSURE.width / 2 + ENCLOSURE.wall / 2, wallY, 0]);
  const right = box(ENCLOSURE.wall, wallH, ENCLOSURE.depth - 2 * ENCLOSURE.wall, mat, [ENCLOSURE.width / 2 - ENCLOSURE.wall / 2, wallY, 0]);
  [back, front, left, right].forEach((m) => { addEdges(m, 0x45515e, .48); shell.add(m); });
  registerComponent({
    id: 'enclosure-shell', name: 'Bottom enclosure shell', shortLabel: 'IP67 enclosure', group: 'Enclosure', root: shell,
    dimensions: { width: ENCLOSURE.width, depth: ENCLOSURE.depth, height: ENCLOSURE.height },
    material: 'ABS', source: 'Physical dimensions', confidence: 'Measured baseline', movable: false, initialState: 'translucent', label: false,
    connectors: [],
  });

  const lid = componentRoot('clear-lid');
  const lidMat = makeMaterial(palette.clear, { roughness: .12, metalness: 0, transparent: true, opacity: .28, transmission: .72, thickness: 2.4, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  const lidPlate = box(ENCLOSURE.width - 4, 3.4, ENCLOSURE.depth - 4, lidMat, [0, 0, 0]);
  addEdges(lidPlate, 0x6d7f90, .82); lid.add(lidPlate);
  lid.position.y = ENCLOSURE.height - 5;
  registerComponent({
    id: 'clear-lid', name: 'Clear polycarbonate lid', shortLabel: 'Clear lid', group: 'Enclosure', root: lid,
    dimensions: { width: ENCLOSURE.width - 4, depth: ENCLOSURE.depth - 4, height: 3.4 },
    material: 'Clear polycarbonate', source: 'Procedural measured analog', confidence: 'High', movable: true, initialState: 'translucent', label: false,
  });

  const gasket = componentRoot('lid-gasket');
  const gasketMat = makeMaterial(0x2e343a, { roughness: .86 });
  const outer = new THREE.Shape(); outer.moveTo(-58, -58); outer.lineTo(58, -58); outer.lineTo(58, 58); outer.lineTo(-58, 58); outer.closePath();
  const inner = new THREE.Path(); inner.moveTo(-54, -54); inner.lineTo(-54, 54); inner.lineTo(54, 54); inner.lineTo(54, -54); inner.closePath(); outer.holes.push(inner);
  const geom = new THREE.ExtrudeGeometry(outer, { depth: 1.8, bevelEnabled: false });
  const ring = new THREE.Mesh(geom, gasketMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0; gasket.add(ring);
  gasket.position.y = ENCLOSURE.height - 7.2;
  registerComponent({ id:'lid-gasket', name:'Lid gasket', group:'Enclosure', root:gasket, dimensions:{width:116,depth:116,height:1.8}, material:'Elastomer', source:'Procedural analog', confidence:'High', movable:false, label:false });

  const standoffRoot = componentRoot('standoffs');
  const steel = makeMaterial(palette.steel, { metalness: .65, roughness: .28 });
  [[-54,-54],[54,-54],[-54,54],[54,54]].forEach(([x,z]) => {
    const post = cylinder(5.2, 11, steel, [x, 7.5, z], [0,0,0], 24); standoffRoot.add(post);
    const hole = cylinder(1.7, 11.5, makeMaterial(0x282d33,{roughness:.7}), [x,7.6,z], [0,0,0], 20); standoffRoot.add(hole);
  });
  registerComponent({ id:'standoffs', name:'Corner standoff posts (4)', group:'Enclosure', root:standoffRoot, dimensions:{diameter:10.4,height:11}, material:'Nickel-plated steel / ABS', source:'Measured analog', confidence:'Medium', movable:false, label:false });
}

function createPCB({ id, name, shortLabel, group, width, depth, color, position, rotation = [0,0,0], connectors = [], source, confidence, labelOffset, chips = 8 }) {
  const root = componentRoot(id);
  const boardMat = makeMaterial(color, { roughness: .56, metalness: .05 });
  const board = box(width, 1.6, depth, boardMat, [0, 0, 0]);
  addEdges(board, 0x0c151a, .75); root.add(board);
  const traceMat = new THREE.LineBasicMaterial({ color: 0xc99e38, transparent: true, opacity: .38 });
  for (let i=0;i<Math.min(chips,10);i++) {
    const px = -width/2 + 4 + ((i*7.7) % Math.max(5,width-8));
    const pz = -depth/2 + 5 + ((i*11.3) % Math.max(5,depth-10));
    const cw = i % 3 === 0 ? 5 : 2.8;
    const cd = i % 4 === 0 ? 6 : 3.2;
    const chip = box(cw, i % 3 === 0 ? 1.6 : 1.1, cd, makeMaterial(0x101419,{roughness:.72}), [px,1.35,pz]); root.add(chip);
    const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, .9, pz), new THREE.Vector3(px + (i%2?4:-4), .9, pz + 3)]);
    root.add(new THREE.Line(lineGeom, traceMat));
  }
  const holes = [[-width/2+2.6,-depth/2+2.6],[width/2-2.6,-depth/2+2.6],[-width/2+2.6,depth/2-2.6],[width/2-2.6,depth/2-2.6]];
  holes.forEach(([x,z]) => root.add(cylinder(1.1,2.2,makeMaterial(0xd8b653,{metalness:.65,roughness:.32}),[x,.2,z],[],16)));
  registerComponent({ id,name,shortLabel,group,root,position,rotation,dimensions:{width,depth,height:5.5},material:'FR-4 PCB assembly',source,confidence,movable:true,connectors,labelOffset });
  return root;
}

function createElectronics() {
  createPCB({
    id:'feather', name:'Adafruit ESP32-S3 Feather 4MB / 2MB PSRAM', shortLabel:'ESP32-S3 Feather', group:'Controller', width:23, depth:51, color:palette.pcbBlack, position:[0,9,-2], rotation:[0,0,0], source:'Adafruit 5477 dimensions', confidence:'High', labelOffset:[0,12,0], chips:10,
    connectors:[
      {id:'3V',label:'3V',type:'solder pad',local:[-10,2,-19]}, {id:'GND',label:'GND',type:'solder pad',local:[-10,2,19]},
      {id:'TX',label:'TX',type:'solder pad',local:[10,2,-17]}, {id:'RX',label:'RX',type:'solder pad',local:[10,2,-13]},
      {id:'6',label:'6',type:'solder pad',local:[10,2,-4]}, {id:'SCK',label:'SCK',type:'solder pad',local:[10,2,4]},
      {id:'MO',label:'MO',type:'solder pad',local:[10,2,8]}, {id:'9',label:'9',type:'solder pad',local:[10,2,12]},
      {id:'10',label:'10',type:'solder pad',local:[10,2,16]}, {id:'11',label:'11',type:'solder pad',local:[10,2,20]},
      {id:'12',label:'12',type:'solder pad',local:[-10,2,-11]}, {id:'EN',label:'EN',type:'solder pad',local:[-10,2,12]},
      {id:'USB',label:'USB / VBUS',type:'solder pad',local:[-10,2,7]}, {id:'BAT',label:'BAT',type:'solder pad',local:[-10,2,2]},
      {id:'USB-C',label:'USB-C receptacle',type:'USB-C receptacle',local:[0,2,25]}, {id:'JST-PH',label:'JST-PH battery',type:'JST-PH 2-pin',local:[0,2,-25]},
    ]
  });

  createPCB({
    id:'bno085', name:'Adafruit BNO085 9-DOF orientation breakout', shortLabel:'BNO085', group:'Sensors', width:25.4, depth:30.5, color:palette.pcbBlue, position:[-36,8,-26], rotation:[0,0,0], source:'Adafruit 4754 board analog', confidence:'High', labelOffset:[0,10,0], chips:7,
    connectors:[
      {id:'VIN',label:'VIN',type:'solder pad',local:[-10,2,12]}, {id:'GND',label:'GND',type:'solder pad',local:[-6,2,12]},
      {id:'SDA',label:'SDA / UART-RVC TX',type:'solder pad',local:[-2,2,12]}, {id:'P0',label:'P0 mode strap',type:'solder pad',local:[8,2,-12]},
      {id:'QWIIC',label:'STEMMA QT / Qwiic',type:'JST-SH/Qwiic 4-pin',local:[0,2,-15]},
    ]
  });

  const gnss = createPCB({
    id:'gnss', name:'SparkFun NEO-F10N GNSS L1/L5 breakout', shortLabel:'NEO-F10N GNSS', group:'Sensors', width:43, depth:43, color:palette.pcbRed, position:[34,8,-25], source:'SparkFun official GLB + board dimensions', confidence:'Manufacturer CAD', labelOffset:[0,13,0], chips:5,
    connectors:[
      {id:'3V3',label:'3V3',type:'JST-GH / solder pad',local:[-20,2,14]}, {id:'GND',label:'GND',type:'JST-GH / solder pad',local:[-20,2,8]},
      {id:'RX',label:'RX',type:'JST-GH / solder pad',local:[-20,2,2]}, {id:'TX',label:'TX',type:'JST-GH / solder pad',local:[-20,2,-4]},
      {id:'SMA',label:'SMA antenna',type:'SMA female',local:[21,3,0]}, {id:'USB-C',label:'USB-C service',type:'USB-C receptacle',local:[0,2,21]},
    ]
  });
  gnss.userData.proceduralBoard = true;

  createPCB({
    id:'miniboost', name:'Adafruit AP3602A MiniBoost 5 V charge pump', shortLabel:'AP3602A MiniBoost', group:'Display subsystem', width:18, depth:25, color:palette.pcbBlue, position:[20,8,5], source:'Adafruit 3661 source board analog', confidence:'High', labelOffset:[0,9,0], chips:5,
    connectors:[
      {id:'In',label:'In',type:'solder pad',local:[-7,2,-10]}, {id:'G',label:'G',type:'solder pad',local:[-2,2,-10]},
      {id:'5Vo',label:'5Vo',type:'solder pad',local:[7,2,-10]}, {id:'En',label:'En',type:'solder pad',local:[2,2,-10]},
    ]
  });

  createPCB({
    id:'fpc-breakout', name:'10-pin 0.5 mm FFC/FPC breakout', shortLabel:'FPC breakout', group:'Display subsystem', width:24, depth:18, color:palette.pcbGreen, position:[-31,8,41], source:'B0CXPY895M dimensional analog', confidence:'Medium', labelOffset:[0,9,0], chips:2,
    connectors:[
      {id:'FPC',label:'10-pin FPC ZIF',type:'FPC 10-pin 0.5 mm',local:[0,2,7]},
      ...Array.from({length:10},(_,i)=>({id:`P${i+1}`,label:`Mapped pin ${i+1}`,type:'solder pad',local:[-10+i*2.2,2,-7]}))
    ]
  });
}

function createDisplay() {
  const root = componentRoot('sharp-display');
  const frame = box(73,3.2,56,makeMaterial(0x1a2328,{roughness:.52,metalness:.2}),[0,0,0]); addEdges(frame,0x0a0e11,.9); root.add(frame);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width=640; screenCanvas.height=480;
  const ctx=screenCanvas.getContext('2d'); ctx.fillStyle='#dfe5d9';ctx.fillRect(0,0,640,480);ctx.strokeStyle='#1a1c1b';ctx.lineWidth=7;ctx.strokeRect(14,14,612,452);
  ctx.fillStyle='#111';ctx.font='bold 54px Arial';ctx.fillText('VMG',35,72);ctx.font='bold 100px Arial';ctx.fillText('1.23',30,177);ctx.font='38px Arial';ctx.fillText('kt',255,168);
  ctx.lineWidth=4;ctx.beginPath();ctx.arc(435,280,120,Math.PI,2*Math.PI);ctx.stroke();ctx.font='bold 52px Arial';ctx.fillText('040°',368,310);ctx.font='28px Arial';ctx.fillText('ANGLE FROM ZERO',326,360);
  for(let a=0;a<=180;a+=15){const r=a*Math.PI/180;ctx.beginPath();ctx.moveTo(435+Math.cos(Math.PI-r)*104,280-Math.sin(r)*104);ctx.lineTo(435+Math.cos(Math.PI-r)*118,280-Math.sin(r)*118);ctx.stroke();}
  const tex=new THREE.CanvasTexture(screenCanvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const screen=box(67,.8,49,new THREE.MeshStandardMaterial({map:tex,roughness:.58,metalness:0}),[0,2,0]);root.add(screen);
  const fpc=box(12,.6,16,makeMaterial(0xc68127,{metalness:.35,roughness:.45}),[0,-.4,34]);root.add(fpc);
  registerComponent({
    id:'sharp-display', name:'Sharp LS044Q7DH01 4.4 inch memory LCD', shortLabel:'Sharp memory LCD', group:'Display subsystem', root,
    position:[-24,15,24], rotation:[0,0,0], dimensions:{width:73,depth:72,height:4}, material:'Reflective memory LCD / steel frame', source:'Sharp panel dimensions', confidence:'High', movable:true, labelOffset:[-25,8,-15],
    connectors:Array.from({length:10},(_,i)=>({id:`P${i+1}`,label:['SCLK','SI','SCS','EXTCOMIN','DISP','VDDA','VDD','EXTMODE','VSS','VSSA'][i],type:'FPC 10-pin 0.5 mm',local:[-9+i*2,0,34]}))
  });

  const caps=componentRoot('display-caps');
  const capMat=makeMaterial(0xe8d28e,{roughness:.45});
  [[-33,8,48],[-28,8,48],[-23,8,48]].forEach(([x,y,z],i)=>{ const c=box(2.8,5,1.5,capMat,[x,y,z]);caps.add(c); });
  registerComponent({id:'display-caps',name:'Sharp display reference capacitors',shortLabel:'Display capacitors',group:'Display subsystem',root:caps,dimensions:{width:14,depth:4,height:5},material:'C0G / X7R radial capacitors',source:'DigiKey order',confidence:'High',movable:true,label:false,connectors:[{id:'C1',label:'560 pF DISP-VSS',type:'solder lead',local:[-33,8,48]},{id:'C2',label:'1 uF VDDA-VSSA',type:'solder lead',local:[-28,8,48]},{id:'C3',label:'1 uF VDD-VSS',type:'solder lead',local:[-23,8,48]}]});
}

function createAntenna() {
  const root=componentRoot('antenna');
  const base=box(38,2.5,38,makeMaterial(0x9c6a3b,{roughness:.55}),[0,0,0]);addEdges(base,0x5a3b24,.7);root.add(base);
  const ceramic=box(31,3.2,31,makeMaterial(0xd7bf91,{roughness:.78}),[0,2.2,0]);root.add(ceramic);
  const mark=document.createElement('canvas');mark.width=256;mark.height=256;const c=mark.getContext('2d');c.fillStyle='#d7bf91';c.fillRect(0,0,256,256);c.fillStyle='#285a3a';c.font='bold 30px Arial';c.fillText('TAOGLAS',38,116);c.font='19px Arial';c.fillText('L1 / L5 ACTIVE',48,148);const t=new THREE.CanvasTexture(mark);const label=box(30,.15,30,new THREE.MeshStandardMaterial({map:t,roughness:.75}),[0,3.85,0]);root.add(label);
  registerComponent({id:'antenna',name:'Taoglas AHP5354A active L1/L5 patch antenna',shortLabel:'Taoglas patch antenna',group:'Sensors',root,position:[-39,7,43],dimensions:{width:38,depth:38,height:6},material:'Ceramic patch / polymer carrier',source:'Manufacturer dimensions / closest procedural analog',confidence:'High',movable:true,labelOffset:[0,10,0],connectors:[{id:'UFL',label:'100 mm coax U.FL/MHF1',type:'U.FL male',local:[19,2,0]}]});

  const rf=componentRoot('rf-adapter');
  const metal=makeMaterial(palette.gold,{metalness:.82,roughness:.22});
  rf.add(cylinder(2.2,8,metal,[0,0,0],[0,0,Math.PI/2],20));rf.add(cylinder(3.1,4,metal,[5.2,0,0],[0,0,Math.PI/2],20));
  registerComponent({id:'rf-adapter',name:'BOOBRIE SMA male to U.FL male adapter',shortLabel:'RF adapter',group:'Connectors',root:rf,position:[55,13,-25],dimensions:{length:12,diameter:6.2},material:'Gold-plated RF adapter',source:'B07S6FMD36 analog',confidence:'Medium',movable:true,label:false,connectors:[{id:'UFL',label:'U.FL male',type:'U.FL male',local:[-5,0,0]},{id:'SMA',label:'SMA male',type:'SMA male',local:[7,0,0]}]});
}

function createBattery() {
  const root=componentRoot('battery');
  const pouch=box(36,11,62,makeMaterial(palette.battery,{metalness:.35,roughness:.42}),[0,0,0]);addEdges(pouch,0x72777d,.35);root.add(pouch);
  const wrap=box(38,12,16,makeMaterial(0x17191c,{roughness:.86}),[0,0,0]);root.add(wrap);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=280;labelCanvas.height=160;const c=labelCanvas.getContext('2d');c.fillStyle='#e9e9e7';c.fillRect(0,0,280,160);c.fillStyle='#1b1d1f';c.font='bold 24px Arial';c.fillText('LiPo BATTERY',45,48);c.font='20px Arial';c.fillText('3.7 V 2500 mAh',45,80);c.fillText('Protected 1S',45,112);const tex=new THREE.CanvasTexture(labelCanvas);root.add(box(28,.2,35,new THREE.MeshStandardMaterial({map:tex,roughness:.7}),[0,5.7,12]));
  registerComponent({id:'battery',name:'Protected 3.7 V 2500 mAh LiPo battery',shortLabel:'LiPo battery',group:'Power and controls',root,position:[35,12,26],rotation:[0,0,0],dimensions:{width:36,depth:62,height:12},material:'LiPo pouch / polymer wrap',source:'Adafruit 328 outline',confidence:'High',movable:true,labelOffset:[0,11,0],connectors:[{id:'JST-PH',label:'JST-PH 2-pin',type:'JST-PH 2-pin',local:[-10,2,-31]}]});
}

function createControlsAndPower() {
  const button=componentRoot('top-button');
  const steel=makeMaterial(palette.steel,{metalness:.86,roughness:.2,clearcoat:.6});
  button.add(cylinder(6,3.2,steel,[0,0,0],[],40));button.add(cylinder(4.5,2.2,makeMaterial(0xcfd7dc,{metalness:.65,roughness:.24}),[0,2.6,0],[],40));button.add(cylinder(5,17,makeMaterial(0x161a1d,{roughness:.75}),[0,-10,0],[],28));
  registerComponent({id:'top-button',name:'Twidec 12 mm waterproof momentary button, prewired',shortLabel:'Twidec 12 mm button',group:'Power and controls',root:button,position:[0,ENCLOSURE.height-2,16],dimensions:{diameter:12,bodyLength:21.8,overallHeight:24.5},material:'Stainless steel / polycarbonate',source:'Installed Twidec 12 mm control',confidence:'Physical installed part',movable:true,labelOffset:[14,10,0],connectors:[{id:'A',label:'Prewired lead A',type:'prewired lead',local:[-2,-19,0]},{id:'B',label:'Prewired lead B',type:'prewired lead',local:[2,-19,0]}]});

  const pwr=componentRoot('power-switch');
  pwr.add(cylinder(7,10,makeMaterial(0x15191d,{roughness:.75}),[0,0,0],[Math.PI/2,0,0],32));pwr.add(box(3,10,2,steel,[0,3,7],[.25,0,0]));
  registerComponent({id:'power-switch',name:'Waterproof latching SPST power switch',shortLabel:'Power switch',group:'Power and controls',root:pwr,position:[0,18,60],rotation:[0,0,0],dimensions:{diameter:14,depth:18,height:20},material:'Polymer / steel',source:'GEPHYNM physical analog',confidence:'Medium',movable:true,labelOffset:[0,12,0],connectors:[{id:'A',label:'Switch terminal A',type:'switch lug',local:[-3,0,-7]},{id:'B',label:'Switch terminal B',type:'switch lug',local:[3,0,-7]}]});

  const usb=componentRoot('usb-bulkhead');
  const black=makeMaterial(0x111417,{roughness:.72});usb.add(cylinder(8,14,black,[0,0,0],[Math.PI/2,0,0],32));usb.add(box(12,5,8,steel,[0,0,7]));
  registerComponent({id:'usb-bulkhead',name:'OBVIS waterproof USB-C bulkhead extension',shortLabel:'USB-C bulkhead',group:'Power and controls',root:usb,position:[36,18,60],dimensions:{diameter:16,depth:24,height:16},material:'Polymer / stainless steel',source:'B09HWSFRP1 analog',confidence:'High',movable:true,labelOffset:[0,13,0],connectors:[{id:'EXTERNAL',label:'External USB-C female',type:'USB-C receptacle',local:[0,0,10]},{id:'INTERNAL',label:'Internal USB-C male cable',type:'USB-C male',local:[0,0,-10]}]});

  const solar=componentRoot('solar-panel');
  const panel=box(38,2.2,120,makeMaterial(0x1e3a52,{roughness:.28,metalness:.15,clearcoat:.8}),[0,0,0]);addEdges(panel,0x9aa8b2,.75);solar.add(panel);
  for(let i=-4;i<=4;i++){const line=box(.45,.08,116,makeMaterial(0xa4c6db,{metalness:.3,roughness:.35}),[i*4,1.15,0]);solar.add(line);}
  registerComponent({id:'solar-panel',name:'6 V 0.6 W 100 mA maintenance solar panel',shortLabel:'Solar panel',group:'Solar charging',root:solar,position:[-39,ENCLOSURE.height-.8,-1],rotation:[0,0,0],dimensions:{width:38,depth:120,height:2.2},material:'Encapsulated photovoltaic panel',source:'MECCANIXITY 120 × 38 mm',confidence:'High',movable:true,label:false,initialState:'translucent',connectors:[{id:'POS',label:'Positive lead',type:'prewired lead',local:[17,-1,54]},{id:'NEG',label:'Negative lead',type:'prewired lead',local:[13,-1,54]}]});

  createPCB({id:'cn3791',name:'Taidacent CN3791 6 V MPPT LiPo charger',shortLabel:'CN3791 charger',group:'Solar charging',width:29,depth:20,color:palette.pcbGreen,position:[42,8,46],source:'B089ZVSQ4K board analog',confidence:'Medium',labelOffset:[0,9,0],chips:5,connectors:[{id:'PV+',label:'PV+',type:'solder pad',local:[-12,2,-7]},{id:'PV-',label:'PV-/GND',type:'solder pad',local:[-7,2,-7]},{id:'BAT+',label:'BAT+',type:'solder pad',local:[7,2,-7]},{id:'BAT-',label:'BAT-',type:'solder pad',local:[12,2,-7]}]});
  createPCB({id:'relay',name:'JESSINIE 5 V one-channel SPDT relay module',shortLabel:'USB priority relay',group:'Solar charging',width:38,depth:24,color:palette.pcbBlue,position:[42,8,15],source:'B0F1C6R764 analog',confidence:'Medium',labelOffset:[0,10,0],chips:4,connectors:[{id:'VCC',label:'VCC',type:'solder pad',local:[-16,2,-9]},{id:'GND',label:'GND',type:'solder pad',local:[-11,2,-9]},{id:'IN',label:'IN',type:'solder pad',local:[-6,2,-9]},{id:'COM',label:'COM',type:'screw terminal',local:[8,2,9]},{id:'NC',label:'NC',type:'screw terminal',local:[13,2,9]},{id:'NO',label:'NO',type:'screw terminal',local:[18,2,9]}]});
}

function createMounting() {
  const plate=componentRoot('rear-mount-plate');
  const p=box(72,4,72,makeMaterial(0x333a42,{roughness:.66}),[0,0,0]);addEdges(p,0x101419,.8);plate.add(p);
  registerComponent({id:'rear-mount-plate',name:'Rear rigid reclosable-fastener plate',shortLabel:'Rear mount plate',group:'Mounting',root:plate,position:[0,42,-66],rotation:[Math.PI/2,0,0],dimensions:{width:72,depth:72,height:4},material:'Polymer plate / mushroom-stem fastener',source:'As-built mount concept',confidence:'Medium',movable:true,label:false,initialState:'translucent'});
  const tether=componentRoot('safety-tether');
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-55,25,-60),new THREE.Vector3(-72,18,-75),new THREE.Vector3(-58,8,-86)]);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,32,1.2,8,false),makeMaterial(0x287aaf,{roughness:.72}));tether.add(tube);
  registerComponent({id:'safety-tether',name:'Independent safety tether',shortLabel:'Safety tether',group:'Mounting',root:tether,dimensions:{length:110,diameter:2.4},material:'Braided synthetic line',source:'Required retention concept',confidence:'Medium',movable:false,label:false,initialState:'translucent'});
}

const netDefs = [
  ['N-001','3V3_MAIN','3.3 V sensor rail','feather','3V','bno085','VIN','24 AWG','solder'],
  ['N-002','3V3_MAIN','BNO085 RVC mode strap','feather','3V','bno085','P0','26 AWG','jumper'],
  ['N-003','3V3_MAIN','GNSS 3.3 V','feather','3V','gnss','3V3','24 AWG','solder'],
  ['N-004','3V3_MAIN','MiniBoost input','feather','3V','miniboost','In','24 AWG','solder'],
  ['N-005','3V3_MAIN','MiniBoost enable','feather','3V','miniboost','En','26 AWG','solder'],
  ['N-006','GND','BNO085 ground','feather','GND','bno085','GND','24 AWG','solder'],
  ['N-007','GND','GNSS ground','feather','GND','gnss','GND','24 AWG','solder'],
  ['N-008','GND','MiniBoost ground','feather','GND','miniboost','G','24 AWG','solder'],
  ['N-009','GND','Sharp digital return','feather','GND','sharp-display','P9','24 AWG','FPC/pad'],
  ['N-010','GND','Sharp analog return','feather','GND','sharp-display','P10','24 AWG','FPC/pad'],
  ['N-011','GNSS_TX','MCU to GNSS UART','feather','TX','gnss','RX','26 AWG','solder'],
  ['N-012','GNSS_RX','GNSS to MCU UART','gnss','TX','feather','RX','26 AWG','solder'],
  ['N-013','RVC_RX','BNO085 UART-RVC stream','bno085','SDA','feather','6','26 AWG','solder'],
  ['N-014','LCD_SCLK','LCD serial clock','feather','SCK','sharp-display','P1','28 AWG','FPC/pad'],
  ['N-015','LCD_SI','LCD serial data','feather','MO','sharp-display','P2','28 AWG','FPC/pad'],
  ['N-016','LCD_SCS','LCD active-high select','feather','9','sharp-display','P3','28 AWG','FPC/pad'],
  ['N-017','LCD_EXTCOMIN','LCD 1 Hz COM inversion','feather','10','sharp-display','P4','28 AWG','FPC/pad'],
  ['N-018','LCD_DISP','LCD display enable','feather','11','sharp-display','P5','28 AWG','FPC/pad'],
  ['N-019','LCD_5V','LCD VDDA 5 V','miniboost','5Vo','sharp-display','P6','24 AWG','FPC/pad'],
  ['N-020','LCD_5V','LCD VDD 5 V','miniboost','5Vo','sharp-display','P7','24 AWG','FPC/pad'],
  ['N-021','LCD_5V','LCD EXTMODE high','miniboost','5Vo','sharp-display','P8','26 AWG','FPC/pad'],
  ['N-025','ZERO','Top button signal','feather','12','top-button','A','22 AWG','prewired/solder'],
  ['N-026','ZERO_GND','Top button return','top-button','B','feather','GND','22 AWG','prewired/solder'],
  ['N-027','POWER_EN','Power switch enable','feather','EN','power-switch','A','22 AWG','solder lug'],
  ['N-028','POWER_EN_GND','Power switch return','power-switch','B','feather','GND','22 AWG','solder lug'],
  ['N-029','USB_EXT','USB power and data','usb-bulkhead','INTERNAL','feather','USB-C','USB cable','factory cable'],
  ['N-030','BATTERY','Battery power','battery','JST-PH','feather','JST-PH','JST-PH cable','factory cable'],
  ['N-031','SOLAR_IN_POS','Solar panel positive','solar-panel','POS','cn3791','PV+','22 AWG','solder'],
  ['N-032','SOLAR_IN_NEG','Solar panel return','solar-panel','NEG','cn3791','PV-','22 AWG','solder'],
  ['N-033','SOLAR_BAT_POS','Solar charger BAT+','cn3791','BAT+','relay','COM','22 AWG','solder/screw'],
  ['N-034','SOLAR_TO_BAT','Relay NC to Feather BAT','relay','NC','feather','BAT','22 AWG','screw/solder'],
  ['N-035','SOLAR_BAT_NEG','Solar charger BAT-','cn3791','BAT-','feather','GND','22 AWG','solder'],
  ['N-036','RELAY_VBUS','USB VBUS relay supply','feather','USB','relay','VCC','22 AWG','solder'],
  ['N-037','RELAY_GND','Relay ground','feather','GND','relay','GND','22 AWG','solder'],
  ['N-038','RELAY_TRIGGER','Relay active strap','relay','VCC','relay','IN','26 AWG','jumper'],
  ['RF-001','RF_COAX','Active antenna coax','antenna','UFL','rf-adapter','UFL','1.13 mm coax','factory coax'],
  ['RF-002','RF_COAX','RF adapter to GNSS SMA','rf-adapter','SMA','gnss','SMA','SMA adapter','rigid RF'],
  ['FPC-001','DISPLAY_FPC','Sharp 10-pin flex','sharp-display','P1','fpc-breakout','FPC','0.5 mm FPC','factory flex'],
];

function connectorWorld(componentId, connectorId) {
  const component=state.components.get(componentId); if(!component) return null;
  const connector=component.connectors.find((c)=>c.id===connectorId); if(!connector) return component.root.getWorldPosition(new THREE.Vector3());
  const point=new THREE.Vector3(...connector.local); component.root.localToWorld(point); return point;
}

function obstacleBoxes(excludeIds, routeY) {
  const boxes=[];
  state.components.forEach((comp,id)=>{
    if(excludeIds.includes(id) || ['enclosure-shell','clear-lid','lid-gasket','standoffs','rear-mount-plate','safety-tether','solar-panel'].includes(id)) return;
    if(comp.state==='hidden') return;
    const b=new THREE.Box3().setFromObject(comp.root);
    if(b.isEmpty()) return;
    if(routeY < b.min.y-2 || routeY > b.max.y+3) return;
    boxes.push({id,minX:b.min.x-2.2,maxX:b.max.x+2.2,minZ:b.min.z-2.2,maxZ:b.max.z+2.2});
  });
  return boxes;
}

function astarRoute(start, end, routeY, excludeIds, occupied, index) {
  const cell=4;
  const nx=Math.floor((INNER.maxX-INNER.minX)/cell)+1;
  const nz=Math.floor((INNER.maxZ-INNER.minZ)/cell)+1;
  const toGrid=(p)=>({x:THREE.MathUtils.clamp(Math.round((p.x-INNER.minX)/cell),0,nx-1),z:THREE.MathUtils.clamp(Math.round((p.z-INNER.minZ)/cell),0,nz-1)});
  const toWorld=(g)=>new THREE.Vector3(INNER.minX+g.x*cell,routeY,INNER.minZ+g.z*cell);
  const s=toGrid(start), goal=toGrid(end);
  const obstacles=obstacleBoxes(excludeIds,routeY);
  const blocked=(x,z)=>{
    if((x===s.x&&z===s.z)||(x===goal.x&&z===goal.z)) return false;
    const wx=INNER.minX+x*cell,wz=INNER.minZ+z*cell;
    return obstacles.some(o=>wx>=o.minX&&wx<=o.maxX&&wz>=o.minZ&&wz<=o.maxZ);
  };
  const key=(x,z)=>`${x},${z}`;
  const open=[]; const best=new Map(); const parent=new Map(); const dirMap=new Map();
  const heuristic=(x,z)=>Math.hypot(goal.x-x,goal.z-z);
  open.push({x:s.x,z:s.z,g:0,f:heuristic(s.x,s.z),dir:-1}); best.set(key(s.x,s.z),0);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null; let guard=0;
  while(open.length && guard++<12000){
    open.sort((a,b)=>a.f-b.f); const cur=open.shift();
    if(cur.x===goal.x&&cur.z===goal.z){found=cur;break;}
    for(let di=0;di<dirs.length;di++){
      const [dx,dz]=dirs[di],x=cur.x+dx,z=cur.z+dz;
      if(x<0||z<0||x>=nx||z>=nz||blocked(x,z)) continue;
      const wx=INNER.minX+x*cell,wz=INNER.minZ+z*cell;
      const edgeDist=Math.min(wx-INNER.minX,INNER.maxX-wx,wz-INNER.minZ,INNER.maxZ-wz);
      const wallPreference=Math.max(0,(edgeDist-10)*.018);
      const used=occupied.get(key(x,z))||0;
      const turn=cur.dir>=0&&cur.dir!==di?.35:0;
      const diagonal=dx&&dz?1.414:1;
      const laneBias=((index%5)*.018)*Math.abs((x+z)%5-(index%5));
      const ng=cur.g+diagonal+wallPreference+used*2.6+turn+laneBias;
      const k=key(x,z);
      if(ng<(best.get(k)??Infinity)){
        best.set(k,ng);parent.set(k,key(cur.x,cur.z));dirMap.set(k,di);open.push({x,z,g:ng,f:ng+heuristic(x,z),dir:di});
      }
    }
  }
  if(!found){
    const side=index%2?INNER.minX+4:INNER.maxX-4;
    return [new THREE.Vector3(start.x,routeY,start.z),new THREE.Vector3(side,routeY,start.z),new THREE.Vector3(side,routeY,end.z),new THREE.Vector3(end.x,routeY,end.z)];
  }
  const cells=[]; let k=key(goal.x,goal.z); cells.push(k);
  while(k!==key(s.x,s.z)){k=parent.get(k);if(!k)break;cells.push(k);} cells.reverse();
  cells.forEach(c=>occupied.set(c,(occupied.get(c)||0)+1));
  const raw=cells.map(c=>{const [x,z]=c.split(',').map(Number);return toWorld({x,z});});
  const simplified=[];
  for(let i=0;i<raw.length;i++){
    if(i===0||i===raw.length-1){simplified.push(raw[i]);continue;}
    const a=raw[i-1],b=raw[i],c=raw[i+1];
    const ab=new THREE.Vector2(b.x-a.x,b.z-a.z).normalize(); const bc=new THREE.Vector2(c.x-b.x,c.z-b.z).normalize();
    if(Math.abs(ab.x-bc.x)>1e-3||Math.abs(ab.y-bc.y)>1e-3) simplified.push(b);
  }
  return simplified;
}

function makeWireMaterial(color) {
  return new THREE.MeshPhysicalMaterial({color:new THREE.Color(color),roughness:.68,metalness:.02,clearcoat:.3,clearcoatRoughness:.55});
}

function wireRadius(gauge) {
  if(gauge.includes('USB')) return 1.65;
  if(gauge.includes('coax')) return .65;
  if(gauge.includes('SMA')) return 1.4;
  if(gauge.includes('FPC')) return .25;
  const n=parseInt(gauge,10); if(!Number.isFinite(n))return .55;
  return n<=22?.78:n<=24?.64:n<=26?.52:.43;
}

function addTermination(group, point, color, type, direction=new THREE.Vector3(0,1,0)) {
  if(type.includes('factory')||type.includes('rigid')||type.includes('FPC')) return;
  const solderMat=makeMaterial(0xcbd2d8,{metalness:.86,roughness:.22});
  const bead=new THREE.Mesh(new THREE.SphereGeometry(1.15,12,8),solderMat);bead.position.copy(point);bead.userData.isTermination=true;group.add(bead);
  const sleeveMat=makeMaterial(type.includes('ground')?0x111111:0x23272b,{roughness:.82});
  const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.35,5.5,12),sleeveMat);sleeve.position.copy(point).add(direction.clone().normalize().multiplyScalar(2.5));sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());group.add(sleeve);
}

function rebuildWires() {
  if(state.wireGroup){state.scene.remove(state.wireGroup);state.wireGroup.traverse(o=>{o.geometry?.dispose?.();if(o.material&&!Array.isArray(o.material))o.material.dispose?.();});}
  state.wireGroup=new THREE.Group();state.wireGroup.name='wire-harnesses';state.scene.add(state.wireGroup);state.wireRoutes=[];
  const occupied=new Map(); let routed=0;
  netDefs.forEach((def,index)=>{
    const [id,net,signal,fromC,fromP,toC,toP,gauge,termination]=def;
    const start=connectorWorld(fromC,fromP),end=connectorWorld(toC,toP); if(!start||!end)return;
    const routeY=22+(index%13)*1.35;
    let planar=astarRoute(start,end,routeY,[fromC,toC],occupied,index);
    let points=[start.clone(),new THREE.Vector3(start.x,routeY,start.z),...planar,new THREE.Vector3(end.x,routeY,end.z),end.clone()];
    points=points.filter((p,i,a)=>i===0||p.distanceTo(a[i-1])>.2);
    if(points.length<2)return;
    const curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.25);
    const radius=wireRadius(gauge);
    let geometry;
    if(gauge.includes('FPC')){
      const sampled=curve.getPoints(80);const positions=[];const width=5.5;
      for(let i=0;i<sampled.length;i++){const prev=sampled[Math.max(0,i-1)],next=sampled[Math.min(sampled.length-1,i+1)];const tangent=next.clone().sub(prev).normalize();const side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(width/2);positions.push(...sampled[i].clone().add(side).toArray(),...sampled[i].clone().sub(side).toArray());}
      const indices=[];for(let i=0;i<sampled.length-1;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,c,b,c,d,b);}geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    } else {geometry=new THREE.TubeGeometry(curve,Math.max(24,points.length*10),radius,8,false);}
    const group=new THREE.Group();group.name=id;group.userData.wireId=id;group.userData.componentId='wire-harnesses';
    const mesh=new THREE.Mesh(geometry,makeWireMaterial(wireColors[net]||'#8aa0b5'));mesh.castShadow=true;mesh.userData.wireId=id;group.add(mesh);
    const tangentStart=curve.getTangent(0.02),tangentEnd=curve.getTangent(.98).multiplyScalar(-1);
    addTermination(group,start,wireColors[net],termination,tangentStart);addTermination(group,end,wireColors[net],termination,tangentEnd);
    state.wireGroup.add(group);
    const modeled=curve.getLength();const cut=Math.ceil((modeled+Math.max(10,modeled*.08))/5)*5;
    const status=points.some(p=>!Number.isFinite(p.x))?'blocked':'ok';if(status==='ok')routed++;
    state.wireRoutes.push({id,net,signal,from:`${fromC}.${fromP}`,to:`${toC}.${toP}`,gauge,termination,color:wireColors[net]||'#8aa0b5',modeled,cut,status,group});
  });
  updateWireTable();
  $('#routeHealth').textContent=`Routing ${routed}/${state.wireRoutes.length}`;
  $('#wireSummary').textContent=`${state.wireRoutes.length} conductors · ${routed} clear`;
}

function updateWireTable() {
  const tbody=$('#wireTableBody');tbody.innerHTML='';
  state.wireRoutes.forEach(w=>{
    const tr=document.createElement('tr');tr.innerHTML=`<td>${w.id}</td><td>${w.signal}</td><td><i class="wire-color" style="background:${w.color}"></i></td><td>${w.gauge}</td><td>${w.from}</td><td>${w.to}</td><td>${w.modeled.toFixed(1)} mm</td><td>${w.cut} mm</td><td class="status-${w.status==='ok'?'ok':'bad'}">${w.status==='ok'?'CLEAR':'CHECK'}</td>`;
    tr.addEventListener('mouseenter',()=>setWireHighlight(w.id,true));tr.addEventListener('mouseleave',()=>setWireHighlight(w.id,false));tbody.appendChild(tr);
  });
}
function setWireHighlight(id,on){const w=state.wireRoutes.find(x=>x.id===id);if(!w)return;w.group.scale.setScalar(on?1.45:1);}

function createWiringComponent() {
  const root=componentRoot('wire-harnesses');
  registerComponent({id:'wire-harnesses',name:'Complete routed wiring harness',shortLabel:'Wiring harness',group:'Wiring and harnesses',root,dimensions:{conductors:netDefs.length},material:'Stranded copper / FPC / RF coax',source:'Project netlist + generated service-channel router',confidence:'Planning model',movable:false,label:false});
  // The registered root is only a hierarchy anchor; generated routes are a separate scene group.
  root.visible=false;
  rebuildWires();
}

function createDimensionLine() {
  const group=new THREE.Group();group.name='dimensions';
  const mat=new THREE.LineBasicMaterial({color:0x111111,transparent:true,opacity:.85});
  const y=ENCLOSURE.height+12;
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-ENCLOSURE.width/2,y,-ENCLOSURE.depth/2),new THREE.Vector3(ENCLOSURE.width/2,y,-ENCLOSURE.depth/2)]),mat);group.add(line);
  [-1,1].forEach(s=>group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s*ENCLOSURE.width/2,y-4,-ENCLOSURE.depth/2),new THREE.Vector3(s*ENCLOSURE.width/2,y+4,-ENCLOSURE.depth/2)]),mat)));
  addLabel(group,'124.5 mm',[0,y+3,-ENCLOSURE.depth/2]);
  state.scene.add(group);
}

function initScene() {
  state.scene=new THREE.Scene();state.scene.background=new THREE.Color(palette.bg);state.scene.fog=new THREE.Fog(0x11161d,170,360);
  state.perspectiveCamera=new THREE.PerspectiveCamera(42,1,.1,1000);state.perspectiveCamera.position.set(155,145,180);
  const frustum=110;state.orthoCamera=new THREE.OrthographicCamera(-frustum,frustum,frustum,-frustum,.1,1000);state.orthoCamera.position.set(155,145,180);
  state.camera=state.perspectiveCamera;
  state.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});state.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));state.renderer.shadowMap.enabled=true;state.renderer.shadowMap.type=THREE.PCFSoftShadowMap;state.renderer.outputColorSpace=THREE.SRGBColorSpace;state.renderer.toneMapping=THREE.ACESFilmicToneMapping;state.renderer.toneMappingExposure=1.05;viewport.appendChild(state.renderer.domElement);
  state.labelRenderer=new CSS2DRenderer();state.labelRenderer.domElement.style.position='absolute';state.labelRenderer.domElement.style.inset='0';state.labelRenderer.domElement.style.pointerEvents='none';viewport.appendChild(state.labelRenderer.domElement);
  state.orbit=new OrbitControls(state.camera,state.renderer.domElement);state.orbit.enableDamping=true;state.orbit.dampingFactor=.08;state.orbit.target.set(0,28,0);state.orbit.maxPolarAngle=Math.PI*.49;state.orbit.minDistance=55;state.orbit.maxDistance=430;
  state.transform=new TransformControls(state.camera,state.renderer.domElement);state.transform.setSize(.72);state.scene.add(state.transform.getHelper());state.transform.addEventListener('dragging-changed',e=>{state.orbit.enabled=!e.value;state.userInteracting=e.value;if(!e.value)scheduleReroute();});state.transform.addEventListener('objectChange',()=>updateInspectorTransforms());
  const ambient=new THREE.HemisphereLight(0xe7f4ff,0x29323c,2.1);state.scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffffff,3.4);key.position.set(90,170,120);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-160;key.shadow.camera.right=160;key.shadow.camera.top=160;key.shadow.camera.bottom=-160;state.scene.add(key);
  const fill=new THREE.DirectionalLight(0x83bfff,1.2);fill.position.set(-130,80,-80);state.scene.add(fill);
  const rim=new THREE.DirectionalLight(0x4ed7c8,.8);rim.position.set(0,60,-160);state.scene.add(rim);
  const ground=box(420,2,420,makeMaterial(0x171d24,{roughness:.96}),[0,-2,0]);ground.receiveShadow=true;state.scene.add(ground);
  const grid=new THREE.GridHelper(360,72,0x52616f,0x28333d);grid.position.y=-.8;grid.material.opacity=.34;grid.material.transparent=true;state.scene.add(grid);
  const axes=new THREE.AxesHelper(22);axes.position.set(-70,1,70);state.scene.add(axes);

  createEnclosure();createElectronics();createDisplay();createAntenna();createBattery();createControlsAndPower();createMounting();createWiringComponent();createDimensionLine();
  resize();bindEvents();renderObjectTree();setTool('orbit');animate();
  state.initialized=true;window.__viewerReady=true;window.__viewerState=state;
  setTimeout(()=>$('#loadingCard').classList.add('done'),350);
  setStatus('Assembly ready');
}

function resize() {
  const rect=viewport.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;
  state.renderer.setSize(rect.width,rect.height,false);state.labelRenderer.setSize(rect.width,rect.height);
  state.perspectiveCamera.aspect=rect.width/rect.height;state.perspectiveCamera.updateProjectionMatrix();
  const viewH=150,viewW=viewH*(rect.width/rect.height);state.orthoCamera.left=-viewW/2;state.orthoCamera.right=viewW/2;state.orthoCamera.top=viewH/2;state.orthoCamera.bottom=-viewH/2;state.orthoCamera.updateProjectionMatrix();
}

function animate() {requestAnimationFrame(animate);state.orbit.update();state.renderer.render(state.scene,state.camera);state.labelRenderer.render(state.scene,state.camera);}

function applyComponentState(id,newState,refresh=true) {
  const comp=state.components.get(id);if(!comp)return;comp.state=newState;
  let opacity=newState==='solid'?comp.opacity||1:newState==='translucent'?Math.min(comp.opacity||.25,.32):0;
  comp.root.visible=newState!=='hidden';
  comp.root.traverse(obj=>{
    if(obj.isCSS2DObject){obj.visible=state.labelsVisible&&newState!=='hidden';return;}
    if(!obj.material)return;
    const materials=Array.isArray(obj.material)?obj.material:[obj.material];
    materials.forEach(mat=>{if(!mat.userData.originalOpacity)mat.userData.originalOpacity=mat.opacity??1;mat.transparent=newState!=='solid'||mat.userData.originalOpacity<1;mat.opacity=newState==='solid'?Math.min(mat.userData.originalOpacity,comp.opacity||1):opacity;mat.depthWrite=newState==='solid'&&mat.opacity>.9;mat.needsUpdate=true;});
  });
  if(refresh){renderObjectTree();if(state.selectedId===id)updateInspector();scheduleReroute();}
}

function renderObjectTree() {
  const container=$('#objectTree');const search=$('#objectSearch').value.trim().toLowerCase();container.innerHTML='';
  GROUP_ORDER.forEach(groupName=>{
    const comps=[...state.components.values()].filter(c=>c.group===groupName&&(!search||c.name.toLowerCase().includes(search)||c.id.includes(search)));
    if(!comps.length)return;
    const group=document.createElement('div');group.className='object-group';
    const heading=document.createElement('button');heading.className='group-heading';heading.innerHTML=`<span class="caret">⌄</span><span>${groupName}</span><span style="margin-left:auto;color:var(--faint);font-size:9px">${comps.length}</span>`;heading.addEventListener('click',()=>group.classList.toggle('collapsed'));group.appendChild(heading);
    const rows=document.createElement('div');rows.className='group-rows';
    comps.forEach(comp=>{
      const row=document.createElement('div');row.className=`object-row ${state.selectedId===comp.id?'selected':''}`;row.dataset.id=comp.id;
      row.innerHTML=`<span class="object-icon"></span><span class="name" title="${comp.name}">${comp.name}</span><button class="visibility-btn" title="Toggle visibility">${comp.state==='hidden'?'○':'◉'}</button><button class="state-dot-btn" title="Cycle state"><i class="state-dot ${comp.state}"></i></button>`;
      row.addEventListener('click',e=>{if(e.target.closest('button'))return;selectComponent(comp.id,true);});
      row.querySelector('.visibility-btn').addEventListener('click',e=>{e.stopPropagation();applyComponentState(comp.id,comp.state==='hidden'?'solid':'hidden');});
      row.querySelector('.state-dot-btn').addEventListener('click',e=>{e.stopPropagation();const next=comp.state==='solid'?'translucent':comp.state==='translucent'?'hidden':'solid';applyComponentState(comp.id,next);});
      rows.appendChild(row);
    });
    group.appendChild(rows);container.appendChild(group);
  });
}

function selectComponent(id,focus=false) {
  const comp=state.components.get(id);if(!comp)return;state.selectedId=id;
  state.transform.detach();if(comp.movable&&comp.state!=='hidden'&&(state.activeTool==='move'||state.activeTool==='rotate'))state.transform.attach(comp.root);
  renderObjectTree();updateInspector();$('#selectionHud').textContent=comp.name;setStatus(`Selected ${comp.name}`);if(focus)focusObject(comp.root);
}

function updateInspector() {
  const comp=state.components.get(state.selectedId);if(!comp){$('#emptyInspector').classList.remove('hidden');$('#inspectorContent').classList.add('hidden');return;}
  $('#emptyInspector').classList.add('hidden');$('#inspectorContent').classList.remove('hidden');$('#selectedName').textContent=comp.name;$('#selectedStateBadge').textContent=comp.state;$('#objectStateSelect').value=comp.state;$('#opacityRange').value=Math.round((comp.opacity||1)*100);$('#opacityOutput').textContent=`${$('#opacityRange').value}%`;
  updateInspectorTransforms();
  const dims=$('#dimensionList');dims.innerHTML='';Object.entries(comp.dimensions||{}).forEach(([k,v])=>dims.insertAdjacentHTML('beforeend',`<dt>${pretty(k)}</dt><dd>${typeof v==='number'?`${v.toFixed(v<10?1:0)} mm`:v}</dd>`));
  const info=$('#modelInfo');info.innerHTML=`<dt>Source</dt><dd title="${comp.source||'Procedural'}">${comp.source||'Procedural'}</dd><dt>Confidence</dt><dd>${comp.confidence||'Planning model'}</dd><dt>Material</dt><dd>${comp.material||'Mixed'}</dd><dt>Object ID</dt><dd>${comp.id}</dd>`;
  const list=$('#connectorList');list.innerHTML='';(comp.connectors||[]).forEach(c=>list.insertAdjacentHTML('beforeend',`<div class="connector-row"><strong>${c.label}</strong><span>${c.type} · ${c.id}</span></div>`));if(!(comp.connectors||[]).length)list.innerHTML='<span style="color:var(--muted);font-size:10px">No electrical connectors.</span>';
  updateCollisionState();
}

function updateInspectorTransforms() {
  const comp=state.components.get(state.selectedId);if(!comp)return;
  $$('#positionInputs input').forEach(input=>input.value=comp.root.position[input.dataset.axis].toFixed(1));
  $$('#rotationInputs input').forEach(input=>input.value=THREE.MathUtils.radToDeg(comp.root.rotation[input.dataset.axis]).toFixed(1));
}

function updateCollisionState() {
  const comp=state.components.get(state.selectedId);const el=$('#collisionState');if(!comp)return;
  const boxA=new THREE.Box3().setFromObject(comp.root);let collisions=[];
  state.components.forEach((other,id)=>{if(id===comp.id||other.state==='hidden'||['enclosure-shell','clear-lid','lid-gasket','standoffs','wire-harnesses','safety-tether'].includes(id))return;const boxB=new THREE.Box3().setFromObject(other.root);if(boxA.intersectsBox(boxB))collisions.push(other.name);});
  if(collisions.length){el.className='clearance-state bad';el.innerHTML=`<i></i><span>Intersects ${collisions.slice(0,2).join(', ')}</span>`;}else{el.className='clearance-state ok';el.innerHTML='<i></i><span>No hard intersections</span>';}
}

function pretty(s){return s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());}

function setTool(tool) {
  state.activeTool=tool;$$('.tool').forEach(btn=>btn.classList.toggle('active',btn.dataset.tool===tool));
  state.transform.detach();
  if(tool==='move'||tool==='rotate'){
    state.transform.setMode(tool==='move'?'translate':'rotate');const comp=state.components.get(state.selectedId);if(comp?.movable&&comp.state!=='hidden')state.transform.attach(comp.root);
  }
  state.orbit.enabled=tool==='orbit'||tool==='select';viewport.style.cursor=tool==='select'?'crosshair':'default';setStatus(`${pretty(tool)} tool`);
}

function switchProjection(mode) {
  const old=state.camera;state.projection=mode;state.camera=mode==='perspective'?state.perspectiveCamera:state.orthoCamera;
  state.camera.position.copy(old.position);state.camera.quaternion.copy(old.quaternion);state.camera.updateProjectionMatrix();state.orbit.object=state.camera;state.transform.camera=state.camera;
  $('#perspectiveBtn').classList.toggle('active',mode==='perspective');$('#orthoBtn').classList.toggle('active',mode==='ortho');$('#projectionLabel').textContent=mode==='perspective'?'Perspective':'CAD isometric';resize();
}

function focusObject(root) {
  const b=new THREE.Box3().setFromObject(root);if(b.isEmpty())return;const center=b.getCenter(new THREE.Vector3());const size=b.getSize(new THREE.Vector3()).length();const dir=state.camera.position.clone().sub(state.orbit.target).normalize();state.orbit.target.copy(center);state.camera.position.copy(center).add(dir.multiplyScalar(Math.max(45,size*2.3)));state.orbit.update();
}

function resetView() {state.camera.position.set(155,145,180);state.orbit.target.set(0,28,0);state.orbit.update();setStatus('View reset');}

function setStatus(text){$('#statusText').textContent=text;}

function scheduleReroute() {clearTimeout(state.routeTimer);state.routeTimer=setTimeout(()=>{rebuildWires();updateCollisionState();setStatus('Harnesses rerouted');},140);}

function toggleExplode() {
  state.exploded=!state.exploded;state.components.forEach((comp,id)=>{
    if(['enclosure-shell','lid-gasket','standoffs','wire-harnesses','safety-tether'].includes(id))return;
    if(state.exploded){const p=comp.original.position.clone();const outward=new THREE.Vector3(p.x,Math.max(8,p.y*.25),p.z).normalize();comp.root.position.copy(p).add(outward.multiplyScalar(id==='clear-lid'?36:20));if(id==='clear-lid')comp.root.position.y+=25;}
    else comp.root.position.copy(comp.original.position);
  });$('#explodeBtn').textContent=state.exploded?'Assemble':'Explode';scheduleReroute();setStatus(state.exploded?'Exploded view':'Assembly restored');
}

function applyPreset(value) {
  if(value==='none'){state.components.forEach((c,id)=>applyComponentState(id,c.initialState||'solid',false));}
  if(value==='lid-off')applyComponentState('clear-lid','hidden',false);
  if(value==='xray'){applyComponentState('enclosure-shell','translucent',false);applyComponentState('clear-lid','translucent',false);}
  if(value==='electronics'){state.components.forEach((c,id)=>applyComponentState(id,['Enclosure','Mounting'].includes(c.group)?'hidden':'solid',false));}
  if(value==='wiring'){state.components.forEach((c,id)=>applyComponentState(id,id==='wire-harnesses'?'solid':'translucent',false));if(state.wireGroup)state.wireGroup.visible=true;}
  renderObjectTree();updateInspector();scheduleReroute();
}

function handlePick(event) {
  if(state.activeTool!=='select'&&state.activeTool!=='orbit')return;
  const rect=state.renderer.domElement.getBoundingClientRect();state.pointer.x=((event.clientX-rect.left)/rect.width)*2-1;state.pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;state.raycaster.setFromCamera(state.pointer,state.camera);
  const hits=state.raycaster.intersectObjects(state.scene.children,true).filter(h=>h.object.userData.componentId&&h.object.visible);
  if(hits.length)selectComponent(hits[0].object.userData.componentId,false);
}

function bindEvents() {
  window.addEventListener('resize',resize);state.renderer.domElement.addEventListener('pointerdown',handlePick);
  $$('.tool').forEach(btn=>btn.addEventListener('click',()=>setTool(btn.dataset.tool)));
  $('#perspectiveBtn').addEventListener('click',()=>switchProjection('perspective'));$('#orthoBtn').addEventListener('click',()=>switchProjection('ortho'));
  $('#resetViewBtn').addEventListener('click',resetView);$('#explodeBtn').addEventListener('click',toggleExplode);$('#sectionPreset').addEventListener('change',e=>applyPreset(e.target.value));
  $('#objectSearch').addEventListener('input',renderObjectTree);$('#showAllBtn').addEventListener('click',()=>{state.components.forEach((c,id)=>applyComponentState(id,'solid',false));if(state.wireGroup)state.wireGroup.visible=true;renderObjectTree();scheduleReroute();});
  $$('.state-filter button').forEach(btn=>btn.addEventListener('click',()=>{$$('.state-filter button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const selected=state.components.get(state.selectedId);if(selected)applyComponentState(selected.id,btn.dataset.bulkState);}));
  $('#objectStateSelect').addEventListener('change',e=>applyComponentState(state.selectedId,e.target.value));
  $('#opacityRange').addEventListener('input',e=>{const comp=state.components.get(state.selectedId);if(!comp)return;comp.opacity=Number(e.target.value)/100;$('#opacityOutput').textContent=`${e.target.value}%`;applyComponentState(comp.id,comp.state,false);});
  $$('#positionInputs input').forEach(input=>input.addEventListener('change',()=>{const comp=state.components.get(state.selectedId);if(!comp)return;comp.root.position[input.dataset.axis]=Number(input.value);scheduleReroute();updateCollisionState();}));
  $$('#rotationInputs input').forEach(input=>input.addEventListener('change',()=>{const comp=state.components.get(state.selectedId);if(!comp)return;comp.root.rotation[input.dataset.axis]=THREE.MathUtils.degToRad(Number(input.value));scheduleReroute();updateCollisionState();}));
  $('#focusBtn').addEventListener('click',()=>{const comp=state.components.get(state.selectedId);if(comp)focusObject(comp.root);});
  $('#resetObjectBtn').addEventListener('click',()=>{const comp=state.components.get(state.selectedId);if(!comp)return;comp.root.position.copy(comp.original.position);comp.root.rotation.copy(comp.original.rotation);comp.root.scale.copy(comp.original.scale);updateInspector();scheduleReroute();});
  $('#rerouteBtn').addEventListener('click',()=>{rebuildWires();setStatus('Harnesses rerouted');});
  $('#toggleLabelsBtn').addEventListener('click',()=>{state.labelsVisible=!state.labelsVisible;state.components.forEach(c=>c.root.traverse(o=>{if(o.isCSS2DObject)o.visible=state.labelsVisible&&c.state!=='hidden';}));});
  $('#collapseWiresBtn').addEventListener('click',()=>{$('#wiresPanel').classList.toggle('collapsed');setTimeout(resize,210);});
  $('#objectsToggle').addEventListener('click',()=>$('#objectsPanel').classList.toggle('open'));$('#inspectorToggle').addEventListener('click',()=>$('#inspectorPanel').classList.toggle('open'));
  $$('[data-close]').forEach(btn=>btn.addEventListener('click',()=>$('#'+btn.dataset.close).classList.remove('open')));
  window.addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;const k=e.key.toLowerCase();if(k==='o')setTool('orbit');if(k==='s')setTool('select');if(k==='g')setTool('move');if(k==='r')setTool('rotate');if(k==='f'&&state.selectedId)focusObject(state.components.get(state.selectedId).root);if(k==='escape'){state.transform.detach();state.selectedId=null;renderObjectTree();updateInspector();}});
}

initScene();


focusObject = function focusObjectSafe(id) {
  const def = state.components.get(id);
  if (!def || !def.root || !state.camera || !state.orbit) return;

  def.root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  const local = new THREE.Box3();
  const finite = (box) => [
    box.min.x, box.min.y, box.min.z,
    box.max.x, box.max.y, box.max.z,
  ].every(Number.isFinite);

  def.root.traverse((obj) => {
    if (!(obj.isMesh || obj.isLine || obj.isLineSegments) || !obj.geometry) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    if (!obj.geometry.boundingBox) return;
    local.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
    if (finite(local)) bounds.union(local);
  });

  if (bounds.isEmpty() || !finite(bounds)) {
    const fallback = def.root.getWorldPosition(new THREE.Vector3());
    bounds.setFromCenterAndSize(fallback, new THREE.Vector3(20, 20, 20));
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.55, 18);
  const direction = state.camera.position.clone().sub(state.orbit.target);
  if (![direction.x, direction.y, direction.z].every(Number.isFinite) || direction.lengthSq() < 1e-6) {
    direction.set(1, 0.75, 1);
  }
  direction.normalize();

  state.orbit.target.copy(center);
  state.camera.position.copy(center).addScaledVector(direction, radius * 2.4);
  if (state.camera.isOrthographicCamera) {
    state.camera.zoom = THREE.MathUtils.clamp(115 / radius, 0.55, 6);
  }
  state.camera.lookAt(center);
  state.camera.updateProjectionMatrix();
  state.orbit.update();
};

