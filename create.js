import {OrbitControls} from './OrbitControls.js';
import {TransformControls} from './TransformControls.js';
import {BufferGeometryUtils} from './BufferGeometryUtils.js';
import {OutlineEffect} from './OutlineEffect.js';
import {XRControllerModelFactory} from './XRControllerModelFactory.js';
import {Ammo as AmmoLib} from './ammo.wasm.js';
import './gif.js';
import {makePromise} from './util.js';
import {apiHost, presenceHost} from './config.js';
import contract from './contract.js';
import screenshot from './screenshot.js';
import {objectImage, objectMaterial, makeObjectMeshFromGeometry, loadObjectMeshes, saveObjectMeshes} from './object.js';
import {createAction, execute, pushAction, undo, redo, clearHistory} from './actions.js';
import {makeObjectState, /*bindObjectScript,*/ tickObjectScript/*, bindObjectShader*/} from './runtime.js';
import {makeId, XRChannelConnection} from './multiplayer.js';
import {initLocalRig, updatePlayerFromCamera, updatePlayerFromXr, bindPeerConnection} from './peerconnection.js';
import {GLTFLoader} from './GLTFLoader.js';
import {VOXLoader, VOXMesh, VOXParser} from './VOXLoader.js';
import {XRPackage} from 'https://xrpackage.org/xrpackage.js'
import itemModels from 'https://item-models.exokit.org/item-models.js';

const _load = () => {

contract.init();

function parseQuery(queryString) {
  var query = {};
  var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}
function downloadFile(file, filename) {
  const blobURL = URL.createObjectURL(file);
  const tempLink = document.createElement('a');
  tempLink.style.display = 'none';
  tempLink.href = blobURL;
  tempLink.setAttribute('download', filename);

  // Safari thinks _blank anchor are pop ups. We only want to set _blank
  // target if the browser does not support the HTML5 download attribute.
  // This allows you to download files in desktop safari if pop up blocking
  // is enabled.
  /* if (typeof tempLink.download === 'undefined') {
      tempLink.setAttribute('target', '_blank');
  } */

  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
}
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sq(n) { return n*n; }

const PARCEL_SIZE = 10;
const size = PARCEL_SIZE + 1;
const uiSize = 2048;
const uiWorldSize = 0.2;

const canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.sortObjects = false;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xEEEEEE);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.5, 1.5);
camera.rotation.order = 'YXZ';
renderer.render(scene, camera);

const ambientLight = new THREE.AmbientLight(0xFFFFFF);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 3);
directionalLight.position.set(0.5, 1, 0.5).multiplyScalar(100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 3);
directionalLight2.position.set(-0.5, -0.1, 0.5).multiplyScalar(100);
scene.add(directionalLight2);

const container = new THREE.Object3D();
scene.add(container);

const orbitControls = new OrbitControls(camera, interfaceDocument.querySelector('.background'), interfaceDocument);
orbitControls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -1.5));
orbitControls.screenSpacePanning = true;
// orbitControls.enabled = !!loginToken;
orbitControls.enableMiddleZoom = false;
orbitControls.update();

const pointerMesh = (() => {
  const targetGeometry = BufferGeometryUtils.mergeBufferGeometries([
    new THREE.BoxBufferGeometry(0.01, 0.2, 0.01)
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0, -0.1, 0)),
    new THREE.BoxBufferGeometry(0.01, 0.2, 0.01)
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.1)),
    new THREE.BoxBufferGeometry(0.01, 0.2, 0.01)
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.1, 0, 0)),
  ]);
  const sidesGeometry = BufferGeometryUtils.mergeBufferGeometries([
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, 0.5, -0.5)),
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, -0.5, -0.5)),
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, 0.5, 0.5)),
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, 0.5, -0.5)),
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, 0.5, 0.5)),
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, -0.5, 0.5)),
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, -0.5, -0.5)),
    targetGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 1, 0).normalize(), new THREE.Vector3(1, -1, 0).normalize())))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, -0.5, 0.5)),
  ]).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
  // const sidesColors = new Float32Array(sidesGeometry.attributes.position.array.length);
  // sidesGeometry.setAttribute('color', new THREE.BufferAttribute(sidesColors, 3));
  /* const dotsGeometries = [];
  const dotGeometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.01);
  for (let x = 0; x <= PARCEL_SIZE; x++) {
    for (let y = 0; y <= PARCEL_SIZE; y++) {
      for (let z = 0; z <= PARCEL_SIZE; z++) {
        const newDotGeometry = dotGeometry.clone()
          .applyMatrix4(new THREE.Matrix4().makeTranslation(x*0.1, y*0.1, z*0.1));
        dotsGeometries.push(newDotGeometry);
      }
    }
  }
  const dotsGeometry = BufferGeometryUtils.mergeBufferGeometries(dotsGeometries);
  const dotsColors = new Float32Array(dotsGeometry.attributes.position.array.length);
  dotsColors.fill(0.7);
  dotsGeometry.setAttribute('color', new THREE.BufferAttribute(dotsColors, 3)); */
  let geometry;
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.targetPos = new THREE.Vector3();
  mesh.frustumCulled = false;
  // const size = [0, 0, 0, 0, 0, 0];
  // mesh.getSize = () => size;
  mesh.resize = (minX, minY, minZ, maxX, maxY, maxZ) => {
    if (minX < maxX && minY < maxY && minZ < maxZ) {
      mesh.geometry = sidesGeometry.clone()
        .applyMatrix4(new THREE.Matrix4().makeScale(maxX - minX, maxY - minY, maxZ - minZ));
    }
    /* size[0] = minX;
    size[1] = minY;
    size[2] = minZ;
    size[3] = maxX;
    size[4] = maxY;
    size[5] = maxZ; */
  };
  mesh.resize(0, 0, 0, 1, 1, 1);
  return mesh;
})();
container.add(pointerMesh);
window.pointerMesh = pointerMesh;

/* const _compileContract = (() => {
  const compiler = wrapper(Module);
  return source => {
    const input = {
      language: 'Solidity',
      sources: {
        'input.sol': {
          content: source,
        },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['*'],
          },
        },
      },
    };
    const o = JSON.parse(compiler.compile(JSON.stringify(input)));
    // console.log('compiled', o);
    const {contracts, errors} = o;
    let result = null;
    if (contracts) {
      for (const i in contracts) {
        // for (const j in contracts[i]) {
          const contract = contracts[i]['RealityScript'];
          if (contract) {
            const {abi, evm: {bytecode: {object}}} = contract;
            result = {
              bytecode: object,
              abi,
            };
            break;
          }
        // }
      }
    }
    const error = errors.map(e => e.formattedMessage).join('\n');
    if (result) {
      return result;
    } else {
      throw error;
    }
  };
})(); */

const _makeWasmWorker = () => {
  let cbs = [];
  const w = new Worker('mc-worker.js');
  w.onmessage = e => {
    const {data} = e;
    const {error, result} = data;
    cbs.shift()(error, result);
  };
  w.onerror = err => {
    console.warn(err);
  };
  w.request = (req, transfers) => new Promise((accept, reject) => {
    w.postMessage(req, transfers);

    cbs.push((err, result) => {
      if (!err) {
        accept(result);
      } else {
        reject(err);
      }
    });
  });
  return w;
};
const mcWorker = _makeWasmWorker();
const uvWorker = _makeWasmWorker();
let ammo = null;
(async () => {
  const p = makePromise();
  const oldModule = window.Module;
  window.Module = { TOTAL_MEMORY: 100*1024*1024 };
  AmmoLib().then(Ammo => {
    Ammo.then = null;
    p.accept(Ammo);
  });
  const Ammo = await p;

  const localVector = new THREE.Vector3();
  const localQuaternion = new THREE.Quaternion();
  const ammoVector3 = new Ammo.btVector3();
  const ammoQuaternion = new Ammo.btQuaternion();
  const localTransform = new Ammo.btTransform();

  var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  var overlappingPairCache = new Ammo.btDbvtBroadphase();
  var solver = new Ammo.btSequentialImpulseConstraintSolver();
  const dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
  dynamicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0));

  {
    var groundShape = new Ammo.btBoxShape(new Ammo.btVector3(100, 100, 100));

    var groundTransform = new Ammo.btTransform();
    groundTransform.setIdentity();
    groundTransform.setOrigin(new Ammo.btVector3(0, -100, 0));

    var mass = 0;
    var localInertia = new Ammo.btVector3(0, 0, 0);
    var myMotionState = new Ammo.btDefaultMotionState(groundTransform);
    var rbInfo = new Ammo.btRigidBodyConstructionInfo(0, myMotionState, groundShape, localInertia);
    var body = new Ammo.btRigidBody(rbInfo);

    dynamicsWorld.addRigidBody(body);
  }

  const _makeConvexHullShape = object => {
    const shape = new Ammo.btConvexHullShape();
    // let numPoints = 0;
    object.updateMatrixWorld();
    object.traverse(o => {
      if (o.isMesh) {
        const {geometry} = o;
        const positions = geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          localVector.set(positions[i], positions[i+1], positions[i+2])
            // .applyMatrix4(o.matrixWorld);
          // console.log('point', localVector.x, localVector.y, localVector.z);
          ammoVector3.setValue(localVector.x, localVector.y, localVector.z);
          const lastOne = i >= (positions.length - 3);
          shape.addPoint(ammoVector3, lastOne);
          // numPoints++;
        }
      }
    });
    shape.setMargin(0);
    // console.log('sword points', numPoints);
    return shape;
  };

  let lastTimestamp = 0;
  ammo = {
    bindObjectMeshPhysics(objectMesh) {
      if (!objectMesh.body) {
        const shape = _makeConvexHullShape(objectMesh);

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(objectMesh.position.x, objectMesh.position.y, objectMesh.position.z));

        const mass = 1;
        const localInertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, localInertia);

        const myMotionState = new Ammo.btDefaultMotionState(transform);
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, shape, localInertia);
        const body = new Ammo.btRigidBody(rbInfo);

        dynamicsWorld.addRigidBody(body);

        objectMesh.body = body;
        objectMesh.ammoObjects = [
          transform,
          localInertia,
          myMotionState,
          rbInfo,
          body,
        ];
        objectMesh.originalPosition = objectMesh.position.clone();
        objectMesh.originalQuaternion = objectMesh.quaternion.clone();
        objectMesh.originalScale = objectMesh.scale.clone();
      }
    },
    unbindObjectMeshPhysics(objectMesh) {
      if (objectMesh.body) {
        dynamicsWorld.removeRigidBody(objectMesh.body);
        objectMesh.body = null;
        objectMesh.ammoObjects.forEach(o => {
          Ammo.destroy(o);
        });
        objectMesh.ammoObjects.length = null;

        objectMesh.position.copy(objectMesh.originalPosition);
        objectMesh.quaternion.copy(objectMesh.originalQuaternion);
        objectMesh.scale.copy(objectMesh.originalScale);
        objectMesh.originalPosition = null;
        objectMesh.originalQuaternion = null;
        objectMesh.originalScale = null;
      }
    },
    simulate() {
      const now = Date.now();
      if (lastTimestamp === 0) {
        lastTimestamp = now;
      }
      const timeDiff = now - lastTimestamp;

      dynamicsWorld.stepSimulation(timeDiff/1000, 2);

      lastTimestamp = now;
    },
    updateObjectMesh(mesh) {
      if (mesh.body) {
        mesh.body.getMotionState().getWorldTransform(localTransform);
        const origin = localTransform.getOrigin();
        mesh.position.set(origin.x(), origin.y(), origin.z());
        // console.log('mesh pos', mesh.position.toArray());
        const rotation = localTransform.getRotation();
        mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
      }
    },
  };
  window.Module = oldModule;
})();

const floorMesh = (() => {
  const geometry = new THREE.BoxBufferGeometry(3, 3, 3);
  const material = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -3/2;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return mesh;
})();
container.add(floorMesh);

(() => {
  // precompile shader
  const tempScene = new THREE.Scene();
  const tempMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), objectMaterial);
  tempMesh.frustumCulled = false;
  tempScene.add(tempMesh);
  renderer.compile(tempMesh, camera);
})();
const _makeMiningMesh = (x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), objectMaterial);
  mesh.frustumCulled = false;
  mesh.visible = false;
  // mesh.token = token;

  const dims = Float32Array.from([size, size, size]);
  const potential = new Float32Array(size*size*size);
  const potentialFillValue = 10;
  potential.fill(potentialFillValue);
  /* for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (
          x === 0 || y === 0 || z === 0 ||
          x === (size-1) || y === (size-1) || z === (size-1)
        ) {
          potential[x + y*size + z*size*size] = 0;
        }
      }
    }
  } */
  const brush = new Uint8Array(size*size*size*3);
  const shift = Float32Array.from([x*PARCEL_SIZE, y*PARCEL_SIZE, z*PARCEL_SIZE]);
  const scale = Float32Array.from([0.1, 0.1, 0.1]);

  mesh.x = x;
  mesh.y = y;
  mesh.z = z;
  mesh.potential = potential;
  mesh.brush = brush;
  // mesh.shift = shift;
  // mesh.scale = scale;
  mesh.contains = pos =>
    pos.x >= shift[0] &&
    pos.y >= shift[1] &&
    pos.z >= shift[2] &&
    pos.x < shift[0] + size &&
    pos.y < shift[1] + size &&
    pos.z < shift[2] + size;
  /* mesh.getPotential = pos => {
    const x = pos.x - shift[0];
    const y = pos.y - shift[1];
    const z = pos.z - shift[2];
    return potential[x + y*size*size + z*size];
  }; */
  let dirtyPos = false;
  mesh.set = (value, x, y, z) => {
    x -= mesh.x * PARCEL_SIZE;
    y -= mesh.y * PARCEL_SIZE;
    z -= mesh.z * PARCEL_SIZE;

    const factor = brushSize;
    const factor2 = Math.ceil(brushSize);
    const max = Math.max(Math.sqrt(factor*factor*3), 0.1);
    for (let dx = -factor2; dx <= factor2; dx++) {
      for (let dz = -factor2; dz <= factor2; dz++) {
        for (let dy = -factor2; dy <= factor2; dy++) {
          const ax = x + dx;
          const ay = y + dy;
          const az = z + dz;
          if (
            ax >= 0 &&
            ay >= 0 &&
            az >= 0 &&
            ax <= PARCEL_SIZE &&
            ay <= PARCEL_SIZE &&
            az <= PARCEL_SIZE
          ) {
            const index = ax + ay*size*size + az*size;
            const d = (max - Math.sqrt(dx*dx + dy*dy + dz*dz)) / max;
            potential[index] = value > 0 ? Math.min(potential[index], -d) : Math.max(potential[index], d);
            dirtyPos = true;
          }
        }
      }
    }
    if (value > 0) {
      for (let dx = -factor2; dx <= factor2; dx++) {
        for (let dz = -factor2; dz <= factor2; dz++) {
          for (let dy = -factor2; dy <= factor2; dy++) {
            const ax = x + dx;
            const ay = y + dy;
            const az = z + dz;
            if (ax >= 0 && ax <= PARCEL_SIZE && ay >= 0 && ay <= PARCEL_SIZE && az >= 0 && az <= PARCEL_SIZE) {
              const index2 = ax + ay*size*size + az*size;
              const xi = index2*3;
              const yi = index2*3+1;
              const zi = index2*3+2;
              // if ((dx === 0 && dy === 0 && dz === 0) || (brush[xi] === 0 && brush[yi] === 0 && brush[zi] === 0)) {
                brush[xi] = currentColor.r*255;
                brush[yi] = currentColor.g*255;
                brush[zi] = currentColor.b*255;
                dirtyPos = true;
              // }
            }
          }
        }
      }
    }
  };
  mesh.paint = mesh.set.bind(mesh, 1);
  mesh.erase = mesh.set.bind(mesh, -1);
  mesh.color = (x, y, z, c) => {
    x -= mesh.x * PARCEL_SIZE;
    y -= mesh.y * PARCEL_SIZE;
    z -= mesh.z * PARCEL_SIZE;

    const factor = brushSize;
    const factor2 = Math.ceil(brushSize);
    for (let dx = -factor2; dx <= factor2; dx++) {
      for (let dz = -factor2; dz <= factor2; dz++) {
        for (let dy = -factor2; dy <= factor2; dy++) {
          const ax = x + dx;
          const ay = y + dy;
          const az = z + dz;
          if (ax >= 0 && ax <= PARCEL_SIZE && ay >= 0 && ay <= PARCEL_SIZE && az >= 0 && az <= PARCEL_SIZE) {
            const index2 = ax + ay*size*size + az*size;
            const xi = index2*3;
            const yi = index2*3+1;
            const zi = index2*3+2;
            // if ((dx === 0 && dy === 0 && dz === 0) || (brush[xi] === 0 && brush[yi] === 0 && brush[zi] === 0)) {
              brush[xi] = currentColor.r*255;
              brush[yi] = currentColor.g*255;
              brush[zi] = currentColor.b*255;
              dirtyPos = true;
            // }
          }
        }
      }
    }
  };
  let positions = null;
  mesh.refresh = () => {
    if (dirtyPos) {
      dirtyPos = false;

      const arrayBuffer = new ArrayBuffer(300*1024);
      return mcWorker.request({
        method: 'march',
        dims,
        potential,
        brush,
        shift,
        scale,
        arrayBuffer,
      }, [arrayBuffer]).then(res => () => {
        if (res.positions.length > 0) {
          mesh.geometry.setAttribute('position', new THREE.BufferAttribute(res.positions, 3));
          mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(res.positions.length*2/3), 2));
          mesh.geometry.setAttribute('color', new THREE.BufferAttribute(res.colors, 3));
          mesh.geometry.deleteAttribute('normal');
          mesh.geometry.setIndex(new THREE.BufferAttribute(res.faces, 1));
          mesh.geometry.computeVertexNormals();
          mesh.visible = true;
        } else {
          mesh.visible = false;
        }
      });
    } else {
      return Promise.resolve(() => {});
    }
  };
  mesh.destroy = () => {
    mesh.geometry.dispose();
    // mesh.material.dispose();
  };
  return mesh;
};
const voxelMeshes = [];

const tesselate = (() => {
  const NUM_POSITIONS_CHUNK = 100 * 1024;
  const MASK_SIZE = 4096;
  const colors = new Uint32Array(MASK_SIZE);
  const invColors = new Uint32Array(MASK_SIZE);
  const mask = new Uint8Array(MASK_SIZE);
  const invMask = new Uint8Array(MASK_SIZE);

  function tesselate(voxels, dims, {isTransparent, isTranslucent, getFaceUvs}) {
    const {vertices: verticesData, faces: facesData} = getMeshData(voxels, dims, {isTransparent, isTranslucent});

    const positions = getPositions(verticesData);
    const normals = getNormals(positions);
    // const uvs = getUvs(facesData, normals, {getFaceUvs});
    // const ssaos = getSsaos(verticesData, voxels);
    const colors = getColors(facesData);

    return {
      positions,
      normals,
      // uvs,
      // ssaos,
      colors,
    };
  }

  function getMeshData(voxels, dims, {isTransparent, isTranslucent}) {
    const vertices = new Float32Array(NUM_POSITIONS_CHUNK);
    const faces = new Uint32Array(NUM_POSITIONS_CHUNK);
    const tVertices = new Float32Array(NUM_POSITIONS_CHUNK);
    const tFaces = new Uint32Array(NUM_POSITIONS_CHUNK);
    let vertexIndex = 0;
    let faceIndex = 0;
    let tVertexIndex = 0;
    let tFaceIndex = 0;

    const dimsX = dims[0];
    const dimsY = dims[1];
    const dimsXY = dimsX * dimsY;

    //Sweep over 3-axes
    for(var d=0; d<3; ++d) {
      var i, j, k, l, w, W, h, n, c
        , u = (d+1)%3
        , v = (d+2)%3
        , x = [0,0,0]
        , q = [0,0,0]
        , du = [0,0,0]
        , dv = [0,0,0]
        , dimsD = dims[d]
        , dimsU = dims[u]
        , dimsV = dims[v]
        , qdimsX, qdimsXY
        , xd
        , t

      q[d] =  1;
      x[d] = -1;

      qdimsX  = dimsX  * q[1]
      qdimsXY = dimsXY * q[2]

      if (MASK_SIZE < dimsU * dimsV) {
        throw new Error('mask buffer not big enough');
      }

      // Compute mask
      while (x[d] < dimsD) {
        xd = x[d]
        n = 0;

        for(x[v] = 0; x[v] < dimsV; ++x[v]) {
          for(x[u] = 0; x[u] < dimsU; ++x[u], ++n) {
            let a, b;
            if (xd >= 0) {
              const aOffset = x[0]      + dimsX * x[1]          + dimsXY * x[2];
              a = voxels[aOffset];
            } else {
              a = 0;
            }
            if (xd < dimsD-1) {
              const bOffset = x[0]+q[0] + dimsX * x[1] + qdimsX + dimsXY * x[2] + qdimsXY;
              b = voxels[bOffset];
            } else {
              b = 0;
            }

            let aMask, bMask;
            if (a !== b || isTranslucent(a) || isTranslucent(b)) {
              const aT = isTransparent(a);
              const bT = isTransparent(b);

              aMask = +(aMask || aT);
              bMask = +(bMask || bT);

              // both are transparent, add to both directions
              if (aT && bT) {
                // nothing
              // if a is solid and b is not there or transparent
              } else if (a && (!b || bT)) {
                b = 0;
                bMask = 0;
              // if b is solid and node a model and a is not there or transparent or a model
              } else if (b && (!a || aT)) {
                a = 0;
                aMask = 0;
              // dont draw this face
              } else {
                a = 0;
                b = 0;
                aMask = 0;
                bMask = 0;
              }
            } else {
              a = 0;
              b = 0;
              aMask = 0;
              bMask = 0;
            }

            colors[n] = a;
            invColors[n] = b;
            mask[n] = aMask;
            invMask[n] = bMask;
          }
        }

        ++x[d];

        // Generate mesh for mask using lexicographic ordering
        function generateMesh(colors, mask, clockwise) {
          clockwise = clockwise === undefined ? true : clockwise;
          var n, j, i, c, w, h, k, du = [0,0,0], dv = [0,0,0];
          n = 0;
          for (j=0; j < dimsV; ++j) {
            for (i=0; i < dimsU; ) {
              c = colors[n];
              t = mask[n];
              if (!c) {
                i++;  n++; continue;
              }

              //Compute width
              w = 1;
              while (c === colors[n+w] && i+w < dimsU) w++;

              //Compute height (this is slightly awkward)
              for (h=1; j+h < dimsV; ++h) {
                k = 0;
                while (k < w && c === colors[n+k+h*dimsU]) k++
                if (k < w) break;
              }

              // Add quad
              // The du/dv arrays are reused/reset
              // for each iteration.
              du[d] = 0; dv[d] = 0;
              x[u]  = i;  x[v] = j;

              if (clockwise) {
              // if (c > 0) {
                dv[v] = h; dv[u] = 0;
                du[u] = w; du[v] = 0;
              } else {
                // c = -c;
                du[v] = h; du[u] = 0;
                dv[u] = w; dv[v] = 0;
              }

              // ## enable code to ensure that transparent faces are last in the list
              if (!t) {
                vertices.set(Float32Array.from([
                  x[0],             x[1],             x[2],
                  x[0]+du[0],       x[1]+du[1],       x[2]+du[2],
                  x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2],
                  x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2],
                ]), vertexIndex);
                vertexIndex += 3 * 4;

                faces[faceIndex++] = c;
              } else {
                tVertices.set(Float32Array.from([
                  x[0],             x[1],             x[2],
                  x[0]+du[0],       x[1]+du[1],       x[2]+du[2],
                  x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2],
                  x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2],
                ]), tVertexIndex);
                tVertexIndex += 3 * 4;

                tFaces[tFaceIndex++] = c;
              }

              //Zero-out mask
              W = n + w;
              for(l=0; l<h; ++l) {
                for(k=n; k<W; ++k) {
                  const index = k+l*dimsU;
                  colors[index] = 0;
                  mask[index] = 0;
                }
              }

              //Increment counters and continue
              i += w; n += w;
            }
          }
        }
        generateMesh(colors, mask, true);
        generateMesh(invColors, invMask, false);
      }
    }

    vertices.set(tVertices.subarray(0, tVertexIndex), vertexIndex);
    faces.set(tFaces.subarray(0, tFaceIndex), faceIndex);

    return {
      vertices: vertices.subarray(0, vertexIndex + tVertexIndex),
      faces: faces.subarray(0, faceIndex + tFaceIndex),
    };
  }

  function getPositions(verticesData) {
    const numFaces = verticesData.length / (4 * 3);
    const result = new Float32Array(numFaces * 18);

    for (let i = 0; i < numFaces; i++) {
      const faceVertices = verticesData.subarray(i * 4 * 3, (i + 1) * 4 * 3);

      // abd
      result[i * 18 + 0] = faceVertices[0 * 3 + 0];
      result[i * 18 + 1] = faceVertices[0 * 3 + 1];
      result[i * 18 + 2] = faceVertices[0 * 3 + 2];

      result[i * 18 + 3] = faceVertices[1 * 3 + 0];
      result[i * 18 + 4] = faceVertices[1 * 3 + 1];
      result[i * 18 + 5] = faceVertices[1 * 3 + 2];

      result[i * 18 + 6] = faceVertices[3 * 3 + 0];
      result[i * 18 + 7] = faceVertices[3 * 3 + 1];
      result[i * 18 + 8] = faceVertices[3 * 3 + 2];

      // bcd
      result[i * 18 + 9] = faceVertices[1 * 3 + 0];
      result[i * 18 + 10] = faceVertices[1 * 3 + 1];
      result[i * 18 + 11] = faceVertices[1 * 3 + 2];

      result[i * 18 + 12] = faceVertices[2 * 3 + 0];
      result[i * 18 + 13] = faceVertices[2 * 3 + 1];
      result[i * 18 + 14] = faceVertices[2 * 3 + 2];

      result[i * 18 + 15] = faceVertices[3 * 3 + 0];
      result[i * 18 + 16] = faceVertices[3 * 3 + 1];
      result[i * 18 + 17] = faceVertices[3 * 3 + 2];
    }

    return result;
  }

  function getNormals(positions) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry.getAttribute('normal').array;
  }

  function getColors(faces) {
    const numFaces = faces.length;
    const result = new Float32Array(numFaces * 18);

    for (let i = 0; i < numFaces; i++) {
      const face = faces[i];
      const r = ((face >> 16) & 0xFF)/0xFF;
      const g = ((face >> 8) & 0xFF)/0xFF;
      const b = (face & 0xFF)/0xFF;
      for (let j = 0; j < 6; j++) {
        result[i*18 + j*3 + 0] = r;
        result[i*18 + j*3 + 1] = g;
        result[i*18 + j*3 + 2] = b;
      }
    }

    return result;
  }

  return tesselate;
})();
const _makeVoxelMesh = (x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), objectMaterial);
  mesh.position.set(x, y, z);
  // mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1));
  mesh.scale.set(0.1, 0.1, 0.1)
  mesh.frustumCulled = false;
  mesh.visible = false;

  mesh.x = x;
  mesh.y = y;
  mesh.z = z;

  const dims = [PARCEL_SIZE, PARCEL_SIZE, PARCEL_SIZE];
  const voxMesh = new VOXMesh(dims);
  let dirtyPos = false;
  mesh.set = (value, x, y, z) => {
    x -= mesh.x * PARCEL_SIZE;
    y -= mesh.y * PARCEL_SIZE;
    z -= mesh.z * PARCEL_SIZE;

    /* const index = x + PARCEL_SIZE*y + PARCEL_SIZE*PARCEL_SIZE*z;
    voxels[index] = value; */

    voxMesh.set(value, x, y, z);

    dirtyPos = true;
  };
  mesh.refresh = () => {
    if (dirtyPos) {
      dirtyPos = false;

      mesh.geometry.dispose();
      mesh.geometry = voxMesh.generate().geometry;
      mesh.visible = true;

      return Promise.resolve(() => {});
    } else {
      return Promise.resolve(() => {});
    }
  };

  mesh.destroy = () => {
    mesh.geometry.dispose();
    // this.mesh.material.dispose();
  };
  return mesh;
};
let miningMeshes = [];
const _findMeshByIndex = miningMeshes => (x, y, z) => miningMeshes.find(miningMesh => miningMesh.x === x && miningMesh.y === y && miningMesh.z === z);
const _findOrAddMeshesByContainCoord = (miningMeshes, makeMesh) => (x, y, z) => {
  const result = [];
  /* const miningMesh = _findMeshByIndex(miningMeshes)(x, y, z);
  miningMesh && result.push(miningMesh); */
  const factor = 1;
  for (let dx = -factor; dx <= factor; dx++) {
    const ax = Math.floor(x + dx*0.5);
    for (let dz = -factor; dz <= factor; dz++) {
      const az = Math.floor(z + dz*0.5);
      for (let dy = -factor; dy <= factor; dy++) {
        const ay = Math.floor(y + dy*0.5);
        let miningMesh = _findMeshByIndex(miningMeshes)(ax, ay, az);
        if (!miningMesh) {
          miningMesh = makeMesh(ax, ay, az);
          scene.add(miningMesh);
          miningMeshes.push(miningMesh);
        }
        !result.includes(miningMesh) && result.push(miningMesh);
      }
    }
  }
  return result;
};
const _findMiningMeshByIndex = _findMeshByIndex(miningMeshes);
const _findOrAddMiningMeshesByContainCoord = _findOrAddMeshesByContainCoord(miningMeshes, _makeMiningMesh);
const _findVoxelMeshByIndex = _findMeshByIndex(voxelMeshes);
const _findOrAddVoxelMeshByContainCoord = (x, y, z) => {
  x = Math.floor(x);
  y = Math.floor(y);
  z = Math.floor(z);
  let miningMesh = _findMeshByIndex(voxelMeshes)(x, y, z);
  if (!miningMesh) {
    miningMesh = _makeVoxelMesh(x, y, z);
    scene.add(miningMesh);
    voxelMeshes.push(miningMesh);
  }
  return miningMesh;
};
const _newMiningMeshes = () => {
  for (let i = 0; i < miningMeshes.length; i++) {
    const miningMesh = miningMeshes[i];
    scene.remove(miningMesh);
    miningMesh.destroy();
  }
  miningMeshes.length = 0;
  _refreshMiningMeshes();
};
const objectMeshes = [];
const _centerObjectMesh = objectMesh => {
  const center = new THREE.Box3()
    .setFromObject(objectMesh)
    .getCenter(new THREE.Vector3());
  objectMesh.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  objectMesh.position.copy(center);
};
const _parameterizeObjectMesh = objectMesh => {
  const {geometry} = objectMesh;
  const arrayBuffer = new ArrayBuffer(300*1024);
  return uvWorker.request({
    method: 'uvParameterize',
    positions: geometry.attributes.position.array,
    normals: geometry.attributes.color.array,
    faces: geometry.index.array,
    arrayBuffer,
  }, [arrayBuffer]).then(res => {
    geometry.setAttribute('position', new THREE.BufferAttribute(res.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(res.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(res.uvs, 2));
    geometry.deleteAttribute('normal');
    geometry.setIndex(new THREE.BufferAttribute(res.faces, 1));
    geometry.computeVertexNormals();
  });
};
let committing = false;
let commitQueued = false;
const _commitMiningMeshes = async () => {
  if (!committing) {
    committing = true;

    await _waitForMiningMesh();

    const visibleMiningMeshes = miningMeshes.filter(miningMesh => miningMesh.visible);
    if (visibleMiningMeshes.length) {
      const geometry = BufferGeometryUtils.mergeBufferGeometries(visibleMiningMeshes.map(miningMesh => miningMesh.geometry));
      const objectMesh = makeObjectMeshFromGeometry(geometry, null, null);
      _centerObjectMesh(objectMesh);
      objectMesh.updateMatrix();
      objectMesh.matrix
        .premultiply(new THREE.Matrix4().getInverse(container.matrix))
        .decompose(objectMesh.position, objectMesh.quaternion, objectMesh.scale);
      _newMiningMeshes();

      const action = createAction('addObjects', {
        newObjectMeshes: [objectMesh],
        container,
        objectMeshes,
      });
      execute(action);
      
      await _parameterizeObjectMesh(objectMesh);
    }

    committing = false;
    if (commitQueued) {
      commitQueued = false;
      _commitMiningMeshes();
    }
  } else {
    commitQueued = true;
  }
};
const _commitVoxelMiningMeshes = async () => {
  if (voxelMeshes.length > 0) {
    const [voxelMesh] = voxelMeshes;
    const center = (() => {
      const o = new THREE.Object3D();
      for (let i = 0; i < voxelMeshes.length; i++) {
        o.add(voxelMeshes[i]);
      }
      return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    })();
    voxelMesh.geometry = BufferGeometryUtils.mergeBufferGeometries(voxelMeshes.map(m => {
      // m.updateMatrixWorld();
      return m.geometry.clone().applyMatrix4(new THREE.Matrix4().makeTranslation(m.position.x/m.scale.x - center.x/m.scale.x, m.position.y/m.scale.y - center.y/m.scale.y, m.position.z/m.scale.z - center.z/m.scale.z));
    }));
    voxelMesh.position.copy(center);

    /* for (let i = 0; i < voxelMeshes.length; i++) {
      scene.remove(voxelMeshes[i]);
    } */
    voxelMeshes.length = 0;

    const action = createAction('addObjects', {
      newObjectMeshes: [voxelMesh],
      container,
      objectMeshes,
    });
    execute(action);
  }
};
const _centerObjectMeshes = () => {
  const box = new THREE.Box3();
  for (let i = 0; i < objectMeshes.length; i++) {
    const localBox = new THREE.Box3()
      .setFromObject(objectMeshes[i]);
    box.min.x = Math.min(box.min.x, localBox.min.x);
    box.min.y = Math.min(box.min.y, localBox.min.y);
    box.min.z = Math.min(box.min.z, localBox.min.z);
    box.max.x = Math.max(box.max.x, localBox.max.x);
    box.max.y = Math.max(box.max.y, localBox.max.y);
    box.max.z = Math.max(box.max.z, localBox.max.z);
  }
  const center = box.getCenter(new THREE.Vector3());
  center.sub(new THREE.Vector3(0, 0.5, 0));
  /* if (box.max.x - box.min.x < 1) {
    center.sub(new THREE.Vector3(0.5, 0, 0));
  } else {
    center.x -= Math.ceil(box.max.x - box.min.x - 1);
  }
  if (box.max.z - box.min.z < 1) {
    center.sub(new THREE.Vector3(0, 0, 0.5));
  } else {
    center.z -= Math.ceil(box.max.z - box.min.z - 1);
  } */
  for (let i = 0; i < objectMeshes.length; i++) {
    objectMeshes[i].position.sub(center);
  }
  
  center.sub(new THREE.Vector3(0.5, 0, 0.5));

  const gridBox = box.clone();
  gridBox.min.sub(center);
  gridBox.max.sub(center);
  gridBox.min.x = Math.floor(gridBox.min.x);
  gridBox.min.y = Math.floor(gridBox.min.y);
  gridBox.min.z = Math.floor(gridBox.min.z);
  gridBox.max.x = Math.floor(gridBox.max.x);
  gridBox.max.y = Math.floor(gridBox.max.y);
  gridBox.max.z = Math.floor(gridBox.max.z);
  pointerMesh.resize(gridBox.min.x, gridBox.min.y, gridBox.min.z, gridBox.max.x+1, gridBox.max.y+1, gridBox.max.z+1);
};
const _screenshotMiningMeshes = async () => {
  const newScene = new THREE.Scene();
  {
    const ambientLight = new THREE.AmbientLight(0x808080);
    newScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
    directionalLight.position.set(0.5, 1, 0.5).multiplyScalar(100);
    newScene.add(directionalLight);
  }
  for (let i = 0; i < objectMeshes.length; i++) {
    newScene.add(objectMeshes[i]);
  }
  // newScene.add(pointerMesh);

  const width = 256;
  const height = width;
  const center = new THREE.Vector3(); // new THREE.Vector3(0.5, 0.5, 0.5);
  const gif = new GIF({
    workers: 2,
    quality: 10,
  });
  for (let i = 0; i < Math.PI*2; i += Math.PI*0.05) {
    const position = new THREE.Vector3(0, 1, 0).add(new THREE.Vector3(Math.cos(i + Math.PI/2), 0, Math.sin(i + Math.PI/2)));
    const canvas = screenshot(newScene, position, center, {
      width,
      height,
    });
    gif.addFrame(canvas, {delay: 50});
  }
  gif.render();

  for (let i = 0; i < objectMeshes.length; i++) {
    container.add(objectMeshes[i]);
  }
  // container.add(pointerMesh);

  const blob = await new Promise((accept, reject) => {
    gif.on('finished', accept);
  });
  return blob;
};
const _paintMiningMeshes = (x, y, z) => {
  const miningMeshes = _findOrAddMiningMeshesByContainCoord(x/PARCEL_SIZE, y/PARCEL_SIZE, z/PARCEL_SIZE);
  miningMeshes.forEach(miningMesh => {
    miningMesh.paint(x, y, z);
  });
};
const _eraseMiningMeshes = (x, y, z) => {
  const miningMesh = _findOrAddMiningMeshesByContainCoord(x/PARCEL_SIZE, y/PARCEL_SIZE, z/PARCEL_SIZE);
  miningMeshes.forEach(miningMesh => {
    miningMesh.erase(x, y, z);
  });
};
const _colorMiningMeshes = (x, y, z, c) => {
  const miningMesh = _findOrAddMiningMeshesByContainCoord(x/PARCEL_SIZE, y/PARCEL_SIZE, z/PARCEL_SIZE);
  miningMeshes.forEach(miningMesh => {
    miningMesh.color(x, y, z, c);
  });
};
const _voxelMiningMeshes = (x, y, z) => {
  const voxelMesh = _findOrAddVoxelMeshByContainCoord(x/PARCEL_SIZE, y/PARCEL_SIZE, z/PARCEL_SIZE);
  voxelMesh.set((currentColor.getHex() << 8) | 255, x, y, z);
};
let refreshing = false;
let refreshQueued = false;
const refreshCbs = [];
const _refreshMiningMeshes = async () => {
  if (!refreshing) {
    refreshing = true;

    const fns = await Promise.all(miningMeshes.map(miningMesh => miningMesh.refresh()));
    for (let i = 0; i < fns.length; i++) {
      fns[i]();
    }
    const commitTool = Array.from(tools).find(tool => tool.matches('[tool=commit]'));
    if (miningMeshes.some(miningMesh => miningMesh.visible)) {
      commitTool.classList.remove('hidden');
    } else {
      commitTool.classList.add('hidden');
    }

    refreshing = false;
    if (refreshQueued) {
      refreshQueued = false;
      _refreshMiningMeshes();
    } else {
      for (let i = 0; i < refreshCbs.length; i++) {
        refreshCbs[i]();
      }
      refreshCbs.length = 0;
    }
  } else {
    refreshQueued = true;
  }
};
const _refreshVoxelMiningMeshes = async () => {
  if (!refreshing) {
    refreshing = true;

    const fns = await Promise.all(voxelMeshes.map(voxelMesh => voxelMesh.refresh()));
    for (let i = 0; i < fns.length; i++) {
      fns[i]();
    }
    const commitTool = Array.from(tools).find(tool => tool.matches('[tool=commit]'));
    if (miningMeshes.some(miningMesh => miningMesh.visible)) {
      commitTool.classList.remove('hidden');
    } else {
      commitTool.classList.add('hidden');
    }

    refreshing = false;
    if (refreshQueued) {
      refreshQueued = false;
      _refreshVoxelMiningMeshes();
    } else {
      for (let i = 0; i < refreshCbs.length; i++) {
        refreshCbs[i]();
      }
      refreshCbs.length = 0;
    }
  } else {
    refreshQueued = true;
  }
};
const _waitForMiningMesh = async () => {
  if (refreshing) {
    const p = makePromise();
    refreshCbs.push(p.accept);
    await p;
  }
};
/* let colliding = false;
let collideQueued = false;
const _collideMiningMeshes = async () => {
  if (!colliding) {
    colliding = true;

    const fns = await Promise.all(miningMeshes.map(miningMesh => miningMesh.collide()));
    for (let i = 0; i < fns.length; i++) {
      fns[i]();
    }

    colliding = false;
    if (collideQueued) {
      collideQueued = false;
      _collideMiningMeshes();
    }
  } else {
    collideQueued = true;
  }
}; */
const _bindObjectMeshPhysics = async () => {
  for (let i = 0; i < objectMeshes.length; i++) {
    ammo.bindObjectMeshPhysics(objectMeshes[i]);
  }
};
const _unbindObjectMeshPhysics = async () => {
  for (let i = 0; i < objectMeshes.length; i++) {
    ammo.unbindObjectMeshPhysics(objectMeshes[i]);
  }
};
const objectState = makeObjectState();

const collisionMesh = (() => {
  const geometry = new THREE.BoxBufferGeometry(0.01, 0.01, 0.01);
  const material = new THREE.MeshPhongMaterial({
    color: 0x0000FF,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  return mesh;
})();
container.add(collisionMesh);

const hoverOutlineEffect = new OutlineEffect(renderer, {
  defaultThickness: 0.01,
  defaultColor: new THREE.Color(0x42a5f5).toArray(),
  defaultAlpha: 0.5,
  // defaultKeepAlive: false,//true,
});
const selectOutlineEffect = new OutlineEffect(renderer, {
  defaultThickness: 0.01,
  defaultColor: new THREE.Color(0x66bb6a).toArray(),
  defaultAlpha: 0.5,
  // defaultKeepAlive: false,//true,
});
const outlineScene = new THREE.Scene();
let renderingOutline = false;
let hoveredObjectMesh = null;
let selectedObjectMeshes = [];
const _setHoveredObjectMesh = newHoveredObjectMesh => {
  hoveredObjectMesh = newHoveredObjectMesh;
};
const _setSelectedObjectMesh = (newSelectedObjectMesh, shiftKey) => {
  const oldIncludedHovered = selectedObjectMeshes.includes(hoveredObjectMesh);
  if (!newSelectedObjectMesh || !shiftKey) {
    for (let i = 0; i < selectedObjectMeshes.length; i++) {
      _unbindObjectMeshControls(selectedObjectMeshes[i]);
    }
    selectedObjectMeshes = newSelectedObjectMesh ? [newSelectedObjectMesh] : [];
    for (let i = 0; i < selectedObjectMeshes.length; i++) {
      _bindObjectMeshControls(selectedObjectMeshes[i]);
    }
  } else {
    const index = selectedObjectMeshes.indexOf(newSelectedObjectMesh);
    if (index !== -1) {
      _unbindObjectMeshControls(newSelectedObjectMesh);
      selectedObjectMeshes = selectedObjectMeshes.slice();
      selectedObjectMeshes.splice(index, 1);
    } else {
      _bindObjectMeshControls(newSelectedObjectMesh);
      selectedObjectMeshes = selectedObjectMeshes.concat(newSelectedObjectMesh);
    }
  }
  if (oldIncludedHovered && !selectedObjectMeshes.includes(hoveredObjectMesh)) {
    hoveredObjectMesh = null;
  }
};
scene.onAfterRender = () => {
  if (renderingOutline) return;
  renderingOutline = true;

  outlineScene.position.copy(container.position);
  outlineScene.quaternion.copy(container.quaternion);
  outlineScene.scale.copy(container.scale);

  let oldHoverParent;
  if (hoveredObjectMesh) {
    oldHoverParent = hoveredObjectMesh.parent;
    outlineScene.add(hoveredObjectMesh);
  }
  hoverOutlineEffect.renderOutline(outlineScene, camera);
  if (oldHoverParent) {
    container.add(hoveredObjectMesh);
  }

  for (let i = 0; i < selectedObjectMeshes.length; i++) {
    outlineScene.add(selectedObjectMeshes[i]);
  }
  selectOutlineEffect.renderOutline(outlineScene, camera);
  for (let i = 0; i < selectedObjectMeshes.length; i++) {
    container.add(selectedObjectMeshes[i]);
  }

  renderingOutline = false;
};

window.addEventListener('resize', e => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

interfaceDocument.addEventListener('dragover', e => {
  e.preventDefault();
});
const _handleUpload = async file => {
  if (/^image\//.test(file.type)) {
    const objectMesh = (() => {
      // const geometry = new THREE.PlaneBufferGeometry(1, 1);
      const geometry = new THREE.BoxBufferGeometry(1, 1, 0.001);
      for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
        if (geometry.attributes.position.array[i + 2] < 0) {
          const j = i*2/3;
          geometry.attributes.uv.array[j] = 1 - geometry.attributes.uv.array[j];
        }
      }
      const colors = new Float32Array(geometry.attributes.position.array.length);
      colors.fill(1)
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        texture.image = img;
        texture.needsUpdate = true;

        mesh.scale.x = 0.5;
        mesh.scale.y = mesh.scale.x * img.height/img.width;
        mesh.visible = true;
      };
      img.onerror = console.warn;

      const texture = new THREE.Texture();
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;

      const mesh = makeObjectMeshFromGeometry(geometry, texture, null);
      return mesh;
    })();
    objectMesh.position.copy(camera.position)
      .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
    objectMesh.quaternion.copy(camera.quaternion);
    container.add(objectMesh);
    objectMeshes.push(objectMesh);
  } else if (/(?:\.gltf|\.glb|\.vrm)/.test(file.name)) {
    const u = URL.createObjectURL(file);
    const p = makePromise();
    const loader = new GLTFLoader();
    loader.load(u, p.accept, function onProgress() {}, p.reject);
    const o = await p;
    const {scene} = o;
    const objectMesh = scene;
    objectMesh.position.copy(camera.position)
      .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
    objectMesh.quaternion.copy(camera.quaternion);
    container.add(objectMesh);
    objectMeshes.push(objectMesh);
    // const {objectMeshes: newObjectMeshes, script/*, shader: {vertex, fragment}*/} = await loadObjectMeshes(file);
    // objectMeshes.length = newObjectMeshes.length;
    /* for (let i = 0; i < newObjectMeshes.length; i++) {
      const newObjectMesh = newObjectMeshes[i];
      objectMeshes[i] = newObjectMesh;
      container.add(newObjectMesh);
    } */
    // console.log('got gltf', newObjectMeshes);
  } else if (/\.vox$/.test(file.name)) {
    const u = URL.createObjectURL(file);

    const p = makePromise();
    const loader = new VOXLoader();
    loader.load(u, p.accept, function onProgress() {}, p.reject);
    const objectMesh = await p;
    objectMesh.position.copy(camera.position)
      .add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
    objectMesh.quaternion.copy(camera.quaternion);
    container.add(objectMesh);
    objectMeshes.push(objectMesh);
  }
};
interfaceDocument.addEventListener('drop', e => {
  e.preventDefault();

  if (e.dataTransfer.files.length > 0){
    const [file] = e.dataTransfer.files;
    _handleUpload(file);
  }
});

let transformControlsHovered = false;
const _bindObjectMeshControls = o => {
  const control = new TransformControls(camera, interfaceDocument.querySelector('.background'), interfaceDocument);
  // control.setMode(transformMode);
  control.size = 3;
  // control.visible = toolManager.getSelectedElement() === xrIframe;
  // control.enabled = control.visible;
  /* control.addEventListener('dragging-changed', e => {
    orbitControls.enabled = !e.value;
  }); */
  control.addEventListener('mouseEnter', () => {
    transformControlsHovered = true;
  });
  control.addEventListener('mouseLeave', () => {
    transformControlsHovered = false;
  });
  const _snapshotTransform = o => ({
    position: o.position.clone(),
    quaternion: o.quaternion.clone(),
    scale: o.scale.clone(),
  });
  let lastTransform = _snapshotTransform(o);
  let changed = false;
  control.addEventListener('mouseDown', () => {
    lastTransform = _snapshotTransform(o);
  });
  control.addEventListener('mouseUp', () => {
    if (changed) {
      changed = false;

      const newTransform = _snapshotTransform(o);
      const action = createAction('transform', {
        object: o,
        oldTransform: lastTransform,
        newTransform,
      });
      execute(action);
      lastTransform = newTransform;
    }
  });
  control.addEventListener('objectChange', e => {
    changed = true;
  });
  control.attach(o);
  scene.add(control);
  o.control = control;
};
const _unbindObjectMeshControls = o => {
  scene.remove(o.control);
  o.control.dispose();
  o.control = null;
  transformControlsHovered = false;
};

const localRaycaster = new THREE.Raycaster();
let toolDown = false;
let toolGrip = false;
const _updateRaycasterFromMouseEvent = (raycaster, e) => {
  const mouse = new THREE.Vector2(( ( e.clientX ) / window.innerWidth ) * 2 - 1, - ( ( e.clientY ) / window.innerHeight ) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  if (['brush', 'voxel'].includes(selectedTool)) {
    raycaster.ray.origin.add(raycaster.ray.direction);
  }
};
const _updateRaycasterFromObject = (raycaster, o) => {
  raycaster.ray.origin.copy(o.position);
  raycaster.ray.direction.set(0, 0, -1).applyQuaternion(o.quaternion);
};
let hoveredObjectFace = null;
let hoveredObjectPaint = null;
const _getObjectMeshIntersections = (raycaster, objectMeshes = [], {hoverMode = false} = {}) => {
  let intersections;
  if (hoverMode && currentSession) {
    intersections = objectMeshes.map(objectMesh => {
      const box = new THREE.Box3().setFromObject(objectMesh);
      if (box.containsPoint(raycaster.ray.origin)) {
        return {
          object: objectMesh,
          distance: box.getCenter(new THREE.Vector3())
            .distanceTo(objectMesh.position),
        };
      } else {
        return null;
      }
    }).filter(o => o !== null).sort((a, b) => a.distance - b.distance);
  } else {
    intersections = raycaster.intersectObjects(objectMeshes, true);
  }
  intersections = intersections.map(intersection => {
    let object;
    for (object = intersection.object; object; object = object.parent) {
      if (objectMeshes.includes(object)) {
        break;
      }
    }
    if (object) {
      intersection.object = object;
      return intersection;
    } else {
      return null;
    }
  }).filter(o => o !== null);
  return intersections;
};
const _updateTool = raycaster => {
  if (['brush', 'voxel', 'erase'].includes(selectedTool)) {
    const targetPosition = raycaster.ray.origin;
    pointerMesh.targetPos.set(
      Math.floor(targetPosition.x*10),
      Math.floor(targetPosition.y*10),
      Math.floor(targetPosition.z*10)
    );
    if (toolDown) {
      const v = pointerMesh.targetPos;
      if (selectedTool === 'brush') {
        _paintMiningMeshes(v.x+1, v.y+1, v.z+1);
        _refreshMiningMeshes();
      } else if (selectedTool === 'voxel') {
        _voxelMiningMeshes(v.x, v.y, v.z);
        _refreshVoxelMiningMeshes();
      } else if (selectedTool === 'erase') {
        _eraseMiningMeshes(v.x+1, v.y+1, v.z+1);
        _refreshMiningMeshes();
      }
    }
  } else if (selectedTool === 'select') {
    if (!toolGrip) {
      const intersections = _getObjectMeshIntersections(raycaster, objectMeshes, {hoverMode: true});
      if (intersections.length > 0) {
        _setHoveredObjectMesh(intersections[0].object);
      } else {
        _setHoveredObjectMesh(null);
      }
    } else {
      if (!transformControlsHovered) {
        console.log('drag');
      }
    }
  } else if (selectedTool === 'paint') {
    const intersections = _getObjectMeshIntersections(raycaster, objectMeshes, {hoverMode: false});
    if (intersections.length > 0) {
      const [{point}] = intersections;
      collisionMesh.position.copy(point);
      collisionMesh.visible = true;
    } else {
      collisionMesh.visible = false;
    }
  } else if (selectedTool === 'pencil') {
    const intersections = _getObjectMeshIntersections(raycaster, objectMeshes, {hoverMode: false});
    if (intersections.length > 0) {
      const [{object, point, faceIndex, uv}] = intersections;

      if (toolDown) {
        let texture = object.material.map;
        let {image: canvas} = texture;
        if (!canvas.ctx) {
          const oldCanvas = canvas;
          canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.ctx = ctx;

          if (oldCanvas.nodeName === 'IMG') {
            canvas.width = oldCanvas.width;
            canvas.height = oldCanvas.height;
            ctx.drawImage(oldCanvas, 0, 0, oldCanvas.width, oldCanvas.height);
          } else {
            canvas.width = 2048;
            canvas.height = 2048;
            ctx.fillStyle = 'rgba(255, 255, 255, 255)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.lineJoin = ctx.lineCap = 'round';

          object.material.map.image = canvas;
          object.material.map.needsUpdate = true;
        }
        const {ctx} = canvas;
        const x = uv.x * canvas.width;
        const y = uv.y * canvas.height;

        if (
          hoveredObjectPaint &&
          (
            faceIndex === hoveredObjectPaint.faceIndex ||
            Math.sqrt(sq(x - hoveredObjectPaint.lastX), sq(y - hoveredObjectPaint.lastY)) < 100
          )
        ) {
          // nothing
        } else {
          hoveredObjectPaint = null;
        }

        if (!hoveredObjectPaint) {
          ctx.beginPath();
          ctx.moveTo(x, y);
        }

        ctx.strokeStyle = '#' + currentColor.getHexString();
        ctx.lineWidth = getRandomInt(7, 9);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);

        hoveredObjectPaint = {
          lastX: x,
          lastY: y,
          faceIndex,
        };
        texture.needsUpdate = true;
      } else {
        hoveredObjectPaint = null;
      }

      collisionMesh.position.copy(point);
      collisionMesh.visible = true;
    } else {
      collisionMesh.visible = false;
    }
  } else if (selectedTool === 'scalpel') {
    if (toolDown) {
      scalpelMesh.endPosition.copy(localRaycaster.ray.origin)
        .add(localRaycaster.ray.direction);
      const normal = scalpelMesh.endPosition.clone()
        .sub(scalpelMesh.startPosition);
      if (normal.length() > 0.001) {
        normal
          .cross(localRaycaster.ray.direction);
        scalpelMesh.position.copy(scalpelMesh.startPosition)
          .add(scalpelMesh.endPosition)
          .divideScalar(2);
      } else {
        normal.set(1, 0, 0)
          .cross(scalpelMesh.startDirection);
        scalpelMesh.position.copy(scalpelMesh.startPosition);
      }
      normal.normalize();
      scalpelMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }
  }
  
  const intersections = raycaster.intersectObject(uiMesh);
  if (intersections.length > 0 && intersections[0].distance < 3) {
    const [{distance, uv}] = intersections;
    rayMesh.position.copy(raycaster.ray.origin);
    rayMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), raycaster.ray.direction);
    rayMesh.scale.z = distance;
    rayMesh.visible = true;

    // orbitControls.enabled = false;

    uiMesh.intersect(uv);
  } else {
    rayMesh.visible = false;
    
    // orbitControls.enabled = selectedTool === 'camera';

    uiMesh.intersect(null);
  }
};
let objectMeshOldCanvases = [];
const _snapshotCanvases = objectMeshes => objectMeshes.map(objectMesh => {
  const oldImage = objectMesh.material.map.image;
  if (oldImage !== objectImage) {
    const canvas = document.createElement('canvas');
    canvas.width = oldImage.width;
    canvas.height = oldImage.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(oldImage, 0, 0, oldImage.width, oldImage.height);
    return canvas;
  } else {
    return null;
  }
});
let scalpelMesh = (() => {
  const geometry = new THREE.BoxBufferGeometry(10, 0.001, 10);
  const material = new THREE.MeshBasicMaterial({
    color: 0x42a5f5,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.startPosition = new THREE.Vector3();
  mesh.startDirection = new THREE.Vector3();
  mesh.endPosition = new THREE.Vector3();
  return mesh;
})();
container.add(scalpelMesh);
const _beginTool = (primary, secondary, shiftKey) => {
  if (primary) {
    if (uiMesh.click()) {
      // nothing
    } else {
      if (selectedTool === 'brush') {
        const v = pointerMesh.targetPos;
        _paintMiningMeshes(v.x+1, v.y+1, v.z+1);
        _refreshMiningMeshes();
      } else if (selectedTool === 'voxel') {
        const v = pointerMesh.targetPos;
        _voxelMiningMeshes(v.x+1, v.y+1, v.z+1);
        _refreshVoxelMiningMeshes();
      } else if (selectedTool === 'erase') {
        const v = pointerMesh.targetPos;
        _eraseMiningMeshes(v.x+1, v.y+1, v.z+1);
        _refreshMiningMeshes();
      /* } else if (selectedTool === 'select') {
        if (!transformControlsHovered) {
          _setSelectedObjectMesh(hoveredObjectMesh, shiftKey);
        } */
      } else if (selectedTool === 'paint') {
        const intersections = _getObjectMeshIntersections(localRaycaster, objectMeshes, {hoverMode: false});
        if (intersections.length > 0) {
          const [{object}] = intersections;

          const oldColor = new THREE.Color().fromArray(object.geometry.attributes.color.array);
          const newColor = currentColor.clone();
          const action = createAction('paint', {
            objectMesh: object,
            oldColor,
            newColor,
          });
          execute(action);
        }
      } else if (selectedTool === 'pencil') {
        objectMeshOldCanvases = _snapshotCanvases(objectMeshes);
      } else if (selectedTool === 'scalpel') {
        scalpelMesh.startPosition.copy(localRaycaster.ray.origin)
          .add(localRaycaster.ray.direction);
        scalpelMesh.startDirection.copy(localRaycaster.ray.direction);
        scalpelMesh.position.copy(scalpelMesh.startPosition);
        const normal = new THREE.Vector3(1, 0, 0)
          .cross(scalpelMesh.startDirection)
          .normalize();
        scalpelMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        scalpelMesh.visible = true;
      }

      toolDown = true;
    }
  }
  if (secondary) {
    if (selectedTool === 'select') {
      if (!transformControlsHovered) {
        _setSelectedObjectMesh(hoveredObjectMesh, shiftKey);
      }
    }
    toolGrip = true;
  }
};
const _endTool = (primary, secondary) => {
  if (primary) {
    if (selectedTool === 'pencil') {
      const objectMeshNewCanvases = _snapshotCanvases(objectMeshes);
      const action = createAction('pencil', {
        objectMeshes,
        oldCanvases: objectMeshOldCanvases,
        newCanvases: objectMeshNewCanvases,
      });
      pushAction(action);
    } else if (selectedTool === 'scalpel') {
      scalpelMesh.visible = false;

      for (let i = 0; i < selectedObjectMeshes.length; i++) {
        const selectedObjectMesh = selectedObjectMeshes[i];
        _splitObjectMesh(selectedObjectMesh, scalpelMesh.position.clone().sub(selectedObjectMesh.position), scalpelMesh.quaternion, scalpelMesh.scale);
      }
    }

    toolDown = false;
  }
  if (secondary) {
    toolGrip = false;
  }
};
let clipboardObjectMeshes = [];
const _clipboardCopy = objectMeshes => {
  clipboardObjectMeshes = objectMeshes.map(objectMesh => ({
    geometry: objectMesh.geometry.clone(),
    texture: objectMesh.map && objectMesh.map.clone(),
    matrix: objectMesh.matrix.clone(),
  }));
};
const _clipboardPaste = () => {
  if (clipboardObjectMesh) {
    const objectMesh = makeObjectMeshFromGeometry(clipboardObjectMesh.geometry, clipboardObjectMesh.texture, clipboardObjectMesh.matrix);

    const action = createAction('addObjects', {
      newObjectMesh: [objectMesh],
      container,
      objectMeshes,
    });
    execute(action);
  }
};
const _splitObjectMesh = (objectMesh, p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1)) => {
  const {geometry} = objectMesh;
  const arrayBuffer = new ArrayBuffer(300*1024);
  const position = objectMesh.position.clone();
  const quaternion = objectMesh.quaternion.clone();
  const scale = objectMesh.scale.clone();
  const color = new THREE.Color().fromArray(objectMesh.geometry.attributes.color.array);
  uvWorker.request({
    method: 'cut',
    positions: geometry.attributes.position.array,
    faces: geometry.index.array,
    position: p.toArray(),
    quaternion: q.toArray(),
    scale: s.toArray(),
    arrayBuffer,
  }, [arrayBuffer]).then(res => {
    const newObjectMeshes = [];
    {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(res.positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(res.positions.length*2/3), 2));
      const colors = new Float32Array(res.positions.length);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r;
        colors[i+1] = color.g;
        colors[i+2] = color.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.deleteAttribute('normal');
      geometry.setIndex(new THREE.BufferAttribute(res.faces, 1));
      geometry.computeVertexNormals();
      const objectMesh = makeObjectMeshFromGeometry(geometry, null, null);
      objectMesh.position.copy(position);
      objectMesh.quaternion.copy(quaternion);
      objectMesh.scale.copy(scale);
      newObjectMeshes.push(objectMesh);
    }
    {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(res.positions2, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(res.positions2.length*2/3), 2));
      const colors = new Float32Array(res.positions2.length);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r;
        colors[i+1] = color.g;
        colors[i+2] = color.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.deleteAttribute('normal');
      geometry.setIndex(new THREE.BufferAttribute(res.faces2, 1));
      geometry.computeVertexNormals();
      const objectMesh = makeObjectMeshFromGeometry(geometry, null, null);
      objectMesh.position.copy(position);
      objectMesh.quaternion.copy(quaternion);
      objectMesh.scale.copy(scale);
      newObjectMeshes.push(objectMesh);
    }

    _setHoveredObjectMesh(null);
    _setSelectedObjectMesh(null, false);

    const action = createAction('swapObjects', {
      oldObjectMeshes: [objectMesh],
      newObjectMeshes,
      container,
      objectMeshes,
    });
    execute(action);
  });
};
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  shift: false,
};
[window, interfaceWindow].forEach(w => {
  w.addEventListener('keydown', e => {
    switch (e.which) {
      case 49: // 1
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57: // 9
      {
        tools[e.which - 49].click();
        break;
      }
      case 87: { // W
        if (!document.pointerLockElement) {
          selectedObjectMeshes.forEach(selectedObjectMesh => {
            selectedObjectMesh.control.setMode('translate');
          });
        } else {
          keys.up = true;
        }
        break;
      }
      case 65: { // A
        if (!document.pointerLockElement) {
          selectedObjectMeshes.forEach(selectedObjectMesh => {
            selectedObjectMesh.control.setMode('translate');
          });
        } else {
          keys.left = true;
        }
        break;
      }
      case 83: { // S
        if (!document.pointerLockElement) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            interfaceDocument.getElementById('save-op').click();
          }
        } else {
          keys.down = true;
        }
        break;
      }
      case 68: { // D
        if (!document.pointerLockElement) {
          // nothing
        } else {
          keys.right = true;
        }
        break;
      }
      case 69: { // E
        selectedObjectMeshes.forEach(selectedObjectMesh => {
          selectedObjectMesh.control.setMode('rotate');
        });
        break;
      }
      case 82: { // R
        selectedObjectMeshes.forEach(selectedObjectMesh => {
          selectedObjectMesh.control.setMode('scale');
        });
        break;
      }
      case 79: { // O
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();

          interfaceDocument.getElementById('load-op-input').click();
        }
        break;
      }
      case 88: { // X
        if (e.ctrlKey || e.metaKey) {
          if (selectedObjectMeshes.length > 0) {
            _clipboardCopy(selectedObjectMeshes);
            
            const oldSelectedObjectMeshes = selectedObjectMeshes;

            _setHoveredObjectMesh(null);
            _setSelectedObjectMesh(null, false);

            const action = createAction('removeObjects', {
              oldObjectMeshes: oldSelectedObjectMeshes,
              container,
              objectMeshes,
            });
            execute(action);
          }
        }
        break;
      }
      /* case 75: { // K
        if (e.ctrlKey || e.metaKey) {
          if (selectedObjectMesh) {
            _splitObjectMesh(selectedObjectMesh);
          }
        }
        break;
      } */
      case 67: { // C
        if (e.ctrlKey || e.metaKey) {
          if (selectedObjectMeshes.length) {
            _clipboardCopy(selectedObjectMeshes);
          }
        } else if (e.shiftKey) {
          _centerObjectMeshes();
        }
        break;
      }
      case 86: { // V
        if (e.ctrlKey || e.metaKey) {
          _clipboardPaste();
        }
        break;
      }
      case 90: { // Z
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        break;
      }
      case 89: { // Y
        if (e.ctrlKey || e.metaKey) {
          redo();
        }
        break;
      }
      case 16: { // shift
        if (document.pointerLockElement) {
          keys.shift = true;
        }
        break;
      }
      case 27: { // esc
        _setSelectedObjectMesh(null, false);
        break;
      }
      case 8: // backspace
      case 46: // del
      {
        if (selectedObjectMeshes.length > 0) {
          const oldSelectedObjectMesh = selectedObjectMeshes;

          _setHoveredObjectMesh(null);
          _setSelectedObjectMesh(null, false);

          const action = createAction('removeObjects', {
            oldObjectMeshes: oldSelectedObjectMeshes,
            container,
            objectMeshes,
          });
          execute(action);
        }
        break;
      }
    }
  });
  w.addEventListener('keyup', e => {
    switch (e.which) {
      case 87: { // W
        if (document.pointerLockElement) {
          keys.up = false;
        }
        break;
      }
      case 65: { // A
        if (document.pointerLockElement) {
          keys.left = false;
        }
        break;
      }
      case 83: { // S
        if (document.pointerLockElement) {
          keys.down = false;
        }
        break;
      }
      case 68: { // D
        if (document.pointerLockElement) {
          keys.right = false;
        }
        break;
      }
      case 16: { // shift
        if (document.pointerLockElement) {
          keys.shift = false;
        }
        break;
      }
    }
  });
  w.addEventListener('mousemove', e => {
    if (!document.pointerLockElement) {
      _updateRaycasterFromMouseEvent(localRaycaster, e);
      _updateTool(localRaycaster);
    } else {
      const {movementX, movementY} = e;
      camera.rotation.y -= movementX * Math.PI*2*0.001;
      camera.rotation.x -= movementY * Math.PI*2*0.001;
    }
  });
  w.addEventListener('mousedown', e => {
    _beginTool(true, true, e.shiftKey);
  });
  w.addEventListener('mouseup', e => {
    _endTool(true, true, e.shiftKey);
  });
});
interfaceDocument.querySelector('.background').addEventListener('wheel', e => {
  e.preventDefault();
});
const _updateControllers = () => {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    const controllerGrip = renderer.xr.getControllerGrip(i);
    
    if (controller.userData.data && controller.userData.data.handedness === 'left') {
      const squeeze = controller.userData.data.gamepad.buttons[1].pressed;
      const lastSqueeze = lastSqueezes[0];
      if (squeeze && !lastSqueeze) {
        // console.log('left start');
        controllerGrip.dispatchEvent({
          type: 'squeezestart',
        });
      } else if (!squeeze && lastSqueeze) {
        // console.log('left end');
        controllerGrip.dispatchEvent({
          type: 'squeezeend',
        });
      }
      lastSqueezes[0] = squeeze;
    }
    if (controller.userData.data && controller.userData.data.handedness === 'right') {
      const squeeze = controller.userData.data.gamepad.buttons[1].pressed;
      const lastSqueeze = lastSqueezes[1];
      if (squeeze && !lastSqueeze) {
        controllerGrip.dispatchEvent({
          type: 'squeezestart',
        });
      } else if (!squeeze && lastSqueeze) {
        controllerGrip.dispatchEvent({
          type: 'squeezeend',
        });
      }
      lastSqueezes[1] = squeeze;
    }
  }
  
  if (scaleState) {
    const startPosition = scaleState.startPosition.clone()
      .applyMatrix4(new THREE.Matrix4().getInverse(scaleState.containerStartMatrix));
    const currentPosition = renderer.xr.getControllerGrip(0).position.clone()
      .add(renderer.xr.getControllerGrip(1).position)
      .divideScalar(2)
      .applyMatrix4(new THREE.Matrix4().getInverse(scaleState.containerStartMatrix));
    const currentDirection = renderer.xr.getControllerGrip(0).position.clone()
      .sub(renderer.xr.getControllerGrip(1).position)
      .normalize();
    const currentWorldWidth = renderer.xr.getControllerGrip(0).position
      .distanceTo(renderer.xr.getControllerGrip(1).position);
    const currentEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(scaleState.startDirection, currentDirection), 'YXZ');
    currentEuler.x = 0;
    currentEuler.z = 0;
    const currentQuaternion = new THREE.Quaternion().setFromEuler(currentEuler);
    const scaleFactor = currentWorldWidth/scaleState.startWorldWidth;
    const positionDiff = currentPosition.clone().sub(startPosition);

    container.matrix
      .copy(scaleState.containerStartMatrix)
      .multiply(new THREE.Matrix4().makeTranslation(currentPosition.x, currentPosition.y, currentPosition.z))
      .multiply(new THREE.Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor))
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(currentQuaternion))
      .multiply(new THREE.Matrix4().makeTranslation(-currentPosition.x, -currentPosition.y, -currentPosition.z))
      .multiply(new THREE.Matrix4().makeTranslation(positionDiff.x, positionDiff.y, positionDiff.z))
      .decompose(container.position, container.quaternion, container.scale);
  }
};

// interface

const tools = interfaceDocument.querySelectorAll('.tool');
Array.from(tools).forEach((tool, i) => {
  tool.addEventListener('mousedown', e => {
    e.stopPropagation();
  });
  tool.addEventListener('click', e => {
    const _cancel = () => {
      e.preventDefault();
      e.stopPropagation();
    };

    if (tool.matches('[tool=commit]')) {
      _cancel();
      _commitMiningMeshes();
      _commitVoxelMiningMeshes();
    } else if (tool.matches('[tool=image]')) {
      // nothing
    /* } else if (tool.matches('[sidebar]')) {
      const wasOpen = tool.classList.contains('open');

      Array.from(tools)
        .filter(tool => tool.matches('[sidebar]'))
        .forEach(sidebar => {
          sidebar.classList.remove('open');
        });
      [
        'script-input',
        'contract-input',
      ].forEach(id => interfaceDocument.getElementById(id).classList.remove('open'));

      if (tool.matches('[tool=script]')) {
        interfaceDocument.getElementById('script-input').classList.toggle('open', !wasOpen);
      } else if (tool.matches('[tool=contract]')) {
        interfaceDocument.getElementById('contract-input').classList.toggle('open', !wasOpen);
      }

      tool.classList.toggle('open', !wasOpen); */
    } else if (tool.matches('[tool=center]')) {
      _cancel();
      _centerObjectMeshes();
    } else {
      _cancel();
      const newTool = tool.getAttribute('tool');
      if (newTool !== selectedTool) {
        Array.from(tools).forEach(tool => {
          tool.classList.remove('selected');
        });
        selectedTool = newTool;
        tool.classList.add('selected');
        
        uiMesh.update();
        
        _commitMiningMeshes();
        _commitVoxelMiningMeshes();

        if (!['camera', 'scalpel'].includes(selectedTool)) {
          _setHoveredObjectMesh(null);
          _setSelectedObjectMesh(null, false);
        }
      }

      if (selectedTool === 'camera') {
        document.pointerLockElement && document.exitPointerLock();
        orbitControls.enabled = true;
      } else if (selectedTool === 'firstperson' || selectedTool === 'thirdperson') {
        renderer.domElement.requestPointerLock();
        camera.position.y = 1.2;
        orbitControls.enabled = false;
      } else {
        document.pointerLockElement && document.exitPointerLock();
        orbitControls.enabled = false;
      }
    }
  });
});
document.addEventListener('pointerlockchange', e => {
  if (!document.pointerLockElement) {
    Array.from(tools).find(tool => tool.matches('.tool[tool=camera]')).click();
  }
});
let selectedTool = tools[0].getAttribute('tool');
tools[0].classList.add('selected');

const _bindUploadFileButton = (inputFileEl, handleUpload) => {
  inputFileEl.addEventListener('change', async e => {
    const {files} = e.target;
    if (files.length === 1) {
      const [file] = files;
      handleUpload(file);
    }

    const {parentNode} = inputFileEl;
    parentNode.removeChild(inputFileEl);
    const newInputFileEl = inputFileEl.ownerDocument.createElement('input');
    newInputFileEl.type = 'file';
    // newInputFileEl.id = 'upload-file-button';
    newInputFileEl.style.display = 'none';
    parentNode.appendChild(newInputFileEl);
    _bindUploadFileButton(newInputFileEl);
  });
};
_bindUploadFileButton(Array.from(tools).find(tool => tool.matches('[tool=image]')).querySelector('input[type=file]'), _handleUpload);

/* interfaceDocument.getElementById('script-input').addEventListener('mousedown', e => {
  e.stopPropagation();
});
const scriptInputTextarea = interfaceDocument.getElementById('script-input-textarea');
scriptInputTextarea.value = `renderer.addEventListener('tick', () => {
  // console.log('tick');
  objects.forEach(object => {
    object.position.y = 0.5 + Math.sin((Date.now() % 2000)/2000 * Math.PI*2);
  });
});`;
scriptInputTextarea.addEventListener('input', e => {
  if (scriptsBound) {
    bindObjectScript(objectState, e.target.value, objectMeshes);
  }
});
scriptInputTextarea.addEventListener('keydown', e => {
  e.stopPropagation();
});

interfaceDocument.getElementById('contract-input').addEventListener('mousedown', e => {
  e.stopPropagation();
});
const contractInputTextarea = interfaceDocument.getElementById('contract-input-textarea');
contractInputTextarea.value = `
pragma experimental ABIEncoderV2;

interface IRealityScriptEngine {
  function getOwner() external view returns (address);
}
interface IRealityScript {
  struct Transform {
      int256 x;
      int256 y;
      int256 z;
  }
  struct Object {
      uint256 id;
      Transform transform;
  }
}

contract RealityScript is IRealityScript {
  struct State {
      address addr;
      Transform transform;
      uint256 hp;
  }

  function abs(int x) internal pure returns (uint) {
      if (x < 0) {
          x *= -1;
      }
      return uint(x);
  }
  function sqrt(uint x) internal pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
  function stringEquals(string memory a, string memory b) internal pure returns (bool) {
      return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))) );
  }
  function transformEquals(Transform memory a, Transform memory b) internal pure returns (bool) {
      return a.x == b.x && a.y == b.y && a.z == b.z;
  }
  function someTransformEquals(Transform memory t, Object[] memory os) internal pure returns (bool) {
      for (uint256 i = 0; i < os.length; i++) {
          if (transformEquals(t, os[i].transform)) {
              return true;
          }
      }
      return false;
  }

  IRealityScriptEngine parent;
  uint256 id;
  uint256 hp;
  constructor(IRealityScriptEngine _parent, uint256 _id) public payable {
      parent = _parent;
      id = _id;
      hp = 100;
  }
  function initState(address a, Transform memory t) public view returns (State memory) {
      return State(a, t, hp);
  }
  function update(Transform memory t, Object[] memory os, State memory state) public pure returns (bool, State memory) {
      bool doApply = false;
      if (
        state.hp > 0 &&
        !transformEquals(t, state.transform) &&
        someTransformEquals(t, os)
      ) {
          state.hp--;
          doApply = true;
      }
      state.transform = t;
      return (doApply, state);
  }
  function applyState(State memory state) public {
      require(msg.sender == parent.getOwner());
      
      hp = state.hp;
  }
  function getHp() public view returns (uint256) {
      return hp;
  }
}
`;
contractInputTextarea.addEventListener('keydown', e => {
  e.stopPropagation();
}); */

const objectNameEl = interfaceDocument.getElementById('object-name');
objectNameEl.addEventListener('mousedown', e => {
  e.stopPropagation();
});
objectNameEl.addEventListener('keydown', e => {
  e.stopPropagation();
});
interfaceDocument.getElementById('ops-form').addEventListener('submit', async e => {
  e.preventDefault();
  e.stopPropagation();

  // const compiledContract = _compileContract(interfaceDocument.getElementById('contract-input-textarea').value);
  // console.log('got contract', compiledContract);

  await _commitMiningMeshes();
  _centerObjectMeshes();
  const [
    screenshotBlob,
    modelArrayBuffer,
  ] = await Promise.all([
    _screenshotMiningMeshes(),
    saveObjectMeshes(objectMeshes),
  ]);
  const dataUint8Array = XRPackage.compileRaw([
    {
      url: '/model.gltf',
      type: 'application/octet-stream',
      data: new Uint8Array(modelArrayBuffer),
    },
    {
      url: '/manifest.json',
      type: 'application/json',
      data: JSON.stringify({
        xr_type: 'gltf@0.0.1',
        xr_main: 'model.gltf',
      }, null, 2),
    }
  ]);

  const [
    dataHash,
    screenshotHash,
    modelHash,
  ] = await Promise.all([
    fetch(`${apiHost}/`, {
      method: 'PUT',
      body: dataUint8Array,
    })
      .then(res => res.json())
      .then(j => j.hash),
    fetch(`${apiHost}/`, {
      method: 'PUT',
      body: screenshotBlob,
    })
      .then(res => res.json())
      .then(j => j.hash),
    fetch(`${apiHost}/`, {
      method: 'PUT',
      body: modelArrayBuffer,
    })
      .then(res => res.json())
      .then(j => j.hash),
  ]);
  const metadataHash = await fetch(`${apiHost}/`, {
    method: 'PUT',
    body: JSON.stringify({
      objectName: objectNameEl.value,
      dataHash,
      screenshotHash,
      modelHash,
    }),
  })
    .then(res => res.json())
    .then(j => j.hash);

  const p = makePromise();
  const instance = await contract.getInstance();
  const account = await contract.getAccount();
  // const size = pointerMesh.getSize();
  instance.mint(1, 'hash', metadataHash, {
    from: account,
    // value: '1000000000000000000', // 1 ETH
    // value: '10000000000000000', // 0.01 ETH
  }, (err, value) => {
    if (!err) {
      p.accept(value);
    } else {
      p.reject(err);
    }
  });
  await p;
  // s = new WebSocket('ws://127.0.0.1:3001'); s.onopen = () => { s.send(JSON.stringify({method: 'initState', args: {id: 1, address: '0x5D4876215103302dB605F4259330f283AF2Cc1Db', transform: ['0x1', '0x0', '0x0'] }})); s.addEventListener('message', e => { console.log(e.data); const {result: {oid}} = JSON.parse(e.data); s.send(JSON.stringify({method: 'update', args: {oid, transform: ['0x0', '0x0', '0x0'] }})); s.addEventListener('message', e => { console.log(e.data); }, {once: true}); }, {once: true}); };
});
interfaceDocument.getElementById('new-op').addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();

  objectNameEl.value = '';
  _newMiningMeshes();
  _setHoveredObjectMesh(null);
  _setSelectedObjectMesh(null, false);
  for (let i = 0; i < objectMeshes.length; i++) {
    const objectMesh = objectMeshes[i];
    container.remove(objectMesh);
    objectMesh.destroy();
  }
  objectMeshes.length = 0;
});
_bindUploadFileButton(interfaceDocument.getElementById('load-op-input'), file => {
  const r = new FileReader();
  r.onload = async () => {
    const arrayBuffer = r.result;
    for (let i = 0; i < objectMeshes.length; i++) {
      const objectMesh = objectMeshes[i];
      container.remove(objectMesh);
      objectMesh.destroy();
    }
    objectMeshes.length = 0;
    const {objectMeshes: newObjectMeshes/*, script*/} = await loadObjectMeshes(arrayBuffer);
    objectMeshes.length = newObjectMeshes.length;
    for (let i = 0; i < newObjectMeshes.length; i++) {
      const newObjectMesh = newObjectMeshes[i];
      objectMeshes[i] = newObjectMesh;
      container.add(newObjectMesh);
    }
    /* if (script) {
      scriptInputTextarea.value = script;
      if (scriptsBound) {
        bindObjectScript(objectState, script, objectMeshes);
      }
    } */
  };
  r.readAsArrayBuffer(file);
});
interfaceDocument.getElementById('save-op').addEventListener('click', async e => {
  const arrayBuffer = await saveObjectMeshes(objectMeshes/*, scriptInputTextarea.value*/);
  const blob = new Blob([arrayBuffer], {
    type: 'model/gltf.binary',
  });
  downloadFile(blob, 'object.glb');
});

const colors = interfaceDocument.querySelectorAll('.color');
Array.from(colors).forEach(color => {
  const inner = color.querySelector('.inner');
  color.addEventListener('mousedown', e => {
    e.stopPropagation();
  });
  color.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    
    Array.from(colors).forEach(color => {
      color.classList.remove('selected');
    });
    currentColor = new THREE.Color().setStyle(inner.style.backgroundColor);
    color.classList.add('selected');
    
    uiMesh.update();
  });
});
let currentColor = new THREE.Color().setStyle(colors[0].querySelector('.inner').style.backgroundColor);
colors[0].classList.add('selected');

const brushSizeEl = interfaceDocument.getElementById('brush-size');
let brushSize = brushSizeEl.value;
brushSizeEl.addEventListener('mousedown', e => {
  e.stopPropagation();
});
brushSizeEl.addEventListener('input', e => {
  brushSize = e.target.value;
  interfaceDocument.getElementById('brush-size-text').innerHTML = brushSize;
});

const worldScaleEl = interfaceDocument.getElementById('world-scale');
worldScaleEl.addEventListener('mousedown', e => {
  e.stopPropagation();
});
let worldScale = worldScaleEl.value;
worldScaleEl.addEventListener('input', e => {
  worldScale = e.target.value;

  const cameraPosition = camera.position.clone()
    .add(new THREE.Vector3(0, 0, -1.5).applyQuaternion(camera.quaternion));
  container.matrix
    .premultiply(new THREE.Matrix4().makeTranslation(-cameraPosition.x, -cameraPosition.y, -cameraPosition.z))
    .premultiply(new THREE.Matrix4().makeScale(worldScale/container.scale.x, worldScale/container.scale.y, worldScale/container.scale.z))
    .premultiply(new THREE.Matrix4().makeTranslation(cameraPosition.x, cameraPosition.y, cameraPosition.z))
    .decompose(container.position, container.quaternion, container.scale);

  interfaceDocument.getElementById('world-scale-text').innerHTML = worldScale;
});

/* let scriptsBound = false;
interfaceDocument.getElementById('enable-scripts-button').addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();

  scriptsBound = !scriptsBound;
  if (scriptsBound) {
    bindObjectScript(objectState, scriptInputTextarea.value, objectMeshes);

    for (let i = 0; i < objectMeshes.length; i++) {
      const objectMesh = objectMeshes[i];
      objectMesh.originalPosition = objectMesh.position.clone();
      objectMesh.originalQuaternion = objectMesh.quaternion.clone();
      objectMesh.originalScale = objectMesh.scale.clone();
    }
  } else {
    bindObjectScript(objectState, null, null);

    for (let i = 0; i < objectMeshes.length; i++) {
      const objectMesh = objectMeshes[i];
      objectMesh.position.copy(objectMesh.originalPosition);
      objectMesh.quaternion.copy(objectMesh.originalQuaternion);
      objectMesh.scale.copy(objectMesh.originalScale);
      objectMesh.originalPosition = null;
      objectMesh.originalQuaternion = null;
      objectMesh.originalScale = null;
    }
  }
}); */

let physicsBound = false;
interfaceDocument.getElementById('enable-physics-button').addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();

  physicsBound = !physicsBound;
  if (physicsBound) {
    _bindObjectMeshPhysics();
  } else {
    _unbindObjectMeshPhysics();
  }
});

// multiplayer

initLocalRig(container);

let channelConnection = null;
const peerConnections = [];
const _connectMultiplayer = async rid => {
  const roomId = rid || makeId();

  channelConnection = new XRChannelConnection(`wss://presence.exokit.org/?c=${encodeURIComponent(roomId)}`);
  channelConnection.addEventListener('peerconnection', e => {
    const peerConnection = e.detail;

    bindPeerConnection(peerConnection, container);

    peerConnection.addEventListener('open', () => {
      peerConnections.push(peerConnection);
      document.getElementById('user-count-text').innerText = peerConnections.length + 1;
    });
    peerConnection.addEventListener('close', () => {
      peerConnections.splice(peerConnections.indexOf(peerConnection), 1);
      document.getElementById('user-count-text').innerText = peerConnections.length + 1;
    });
  });

  document.getElementById('room-code-text').innerText = roomId;
  const href = `${window.location.protocol}//${window.location.host}${window.location.pathname}?r=${roomId}`;
  document.getElementById('room-link').href = href;

  history.replaceState(null, '', href);
};
const _disconnectMultiplayer = async () => {
  if (channelConnection) {
    channelConnection.disconnect()
    channelConnection = null;

    const href = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    history.replaceState(null, '', href);
  }
};
window.addEventListener('beforeunload', _disconnectMultiplayer);

const header = document.getElementById('header');
const _clearMultiplayerClasses = () => {
  ['connected', 'dialog'].forEach(c => {
    header.classList.remove(c);
  });
};
document.getElementById('create-room-button').addEventListener('click', async e => {
  await _connectMultiplayer();

  _clearMultiplayerClasses();
  header.classList.add('connected');
});
document.getElementById('use-code-button').addEventListener('click', e => {
  _clearMultiplayerClasses();
  header.classList.add('dialog');
  document.getElementById('room-code-input').value = '';
});
document.getElementById('connect-button').addEventListener('click', async e => {
  await _connectMultiplayer(document.getElementById('room-code-input').value);

  _clearMultiplayerClasses();
  header.classList.add('connected');
});
document.getElementById('cancel-button').addEventListener('click', e => {
  _clearMultiplayerClasses();
});
document.getElementById('disconnect-button').addEventListener('click', async e => {
  await _disconnectMultiplayer();

  _clearMultiplayerClasses();
});

// xr

const rayMesh = (() => {
  const geometry = new THREE.CylinderBufferGeometry(0.002, 0.002, 1, 3, 1, false, 0, Math.PI*2)
    .applyMatrix4(new THREE.Matrix4().makeTranslation(0, 1/2, 0))
    .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI/2)));
  const material = new THREE.MeshBasicMaterial({
    color: 0x42a5f5,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  return mesh;
})();
scene.add(rayMesh);

const enterXrButton = interfaceDocument.getElementById('enter-xr-button');
let currentSession = null;
const triggerDowns = [false, false];
const gripDowns = [false, false];
let scaleState = null;
const lastSqueezes = [false, false];
function onSessionStarted(session) {
  session.addEventListener('end', onSessionEnded);

  renderer.xr.setSession(session);

  currentSession = session;

  const controllerModelFactory = new XRControllerModelFactory();
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('connected', e => {
      controller.userData.data = e.data;
    });
    controller.addEventListener('selectstart', e => {
      if (controller.userData.data && controller.userData.data.handedness === 'right') {
        _beginTool(true, false, false);
      }
      triggerDowns[i] = true;
    });
    controller.addEventListener('selectend', e => {
      if (controller.userData.data && controller.userData.data.handedness === 'right') {
        _endTool(true, false, false);
      }
      triggerDowns[i] = false;
    });

    const controllerGrip = renderer.xr.getControllerGrip(i);
    controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
    controllerGrip.addEventListener('squeezestart', e => {
      if (controller.userData.data && controller.userData.data.handedness === 'right') {
        _beginTool(false, true, false);
      }
      const oldGripDownsAll = gripDowns.every(gripDown => gripDown);
      gripDowns[i] = true;
      const newGripDownsAll = gripDowns.every(gripDown => gripDown);
      if (newGripDownsAll && !oldGripDownsAll) {
        _commitMiningMeshes();
        
        scaleState = {
          startPosition: renderer.xr.getControllerGrip(0).position.clone()
            .add(renderer.xr.getControllerGrip(1).position)
            .divideScalar(2),
          startDirection: renderer.xr.getControllerGrip(0).position.clone()
            .sub(renderer.xr.getControllerGrip(1).position)
            .normalize(),
          startWorldWidth: renderer.xr.getControllerGrip(0).position
            .distanceTo(renderer.xr.getControllerGrip(1).position),
          containerStartPosition: container.position.clone(),
          containerStartQuaternion: container.quaternion.clone(),
          containerStartScale: container.scale.clone(),
          containerStartMatrix: container.matrix.clone(),
        };
      }
    });
    controllerGrip.addEventListener('squeezeend', e => {
      if (controller.userData.data && controller.userData.data.handedness === 'right') {
        _endTool(false, true, false);
      }
      gripDowns[i] = false;
      const newGripDownsAll = gripDowns.every(gripDown => gripDown);
      if (!newGripDownsAll) {
        scaleState = null;
      }
    });
    scene.add(controllerGrip);
  }
}
function onSessionEnded() {
  currentSession.removeEventListener('end', onSessionEnded);

  currentSession = null;
}
enterXrButton.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  
  if (currentSession === null) {
    // WebXR's requestReferenceSpace only works if the corresponding feature
    // was requested at session creation time. For simplicity, just ask for
    // the interesting ones as optional features, but be aware that the
    // requestReferenceSpace call will fail if it turns out to be unavailable.
    // ('local' is always available for immersive sessions and doesn't need to
    // be requested separately.)
    navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: [
        'local-floor',
        'bounded-floor',
      ],
    }).then(onSessionStarted);
  } else {
    currentSession.end();
  }
});

const uiRenderer = (() => {
  const loadPromise = Promise.all([
    new Promise((accept, reject) => {
      const iframe = document.createElement('iframe');
      iframe.src = 'https://render.exokit.xyz/';
      iframe.onload = () => {
        accept(iframe);
      };
      iframe.onerror = err => {
        reject(err);
      };
      iframe.setAttribute('frameborder', 0);
      iframe.style.position = 'absolute';
      iframe.style.width = `${uiSize}px`;
      iframe.style.height = `${uiSize}px`;
      iframe.style.top = '-4096px';
      iframe.style.left = '-4096px';
      document.body.appendChild(iframe);
    }),
    fetch('interface-create.html')
      .then(res => res.text()),
  ]);

  let renderIds = 0;
  return {
    async render(searchResults, inventory, channels, selectedTab, rtcConnected, landConnected) {
      const [iframe, interfaceHtml] = await loadPromise;

      if (renderIds > 0) {
        iframe.contentWindow.postMessage({
          method: 'cancel',
          id: renderIds,
        });
      }

      const start = Date.now();
      const mc = new MessageChannel();
      const templateData = {
        width: uiSize,
        height: uiSize,
        zoom: 5,
        hideOps: true,
      };
      for (let i = 0; i < tools.length; i++) {
        templateData[`tool${i+1}Selected`] = selectedTool === tools[i].getAttribute('tool');
      }
      const currentColorString = currentColor.getHexString();
      for (let i = 0; i < colors.length; i++) {
        const colorString = new THREE.Color(colors[i].querySelector('.inner').style.backgroundColor).getHexString();
        templateData[`color${i+1}Selected`] = currentColorString === colorString;
      }
      iframe.contentWindow.postMessage({
        method: 'render',
        id: ++renderIds,
        htmlString: interfaceHtml,
        templateData,
        width: uiSize,
        height: uiSize,
        port: mc.port2,
      }, '*', [mc.port2]);
      const result = await new Promise((accept, reject) => {
        mc.port1.onmessage = e => {
          const {data} = e;
          const {error, result} = data;

          if (result) {
            console.log('time taken', Date.now() - start);

            accept(result);
          } else {
            reject(error);
          }
        };
      });
      return result;
    },
  };
})();
const uiMesh = (() => {
  const geometry = new THREE.PlaneBufferGeometry(0.2, 0.2)
    .applyMatrix4(new THREE.Matrix4().makeTranslation(0, uiWorldSize/2, 0));
  const canvas = document.createElement('canvas');
  canvas.width = uiSize;
  canvas.height = uiSize;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(uiSize, uiSize);
  const texture = new THREE.Texture(
    canvas,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.LinearFilter,
    THREE.LinearMipMapLinearFilter,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    16,
    THREE.LinearEncoding
  );
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  
  const highlightMesh = (() => {
    const geometry = new THREE.BoxBufferGeometry(1, 1, 0.01);
    const material = new THREE.MeshBasicMaterial({
      color: 0x42a5f5,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  })();
  /* highlightMesh.position.x = -uiWorldSize/2 + (10 + 150/2)/uiSize*uiWorldSize;
  highlightMesh.position.y = uiWorldSize - (60 + 150/2)/uiSize*uiWorldSize;
  highlightMesh.scale.x = highlightMesh.scale.y = 150/uiSize*uiWorldSize; */
  mesh.add(highlightMesh);

  let anchors = [];
  mesh.update = () => {
    uiRenderer.render()
      .then(result => {
        imageData.data.set(result.data);
        ctx.putImageData(imageData, 0, 0);
        texture.needsUpdate = true;
        mesh.visible = true;
        
        anchors = result.anchors;
        // console.log(anchors);
      });
  };
  let hoveredAnchor = null;
  mesh.intersect = uv => {
    hoveredAnchor = null;
    highlightMesh.visible = false;

    if (uv) {
      uv.y = 1 - uv.y;
      uv.multiplyScalar(uiSize);

      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        const {top, bottom, left, right, width, height} = anchor;
        // console.log('check', {x: uv.x, y: uv.y, top, bottom, left, right});
        if (uv.x >= left && uv.x < right && uv.y >= top && uv.y < bottom) {
          hoveredAnchor = anchor;
          
          highlightMesh.position.x = -uiWorldSize/2 + (left + width/2)/uiSize*uiWorldSize;
          highlightMesh.position.y = uiWorldSize - (top + height/2)/uiSize*uiWorldSize;
          highlightMesh.scale.x = width/uiSize*uiWorldSize;
          highlightMesh.scale.y = height/uiSize*uiWorldSize;
          highlightMesh.visible = true;
          break;
        }
      }
    }
  };
  mesh.click = () => {
    if (hoveredAnchor) {
      const {id} = hoveredAnchor;
      if (/^(?:tool-|color-)/.test(id)) {
        interfaceDocument.getElementById(id).click();
      } else {
        switch (id) {
          default: {
            console.warn('unknown anchor click', id);
            break;
          }
        }
      }
      return true;
    } else {
      return false;
    }
  };
  mesh.update();

  return mesh;
})();
uiMesh.position.set(0, 0.5, 0.5);
scene.add(uiMesh);

const velocity = new THREE.Vector3();
function animate() {
  orbitControls.enabled && orbitControls.update();
  
  if (currentSession) {
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      if (controller.userData.data) {
        if (controller.userData.data.handedness === 'left') {
          uiMesh.position.copy(controller.position);
          uiMesh.quaternion.copy(controller.quaternion);
        } else if (controller.userData.data.handedness === 'right') {
          _updateRaycasterFromObject(localRaycaster, controller);
          _updateTool(localRaycaster);
        }
      }
    }

    _updateControllers();

    updatePlayerFromXr(renderer.xr, camera);
  } else {
    const speed = 0.015 * (keys.shift ? 3 : 1);
    const cameraEuler = camera.rotation.clone();
    cameraEuler.x = 0;
    cameraEuler.z = 0;
    const extraVelocity = new THREE.Vector3();
    if (keys.left) {
      extraVelocity.add(new THREE.Vector3(-1, 0, 0).applyEuler(cameraEuler));
    }
    if (keys.right) {
      extraVelocity.add(new THREE.Vector3(1, 0, 0).applyEuler(cameraEuler));
    }
    if (keys.up) {
      extraVelocity.add(new THREE.Vector3(0, 0, -1).applyEuler(cameraEuler));
    }
    if (keys.down) {
      extraVelocity.add(new THREE.Vector3(0, 0, 1).applyEuler(cameraEuler));
    }
    if (extraVelocity.length() > 0) {
      extraVelocity.normalize().multiplyScalar(speed);
    }
    velocity.add(extraVelocity);
    camera.position.add(velocity);
    velocity.multiplyScalar(0.7);
    
    orbitControls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -1.5).applyQuaternion(camera.quaternion));
    
    updatePlayerFromCamera(camera);
  }

  for (let i = 0; i < peerConnections.length; i++) {
    const peerConnection = peerConnections[i];
    peerConnection.rig && peerConnection.rig.update();
  }

  tickObjectScript(objectState);

  if (ammo) {
    ammo.simulate();
    for (let i = 0; i < objectMeshes.length; i++) {
      ammo.updateObjectMesh(objectMeshes[i]);
    }
  }

  const thirdperson = selectedTool === 'thirdperson';
  let oldCameraPosition;
  if (thirdperson) {
    oldCameraPosition = camera.position.clone();
    camera.position.add(new THREE.Vector3(0, 0, 2).applyQuaternion(camera.quaternion));
  }
  renderer.render(scene, camera);
  if (thirdperson) {
    camera.position.copy(oldCameraPosition);
  }
}
renderer.setAnimationLoop(animate);

(async () => {
  const q = parseQuery(window.location.search);
  const {r, o} = q;
  if (r) {
    document.getElementById('room-code-input').value = r;
    document.getElementById('connect-button').click();
  } else if (o) {
    const metadata = await fetch(`${apiHost}/${o}`)
      .then(res => res.json());
    const {objectName, modelHash} = metadata;
    objectNameEl.value = objectName;
    const arrayBuffer = await fetch(`${apiHost}/${modelHash}`)
      .then(res => res.arrayBuffer());
    for (let i = 0; i < objectMeshes.length; i++) {
      const objectMesh = objectMeshes[i];
      container.remove(objectMesh);
      objectMesh.destroy();
    }
    objectMeshes.length = 0;
    const {objectMeshes: newObjectMeshes, script/*, shader: {vertex, fragment}*/} = await loadObjectMeshes(arrayBuffer);
    objectMeshes.length = newObjectMeshes.length;
    for (let i = 0; i < newObjectMeshes.length; i++) {
      const newObjectMesh = newObjectMeshes[i];
      objectMeshes[i] = newObjectMesh;
      container.add(newObjectMesh);
    }
    /* if (script) {
      scriptInputTextarea.value = script;
      if (scriptsBound) {
        bindObjectScript(objectState, script, objectMeshes);
      }
    } */
  }
})();

navigator.xr && navigator.xr.isSessionSupported('immersive-vr').then(supported => {
  if (supported) {
    renderer.xr.enabled = true;
    enterXrButton.classList.remove('disabled');
  } else {
    // nothing
  }
});

};

const interfaceIframe = document.getElementById('interface-iframe');
const interfaceWindow = interfaceIframe.contentWindow;
const interfaceDocument = interfaceIframe.contentDocument;
if (interfaceDocument.readyState === 'complete') {
  _load();
} else {
  interfaceDocument.addEventListener('readystatechange', () => {
    if (interfaceDocument.readyState === 'complete') {
      _load();
    }
  });
}