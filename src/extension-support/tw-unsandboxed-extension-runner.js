const ScratchCommon = require('./tw-extension-api-common');
const createScratchX = require('./tw-scratchx-compatibility-layer');
const AsyncLimiter = require('../util/async-limiter');
const createTranslate = require('./tw-l10n');
const staticFetch = require('../util/tw-static-fetch');

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
 * Create the Scratch APIs for an unsandboxed extension without exposing them globally.
 * @param {VirtualMachine} vm
 * @returns {{promise: Promise<object[]>, Scratch: object, ScratchExtensions: object}}
 */
const createUnsandboxedExtensionAPI = vm => {
    const extensionObjects = [];
    let resolveExtensionObjects;
    const promise = new Promise(resolve => {
        resolveExtensionObjects = resolve;
    });

    const register = extensionObject => {
        extensionObjects.push(extensionObject);
        resolveExtensionObjects(extensionObjects);
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

    const ScratchExtensions = createScratchX(Scratch);

    vm.emit('CREATE_UNSANDBOXED_EXTENSION_API', Scratch);

    return {
        promise,
        Scratch,
        ScratchExtensions
    };
};

/**
 * Sets up the global.Scratch API for an unsandboxed extension.
 * @param {VirtualMachine} vm
 * @returns {Promise<object[]>} Resolves with a list of extension objects when Scratch.extensions.register is called.
 */
const setupUnsandboxedExtensionAPI = vm => {
    const api = createUnsandboxedExtensionAPI(vm);
    global.Scratch = api.Scratch;
    global.ScratchExtensions = api.ScratchExtensions;
    return api.promise;
};

/**
 * Disable the existing global.Scratch unsandboxed extension APIs.
 * This helps debug poorly designed extensions.
 */
const teardownUnsandboxedExtensionAPI = () => {
    if (!global.Scratch || !global.Scratch.extensions) {
        return;
    }
    global.Scratch.extensions.register = () => {
        throw new Error('Too late to register new extensions.');
    };
};

const shouldUsePrivateUnsandboxedExtensionAPI = async (extensionURL, vm) => {
    if (!vm.securityManager || typeof vm.securityManager.usePrivateUnsandboxedExtensionAPI !== 'function') {
        return false;
    }
    return Boolean(await vm.securityManager.usePrivateUnsandboxedExtensionAPI(extensionURL));
};

const fetchUnsandboxedExtensionSource = async extensionURL => {
    const staticFetchResult = staticFetch(extensionURL);
    if (staticFetchResult) {
        return staticFetchResult.text();
    }

    const response = await fetch(extensionURL);
    if (!response.ok) {
        throw new Error(`Failed to fetch unsandboxed extension source: ${response.status}`);
    }
    return response.text();
};

const BOUND_WINDOW_METHODS = new Set([
    'atob',
    'btoa',
    'fetch',
    'open',
    'alert',
    'confirm',
    'prompt',
    'addEventListener',
    'removeEventListener',
    'dispatchEvent',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'queueMicrotask',
    'postMessage',
    'matchMedia',
    'getComputedStyle'
]);

const createPrivateExtensionWindow = (Scratch, ScratchExtensions) => {
    const localOverrides = new Map([
        ['Scratch', Scratch],
        ['ScratchExtensions', ScratchExtensions]
    ]);

    let privateWindow = null;
    const getWindowLikeSelf = prop => (
        prop === 'window' ||
        prop === 'self' ||
        prop === 'globalThis' ||
        prop === 'top' ||
        prop === 'parent' ||
        prop === 'frames'
    );

    privateWindow = new Proxy(global, {
        get: (target, prop) => {
            if (getWindowLikeSelf(prop)) {
                return privateWindow;
            }
            if (localOverrides.has(prop)) {
                return localOverrides.get(prop);
            }
            const value = Reflect.get(target, prop, target);
            if (typeof prop === 'string' && typeof value === 'function' && BOUND_WINDOW_METHODS.has(prop)) {
                return value.bind(target);
            }
            return value;
        },
        set: (target, prop, value) => {
            if (getWindowLikeSelf(prop)) {
                return true;
            }
            if (prop === 'Scratch' || prop === 'ScratchExtensions') {
                localOverrides.set(prop, value);
                return true;
            }
            return Reflect.set(target, prop, value, target);
        },
        has: (target, prop) => localOverrides.has(prop) || getWindowLikeSelf(prop) || Reflect.has(target, prop),
        getOwnPropertyDescriptor: (target, prop) => {
            if (getWindowLikeSelf(prop)) {
                return {
                    configurable: true,
                    enumerable: false,
                    writable: true,
                    value: privateWindow
                };
            }
            if (localOverrides.has(prop)) {
                return {
                    configurable: true,
                    enumerable: false,
                    writable: true,
                    value: localOverrides.get(prop)
                };
            }
            return Object.getOwnPropertyDescriptor(target, prop);
        }
    });

    return privateWindow;
};

const temporarilyExposePrivateScratchAPI = (Scratch, ScratchExtensions, callback) => {
    const previousScratchDescriptor = Object.getOwnPropertyDescriptor(global, 'Scratch');
    const previousScratchExtensionsDescriptor = Object.getOwnPropertyDescriptor(global, 'ScratchExtensions');

    Object.defineProperty(global, 'Scratch', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: Scratch
    });
    Object.defineProperty(global, 'ScratchExtensions', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: ScratchExtensions
    });

    try {
        return callback();
    } finally {
        if (previousScratchDescriptor) {
            Object.defineProperty(global, 'Scratch', previousScratchDescriptor);
        } else {
            delete global.Scratch;
        }

        if (previousScratchExtensionsDescriptor) {
            Object.defineProperty(global, 'ScratchExtensions', previousScratchExtensionsDescriptor);
        } else {
            delete global.ScratchExtensions;
        }
    }
};

const executeUnsandboxedExtensionInPrivateContext = (source, extensionURL, Scratch, ScratchExtensions) => {
    const privateWindow = createPrivateExtensionWindow(Scratch, ScratchExtensions);
    temporarilyExposePrivateScratchAPI(Scratch, ScratchExtensions, () => {
        const executor = new Function(
            'window',
            'self',
            'globalThis',
            'top',
            'parent',
            'frames',
            'Scratch',
            'ScratchExtensions',
            `${source}\n//# sourceURL=${extensionURL}`
        );
        executor.call(
            global,
            privateWindow,
            privateWindow,
            privateWindow,
            privateWindow,
            privateWindow,
            privateWindow,
            Scratch,
            ScratchExtensions
        );
    });
};

const executeUnsandboxedExtensionInSharedContext = (source, extensionURL, Scratch, ScratchExtensions) => {
    const executor = new Function(
        'Scratch',
        'ScratchExtensions',
        `${source}\n//# sourceURL=${extensionURL}`
    );
    executor.call(global, Scratch, ScratchExtensions);
};

const loadUnsandboxedExtensionWithPrivateScratch = async (extensionURL, vm) => {
    const api = createUnsandboxedExtensionAPI(vm);
    let source;

    try {
        source = await fetchUnsandboxedExtensionSource(extensionURL);
    } catch (error) {
        throw new Error(`Error fetching unsandboxed script ${extensionURL}: ${error.message}`);
    }

    try {
        executeUnsandboxedExtensionInPrivateContext(
            source,
            extensionURL,
            api.Scratch,
            api.ScratchExtensions
        );
    } catch (error) {
        throw new Error(`Error in unsandboxed script ${extensionURL}. Check the console for more information.`);
    }

    return api.promise;
};

const loadUnsandboxedExtensionWithSharedGlobal = async (extensionURL, vm) => {
    const api = createUnsandboxedExtensionAPI(vm);
    global.Scratch = api.Scratch;
    global.ScratchExtensions = api.ScratchExtensions;

    let source;
    try {
        source = await fetchUnsandboxedExtensionSource(extensionURL);
    } catch (error) {
        throw new Error(`Error fetching unsandboxed script ${extensionURL}: ${error.message}`);
    }

    try {
        executeUnsandboxedExtensionInSharedContext(
            source,
            extensionURL,
            api.Scratch,
            api.ScratchExtensions
        );
    } catch (error) {
        throw new Error(`Error in unsandboxed script ${extensionURL}. Check the console for more information.`);
    }

    const objects = await api.promise;
    teardownUnsandboxedExtensionAPI();
    return objects;
};

/**
 * Load an unsandboxed extension from an arbitrary URL. This is dangerous.
 * @param {string} extensionURL
 * @param {Virtualmachine} vm
 * @returns {Promise<object[]>} Resolves with a list of extension objects if the extension was loaded successfully.
 */
const loadUnsandboxedExtension = async (extensionURL, vm) => {
    if (await shouldUsePrivateUnsandboxedExtensionAPI(extensionURL, vm)) {
        return loadUnsandboxedExtensionWithPrivateScratch(extensionURL, vm);
    }
    return loadUnsandboxedExtensionWithSharedGlobal(extensionURL, vm);
};

// Because loading unsandboxed extensions may still require shared runtime state,
// only let one extension load at a time.
const limiter = new AsyncLimiter(loadUnsandboxedExtension, 1);
const load = (extensionURL, vm) => limiter.do(extensionURL, vm);

module.exports = {
    setupUnsandboxedExtensionAPI,
    load
};
