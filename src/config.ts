const PORTS = {
    API: 31220,
    STATIC: 31221
}

const DOMAIN = {
    API: 'vegaARApi.hkustvis.org', // the domains for api server
    STATIC: 'vegaAR.hkustvis.org'  // the domains for static file server
}

const ROOT = `${__dirname}/../public`
const UPLOAD_DIR = `${ROOT}/upload`
const DATA_DIR = `${ROOT}/data`
const EXP_DIR = `${ROOT}/exp`
const CACHED_TARGET_ID_FILE = 'CACHED_TARGET_ID.json'
const PATH = {
    ROOT,
    UPLOAD_DIR,
    EXP_DIR,
    DATA_DIR,
    CACHED_TARGET_ID_FILE
}

const VUFORIA = {
    accessKey: '', // the keys for assessing vuforia
    secretKey: ''  // the keys for assessing vuforia
}

export {
    PORTS,
    PATH,
    DOMAIN,
    VUFORIA
}