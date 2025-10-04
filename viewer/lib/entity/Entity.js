/* global THREE */

const entities = require('./entities.json')
const { loadTexture } = globalThis.isElectron ? require('../utils.electron.js') : require('../utils')

const elemFaces = {
  up: {
    dir: [0, 1, 0],
    u0: [0, 0, 1],
    v0: [0, 0, 0],
    u1: [1, 0, 1],
    v1: [0, 0, 1],
    corners: [
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [0, 1, 0, 0, 1],
      [1, 1, 0, 1, 1]
    ]
  },
  down: {
    dir: [0, -1, 0],
    u0: [1, 0, 1],
    v0: [0, 0, 0],
    u1: [2, 0, 1],
    v1: [0, 0, 1],
    corners: [
      [1, 0, 1, 0, 0],
      [0, 0, 1, 1, 0],
      [1, 0, 0, 0, 1],
      [0, 0, 0, 1, 1]
    ]
  },
  east: {
    dir: [1, 0, 0],
    u0: [0, 0, 0],
    v0: [0, 0, 1],
    u1: [0, 0, 1],
    v1: [0, 1, 1],
    corners: [
      [1, 1, 1, 0, 0],
      [1, 0, 1, 0, 1],
      [1, 1, 0, 1, 0],
      [1, 0, 0, 1, 1]
    ]
  },
  west: {
    dir: [-1, 0, 0],
    u0: [1, 0, 1],
    v0: [0, 0, 1],
    u1: [1, 0, 2],
    v1: [0, 1, 1],
    corners: [
      [0, 1, 0, 0, 0],
      [0, 0, 0, 0, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 1, 1]
    ]
  },
  north: {
    dir: [0, 0, -1],
    u0: [0, 0, 1],
    v0: [0, 0, 1],
    u1: [1, 0, 1],
    v1: [0, 1, 1],
    corners: [
      [1, 0, 0, 0, 1],
      [0, 0, 0, 1, 1],
      [1, 1, 0, 0, 0],
      [0, 1, 0, 1, 0]
    ]
  },
  south: {
    dir: [0, 0, 1],
    u0: [1, 0, 2],
    v0: [0, 0, 1],
    u1: [2, 0, 2],
    v1: [0, 1, 1],
    corners: [
      [0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1],
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0]
    ]
  }
}

function dot (a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function addCube (attr, boneId, bone, cube, texWidth = 64, texHeight = 64) {
  const cubeRotation = new THREE.Euler(0, 0, 0)
  if (cube.rotation) {
    cubeRotation.x = -cube.rotation[0] * Math.PI / 180
    cubeRotation.y = -cube.rotation[1] * Math.PI / 180
    cubeRotation.z = -cube.rotation[2] * Math.PI / 180
  }
  for (const { dir, corners, u0, v0, u1, v1 } of Object.values(elemFaces)) {
    const ndx = Math.floor(attr.positions.length / 3)

    for (const pos of corners) {
      const u = (cube.uv[0] + dot(pos[3] ? u1 : u0, cube.size)) / texWidth
      const v = (cube.uv[1] + dot(pos[4] ? v1 : v0, cube.size)) / texHeight

      const inflate = cube.inflate ? cube.inflate : 0
      let vecPos = new THREE.Vector3(
        cube.origin[0] + pos[0] * cube.size[0] + (pos[0] ? inflate : -inflate),
        cube.origin[1] + pos[1] * cube.size[1] + (pos[1] ? inflate : -inflate),
        cube.origin[2] + pos[2] * cube.size[2] + (pos[2] ? inflate : -inflate)
      )

      vecPos = vecPos.applyEuler(cubeRotation)
      vecPos = vecPos.sub(bone.position)
      vecPos = vecPos.applyEuler(bone.rotation)
      vecPos = vecPos.add(bone.position)

      attr.positions.push(vecPos.x, vecPos.y, vecPos.z)
      attr.normals.push(...dir)
      attr.uvs.push(u, v)
      attr.skinIndices.push(boneId, 0, 0, 0)
      attr.skinWeights.push(1, 0, 0, 0)
    }

    attr.indices.push(
      ndx, ndx + 1, ndx + 2,
      ndx + 2, ndx + 1, ndx + 3
    )
  }
}

function getMesh (texture, jsonModel, customTextureUrl = null) {
  const bones = {}

  const geoData = {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    skinIndices: [],
    skinWeights: []
  }
  let i = 0
  for (const jsonBone of jsonModel.bones) {
    const bone = new THREE.Bone()
    bone.name = jsonBone.name
    if (jsonBone.pivot) {
      bone.position.x = jsonBone.pivot[0]
      bone.position.y = jsonBone.pivot[1]
      bone.position.z = jsonBone.pivot[2]
    }
    if (jsonBone.bind_pose_rotation) {
      bone.rotation.x = -jsonBone.bind_pose_rotation[0] * Math.PI / 180
      bone.rotation.y = -jsonBone.bind_pose_rotation[1] * Math.PI / 180
      bone.rotation.z = -jsonBone.bind_pose_rotation[2] * Math.PI / 180
    } else if (jsonBone.rotation) {
      bone.rotation.x = -jsonBone.rotation[0] * Math.PI / 180
      bone.rotation.y = -jsonBone.rotation[1] * Math.PI / 180
      bone.rotation.z = -jsonBone.rotation[2] * Math.PI / 180
    }
    
    // Store initial rotation for animation
    bone.userData.initialRotation = bone.rotation.clone()
    
    bones[jsonBone.name] = bone

    if (jsonBone.cubes) {
      for (const cube of jsonBone.cubes) {
        addCube(geoData, i, bone, cube, jsonModel.texturewidth, jsonModel.textureheight)
      }
    }
    i++
  }

  const rootBones = []
  for (const jsonBone of jsonModel.bones) {
    if (jsonBone.parent) bones[jsonBone.parent].add(bones[jsonBone.name])
    else rootBones.push(bones[jsonBone.name])
  }

  const skeleton = new THREE.Skeleton(Object.values(bones))

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(geoData.positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geoData.normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geoData.uvs, 2))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(geoData.skinIndices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(geoData.skinWeights, 4))
  geometry.setIndex(geoData.indices)

  const material = new THREE.MeshLambertMaterial({ transparent: true, skinning: true, alphaTest: 0.1 })
  material.name = 'skin'
  const mesh = new THREE.SkinnedMesh(geometry, material)
  mesh.add(...rootBones)
  mesh.bind(skeleton)
  mesh.scale.set(1 / 16, 1 / 16, 1 / 16)

  // Store bones reference for animations
  mesh.userData.bones = bones

  // Load texture
  if (customTextureUrl) {
    const loader = new THREE.TextureLoader()
    loader.load(customTextureUrl, texture => {
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.flipY = false
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      material.map = texture
      material.needsUpdate = true
    })
  } else {
    loadTexture(texture, texture => {
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.flipY = false
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      material.map = texture
    })
  }

  return mesh
}

class Entity {
  constructor (version, type, scene, customSkinUrl = null) {
    const e = entities[type]
    if (!e) throw new Error(`Unknown entity ${type}`)

    this.mesh = new THREE.Object3D()
    this.type = type
    this.animationState = {
      isMoving: false,
      isFlying: false,
      isSneaking: false,
      isSwimming: false,
      isGliding: false,
      isAttacking: false,
      walkCycle: 0,
      attackTime: 0,
      velocity: new THREE.Vector3()
    }
    
    for (const [name, jsonModel] of Object.entries(e.geometry)) {
      const texture = e.textures[name]
      if (!texture) continue
      
      const texturePath = customSkinUrl || (texture.replace('textures', 'textures/' + version) + '.png')
      const mesh = getMesh(texturePath, jsonModel, customSkinUrl)
      
      this.mesh.add(mesh)
    }
  }

  // Update animation based on movement
  updateAnimation(velocity, isFlying, isSneaking, isSwimming, isGliding) {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
    this.animationState.isMoving = speed > 0.01
    this.animationState.velocity.copy(velocity)
    this.animationState.isFlying = isFlying || false
    this.animationState.isSneaking = isSneaking || false
    this.animationState.isSwimming = isSwimming || false
    this.animationState.isGliding = isGliding || false
    
    // Update walk cycle
    if (this.animationState.isMoving) {
      const walkSpeed = isFlying ? 0.3 : (isSneaking ? 0.08 : 0.15)
      this.animationState.walkCycle += walkSpeed * (speed * 10)
    }
    
    // Update attack timer
    if (this.animationState.attackTime > 0) {
      this.animationState.attackTime--
    }
    
    this.applyAnimations()
  }

  // Trigger attack animation
  attack() {
    this.animationState.isAttacking = true
    this.animationState.attackTime = 6
  }

  // Apply animations to bones
  applyAnimations() {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.userData.bones) {
        const bones = child.userData.bones
        
        // Reset bones to initial rotation
        Object.values(bones).forEach(bone => {
          if (bone.userData.initialRotation) {
            bone.rotation.copy(bone.userData.initialRotation)
          }
        })
        
        // Apply walking animation
        if (this.animationState.isMoving && !this.animationState.isFlying) {
          const swing = Math.sin(this.animationState.walkCycle) * 0.6
          const swingAbs = Math.abs(swing) * 0.3
          
          // Legs
          if (bones.leftLeg) {
            bones.leftLeg.rotation.x += swing
          }
          if (bones.rightLeg) {
            bones.rightLeg.rotation.x -= swing
          }
          
          // Arms (opposite of legs)
          if (bones.leftArm) {
            bones.leftArm.rotation.x -= swing * 0.6
          }
          if (bones.rightArm && this.animationState.attackTime === 0) {
            bones.rightArm.rotation.x += swing * 0.6
          }
          
          // Body bob
          if (bones.body) {
            bones.body.position.y = swingAbs * 0.5
          }
        }
        
        // Flying/swimming animation
        if (this.animationState.isFlying || this.animationState.isSwimming) {
          const swim = Math.sin(this.animationState.walkCycle * 2) * 0.3
          
          if (bones.leftLeg) {
            bones.leftLeg.rotation.x = swim
          }
          if (bones.rightLeg) {
            bones.rightLeg.rotation.x = -swim
          }
          if (bones.leftArm) {
            bones.leftArm.rotation.x = -swim
          }
          if (bones.rightArm && this.animationState.attackTime === 0) {
            bones.rightArm.rotation.x = swim
          }
        }
        
        // Gliding pose
        if (this.animationState.isGliding) {
          if (bones.leftArm) {
            bones.leftArm.rotation.x = -Math.PI / 2
            bones.leftArm.rotation.z = -0.3
          }
          if (bones.rightArm) {
            bones.rightArm.rotation.x = -Math.PI / 2
            bones.rightArm.rotation.z = 0.3
          }
          if (bones.leftLeg) {
            bones.leftLeg.rotation.x = Math.PI / 4
          }
          if (bones.rightLeg) {
            bones.rightLeg.rotation.x = Math.PI / 4
          }
        }
        
        // Sneaking pose
        if (this.animationState.isSneaking && !this.animationState.isFlying) {
          if (bones.body) {
            bones.body.rotation.x = 0.5
            bones.body.position.y = -2
          }
          if (bones.head) {
            bones.head.rotation.x = -0.5
          }
          if (bones.leftLeg) {
            bones.leftLeg.rotation.x += 0.5
          }
          if (bones.rightLeg) {
            bones.rightLeg.rotation.x += 0.5
          }
        }
        
        // Attack animation
        if (this.animationState.attackTime > 0) {
          const attackProgress = this.animationState.attackTime / 6
          if (bones.rightArm) {
            bones.rightArm.rotation.x = -Math.PI / 2 + (1 - attackProgress) * Math.PI / 3
            bones.rightArm.rotation.y = attackProgress * 0.5
          }
        }
      }
    })
  }
}

module.exports = Entity