const ScratchCommon = require('./tw-extension-api-common');
const createScratchX = require('./tw-scratchx-compatibility-layer');
const AsyncLimiter = require('../util/async-limiter');
const createTranslate = require('./tw-l10n');
const staticFetch = require('../util/tw-static-fetch');

// 尝试导入Node.js环境的依赖
let JSDOM, nodeFetch;
try {
    // 动态导入，避免在浏览器环境中出错
    JSDOM = require('jsdom').JSDOM;
    nodeFetch = require('node-fetch');
} catch (error) {
    // 在浏览器环境中这些模块可能不可用
    console.debug('Node.js modules not available, running in browser environment');
}

/* eslint-disable require-await */

/**
 * Parse a URL object or return null.
 * @param {string} url
 * @returns {URL|null}
 */
const parseURL = url => {
    try {
        return new URL(url, location.href);
    } catch (e) {
        return null;
    }
};

/**
 * Sets up the global.Scratch API for an unsandboxed extension.
 * @param {VirtualMachine} vm
 * @returns {Promise<object[]>} Resolves with a list of extension objects when Scratch.extensions.register is called.
 */
const setupUnsandboxedExtensionAPI = vm => new Promise(resolve => {
    const extensionObjects = [];
    const register = extensionObject => {
        extensionObjects.push(extensionObject);
        resolve(extensionObjects);
    };

    // Create a new copy of global.Scratch for each extension
    const Scratch = Object.assign({}, global.Scratch || {}, ScratchCommon);
    Scratch.extensions = {
        unsandboxed: true,
        register
    };
    Scratch.vm = vm;
    Scratch.renderer = vm.runtime.renderer;

    Scratch.canFetch = async url => {
        const parsed = parseURL(url);
        if (!parsed) {
            return false;
        }
        // Always allow protocols that don't involve a remote request.
        if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') {
            return true;
        }
        return vm.securityManager.canFetch(parsed.href);
    };

    Scratch.canOpenWindow = async url => {
        const parsed = parseURL(url);
        if (!parsed) {
            return false;
        }
        // Always reject protocols that would allow code execution.
        // eslint-disable-next-line no-script-url
        if (parsed.protocol === 'javascript:') {
            return false;
        }
        return vm.securityManager.canOpenWindow(parsed.href);
    };

    Scratch.canRedirect = async url => {
        const parsed = parseURL(url);
        if (!parsed) {
            return false;
        }
        // Always reject protocols that would allow code execution.
        // eslint-disable-next-line no-script-url
        if (parsed.protocol === 'javascript:') {
            return false;
        }
        return vm.securityManager.canRedirect(parsed.href);
    };

    Scratch.canRecordAudio = async () => vm.securityManager.canRecordAudio();

    Scratch.canRecordVideo = async () => vm.securityManager.canRecordVideo();

    Scratch.canReadClipboard = async () => vm.securityManager.canReadClipboard();

    Scratch.canNotify = async () => vm.securityManager.canNotify();

    Scratch.canGeolocate = async () => vm.securityManager.canGeolocate();

    Scratch.canEmbed = async url => {
        const parsed = parseURL(url);
        if (!parsed) {
            return false;
        }
        return vm.securityManager.canEmbed(parsed.href);
    };

    Scratch.canDownload = async (url, name) => {
        const parsed = parseURL(url);
        if (!parsed) {
            return false;
        }
        // Always reject protocols that would allow code execution.
        // eslint-disable-next-line no-script-url
        if (parsed.protocol === 'javascript:') {
            return false;
        }
        return vm.securityManager.canDownload(url, name);
    };

    Scratch.fetch = async (url, options) => {
        const actualURL = url instanceof Request ? url.url : url;

        const staticFetchResult = staticFetch(url);
        if (staticFetchResult) {
            return staticFetchResult;
        }

        if (!await Scratch.canFetch(actualURL)) {
            throw new Error(`Permission to fetch ${actualURL} rejected.`);
        }
        return fetch(url, options);
    };

    Scratch.openWindow = async (url, features) => {
        if (!await Scratch.canOpenWindow(url)) {
            throw new Error(`Permission to open tab ${url} rejected.`);
        }
        // Use noreferrer to prevent new tab from accessing `window.opener`
        const baseFeatures = 'noreferrer';
        features = features ? `${baseFeatures},${features}` : baseFeatures;
        return window.open(url, '_blank', features);
    };

    Scratch.redirect = async url => {
        if (!await Scratch.canRedirect(url)) {
            throw new Error(`Permission to redirect to ${url} rejected.`);
        }
        location.href = url;
    };

    Scratch.download = async (url, name) => {
        if (!await Scratch.canDownload(url, name)) {
            throw new Error(`Permission to download ${name} rejected.`);
        }
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    Scratch.translate = createTranslate(vm);

    global.Scratch = Scratch;
    global.ScratchExtensions = createScratchX(Scratch);

    vm.emit('CREATE_UNSANDBOXED_EXTENSION_API', Scratch);
});

/**
 * Disable the existing global.Scratch unsandboxed extension APIs.
 * This helps debug poorly designed extensions.
 */
const teardownUnsandboxedExtensionAPI = () => {
    // We can assume global.Scratch already exists.
    global.Scratch.extensions.register = () => {
        throw new Error('Too late to register new extensions.');
    };
};

/**
 * 浏览器环境的加载函数
 * @param {string} extensionURL
 * @param {VirtualMachine} vm
 * @returns {Promise<object[]>}
 */
const loadUnsandboxedExtensionBrowser = (extensionURL, vm) => new Promise((resolve, reject) => {
    setupUnsandboxedExtensionAPI(vm).then(resolve);

    const script = document.createElement('script');
    script.onerror = () => {
        reject(new Error(`Error in unsandboxed script ${extensionURL}. Check the console for more information.`));
    };
    script.src = extensionURL;
    document.body.appendChild(script);
}).then(objects => {
    teardownUnsandboxedExtensionAPI();
    return objects;
});

/**
 * Node.js环境的加载函数
 * @param {string} extensionURL
 * @param {VirtualMachine} vm
 * @returns {Promise<object[]>}
 */
const loadUnsandboxedExtensionNode = async (extensionURL, vm) => {
    // 检查是否已设置全局document对象
    if (!global.document && JSDOM) {
        // 模拟浏览器环境核心对象
        const dom = new JSDOM('<!DOCTYPE html><body></body>');
        global.document = dom.window.document;
        global.window = dom.window;
        global.location = dom.window.location;
        global.fetch = nodeFetch; // 使用node-fetch替换浏览器fetch
    } else if (!global.document) {
        throw new Error('Document object not available. Running in Node.js environment requires jsdom package.');
    }

    // 初始化扩展API并等待注册回调
    const extensionObjectsPromise = setupUnsandboxedExtensionAPI(vm);

    try {
        // 用node-fetch下载扩展脚本
        const response = await fetch(extensionURL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const scriptCode = await response.text();

        // 在模拟的window环境中执行脚本
        // 使用eval或vm.runInContext取决于安全性要求
        // 这里使用window.eval确保在正确的上下文中执行
        if (global.window && global.window.eval) {
            global.window.eval(scriptCode);
        } else {
            // 降级方案
            eval(scriptCode); // eslint-disable-line no-eval
        }
    } catch (err) {
        throw new Error(`Error loading unsandboxed extension ${extensionURL}: ${err.message}`);
    }

    // 获取注册的扩展对象并清理
    const objects = await extensionObjectsPromise;
    teardownUnsandboxedExtensionAPI();
    return objects;
};

/**
 * 自动检测环境并选择合适的加载方法
 * Load an unsandboxed extension from an arbitrary URL. This is dangerous.
 * @param {string} extensionURL
 * @param {VirtualMachine} vm
 * @returns {Promise<object[]>} Resolves with a list of extension objects if the extension was loaded successfully.
 */
const loadUnsandboxedExtension = (extensionURL, vm) => {
    // 检测环境：如果存在document对象且具有createElement方法，则使用浏览器方法
    if (typeof document !== 'undefined' && document.createElement) {
        return loadUnsandboxedExtensionBrowser(extensionURL, vm);
    }
    
    // 否则使用Node.js方法
    return loadUnsandboxedExtensionNode(extensionURL, vm);
};

// Because loading unsandboxed extensions requires messing with global state (global.Scratch),
// only let one extension load at a time.
const limiter = new AsyncLimiter(loadUnsandboxedExtension, 1);
const load = (extensionURL, vm) => limiter.do(extensionURL, vm);

module.exports = {
    setupUnsandboxedExtensionAPI,
    load
};