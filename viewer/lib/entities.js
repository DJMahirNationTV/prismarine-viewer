const THREE = require('three')
const TWEEN = require('@tweenjs/tween.js')

const Entity = require('./entity/Entity')
const { dispose3 } = require('./dispose')

const { createCanvas } = require('canvas')

const skinCache = {}

function getSkinUrl (username) {
  return `https://mineskin.eu/skin/${username}`
}

function getEntityMesh (entity, scene) {
  if (entity.name) {
    try {
      const skinUrl = entity.username ? getSkinUrl(entity.username) : null
      const e = new Entity('1.16.4', entity.name, scene, skinUrl)

      if (entity.username !== undefined) {
        const canvas = createCanvas(512, 128)
        const ctx = canvas.getContext('2d')

        ctx.font = 'bold 48px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const txt = entity.username

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2

        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(txt, canvas.width / 2, canvas.height / 2)

        const tex = new THREE.Texture(canvas)
        tex.needsUpdate = true
        const spriteMat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
          depthWrite: false
        })
        const sprite = new THREE.Sprite(spriteMat)
        sprite.scale.set(2, 0.5, 1)
        sprite.position.y += entity.height + 0.6

        e.mesh.add(sprite)

        if (entity.username) {
          loadMinecraftSkinForEntity(e.mesh, entity.username)
        }
      }

      // Return the entity object with mesh
      return e
    } catch (err) {
      console.log(err)
    }
  }

  const geometry = new THREE.BoxGeometry(entity.width, entity.height, entity.width)
  geometry.translate(0, entity.height / 2, 0)
  const material = new THREE.MeshBasicMaterial({ color: 0xff00ff })
  const cube = new THREE.Mesh(geometry, material)

  // Return a dummy entity object for non-player entities
  return {
    mesh: cube,
    updateAnimation: () => {},
    animationState: { walkCycle: 0 }
  }
}

function loadMinecraftSkinForEntity (mesh, username) {
  if (skinCache[username]) {
    applySkinToMesh(mesh, skinCache[username])
    return
  }

  const skinUrls = [
    `https://mineskin.eu/skin/${username}`,
    `https://starlightskins.lunareclipse.studio/render/skin/${username}/default`
  ]

  const loader = new THREE.TextureLoader()

  function tryLoadSkin (index) {
    if (index >= skinUrls.length) {
      console.log(`Could not load skin for ${username} from any source`)
      return
    }

    loader.load(
      skinUrls[index],
      (texture) => {
        texture.magFilter = THREE.NearestFilter
        texture.minFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping

        skinCache[username] = texture
        applySkinToMesh(mesh, texture)

        console.log(`✓ Loaded skin for ${username} from ${skinUrls[index]}`)
      },
      undefined,
      (error) => {
        console.log(`✗ Failed to load skin from ${skinUrls[index]}, trying next...`)
        tryLoadSkin(index + 1)
      }
    )
  }

  tryLoadSkin(0)
}

function applySkinToMesh (mesh, skinTexture) {
  mesh.traverse((child) => {
    if (child.isMesh || child instanceof THREE.SkinnedMesh) {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            mat.map = skinTexture
            mat.needsUpdate = true
          })
        } else {
          child.material.map = skinTexture
          child.material.needsUpdate = true
        }
      }
    }
  })
}

class Entities {
  constructor (scene) {
    this.scene = scene
    this.entities = {}
    this.entityStates = {}
  }

  clear () {
    for (const entityId in this.entities) {
      const e = this.entities[entityId]
      if (e && e.mesh) {
        this.scene.remove(e.mesh)
        dispose3(e.mesh)
      }
    }
    this.entities = {}
    this.entityStates = {}
  }

  update (entity) {
    if (!this.entities[entity.id]) {
      const entityObj = getEntityMesh(entity, this.scene)
      if (!entityObj || !entityObj.mesh) return

      this.entities[entity.id] = entityObj
      this.entityStates[entity.id] = {
        lastPos: entity.pos ? new THREE.Vector3(entity.pos.x, entity.pos.y, entity.pos.z) : new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        onGround: true,
        lastUpdate: Date.now()
      }
      this.scene.add(entityObj.mesh)
    }

    const e = this.entities[entity.id]
    const state = this.entityStates[entity.id]

    if (entity.delete) {
      if (e && e.mesh) {
        this.scene.remove(e.mesh)
        dispose3(e.mesh)
      }
      delete this.entities[entity.id]
      delete this.entityStates[entity.id]
      return
    }

    if (entity.pos) {
      const newPos = new THREE.Vector3(entity.pos.x, entity.pos.y, entity.pos.z)
      const now = Date.now()
      const deltaTime = (now - state.lastUpdate) / 1000 // seconds

      // Calculate velocity
      if (state.lastPos && deltaTime > 0) {
        state.velocity.subVectors(newPos, state.lastPos).divideScalar(deltaTime)
      }

      // Update position with tween
      new TWEEN.Tween(e.mesh.position).to({
        x: entity.pos.x,
        y: entity.pos.y,
        z: entity.pos.z
      }, 50).start()

      state.lastPos.copy(newPos)
      state.lastUpdate = now

      // Determine movement state
      const horizontalSpeed = Math.sqrt(state.velocity.x ** 2 + state.velocity.z ** 2)
      const isMoving = horizontalSpeed > 0.01
      const isFlying = Math.abs(state.velocity.y) > 0.08 && !state.onGround
      const isFalling = state.velocity.y < -0.2
      const isGliding = isFalling && Math.abs(state.velocity.y) < 0.5 && horizontalSpeed > 0.2

      // Update animation state immediately
      if (e.updateAnimation && typeof e.updateAnimation === 'function') {
        e.updateAnimation(
          state.velocity,
          isFlying,
          entity.isSneaking || false,
          entity.isSwimming || false,
          isGliding
        )
      }

      // Update onGround state
      if (Math.abs(state.velocity.y) < 0.02) {
        state.onGround = true
      } else if (state.velocity.y < -0.1) {
        state.onGround = false
      }
    }

    if (entity.yaw !== undefined && e.mesh) {
      const da = (entity.yaw - e.mesh.rotation.y) % (Math.PI * 2)
      const dy = 2 * da % (Math.PI * 2) - da
      new TWEEN.Tween(e.mesh.rotation).to({ y: e.mesh.rotation.y + dy }, 50).start()
    }
  }

  // Call this in the render loop to update all animations
  tick () {
    for (const entityId in this.entities) {
      const entity = this.entities[entityId]
      const state = this.entityStates[entityId]

      if (entity && entity.updateAnimation && typeof entity.updateAnimation === 'function' && state) {
        const horizontalSpeed = Math.sqrt(state.velocity.x ** 2 + state.velocity.z ** 2)
        const isFlying = !state.onGround && state.velocity.y > 0.05
        const isGliding = !state.onGround && state.velocity.y < -0.1 && horizontalSpeed > 0.1

        entity.updateAnimation(
          state.velocity,
          isFlying,
          false,
          false,
          isGliding
        )
      }
    }
  }
}

module.exports = { Entities }
