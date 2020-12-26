import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';

import {apiURL} from './../common/cloudfunc.js';
import authentication from './auth.js';
import {createConfig, configPath} from './config.js';

export {
    createConfig,
    configPath,
};

import modulas from './modulas.js';
import userMenu from './user-menu.js';
import rest from './rest/index.js';
import route from './route.js';
import * as validate from './validate.js';
import prefixer from './prefixer.js';
import terminal from './terminal.js';
import distributeExport from './distribute/export.js';

import currify from 'currify';
import apart from 'apart';
import ponse from 'ponse';
import restafary from 'restafary';
import restbox from 'restbox';
import konsole from 'console-io';
import edward from 'edward';
import dword from 'dword';
import deepword from 'deepword';
import nomine from 'nomine';
import fileop from '@cloudcmd/fileop';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIR = __dirname + '/';
const DIR_ROOT = DIR + '../';

const isDev = process.env.NODE_ENV === 'development';
const getDist = (isDev) => isDev ? 'dist-dev' : 'dist';

const getIndexPath = (isDev) => path.join(DIR, '..', `${getDist(isDev)}/index.html`);
const html = fs.readFileSync(getIndexPath(isDev), 'utf8');

const initAuth = currify(_initAuth);
const notEmpty = (a) => a;
const clean = (a) => a.filter(notEmpty);

export default (params) => {
    const p = params || {};
    const options = p.config || {};
    const config = p.configManager || createConfig({
        configPath,
    });
    
    const {modules} = p;
    
    const keys = Object.keys(options);
    
    for (const name of keys) {
        let value = options[name];
        
        if (/root/.test(name))
            validate.root(value, config);
        
        if (/editor|packer|columns/.test(name))
            validate[name](value);
        
        if (/prefix/.test(name))
            value = prefixer(value);
        
        config(name, value);
    }
    
    config('console', defaultValue(config, 'console', options));
    config('configDialog', defaultValue(config, 'configDialog', options));
    
    const prefixSocket = prefixer(options.prefixSocket);
    
    if (p.socket)
        listen({
            prefixSocket,
            config,
            socket: p.socket,
        });
    
    return cloudcmd({
        modules,
        config,
    });
};

export const createConfigManager = createConfig;

export const _getIndexPath = getIndexPath;

function defaultValue(config, name, options) {
    const value = options[name];
    const previous = config(name);
    
    if (typeof value === 'undefined')
        return previous;
    
    return value;
}

export const _getPrefix = getPrefix;
function getPrefix(prefix) {
    if (typeof prefix === 'function')
        return prefix() || '';
    
    return prefix || '';
}

export function _initAuth(config, accept, reject, username, password) {
    if (!config('auth'))
        return accept();
    
    const isName = username === config('username');
    const isPass = password === config('password');
    
    if (isName && isPass)
        return accept();
    
    reject();
}

function listen({prefixSocket, socket, config}) {
    const root = apart(config, 'root');
    const auth = initAuth(config);
    
    prefixSocket = getPrefix(prefixSocket);
    config.listen(socket, auth);
    
    edward.listen(socket, {
        root,
        auth,
        prefixSocket: prefixSocket + '/edward',
    });
    
    dword.listen(socket, {
        root,
        auth,
        prefixSocket: prefixSocket + '/dword',
    });
    
    deepword.listen(socket, {
        root,
        auth,
        prefixSocket: prefixSocket + '/deepword',
    });
    
    config('console') && konsole.listen(socket, {
        auth,
        prefixSocket: prefixSocket + '/console',
    });
    
    fileop.listen(socket, {
        root,
        auth,
        prefix: prefixSocket + '/fileop',
    });
    
    config('terminal') && terminal(config).listen(socket, {
        auth,
        prefix: prefixSocket + '/gritty',
        command: config('terminalCommand'),
        autoRestart: config('terminalAutoRestart'),
    });
    
    distributeExport(config, socket);
}

function cloudcmd({modules, config}) {
    const online = apart(config, 'online');
    const cache = false;
    const diff = apart(config, 'diff');
    const zip = apart(config, 'zip');
    const root = apart(config, 'root');
    
    const ponseStatic = ponse.static({
        cache,
        root: DIR_ROOT,
    });
    
    const dropbox = config('dropbox');
    const dropboxToken = config('dropboxToken');
    
    const funcs = clean([
        config('console') && konsole({
            online,
        }),
        
        config('terminal') && terminal(config, {}),
        
        edward({
            root,
            online,
            diff,
            zip,
            dropbox,
            dropboxToken,
        }),
        
        dword({
            root,
            online,
            diff,
            zip,
            dropbox,
            dropboxToken,
        }),
        
        deepword({
            root,
            online,
            diff,
            zip,
            dropbox,
            dropboxToken,
        }),
        
        fileop(),
        nomine(),
        
        setUrl,
        setSW,
        logout,
        authentication(config),
        config.middle,
        
        modules && modulas(modules),
        
        config('dropbox') && restbox({
            prefix: apiURL,
            root,
            token: dropboxToken,
        }),
        
        restafary({
            prefix: apiURL + '/fs',
            root,
        }),
        
        userMenu({
            menuName: '.cloudcmd.menu.js',
        }),
        
        rest(config),
        route(config, {
            html,
        }),
        
        ponseStatic,
    ]);
    
    return funcs;
}

function logout(req, res, next) {
    if (req.url !== '/logout')
        return next();
    
    res.sendStatus(401);
}

export const _replaceDist = replaceDist;
function replaceDist(url) {
    if (!isDev)
        return url;
    
    return url.replace(/^\/dist\//, '/dist-dev/');
}

function setUrl(req, res, next) {
    if (/^\/cloudcmd\.js(\.map)?$/.test(req.url))
        req.url = `/dist${req.url}`;
    
    req.url = replaceDist(req.url);
    
    next();
}

function setSW(req, res, next) {
    const {url} = req;
    const isSW = /^\/sw\.js(\.map)?$/.test(url);
    
    if (isSW)
        req.url = replaceDist(`/dist${url}`);
    
    next();
}

