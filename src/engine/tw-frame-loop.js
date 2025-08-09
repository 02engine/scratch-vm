// Due to the existence of features such as interpolation and "0 FPS" being treated as "screen refresh rate",
// The VM loop logic has become much more complex

// Use setTimeout to polyfill requestAnimationFrame in Node.js environments
/*
const _requestAnimationFrame = typeof requestAnimationFrame === 'function' ?
    requestAnimationFrame :
    (f => setTimeout(f, 1000 / 60));
const _cancelAnimationFrame = typeof requestAnimationFrame === 'function' ?
    cancelAnimationFrame :
    clearTimeout;

const animationFrameWrapper = callback => {
    let id;
    const handle = () => {
        id = _requestAnimationFrame(handle);
        callback();
    };
    const cancel = () => _cancelAnimationFrame(id);
    id = _requestAnimationFrame(handle);
    return {
        cancel
    };
};

class FrameLoop {
    constructor (runtime) {
        this.runtime = runtime;
        this.running = false;
        this.setFramerate(30);
        this.setInterpolation(false);

        this.stepCallback = this.stepCallback.bind(this);
        this.interpolationCallback = this.interpolationCallback.bind(this);

        this._stepInterval = null;
        this._interpolationAnimation = null;
        this._stepAnimation = null;
    }

    setFramerate (fps) {
        this.framerate = fps;
        this._restart();
    }

    setInterpolation (interpolation) {
        this.interpolation = interpolation;
        this._restart();
    }

    stepCallback () {
        this.runtime._step();
    }

    interpolationCallback () {
        this.runtime._renderInterpolatedPositions();
    }

    _restart () {
        if (this.running) {
            this.stop();
            this.start();
        }
    }

    start () {
        this.running = true;
        if (this.framerate === 0) {
            this._stepAnimation = animationFrameWrapper(this.stepCallback);
            this.runtime.currentStepTime = 1000 / 60;
        } else {
            // Interpolation should never be enabled when framerate === 0 as that's just redundant
            if (this.interpolation) {
                this._interpolationAnimation = animationFrameWrapper(this.interpolationCallback);
            }
            this._stepInterval = setInterval(this.stepCallback, 1000 / this.framerate);
            this.runtime.currentStepTime = 1000 / this.framerate;
        }
    }

    stop () {
        this.running = false;
        clearInterval(this._stepInterval);
        if (this._interpolationAnimation) {
            this._interpolationAnimation.cancel();
        }
        if (this._stepAnimation) {
            this._stepAnimation.cancel();
        }
        this._interpolationAnimation = null;
        this._stepAnimation = null;
    }
}

module.exports = FrameLoop;
*/
// Name: FrameLoop NextGen
// ID: frameloopng
// Description: The next generation of TurboWarp frame loop.
// By: FurryR
// License: MPL-2.0


  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) =>
    function __require() {
      return (
        mod ||
          (0, cb[__getOwnPropNames(cb)[0]])(
            (mod = { exports: {} }).exports,
            mod
          ),
        mod.exports
      );
    };
  var __copyProps = (to, from, except, desc) => {
    if ((from && typeof from === "object") || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, {
            get: () => from[key],
            enumerable:
              !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
          });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (
    (target = mod != null ? __create(__getProtoOf(mod)) : {}),
    __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule
        ? __defProp(target, "default", { value: mod, enumerable: true })
        : target,
      mod
    )
  );

  // node_modules/setimmediate/setImmediate.js
  var require_setImmediate = __commonJS({
    "node_modules/setimmediate/setImmediate.js"(exports) {
      (function (global2, undefined) {
        "use strict";
        if (global2.setImmediate) {
          return;
        }
        var nextHandle = 1;
        var tasksByHandle = {};
        var currentlyRunningATask = false;
        var doc = global2.document;
        var registerImmediate;
        function setImmediate(callback) {
          if (typeof callback !== "function") {
            callback = new Function("" + callback);
          }
          var args = new Array(arguments.length - 1);
          for (var i = 0; i < args.length; i++) {
            args[i] = arguments[i + 1];
          }
          var task = { callback, args };
          tasksByHandle[nextHandle] = task;
          registerImmediate(nextHandle);
          return nextHandle++;
        }
        function clearImmediate(handle) {
          delete tasksByHandle[handle];
        }
        function run(task) {
          var callback = task.callback;
          var args = task.args;
          switch (args.length) {
            case 0:
              callback();
              break;
            case 1:
              callback(args[0]);
              break;
            case 2:
              callback(args[0], args[1]);
              break;
            case 3:
              callback(args[0], args[1], args[2]);
              break;
            default:
              callback.apply(undefined, args);
              break;
          }
        }
        function runIfPresent(handle) {
          if (currentlyRunningATask) {
            setTimeout(runIfPresent, 0, handle);
          } else {
            var task = tasksByHandle[handle];
            if (task) {
              currentlyRunningATask = true;
              try {
                run(task);
              } finally {
                clearImmediate(handle);
                currentlyRunningATask = false;
              }
            }
          }
        }
        function installNextTickImplementation() {
          registerImmediate = function (handle) {
            process.nextTick(function () {
              runIfPresent(handle);
            });
          };
        }
        function canUsePostMessage() {
          if (global2.postMessage && !global2.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global2.onmessage;
            global2.onmessage = function () {
              postMessageIsAsynchronous = false;
            };
            global2.postMessage("", "*");
            global2.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
          }
        }
        function installPostMessageImplementation() {
          var messagePrefix = "setImmediate$" + Math.random() + "$";
          var onGlobalMessage = function (event) {
            if (
              event.source === global2 &&
              typeof event.data === "string" &&
              event.data.indexOf(messagePrefix) === 0
            ) {
              runIfPresent(+event.data.slice(messagePrefix.length));
            }
          };
          if (global2.addEventListener) {
            global2.addEventListener("message", onGlobalMessage, false);
          } else {
            global2.attachEvent("onmessage", onGlobalMessage);
          }
          registerImmediate = function (handle) {
            global2.postMessage(messagePrefix + handle, "*");
          };
        }
        function installMessageChannelImplementation() {
          var channel = new MessageChannel();
          channel.port1.onmessage = function (event) {
            var handle = event.data;
            runIfPresent(handle);
          };
          registerImmediate = function (handle) {
            channel.port2.postMessage(handle);
          };
        }
        function installReadyStateChangeImplementation() {
          var html = doc.documentElement;
          registerImmediate = function (handle) {
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
              runIfPresent(handle);
              script.onreadystatechange = null;
              html.removeChild(script);
              script = null;
            };
            html.appendChild(script);
          };
        }
        function installSetTimeoutImplementation() {
          registerImmediate = function (handle) {
            setTimeout(runIfPresent, 0, handle);
          };
        }
        var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global2);
        attachTo = attachTo && attachTo.setTimeout ? attachTo : global2;
        if ({}.toString.call(global2.process) === "[object process]") {
          installNextTickImplementation();
        } else if (canUsePostMessage()) {
          installPostMessageImplementation();
        } else if (global2.MessageChannel) {
          installMessageChannelImplementation();
        } else if (doc && "onreadystatechange" in doc.createElement("script")) {
          installReadyStateChangeImplementation();
        } else {
          installSetTimeoutImplementation();
        }
        attachTo.setImmediate = setImmediate;
        attachTo.clearImmediate = clearImmediate;
      })(
        typeof self === "undefined"
          ? typeof global === "undefined"
            ? exports
            : global
          : self
      );
    },
  });

  // src/frameloop.js
  var import_setimmediate = __toESM(require_setImmediate());
  var rendererDrawProfilerId = -1;
  var _requestAnimationFrame =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (f) => setTimeout(f, 1e3 / 60);
  var _cancelAnimationFrame =
    typeof requestAnimationFrame === "function"
      ? cancelAnimationFrame
      : clearTimeout;
  var taskWrapper = (callback, requestFn, cancelFn, manualInterval) => {
    let id;
    let cancelled = false;
    const handle = () => {
      if (manualInterval) id = requestFn(handle);
      callback();
    };
    const cancel = () => {
      if (!cancelled) cancelFn(id);
      cancelled = true;
    };
    id = requestFn(handle);
    return {
      cancel,
    };
  };
  var FrameLoop = class {
    constructor(runtime) {
      this.runtime = runtime;
      this.running = false;
      this.setFramerate(1000);
      this.setInterpolation(false);
      this._lastRenderTime = 0;
      this._lastStepTime = 0;
      this._stepInterval = null;
      this._renderInterval = null;
    }
    now() {
      return (performance || Date).now();
    }
    setFramerate(fps) {
      this.framerate = fps;
      this._restart();
    }
    setInterpolation(interpolation) {
      this.interpolation = interpolation;
      this._restart();
    }
    stepCallback() {
      this.runtime._step();
      this._lastStepTime = this.now();
    }
    stepImmediateCallback() {
      if (this.now() - this._lastStepTime >= this.runtime.currentStepTime) {
        this.runtime._step();
        this._lastStepTime = this.now();
      }
    }
    renderCallback() {
      if (this.runtime.renderer) {
        const renderTime = this.now();
        if (this.interpolation && this.framerate !== 0) {
          if (!document.hidden) {
            this.runtime._renderInterpolatedPositions();
          }
          this.runtime.screenRefreshTime = renderTime - this._lastRenderTime;
          this._lastRenderTime = renderTime;
        } else if (
          this.framerate === 0 ||
          renderTime - this._lastRenderTime >= this.runtime.currentStepTime
        ) {
          if (this.runtime.profiler !== null) {
            if (rendererDrawProfilerId === -1) {
              rendererDrawProfilerId =
                this.runtime.profiler.idByName("RenderWebGL.draw");
            }
            this.runtime.profiler.start(rendererDrawProfilerId);
          }
          if (!document.hidden) {
            this.runtime.renderer.draw();
          }
          if (this.runtime.profiler !== null) {
            this.runtime.profiler.stop();
          }
          this.runtime.screenRefreshTime = renderTime - this._lastRenderTime;
          this._lastRenderTime = renderTime;
          if (this.framerate === 0) {
            this.runtime.currentStepTime = this.runtime.screenRefreshTime;
          }
        }
      }
    }
    _restart() {
      if (this.running) {
        this.stop();
        this.start();
      }
    }
    start() {
      this.running = true;
      if (this.framerate === 0) {
        this._stepInterval = this._renderInterval = taskWrapper(
          () => {
            this.stepCallback();
            this.renderCallback();
          },
          _requestAnimationFrame,
          _cancelAnimationFrame,
          true
        );
        this.runtime.currentStepTime = 0;
      } else {
        this._renderInterval = taskWrapper(
          this.renderCallback.bind(this),
          _requestAnimationFrame,
          _cancelAnimationFrame,
          true
        );
        if (
          this.framerate > 250 &&
          globalThis.setImmediate &&
          globalThis.clearImmediate
        ) {
          this._stepInterval = taskWrapper(
            this.stepImmediateCallback.bind(this),
            globalThis.setImmediate,
            globalThis.clearImmediate,
            true
          );
        } else {
          this._stepInterval = taskWrapper(
            this.stepCallback.bind(this),
            (fn) => setInterval(fn, 1e3 / this.framerate),
            clearInterval,
            false
          );
        }
        this.runtime.currentStepTime = 1e3 / this.framerate;
      }
    }
    stop() {
      this.running = false;
      this._renderInterval.cancel();
      this._stepInterval.cancel();
    }
  };
  var frameloop_default = FrameLoop;
module.exports = FrameLoop;