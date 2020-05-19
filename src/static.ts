import { join } from 'path'

import Koa from 'koa'
import staticMdl from 'koa-static'
import cors from '@koa/cors'

import { PORTS, PATH } from './config'
import { readFileAsync, readdirAsync } from './utils'


/**
 * the static file server to save the spec files uploaded by the user
 *  
 * 
 * */ 

const app = new Koa()
app.use(cors())
app.use(async (ctx, next) => {
    if (ctx.path === '/' && ctx.method === 'GET') {
        const files = await readdirAsync(PATH.UPLOAD_DIR)

        const indexFilePath = join(PATH.ROOT, 'index.html')
        const data = await readFileAsync(indexFilePath, { encoding: 'utf-8' })

        ctx.body = data.replace('___SPEC_LIST___', JSON.stringify(Array.from(new Set(files.map(f => f.split('.')[0])))))

        return
    }
    await next()
})

app.use(staticMdl(PATH.ROOT, { format: true }))

app.listen(PORTS.STATIC)