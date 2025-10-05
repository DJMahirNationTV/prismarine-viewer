const THREE = require('three')
const TWEEN = require('@tweenjs/tween.js')

const Entity = require('./entity/Entity')
const { dispose3 } = require('./dispose')

const { createCanvas } = require('canvas')

function getSkinUrl (username) {
  return `https://starlightskins.lunareclipse.studio/render/skin/${username}/default`
}

function getEntityMesh (entity, scene) {
  if (entity.name) {
    try {
      // Get skin URL if this is a player
      const skinUrl = (entity.name === 'player' && entity.username) ? getSkinUrl(entity.username) : null
      const e = new Entity('1.16.4', entity.name, scene, skinUrl)
      

      if (entity.username !== undefined) {
        // Create nametag
        const canvas = createCanvas(512, 128)
        const ctx = canvas.getContext('2d')
        
        // Use a bold, readable font
        ctx.font = 'bold 48px monospace'
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
        sprite.scale.set(2, 0.5, 1)
        sprite.position.y += entity.height + 0.6

        e.mesh.add(sprite)
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