import { writeFile, readFile, exists, readdir } from 'fs'
import { promisify } from 'util'
import { Data, UrlData } from 'vega'

import { PATH } from './config'

/**
 * The utils
 */

const { CACHED_TARGET_ID_FILE } = PATH

const writeFileAsync = promisify(writeFile)
const readFileAsync = promisify(readFile)
const existsAsync = promisify(exists)
const readdirAsync = promisify(readdir)

let _cachedTargetId: { [id: string]: string }

async function cacheTargetIdAsync(id: string, targetId: string) {
    if (await existsAsync(CACHED_TARGET_ID_FILE)) {
        if (!_cachedTargetId) {
            _cachedTargetId = JSON.parse(await readFileAsync(CACHED_TARGET_ID_FILE, { encoding: 'utf-8' }))
        }
    } else {
        _cachedTargetId = {}
    }

    _cachedTargetId[id] = targetId
    await writeFileAsync(CACHED_TARGET_ID_FILE, JSON.stringify(_cachedTargetId))
}

async function getTargetId(id: string) {
    if (await existsAsync(CACHED_TARGET_ID_FILE)) {
        if (!_cachedTargetId) {
            _cachedTargetId = JSON.parse(await readFileAsync(CACHED_TARGET_ID_FILE, { encoding: 'utf-8' }))
        }
    } else {
        _cachedTargetId = {}
    }

    return _cachedTargetId[id]
}

function isUrlData(data: Data): data is UrlData {
    return 'url' in data
}

export {
    writeFileAsync,
    readFileAsync,
    existsAsync,
    cacheTargetIdAsync,
    readdirAsync,
    getTargetId,
    isUrlData
}