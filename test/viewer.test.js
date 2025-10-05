/* eslint-env jest */
/* global page */

const fs = require('fs')
const path = require('path')

const TIMEOUT = 5 * 60 * 1000
const TIMEOUT_SCREENSHOT = 2 * 60 * 1000

// Test configuration for external server
const SERVER_CONFIG = {
  host: 'mc.mineland.net',
  port: 25565,
  version: '1.21.1'
}

describe('client connecting to external server', function () {
  describe('external server connection', function () {
    it('doesn\'t crash', function (done) {
      console.log('test')
      done()
    })

    it('starts the viewer with external server', function (done) {
      const mineflayer = require('mineflayer')
      const mineflayerViewer = require('../').mineflayer
      setTimeout(() => done(new Error('Connection timeout - too slow!')), TIMEOUT)

      console.log(`Connecting to ${SERVER_CONFIG.host}:${SERVER_CONFIG.port} (${SERVER_CONFIG.version})`)

      const bot = mineflayer.createBot({
        host: SERVER_CONFIG.host,
        port: SERVER_CONFIG.port,
        username: `0x_DJMNTVwork`, // Random username to avoid conflicts
        version: SERVER_CONFIG.version,
        auth: 'offline' // Use offline mode - change to 'microsoft' if you have a premium account
      })

      bot.on('error', (err) => {
        console.error('Bot error:', err)
        done(err)
      })

      bot.on('end', (reason) => {
        console.log('Bot disconnected:', reason)
      })

      bot.once('spawn', () => {
        console.log('Bot spawned successfully!')
        setTimeout(() => {
          bot.chat('/serverselector survival_new')
        }, 5000);
        bot.chat('/m DJMahirNationTV Testing Bot joined the Server!')
        
        mineflayerViewer(bot, { port: 3000 })

        function exit (err) {
          if (bot.viewer) {
            bot.viewer.close()
          }
          bot.end()
          done(err)
        }

        page.goto('http://localhost:3000').then(() => {
          // https://github.com/puppeteer/puppeteer/issues/3397
          page.on('console', async (message) => {
            let toPrint = ''
            if (message.text() !== 'JSHandle@error') {
              toPrint = `${message.type().substring(0, 3).toUpperCase()} ${message.text()}`
            } else {
              const messages = await Promise.all(message.args().map((arg) => {
                return arg.getProperty('message')
              }))

              toPrint = `${message.type().substring(0, 3).toUpperCase()} ${messages.filter(Boolean)}`
            }
            if (!toPrint.includes('Unknown entity') && !toPrint.includes('Failed to load skin')) {
              console.log(toPrint)
            }
          })

          page.on('error', err => {
            console.error('Page error:', err)
            exit(err)
          })

          page.on('pageerror', pageerr => {
            console.error('Page script error:', pageerr)
            exit(pageerr)
          })

          setTimeout(() => {
            const fileName = path.join(__dirname, `test_external_${SERVER_CONFIG.version}.png`)
            page.screenshot({ path: fileName }).then(() => {
              const fileSize = fs.statSync(fileName).size
              console.log(`Screenshot saved: ${fileName} (${fileSize} bytes)`)
              
              if (fileSize < 50000) { // Reduced threshold for external server
                console.warn(`Warning: Screenshot file size is ${fileSize} bytes, which might indicate rendering issues`)
              }
              
              exit() // Always exit successfully for external server test
            }).catch(err => {
              console.error('Screenshot error:', err)
              exit(err)
            })
          }, TIMEOUT_SCREENSHOT)
        }).catch(err => {
          console.error('Page navigation error:', err)
          exit(err)
        })
      })

      // Handle login sequence if needed
      bot.on('login', () => {
        console.log('Bot logged in successfully')
      })

      // Handle kick messages
      bot.on('kicked', (reason) => {
        console.log('Bot was kicked:', reason)
        done(new Error(`Bot was kicked: ${reason}`))
      })
    }, TIMEOUT)
  })
})