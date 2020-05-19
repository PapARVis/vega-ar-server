import { existsSync, createWriteStream, mkdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'

import shortid from 'shortid'
import axios from 'axios'
import Ajv from 'ajv'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import { arParse, arView, ARSpec, ARView } from 'vega-ar'

import { PORTS, PATH, DOMAIN } from './config'
import { writeFileAsync, readFileAsync, getTargetId, existsAsync, isUrlData  } from './utils'
import { addTarget } from './vuforia'
import { UrlData } from 'vega';

import { Image, createCanvas } from 'canvas';
import QRCode from 'qrcode';

// json validate
const ajv = new Ajv()
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
const jsonValidators = new Map()

const app = new Koa()
app.proxy = true
app.use(cors())
app.use(bodyParser({ jsonLimit: '50mb', formLimit: '50mb' }))

// init SPEC data
Object.keys(PATH)
    .map(k => PATH[k])
    .filter(p => !existsSync(p))
    .forEach(p => mkdirSync(p, { recursive: true }))

// api server
app.use(async (ctx, next) => {

    console.log(`${ctx.method} ${ctx.path} from =======> ${ctx.ip}`)
    if (ctx.path == '/spec' && ctx.method === 'POST') {
        const { spec, urlToDatas, anchor }: { spec: ARSpec, urlToDatas: any, anchor: {v:"Top"|"Down", h:"Left"|"Right", vv: number, hv: number} } = ctx.request.body

        if(spec.$schema === undefined) {
            ctx.throw(402, "You must specify the $schema")
            return
        }

        // 1. get shcema
        if (!jsonValidators.has(spec.$schema)) {
            console.log('Fetch the json schema in the first time')
            try {
                const schema = (await axios.get(spec.$schema)).data
                jsonValidators.set(spec.$schema, ajv.compile(schema))
            } catch (err) {
                let errMsg
                if (err.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    errMsg = `The Error from fetching $schema, ${err.response.status}:${err.message}`
                } else if (err.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    errMsg = `The error from requesting $schema, ${err.request}`
                } else {
                    // Something happened in setting up the request that triggered an Error
                    errMsg = err.message
                }

                ctx.throw(400, errMsg)
            }
        }

        // 2. validate json
        const specValidate = jsonValidators.get(spec.$schema)
        const res = specValidate(spec)
        if (!res) {
            ctx.throw(403, JSON.stringify(specValidate.errors))
        }

        // 3. get Id and store
        const uId = shortid.generate()
        const filePath = join(PATH.UPLOAD_DIR, uId)
        
        // cached the datas from url
        const urlToCachedDatas = {}
        await Promise.all(Object.keys(urlToDatas)
        .map((url, idx) => {
            console.log(url)
            const data = urlToDatas[url]
            if(url.endsWith('.json')) {
                const cachedDataPath = `${filePath}.o.data_${idx}.json`
                urlToCachedDatas[url] = relative(PATH.ROOT, cachedDataPath)// a / in the begin of the path
                return writeFileAsync(cachedDataPath, JSON.stringify(data))
            } else if(url.endsWith('.csv')) {
                const cachedDataPath = `${filePath}.o.data_${idx}.csv`
                urlToCachedDatas[url] = relative(PATH.ROOT, cachedDataPath)// a / in the begin of the path
                return writeFileAsync(cachedDataPath, data)
            }
        }))
        
        // substitue all urls in spec data
        if (spec.data) {
            // @TODO, assume all url is string
            spec.data
                .filter(isUrlData)
                .forEach((d:UrlData) => d.url = `http://${DOMAIN.STATIC}/${urlToCachedDatas[d.url as string]}`)
        }
        // @TODO set background to white if it is transparent
        if(!spec.background) {
            spec.background = '#fff'
        }
        
        const { runtime, arRuntime } = arParse(spec, { ar: true })
        const view: ARView = await arView(arRuntime, runtime, { renderer: 'none', debug: true }) as ARView
        const canvas = ((await view.dualView.toCanvas()) as any)
        
        const qrcodeSize = 100
        let finalCanvas = createCanvas(canvas.width + qrcodeSize, Math.max(canvas.height, qrcodeSize)) // default: right side;
        if ((spec.ar as any).qrcodePosition) {
            switch ((spec.ar as any).qrcodePosition) {
                case 'right':
                case 'left':
                    finalCanvas = createCanvas(canvas.width + qrcodeSize, Math.max(canvas.height, qrcodeSize))
                    break;
                case 'bottom':
                case 'top':
                    finalCanvas = createCanvas(Math.max(canvas.width, qrcodeSize), canvas.height + qrcodeSize)
                    break;
            }
        }
        const canvasCtx = finalCanvas.getContext('2d')
        const viewImage = new Image()
        viewImage.src = canvas.toDataURL()
        if ((spec.ar as any).qrcodePosition) {
            switch ((spec.ar as any).qrcodePosition) {
                case 'right':
                case 'bottom':
                    canvasCtx.drawImage(viewImage, 0, 0)
                    break;
                case 'left':
                    canvasCtx.drawImage(viewImage, qrcodeSize, 0)
                    break;
                case 'top':
                    canvasCtx.drawImage(viewImage, 0, qrcodeSize)
                    break;
            }
        } else {
            canvasCtx.drawImage(viewImage, 0, 0) // default: right side
        }

        var qrcode = ''
        try {
            qrcode = await QRCode.toDataURL(uId)
            let qrcodeImage = new Image()
            qrcodeImage.src = qrcode
            if ((spec.ar as any).qrcodePosition) {
                switch ((spec.ar as any).qrcodePosition) {
                    case 'right':
                        canvasCtx.drawImage(qrcodeImage, canvas.width, (canvas.height - qrcodeSize)/2, qrcodeSize, qrcodeSize)
                        break;
                    case 'left':
                        canvasCtx.drawImage(qrcodeImage, 0, (canvas.height - qrcodeSize)/2)
                        break;
                    case 'bottom':
                        canvasCtx.drawImage(qrcodeImage, (canvas.width - qrcodeSize)/2, canvas.height)
                        break;
                    case 'top':
                        canvasCtx.drawImage(qrcodeImage, (canvas.width - qrcodeSize)/2, 0)
                        break;
                }
            } else {
                canvasCtx.drawImage(qrcodeImage, canvas.width, (canvas.height - qrcodeSize)/2, qrcodeSize, qrcodeSize) // default: right side
            }
        } catch (error) {
            console.error(error)
        }

        const pngStream = finalCanvas.createPNGStream()
        try {
            await writeFileAsync(`${filePath}.json`, JSON.stringify(spec))

            await new Promise((resolve, reject) => {
                const out = createWriteStream(`${filePath}.o.png`)
                pngStream.pipe(out)
                out.on('finish', resolve)
                out.on('error', reject)
            })
        } catch (err) {
            ctx.throw(500, err)
        }

        // push to voforia
        await addTarget(uId, anchor)

        ctx.body = {
            id: uId,
            image: finalCanvas.toDataURL()
        }
    } else if (ctx.path === '/spec' && ctx.method === 'GET') {
        const { id } = ctx.query
        if (!id) {
            ctx.throw(400, 'The id of the spec cannot be empty')
        }
        const specPath = join(PATH.UPLOAD_DIR, `${id}.json`)
        const isExist = await existsAsync(specPath)
        if (!isExist) {
            ctx.throw(404, 'The spec does not exist')
        }

        const data = await readFileAsync(specPath)
        ctx.body = data

    } else if (ctx.path === '/o' && ctx.method === 'GET') {
        const { id } = ctx.query

        if (!id) {
            ctx.throw(400, 'The id of the spec cannot be empty')
        }
        const oImgPath = join(PATH.UPLOAD_DIR, `${id}.o.png`)
        const isExist = await existsAsync(oImgPath)
        if (!isExist) {
            ctx.throw(404, new Error('The png does not exist'))
        }

        const data = await readFileAsync(oImgPath)        
        ctx.body = data

    } else if (ctx.path === '/n' && ctx.method === 'GET') {
        console.log("/n get!!!")
        const { id } = ctx.query
        console.debug('Try to get AR vis of ' + id)

        // stop
        const specPath = join(PATH.UPLOAD_DIR, `${id}.json`)
        const isExist = await existsAsync(specPath)
        if (!isExist) {
            ctx.throw(404, 'The spec does not exist')
        }

        const jsonSpec = JSON.parse(await readFileAsync(specPath, { encoding:'utf-8'}))
        const { runtime, arRuntime } = arParse(jsonSpec, { ar: true })
        const view = await arView(arRuntime, runtime, { renderer: 'none', debug: false });
        const canvas = ((await view.toCanvas()) as any).createPNGStream()
        ctx.body = canvas
    } else if (ctx.path === '/tId' && ctx.method === 'GET') {
        const { id } = ctx.query
        const targetId = await getTargetId(id)
        ctx.body = { targetId }
    }

    console.log(`Finish ${ctx.method} ${ctx.path} from =======> ${ctx.ip}`)
    await next()
})

app.listen(PORTS.API)