import crypto from 'crypto'
import { join } from 'path'

import axios from 'axios'
import sharp from 'sharp'

import { existsAsync, cacheTargetIdAsync } from './utils'
import { PATH, VUFORIA } from './config'


const baseURL = 'https://vws.vuforia.com'
const ACCESSKEY = VUFORIA.accessKey
const SECRETKEY = VUFORIA.secretKey

function hashMd5Hex(input: string) {
    return crypto
        .createHash('md5')
        .update(input)
        .digest('hex')
}

function createStringToSign({ method, body, type, timestamp, path }: SignatureOption) {
    const newLine = '\n';
    return method + newLine +
        hashMd5Hex(body) + newLine +
        type + newLine +
        timestamp + newLine +
        path
}

function hashHmacSha1Base64(key: string, input: string) {
    return crypto
        .createHmac('sha1', key)
        .update(input)
        .digest('base64')
}


interface SignatureOption {
    method: string
    body: string
    type: string
    timestamp: string
    path: string
}

function createSignature({ secretKey, method, body, type, timestamp, path }: SignatureOption & { secretKey: string }) {
    const stringToSign = createStringToSign({ method, body, type, timestamp, path });
    return hashHmacSha1Base64(secretKey, stringToSign);
}

function encodeBase64(input: any) {
    return new Buffer(input.toString()).toString('base64');
}

async function listTargets() {
    const path = '/targets'
    const timestamp = (new Date()).toUTCString()
    const method = 'GET'
    const contentType = 'application/json'
    const body = ''

    const signature = createSignature({
        secretKey: SECRETKEY,
        method,
        body,
        type: contentType,
        timestamp,
        path
    })

    const headers = {
        'Host': 'vws.vuforia.com',
        'Content-Type': contentType,
        'Authorization': `VWS ${ACCESSKEY}:${signature}`,
        'Date': timestamp
    }

    try {
        const response = (await axios.request({
            method,
            baseURL,
            url: path,
            headers,
            data: body
        })).data

        // @TODO
        console.log(response)
    } catch (err) {
        console.log(err.message)
        console.log(err.response.data)
    }
}

async function addTarget(id: string, anchor: {v:"Top"|"Down", h:"Left"|"Right", vv: number, hv: number}) {

    const path = '/targets'
    const timestamp = (new Date()).toUTCString()
    const method = 'POST'
    const contentType = 'application/json'

    const oImgPath = join(PATH.UPLOAD_DIR, `${id}.o.png`)
    const isExist = await existsAsync(oImgPath)
    if (!isExist) {
        new Error('The png does not exist')
    }

    const image = await sharp(oImgPath)
    const info = await image.metadata()
    console.log(info)
    // const image = (await readFileAsync(oImgPath)).toString('base64')
    // const dimensions = await imageSizeOfAsync(oImgPath)

    const body = JSON.stringify({
        name: id,
        width: info.width, // dimensions.width,
        image: (await image.removeAlpha().toBuffer()).toString('base64'),
        active_flag: true,
        application_metadata: encodeBase64(JSON.stringify({...anchor, width: info.width, height: info.height}))
    })

    const signature = createSignature({
        secretKey: SECRETKEY,
        method,
        body,
        type: contentType,
        timestamp,
        path
    })

    const headers = {
        'Host': 'vws.vuforia.com',
        'Content-Type': contentType,
        'Authorization': `VWS ${ACCESSKEY}:${signature}`,
        'Date': timestamp
    }

    try {
        const { result_code, target_id } = (await axios.request({
            method,
            baseURL,
            url: path,
            headers,
            data: body
        })).data

        if (result_code === 'TargetCreated') {
            await cacheTargetIdAsync(id, target_id)
        }
    } catch (err) {
        console.log(err.message, err.response.data)
        throw new Error('Something wrong when pushing to Vuforia')
    }
}

export {
    addTarget,
    listTargets,
}