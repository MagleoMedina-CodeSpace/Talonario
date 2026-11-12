import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { openDb, getSetting, setSetting } from './server/db.js'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const CAL_PATH = resolve(projectRoot, 'src/calibration.json')
const EMP_PATH = resolve(projectRoot, 'src/empresas.json')
const DB_PATH = resolve(projectRoot, 'data/talonario.db')
const MAX_BODY = 256 * 1024

const norm = (p) => p.replace(/\\/g, '/')

const db = openDb(DB_PATH)

// Siembra: la primera vez copia lo que ya esta en calibration.json.
if (getSetting(db, 'calibration') == null) {
  try {
    const raw = readFileSync(CAL_PATH, 'utf8')
    JSON.parse(raw)
    setSetting(db, 'calibration', raw)
  } catch (e) {}
}

// Endpoint de archivos (solo dev). La calibracion ahora vive en SQLite.
const ENDPOINTS = {
  '/__save-empresas': EMP_PATH
}

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function readBody(req, res, cb) {
  let body = ''
  let size = 0
  req.on('data', (c) => {
    size += c.length
    if (size > MAX_BODY) {
      json(res, 413, { ok: false, error: 'Body demasiado grande' })
      req.destroy()
      return
    }
    body += c
  })
  req.on('end', () => {
    if (size <= MAX_BODY) cb(body)
  })
}

function talonarioFiles() {
  // Rutas ya escritas por nosotros: se evita el reload automático de Vite.
  const justSaved = new Set()

  return {
    name: 'talonario-files',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]

        if (url === '/__calibration') {
          if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method Not Allowed' })
          return json(res, 200, JSON.parse(getSetting(db, 'calibration') || '{}'))
        }

        if (url === '/__save-calibration') {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method Not Allowed' })
          return readBody(req, res, (body) => {
            try {
              const data = JSON.parse(body)
              if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('JSON invalido')
              }
              setSetting(db, 'calibration', JSON.stringify(data))
              // Respaldo en disco: el build sigue llevando la ultima calibracion.
              writeFileSync(CAL_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
              justSaved.add(norm(CAL_PATH))
              json(res, 200, { ok: true })
            } catch (e) {
              json(res, 400, { ok: false, error: String(e) })
            }
          })
        }

        const target = ENDPOINTS[url]
        if (!target) return next()

        if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method Not Allowed' })

        readBody(req, res, (body) => {
          try {
            const data = JSON.parse(body)
            writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8')
            justSaved.add(norm(target))
            json(res, 200, { ok: true })
          } catch (e) {
            json(res, 400, { ok: false, error: String(e) })
          }
        })
      })
    },

    handleHotUpdate({ file }) {
      // Guardado propio desde el navegador: el estado ya vive en memoria.
      // Un cambio externo (editor) deja el default de Vite (full reload).
      const key = norm(file)
      if (justSaved.has(key)) {
        justSaved.delete(key)
        return []
      }
    }
  }
}

export default defineConfig({
  plugins: [talonarioFiles()]
})
