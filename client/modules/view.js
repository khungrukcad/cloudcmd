/* global CloudCmd, DOM */

import('../../css/view.css');

import rendy from 'rendy';
import currify from 'currify';
import wraptile from 'wraptile';
import tryToCatch from 'try-to-catch';

import modal from '@cloudcmd/modal';
import createElement from '@cloudcmd/create-element';

import {FS} from '../../common/cloudfunc.js';

import Files from '../dom/files.js';
import Events from '../dom/events/index.js';
import load from 'load.js';
import Images from '../dom/images.js';

import {encode} from '../../common/entity.js';

const {assign} = Object;
const {isArray} = Array;

const testRegExp = currify((name, reg) => reg.test(name));
const lifo = currify((fn, el, cb, name) => fn(name, el, cb));
const series = wraptile((...a) => {
    for (const f of a)
        f();
});

const isFn = (a) => typeof a === 'function';

const noop = () => {};
const addEvent = lifo(Events.add);
const getRegExp = (ext) => RegExp(`\\.${ext}$`, 'i');

const loadCSS = load.css;

let Loading = false;

CloudCmd.View = {
    init,
    show,
    hide,
};

const Info = DOM.CurrentInfo;
const {Key} = CloudCmd;
const basename = (a) => a.split('/').pop();

let El;
let TemplateAudio;
let Overlay;

const Config = {
    beforeShow: () => {
        Images.hide();
        Key.unsetBind();
    },
    
    beforeClose: () => {
        Events.rmKey(listener);
        Key.setBind();
    },
    
    afterShow: () => {
        El.focus();
    },
    
    onOverlayClick,
    afterClose: noop,
    autoSize: false,
    
    helpers: {
        title: {},
    },
};

export async function init() {
    await loadAll();
    
    const events = [
        'click',
        'contextmenu',
    ];
    
    events.forEach(addEvent(Overlay, onOverlayClick));
}

export async function show(data, options) {
    const prefixURL = CloudCmd.prefixURL + FS;
    
    if (Loading)
        return;
    
    if (!options || options.bindKeys !== false)
        Events.addKey(listener);
    
    El = createElement('div', {
        className: 'view',
        notAppend: true,
    });
    
    El.tabIndex = 0;
    
    if (data) {
        if (isArray(data))
            El.append(...data);
        else
            El.append(data);
        
        modal.open(El, initConfig(options));
        return;
    }
    
    Images.show.load();
    
    const path = prefixURL + Info.path;
    const type = getType(path);
    
    switch(type) {
    default:
        return viewFile();
    
    case 'image':
        return viewImage(prefixURL);
    
    case 'media':
        return await viewMedia(path);
    
    case 'pdf':
        return viewPDF(path);
    }
}

function viewPDF(src) {
    const element = createElement('iframe', {
        src,
        width: '100%',
        height: '100%',
    });
    
    element.addEventListener('load', () => {
        element.contentWindow.addEventListener('keydown', listener);
    });
    
    const options = assign({}, Config);
    
    if (CloudCmd.config('showFileName'))
        options.title = Info.name;
    
    modal.open(element, options);
}

async function viewMedia(path) {
    const [e, element] = await getMediaElement(path);
    
    if (e)
        return alert(e);
    
    const allConfig = {
        ...Config,
        ...{
            autoSize: true,
            afterShow: () => {
                element
                    .querySelector('audio, video')
                    .focus();
            },
        },
    };
    
    modal.open(element, allConfig);
}

function viewFile() {
    Info.getData((error, data) => {
        if (error)
            return Images.hide();
        
        const element = document.createTextNode(data);
        const options = Config;
        
        if (CloudCmd.config('showFileName'))
            options.title = Info.name;
        
        El.append(element);
        modal.open(El, options);
    });
}

const copy = (a) => assign({}, a);

export const _initConfig = initConfig;
function initConfig(options) {
    const config = copy(Config);
    
    if (!options)
        return config;
    
    const names = Object.keys(options);
    for (const name of names) {
        const isConfig = Boolean(config[name]);
        const item = options[name];
        
        if (!isFn(item) || !isConfig) {
            config[name] = options[name];
            continue;
        }
        
        const fn = config[name];
        config[name] = series(fn, item);
    }
    
    return config;
}

export function hide() {
    modal.close();
}

function viewImage(prefixURL) {
    const makeTitle = (path) => {
        return {
            href: prefixURL + path,
            title: encode(basename(path)),
        };
    };
    
    const names = Info.files
        .map(DOM.getCurrentPath)
        .filter(isImage);
    
    const titles = names
        .map(makeTitle);
    
    const index = names.indexOf(Info.path);
    const imageConfig = {
        index,
        autoSize    : true,
        arrows      : true,
        keys        : true,
        helpers     : {
            title   : {},
        },
    };
    
    const config = {
        ...Config,
        ...imageConfig,
    };
    
    modal.open(titles, config);
}

function isImage(name) {
    const images = [
        'jp(e|g|eg)',
        'gif',
        'png',
        'bmp',
        'webp',
        'svg',
        'ico',
    ];
    
    return images
        .map(getRegExp)
        .some(testRegExp(name));
}

function isMedia(name) {
    return isAudio(name) || isVideo(name);
}

function isAudio(name) {
    return /\.(mp3|ogg|m4a)$/i.test(name);
}

function isVideo(name) {
    return /\.(mp4|avi|webm)$/i.test(name);
}

const isPDF = (name) => /\.(pdf)$/i.test(name);

function getType(name) {
    if (isPDF(name))
        return 'pdf';
    
    if (isImage(name))
        return 'image';
    
    if (isMedia(name))
        return 'media';
}

async function getMediaElement(src) {
    check(src);
    
    const [error, template] = await tryToCatch(Files.get, 'view/media-tmpl');
    
    if (error)
        return [error];
    
    const {name} = Info;
    
    if (!TemplateAudio)
        TemplateAudio = template;
    
    const is = isAudio(name);
    const type = is ? 'audio' : 'video';
    
    const innerHTML = rendy(TemplateAudio, {
        src,
        type,
        name,
    });
    
    const element = createElement('div', {
        innerHTML,
    });
    
    return [null, element];
}

function check(src) {
    if (typeof src !== 'string')
        throw Error('src should be a string!');
}

/**
 * function loads css and js of FancyBox
 * @callback   -  executes, when everything loaded
 */
async function loadAll() {
    const {prefix} = CloudCmd;
    
    Loading = true;
    await loadCSS(`${prefix}/dist/view.css`);
    Loading = false;
}

function onOverlayClick(event) {
    const position = {
        x: event.clientX,
        y: event.clientY,
    };
    
    setCurrentByPosition(position);
}

function setCurrentByPosition(position) {
    const element = DOM.getCurrentByPosition(position);
    
    if (!element)
        return;
    
    const {
        files,
        filesPassive,
    } = Info;
    
    const isFiles = files.includes(element);
    const isFilesPassive = filesPassive.includes(element);
    
    if (!isFiles && !isFilesPassive)
        return;
    
    const isCurrent = DOM.isCurrentFile(element);
    
    if (isCurrent)
        return;
    
    DOM.setCurrentFile(element);
}

function listener({keyCode}) {
    if (keyCode === Key.ESC)
        hide();
}

