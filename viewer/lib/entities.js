const THREE = require('three')
const TWEEN = require('@tweenjs/tween.js')

const Entity = require('./entity/Entity')
const { dispose3 } = require('./dispose')

const { createCanvas } = require('canvas')

function getEntityMesh (entity, scene) {
  if (entity.name) {
    try {
      const e = new Entity('1.16.4', entity.name, scene)

      if (entity.username !== undefined) {
        const canvas = createCanvas(512, 128)

        const ctx = canvas.getContext('2d')
        
        // Use a bold, readable font
        ctx.font = 'bold 48px Minecraft, monospace, Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const txt = entity.username
        
        // Add a dark background for contrast
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Add text shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
        
        // Draw white text
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
        sprite.scale.set(2, 0.5, 1) // Make it wider and shorter
        sprite.position.y += entity.height + 0.6

        e.mesh.add(sprite)
        
        // Try to load and apply Minecraft skin if username is available
        if (entity.username) {
          loadMinecraftSkin(e.mesh, entity.username)
        }
      }
      return e.mesh
    } catch (err) {
      console.log(err)
    }
  }

  const geometry = new THREE.BoxGeometry(entity.width, entity.height, entity.width)
  geometry.translate(0, entity.height / 2, 0)
  const material = new THREE.MeshBasicMaterial({ color: 0xff00ff })
  const cube = new THREE.Mesh(geometry, material)
  return cube
}

// Function to load Minecraft skin from Mojang API or crafatar
function loadMinecraftSkin(mesh, username) {
  // Try multiple skin services
  const skinUrls = [
    `https://crafatar.com/skins/${username}`,
    `https://minotar.net/skin/${username}`
  ]
  
  const loader = new THREE.TextureLoader()
  
  function tryLoadSkin(index) {
    if (index >= skinUrls.length) {
      console.log(`Could not load skin for ${username}`)
      return
    }
    
    loader.load(
      skinUrls[index],
      (texture) => {
        texture.magFilter = THREE.NearestFilter
        texture.minFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        
        // Apply texture to the player model
        // This assumes the Entity mesh has materials we can update
        mesh.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.map === null || mat.name === 'skin') {
                  mat.map = texture
                  mat.needsUpdate = true
                }
              })
            } else {
              if (child.material.map === null || child.material.name === 'skin') {
                child.material.map = texture
                child.material.needsUpdate = true
              }
            }
          }
        })
        
        console.log(`Loaded skin for ${username}`)
      },
      undefined,
      (error) => {
        // Try next URL on error
        console.log(`Failed to load skin from ${skinUrls[index]}, trying next...`)
        tryLoadSkin(index + 1)
      }
    )
  }
  
  tryLoadSkin(0)
}

class Entities {
  constructor (scene) {
    this.scene = scene
    this.entities = {}
  }

  clear () {
    for (const mesh of Object.values(this.entities)) {
      this.scene.remove(mesh)
      dispose3(mesh)
    }
    this.entities = {}
  }

  update (entity) {
    if (!this.entities[entity.id]) {
      const mesh = getEntityMesh(entity, this.scene)
      if (!mesh) return
      this.entities[entity.id] = mesh
      this.scene.add(mesh)
    }

    const e = this.entities[entity.id]

    if (entity.delete) {
      this.scene.remove(e)
      dispose3(e)
      delete this.entities[entity.id]
    }

    if (entity.pos) {
      new TWEEN.Tween(e.position).to({ x: entity.pos.x, y: entity.pos.y, z: entity.pos.z }, 50).start()
    }
    if (entity.yaw) {
      const da = (entity.yaw - e.rotation.y) % (Math.PI * 2)
      const dy = 2 * da % (Math.PI * 2) - da
      new TWEEN.Tween(e.rotation).to({ y: e.rotation.y + dy }, 50).start()
    }
  }
}

module.exports = { Entities }
