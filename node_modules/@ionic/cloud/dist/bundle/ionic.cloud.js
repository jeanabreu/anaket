(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var errors_1 = require('./errors');
var promise_1 = require('./promise');
/**
 * @hidden
 */
var AuthTokenContext = (function () {
    function AuthTokenContext(deps, label) {
        this.label = label;
        this.storage = deps.storage;
    }
    AuthTokenContext.prototype.get = function () {
        return this.storage.get(this.label);
    };
    AuthTokenContext.prototype.store = function (token) {
        this.storage.set(this.label, token);
    };
    AuthTokenContext.prototype.delete = function () {
        this.storage.delete(this.label);
    };
    return AuthTokenContext;
}());
exports.AuthTokenContext = AuthTokenContext;
/**
 * @hidden
 */
var CombinedAuthTokenContext = (function () {
    function CombinedAuthTokenContext(deps, label) {
        this.label = label;
        this.storage = deps.storage;
        this.tempStorage = deps.tempStorage;
    }
    CombinedAuthTokenContext.prototype.get = function () {
        var permToken = this.storage.get(this.label);
        var tempToken = this.tempStorage.get(this.label);
        var token = tempToken || permToken;
        return token;
    };
    CombinedAuthTokenContext.prototype.store = function (token, options) {
        if (options === void 0) { options = { 'permanent': true }; }
        if (options.permanent) {
            this.storage.set(this.label, token);
        }
        else {
            this.tempStorage.set(this.label, token);
        }
    };
    CombinedAuthTokenContext.prototype.delete = function () {
        this.storage.delete(this.label);
        this.tempStorage.delete(this.label);
    };
    return CombinedAuthTokenContext;
}());
exports.CombinedAuthTokenContext = CombinedAuthTokenContext;
/**
 * `Auth` handles authentication of a single user, such as signing up, logging
 * in & out, social provider authentication, etc.
 *
 * @featured
 */
var Auth = (function () {
    function Auth(deps, 
        /**
         * @hidden
         */
        options) {
        if (options === void 0) { options = {}; }
        this.options = options;
        this.config = deps.config;
        this.emitter = deps.emitter;
        this.authModules = deps.authModules;
        this.tokenContext = deps.tokenContext;
        this.userService = deps.userService;
        this.storage = deps.storage;
    }
    Object.defineProperty(Auth.prototype, "passwordResetUrl", {
        /**
         * Link the user to this URL for password resets. Only for email/password
         * authentication.
         *
         * Use this if you want to use our password reset forms instead of creating
         * your own in your app.
         */
        get: function () {
            return this.config.getURL('web') + "/password/reset/" + this.config.get('app_id');
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Check whether the user is logged in or not.
     *
     * If an auth token exists in local storage, the user is logged in.
     */
    Auth.prototype.isAuthenticated = function () {
        var token = this.tokenContext.get();
        if (token) {
            return true;
        }
        return false;
    };
    /**
     * Sign up a user with the given data. Only for email/password
     * authentication.
     *
     * `signup` does not affect local data or the current user until `login` is
     * called. This means you'll likely want to log in your users manually after
     * signup.
     *
     * If a signup fails, the promise rejects with a [`IDetailedError`
     * object](/api/client/idetailederror) that contains an array of error codes
     * from the cloud.
     *
     * @param details - The details that describe a user.
     */
    Auth.prototype.signup = function (details) {
        return this.authModules.basic.signup(details);
    };
    /**
     * Attempt to log the user in with the given credentials. For custom & social
     * logins, kick-off the authentication process.
     *
     * After login, the full user is loaded from the cloud and saved in local
     * storage along with their auth token.
     *
     * @note TODO: Better error handling docs.
     *
     * @param moduleId
     *  The authentication provider module ID to use with this login.
     * @param credentials
     *  For email/password authentication, give an email and password. For social
     *  authentication, exclude this parameter. For custom authentication, send
     *  whatever you need.
     * @param options
     *  Options for this login, such as whether to remember the login and
     *  InAppBrowser window options for authentication providers that make use of
     *  it.
     */
    Auth.prototype.login = function (moduleId, credentials, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        if (typeof options.remember === 'undefined') {
            options.remember = true;
        }
        if (typeof options.inAppBrowserOptions === 'undefined') {
            options.inAppBrowserOptions = {};
        }
        if (typeof options.inAppBrowserOptions.location === 'undefined') {
            options.inAppBrowserOptions.location = false;
        }
        if (typeof options.inAppBrowserOptions.clearcache === 'undefined') {
            options.inAppBrowserOptions.clearcache = true;
        }
        if (typeof options.inAppBrowserOptions.clearsessioncache === 'undefined') {
            options.inAppBrowserOptions.clearsessioncache = true;
        }
        var context = this.authModules[moduleId];
        if (!context) {
            throw new Error('Authentication class is invalid or missing:' + context);
        }
        return context.authenticate(credentials, options).then(function (r) {
            _this.storeToken(options, r.token);
            return _this.userService.load().then(function () {
                var user = _this.userService.current();
                user.store();
                return r;
            });
        });
    };
    /**
     * Log the user out of the app.
     *
     * This clears the auth token out of local storage and restores the user to
     * an unauthenticated state.
     */
    Auth.prototype.logout = function () {
        this.tokenContext.delete();
        var user = this.userService.current();
        user.unstore();
        user.clear();
    };
    /**
     * Kick-off the password reset process. Only for email/password
     * authentication.
     *
     * An email will be sent to the user with a short password reset code, which
     * they can copy back into your app and use the [`confirmPasswordReset()`
     * method](#confirmPasswordReset).
     *
     * @param email - The email address to which to send a code.
     */
    Auth.prototype.requestPasswordReset = function (email) {
        this.storage.set('auth_password_reset_email', email);
        return this.authModules.basic.requestPasswordReset(email);
    };
    /**
     * Confirm a password reset.
     *
     * When the user gives you their password reset code into your app and their
     * requested changed password, call this method.
     *
     * @param code - The password reset code from the user.
     * @param newPassword - The requested changed password from the user.
     */
    Auth.prototype.confirmPasswordReset = function (code, newPassword) {
        var email = this.storage.get('auth_password_reset_email');
        return this.authModules.basic.confirmPasswordReset(email, code, newPassword);
    };
    /**
     * Get the raw auth token of the active user from local storage.
     */
    Auth.prototype.getToken = function () {
        return this.tokenContext.get();
    };
    /**
     * @hidden
     */
    Auth.prototype.storeToken = function (options, token) {
        if (options === void 0) { options = { 'remember': true }; }
        var originalToken = this.authToken;
        this.authToken = token;
        this.tokenContext.store(this.authToken, { 'permanent': options.remember });
        this.emitter.emit('auth:token-changed', { 'old': originalToken, 'new': this.authToken });
    };
    /**
     * @hidden
     */
    Auth.getDetailedErrorFromResponse = function (res) {
        var errors = [];
        var details = [];
        try {
            details = res.body.error.details;
        }
        catch (e) { }
        for (var i = 0; i < details.length; i++) {
            var detail = details[i];
            if (detail.error_type) {
                errors.push(detail.error_type + '_' + detail.parameter);
            }
        }
        return new errors_1.DetailedError('Error creating user', errors);
    };
    return Auth;
}());
exports.Auth = Auth;
/**
 * @hidden
 */
var AuthType = (function () {
    function AuthType(deps) {
        this.config = deps.config;
        this.client = deps.client;
    }
    AuthType.prototype.parseInAppBrowserOptions = function (opts) {
        if (!opts) {
            return '';
        }
        var p = [];
        for (var k in opts) {
            var v = void 0;
            if (typeof opts[k] === 'boolean') {
                v = opts[k] ? 'yes' : 'no';
            }
            else {
                v = opts[k];
            }
            p.push(k + "=" + v);
        }
        return p.join(',');
    };
    AuthType.prototype.inAppBrowserFlow = function (moduleId, data, options) {
        var _this = this;
        if (data === void 0) { data = {}; }
        var deferred = new promise_1.DeferredPromise();
        if (!window || !window.cordova || !window.cordova.InAppBrowser) {
            deferred.reject(new Error('InAppBrowser plugin missing'));
        }
        else {
            this.client.post("/auth/login/" + moduleId)
                .send({
                'app_id': this.config.get('app_id'),
                'callback': window.location.href,
                'data': data
            })
                .end(function (err, res) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    var w_1 = window.cordova.InAppBrowser.open(res.body.data.url, '_blank', _this.parseInAppBrowserOptions(options.inAppBrowserOptions));
                    var onExit_1 = function () {
                        deferred.reject(new Error('InAppBrowser exit'));
                    };
                    var onLoadError_1 = function () {
                        deferred.reject(new Error('InAppBrowser loaderror'));
                    };
                    var onLoadStart = function (data) {
                        if (data.url.slice(0, 20) === 'http://auth.ionic.io') {
                            var queryString = data.url.split('#')[0].split('?')[1];
                            var paramParts = queryString.split('&');
                            var params = {};
                            for (var i = 0; i < paramParts.length; i++) {
                                var part = paramParts[i].split('=');
                                params[part[0]] = part[1];
                            }
                            w_1.removeEventListener('exit', onExit_1);
                            w_1.removeEventListener('loaderror', onLoadError_1);
                            w_1.close();
                            deferred.resolve({
                                'token': params['token'],
                                'signup': Boolean(parseInt(params['signup'], 10))
                            });
                        }
                    };
                    w_1.addEventListener('exit', onExit_1);
                    w_1.addEventListener('loaderror', onLoadError_1);
                    w_1.addEventListener('loadstart', onLoadStart);
                }
            });
        }
        return deferred.promise;
    };
    return AuthType;
}());
exports.AuthType = AuthType;
/**
 * @hidden
 */
var BasicAuth = (function (_super) {
    __extends(BasicAuth, _super);
    function BasicAuth() {
        _super.apply(this, arguments);
    }
    BasicAuth.prototype.authenticate = function (data, options) {
        var deferred = new promise_1.DeferredPromise();
        if (!data.email || !data.password) {
            deferred.reject(new Error('email and password are required for basic authentication'));
        }
        else {
            this.client.post('/auth/login')
                .send({
                'app_id': this.config.get('app_id'),
                'email': data.email,
                'password': data.password
            })
                .end(function (err, res) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve({
                        'token': res.body.data.token
                    });
                }
            });
        }
        return deferred.promise;
    };
    BasicAuth.prototype.requestPasswordReset = function (email) {
        var deferred = new promise_1.DeferredPromise();
        if (!email) {
            deferred.reject(new Error('Email is required for password reset request.'));
        }
        else {
            this.client.post('/users/password/reset')
                .send({
                'app_id': this.config.get('app_id'),
                'email': email,
                'flow': 'app'
            })
                .end(function (err, res) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve();
                }
            });
        }
        return deferred.promise;
    };
    BasicAuth.prototype.confirmPasswordReset = function (email, code, newPassword) {
        var deferred = new promise_1.DeferredPromise();
        if (!code || !email || !newPassword) {
            deferred.reject(new Error('Code, new password, and email are required.'));
        }
        else {
            this.client.post('/users/password')
                .send({
                'reset_token': code,
                'new_password': newPassword,
                'email': email
            })
                .end(function (err, res) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve();
                }
            });
        }
        return deferred.promise;
    };
    BasicAuth.prototype.signup = function (data) {
        var deferred = new promise_1.DeferredPromise();
        var userData = {
            'app_id': this.config.get('app_id'),
            'email': data.email,
            'password': data.password
        };
        // optional details
        if (data.username) {
            userData.username = data.username;
        }
        if (data.image) {
            userData.image = data.image;
        }
        if (data.name) {
            userData.name = data.name;
        }
        if (data.custom) {
            userData.custom = data.custom;
        }
        this.client.post('/users')
            .send(userData)
            .end(function (err, res) {
            if (err) {
                deferred.reject(Auth.getDetailedErrorFromResponse(err.response));
            }
            else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    return BasicAuth;
}(AuthType));
exports.BasicAuth = BasicAuth;
/**
 * @hidden
 */
var CustomAuth = (function (_super) {
    __extends(CustomAuth, _super);
    function CustomAuth() {
        _super.apply(this, arguments);
    }
    CustomAuth.prototype.authenticate = function (data, options) {
        if (data === void 0) { data = {}; }
        return this.inAppBrowserFlow('custom', data, options);
    };
    return CustomAuth;
}(AuthType));
exports.CustomAuth = CustomAuth;
/**
 * @hidden
 */
var TwitterAuth = (function (_super) {
    __extends(TwitterAuth, _super);
    function TwitterAuth() {
        _super.apply(this, arguments);
    }
    TwitterAuth.prototype.authenticate = function (data, options) {
        if (data === void 0) { data = {}; }
        return this.inAppBrowserFlow('twitter', data, options);
    };
    return TwitterAuth;
}(AuthType));
exports.TwitterAuth = TwitterAuth;
/**
 * @hidden
 */
var FacebookAuth = (function (_super) {
    __extends(FacebookAuth, _super);
    function FacebookAuth() {
        _super.apply(this, arguments);
    }
    FacebookAuth.prototype.authenticate = function (data, options) {
        if (data === void 0) { data = {}; }
        return this.inAppBrowserFlow('facebook', data, options);
    };
    return FacebookAuth;
}(AuthType));
exports.FacebookAuth = FacebookAuth;
/**
 * @hidden
 */
var GithubAuth = (function (_super) {
    __extends(GithubAuth, _super);
    function GithubAuth() {
        _super.apply(this, arguments);
    }
    GithubAuth.prototype.authenticate = function (data, options) {
        if (data === void 0) { data = {}; }
        return this.inAppBrowserFlow('github', data, options);
    };
    return GithubAuth;
}(AuthType));
exports.GithubAuth = GithubAuth;
/**
 * @hidden
 */
var GoogleAuth = (function (_super) {
    __extends(GoogleAuth, _super);
    function GoogleAuth() {
        _super.apply(this, arguments);
    }
    GoogleAuth.prototype.authenticate = function (data, options) {
        if (data === void 0) { data = {}; }
        return this.inAppBrowserFlow('google', data, options);
    };
    return GoogleAuth;
}(AuthType));
exports.GoogleAuth = GoogleAuth;
/**
 * @hidden
 */
var InstagramAuth = (function (_super) {
    __extends(InstagramAuth, _super);
    function InstagramAuth() {
        _super.apply(this, arguments);
    }
    InstagramAuth.prototype.authenticate = function (data, options) {
        if (data === void 0) { data = {}; }
        return this.inAppBrowserFlow('instagram', data, options);
    };
    return InstagramAuth;
}(AuthType));
exports.InstagramAuth = InstagramAuth;
/**
 * @hidden
 */
var LinkedInAuth = (function (_super) {
    __extends(LinkedInAuth, _super);
    function LinkedInAuth() {
        _super.apply(this, arguments);
    }
    LinkedInAuth.prototype.authenticate = function (data, options) {
        if (data === void 0) { data = {}; }
        return this.inAppBrowserFlow('linkedin', data, options);
    };
    return LinkedInAuth;
}(AuthType));
exports.LinkedInAuth = LinkedInAuth;

},{"./errors":9,"./promise":14}],2:[function(require,module,exports){
"use strict";
var request = require('superagent');
/**
 * `Client` is for making HTTP requests to the API.
 *
 * Under the hood, it uses
 * [superagent](http://visionmedia.github.io/superagent/). When a method is
 * called, you can call any number of superagent functions on it and then call
 * `end()` to complete and send the request.
 *
 * @featured
 */
var Client = (function () {
    function Client(
        /**
         * @hidden
         */
        tokenContext, 
        /**
         * @hidden
         */
        baseUrl, req // TODO: use superagent types
        ) {
        this.tokenContext = tokenContext;
        this.baseUrl = baseUrl;
        if (typeof req === 'undefined') {
            req = request;
        }
        this.req = req;
    }
    /**
     * GET request for retrieving a resource from the API.
     *
     * @param endpoint - The path of the API endpoint.
     */
    Client.prototype.get = function (endpoint) {
        return this.supplement(this.req.get, endpoint);
    };
    /**
     * POST request for sending a new resource to the API.
     *
     * @param endpoint - The path of the API endpoint.
     */
    Client.prototype.post = function (endpoint) {
        return this.supplement(this.req.post, endpoint);
    };
    /**
     * PUT request for replacing a resource in the API.
     *
     * @param endpoint - The path of the API endpoint.
     */
    Client.prototype.put = function (endpoint) {
        return this.supplement(this.req.put, endpoint);
    };
    /**
     * PATCH request for performing partial updates to a resource in the API.
     *
     * @param endpoint - The path of the API endpoint.
     */
    Client.prototype.patch = function (endpoint) {
        return this.supplement(this.req.patch, endpoint);
    };
    /**
     * DELETE request for deleting a resource from the API.
     *
     * @param endpoint - The path of the API endpoint.
     */
    Client.prototype.delete = function (endpoint) {
        return this.supplement(this.req.delete, endpoint);
    };
    /**
     * @hidden
     */
    Client.prototype.request = function (method, endpoint) {
        return this.supplement(this.req.bind(this.req, method), endpoint);
    };
    /**
     * @private
     */
    Client.prototype.supplement = function (fn, endpoint) {
        if (endpoint.substring(0, 1) !== '/') {
            throw Error('endpoint must start with leading slash');
        }
        var req = fn(this.baseUrl + endpoint);
        var token = this.tokenContext.get();
        if (token) {
            req.set('Authorization', "Bearer " + token);
        }
        return req;
    };
    return Client;
}());
exports.Client = Client;

},{"superagent":22}],3:[function(require,module,exports){
"use strict";
/**
 * @hidden
 */
var Config = (function () {
    function Config() {
        /**
         * @private
         */
        this.urls = {
            'api': 'https://api.ionic.io',
            'web': 'https://web.ionic.io'
        };
    }
    /**
     * Register a new config.
     */
    Config.prototype.register = function (settings) {
        this.settings = settings;
    };
    /**
     * Get a value from the core settings. You should use `settings` attribute
     * directly for core settings and other settings.
     *
     * @deprecated
     *
     * @param name - The settings key to get.
     */
    Config.prototype.get = function (name) {
        if (!this.settings || !this.settings.core) {
            return undefined;
        }
        return this.settings.core[name];
    };
    /**
     * @hidden
     */
    Config.prototype.getURL = function (name) {
        var urls = (this.settings && this.settings.core && this.settings.core.urls) || {};
        if (urls[name]) {
            return urls[name];
        }
        return this.urls[name];
    };
    return Config;
}());
exports.Config = Config;

},{}],4:[function(require,module,exports){
"use strict";
/**
 * @hidden
 */
var Cordova = (function () {
    function Cordova(deps, options) {
        if (options === void 0) { options = {}; }
        this.options = options;
        this.app = deps.appStatus;
        this.device = deps.device;
        this.emitter = deps.emitter;
        this.logger = deps.logger;
        this.registerEventHandlers();
    }
    Cordova.prototype.bootstrap = function () {
        var _this = this;
        var events = ['pause', 'resume'];
        document.addEventListener('deviceready', function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            _this.emitter.emit('cordova:deviceready', { 'args': args });
            var _loop_1 = function(e) {
                document.addEventListener(e, function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i - 0] = arguments[_i];
                    }
                    _this.emitter.emit('cordova:' + e, { 'args': args });
                }, false);
            };
            for (var _a = 0, events_1 = events; _a < events_1.length; _a++) {
                var e = events_1[_a];
                _loop_1(e);
            }
        }, false);
    };
    /**
     * @private
     */
    Cordova.prototype.registerEventHandlers = function () {
        var _this = this;
        this.emitter.on('cordova:pause', function () {
            _this.app.closed = true;
        });
        this.emitter.on('cordova:resume', function () {
            _this.app.closed = false;
        });
    };
    return Cordova;
}());
exports.Cordova = Cordova;

},{}],5:[function(require,module,exports){
"use strict";
/**
 * @hidden
 */
var Core = (function () {
    function Core(deps) {
        /**
         * @private
         */
        this._version = '0.8.2';
        this.config = deps.config;
        this.logger = deps.logger;
        this.emitter = deps.emitter;
        this.insights = deps.insights;
    }
    Core.prototype.init = function () {
        this.registerEventHandlers();
        this.onResume();
    };
    Object.defineProperty(Core.prototype, "version", {
        get: function () {
            return this._version;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @private
     */
    Core.prototype.onResume = function () {
        this.insights.track('mobileapp.opened');
    };
    /**
     * @private
     */
    Core.prototype.registerEventHandlers = function () {
        var _this = this;
        this.emitter.on('cordova:resume', function () {
            _this.onResume();
        });
        this.emitter.on('push:notification', function (data) {
            if (data.message.app.asleep || data.message.app.closed) {
                _this.insights.track('mobileapp.opened.push');
            }
        });
    };
    return Core;
}());
exports.Core = Core;

},{}],6:[function(require,module,exports){
"use strict";
var promise_1 = require('../promise');
var NO_PLUGIN = new Error('Missing deploy plugin: `ionic-plugin-deploy`');
/**
 * `Deploy` handles live deploys of the app. Downloading, extracting, and
 * rolling back snapshots.
 *
 * @featured
 */
var Deploy = (function () {
    function Deploy(deps, 
        /**
         * @hidden
         */
        options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        this.options = options;
        /**
         * The active deploy channel. Set this to change the channel on which
         * `Deploy` operates.
         */
        this.channel = 'production';
        this.config = deps.config;
        this.emitter = deps.emitter;
        this.logger = deps.logger;
        this.emitter.once('device:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.init(_this.config.get('app_id'), _this.config.getURL('api'));
            }
            _this.emitter.emit('deploy:ready');
        });
    }
    /**
     * Check for updates on the active channel.
     *
     * The promise resolves with a boolean. When `true`, a new snapshot exists on
     * the channel.
     */
    Deploy.prototype.check = function () {
        var _this = this;
        var deferred = new promise_1.DeferredPromise();
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.check(_this.config.get('app_id'), _this.channel, function (result) {
                    if (result && result === 'true') {
                        _this.logger.info('Ionic Deploy: an update is available');
                        deferred.resolve(true);
                    }
                    else {
                        _this.logger.info('Ionic Deploy: no updates available');
                        deferred.resolve(false);
                    }
                }, function (error) {
                    _this.logger.error('Ionic Deploy: encountered an error while checking for updates');
                    deferred.reject(error);
                });
            }
            else {
                deferred.reject(NO_PLUGIN);
            }
        });
        return deferred.promise;
    };
    /**
     * Download the available snapshot.
     *
     * This should be used in conjunction with
     * [`extract()`](/api/client/deploy/#extract).
     *
     * @param options
     *  Options for this download, such as a progress callback.
     */
    Deploy.prototype.download = function (options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var deferred = new promise_1.DeferredPromise();
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.download(_this.config.get('app_id'), function (result) {
                    if (result !== 'true' && result !== 'false') {
                        if (options.onProgress) {
                            options.onProgress(result);
                        }
                    }
                    else {
                        if (result === 'true') {
                            _this.logger.info('Ionic Deploy: download complete');
                        }
                        deferred.resolve(result === 'true');
                    }
                }, function (error) {
                    deferred.reject(error);
                });
            }
            else {
                deferred.reject(NO_PLUGIN);
            }
        });
        return deferred.promise;
    };
    /**
     * Extract the downloaded snapshot.
     *
     * This should be called after [`download()`](/api/client/deploy/#download)
     * successfully resolves.
     *
     * @param options
     */
    Deploy.prototype.extract = function (options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var deferred = new promise_1.DeferredPromise();
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.extract(_this.config.get('app_id'), function (result) {
                    if (result !== 'done') {
                        if (options.onProgress) {
                            options.onProgress(result);
                        }
                    }
                    else {
                        if (result === 'true') {
                            _this.logger.info('Ionic Deploy: extraction complete');
                        }
                        deferred.resolve(result === 'true');
                    }
                }, function (error) {
                    deferred.reject(error);
                });
            }
            else {
                deferred.reject(NO_PLUGIN);
            }
        });
        return deferred.promise;
    };
    /**
     * Immediately reload the app with the latest deployed snapshot.
     *
     * This is only necessary to call if you have downloaded and extracted a
     * snapshot and wish to instantly reload the app with the latest deploy. The
     * latest deploy will automatically be loaded when the app is started.
     */
    Deploy.prototype.load = function () {
        var _this = this;
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.redirect(_this.config.get('app_id'));
            }
        });
    };
    /**
     * Get information about the current snapshot.
     *
     * The promise is resolved with an object that has key/value pairs pertaining
     * to the currently deployed snapshot.
     */
    Deploy.prototype.info = function () {
        var _this = this;
        var deferred = new promise_1.DeferredPromise(); // TODO
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.info(_this.config.get('app_id'), function (result) {
                    deferred.resolve(result);
                }, function (err) {
                    deferred.reject(err);
                });
            }
            else {
                deferred.reject(NO_PLUGIN);
            }
        });
        return deferred.promise;
    };
    /**
     * List the snapshots that have been installed on this device.
     *
     * The promise is resolved with an array of snapshot UUIDs.
     */
    Deploy.prototype.getSnapshots = function () {
        var _this = this;
        var deferred = new promise_1.DeferredPromise(); // TODO
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.getVersions(_this.config.get('app_id'), function (result) {
                    deferred.resolve(result);
                }, function (err) {
                    deferred.reject(err);
                });
            }
            else {
                deferred.reject(NO_PLUGIN);
            }
        });
        return deferred.promise;
    };
    /**
     * Remove a snapshot from this device.
     *
     * @param uuid
     *  The snapshot UUID to remove from the device.
     */
    Deploy.prototype.deleteSnapshot = function (uuid) {
        var _this = this;
        var deferred = new promise_1.DeferredPromise(); // TODO
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.deleteVersion(_this.config.get('app_id'), uuid, function (result) {
                    deferred.resolve(result);
                }, function (err) {
                    deferred.reject(err);
                });
            }
            else {
                deferred.reject(NO_PLUGIN);
            }
        });
        return deferred.promise;
    };
    /**
     * Fetches the metadata for a given snapshot. If no UUID is given, it will
     * attempt to grab the metadata for the most recently known snapshot.
     *
     * @param uuid
     *  The snapshot from which to grab metadata.
     */
    Deploy.prototype.getMetadata = function (uuid) {
        var _this = this;
        var deferred = new promise_1.DeferredPromise(); // TODO
        this.emitter.once('deploy:ready', function () {
            if (_this._getPlugin()) {
                _this.plugin.getMetadata(_this.config.get('app_id'), uuid, function (result) {
                    deferred.resolve(result.metadata);
                }, function (err) {
                    deferred.reject(err);
                });
            }
            else {
                deferred.reject(NO_PLUGIN);
            }
        });
        return deferred.promise;
    };
    /**
     * @private
     */
    Deploy.prototype._getPlugin = function () {
        if (typeof window.IonicDeploy === 'undefined') {
            this.logger.warn('Ionic Deploy: Disabled! Deploy plugin is not installed or has not loaded. Have you run `ionic plugin add ionic-plugin-deploy` yet?');
            return;
        }
        if (!this.plugin) {
            this.plugin = window.IonicDeploy;
        }
        return this.plugin;
    };
    return Deploy;
}());
exports.Deploy = Deploy;

},{"../promise":14}],7:[function(require,module,exports){
"use strict";
/**
 * @hidden
 */
var Device = (function () {
    function Device(deps) {
        this.deps = deps;
        this.emitter = this.deps.emitter;
        this.deviceType = this.determineDeviceType();
        this.registerEventHandlers();
    }
    Device.prototype.isAndroid = function () {
        return this.deviceType === 'android';
    };
    Device.prototype.isIOS = function () {
        return this.deviceType === 'iphone' || this.deviceType === 'ipad';
    };
    Device.prototype.isConnectedToNetwork = function (options) {
        if (options === void 0) { options = {}; }
        if (typeof navigator.connection === 'undefined' ||
            typeof navigator.connection.type === 'undefined' ||
            typeof Connection === 'undefined') {
            if (!options.strictMode) {
                return true;
            }
            return false;
        }
        switch (navigator.connection.type) {
            case Connection.ETHERNET:
            case Connection.WIFI:
            case Connection.CELL_2G:
            case Connection.CELL_3G:
            case Connection.CELL_4G:
            case Connection.CELL:
                return true;
            default:
                return false;
        }
    };
    /**
     * @private
     */
    Device.prototype.registerEventHandlers = function () {
        var _this = this;
        if (this.deviceType === 'unknown') {
            this.emitter.emit('device:ready');
        }
        else {
            this.emitter.once('cordova:deviceready', function () {
                _this.emitter.emit('device:ready');
            });
        }
    };
    /**
     * @private
     */
    Device.prototype.determineDeviceType = function () {
        var agent = navigator.userAgent;
        var ipad = agent.match(/iPad/i);
        if (ipad && (ipad[0].toLowerCase() === 'ipad')) {
            return 'ipad';
        }
        var iphone = agent.match(/iPhone/i);
        if (iphone && (iphone[0].toLowerCase() === 'iphone')) {
            return 'iphone';
        }
        var android = agent.match(/Android/i);
        if (android && (android[0].toLowerCase() === 'android')) {
            return 'android';
        }
        return 'unknown';
    };
    return Device;
}());
exports.Device = Device;

},{}],8:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var auth_1 = require('./auth');
var client_1 = require('./client');
var config_1 = require('./config');
var cordova_1 = require('./cordova');
var core_1 = require('./core');
var deploy_1 = require('./deploy/deploy');
var device_1 = require('./device');
var events_1 = require('./events');
var insights_1 = require('./insights');
var logger_1 = require('./logger');
var push_1 = require('./push/push');
var storage_1 = require('./storage');
var user_1 = require('./user/user');
var modules = {};
function cache(target, propertyKey, descriptor) {
    var method = descriptor.get;
    descriptor.get = function () {
        if (typeof modules[propertyKey] === 'undefined') {
            var value = method.apply(this, arguments);
            modules[propertyKey] = value;
        }
        return modules[propertyKey];
    };
    descriptor.set = function (value) { };
}
/**
 * @hidden
 */
var Container = (function () {
    function Container() {
    }
    Object.defineProperty(Container.prototype, "appStatus", {
        get: function () {
            return { 'asleep': false, 'closed': false };
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "config", {
        get: function () {
            return new config_1.Config();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "eventEmitter", {
        get: function () {
            return new events_1.EventEmitter();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "logger", {
        get: function () {
            var config = this.config;
            var c = {};
            if (typeof config.settings !== 'undefined') {
                c = config.settings.logger;
            }
            return new logger_1.Logger(c);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "localStorageStrategy", {
        get: function () {
            return new storage_1.LocalStorageStrategy();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "sessionStorageStrategy", {
        get: function () {
            return new storage_1.SessionStorageStrategy();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "authTokenContext", {
        get: function () {
            var label = 'auth_' + this.config.get('app_id');
            return new auth_1.CombinedAuthTokenContext({
                'storage': new storage_1.Storage({ 'strategy': this.localStorageStrategy }),
                'tempStorage': new storage_1.Storage({ 'strategy': this.sessionStorageStrategy })
            }, label);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "client", {
        get: function () {
            return new client_1.Client(this.authTokenContext, this.config.getURL('api'));
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "insights", {
        get: function () {
            return new insights_1.Insights({
                'appStatus': this.appStatus,
                'storage': new storage_1.Storage({ 'strategy': this.localStorageStrategy }),
                'config': this.config,
                'client': this.client,
                'logger': this.logger
            });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "core", {
        get: function () {
            return new core_1.Core({
                'config': this.config,
                'logger': this.logger,
                'emitter': this.eventEmitter,
                'insights': this.insights
            });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "device", {
        get: function () {
            return new device_1.Device({ 'emitter': this.eventEmitter });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "cordova", {
        get: function () {
            return new cordova_1.Cordova({
                'appStatus': this.appStatus,
                'device': this.device,
                'emitter': this.eventEmitter,
                'logger': this.logger
            });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "userContext", {
        get: function () {
            return new user_1.UserContext({ 'storage': new storage_1.Storage({ 'strategy': this.localStorageStrategy }), 'config': this.config });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "singleUserService", {
        get: function () {
            return new user_1.SingleUserService({ 'client': this.client, 'context': this.userContext });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "authModules", {
        get: function () {
            return {
                'basic': new auth_1.BasicAuth({ 'config': this.config, 'client': this.client }),
                'custom': new auth_1.CustomAuth({ 'config': this.config, 'client': this.client }),
                'twitter': new auth_1.TwitterAuth({ 'config': this.config, 'client': this.client }),
                'facebook': new auth_1.FacebookAuth({ 'config': this.config, 'client': this.client }),
                'github': new auth_1.GithubAuth({ 'config': this.config, 'client': this.client }),
                'google': new auth_1.GoogleAuth({ 'config': this.config, 'client': this.client }),
                'instagram': new auth_1.InstagramAuth({ 'config': this.config, 'client': this.client }),
                'linkedin': new auth_1.LinkedInAuth({ 'config': this.config, 'client': this.client })
            };
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "auth", {
        get: function () {
            return new auth_1.Auth({
                'config': this.config,
                'emitter': this.eventEmitter,
                'authModules': this.authModules,
                'tokenContext': this.authTokenContext,
                'userService': this.singleUserService,
                'storage': new storage_1.Storage({ 'strategy': this.localStorageStrategy })
            });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "push", {
        get: function () {
            var config = this.config;
            var c = {};
            if (typeof config.settings !== 'undefined') {
                c = config.settings.push;
            }
            return new push_1.Push({
                'config': config,
                'auth': this.auth,
                'userService': this.singleUserService,
                'device': this.device,
                'client': this.client,
                'emitter': this.eventEmitter,
                'storage': new storage_1.Storage({ 'strategy': this.localStorageStrategy }),
                'logger': this.logger
            }, c);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Container.prototype, "deploy", {
        get: function () {
            return new deploy_1.Deploy({
                'config': this.config,
                'emitter': this.eventEmitter,
                'logger': this.logger
            });
        },
        enumerable: true,
        configurable: true
    });
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "appStatus", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "config", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "eventEmitter", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "logger", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "localStorageStrategy", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "sessionStorageStrategy", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "authTokenContext", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "client", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "insights", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "core", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "device", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "cordova", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "userContext", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "singleUserService", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "authModules", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "auth", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "push", null);
    __decorate([
        cache, 
        __metadata('design:type', Object)
    ], Container.prototype, "deploy", null);
    return Container;
}());
exports.Container = Container;

},{"./auth":1,"./client":2,"./config":3,"./cordova":4,"./core":5,"./deploy/deploy":6,"./device":7,"./events":10,"./insights":12,"./logger":13,"./push/push":16,"./storage":17,"./user/user":19}],9:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * @hidden
 */
var Exception = (function (_super) {
    __extends(Exception, _super);
    function Exception(message) {
        _super.call(this, message);
        this.message = message;
        this.name = 'Exception';
        this.stack = (new Error()).stack;
    }
    Exception.prototype.toString = function () {
        return this.name + ": " + this.message;
    };
    return Exception;
}(Error));
exports.Exception = Exception;
/**
 * An error with generic error details.
 *
 * Error details can be extracted depending on the type of `D`. For instance,
 * if the type of `D` is `string[]`, you can do this:
 *
 * ```typescript
 * function handleError(err: IDetailedError<string[]>) {
 *   for (let i in err.details) {
 *     console.error('got error code: ' + i);
 *   }
 * }
 * ```
 *
 * @featured
 */
var DetailedError = (function (_super) {
    __extends(DetailedError, _super);
    function DetailedError(
        /**
         * The error message.
         */
        message, 
        /**
         * The error details.
         */
        details) {
        _super.call(this, message);
        this.message = message;
        this.details = details;
        this.name = 'DetailedError';
    }
    return DetailedError;
}(Exception));
exports.DetailedError = DetailedError;

},{}],10:[function(require,module,exports){
"use strict";
/**
 * A registered event receiver.
 */
var EventReceiver = (function () {
    function EventReceiver(
        /**
         * An registered identifier for this event receiver.
         */
        key, 
        /**
         * The registered name of the event.
         */
        event, 
        /**
         * The actual callback.
         */
        handler) {
        this.key = key;
        this.event = event;
        this.handler = handler;
    }
    return EventReceiver;
}());
exports.EventReceiver = EventReceiver;
/**
 * Stores callbacks for registered events.
 */
var EventEmitter = (function () {
    function EventEmitter() {
        /**
         * @private
         */
        this.n = 0;
        /**
         * @private
         */
        this.eventReceivers = {};
        /**
         * @private
         */
        this.eventsEmitted = {};
    }
    /**
     * Register an event callback which gets triggered every time the event is
     * fired.
     *
     * @param event
     *  The event name.
     * @param callback
     *  A callback to attach to this event.
     */
    EventEmitter.prototype.on = function (event, callback) {
        if (typeof this.eventReceivers[event] === 'undefined') {
            this.eventReceivers[event] = {};
        }
        var receiver = new EventReceiver(this.n, event, callback);
        this.n++;
        this.eventReceivers[event][receiver.key] = receiver;
        return receiver;
    };
    /**
     * Unregister an event receiver returned from
     * [`on()`](/api/client/eventemitter#on).
     *
     * @param receiver
     *  The event receiver.
     */
    EventEmitter.prototype.off = function (receiver) {
        if (typeof this.eventReceivers[receiver.event] === 'undefined' ||
            typeof this.eventReceivers[receiver.event][receiver.key] === 'undefined') {
            throw new Error('unknown event receiver');
        }
        delete this.eventReceivers[receiver.event][receiver.key];
    };
    /**
     * Register an event callback that gets triggered only once. If the event was
     * triggered before your callback is registered, it calls your callback
     * immediately.
     *
     * @note TODO: Fix the docs for () => void syntax.
     *
     * @param event
     *  The event name.
     * @param callback
     *  A callback to attach to this event. It takes no arguments.
     */
    EventEmitter.prototype.once = function (event, callback) {
        var _this = this;
        if (this.emitted(event)) {
            callback();
        }
        else {
            this.on(event, function () {
                if (!_this.emitted(event)) {
                    callback();
                }
            });
        }
    };
    /**
     * Trigger an event. Call all callbacks in the order they were registered.
     *
     * @param event
     *  The event name.
     * @param data
     *  An object to pass to every callback.
     */
    EventEmitter.prototype.emit = function (event, data) {
        if (data === void 0) { data = null; }
        if (typeof this.eventReceivers[event] === 'undefined') {
            this.eventReceivers[event] = {};
        }
        if (typeof this.eventsEmitted[event] === 'undefined') {
            this.eventsEmitted[event] = 0;
        }
        for (var k in this.eventReceivers[event]) {
            this.eventReceivers[event][k].handler(data);
        }
        this.eventsEmitted[event] += 1;
    };
    /**
     * Return a count of the number of times an event has been triggered.
     *
     * @param event
     *  The event name.
     */
    EventEmitter.prototype.emitted = function (event) {
        if (typeof this.eventsEmitted[event] === 'undefined') {
            return 0;
        }
        return this.eventsEmitted[event];
    };
    return EventEmitter;
}());
exports.EventEmitter = EventEmitter;

},{}],11:[function(require,module,exports){
"use strict";
var auth_1 = require('./auth');
exports.Auth = auth_1.Auth;
exports.AuthType = auth_1.AuthType;
exports.BasicAuth = auth_1.BasicAuth;
exports.CustomAuth = auth_1.CustomAuth;
exports.FacebookAuth = auth_1.FacebookAuth;
exports.GithubAuth = auth_1.GithubAuth;
exports.GoogleAuth = auth_1.GoogleAuth;
exports.InstagramAuth = auth_1.InstagramAuth;
exports.LinkedInAuth = auth_1.LinkedInAuth;
exports.TwitterAuth = auth_1.TwitterAuth;
var client_1 = require('./client');
exports.Client = client_1.Client;
var config_1 = require('./config');
exports.Config = config_1.Config;
var cordova_1 = require('./cordova');
exports.Cordova = cordova_1.Cordova;
var core_1 = require('./core');
exports.Core = core_1.Core;
var deploy_1 = require('./deploy/deploy');
exports.Deploy = deploy_1.Deploy;
var device_1 = require('./device');
exports.Device = device_1.Device;
var errors_1 = require('./errors');
exports.Exception = errors_1.Exception;
exports.DetailedError = errors_1.DetailedError;
var di_1 = require('./di');
exports.DIContainer = di_1.Container;
var events_1 = require('./events');
exports.EventEmitter = events_1.EventEmitter;
var insights_1 = require('./insights');
exports.Insights = insights_1.Insights;
var logger_1 = require('./logger');
exports.Logger = logger_1.Logger;
var push_1 = require('./push/push');
exports.Push = push_1.Push;
var message_1 = require('./push/message');
exports.PushMessage = message_1.PushMessage;
var storage_1 = require('./storage');
exports.Storage = storage_1.Storage;
exports.LocalStorageStrategy = storage_1.LocalStorageStrategy;
exports.SessionStorageStrategy = storage_1.SessionStorageStrategy;
var user_1 = require('./user/user');
exports.UserContext = user_1.UserContext;
exports.User = user_1.User;
exports.SingleUserService = user_1.SingleUserService;

},{"./auth":1,"./client":2,"./config":3,"./cordova":4,"./core":5,"./deploy/deploy":6,"./device":7,"./di":8,"./errors":9,"./events":10,"./insights":12,"./logger":13,"./push/message":15,"./push/push":16,"./storage":17,"./user/user":19}],12:[function(require,module,exports){
"use strict";
/**
 * @hidden
 */
var Stat = (function () {
    function Stat(appId, stat, value) {
        if (value === void 0) { value = 1; }
        this.appId = appId;
        this.stat = stat;
        this.value = value;
        this.appId = appId;
        this.stat = stat;
        this.value = value;
        this.created = new Date();
    }
    Stat.prototype.toJSON = function () {
        return {
            app_id: this.appId,
            stat: this.stat,
            value: this.value,
            created: this.created.toISOString(),
        };
    };
    return Stat;
}());
exports.Stat = Stat;
/**
 * A client for Insights that handles batching, user activity insight, and
 * sending insights at an interval.
 *
 * @hidden
 */
var Insights = (function () {
    function Insights(deps, options) {
        var _this = this;
        if (options === void 0) { options = {
            'intervalSubmit': 60 * 1000,
            'intervalActiveCheck': 1000,
            'submitCount': 100
        }; }
        this.options = options;
        this.app = deps.appStatus;
        this.storage = deps.storage;
        this.config = deps.config;
        this.client = deps.client;
        this.logger = deps.logger;
        this.batch = [];
        setInterval(function () {
            _this.submit();
        }, this.options.intervalSubmit);
        setInterval(function () {
            if (!_this.app.closed) {
                _this.checkActivity();
            }
        }, this.options.intervalActiveCheck);
    }
    /**
     * Track an insight.
     *
     * @param stat - The insight name.
     * @param value - The number by which to increment this insight.
     */
    Insights.prototype.track = function (stat, value) {
        if (value === void 0) { value = 1; }
        this.trackStat(new Stat(this.config.get('app_id'), stat, value));
    };
    Insights.prototype.checkActivity = function () {
        var session = this.storage.get('insights_session');
        if (!session) {
            this.markActive();
        }
        else {
            var d = new Date(session);
            var hour = 60 * 60 * 1000;
            if (d.getTime() + hour < new Date().getTime()) {
                this.markActive();
            }
        }
    };
    Insights.prototype.markActive = function () {
        this.storage.set('insights_session', new Date().toISOString());
        this.track('mobileapp.active');
    };
    Insights.prototype.trackStat = function (stat) {
        this.batch.push(stat);
        if (this.shouldSubmit()) {
            this.submit();
        }
    };
    Insights.prototype.shouldSubmit = function () {
        return this.batch.length >= this.options.submitCount;
    };
    Insights.prototype.submit = function () {
        var _this = this;
        if (this.batch.length === 0) {
            return;
        }
        var insights = [];
        for (var _i = 0, _a = this.batch; _i < _a.length; _i++) {
            var stat = _a[_i];
            insights.push(stat.toJSON());
        }
        this.client.post('/insights')
            .send({ 'insights': insights })
            .end(function (err, res) {
            if (err) {
                _this.logger.error('Ionic Insights: Could not send insights.', err);
            }
        });
        this.batch = [];
    };
    return Insights;
}());
exports.Insights = Insights;

},{}],13:[function(require,module,exports){
"use strict";
/**
 * Simple console logger.
 */
var Logger = (function () {
    function Logger(options) {
        if (options === void 0) { options = {}; }
        this.options = options;
        /**
         * The function to use to log info level messages.
         */
        this.infofn = console.log.bind(console);
        /**
         * The function to use to log warn level messages.
         */
        this.warnfn = console.warn.bind(console);
        /**
         * The function to use to log error level messages.
         */
        this.errorfn = console.error.bind(console);
    }
    /**
     * Send a log at info level.
     *
     * @note TODO: Fix optionalParams in docs.
     *
     * @param message - The message to log.
     */
    Logger.prototype.info = function (message) {
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (!this.options.silent) {
            this.infofn.apply(this, [message].concat(optionalParams));
        }
    };
    /**
     * Send a log at warn level.
     *
     * @note TODO: Fix optionalParams in docs.
     *
     * @param message - The message to log.
     */
    Logger.prototype.warn = function (message) {
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (!this.options.silent) {
            this.warnfn.apply(this, [message].concat(optionalParams));
        }
    };
    /**
     * Send a log at error level.
     *
     * @note TODO: Fix optionalParams in docs.
     *
     * @param message - The message to log.
     */
    Logger.prototype.error = function (message) {
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        this.errorfn.apply(this, [message].concat(optionalParams));
    };
    return Logger;
}());
exports.Logger = Logger;

},{}],14:[function(require,module,exports){
"use strict";
/**
 * @hidden
 */
var DeferredPromise = (function () {
    function DeferredPromise() {
        this.init();
    }
    DeferredPromise.prototype.init = function () {
        var _this = this;
        this.promise = new Promise(function (resolve, reject) {
            _this.resolve = resolve;
            _this.reject = reject;
        });
    };
    return DeferredPromise;
}());
exports.DeferredPromise = DeferredPromise;

},{}],15:[function(require,module,exports){
"use strict";
/**
 * Represents a push notification sent to the device.
 *
 * @featured
 */
var PushMessage = (function () {
    function PushMessage() {
    }
    /**
     * Create a PushMessage from the push plugin's format.
     *
     * @hidden
     *
     * @param data - The plugin's notification object.
     */
    PushMessage.fromPluginData = function (data) {
        var message = new PushMessage();
        message.raw = data;
        message.text = data.message;
        message.title = data.title;
        message.count = data.count;
        message.sound = data.sound;
        message.image = data.image;
        message.app = {
            'asleep': !data.additionalData.foreground,
            'closed': data.additionalData.coldstart
        };
        message.payload = data.additionalData['payload'];
        return message;
    };
    PushMessage.prototype.toString = function () {
        return "<PushMessage [\"" + this.title + "\"]>";
    };
    return PushMessage;
}());
exports.PushMessage = PushMessage;

},{}],16:[function(require,module,exports){
"use strict";
var promise_1 = require('../promise');
var message_1 = require('./message');
/**
 * `Push` handles push notifications for this app.
 *
 * @featured
 */
var Push = (function () {
    function Push(deps, options) {
        if (options === void 0) { options = {}; }
        this.options = options;
        /**
         * @private
         */
        this.blockRegistration = false;
        /**
         * @private
         */
        this.blockUnregister = false;
        /**
         * @private
         */
        this.blockSaveToken = false;
        /**
         * @private
         */
        this.registered = false;
        this.config = deps.config;
        this.auth = deps.auth;
        this.userService = deps.userService;
        this.device = deps.device;
        this.client = deps.client;
        this.emitter = deps.emitter;
        this.storage = deps.storage;
        this.logger = deps.logger;
        // Check for the required values to use this service
        if (this.device.isAndroid() && !this.options.sender_id) {
            this.logger.error('Ionic Push: GCM project number not found (http://docs.ionic.io/docs/push-android-setup)');
            return;
        }
        if (!options.pluginConfig) {
            options.pluginConfig = {};
        }
        if (this.device.isAndroid()) {
            // inject gcm key for PushPlugin
            if (!options.pluginConfig.android) {
                options.pluginConfig.android = {};
            }
            if (!options.pluginConfig.android.senderID) {
                options.pluginConfig.android.senderID = this.options.sender_id;
            }
        }
        this.options = options;
    }
    Object.defineProperty(Push.prototype, "token", {
        get: function () {
            if (!this._token) {
                this._token = this.storage.get('push_token');
            }
            return this._token;
        },
        set: function (val) {
            if (!val) {
                this.storage.delete('push_token');
            }
            else {
                this.storage.set('push_token', val);
            }
            this._token = val;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Register a token with the API.
     *
     * When a token is saved, you can send push notifications to it. If a user is
     * logged in, the token is linked to them by their ID.
     *
     * @param token - The token.
     * @param options
     */
    Push.prototype.saveToken = function (token, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var deferred = new promise_1.DeferredPromise();
        var tokenData = {
            'token': token.token,
            'app_id': this.config.get('app_id')
        };
        if (!options.ignore_user) {
            var user = this.userService.current();
            if (this.auth.isAuthenticated()) {
                tokenData.user_id = user.id;
            }
        }
        if (!this.blockSaveToken) {
            this.client.post('/push/tokens')
                .send(tokenData)
                .end(function (err, res) {
                if (err) {
                    _this.blockSaveToken = false;
                    _this.logger.error('Ionic Push:', err);
                    deferred.reject(err);
                }
                else {
                    _this.blockSaveToken = false;
                    _this.logger.info('Ionic Push: saved push token: ' + token.token);
                    if (tokenData.user_id) {
                        _this.logger.info('Ionic Push: added push token to user: ' + tokenData.user_id);
                    }
                    token.id = res.body.data.id;
                    token.type = res.body.data.type;
                    token.saved = true;
                    deferred.resolve(token);
                }
            });
        }
        else {
            deferred.reject(new Error('A token save operation is already in progress.'));
        }
        return deferred.promise;
    };
    /**
     * Registers the device with GCM/APNS to get a push token.
     *
     * After a device is registered, you will likely want to save the token with
     * [`saveToken()`](/api/client/push/#saveToken) to the API.
     */
    Push.prototype.register = function () {
        var _this = this;
        var deferred = new promise_1.DeferredPromise();
        if (this.blockRegistration) {
            deferred.reject(new Error('Another registration is already in progress.'));
        }
        else {
            this.blockRegistration = true;
            this.emitter.once('device:ready', function () {
                var pushPlugin = _this._getPushPlugin();
                if (pushPlugin) {
                    _this.plugin = pushPlugin.init(_this.options.pluginConfig);
                    _this.plugin.on('registration', function (data) {
                        _this.blockRegistration = false;
                        _this.token = { 'token': data.registrationId };
                        _this.token.registered = true;
                        deferred.resolve(_this.token);
                    });
                    _this._callbackRegistration();
                    _this.registered = true;
                }
                else {
                    deferred.reject(new Error('Push plugin not found! See logs.'));
                }
            });
        }
        return deferred.promise;
    };
    /**
     * Invalidate the current push token.
     */
    Push.prototype.unregister = function () {
        var _this = this;
        var deferred = new promise_1.DeferredPromise();
        if (!this.blockUnregister) {
            var pushToken_1 = this.token;
            if (!pushToken_1) {
                deferred.resolve();
            }
            else {
                var tokenData = {
                    'token': pushToken_1.token,
                    'app_id': this.config.get('app_id')
                };
                if (this.plugin) {
                    this.plugin.unregister(function () { }, function () { });
                }
                this.client.post('/push/tokens/invalidate')
                    .send(tokenData)
                    .end(function (err, res) {
                    _this.blockUnregister = false;
                    if (err) {
                        _this.logger.error('Ionic Push:', err);
                        deferred.reject(err);
                    }
                    else {
                        _this.logger.info('Ionic Push: unregistered push token: ' + pushToken_1.token);
                        _this.token = null;
                        deferred.resolve();
                    }
                });
            }
        }
        else {
            deferred.reject(new Error('An unregister operation is already in progress.'));
        }
        this.blockUnregister = true;
        return deferred.promise;
    };
    /**
     * @private
     */
    Push.prototype._callbackRegistration = function () {
        var _this = this;
        this.plugin.on('registration', function (data) {
            _this.token = { 'token': data.registrationId };
            if (_this.options.debug) {
                _this.logger.info('Ionic Push (debug): device token registered: ' + _this.token);
            }
            _this.emitter.emit('push:register', _this.token);
        });
        this.plugin.on('notification', function (data) {
            var message = message_1.PushMessage.fromPluginData(data);
            if (_this.options.debug) {
                _this.logger.info('Ionic Push (debug): notification received: ' + message);
            }
            _this.emitter.emit('push:notification', { 'message': message, 'raw': data });
        });
        this.plugin.on('error', function (e) {
            if (_this.options.debug) {
                _this.logger.error('Ionic Push (debug): unexpected error occured.');
                _this.logger.error('Ionic Push:', e);
            }
            _this.emitter.emit('push:error', { 'err': e });
        });
    };
    /**
     * @private
     */
    Push.prototype._getPushPlugin = function () {
        var plugin = window.PushNotification;
        if (!plugin) {
            if (this.device.isIOS() || this.device.isAndroid()) {
                this.logger.error('Ionic Push: PushNotification plugin is required. Have you run `ionic plugin add phonegap-plugin-push` ?');
            }
            else {
                this.logger.warn('Ionic Push: Disabled! Native push notifications will not work in a browser. Run your app on an actual device to use push.');
            }
        }
        return plugin;
    };
    return Push;
}());
exports.Push = Push;

},{"../promise":14,"./message":15}],17:[function(require,module,exports){
"use strict";
/**
 * @hidden
 */
var LocalStorageStrategy = (function () {
    function LocalStorageStrategy() {
    }
    LocalStorageStrategy.prototype.get = function (key) {
        return localStorage.getItem(key);
    };
    LocalStorageStrategy.prototype.set = function (key, value) {
        return localStorage.setItem(key, value);
    };
    LocalStorageStrategy.prototype.delete = function (key) {
        return localStorage.removeItem(key);
    };
    return LocalStorageStrategy;
}());
exports.LocalStorageStrategy = LocalStorageStrategy;
/**
 * @hidden
 */
var SessionStorageStrategy = (function () {
    function SessionStorageStrategy() {
    }
    SessionStorageStrategy.prototype.get = function (key) {
        return sessionStorage.getItem(key);
    };
    SessionStorageStrategy.prototype.set = function (key, value) {
        return sessionStorage.setItem(key, value);
    };
    SessionStorageStrategy.prototype.delete = function (key) {
        return sessionStorage.removeItem(key);
    };
    return SessionStorageStrategy;
}());
exports.SessionStorageStrategy = SessionStorageStrategy;
/**
 * A generic local/session storage abstraction.
 */
var Storage = (function () {
    function Storage(deps, options) {
        if (options === void 0) { options = { 'prefix': 'ionic', 'cache': true }; }
        this.options = options;
        this.strategy = deps.strategy;
        this.storageCache = {};
    }
    /**
     * Set a value in the storage by the given key.
     *
     * @param key - The storage key to set.
     * @param value - The value to set. (Must be JSON-serializable).
     */
    Storage.prototype.set = function (key, value) {
        key = this.standardizeKey(key);
        var json = JSON.stringify(value);
        this.strategy.set(key, json);
        if (this.options.cache) {
            this.storageCache[key] = value;
        }
    };
    /**
     * Delete a value from the storage by the given key.
     *
     * @param key - The storage key to delete.
     */
    Storage.prototype.delete = function (key) {
        key = this.standardizeKey(key);
        this.strategy.delete(key);
        if (this.options.cache) {
            delete this.storageCache[key];
        }
    };
    /**
     * Get a value from the storage by the given key.
     *
     * @param key - The storage key to get.
     */
    Storage.prototype.get = function (key) {
        key = this.standardizeKey(key);
        if (this.options.cache) {
            var cached = this.storageCache[key];
            if (cached) {
                return cached;
            }
        }
        var json = this.strategy.get(key);
        if (!json) {
            return null;
        }
        try {
            var value = JSON.parse(json);
            if (this.options.cache) {
                this.storageCache[key] = value;
            }
            return value;
        }
        catch (err) {
            return null;
        }
    };
    /**
     * @private
     */
    Storage.prototype.standardizeKey = function (key) {
        return this.options.prefix + "_" + key;
    };
    return Storage;
}());
exports.Storage = Storage;

},{}],18:[function(require,module,exports){
"use strict";
var dataTypeMapping = {};
var DataTypeSchema = (function () {
    function DataTypeSchema(properties) {
        this.data = {};
        this.setProperties(properties);
    }
    DataTypeSchema.prototype.setProperties = function (properties) {
        if (properties instanceof Object) {
            for (var x in properties) {
                this.data[x] = properties[x];
            }
        }
    };
    DataTypeSchema.prototype.toJSON = function () {
        var data = this.data;
        return {
            '__Ionic_DataTypeSchema': data.name,
            'value': data.value
        };
    };
    DataTypeSchema.prototype.isValid = function () {
        if (this.data.name && this.data.value) {
            return true;
        }
        return false;
    };
    return DataTypeSchema;
}());
exports.DataTypeSchema = DataTypeSchema;
var DataType = (function () {
    function DataType() {
    }
    DataType.get = function (name, value) {
        if (dataTypeMapping[name]) {
            return new dataTypeMapping[name](value);
        }
        return false;
    };
    DataType.getMapping = function () {
        return dataTypeMapping;
    };
    Object.defineProperty(DataType, "Schema", {
        get: function () {
            return DataTypeSchema;
        },
        enumerable: true,
        configurable: true
    });
    DataType.register = function (name, cls) {
        dataTypeMapping[name] = cls;
    };
    return DataType;
}());
exports.DataType = DataType;
var UniqueArray = (function () {
    function UniqueArray(value) {
        this.data = [];
        if (value instanceof Array) {
            for (var x in value) {
                this.push(value[x]);
            }
        }
    }
    UniqueArray.prototype.toJSON = function () {
        var data = this.data;
        var schema = new DataTypeSchema({ 'name': 'UniqueArray', 'value': data });
        return schema.toJSON();
    };
    UniqueArray.fromStorage = function (value) {
        return new UniqueArray(value);
    };
    UniqueArray.prototype.push = function (value) {
        if (this.data.indexOf(value) === -1) {
            this.data.push(value);
        }
    };
    UniqueArray.prototype.pull = function (value) {
        var index = this.data.indexOf(value);
        this.data.splice(index, 1);
    };
    return UniqueArray;
}());
exports.UniqueArray = UniqueArray;
DataType.register('UniqueArray', UniqueArray);

},{}],19:[function(require,module,exports){
"use strict";
var promise_1 = require('../promise');
var data_types_1 = require('./data-types');
/**
 * @hidden
 */
var UserContext = (function () {
    function UserContext(deps) {
        this.config = deps.config;
        this.storage = deps.storage;
    }
    Object.defineProperty(UserContext.prototype, "label", {
        get: function () {
            return 'user_' + this.config.get('app_id');
        },
        enumerable: true,
        configurable: true
    });
    UserContext.prototype.unstore = function () {
        this.storage.delete(this.label);
    };
    UserContext.prototype.store = function (user) {
        this.storage.set(this.label, user.serializeForStorage());
    };
    UserContext.prototype.load = function (user) {
        var data = this.storage.get(this.label);
        if (data) {
            user.id = data.id;
            user.data = new UserData(data.data);
            user.details = data.details || {};
            user.social = data.social || {};
            user.fresh = data.fresh;
            return user;
        }
        return;
    };
    return UserContext;
}());
exports.UserContext = UserContext;
/**
 * @hidden
 */
var UserData = (function () {
    function UserData(data) {
        if (data === void 0) { data = {}; }
        this.data = {};
        if ((typeof data === 'object')) {
            this.data = data;
            this.deserializeDataTypes();
        }
    }
    UserData.prototype.get = function (key, defaultValue) {
        if (this.data.hasOwnProperty(key)) {
            return this.data[key];
        }
        else {
            if (defaultValue === 0 || defaultValue === false) {
                return defaultValue;
            }
            return defaultValue || null;
        }
    };
    UserData.prototype.set = function (key, value) {
        this.data[key] = value;
    };
    UserData.prototype.unset = function (key) {
        delete this.data[key];
    };
    /**
     * @private
     */
    UserData.prototype.deserializeDataTypes = function () {
        if (this.data) {
            for (var x in this.data) {
                // if we have an object, let's check for custom data types
                if (this.data[x] && typeof this.data[x] === 'object') {
                    // do we have a custom type?
                    if (this.data[x].__Ionic_DataTypeSchema) {
                        var name = this.data[x].__Ionic_DataTypeSchema;
                        var mapping = data_types_1.DataType.getMapping();
                        if (mapping[name]) {
                            // we have a custom type and a registered class, give the custom data type
                            // from storage
                            this.data[x] = mapping[name].fromStorage(this.data[x].value);
                        }
                    }
                }
            }
        }
    };
    return UserData;
}());
exports.UserData = UserData;
/**
 * Represents a user of the app.
 *
 * @featured
 */
var User = (function () {
    function User(deps) {
        /**
         * The details (email, password, etc) of this user.
         */
        this.details = {};
        /**
         * The social details of this user.
         */
        this.social = {};
        this.service = deps.service;
        this.fresh = true;
        this._unset = {};
        this.data = new UserData();
    }
    /**
     * Check whether this user is anonymous or not.
     *
     * If the `id` property is set, the user is no longer anonymous.
     */
    User.prototype.isAnonymous = function () {
        if (!this.id) {
            return true;
        }
        else {
            return false;
        }
    };
    /**
     * Get a value from this user's custom data.
     *
     * Optionally, a default value can be provided.
     *
     * @param key - The data key to get.
     * @param defaultValue - The value to return if the key is absent.
     */
    User.prototype.get = function (key, defaultValue) {
        return this.data.get(key, defaultValue);
    };
    /**
     * Set a value in this user's custom data.
     *
     * @param key - The data key to set.
     * @param value - The value to set.
     */
    User.prototype.set = function (key, value) {
        delete this._unset[key];
        return this.data.set(key, value);
    };
    /**
     * Delete a value from this user's custom data.
     *
     * @param key - The data key to delete.
     */
    User.prototype.unset = function (key) {
        this._unset[key] = true;
        return this.data.unset(key);
    };
    /**
     * Revert this user to a fresh, anonymous state.
     */
    User.prototype.clear = function () {
        this.id = null;
        this.data = new UserData();
        this.details = {};
        this.fresh = true;
    };
    /**
     * Save this user to the API.
     */
    User.prototype.save = function () {
        this._unset = {};
        return this.service.save();
    };
    /**
     * Delete this user from the API.
     */
    User.prototype.delete = function () {
        return this.service.delete();
    };
    /**
     * Load the user from the API, overwriting the local user's data.
     *
     * @param id - The user ID to load into this user.
     */
    User.prototype.load = function (id) {
        return this.service.load(id);
    };
    /**
     * Store this user in local storage.
     */
    User.prototype.store = function () {
        this.service.store();
    };
    /**
     * Remove this user from local storage.
     */
    User.prototype.unstore = function () {
        this.service.unstore();
    };
    /**
     * @hidden
     */
    User.prototype.serializeForAPI = function () {
        return {
            'email': this.details.email,
            'password': this.details.password,
            'username': this.details.username,
            'image': this.details.image,
            'name': this.details.name,
            'custom': this.data.data
        };
    };
    /**
     * @hidden
     */
    User.prototype.serializeForStorage = function () {
        return {
            'id': this.id,
            'data': this.data.data,
            'details': this.details,
            'fresh': this.fresh,
            'social': this.social
        };
    };
    User.prototype.toString = function () {
        return "<User [" + (this.isAnonymous() ? 'anonymous' : this.id) + "]>";
    };
    return User;
}());
exports.User = User;
/**
 * @hidden
 */
var SingleUserService = (function () {
    function SingleUserService(deps, config) {
        if (config === void 0) { config = {}; }
        this.config = config;
        this.client = deps.client;
        this.context = deps.context;
    }
    SingleUserService.prototype.current = function () {
        if (!this.user) {
            this.user = this.context.load(new User({ 'service': this }));
        }
        if (!this.user) {
            this.user = new User({ 'service': this });
        }
        return this.user;
    };
    SingleUserService.prototype.store = function () {
        this.context.store(this.current());
    };
    SingleUserService.prototype.unstore = function () {
        this.context.unstore();
    };
    SingleUserService.prototype.load = function (id) {
        if (id === void 0) { id = 'self'; }
        var deferred = new promise_1.DeferredPromise();
        var user = this.current();
        this.client.get("/users/" + id)
            .end(function (err, res) {
            if (err) {
                deferred.reject(err);
            }
            else {
                user.id = res.body.data.uuid;
                user.data = new UserData(res.body.data.custom);
                user.details = res.body.data.details;
                user.fresh = false;
                user.social = res.body.data.social;
                deferred.resolve();
            }
        });
        return deferred.promise;
    };
    SingleUserService.prototype.delete = function () {
        var deferred = new promise_1.DeferredPromise();
        if (this.user.isAnonymous()) {
            deferred.reject(new Error('User is anonymous and cannot be deleted from the API.'));
        }
        else {
            this.unstore();
            this.client.delete("/users/" + this.user.id)
                .end(function (err, res) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve();
                }
            });
        }
        return deferred.promise;
    };
    SingleUserService.prototype.save = function () {
        var _this = this;
        var deferred = new promise_1.DeferredPromise();
        this.store();
        if (this.user.isAnonymous()) {
            deferred.reject(new Error('User is anonymous and cannot be updated in the API. Use load(<id>) or signup a user using auth.'));
        }
        else {
            this.client.patch("/users/" + this.user.id)
                .send(this.user.serializeForAPI())
                .end(function (err, res) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    _this.user.fresh = false;
                    deferred.resolve();
                }
            });
        }
        return deferred.promise;
    };
    return SingleUserService;
}());
exports.SingleUserService = SingleUserService;

},{"../promise":14,"./data-types":18}],20:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

if (typeof module !== 'undefined') {
  module.exports = Emitter;
}

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],21:[function(require,module,exports){

/**
 * Reduce `arr` with `fn`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @param {Mixed} initial
 *
 * TODO: combatible error handling?
 */

module.exports = function(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
},{}],22:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Emitter = require('emitter');
var reduce = require('reduce');
var requestBase = require('./request-base');
var isObject = require('./is-object');

/**
 * Root reference for iframes.
 */

var root;
if (typeof window !== 'undefined') { // Browser window
  root = window;
} else if (typeof self !== 'undefined') { // Web Worker
  root = self;
} else { // Other environments
  root = this;
}

/**
 * Noop.
 */

function noop(){};

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 * TODO: future proof, move to compoent land
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isHost(obj) {
  var str = {}.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
}

/**
 * Expose `request`.
 */

var request = module.exports = require('./request').bind(null, Request);

/**
 * Determine XHR.
 */

request.getXHR = function () {
  if (root.XMLHttpRequest
      && (!root.location || 'file:' != root.location.protocol
          || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  return false;
};

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim
  ? function(s) { return s.trim(); }
  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
  if (!isObject(obj)) return obj;
  var pairs = [];
  for (var key in obj) {
    if (null != obj[key]) {
      pushEncodedKeyValuePair(pairs, key, obj[key]);
        }
      }
  return pairs.join('&');
}

/**
 * Helps 'serialize' with serializing arrays.
 * Mutates the pairs array.
 *
 * @param {Array} pairs
 * @param {String} key
 * @param {Mixed} val
 */

function pushEncodedKeyValuePair(pairs, key, val) {
  if (Array.isArray(val)) {
    return val.forEach(function(v) {
      pushEncodedKeyValuePair(pairs, key, v);
    });
  }
  pairs.push(encodeURIComponent(key)
    + '=' + encodeURIComponent(val));
}

/**
 * Expose serialization method.
 */

 request.serializeObject = serialize;

 /**
  * Parse the given x-www-form-urlencoded `str`.
  *
  * @param {String} str
  * @return {Object}
  * @api private
  */

function parseString(str) {
  var obj = {};
  var pairs = str.split('&');
  var parts;
  var pair;

  for (var i = 0, len = pairs.length; i < len; ++i) {
    pair = pairs[i];
    parts = pair.split('=');
    obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  }

  return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  urlencoded: 'application/x-www-form-urlencoded',
  'form': 'application/x-www-form-urlencoded',
  'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 *
 */

 request.serialize = {
   'application/x-www-form-urlencoded': serialize,
   'application/json': JSON.stringify
 };

 /**
  * Default parsers.
  *
  *     superagent.parse['application/xml'] = function(str){
  *       return { object parsed from str };
  *     };
  *
  */

request.parse = {
  'application/x-www-form-urlencoded': parseString,
  'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var fields = {};
  var index;
  var line;
  var field;
  var val;

  lines.pop(); // trailing CRLF

  for (var i = 0, len = lines.length; i < len; ++i) {
    line = lines[i];
    index = line.indexOf(':');
    field = line.slice(0, index).toLowerCase();
    val = trim(line.slice(index + 1));
    fields[field] = val;
  }

  return fields;
}

/**
 * Check if `mime` is json or has +json structured syntax suffix.
 *
 * @param {String} mime
 * @return {Boolean}
 * @api private
 */

function isJSON(mime) {
  return /[\/+]json\b/.test(mime);
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
  return str.split(/ *; */).shift();
};

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
  return reduce(str.split(/ *; */), function(obj, str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
};

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {XMLHTTPRequest} xhr
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
  options = options || {};
  this.req = req;
  this.xhr = this.req.xhr;
  // responseText is accessible only if responseType is '' or 'text' and on older browsers
  this.text = ((this.req.method !='HEAD' && (this.xhr.responseType === '' || this.xhr.responseType === 'text')) || typeof this.xhr.responseType === 'undefined')
     ? this.xhr.responseText
     : null;
  this.statusText = this.req.xhr.statusText;
  this.setStatusProperties(this.xhr.status);
  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
  // getResponseHeader still works. so we get content-type even if getting
  // other headers fails.
  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
  this.setHeaderProperties(this.header);
  this.body = this.req.method != 'HEAD'
    ? this.parseBody(this.text ? this.text : this.xhr.response)
    : null;
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
  return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
  // content-type
  var ct = this.header['content-type'] || '';
  this.type = type(ct);

  // params
  var obj = params(ct);
  for (var key in obj) this[key] = obj[key];
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype.parseBody = function(str){
  var parse = request.parse[this.type];
  if (!parse && isJSON(this.type)) {
    parse = request.parse['application/json'];
  }
  return parse && str && (str.length || str instanceof Object)
    ? parse(str)
    : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
  // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
  if (status === 1223) {
    status = 204;
  }

  var type = status / 100 | 0;

  // status / class
  this.status = this.statusCode = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = (4 == type || 5 == type)
    ? this.toError()
    : false;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
  this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
  var req = this.req;
  var method = req.method;
  var url = req.url;

  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
  var err = new Error(msg);
  err.status = this.status;
  err.method = method;
  err.url = url;

  return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  this._query = this._query || [];
  this.method = method;
  this.url = url;
  this.header = {}; // preserves header name case
  this._header = {}; // coerces header names to lowercase
  this.on('end', function(){
    var err = null;
    var res = null;

    try {
      res = new Response(self);
    } catch(e) {
      err = new Error('Parser is unable to parse the response');
      err.parse = true;
      err.original = e;
      // issue #675: return the raw response if the response parsing fails
      err.rawResponse = self.xhr && self.xhr.responseText ? self.xhr.responseText : null;
      // issue #876: return the http status code if the response parsing fails
      err.statusCode = self.xhr && self.xhr.status ? self.xhr.status : null;
      return self.callback(err);
    }

    self.emit('response', res);

    if (err) {
      return self.callback(err, res);
    }

    if (res.status >= 200 && res.status < 300) {
      return self.callback(err, res);
    }

    var new_err = new Error(res.statusText || 'Unsuccessful HTTP response');
    new_err.original = err;
    new_err.response = res;
    new_err.status = res.status;

    self.callback(new_err, res);
  });
}

/**
 * Mixin `Emitter` and `requestBase`.
 */

Emitter(Request.prototype);
for (var key in requestBase) {
  Request.prototype[key] = requestBase[key];
}

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */

Request.prototype.abort = function(){
  if (this.aborted) return;
  this.aborted = true;
  this.xhr && this.xhr.abort();
  this.clearTimeout();
  this.emit('abort');
  return this;
};

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  this.set('Content-Type', request.types[type] || type);
  return this;
};

/**
 * Set responseType to `val`. Presently valid responseTypes are 'blob' and 
 * 'arraybuffer'.
 *
 * Examples:
 *
 *      req.get('/')
 *        .responseType('blob')
 *        .end(callback);
 *
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.responseType = function(val){
  this._responseType = val;
  return this;
};

/**
 * Set Accept to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.json = 'application/json';
 *
 *      request.get('/agent')
 *        .accept('json')
 *        .end(callback);
 *
 *      request.get('/agent')
 *        .accept('application/json')
 *        .end(callback);
 *
 * @param {String} accept
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.accept = function(type){
  this.set('Accept', request.types[type] || type);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @param {Object} options with 'type' property 'auto' or 'basic' (default 'basic')
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass, options){
  if (!options) {
    options = {
      type: 'basic'
    }
  }

  switch (options.type) {
    case 'basic':
      var str = btoa(user + ':' + pass);
      this.set('Authorization', 'Basic ' + str);
    break;

    case 'auto':
      this.username = user;
      this.password = pass;
    break;
  }
  return this;
};

/**
* Add query-string `val`.
*
* Examples:
*
*   request.get('/shoes')
*     .query('size=10')
*     .query({ color: 'blue' })
*
* @param {Object|String} val
* @return {Request} for chaining
* @api public
*/

Request.prototype.query = function(val){
  if ('string' != typeof val) val = serialize(val);
  if (val) this._query.push(val);
  return this;
};

/**
 * Queue the given `file` as an attachment to the specified `field`,
 * with optional `filename`.
 *
 * ``` js
 * request.post('/upload')
 *   .attach(new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
 *   .end(callback);
 * ```
 *
 * @param {String} field
 * @param {Blob|File} file
 * @param {String} filename
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.attach = function(field, file, filename){
  this._getFormData().append(field, file, filename || file.name);
  return this;
};

Request.prototype._getFormData = function(){
  if (!this._formData) {
    this._formData = new root.FormData();
  }
  return this._formData;
};

/**
 * Send `data` as the request body, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"}')
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
  *      request.post('/user')
  *        .send('name=tobi')
  *        .send('species=ferret')
  *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
  var obj = isObject(data);
  var type = this._header['content-type'];

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  } else if ('string' == typeof data) {
    if (!type) this.type('form');
    type = this._header['content-type'];
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj || isHost(data)) return this;
  if (!type) this.type('json');
  return this;
};

/**
 * @deprecated
 */
Response.prototype.parse = function serialize(fn){
  if (root.console) {
    console.warn("Client-side parse() method has been renamed to serialize(). This method is not compatible with superagent v2.0");
  }
  this.serialize(fn);
  return this;
};

Response.prototype.serialize = function serialize(fn){
  this._parser = fn;
  return this;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  this.clearTimeout();
  fn(err, res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
  var err = new Error('Request has been terminated\nPossible causes: the network is offline, Origin is not allowed by Access-Control-Allow-Origin, the page is being unloaded, etc.');
  err.crossDomain = true;

  err.status = this.status;
  err.method = this.method;
  err.url = this.url;

  this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype.timeoutError = function(){
  var timeout = this._timeout;
  var err = new Error('timeout of ' + timeout + 'ms exceeded');
  err.timeout = timeout;
  this.callback(err);
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

Request.prototype.withCredentials = function(){
  this._withCredentials = true;
  return this;
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this;
  var xhr = this.xhr = request.getXHR();
  var query = this._query.join('&');
  var timeout = this._timeout;
  var data = this._formData || this._data;

  // store callback
  this._callback = fn || noop;

  // state change
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;

    // In IE9, reads to any property (e.g. status) off of an aborted XHR will
    // result in the error "Could not complete the operation due to error c00c023f"
    var status;
    try { status = xhr.status } catch(e) { status = 0; }

    if (0 == status) {
      if (self.timedout) return self.timeoutError();
      if (self.aborted) return;
      return self.crossDomainError();
    }
    self.emit('end');
  };

  // progress
  var handleProgress = function(e){
    if (e.total > 0) {
      e.percent = e.loaded / e.total * 100;
    }
    e.direction = 'download';
    self.emit('progress', e);
  };
  if (this.hasListeners('progress')) {
    xhr.onprogress = handleProgress;
  }
  try {
    if (xhr.upload && this.hasListeners('progress')) {
      xhr.upload.onprogress = handleProgress;
    }
  } catch(e) {
    // Accessing xhr.upload fails in IE from a web worker, so just pretend it doesn't exist.
    // Reported here:
    // https://connect.microsoft.com/IE/feedback/details/837245/xmlhttprequest-upload-throws-invalid-argument-when-used-from-web-worker-context
  }

  // timeout
  if (timeout && !this._timer) {
    this._timer = setTimeout(function(){
      self.timedout = true;
      self.abort();
    }, timeout);
  }

  // querystring
  if (query) {
    query = request.serializeObject(query);
    this.url += ~this.url.indexOf('?')
      ? '&' + query
      : '?' + query;
  }

  // initiate request
  if (this.username && this.password) {
    xhr.open(this.method, this.url, true, this.username, this.password);
  } else {
    xhr.open(this.method, this.url, true);
  }

  // CORS
  if (this._withCredentials) xhr.withCredentials = true;

  // body
  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
    // serialize stuff
    var contentType = this._header['content-type'];
    var serialize = this._parser || request.serialize[contentType ? contentType.split(';')[0] : ''];
    if (!serialize && isJSON(contentType)) serialize = request.serialize['application/json'];
    if (serialize) data = serialize(data);
  }

  // set header fields
  for (var field in this.header) {
    if (null == this.header[field]) continue;
    xhr.setRequestHeader(field, this.header[field]);
  }

  if (this._responseType) {
    xhr.responseType = this._responseType;
  }

  // send stuff
  this.emit('request', this);

  // IE11 xhr.send(undefined) sends 'undefined' string as POST payload (instead of nothing)
  // We need null here if data is undefined
  xhr.send(typeof data !== 'undefined' ? data : null);
  return this;
};


/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
  var req = request('GET', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.query(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * HEAD `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
  var req = request('HEAD', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

function del(url, fn){
  var req = request('DELETE', url);
  if (fn) req.end(fn);
  return req;
};

request['del'] = del;
request['delete'] = del;

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
  var req = request('PATCH', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
  var req = request('POST', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
  var req = request('PUT', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

},{"./is-object":23,"./request":25,"./request-base":24,"emitter":20,"reduce":21}],23:[function(require,module,exports){
/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return null != obj && 'object' == typeof obj;
}

module.exports = isObject;

},{}],24:[function(require,module,exports){
/**
 * Module of mixed-in functions shared between node and client code
 */
var isObject = require('./is-object');

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

exports.clearTimeout = function _clearTimeout(){
  this._timeout = 0;
  clearTimeout(this._timer);
  return this;
};

/**
 * Force given parser
 *
 * Sets the body parser no matter type.
 *
 * @param {Function}
 * @api public
 */

exports.parse = function parse(fn){
  this._parser = fn;
  return this;
};

/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

exports.timeout = function timeout(ms){
  this._timeout = ms;
  return this;
};

/**
 * Faux promise support
 *
 * @param {Function} fulfill
 * @param {Function} reject
 * @return {Request}
 */

exports.then = function then(fulfill, reject) {
  return this.end(function(err, res) {
    err ? reject(err) : fulfill(res);
  });
}

/**
 * Allow for extension
 */

exports.use = function use(fn) {
  fn(this);
  return this;
}


/**
 * Get request header `field`.
 * Case-insensitive.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

exports.get = function(field){
  return this._header[field.toLowerCase()];
};

/**
 * Get case-insensitive header `field` value.
 * This is a deprecated internal API. Use `.get(field)` instead.
 *
 * (getHeader is no longer used internally by the superagent code base)
 *
 * @param {String} field
 * @return {String}
 * @api private
 * @deprecated
 */

exports.getHeader = exports.get;

/**
 * Set header `field` to `val`, or multiple fields with one object.
 * Case-insensitive.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

exports.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this._header[field.toLowerCase()] = val;
  this.header[field] = val;
  return this;
};

/**
 * Remove header `field`.
 * Case-insensitive.
 *
 * Example:
 *
 *      req.get('/')
 *        .unset('User-Agent')
 *        .end(callback);
 *
 * @param {String} field
 */
exports.unset = function(field){
  delete this._header[field.toLowerCase()];
  delete this.header[field];
  return this;
};

/**
 * Write the field `name` and `val` for "multipart/form-data"
 * request bodies.
 *
 * ``` js
 * request.post('/upload')
 *   .field('foo', 'bar')
 *   .end(callback);
 * ```
 *
 * @param {String} name
 * @param {String|Blob|File|Buffer|fs.ReadStream} val
 * @return {Request} for chaining
 * @api public
 */
exports.field = function(name, val) {
  this._getFormData().append(name, val);
  return this;
};

},{"./is-object":23}],25:[function(require,module,exports){
// The node and browser modules expose versions of this with the
// appropriate constructor function bound as first argument
/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(RequestConstructor, method, url) {
  // callback
  if ('function' == typeof url) {
    return new RequestConstructor('GET', method).end(url);
  }

  // url first
  if (2 == arguments.length) {
    return new RequestConstructor('GET', method);
  }

  return new RequestConstructor(method, url);
}

module.exports = request;

},{}],26:[function(require,module,exports){
// Angular 1 modules and factories for the bundle

if (typeof angular === 'object' && angular.module) {

  angular.element(document).ready(function() {
    Ionic.core.init();
    Ionic.cordova.bootstrap();
  });

  angular.module('ionic.cloud', [])

  .provider('$ionicCloudConfig', function() {
    var config = Ionic.config;

    this.register = function(settings) {
      config.register(settings);
    };

    this.$get = function() {
      return config;
    };
  })

  .provider('$ionicCloud', ['$ionicCloudConfigProvider', function($ionicCloudConfigProvider) {
    this.init = function(value) {
      $ionicCloudConfigProvider.register(value);
    };

    this.$get = [function() {
      return Ionic.core;
    }];
  }])

  .factory('$ionicCloudClient', [function() {
    return Ionic.client;
  }])

  .factory('$ionicUser', [function() {
    return Ionic.singleUserService.current();
  }])

  .factory('$ionicAuth', [function() {
    return Ionic.auth;
  }])

  .factory('$ionicPush', [function() {
    return Ionic.push;
  }])

  .factory('$ionicDeploy', [function() {
    return Ionic.deploy;
  }])

  .run(['$window', '$q', '$rootScope', function($window, $q, $rootScope) {
    if (typeof $window.Promise === 'undefined') {
      $window.Promise = $q;
    } else {
      var init = Ionic.Cloud.DeferredPromise.prototype.init;

      Ionic.Cloud.DeferredPromise.prototype.init = function() {
        init.apply(this, arguments);
        this.promise = $q.when(this.promise);
      };
    }

    var emit = Ionic.Cloud.EventEmitter.prototype.emit;

    Ionic.Cloud.EventEmitter.prototype.emit = function(name, data) {
      $rootScope.$broadcast('cloud:' + name, data);
      return emit.apply(this, arguments);
    };
  }]);

}

},{}],27:[function(require,module,exports){
var Core = require("./../dist/es5/core").Core;
var DataType = require("./../dist/es5/user/data-types").DataType;
var Deploy = require("./../dist/es5/deploy/deploy").Deploy;
var EventEmitter = require("./../dist/es5/events").EventEmitter;
var Logger = require("./../dist/es5/logger").Logger;
var Push = require("./../dist/es5/push/push").Push;
var PushMessage = require("./../dist/es5/push/message").PushMessage;
var auth = require("./../dist/es5/auth");
var client = require("./../dist/es5/client");
var config = require("./../dist/es5/config");
var cordova = require("./../dist/es5/cordova");
var device = require("./../dist/es5/device");
var di = require("./../dist/es5/di");
var promise = require("./../dist/es5/promise");
var storage = require("./../dist/es5/storage");
var user = require("./../dist/es5/user/user");

// Declare the window object
window.Ionic = new di.Container();

// Ionic Modules
Ionic.Core = Core;
Ionic.User = user.User;
Ionic.Auth = auth.Auth;
Ionic.Deploy = Deploy;
Ionic.Push = Push;
Ionic.PushMessage = PushMessage;

// DataType Namespace
Ionic.DataType = DataType;
Ionic.DataTypes = DataType.getMapping();

// Cloud Namespace
Ionic.Cloud = {};
Ionic.Cloud.AuthType = auth.AuthType;
Ionic.Cloud.AuthTypes = {};
Ionic.Cloud.AuthTypes.BasicAuth = auth.BasicAuth;
Ionic.Cloud.AuthTypes.CustomAuth = auth.CustomAuth;
Ionic.Cloud.AuthTypes.TwitterAuth = auth.TwitterAuth;
Ionic.Cloud.AuthTypes.FacebookAuth = auth.FacebookAuth;
Ionic.Cloud.AuthTypes.GithubAuth = auth.GithubAuth;
Ionic.Cloud.AuthTypes.GoogleAuth = auth.GoogleAuth;
Ionic.Cloud.AuthTypes.InstagramAuth = auth.InstagramAuth;
Ionic.Cloud.AuthTypes.LinkedInAuth = auth.LinkedInAuth;
Ionic.Cloud.Cordova = cordova.Cordova;
Ionic.Cloud.Client = client.Client;
Ionic.Cloud.Device = device.Device;
Ionic.Cloud.EventEmitter = EventEmitter;
Ionic.Cloud.Logger = Logger;
Ionic.Cloud.DeferredPromise = promise.DeferredPromise;
Ionic.Cloud.Storage = storage.Storage;
Ionic.Cloud.UserContext = user.UserContext;
Ionic.Cloud.SingleUserService = user.SingleUserService;
Ionic.Cloud.AuthTokenContext = auth.AuthTokenContext;
Ionic.Cloud.CombinedAuthTokenContext = auth.CombinedAuthTokenContext;
Ionic.Cloud.LocalStorageStrategy = storage.LocalStorageStrategy;
Ionic.Cloud.SessionStorageStrategy = storage.SessionStorageStrategy;
Ionic.Cloud.Config = config.Config;

},{"./../dist/es5/auth":1,"./../dist/es5/client":2,"./../dist/es5/config":3,"./../dist/es5/cordova":4,"./../dist/es5/core":5,"./../dist/es5/deploy/deploy":6,"./../dist/es5/device":7,"./../dist/es5/di":8,"./../dist/es5/events":10,"./../dist/es5/logger":13,"./../dist/es5/promise":14,"./../dist/es5/push/message":15,"./../dist/es5/push/push":16,"./../dist/es5/storage":17,"./../dist/es5/user/data-types":18,"./../dist/es5/user/user":19}]},{},[27,26,11])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkaXN0L2VzNS9hdXRoLmpzIiwiZGlzdC9lczUvY2xpZW50LmpzIiwiZGlzdC9lczUvY29uZmlnLmpzIiwiZGlzdC9lczUvY29yZG92YS5qcyIsImRpc3QvZXM1L2NvcmUuanMiLCJkaXN0L2VzNS9kZXBsb3kvZGVwbG95LmpzIiwiZGlzdC9lczUvZGV2aWNlLmpzIiwiZGlzdC9lczUvZGkuanMiLCJkaXN0L2VzNS9lcnJvcnMuanMiLCJkaXN0L2VzNS9ldmVudHMuanMiLCJkaXN0L2VzNS9pbmRleC5qcyIsImRpc3QvZXM1L2luc2lnaHRzLmpzIiwiZGlzdC9lczUvbG9nZ2VyLmpzIiwiZGlzdC9lczUvcHJvbWlzZS5qcyIsImRpc3QvZXM1L3B1c2gvbWVzc2FnZS5qcyIsImRpc3QvZXM1L3B1c2gvcHVzaC5qcyIsImRpc3QvZXM1L3N0b3JhZ2UuanMiLCJkaXN0L2VzNS91c2VyL2RhdGEtdHlwZXMuanMiLCJkaXN0L2VzNS91c2VyL3VzZXIuanMiLCJub2RlX21vZHVsZXMvY29tcG9uZW50LWVtaXR0ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcmVkdWNlLWNvbXBvbmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zdXBlcmFnZW50L2xpYi9jbGllbnQuanMiLCJub2RlX21vZHVsZXMvc3VwZXJhZ2VudC9saWIvaXMtb2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL3N1cGVyYWdlbnQvbGliL3JlcXVlc3QtYmFzZS5qcyIsIm5vZGVfbW9kdWxlcy9zdXBlcmFnZW50L2xpYi9yZXF1ZXN0LmpzIiwic3JjL2FuZ3VsYXIuanMiLCJzcmMvZXM1LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcmlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBfX2V4dGVuZHMgPSAodGhpcyAmJiB0aGlzLl9fZXh0ZW5kcykgfHwgZnVuY3Rpb24gKGQsIGIpIHtcbiAgICBmb3IgKHZhciBwIGluIGIpIGlmIChiLmhhc093blByb3BlcnR5KHApKSBkW3BdID0gYltwXTtcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XG59O1xudmFyIGVycm9yc18xID0gcmVxdWlyZSgnLi9lcnJvcnMnKTtcbnZhciBwcm9taXNlXzEgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgQXV0aFRva2VuQ29udGV4dCA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gQXV0aFRva2VuQ29udGV4dChkZXBzLCBsYWJlbCkge1xuICAgICAgICB0aGlzLmxhYmVsID0gbGFiZWw7XG4gICAgICAgIHRoaXMuc3RvcmFnZSA9IGRlcHMuc3RvcmFnZTtcbiAgICB9XG4gICAgQXV0aFRva2VuQ29udGV4dC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdG9yYWdlLmdldCh0aGlzLmxhYmVsKTtcbiAgICB9O1xuICAgIEF1dGhUb2tlbkNvbnRleHQucHJvdG90eXBlLnN0b3JlID0gZnVuY3Rpb24gKHRva2VuKSB7XG4gICAgICAgIHRoaXMuc3RvcmFnZS5zZXQodGhpcy5sYWJlbCwgdG9rZW4pO1xuICAgIH07XG4gICAgQXV0aFRva2VuQ29udGV4dC5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0b3JhZ2UuZGVsZXRlKHRoaXMubGFiZWwpO1xuICAgIH07XG4gICAgcmV0dXJuIEF1dGhUb2tlbkNvbnRleHQ7XG59KCkpO1xuZXhwb3J0cy5BdXRoVG9rZW5Db250ZXh0ID0gQXV0aFRva2VuQ29udGV4dDtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgQ29tYmluZWRBdXRoVG9rZW5Db250ZXh0ID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBDb21iaW5lZEF1dGhUb2tlbkNvbnRleHQoZGVwcywgbGFiZWwpIHtcbiAgICAgICAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAgICAgICB0aGlzLnN0b3JhZ2UgPSBkZXBzLnN0b3JhZ2U7XG4gICAgICAgIHRoaXMudGVtcFN0b3JhZ2UgPSBkZXBzLnRlbXBTdG9yYWdlO1xuICAgIH1cbiAgICBDb21iaW5lZEF1dGhUb2tlbkNvbnRleHQucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHBlcm1Ub2tlbiA9IHRoaXMuc3RvcmFnZS5nZXQodGhpcy5sYWJlbCk7XG4gICAgICAgIHZhciB0ZW1wVG9rZW4gPSB0aGlzLnRlbXBTdG9yYWdlLmdldCh0aGlzLmxhYmVsKTtcbiAgICAgICAgdmFyIHRva2VuID0gdGVtcFRva2VuIHx8IHBlcm1Ub2tlbjtcbiAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH07XG4gICAgQ29tYmluZWRBdXRoVG9rZW5Db250ZXh0LnByb3RvdHlwZS5zdG9yZSA9IGZ1bmN0aW9uICh0b2tlbiwgb3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7ICdwZXJtYW5lbnQnOiB0cnVlIH07IH1cbiAgICAgICAgaWYgKG9wdGlvbnMucGVybWFuZW50KSB7XG4gICAgICAgICAgICB0aGlzLnN0b3JhZ2Uuc2V0KHRoaXMubGFiZWwsIHRva2VuKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudGVtcFN0b3JhZ2Uuc2V0KHRoaXMubGFiZWwsIHRva2VuKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgQ29tYmluZWRBdXRoVG9rZW5Db250ZXh0LnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RvcmFnZS5kZWxldGUodGhpcy5sYWJlbCk7XG4gICAgICAgIHRoaXMudGVtcFN0b3JhZ2UuZGVsZXRlKHRoaXMubGFiZWwpO1xuICAgIH07XG4gICAgcmV0dXJuIENvbWJpbmVkQXV0aFRva2VuQ29udGV4dDtcbn0oKSk7XG5leHBvcnRzLkNvbWJpbmVkQXV0aFRva2VuQ29udGV4dCA9IENvbWJpbmVkQXV0aFRva2VuQ29udGV4dDtcbi8qKlxuICogYEF1dGhgIGhhbmRsZXMgYXV0aGVudGljYXRpb24gb2YgYSBzaW5nbGUgdXNlciwgc3VjaCBhcyBzaWduaW5nIHVwLCBsb2dnaW5nXG4gKiBpbiAmIG91dCwgc29jaWFsIHByb3ZpZGVyIGF1dGhlbnRpY2F0aW9uLCBldGMuXG4gKlxuICogQGZlYXR1cmVkXG4gKi9cbnZhciBBdXRoID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBBdXRoKGRlcHMsIFxuICAgICAgICAvKipcbiAgICAgICAgICogQGhpZGRlblxuICAgICAgICAgKi9cbiAgICAgICAgb3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGRlcHMuY29uZmlnO1xuICAgICAgICB0aGlzLmVtaXR0ZXIgPSBkZXBzLmVtaXR0ZXI7XG4gICAgICAgIHRoaXMuYXV0aE1vZHVsZXMgPSBkZXBzLmF1dGhNb2R1bGVzO1xuICAgICAgICB0aGlzLnRva2VuQ29udGV4dCA9IGRlcHMudG9rZW5Db250ZXh0O1xuICAgICAgICB0aGlzLnVzZXJTZXJ2aWNlID0gZGVwcy51c2VyU2VydmljZTtcbiAgICAgICAgdGhpcy5zdG9yYWdlID0gZGVwcy5zdG9yYWdlO1xuICAgIH1cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQXV0aC5wcm90b3R5cGUsIFwicGFzc3dvcmRSZXNldFVybFwiLCB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaW5rIHRoZSB1c2VyIHRvIHRoaXMgVVJMIGZvciBwYXNzd29yZCByZXNldHMuIE9ubHkgZm9yIGVtYWlsL3Bhc3N3b3JkXG4gICAgICAgICAqIGF1dGhlbnRpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBVc2UgdGhpcyBpZiB5b3Ugd2FudCB0byB1c2Ugb3VyIHBhc3N3b3JkIHJlc2V0IGZvcm1zIGluc3RlYWQgb2YgY3JlYXRpbmdcbiAgICAgICAgICogeW91ciBvd24gaW4geW91ciBhcHAuXG4gICAgICAgICAqL1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmZpZy5nZXRVUkwoJ3dlYicpICsgXCIvcGFzc3dvcmQvcmVzZXQvXCIgKyB0aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICAvKipcbiAgICAgKiBDaGVjayB3aGV0aGVyIHRoZSB1c2VyIGlzIGxvZ2dlZCBpbiBvciBub3QuXG4gICAgICpcbiAgICAgKiBJZiBhbiBhdXRoIHRva2VuIGV4aXN0cyBpbiBsb2NhbCBzdG9yYWdlLCB0aGUgdXNlciBpcyBsb2dnZWQgaW4uXG4gICAgICovXG4gICAgQXV0aC5wcm90b3R5cGUuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdG9rZW4gPSB0aGlzLnRva2VuQ29udGV4dC5nZXQoKTtcbiAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBTaWduIHVwIGEgdXNlciB3aXRoIHRoZSBnaXZlbiBkYXRhLiBPbmx5IGZvciBlbWFpbC9wYXNzd29yZFxuICAgICAqIGF1dGhlbnRpY2F0aW9uLlxuICAgICAqXG4gICAgICogYHNpZ251cGAgZG9lcyBub3QgYWZmZWN0IGxvY2FsIGRhdGEgb3IgdGhlIGN1cnJlbnQgdXNlciB1bnRpbCBgbG9naW5gIGlzXG4gICAgICogY2FsbGVkLiBUaGlzIG1lYW5zIHlvdSdsbCBsaWtlbHkgd2FudCB0byBsb2cgaW4geW91ciB1c2VycyBtYW51YWxseSBhZnRlclxuICAgICAqIHNpZ251cC5cbiAgICAgKlxuICAgICAqIElmIGEgc2lnbnVwIGZhaWxzLCB0aGUgcHJvbWlzZSByZWplY3RzIHdpdGggYSBbYElEZXRhaWxlZEVycm9yYFxuICAgICAqIG9iamVjdF0oL2FwaS9jbGllbnQvaWRldGFpbGVkZXJyb3IpIHRoYXQgY29udGFpbnMgYW4gYXJyYXkgb2YgZXJyb3IgY29kZXNcbiAgICAgKiBmcm9tIHRoZSBjbG91ZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBkZXRhaWxzIC0gVGhlIGRldGFpbHMgdGhhdCBkZXNjcmliZSBhIHVzZXIuXG4gICAgICovXG4gICAgQXV0aC5wcm90b3R5cGUuc2lnbnVwID0gZnVuY3Rpb24gKGRldGFpbHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXV0aE1vZHVsZXMuYmFzaWMuc2lnbnVwKGRldGFpbHMpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogQXR0ZW1wdCB0byBsb2cgdGhlIHVzZXIgaW4gd2l0aCB0aGUgZ2l2ZW4gY3JlZGVudGlhbHMuIEZvciBjdXN0b20gJiBzb2NpYWxcbiAgICAgKiBsb2dpbnMsIGtpY2stb2ZmIHRoZSBhdXRoZW50aWNhdGlvbiBwcm9jZXNzLlxuICAgICAqXG4gICAgICogQWZ0ZXIgbG9naW4sIHRoZSBmdWxsIHVzZXIgaXMgbG9hZGVkIGZyb20gdGhlIGNsb3VkIGFuZCBzYXZlZCBpbiBsb2NhbFxuICAgICAqIHN0b3JhZ2UgYWxvbmcgd2l0aCB0aGVpciBhdXRoIHRva2VuLlxuICAgICAqXG4gICAgICogQG5vdGUgVE9ETzogQmV0dGVyIGVycm9yIGhhbmRsaW5nIGRvY3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbW9kdWxlSWRcbiAgICAgKiAgVGhlIGF1dGhlbnRpY2F0aW9uIHByb3ZpZGVyIG1vZHVsZSBJRCB0byB1c2Ugd2l0aCB0aGlzIGxvZ2luLlxuICAgICAqIEBwYXJhbSBjcmVkZW50aWFsc1xuICAgICAqICBGb3IgZW1haWwvcGFzc3dvcmQgYXV0aGVudGljYXRpb24sIGdpdmUgYW4gZW1haWwgYW5kIHBhc3N3b3JkLiBGb3Igc29jaWFsXG4gICAgICogIGF1dGhlbnRpY2F0aW9uLCBleGNsdWRlIHRoaXMgcGFyYW1ldGVyLiBGb3IgY3VzdG9tIGF1dGhlbnRpY2F0aW9uLCBzZW5kXG4gICAgICogIHdoYXRldmVyIHlvdSBuZWVkLlxuICAgICAqIEBwYXJhbSBvcHRpb25zXG4gICAgICogIE9wdGlvbnMgZm9yIHRoaXMgbG9naW4sIHN1Y2ggYXMgd2hldGhlciB0byByZW1lbWJlciB0aGUgbG9naW4gYW5kXG4gICAgICogIEluQXBwQnJvd3NlciB3aW5kb3cgb3B0aW9ucyBmb3IgYXV0aGVudGljYXRpb24gcHJvdmlkZXJzIHRoYXQgbWFrZSB1c2Ugb2ZcbiAgICAgKiAgaXQuXG4gICAgICovXG4gICAgQXV0aC5wcm90b3R5cGUubG9naW4gPSBmdW5jdGlvbiAobW9kdWxlSWQsIGNyZWRlbnRpYWxzLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5yZW1lbWJlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMucmVtZW1iZXIgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5pbkFwcEJyb3dzZXJPcHRpb25zID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb3B0aW9ucy5pbkFwcEJyb3dzZXJPcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmluQXBwQnJvd3Nlck9wdGlvbnMubG9jYXRpb24gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvcHRpb25zLmluQXBwQnJvd3Nlck9wdGlvbnMubG9jYXRpb24gPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuaW5BcHBCcm93c2VyT3B0aW9ucy5jbGVhcmNhY2hlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb3B0aW9ucy5pbkFwcEJyb3dzZXJPcHRpb25zLmNsZWFyY2FjaGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5pbkFwcEJyb3dzZXJPcHRpb25zLmNsZWFyc2Vzc2lvbmNhY2hlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb3B0aW9ucy5pbkFwcEJyb3dzZXJPcHRpb25zLmNsZWFyc2Vzc2lvbmNhY2hlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXMuYXV0aE1vZHVsZXNbbW9kdWxlSWRdO1xuICAgICAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQXV0aGVudGljYXRpb24gY2xhc3MgaXMgaW52YWxpZCBvciBtaXNzaW5nOicgKyBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGV4dC5hdXRoZW50aWNhdGUoY3JlZGVudGlhbHMsIG9wdGlvbnMpLnRoZW4oZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgIF90aGlzLnN0b3JlVG9rZW4ob3B0aW9ucywgci50b2tlbik7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMudXNlclNlcnZpY2UubG9hZCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciB1c2VyID0gX3RoaXMudXNlclNlcnZpY2UuY3VycmVudCgpO1xuICAgICAgICAgICAgICAgIHVzZXIuc3RvcmUoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIExvZyB0aGUgdXNlciBvdXQgb2YgdGhlIGFwcC5cbiAgICAgKlxuICAgICAqIFRoaXMgY2xlYXJzIHRoZSBhdXRoIHRva2VuIG91dCBvZiBsb2NhbCBzdG9yYWdlIGFuZCByZXN0b3JlcyB0aGUgdXNlciB0b1xuICAgICAqIGFuIHVuYXV0aGVudGljYXRlZCBzdGF0ZS5cbiAgICAgKi9cbiAgICBBdXRoLnByb3RvdHlwZS5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMudG9rZW5Db250ZXh0LmRlbGV0ZSgpO1xuICAgICAgICB2YXIgdXNlciA9IHRoaXMudXNlclNlcnZpY2UuY3VycmVudCgpO1xuICAgICAgICB1c2VyLnVuc3RvcmUoKTtcbiAgICAgICAgdXNlci5jbGVhcigpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogS2ljay1vZmYgdGhlIHBhc3N3b3JkIHJlc2V0IHByb2Nlc3MuIE9ubHkgZm9yIGVtYWlsL3Bhc3N3b3JkXG4gICAgICogYXV0aGVudGljYXRpb24uXG4gICAgICpcbiAgICAgKiBBbiBlbWFpbCB3aWxsIGJlIHNlbnQgdG8gdGhlIHVzZXIgd2l0aCBhIHNob3J0IHBhc3N3b3JkIHJlc2V0IGNvZGUsIHdoaWNoXG4gICAgICogdGhleSBjYW4gY29weSBiYWNrIGludG8geW91ciBhcHAgYW5kIHVzZSB0aGUgW2Bjb25maXJtUGFzc3dvcmRSZXNldCgpYFxuICAgICAqIG1ldGhvZF0oI2NvbmZpcm1QYXNzd29yZFJlc2V0KS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBlbWFpbCAtIFRoZSBlbWFpbCBhZGRyZXNzIHRvIHdoaWNoIHRvIHNlbmQgYSBjb2RlLlxuICAgICAqL1xuICAgIEF1dGgucHJvdG90eXBlLnJlcXVlc3RQYXNzd29yZFJlc2V0ID0gZnVuY3Rpb24gKGVtYWlsKSB7XG4gICAgICAgIHRoaXMuc3RvcmFnZS5zZXQoJ2F1dGhfcGFzc3dvcmRfcmVzZXRfZW1haWwnLCBlbWFpbCk7XG4gICAgICAgIHJldHVybiB0aGlzLmF1dGhNb2R1bGVzLmJhc2ljLnJlcXVlc3RQYXNzd29yZFJlc2V0KGVtYWlsKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIENvbmZpcm0gYSBwYXNzd29yZCByZXNldC5cbiAgICAgKlxuICAgICAqIFdoZW4gdGhlIHVzZXIgZ2l2ZXMgeW91IHRoZWlyIHBhc3N3b3JkIHJlc2V0IGNvZGUgaW50byB5b3VyIGFwcCBhbmQgdGhlaXJcbiAgICAgKiByZXF1ZXN0ZWQgY2hhbmdlZCBwYXNzd29yZCwgY2FsbCB0aGlzIG1ldGhvZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBjb2RlIC0gVGhlIHBhc3N3b3JkIHJlc2V0IGNvZGUgZnJvbSB0aGUgdXNlci5cbiAgICAgKiBAcGFyYW0gbmV3UGFzc3dvcmQgLSBUaGUgcmVxdWVzdGVkIGNoYW5nZWQgcGFzc3dvcmQgZnJvbSB0aGUgdXNlci5cbiAgICAgKi9cbiAgICBBdXRoLnByb3RvdHlwZS5jb25maXJtUGFzc3dvcmRSZXNldCA9IGZ1bmN0aW9uIChjb2RlLCBuZXdQYXNzd29yZCkge1xuICAgICAgICB2YXIgZW1haWwgPSB0aGlzLnN0b3JhZ2UuZ2V0KCdhdXRoX3Bhc3N3b3JkX3Jlc2V0X2VtYWlsJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmF1dGhNb2R1bGVzLmJhc2ljLmNvbmZpcm1QYXNzd29yZFJlc2V0KGVtYWlsLCBjb2RlLCBuZXdQYXNzd29yZCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHJhdyBhdXRoIHRva2VuIG9mIHRoZSBhY3RpdmUgdXNlciBmcm9tIGxvY2FsIHN0b3JhZ2UuXG4gICAgICovXG4gICAgQXV0aC5wcm90b3R5cGUuZ2V0VG9rZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRva2VuQ29udGV4dC5nZXQoKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBoaWRkZW5cbiAgICAgKi9cbiAgICBBdXRoLnByb3RvdHlwZS5zdG9yZVRva2VuID0gZnVuY3Rpb24gKG9wdGlvbnMsIHRva2VuKSB7XG4gICAgICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHsgJ3JlbWVtYmVyJzogdHJ1ZSB9OyB9XG4gICAgICAgIHZhciBvcmlnaW5hbFRva2VuID0gdGhpcy5hdXRoVG9rZW47XG4gICAgICAgIHRoaXMuYXV0aFRva2VuID0gdG9rZW47XG4gICAgICAgIHRoaXMudG9rZW5Db250ZXh0LnN0b3JlKHRoaXMuYXV0aFRva2VuLCB7ICdwZXJtYW5lbnQnOiBvcHRpb25zLnJlbWVtYmVyIH0pO1xuICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnYXV0aDp0b2tlbi1jaGFuZ2VkJywgeyAnb2xkJzogb3JpZ2luYWxUb2tlbiwgJ25ldyc6IHRoaXMuYXV0aFRva2VuIH0pO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogQGhpZGRlblxuICAgICAqL1xuICAgIEF1dGguZ2V0RGV0YWlsZWRFcnJvckZyb21SZXNwb25zZSA9IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICB2YXIgZGV0YWlscyA9IFtdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZGV0YWlscyA9IHJlcy5ib2R5LmVycm9yLmRldGFpbHM7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHsgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRldGFpbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBkZXRhaWwgPSBkZXRhaWxzW2ldO1xuICAgICAgICAgICAgaWYgKGRldGFpbC5lcnJvcl90eXBlKSB7XG4gICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZGV0YWlsLmVycm9yX3R5cGUgKyAnXycgKyBkZXRhaWwucGFyYW1ldGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IGVycm9yc18xLkRldGFpbGVkRXJyb3IoJ0Vycm9yIGNyZWF0aW5nIHVzZXInLCBlcnJvcnMpO1xuICAgIH07XG4gICAgcmV0dXJuIEF1dGg7XG59KCkpO1xuZXhwb3J0cy5BdXRoID0gQXV0aDtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgQXV0aFR5cGUgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEF1dGhUeXBlKGRlcHMpIHtcbiAgICAgICAgdGhpcy5jb25maWcgPSBkZXBzLmNvbmZpZztcbiAgICAgICAgdGhpcy5jbGllbnQgPSBkZXBzLmNsaWVudDtcbiAgICB9XG4gICAgQXV0aFR5cGUucHJvdG90eXBlLnBhcnNlSW5BcHBCcm93c2VyT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGlmICghb3B0cykge1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgICAgIHZhciBwID0gW107XG4gICAgICAgIGZvciAodmFyIGsgaW4gb3B0cykge1xuICAgICAgICAgICAgdmFyIHYgPSB2b2lkIDA7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG9wdHNba10gPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgIHYgPSBvcHRzW2tdID8gJ3llcycgOiAnbm8nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdiA9IG9wdHNba107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwLnB1c2goayArIFwiPVwiICsgdik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHAuam9pbignLCcpO1xuICAgIH07XG4gICAgQXV0aFR5cGUucHJvdG90eXBlLmluQXBwQnJvd3NlckZsb3cgPSBmdW5jdGlvbiAobW9kdWxlSWQsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKGRhdGEgPT09IHZvaWQgMCkgeyBkYXRhID0ge307IH1cbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTtcbiAgICAgICAgaWYgKCF3aW5kb3cgfHwgIXdpbmRvdy5jb3Jkb3ZhIHx8ICF3aW5kb3cuY29yZG92YS5JbkFwcEJyb3dzZXIpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ0luQXBwQnJvd3NlciBwbHVnaW4gbWlzc2luZycpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LnBvc3QoXCIvYXV0aC9sb2dpbi9cIiArIG1vZHVsZUlkKVxuICAgICAgICAgICAgICAgIC5zZW5kKHtcbiAgICAgICAgICAgICAgICAnYXBwX2lkJzogdGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKSxcbiAgICAgICAgICAgICAgICAnY2FsbGJhY2snOiB3aW5kb3cubG9jYXRpb24uaHJlZixcbiAgICAgICAgICAgICAgICAnZGF0YSc6IGRhdGFcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmVuZChmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHdfMSA9IHdpbmRvdy5jb3Jkb3ZhLkluQXBwQnJvd3Nlci5vcGVuKHJlcy5ib2R5LmRhdGEudXJsLCAnX2JsYW5rJywgX3RoaXMucGFyc2VJbkFwcEJyb3dzZXJPcHRpb25zKG9wdGlvbnMuaW5BcHBCcm93c2VyT3B0aW9ucykpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgb25FeGl0XzEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKCdJbkFwcEJyb3dzZXIgZXhpdCcpKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9uTG9hZEVycm9yXzEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKCdJbkFwcEJyb3dzZXIgbG9hZGVycm9yJykpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgb25Mb2FkU3RhcnQgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEudXJsLnNsaWNlKDAsIDIwKSA9PT0gJ2h0dHA6Ly9hdXRoLmlvbmljLmlvJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBxdWVyeVN0cmluZyA9IGRhdGEudXJsLnNwbGl0KCcjJylbMF0uc3BsaXQoJz8nKVsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcGFyYW1QYXJ0cyA9IHF1ZXJ5U3RyaW5nLnNwbGl0KCcmJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFyYW1QYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcGFydCA9IHBhcmFtUGFydHNbaV0uc3BsaXQoJz0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zW3BhcnRbMF1dID0gcGFydFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd18xLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2V4aXQnLCBvbkV4aXRfMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd18xLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlcnJvcicsIG9uTG9hZEVycm9yXzEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdfMS5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndG9rZW4nOiBwYXJhbXNbJ3Rva2VuJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzaWdudXAnOiBCb29sZWFuKHBhcnNlSW50KHBhcmFtc1snc2lnbnVwJ10sIDEwKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgd18xLmFkZEV2ZW50TGlzdGVuZXIoJ2V4aXQnLCBvbkV4aXRfMSk7XG4gICAgICAgICAgICAgICAgICAgIHdfMS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZXJyb3InLCBvbkxvYWRFcnJvcl8xKTtcbiAgICAgICAgICAgICAgICAgICAgd18xLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRzdGFydCcsIG9uTG9hZFN0YXJ0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuICAgIHJldHVybiBBdXRoVHlwZTtcbn0oKSk7XG5leHBvcnRzLkF1dGhUeXBlID0gQXV0aFR5cGU7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIEJhc2ljQXV0aCA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKEJhc2ljQXV0aCwgX3N1cGVyKTtcbiAgICBmdW5jdGlvbiBCYXNpY0F1dGgoKSB7XG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICBCYXNpY0F1dGgucHJvdG90eXBlLmF1dGhlbnRpY2F0ZSA9IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBwcm9taXNlXzEuRGVmZXJyZWRQcm9taXNlKCk7XG4gICAgICAgIGlmICghZGF0YS5lbWFpbCB8fCAhZGF0YS5wYXNzd29yZCkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcignZW1haWwgYW5kIHBhc3N3b3JkIGFyZSByZXF1aXJlZCBmb3IgYmFzaWMgYXV0aGVudGljYXRpb24nKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5wb3N0KCcvYXV0aC9sb2dpbicpXG4gICAgICAgICAgICAgICAgLnNlbmQoe1xuICAgICAgICAgICAgICAgICdhcHBfaWQnOiB0aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpLFxuICAgICAgICAgICAgICAgICdlbWFpbCc6IGRhdGEuZW1haWwsXG4gICAgICAgICAgICAgICAgJ3Bhc3N3b3JkJzogZGF0YS5wYXNzd29yZFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZW5kKGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICd0b2tlbic6IHJlcy5ib2R5LmRhdGEudG9rZW5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICBCYXNpY0F1dGgucHJvdG90eXBlLnJlcXVlc3RQYXNzd29yZFJlc2V0ID0gZnVuY3Rpb24gKGVtYWlsKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBwcm9taXNlXzEuRGVmZXJyZWRQcm9taXNlKCk7XG4gICAgICAgIGlmICghZW1haWwpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ0VtYWlsIGlzIHJlcXVpcmVkIGZvciBwYXNzd29yZCByZXNldCByZXF1ZXN0LicpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LnBvc3QoJy91c2Vycy9wYXNzd29yZC9yZXNldCcpXG4gICAgICAgICAgICAgICAgLnNlbmQoe1xuICAgICAgICAgICAgICAgICdhcHBfaWQnOiB0aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpLFxuICAgICAgICAgICAgICAgICdlbWFpbCc6IGVtYWlsLFxuICAgICAgICAgICAgICAgICdmbG93JzogJ2FwcCdcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmVuZChmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG4gICAgQmFzaWNBdXRoLnByb3RvdHlwZS5jb25maXJtUGFzc3dvcmRSZXNldCA9IGZ1bmN0aW9uIChlbWFpbCwgY29kZSwgbmV3UGFzc3dvcmQpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTtcbiAgICAgICAgaWYgKCFjb2RlIHx8ICFlbWFpbCB8fCAhbmV3UGFzc3dvcmQpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ0NvZGUsIG5ldyBwYXNzd29yZCwgYW5kIGVtYWlsIGFyZSByZXF1aXJlZC4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5wb3N0KCcvdXNlcnMvcGFzc3dvcmQnKVxuICAgICAgICAgICAgICAgIC5zZW5kKHtcbiAgICAgICAgICAgICAgICAncmVzZXRfdG9rZW4nOiBjb2RlLFxuICAgICAgICAgICAgICAgICduZXdfcGFzc3dvcmQnOiBuZXdQYXNzd29yZCxcbiAgICAgICAgICAgICAgICAnZW1haWwnOiBlbWFpbFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZW5kKGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICBCYXNpY0F1dGgucHJvdG90eXBlLnNpZ251cCA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBwcm9taXNlXzEuRGVmZXJyZWRQcm9taXNlKCk7XG4gICAgICAgIHZhciB1c2VyRGF0YSA9IHtcbiAgICAgICAgICAgICdhcHBfaWQnOiB0aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpLFxuICAgICAgICAgICAgJ2VtYWlsJzogZGF0YS5lbWFpbCxcbiAgICAgICAgICAgICdwYXNzd29yZCc6IGRhdGEucGFzc3dvcmRcbiAgICAgICAgfTtcbiAgICAgICAgLy8gb3B0aW9uYWwgZGV0YWlsc1xuICAgICAgICBpZiAoZGF0YS51c2VybmFtZSkge1xuICAgICAgICAgICAgdXNlckRhdGEudXNlcm5hbWUgPSBkYXRhLnVzZXJuYW1lO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhLmltYWdlKSB7XG4gICAgICAgICAgICB1c2VyRGF0YS5pbWFnZSA9IGRhdGEuaW1hZ2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEubmFtZSkge1xuICAgICAgICAgICAgdXNlckRhdGEubmFtZSA9IGRhdGEubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5jdXN0b20pIHtcbiAgICAgICAgICAgIHVzZXJEYXRhLmN1c3RvbSA9IGRhdGEuY3VzdG9tO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2xpZW50LnBvc3QoJy91c2VycycpXG4gICAgICAgICAgICAuc2VuZCh1c2VyRGF0YSlcbiAgICAgICAgICAgIC5lbmQoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KEF1dGguZ2V0RGV0YWlsZWRFcnJvckZyb21SZXNwb25zZShlcnIucmVzcG9uc2UpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG4gICAgcmV0dXJuIEJhc2ljQXV0aDtcbn0oQXV0aFR5cGUpKTtcbmV4cG9ydHMuQmFzaWNBdXRoID0gQmFzaWNBdXRoO1xuLyoqXG4gKiBAaGlkZGVuXG4gKi9cbnZhciBDdXN0b21BdXRoID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoQ3VzdG9tQXV0aCwgX3N1cGVyKTtcbiAgICBmdW5jdGlvbiBDdXN0b21BdXRoKCkge1xuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgQ3VzdG9tQXV0aC5wcm90b3R5cGUuYXV0aGVudGljYXRlID0gZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGRhdGEgPT09IHZvaWQgMCkgeyBkYXRhID0ge307IH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5BcHBCcm93c2VyRmxvdygnY3VzdG9tJywgZGF0YSwgb3B0aW9ucyk7XG4gICAgfTtcbiAgICByZXR1cm4gQ3VzdG9tQXV0aDtcbn0oQXV0aFR5cGUpKTtcbmV4cG9ydHMuQ3VzdG9tQXV0aCA9IEN1c3RvbUF1dGg7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIFR3aXR0ZXJBdXRoID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoVHdpdHRlckF1dGgsIF9zdXBlcik7XG4gICAgZnVuY3Rpb24gVHdpdHRlckF1dGgoKSB7XG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICBUd2l0dGVyQXV0aC5wcm90b3R5cGUuYXV0aGVudGljYXRlID0gZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGRhdGEgPT09IHZvaWQgMCkgeyBkYXRhID0ge307IH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5BcHBCcm93c2VyRmxvdygndHdpdHRlcicsIGRhdGEsIG9wdGlvbnMpO1xuICAgIH07XG4gICAgcmV0dXJuIFR3aXR0ZXJBdXRoO1xufShBdXRoVHlwZSkpO1xuZXhwb3J0cy5Ud2l0dGVyQXV0aCA9IFR3aXR0ZXJBdXRoO1xuLyoqXG4gKiBAaGlkZGVuXG4gKi9cbnZhciBGYWNlYm9va0F1dGggPSAoZnVuY3Rpb24gKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhGYWNlYm9va0F1dGgsIF9zdXBlcik7XG4gICAgZnVuY3Rpb24gRmFjZWJvb2tBdXRoKCkge1xuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgRmFjZWJvb2tBdXRoLnByb3RvdHlwZS5hdXRoZW50aWNhdGUgPSBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoZGF0YSA9PT0gdm9pZCAwKSB7IGRhdGEgPSB7fTsgfVxuICAgICAgICByZXR1cm4gdGhpcy5pbkFwcEJyb3dzZXJGbG93KCdmYWNlYm9vaycsIGRhdGEsIG9wdGlvbnMpO1xuICAgIH07XG4gICAgcmV0dXJuIEZhY2Vib29rQXV0aDtcbn0oQXV0aFR5cGUpKTtcbmV4cG9ydHMuRmFjZWJvb2tBdXRoID0gRmFjZWJvb2tBdXRoO1xuLyoqXG4gKiBAaGlkZGVuXG4gKi9cbnZhciBHaXRodWJBdXRoID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoR2l0aHViQXV0aCwgX3N1cGVyKTtcbiAgICBmdW5jdGlvbiBHaXRodWJBdXRoKCkge1xuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgR2l0aHViQXV0aC5wcm90b3R5cGUuYXV0aGVudGljYXRlID0gZnVuY3Rpb24gKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKGRhdGEgPT09IHZvaWQgMCkgeyBkYXRhID0ge307IH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5BcHBCcm93c2VyRmxvdygnZ2l0aHViJywgZGF0YSwgb3B0aW9ucyk7XG4gICAgfTtcbiAgICByZXR1cm4gR2l0aHViQXV0aDtcbn0oQXV0aFR5cGUpKTtcbmV4cG9ydHMuR2l0aHViQXV0aCA9IEdpdGh1YkF1dGg7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIEdvb2dsZUF1dGggPSAoZnVuY3Rpb24gKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhHb29nbGVBdXRoLCBfc3VwZXIpO1xuICAgIGZ1bmN0aW9uIEdvb2dsZUF1dGgoKSB7XG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICBHb29nbGVBdXRoLnByb3RvdHlwZS5hdXRoZW50aWNhdGUgPSBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoZGF0YSA9PT0gdm9pZCAwKSB7IGRhdGEgPSB7fTsgfVxuICAgICAgICByZXR1cm4gdGhpcy5pbkFwcEJyb3dzZXJGbG93KCdnb29nbGUnLCBkYXRhLCBvcHRpb25zKTtcbiAgICB9O1xuICAgIHJldHVybiBHb29nbGVBdXRoO1xufShBdXRoVHlwZSkpO1xuZXhwb3J0cy5Hb29nbGVBdXRoID0gR29vZ2xlQXV0aDtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgSW5zdGFncmFtQXV0aCA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKEluc3RhZ3JhbUF1dGgsIF9zdXBlcik7XG4gICAgZnVuY3Rpb24gSW5zdGFncmFtQXV0aCgpIHtcbiAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICAgIEluc3RhZ3JhbUF1dGgucHJvdG90eXBlLmF1dGhlbnRpY2F0ZSA9IGZ1bmN0aW9uIChkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChkYXRhID09PSB2b2lkIDApIHsgZGF0YSA9IHt9OyB9XG4gICAgICAgIHJldHVybiB0aGlzLmluQXBwQnJvd3NlckZsb3coJ2luc3RhZ3JhbScsIGRhdGEsIG9wdGlvbnMpO1xuICAgIH07XG4gICAgcmV0dXJuIEluc3RhZ3JhbUF1dGg7XG59KEF1dGhUeXBlKSk7XG5leHBvcnRzLkluc3RhZ3JhbUF1dGggPSBJbnN0YWdyYW1BdXRoO1xuLyoqXG4gKiBAaGlkZGVuXG4gKi9cbnZhciBMaW5rZWRJbkF1dGggPSAoZnVuY3Rpb24gKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhMaW5rZWRJbkF1dGgsIF9zdXBlcik7XG4gICAgZnVuY3Rpb24gTGlua2VkSW5BdXRoKCkge1xuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgTGlua2VkSW5BdXRoLnByb3RvdHlwZS5hdXRoZW50aWNhdGUgPSBmdW5jdGlvbiAoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoZGF0YSA9PT0gdm9pZCAwKSB7IGRhdGEgPSB7fTsgfVxuICAgICAgICByZXR1cm4gdGhpcy5pbkFwcEJyb3dzZXJGbG93KCdsaW5rZWRpbicsIGRhdGEsIG9wdGlvbnMpO1xuICAgIH07XG4gICAgcmV0dXJuIExpbmtlZEluQXV0aDtcbn0oQXV0aFR5cGUpKTtcbmV4cG9ydHMuTGlua2VkSW5BdXRoID0gTGlua2VkSW5BdXRoO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgcmVxdWVzdCA9IHJlcXVpcmUoJ3N1cGVyYWdlbnQnKTtcbi8qKlxuICogYENsaWVudGAgaXMgZm9yIG1ha2luZyBIVFRQIHJlcXVlc3RzIHRvIHRoZSBBUEkuXG4gKlxuICogVW5kZXIgdGhlIGhvb2QsIGl0IHVzZXNcbiAqIFtzdXBlcmFnZW50XShodHRwOi8vdmlzaW9ubWVkaWEuZ2l0aHViLmlvL3N1cGVyYWdlbnQvKS4gV2hlbiBhIG1ldGhvZCBpc1xuICogY2FsbGVkLCB5b3UgY2FuIGNhbGwgYW55IG51bWJlciBvZiBzdXBlcmFnZW50IGZ1bmN0aW9ucyBvbiBpdCBhbmQgdGhlbiBjYWxsXG4gKiBgZW5kKClgIHRvIGNvbXBsZXRlIGFuZCBzZW5kIHRoZSByZXF1ZXN0LlxuICpcbiAqIEBmZWF0dXJlZFxuICovXG52YXIgQ2xpZW50ID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBDbGllbnQoXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAaGlkZGVuXG4gICAgICAgICAqL1xuICAgICAgICB0b2tlbkNvbnRleHQsIFxuICAgICAgICAvKipcbiAgICAgICAgICogQGhpZGRlblxuICAgICAgICAgKi9cbiAgICAgICAgYmFzZVVybCwgcmVxIC8vIFRPRE86IHVzZSBzdXBlcmFnZW50IHR5cGVzXG4gICAgICAgICkge1xuICAgICAgICB0aGlzLnRva2VuQ29udGV4dCA9IHRva2VuQ29udGV4dDtcbiAgICAgICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcbiAgICAgICAgaWYgKHR5cGVvZiByZXEgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXEgPSByZXF1ZXN0O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVxID0gcmVxO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBHRVQgcmVxdWVzdCBmb3IgcmV0cmlldmluZyBhIHJlc291cmNlIGZyb20gdGhlIEFQSS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBlbmRwb2ludCAtIFRoZSBwYXRoIG9mIHRoZSBBUEkgZW5kcG9pbnQuXG4gICAgICovXG4gICAgQ2xpZW50LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoZW5kcG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3VwcGxlbWVudCh0aGlzLnJlcS5nZXQsIGVuZHBvaW50KTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFBPU1QgcmVxdWVzdCBmb3Igc2VuZGluZyBhIG5ldyByZXNvdXJjZSB0byB0aGUgQVBJLlxuICAgICAqXG4gICAgICogQHBhcmFtIGVuZHBvaW50IC0gVGhlIHBhdGggb2YgdGhlIEFQSSBlbmRwb2ludC5cbiAgICAgKi9cbiAgICBDbGllbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoZW5kcG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3VwcGxlbWVudCh0aGlzLnJlcS5wb3N0LCBlbmRwb2ludCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBQVVQgcmVxdWVzdCBmb3IgcmVwbGFjaW5nIGEgcmVzb3VyY2UgaW4gdGhlIEFQSS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBlbmRwb2ludCAtIFRoZSBwYXRoIG9mIHRoZSBBUEkgZW5kcG9pbnQuXG4gICAgICovXG4gICAgQ2xpZW50LnByb3RvdHlwZS5wdXQgPSBmdW5jdGlvbiAoZW5kcG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3VwcGxlbWVudCh0aGlzLnJlcS5wdXQsIGVuZHBvaW50KTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFBBVENIIHJlcXVlc3QgZm9yIHBlcmZvcm1pbmcgcGFydGlhbCB1cGRhdGVzIHRvIGEgcmVzb3VyY2UgaW4gdGhlIEFQSS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBlbmRwb2ludCAtIFRoZSBwYXRoIG9mIHRoZSBBUEkgZW5kcG9pbnQuXG4gICAgICovXG4gICAgQ2xpZW50LnByb3RvdHlwZS5wYXRjaCA9IGZ1bmN0aW9uIChlbmRwb2ludCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdXBwbGVtZW50KHRoaXMucmVxLnBhdGNoLCBlbmRwb2ludCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBERUxFVEUgcmVxdWVzdCBmb3IgZGVsZXRpbmcgYSByZXNvdXJjZSBmcm9tIHRoZSBBUEkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZW5kcG9pbnQgLSBUaGUgcGF0aCBvZiB0aGUgQVBJIGVuZHBvaW50LlxuICAgICAqL1xuICAgIENsaWVudC5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKGVuZHBvaW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN1cHBsZW1lbnQodGhpcy5yZXEuZGVsZXRlLCBlbmRwb2ludCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBAaGlkZGVuXG4gICAgICovXG4gICAgQ2xpZW50LnByb3RvdHlwZS5yZXF1ZXN0ID0gZnVuY3Rpb24gKG1ldGhvZCwgZW5kcG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3VwcGxlbWVudCh0aGlzLnJlcS5iaW5kKHRoaXMucmVxLCBtZXRob2QpLCBlbmRwb2ludCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIENsaWVudC5wcm90b3R5cGUuc3VwcGxlbWVudCA9IGZ1bmN0aW9uIChmbiwgZW5kcG9pbnQpIHtcbiAgICAgICAgaWYgKGVuZHBvaW50LnN1YnN0cmluZygwLCAxKSAhPT0gJy8nKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignZW5kcG9pbnQgbXVzdCBzdGFydCB3aXRoIGxlYWRpbmcgc2xhc2gnKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVxID0gZm4odGhpcy5iYXNlVXJsICsgZW5kcG9pbnQpO1xuICAgICAgICB2YXIgdG9rZW4gPSB0aGlzLnRva2VuQ29udGV4dC5nZXQoKTtcbiAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICByZXEuc2V0KCdBdXRob3JpemF0aW9uJywgXCJCZWFyZXIgXCIgKyB0b2tlbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcTtcbiAgICB9O1xuICAgIHJldHVybiBDbGllbnQ7XG59KCkpO1xuZXhwb3J0cy5DbGllbnQgPSBDbGllbnQ7XG4iLCJcInVzZSBzdHJpY3RcIjtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgQ29uZmlnID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBDb25maWcoKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51cmxzID0ge1xuICAgICAgICAgICAgJ2FwaSc6ICdodHRwczovL2FwaS5pb25pYy5pbycsXG4gICAgICAgICAgICAnd2ViJzogJ2h0dHBzOi8vd2ViLmlvbmljLmlvJ1xuICAgICAgICB9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIG5ldyBjb25maWcuXG4gICAgICovXG4gICAgQ29uZmlnLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uIChzZXR0aW5ncykge1xuICAgICAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBHZXQgYSB2YWx1ZSBmcm9tIHRoZSBjb3JlIHNldHRpbmdzLiBZb3Ugc2hvdWxkIHVzZSBgc2V0dGluZ3NgIGF0dHJpYnV0ZVxuICAgICAqIGRpcmVjdGx5IGZvciBjb3JlIHNldHRpbmdzIGFuZCBvdGhlciBzZXR0aW5ncy5cbiAgICAgKlxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbmFtZSAtIFRoZSBzZXR0aW5ncyBrZXkgdG8gZ2V0LlxuICAgICAqL1xuICAgIENvbmZpZy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnNldHRpbmdzIHx8ICF0aGlzLnNldHRpbmdzLmNvcmUpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0dGluZ3MuY29yZVtuYW1lXTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBoaWRkZW5cbiAgICAgKi9cbiAgICBDb25maWcucHJvdG90eXBlLmdldFVSTCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHZhciB1cmxzID0gKHRoaXMuc2V0dGluZ3MgJiYgdGhpcy5zZXR0aW5ncy5jb3JlICYmIHRoaXMuc2V0dGluZ3MuY29yZS51cmxzKSB8fCB7fTtcbiAgICAgICAgaWYgKHVybHNbbmFtZV0pIHtcbiAgICAgICAgICAgIHJldHVybiB1cmxzW25hbWVdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnVybHNbbmFtZV07XG4gICAgfTtcbiAgICByZXR1cm4gQ29uZmlnO1xufSgpKTtcbmV4cG9ydHMuQ29uZmlnID0gQ29uZmlnO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIENvcmRvdmEgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIENvcmRvdmEoZGVwcywgb3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICB0aGlzLmFwcCA9IGRlcHMuYXBwU3RhdHVzO1xuICAgICAgICB0aGlzLmRldmljZSA9IGRlcHMuZGV2aWNlO1xuICAgICAgICB0aGlzLmVtaXR0ZXIgPSBkZXBzLmVtaXR0ZXI7XG4gICAgICAgIHRoaXMubG9nZ2VyID0gZGVwcy5sb2dnZXI7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudEhhbmRsZXJzKCk7XG4gICAgfVxuICAgIENvcmRvdmEucHJvdG90eXBlLmJvb3RzdHJhcCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdmFyIGV2ZW50cyA9IFsncGF1c2UnLCAncmVzdW1lJ107XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZXJlYWR5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF90aGlzLmVtaXR0ZXIuZW1pdCgnY29yZG92YTpkZXZpY2VyZWFkeScsIHsgJ2FyZ3MnOiBhcmdzIH0pO1xuICAgICAgICAgICAgdmFyIF9sb29wXzEgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihlLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhcmdzID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzW19pIC0gMF0gPSBhcmd1bWVudHNbX2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmVtaXR0ZXIuZW1pdCgnY29yZG92YTonICsgZSwgeyAnYXJncyc6IGFyZ3MgfSk7XG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGZvciAodmFyIF9hID0gMCwgZXZlbnRzXzEgPSBldmVudHM7IF9hIDwgZXZlbnRzXzEubGVuZ3RoOyBfYSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGUgPSBldmVudHNfMVtfYV07XG4gICAgICAgICAgICAgICAgX2xvb3BfMShlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgZmFsc2UpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBDb3Jkb3ZhLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50SGFuZGxlcnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHRoaXMuZW1pdHRlci5vbignY29yZG92YTpwYXVzZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIF90aGlzLmFwcC5jbG9zZWQgPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5lbWl0dGVyLm9uKCdjb3Jkb3ZhOnJlc3VtZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIF90aGlzLmFwcC5jbG9zZWQgPSBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICByZXR1cm4gQ29yZG92YTtcbn0oKSk7XG5leHBvcnRzLkNvcmRvdmEgPSBDb3Jkb3ZhO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIENvcmUgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIENvcmUoZGVwcykge1xuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZlcnNpb24gPSAnMC44LjInO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGRlcHMuY29uZmlnO1xuICAgICAgICB0aGlzLmxvZ2dlciA9IGRlcHMubG9nZ2VyO1xuICAgICAgICB0aGlzLmVtaXR0ZXIgPSBkZXBzLmVtaXR0ZXI7XG4gICAgICAgIHRoaXMuaW5zaWdodHMgPSBkZXBzLmluc2lnaHRzO1xuICAgIH1cbiAgICBDb3JlLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnRIYW5kbGVycygpO1xuICAgICAgICB0aGlzLm9uUmVzdW1lKCk7XG4gICAgfTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29yZS5wcm90b3R5cGUsIFwidmVyc2lvblwiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3ZlcnNpb247XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgQ29yZS5wcm90b3R5cGUub25SZXN1bWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuaW5zaWdodHMudHJhY2soJ21vYmlsZWFwcC5vcGVuZWQnKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgQ29yZS5wcm90b3R5cGUucmVnaXN0ZXJFdmVudEhhbmRsZXJzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB0aGlzLmVtaXR0ZXIub24oJ2NvcmRvdmE6cmVzdW1lJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgX3RoaXMub25SZXN1bWUoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZW1pdHRlci5vbigncHVzaDpub3RpZmljYXRpb24nLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgaWYgKGRhdGEubWVzc2FnZS5hcHAuYXNsZWVwIHx8IGRhdGEubWVzc2FnZS5hcHAuY2xvc2VkKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuaW5zaWdodHMudHJhY2soJ21vYmlsZWFwcC5vcGVuZWQucHVzaCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHJldHVybiBDb3JlO1xufSgpKTtcbmV4cG9ydHMuQ29yZSA9IENvcmU7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBwcm9taXNlXzEgPSByZXF1aXJlKCcuLi9wcm9taXNlJyk7XG52YXIgTk9fUExVR0lOID0gbmV3IEVycm9yKCdNaXNzaW5nIGRlcGxveSBwbHVnaW46IGBpb25pYy1wbHVnaW4tZGVwbG95YCcpO1xuLyoqXG4gKiBgRGVwbG95YCBoYW5kbGVzIGxpdmUgZGVwbG95cyBvZiB0aGUgYXBwLiBEb3dubG9hZGluZywgZXh0cmFjdGluZywgYW5kXG4gKiByb2xsaW5nIGJhY2sgc25hcHNob3RzLlxuICpcbiAqIEBmZWF0dXJlZFxuICovXG52YXIgRGVwbG95ID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBEZXBsb3koZGVwcywgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAaGlkZGVuXG4gICAgICAgICAqL1xuICAgICAgICBvcHRpb25zKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHt9OyB9XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYWN0aXZlIGRlcGxveSBjaGFubmVsLiBTZXQgdGhpcyB0byBjaGFuZ2UgdGhlIGNoYW5uZWwgb24gd2hpY2hcbiAgICAgICAgICogYERlcGxveWAgb3BlcmF0ZXMuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNoYW5uZWwgPSAncHJvZHVjdGlvbic7XG4gICAgICAgIHRoaXMuY29uZmlnID0gZGVwcy5jb25maWc7XG4gICAgICAgIHRoaXMuZW1pdHRlciA9IGRlcHMuZW1pdHRlcjtcbiAgICAgICAgdGhpcy5sb2dnZXIgPSBkZXBzLmxvZ2dlcjtcbiAgICAgICAgdGhpcy5lbWl0dGVyLm9uY2UoJ2RldmljZTpyZWFkeScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChfdGhpcy5fZ2V0UGx1Z2luKCkpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5wbHVnaW4uaW5pdChfdGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKSwgX3RoaXMuY29uZmlnLmdldFVSTCgnYXBpJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3RoaXMuZW1pdHRlci5lbWl0KCdkZXBsb3k6cmVhZHknKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENoZWNrIGZvciB1cGRhdGVzIG9uIHRoZSBhY3RpdmUgY2hhbm5lbC5cbiAgICAgKlxuICAgICAqIFRoZSBwcm9taXNlIHJlc29sdmVzIHdpdGggYSBib29sZWFuLiBXaGVuIGB0cnVlYCwgYSBuZXcgc25hcHNob3QgZXhpc3RzIG9uXG4gICAgICogdGhlIGNoYW5uZWwuXG4gICAgICovXG4gICAgRGVwbG95LnByb3RvdHlwZS5jaGVjayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTtcbiAgICAgICAgdGhpcy5lbWl0dGVyLm9uY2UoJ2RlcGxveTpyZWFkeScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChfdGhpcy5fZ2V0UGx1Z2luKCkpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5wbHVnaW4uY2hlY2soX3RoaXMuY29uZmlnLmdldCgnYXBwX2lkJyksIF90aGlzLmNoYW5uZWwsIGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQgPT09ICd0cnVlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmluZm8oJ0lvbmljIERlcGxveTogYW4gdXBkYXRlIGlzIGF2YWlsYWJsZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5pbmZvKCdJb25pYyBEZXBsb3k6IG5vIHVwZGF0ZXMgYXZhaWxhYmxlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuZXJyb3IoJ0lvbmljIERlcGxveTogZW5jb3VudGVyZWQgYW4gZXJyb3Igd2hpbGUgY2hlY2tpbmcgZm9yIHVwZGF0ZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChOT19QTFVHSU4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBEb3dubG9hZCB0aGUgYXZhaWxhYmxlIHNuYXBzaG90LlxuICAgICAqXG4gICAgICogVGhpcyBzaG91bGQgYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoXG4gICAgICogW2BleHRyYWN0KClgXSgvYXBpL2NsaWVudC9kZXBsb3kvI2V4dHJhY3QpLlxuICAgICAqXG4gICAgICogQHBhcmFtIG9wdGlvbnNcbiAgICAgKiAgT3B0aW9ucyBmb3IgdGhpcyBkb3dubG9hZCwgc3VjaCBhcyBhIHByb2dyZXNzIGNhbGxiYWNrLlxuICAgICAqL1xuICAgIERlcGxveS5wcm90b3R5cGUuZG93bmxvYWQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgcHJvbWlzZV8xLkRlZmVycmVkUHJvbWlzZSgpO1xuICAgICAgICB0aGlzLmVtaXR0ZXIub25jZSgnZGVwbG95OnJlYWR5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKF90aGlzLl9nZXRQbHVnaW4oKSkge1xuICAgICAgICAgICAgICAgIF90aGlzLnBsdWdpbi5kb3dubG9hZChfdGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKSwgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9PSAndHJ1ZScgJiYgcmVzdWx0ICE9PSAnZmFsc2UnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5vblByb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5vblByb2dyZXNzKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSAndHJ1ZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuaW5mbygnSW9uaWMgRGVwbG95OiBkb3dubG9hZCBjb21wbGV0ZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXN1bHQgPT09ICd0cnVlJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChOT19QTFVHSU4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBFeHRyYWN0IHRoZSBkb3dubG9hZGVkIHNuYXBzaG90LlxuICAgICAqXG4gICAgICogVGhpcyBzaG91bGQgYmUgY2FsbGVkIGFmdGVyIFtgZG93bmxvYWQoKWBdKC9hcGkvY2xpZW50L2RlcGxveS8jZG93bmxvYWQpXG4gICAgICogc3VjY2Vzc2Z1bGx5IHJlc29sdmVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIG9wdGlvbnNcbiAgICAgKi9cbiAgICBEZXBsb3kucHJvdG90eXBlLmV4dHJhY3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgcHJvbWlzZV8xLkRlZmVycmVkUHJvbWlzZSgpO1xuICAgICAgICB0aGlzLmVtaXR0ZXIub25jZSgnZGVwbG95OnJlYWR5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKF90aGlzLl9nZXRQbHVnaW4oKSkge1xuICAgICAgICAgICAgICAgIF90aGlzLnBsdWdpbi5leHRyYWN0KF90aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09ICdkb25lJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMub25Qcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMub25Qcm9ncmVzcyhyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gJ3RydWUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmluZm8oJ0lvbmljIERlcGxveTogZXh0cmFjdGlvbiBjb21wbGV0ZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXN1bHQgPT09ICd0cnVlJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChOT19QTFVHSU4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBJbW1lZGlhdGVseSByZWxvYWQgdGhlIGFwcCB3aXRoIHRoZSBsYXRlc3QgZGVwbG95ZWQgc25hcHNob3QuXG4gICAgICpcbiAgICAgKiBUaGlzIGlzIG9ubHkgbmVjZXNzYXJ5IHRvIGNhbGwgaWYgeW91IGhhdmUgZG93bmxvYWRlZCBhbmQgZXh0cmFjdGVkIGFcbiAgICAgKiBzbmFwc2hvdCBhbmQgd2lzaCB0byBpbnN0YW50bHkgcmVsb2FkIHRoZSBhcHAgd2l0aCB0aGUgbGF0ZXN0IGRlcGxveS4gVGhlXG4gICAgICogbGF0ZXN0IGRlcGxveSB3aWxsIGF1dG9tYXRpY2FsbHkgYmUgbG9hZGVkIHdoZW4gdGhlIGFwcCBpcyBzdGFydGVkLlxuICAgICAqL1xuICAgIERlcGxveS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5lbWl0dGVyLm9uY2UoJ2RlcGxveTpyZWFkeScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChfdGhpcy5fZ2V0UGx1Z2luKCkpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5wbHVnaW4ucmVkaXJlY3QoX3RoaXMuY29uZmlnLmdldCgnYXBwX2lkJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEdldCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgY3VycmVudCBzbmFwc2hvdC5cbiAgICAgKlxuICAgICAqIFRoZSBwcm9taXNlIGlzIHJlc29sdmVkIHdpdGggYW4gb2JqZWN0IHRoYXQgaGFzIGtleS92YWx1ZSBwYWlycyBwZXJ0YWluaW5nXG4gICAgICogdG8gdGhlIGN1cnJlbnRseSBkZXBsb3llZCBzbmFwc2hvdC5cbiAgICAgKi9cbiAgICBEZXBsb3kucHJvdG90eXBlLmluZm8gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IG5ldyBwcm9taXNlXzEuRGVmZXJyZWRQcm9taXNlKCk7IC8vIFRPRE9cbiAgICAgICAgdGhpcy5lbWl0dGVyLm9uY2UoJ2RlcGxveTpyZWFkeScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChfdGhpcy5fZ2V0UGx1Z2luKCkpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5wbHVnaW4uaW5mbyhfdGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKSwgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChOT19QTFVHSU4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBMaXN0IHRoZSBzbmFwc2hvdHMgdGhhdCBoYXZlIGJlZW4gaW5zdGFsbGVkIG9uIHRoaXMgZGV2aWNlLlxuICAgICAqXG4gICAgICogVGhlIHByb21pc2UgaXMgcmVzb2x2ZWQgd2l0aCBhbiBhcnJheSBvZiBzbmFwc2hvdCBVVUlEcy5cbiAgICAgKi9cbiAgICBEZXBsb3kucHJvdG90eXBlLmdldFNuYXBzaG90cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTsgLy8gVE9ET1xuICAgICAgICB0aGlzLmVtaXR0ZXIub25jZSgnZGVwbG95OnJlYWR5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKF90aGlzLl9nZXRQbHVnaW4oKSkge1xuICAgICAgICAgICAgICAgIF90aGlzLnBsdWdpbi5nZXRWZXJzaW9ucyhfdGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKSwgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChOT19QTFVHSU4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYSBzbmFwc2hvdCBmcm9tIHRoaXMgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHV1aWRcbiAgICAgKiAgVGhlIHNuYXBzaG90IFVVSUQgdG8gcmVtb3ZlIGZyb20gdGhlIGRldmljZS5cbiAgICAgKi9cbiAgICBEZXBsb3kucHJvdG90eXBlLmRlbGV0ZVNuYXBzaG90ID0gZnVuY3Rpb24gKHV1aWQpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTsgLy8gVE9ET1xuICAgICAgICB0aGlzLmVtaXR0ZXIub25jZSgnZGVwbG95OnJlYWR5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKF90aGlzLl9nZXRQbHVnaW4oKSkge1xuICAgICAgICAgICAgICAgIF90aGlzLnBsdWdpbi5kZWxldGVWZXJzaW9uKF90aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpLCB1dWlkLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KE5PX1BMVUdJTik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEZldGNoZXMgdGhlIG1ldGFkYXRhIGZvciBhIGdpdmVuIHNuYXBzaG90LiBJZiBubyBVVUlEIGlzIGdpdmVuLCBpdCB3aWxsXG4gICAgICogYXR0ZW1wdCB0byBncmFiIHRoZSBtZXRhZGF0YSBmb3IgdGhlIG1vc3QgcmVjZW50bHkga25vd24gc25hcHNob3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdXVpZFxuICAgICAqICBUaGUgc25hcHNob3QgZnJvbSB3aGljaCB0byBncmFiIG1ldGFkYXRhLlxuICAgICAqL1xuICAgIERlcGxveS5wcm90b3R5cGUuZ2V0TWV0YWRhdGEgPSBmdW5jdGlvbiAodXVpZCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgcHJvbWlzZV8xLkRlZmVycmVkUHJvbWlzZSgpOyAvLyBUT0RPXG4gICAgICAgIHRoaXMuZW1pdHRlci5vbmNlKCdkZXBsb3k6cmVhZHknLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoX3RoaXMuX2dldFBsdWdpbigpKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMucGx1Z2luLmdldE1ldGFkYXRhKF90aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpLCB1dWlkLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzdWx0Lm1ldGFkYXRhKTtcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KE5PX1BMVUdJTik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgRGVwbG95LnByb3RvdHlwZS5fZ2V0UGx1Z2luID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdy5Jb25pY0RlcGxveSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ0lvbmljIERlcGxveTogRGlzYWJsZWQhIERlcGxveSBwbHVnaW4gaXMgbm90IGluc3RhbGxlZCBvciBoYXMgbm90IGxvYWRlZC4gSGF2ZSB5b3UgcnVuIGBpb25pYyBwbHVnaW4gYWRkIGlvbmljLXBsdWdpbi1kZXBsb3lgIHlldD8nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMucGx1Z2luKSB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbiA9IHdpbmRvdy5Jb25pY0RlcGxveTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5wbHVnaW47XG4gICAgfTtcbiAgICByZXR1cm4gRGVwbG95O1xufSgpKTtcbmV4cG9ydHMuRGVwbG95ID0gRGVwbG95O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIERldmljZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gRGV2aWNlKGRlcHMpIHtcbiAgICAgICAgdGhpcy5kZXBzID0gZGVwcztcbiAgICAgICAgdGhpcy5lbWl0dGVyID0gdGhpcy5kZXBzLmVtaXR0ZXI7XG4gICAgICAgIHRoaXMuZGV2aWNlVHlwZSA9IHRoaXMuZGV0ZXJtaW5lRGV2aWNlVHlwZSgpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnRIYW5kbGVycygpO1xuICAgIH1cbiAgICBEZXZpY2UucHJvdG90eXBlLmlzQW5kcm9pZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGV2aWNlVHlwZSA9PT0gJ2FuZHJvaWQnO1xuICAgIH07XG4gICAgRGV2aWNlLnByb3RvdHlwZS5pc0lPUyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGV2aWNlVHlwZSA9PT0gJ2lwaG9uZScgfHwgdGhpcy5kZXZpY2VUeXBlID09PSAnaXBhZCc7XG4gICAgfTtcbiAgICBEZXZpY2UucHJvdG90eXBlLmlzQ29ubmVjdGVkVG9OZXR3b3JrID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICAgICAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IuY29ubmVjdGlvbiA9PT0gJ3VuZGVmaW5lZCcgfHxcbiAgICAgICAgICAgIHR5cGVvZiBuYXZpZ2F0b3IuY29ubmVjdGlvbi50eXBlID09PSAndW5kZWZpbmVkJyB8fFxuICAgICAgICAgICAgdHlwZW9mIENvbm5lY3Rpb24gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuc3RyaWN0TW9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAobmF2aWdhdG9yLmNvbm5lY3Rpb24udHlwZSkge1xuICAgICAgICAgICAgY2FzZSBDb25uZWN0aW9uLkVUSEVSTkVUOlxuICAgICAgICAgICAgY2FzZSBDb25uZWN0aW9uLldJRkk6XG4gICAgICAgICAgICBjYXNlIENvbm5lY3Rpb24uQ0VMTF8yRzpcbiAgICAgICAgICAgIGNhc2UgQ29ubmVjdGlvbi5DRUxMXzNHOlxuICAgICAgICAgICAgY2FzZSBDb25uZWN0aW9uLkNFTExfNEc6XG4gICAgICAgICAgICBjYXNlIENvbm5lY3Rpb24uQ0VMTDpcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIERldmljZS5wcm90b3R5cGUucmVnaXN0ZXJFdmVudEhhbmRsZXJzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5kZXZpY2VUeXBlID09PSAndW5rbm93bicpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KCdkZXZpY2U6cmVhZHknKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5vbmNlKCdjb3Jkb3ZhOmRldmljZXJlYWR5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIF90aGlzLmVtaXR0ZXIuZW1pdCgnZGV2aWNlOnJlYWR5Jyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBEZXZpY2UucHJvdG90eXBlLmRldGVybWluZURldmljZVR5cGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQ7XG4gICAgICAgIHZhciBpcGFkID0gYWdlbnQubWF0Y2goL2lQYWQvaSk7XG4gICAgICAgIGlmIChpcGFkICYmIChpcGFkWzBdLnRvTG93ZXJDYXNlKCkgPT09ICdpcGFkJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnaXBhZCc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGlwaG9uZSA9IGFnZW50Lm1hdGNoKC9pUGhvbmUvaSk7XG4gICAgICAgIGlmIChpcGhvbmUgJiYgKGlwaG9uZVswXS50b0xvd2VyQ2FzZSgpID09PSAnaXBob25lJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnaXBob25lJztcbiAgICAgICAgfVxuICAgICAgICB2YXIgYW5kcm9pZCA9IGFnZW50Lm1hdGNoKC9BbmRyb2lkL2kpO1xuICAgICAgICBpZiAoYW5kcm9pZCAmJiAoYW5kcm9pZFswXS50b0xvd2VyQ2FzZSgpID09PSAnYW5kcm9pZCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2FuZHJvaWQnO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAndW5rbm93bic7XG4gICAgfTtcbiAgICByZXR1cm4gRGV2aWNlO1xufSgpKTtcbmV4cG9ydHMuRGV2aWNlID0gRGV2aWNlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19kZWNvcmF0ZSA9ICh0aGlzICYmIHRoaXMuX19kZWNvcmF0ZSkgfHwgZnVuY3Rpb24gKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcbn07XG52YXIgX19tZXRhZGF0YSA9ICh0aGlzICYmIHRoaXMuX19tZXRhZGF0YSkgfHwgZnVuY3Rpb24gKGssIHYpIHtcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEoaywgdik7XG59O1xudmFyIGF1dGhfMSA9IHJlcXVpcmUoJy4vYXV0aCcpO1xudmFyIGNsaWVudF8xID0gcmVxdWlyZSgnLi9jbGllbnQnKTtcbnZhciBjb25maWdfMSA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG52YXIgY29yZG92YV8xID0gcmVxdWlyZSgnLi9jb3Jkb3ZhJyk7XG52YXIgY29yZV8xID0gcmVxdWlyZSgnLi9jb3JlJyk7XG52YXIgZGVwbG95XzEgPSByZXF1aXJlKCcuL2RlcGxveS9kZXBsb3knKTtcbnZhciBkZXZpY2VfMSA9IHJlcXVpcmUoJy4vZGV2aWNlJyk7XG52YXIgZXZlbnRzXzEgPSByZXF1aXJlKCcuL2V2ZW50cycpO1xudmFyIGluc2lnaHRzXzEgPSByZXF1aXJlKCcuL2luc2lnaHRzJyk7XG52YXIgbG9nZ2VyXzEgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xudmFyIHB1c2hfMSA9IHJlcXVpcmUoJy4vcHVzaC9wdXNoJyk7XG52YXIgc3RvcmFnZV8xID0gcmVxdWlyZSgnLi9zdG9yYWdlJyk7XG52YXIgdXNlcl8xID0gcmVxdWlyZSgnLi91c2VyL3VzZXInKTtcbnZhciBtb2R1bGVzID0ge307XG5mdW5jdGlvbiBjYWNoZSh0YXJnZXQsIHByb3BlcnR5S2V5LCBkZXNjcmlwdG9yKSB7XG4gICAgdmFyIG1ldGhvZCA9IGRlc2NyaXB0b3IuZ2V0O1xuICAgIGRlc2NyaXB0b3IuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZXNbcHJvcGVydHlLZXldID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gbWV0aG9kLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBtb2R1bGVzW3Byb3BlcnR5S2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtb2R1bGVzW3Byb3BlcnR5S2V5XTtcbiAgICB9O1xuICAgIGRlc2NyaXB0b3Iuc2V0ID0gZnVuY3Rpb24gKHZhbHVlKSB7IH07XG59XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIENvbnRhaW5lciA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gQ29udGFpbmVyKCkge1xuICAgIH1cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJhcHBTdGF0dXNcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB7ICdhc2xlZXAnOiBmYWxzZSwgJ2Nsb3NlZCc6IGZhbHNlIH07XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb250YWluZXIucHJvdG90eXBlLCBcImNvbmZpZ1wiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBjb25maWdfMS5Db25maWcoKTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbnRhaW5lci5wcm90b3R5cGUsIFwiZXZlbnRFbWl0dGVyXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGV2ZW50c18xLkV2ZW50RW1pdHRlcigpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJsb2dnZXJcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSB0aGlzLmNvbmZpZztcbiAgICAgICAgICAgIHZhciBjID0ge307XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5zZXR0aW5ncyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBjID0gY29uZmlnLnNldHRpbmdzLmxvZ2dlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgbG9nZ2VyXzEuTG9nZ2VyKGMpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJsb2NhbFN0b3JhZ2VTdHJhdGVneVwiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBzdG9yYWdlXzEuTG9jYWxTdG9yYWdlU3RyYXRlZ3koKTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbnRhaW5lci5wcm90b3R5cGUsIFwic2Vzc2lvblN0b3JhZ2VTdHJhdGVneVwiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBzdG9yYWdlXzEuU2Vzc2lvblN0b3JhZ2VTdHJhdGVneSgpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJhdXRoVG9rZW5Db250ZXh0XCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgbGFiZWwgPSAnYXV0aF8nICsgdGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgYXV0aF8xLkNvbWJpbmVkQXV0aFRva2VuQ29udGV4dCh7XG4gICAgICAgICAgICAgICAgJ3N0b3JhZ2UnOiBuZXcgc3RvcmFnZV8xLlN0b3JhZ2UoeyAnc3RyYXRlZ3knOiB0aGlzLmxvY2FsU3RvcmFnZVN0cmF0ZWd5IH0pLFxuICAgICAgICAgICAgICAgICd0ZW1wU3RvcmFnZSc6IG5ldyBzdG9yYWdlXzEuU3RvcmFnZSh7ICdzdHJhdGVneSc6IHRoaXMuc2Vzc2lvblN0b3JhZ2VTdHJhdGVneSB9KVxuICAgICAgICAgICAgfSwgbGFiZWwpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJjbGllbnRcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgY2xpZW50XzEuQ2xpZW50KHRoaXMuYXV0aFRva2VuQ29udGV4dCwgdGhpcy5jb25maWcuZ2V0VVJMKCdhcGknKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb250YWluZXIucHJvdG90eXBlLCBcImluc2lnaHRzXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGluc2lnaHRzXzEuSW5zaWdodHMoe1xuICAgICAgICAgICAgICAgICdhcHBTdGF0dXMnOiB0aGlzLmFwcFN0YXR1cyxcbiAgICAgICAgICAgICAgICAnc3RvcmFnZSc6IG5ldyBzdG9yYWdlXzEuU3RvcmFnZSh7ICdzdHJhdGVneSc6IHRoaXMubG9jYWxTdG9yYWdlU3RyYXRlZ3kgfSksXG4gICAgICAgICAgICAgICAgJ2NvbmZpZyc6IHRoaXMuY29uZmlnLFxuICAgICAgICAgICAgICAgICdjbGllbnQnOiB0aGlzLmNsaWVudCxcbiAgICAgICAgICAgICAgICAnbG9nZ2VyJzogdGhpcy5sb2dnZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJjb3JlXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGNvcmVfMS5Db3JlKHtcbiAgICAgICAgICAgICAgICAnY29uZmlnJzogdGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgJ2xvZ2dlcic6IHRoaXMubG9nZ2VyLFxuICAgICAgICAgICAgICAgICdlbWl0dGVyJzogdGhpcy5ldmVudEVtaXR0ZXIsXG4gICAgICAgICAgICAgICAgJ2luc2lnaHRzJzogdGhpcy5pbnNpZ2h0c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb250YWluZXIucHJvdG90eXBlLCBcImRldmljZVwiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBkZXZpY2VfMS5EZXZpY2UoeyAnZW1pdHRlcic6IHRoaXMuZXZlbnRFbWl0dGVyIH0pO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJjb3Jkb3ZhXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGNvcmRvdmFfMS5Db3Jkb3ZhKHtcbiAgICAgICAgICAgICAgICAnYXBwU3RhdHVzJzogdGhpcy5hcHBTdGF0dXMsXG4gICAgICAgICAgICAgICAgJ2RldmljZSc6IHRoaXMuZGV2aWNlLFxuICAgICAgICAgICAgICAgICdlbWl0dGVyJzogdGhpcy5ldmVudEVtaXR0ZXIsXG4gICAgICAgICAgICAgICAgJ2xvZ2dlcic6IHRoaXMubG9nZ2VyXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbnRhaW5lci5wcm90b3R5cGUsIFwidXNlckNvbnRleHRcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgdXNlcl8xLlVzZXJDb250ZXh0KHsgJ3N0b3JhZ2UnOiBuZXcgc3RvcmFnZV8xLlN0b3JhZ2UoeyAnc3RyYXRlZ3knOiB0aGlzLmxvY2FsU3RvcmFnZVN0cmF0ZWd5IH0pLCAnY29uZmlnJzogdGhpcy5jb25maWcgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb250YWluZXIucHJvdG90eXBlLCBcInNpbmdsZVVzZXJTZXJ2aWNlXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IHVzZXJfMS5TaW5nbGVVc2VyU2VydmljZSh7ICdjbGllbnQnOiB0aGlzLmNsaWVudCwgJ2NvbnRleHQnOiB0aGlzLnVzZXJDb250ZXh0IH0pO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJhdXRoTW9kdWxlc1wiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAnYmFzaWMnOiBuZXcgYXV0aF8xLkJhc2ljQXV0aCh7ICdjb25maWcnOiB0aGlzLmNvbmZpZywgJ2NsaWVudCc6IHRoaXMuY2xpZW50IH0pLFxuICAgICAgICAgICAgICAgICdjdXN0b20nOiBuZXcgYXV0aF8xLkN1c3RvbUF1dGgoeyAnY29uZmlnJzogdGhpcy5jb25maWcsICdjbGllbnQnOiB0aGlzLmNsaWVudCB9KSxcbiAgICAgICAgICAgICAgICAndHdpdHRlcic6IG5ldyBhdXRoXzEuVHdpdHRlckF1dGgoeyAnY29uZmlnJzogdGhpcy5jb25maWcsICdjbGllbnQnOiB0aGlzLmNsaWVudCB9KSxcbiAgICAgICAgICAgICAgICAnZmFjZWJvb2snOiBuZXcgYXV0aF8xLkZhY2Vib29rQXV0aCh7ICdjb25maWcnOiB0aGlzLmNvbmZpZywgJ2NsaWVudCc6IHRoaXMuY2xpZW50IH0pLFxuICAgICAgICAgICAgICAgICdnaXRodWInOiBuZXcgYXV0aF8xLkdpdGh1YkF1dGgoeyAnY29uZmlnJzogdGhpcy5jb25maWcsICdjbGllbnQnOiB0aGlzLmNsaWVudCB9KSxcbiAgICAgICAgICAgICAgICAnZ29vZ2xlJzogbmV3IGF1dGhfMS5Hb29nbGVBdXRoKHsgJ2NvbmZpZyc6IHRoaXMuY29uZmlnLCAnY2xpZW50JzogdGhpcy5jbGllbnQgfSksXG4gICAgICAgICAgICAgICAgJ2luc3RhZ3JhbSc6IG5ldyBhdXRoXzEuSW5zdGFncmFtQXV0aCh7ICdjb25maWcnOiB0aGlzLmNvbmZpZywgJ2NsaWVudCc6IHRoaXMuY2xpZW50IH0pLFxuICAgICAgICAgICAgICAgICdsaW5rZWRpbic6IG5ldyBhdXRoXzEuTGlua2VkSW5BdXRoKHsgJ2NvbmZpZyc6IHRoaXMuY29uZmlnLCAnY2xpZW50JzogdGhpcy5jbGllbnQgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb250YWluZXIucHJvdG90eXBlLCBcImF1dGhcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgYXV0aF8xLkF1dGgoe1xuICAgICAgICAgICAgICAgICdjb25maWcnOiB0aGlzLmNvbmZpZyxcbiAgICAgICAgICAgICAgICAnZW1pdHRlcic6IHRoaXMuZXZlbnRFbWl0dGVyLFxuICAgICAgICAgICAgICAgICdhdXRoTW9kdWxlcyc6IHRoaXMuYXV0aE1vZHVsZXMsXG4gICAgICAgICAgICAgICAgJ3Rva2VuQ29udGV4dCc6IHRoaXMuYXV0aFRva2VuQ29udGV4dCxcbiAgICAgICAgICAgICAgICAndXNlclNlcnZpY2UnOiB0aGlzLnNpbmdsZVVzZXJTZXJ2aWNlLFxuICAgICAgICAgICAgICAgICdzdG9yYWdlJzogbmV3IHN0b3JhZ2VfMS5TdG9yYWdlKHsgJ3N0cmF0ZWd5JzogdGhpcy5sb2NhbFN0b3JhZ2VTdHJhdGVneSB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb250YWluZXIucHJvdG90eXBlLCBcInB1c2hcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSB0aGlzLmNvbmZpZztcbiAgICAgICAgICAgIHZhciBjID0ge307XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy5zZXR0aW5ncyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBjID0gY29uZmlnLnNldHRpbmdzLnB1c2g7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IHB1c2hfMS5QdXNoKHtcbiAgICAgICAgICAgICAgICAnY29uZmlnJzogY29uZmlnLFxuICAgICAgICAgICAgICAgICdhdXRoJzogdGhpcy5hdXRoLFxuICAgICAgICAgICAgICAgICd1c2VyU2VydmljZSc6IHRoaXMuc2luZ2xlVXNlclNlcnZpY2UsXG4gICAgICAgICAgICAgICAgJ2RldmljZSc6IHRoaXMuZGV2aWNlLFxuICAgICAgICAgICAgICAgICdjbGllbnQnOiB0aGlzLmNsaWVudCxcbiAgICAgICAgICAgICAgICAnZW1pdHRlcic6IHRoaXMuZXZlbnRFbWl0dGVyLFxuICAgICAgICAgICAgICAgICdzdG9yYWdlJzogbmV3IHN0b3JhZ2VfMS5TdG9yYWdlKHsgJ3N0cmF0ZWd5JzogdGhpcy5sb2NhbFN0b3JhZ2VTdHJhdGVneSB9KSxcbiAgICAgICAgICAgICAgICAnbG9nZ2VyJzogdGhpcy5sb2dnZXJcbiAgICAgICAgICAgIH0sIGMpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29udGFpbmVyLnByb3RvdHlwZSwgXCJkZXBsb3lcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgZGVwbG95XzEuRGVwbG95KHtcbiAgICAgICAgICAgICAgICAnY29uZmlnJzogdGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgJ2VtaXR0ZXInOiB0aGlzLmV2ZW50RW1pdHRlcixcbiAgICAgICAgICAgICAgICAnbG9nZ2VyJzogdGhpcy5sb2dnZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImFwcFN0YXR1c1wiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImNvbmZpZ1wiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImV2ZW50RW1pdHRlclwiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImxvZ2dlclwiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImxvY2FsU3RvcmFnZVN0cmF0ZWd5XCIsIG51bGwpO1xuICAgIF9fZGVjb3JhdGUoW1xuICAgICAgICBjYWNoZSwgXG4gICAgICAgIF9fbWV0YWRhdGEoJ2Rlc2lnbjp0eXBlJywgT2JqZWN0KVxuICAgIF0sIENvbnRhaW5lci5wcm90b3R5cGUsIFwic2Vzc2lvblN0b3JhZ2VTdHJhdGVneVwiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImF1dGhUb2tlbkNvbnRleHRcIiwgbnVsbCk7XG4gICAgX19kZWNvcmF0ZShbXG4gICAgICAgIGNhY2hlLCBcbiAgICAgICAgX19tZXRhZGF0YSgnZGVzaWduOnR5cGUnLCBPYmplY3QpXG4gICAgXSwgQ29udGFpbmVyLnByb3RvdHlwZSwgXCJjbGllbnRcIiwgbnVsbCk7XG4gICAgX19kZWNvcmF0ZShbXG4gICAgICAgIGNhY2hlLCBcbiAgICAgICAgX19tZXRhZGF0YSgnZGVzaWduOnR5cGUnLCBPYmplY3QpXG4gICAgXSwgQ29udGFpbmVyLnByb3RvdHlwZSwgXCJpbnNpZ2h0c1wiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImNvcmVcIiwgbnVsbCk7XG4gICAgX19kZWNvcmF0ZShbXG4gICAgICAgIGNhY2hlLCBcbiAgICAgICAgX19tZXRhZGF0YSgnZGVzaWduOnR5cGUnLCBPYmplY3QpXG4gICAgXSwgQ29udGFpbmVyLnByb3RvdHlwZSwgXCJkZXZpY2VcIiwgbnVsbCk7XG4gICAgX19kZWNvcmF0ZShbXG4gICAgICAgIGNhY2hlLCBcbiAgICAgICAgX19tZXRhZGF0YSgnZGVzaWduOnR5cGUnLCBPYmplY3QpXG4gICAgXSwgQ29udGFpbmVyLnByb3RvdHlwZSwgXCJjb3Jkb3ZhXCIsIG51bGwpO1xuICAgIF9fZGVjb3JhdGUoW1xuICAgICAgICBjYWNoZSwgXG4gICAgICAgIF9fbWV0YWRhdGEoJ2Rlc2lnbjp0eXBlJywgT2JqZWN0KVxuICAgIF0sIENvbnRhaW5lci5wcm90b3R5cGUsIFwidXNlckNvbnRleHRcIiwgbnVsbCk7XG4gICAgX19kZWNvcmF0ZShbXG4gICAgICAgIGNhY2hlLCBcbiAgICAgICAgX19tZXRhZGF0YSgnZGVzaWduOnR5cGUnLCBPYmplY3QpXG4gICAgXSwgQ29udGFpbmVyLnByb3RvdHlwZSwgXCJzaW5nbGVVc2VyU2VydmljZVwiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcImF1dGhNb2R1bGVzXCIsIG51bGwpO1xuICAgIF9fZGVjb3JhdGUoW1xuICAgICAgICBjYWNoZSwgXG4gICAgICAgIF9fbWV0YWRhdGEoJ2Rlc2lnbjp0eXBlJywgT2JqZWN0KVxuICAgIF0sIENvbnRhaW5lci5wcm90b3R5cGUsIFwiYXV0aFwiLCBudWxsKTtcbiAgICBfX2RlY29yYXRlKFtcbiAgICAgICAgY2FjaGUsIFxuICAgICAgICBfX21ldGFkYXRhKCdkZXNpZ246dHlwZScsIE9iamVjdClcbiAgICBdLCBDb250YWluZXIucHJvdG90eXBlLCBcInB1c2hcIiwgbnVsbCk7XG4gICAgX19kZWNvcmF0ZShbXG4gICAgICAgIGNhY2hlLCBcbiAgICAgICAgX19tZXRhZGF0YSgnZGVzaWduOnR5cGUnLCBPYmplY3QpXG4gICAgXSwgQ29udGFpbmVyLnByb3RvdHlwZSwgXCJkZXBsb3lcIiwgbnVsbCk7XG4gICAgcmV0dXJuIENvbnRhaW5lcjtcbn0oKSk7XG5leHBvcnRzLkNvbnRhaW5lciA9IENvbnRhaW5lcjtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIF9fZXh0ZW5kcyA9ICh0aGlzICYmIHRoaXMuX19leHRlbmRzKSB8fCBmdW5jdGlvbiAoZCwgYikge1xuICAgIGZvciAodmFyIHAgaW4gYikgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIGRbcF0gPSBiW3BdO1xuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcbn07XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIEV4Y2VwdGlvbiA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKEV4Y2VwdGlvbiwgX3N1cGVyKTtcbiAgICBmdW5jdGlvbiBFeGNlcHRpb24obWVzc2FnZSkge1xuICAgICAgICBfc3VwZXIuY2FsbCh0aGlzLCBtZXNzYWdlKTtcbiAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgdGhpcy5uYW1lID0gJ0V4Y2VwdGlvbic7XG4gICAgICAgIHRoaXMuc3RhY2sgPSAobmV3IEVycm9yKCkpLnN0YWNrO1xuICAgIH1cbiAgICBFeGNlcHRpb24ucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYW1lICsgXCI6IFwiICsgdGhpcy5tZXNzYWdlO1xuICAgIH07XG4gICAgcmV0dXJuIEV4Y2VwdGlvbjtcbn0oRXJyb3IpKTtcbmV4cG9ydHMuRXhjZXB0aW9uID0gRXhjZXB0aW9uO1xuLyoqXG4gKiBBbiBlcnJvciB3aXRoIGdlbmVyaWMgZXJyb3IgZGV0YWlscy5cbiAqXG4gKiBFcnJvciBkZXRhaWxzIGNhbiBiZSBleHRyYWN0ZWQgZGVwZW5kaW5nIG9uIHRoZSB0eXBlIG9mIGBEYC4gRm9yIGluc3RhbmNlLFxuICogaWYgdGhlIHR5cGUgb2YgYERgIGlzIGBzdHJpbmdbXWAsIHlvdSBjYW4gZG8gdGhpczpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBmdW5jdGlvbiBoYW5kbGVFcnJvcihlcnI6IElEZXRhaWxlZEVycm9yPHN0cmluZ1tdPikge1xuICogICBmb3IgKGxldCBpIGluIGVyci5kZXRhaWxzKSB7XG4gKiAgICAgY29uc29sZS5lcnJvcignZ290IGVycm9yIGNvZGU6ICcgKyBpKTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKlxuICogQGZlYXR1cmVkXG4gKi9cbnZhciBEZXRhaWxlZEVycm9yID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoRGV0YWlsZWRFcnJvciwgX3N1cGVyKTtcbiAgICBmdW5jdGlvbiBEZXRhaWxlZEVycm9yKFxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVycm9yIG1lc3NhZ2UuXG4gICAgICAgICAqL1xuICAgICAgICBtZXNzYWdlLCBcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlcnJvciBkZXRhaWxzLlxuICAgICAgICAgKi9cbiAgICAgICAgZGV0YWlscykge1xuICAgICAgICBfc3VwZXIuY2FsbCh0aGlzLCBtZXNzYWdlKTtcbiAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgdGhpcy5kZXRhaWxzID0gZGV0YWlscztcbiAgICAgICAgdGhpcy5uYW1lID0gJ0RldGFpbGVkRXJyb3InO1xuICAgIH1cbiAgICByZXR1cm4gRGV0YWlsZWRFcnJvcjtcbn0oRXhjZXB0aW9uKSk7XG5leHBvcnRzLkRldGFpbGVkRXJyb3IgPSBEZXRhaWxlZEVycm9yO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAqIEEgcmVnaXN0ZXJlZCBldmVudCByZWNlaXZlci5cbiAqL1xudmFyIEV2ZW50UmVjZWl2ZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEV2ZW50UmVjZWl2ZXIoXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbiByZWdpc3RlcmVkIGlkZW50aWZpZXIgZm9yIHRoaXMgZXZlbnQgcmVjZWl2ZXIuXG4gICAgICAgICAqL1xuICAgICAgICBrZXksIFxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJlZ2lzdGVyZWQgbmFtZSBvZiB0aGUgZXZlbnQuXG4gICAgICAgICAqL1xuICAgICAgICBldmVudCwgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYWN0dWFsIGNhbGxiYWNrLlxuICAgICAgICAgKi9cbiAgICAgICAgaGFuZGxlcikge1xuICAgICAgICB0aGlzLmtleSA9IGtleTtcbiAgICAgICAgdGhpcy5ldmVudCA9IGV2ZW50O1xuICAgICAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICAgIH1cbiAgICByZXR1cm4gRXZlbnRSZWNlaXZlcjtcbn0oKSk7XG5leHBvcnRzLkV2ZW50UmVjZWl2ZXIgPSBFdmVudFJlY2VpdmVyO1xuLyoqXG4gKiBTdG9yZXMgY2FsbGJhY2tzIGZvciByZWdpc3RlcmVkIGV2ZW50cy5cbiAqL1xudmFyIEV2ZW50RW1pdHRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubiA9IDA7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ldmVudFJlY2VpdmVycyA9IHt9O1xuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZXZlbnRzRW1pdHRlZCA9IHt9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhbiBldmVudCBjYWxsYmFjayB3aGljaCBnZXRzIHRyaWdnZXJlZCBldmVyeSB0aW1lIHRoZSBldmVudCBpc1xuICAgICAqIGZpcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIGV2ZW50XG4gICAgICogIFRoZSBldmVudCBuYW1lLlxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqICBBIGNhbGxiYWNrIHRvIGF0dGFjaCB0byB0aGlzIGV2ZW50LlxuICAgICAqL1xuICAgIEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbiAoZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5ldmVudFJlY2VpdmVyc1tldmVudF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50UmVjZWl2ZXJzW2V2ZW50XSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHZhciByZWNlaXZlciA9IG5ldyBFdmVudFJlY2VpdmVyKHRoaXMubiwgZXZlbnQsIGNhbGxiYWNrKTtcbiAgICAgICAgdGhpcy5uKys7XG4gICAgICAgIHRoaXMuZXZlbnRSZWNlaXZlcnNbZXZlbnRdW3JlY2VpdmVyLmtleV0gPSByZWNlaXZlcjtcbiAgICAgICAgcmV0dXJuIHJlY2VpdmVyO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogVW5yZWdpc3RlciBhbiBldmVudCByZWNlaXZlciByZXR1cm5lZCBmcm9tXG4gICAgICogW2BvbigpYF0oL2FwaS9jbGllbnQvZXZlbnRlbWl0dGVyI29uKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSByZWNlaXZlclxuICAgICAqICBUaGUgZXZlbnQgcmVjZWl2ZXIuXG4gICAgICovXG4gICAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbiAocmVjZWl2ZXIpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmV2ZW50UmVjZWl2ZXJzW3JlY2VpdmVyLmV2ZW50XSA9PT0gJ3VuZGVmaW5lZCcgfHxcbiAgICAgICAgICAgIHR5cGVvZiB0aGlzLmV2ZW50UmVjZWl2ZXJzW3JlY2VpdmVyLmV2ZW50XVtyZWNlaXZlci5rZXldID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIGV2ZW50IHJlY2VpdmVyJyk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRSZWNlaXZlcnNbcmVjZWl2ZXIuZXZlbnRdW3JlY2VpdmVyLmtleV07XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhbiBldmVudCBjYWxsYmFjayB0aGF0IGdldHMgdHJpZ2dlcmVkIG9ubHkgb25jZS4gSWYgdGhlIGV2ZW50IHdhc1xuICAgICAqIHRyaWdnZXJlZCBiZWZvcmUgeW91ciBjYWxsYmFjayBpcyByZWdpc3RlcmVkLCBpdCBjYWxscyB5b3VyIGNhbGxiYWNrXG4gICAgICogaW1tZWRpYXRlbHkuXG4gICAgICpcbiAgICAgKiBAbm90ZSBUT0RPOiBGaXggdGhlIGRvY3MgZm9yICgpID0+IHZvaWQgc3ludGF4LlxuICAgICAqXG4gICAgICogQHBhcmFtIGV2ZW50XG4gICAgICogIFRoZSBldmVudCBuYW1lLlxuICAgICAqIEBwYXJhbSBjYWxsYmFja1xuICAgICAqICBBIGNhbGxiYWNrIHRvIGF0dGFjaCB0byB0aGlzIGV2ZW50LiBJdCB0YWtlcyBubyBhcmd1bWVudHMuXG4gICAgICovXG4gICAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24gKGV2ZW50LCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVkKGV2ZW50KSkge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub24oZXZlbnQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoIV90aGlzLmVtaXR0ZWQoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFRyaWdnZXIgYW4gZXZlbnQuIENhbGwgYWxsIGNhbGxiYWNrcyBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlIHJlZ2lzdGVyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZXZlbnRcbiAgICAgKiAgVGhlIGV2ZW50IG5hbWUuXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiAgQW4gb2JqZWN0IHRvIHBhc3MgdG8gZXZlcnkgY2FsbGJhY2suXG4gICAgICovXG4gICAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24gKGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhID09PSB2b2lkIDApIHsgZGF0YSA9IG51bGw7IH1cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmV2ZW50UmVjZWl2ZXJzW2V2ZW50XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRSZWNlaXZlcnNbZXZlbnRdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmV2ZW50c0VtaXR0ZWRbZXZlbnRdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhpcy5ldmVudHNFbWl0dGVkW2V2ZW50XSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgayBpbiB0aGlzLmV2ZW50UmVjZWl2ZXJzW2V2ZW50XSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudFJlY2VpdmVyc1tldmVudF1ba10uaGFuZGxlcihkYXRhKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmV2ZW50c0VtaXR0ZWRbZXZlbnRdICs9IDE7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYSBjb3VudCBvZiB0aGUgbnVtYmVyIG9mIHRpbWVzIGFuIGV2ZW50IGhhcyBiZWVuIHRyaWdnZXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBldmVudFxuICAgICAqICBUaGUgZXZlbnQgbmFtZS5cbiAgICAgKi9cbiAgICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXR0ZWQgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmV2ZW50c0VtaXR0ZWRbZXZlbnRdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZXZlbnRzRW1pdHRlZFtldmVudF07XG4gICAgfTtcbiAgICByZXR1cm4gRXZlbnRFbWl0dGVyO1xufSgpKTtcbmV4cG9ydHMuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgYXV0aF8xID0gcmVxdWlyZSgnLi9hdXRoJyk7XG5leHBvcnRzLkF1dGggPSBhdXRoXzEuQXV0aDtcbmV4cG9ydHMuQXV0aFR5cGUgPSBhdXRoXzEuQXV0aFR5cGU7XG5leHBvcnRzLkJhc2ljQXV0aCA9IGF1dGhfMS5CYXNpY0F1dGg7XG5leHBvcnRzLkN1c3RvbUF1dGggPSBhdXRoXzEuQ3VzdG9tQXV0aDtcbmV4cG9ydHMuRmFjZWJvb2tBdXRoID0gYXV0aF8xLkZhY2Vib29rQXV0aDtcbmV4cG9ydHMuR2l0aHViQXV0aCA9IGF1dGhfMS5HaXRodWJBdXRoO1xuZXhwb3J0cy5Hb29nbGVBdXRoID0gYXV0aF8xLkdvb2dsZUF1dGg7XG5leHBvcnRzLkluc3RhZ3JhbUF1dGggPSBhdXRoXzEuSW5zdGFncmFtQXV0aDtcbmV4cG9ydHMuTGlua2VkSW5BdXRoID0gYXV0aF8xLkxpbmtlZEluQXV0aDtcbmV4cG9ydHMuVHdpdHRlckF1dGggPSBhdXRoXzEuVHdpdHRlckF1dGg7XG52YXIgY2xpZW50XzEgPSByZXF1aXJlKCcuL2NsaWVudCcpO1xuZXhwb3J0cy5DbGllbnQgPSBjbGllbnRfMS5DbGllbnQ7XG52YXIgY29uZmlnXzEgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xuZXhwb3J0cy5Db25maWcgPSBjb25maWdfMS5Db25maWc7XG52YXIgY29yZG92YV8xID0gcmVxdWlyZSgnLi9jb3Jkb3ZhJyk7XG5leHBvcnRzLkNvcmRvdmEgPSBjb3Jkb3ZhXzEuQ29yZG92YTtcbnZhciBjb3JlXzEgPSByZXF1aXJlKCcuL2NvcmUnKTtcbmV4cG9ydHMuQ29yZSA9IGNvcmVfMS5Db3JlO1xudmFyIGRlcGxveV8xID0gcmVxdWlyZSgnLi9kZXBsb3kvZGVwbG95Jyk7XG5leHBvcnRzLkRlcGxveSA9IGRlcGxveV8xLkRlcGxveTtcbnZhciBkZXZpY2VfMSA9IHJlcXVpcmUoJy4vZGV2aWNlJyk7XG5leHBvcnRzLkRldmljZSA9IGRldmljZV8xLkRldmljZTtcbnZhciBlcnJvcnNfMSA9IHJlcXVpcmUoJy4vZXJyb3JzJyk7XG5leHBvcnRzLkV4Y2VwdGlvbiA9IGVycm9yc18xLkV4Y2VwdGlvbjtcbmV4cG9ydHMuRGV0YWlsZWRFcnJvciA9IGVycm9yc18xLkRldGFpbGVkRXJyb3I7XG52YXIgZGlfMSA9IHJlcXVpcmUoJy4vZGknKTtcbmV4cG9ydHMuRElDb250YWluZXIgPSBkaV8xLkNvbnRhaW5lcjtcbnZhciBldmVudHNfMSA9IHJlcXVpcmUoJy4vZXZlbnRzJyk7XG5leHBvcnRzLkV2ZW50RW1pdHRlciA9IGV2ZW50c18xLkV2ZW50RW1pdHRlcjtcbnZhciBpbnNpZ2h0c18xID0gcmVxdWlyZSgnLi9pbnNpZ2h0cycpO1xuZXhwb3J0cy5JbnNpZ2h0cyA9IGluc2lnaHRzXzEuSW5zaWdodHM7XG52YXIgbG9nZ2VyXzEgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuZXhwb3J0cy5Mb2dnZXIgPSBsb2dnZXJfMS5Mb2dnZXI7XG52YXIgcHVzaF8xID0gcmVxdWlyZSgnLi9wdXNoL3B1c2gnKTtcbmV4cG9ydHMuUHVzaCA9IHB1c2hfMS5QdXNoO1xudmFyIG1lc3NhZ2VfMSA9IHJlcXVpcmUoJy4vcHVzaC9tZXNzYWdlJyk7XG5leHBvcnRzLlB1c2hNZXNzYWdlID0gbWVzc2FnZV8xLlB1c2hNZXNzYWdlO1xudmFyIHN0b3JhZ2VfMSA9IHJlcXVpcmUoJy4vc3RvcmFnZScpO1xuZXhwb3J0cy5TdG9yYWdlID0gc3RvcmFnZV8xLlN0b3JhZ2U7XG5leHBvcnRzLkxvY2FsU3RvcmFnZVN0cmF0ZWd5ID0gc3RvcmFnZV8xLkxvY2FsU3RvcmFnZVN0cmF0ZWd5O1xuZXhwb3J0cy5TZXNzaW9uU3RvcmFnZVN0cmF0ZWd5ID0gc3RvcmFnZV8xLlNlc3Npb25TdG9yYWdlU3RyYXRlZ3k7XG52YXIgdXNlcl8xID0gcmVxdWlyZSgnLi91c2VyL3VzZXInKTtcbmV4cG9ydHMuVXNlckNvbnRleHQgPSB1c2VyXzEuVXNlckNvbnRleHQ7XG5leHBvcnRzLlVzZXIgPSB1c2VyXzEuVXNlcjtcbmV4cG9ydHMuU2luZ2xlVXNlclNlcnZpY2UgPSB1c2VyXzEuU2luZ2xlVXNlclNlcnZpY2U7XG4iLCJcInVzZSBzdHJpY3RcIjtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgU3RhdCA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gU3RhdChhcHBJZCwgc3RhdCwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB2b2lkIDApIHsgdmFsdWUgPSAxOyB9XG4gICAgICAgIHRoaXMuYXBwSWQgPSBhcHBJZDtcbiAgICAgICAgdGhpcy5zdGF0ID0gc3RhdDtcbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmFwcElkID0gYXBwSWQ7XG4gICAgICAgIHRoaXMuc3RhdCA9IHN0YXQ7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5jcmVhdGVkID0gbmV3IERhdGUoKTtcbiAgICB9XG4gICAgU3RhdC5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXBwX2lkOiB0aGlzLmFwcElkLFxuICAgICAgICAgICAgc3RhdDogdGhpcy5zdGF0LFxuICAgICAgICAgICAgdmFsdWU6IHRoaXMudmFsdWUsXG4gICAgICAgICAgICBjcmVhdGVkOiB0aGlzLmNyZWF0ZWQudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIHJldHVybiBTdGF0O1xufSgpKTtcbmV4cG9ydHMuU3RhdCA9IFN0YXQ7XG4vKipcbiAqIEEgY2xpZW50IGZvciBJbnNpZ2h0cyB0aGF0IGhhbmRsZXMgYmF0Y2hpbmcsIHVzZXIgYWN0aXZpdHkgaW5zaWdodCwgYW5kXG4gKiBzZW5kaW5nIGluc2lnaHRzIGF0IGFuIGludGVydmFsLlxuICpcbiAqIEBoaWRkZW5cbiAqL1xudmFyIEluc2lnaHRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBJbnNpZ2h0cyhkZXBzLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmIChvcHRpb25zID09PSB2b2lkIDApIHsgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICdpbnRlcnZhbFN1Ym1pdCc6IDYwICogMTAwMCxcbiAgICAgICAgICAgICdpbnRlcnZhbEFjdGl2ZUNoZWNrJzogMTAwMCxcbiAgICAgICAgICAgICdzdWJtaXRDb3VudCc6IDEwMFxuICAgICAgICB9OyB9XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMuYXBwID0gZGVwcy5hcHBTdGF0dXM7XG4gICAgICAgIHRoaXMuc3RvcmFnZSA9IGRlcHMuc3RvcmFnZTtcbiAgICAgICAgdGhpcy5jb25maWcgPSBkZXBzLmNvbmZpZztcbiAgICAgICAgdGhpcy5jbGllbnQgPSBkZXBzLmNsaWVudDtcbiAgICAgICAgdGhpcy5sb2dnZXIgPSBkZXBzLmxvZ2dlcjtcbiAgICAgICAgdGhpcy5iYXRjaCA9IFtdO1xuICAgICAgICBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBfdGhpcy5zdWJtaXQoKTtcbiAgICAgICAgfSwgdGhpcy5vcHRpb25zLmludGVydmFsU3VibWl0KTtcbiAgICAgICAgc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCFfdGhpcy5hcHAuY2xvc2VkKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuY2hlY2tBY3Rpdml0eSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzLm9wdGlvbnMuaW50ZXJ2YWxBY3RpdmVDaGVjayk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFRyYWNrIGFuIGluc2lnaHQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc3RhdCAtIFRoZSBpbnNpZ2h0IG5hbWUuXG4gICAgICogQHBhcmFtIHZhbHVlIC0gVGhlIG51bWJlciBieSB3aGljaCB0byBpbmNyZW1lbnQgdGhpcyBpbnNpZ2h0LlxuICAgICAqL1xuICAgIEluc2lnaHRzLnByb3RvdHlwZS50cmFjayA9IGZ1bmN0aW9uIChzdGF0LCB2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgPT09IHZvaWQgMCkgeyB2YWx1ZSA9IDE7IH1cbiAgICAgICAgdGhpcy50cmFja1N0YXQobmV3IFN0YXQodGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKSwgc3RhdCwgdmFsdWUpKTtcbiAgICB9O1xuICAgIEluc2lnaHRzLnByb3RvdHlwZS5jaGVja0FjdGl2aXR5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2Vzc2lvbiA9IHRoaXMuc3RvcmFnZS5nZXQoJ2luc2lnaHRzX3Nlc3Npb24nKTtcbiAgICAgICAgaWYgKCFzZXNzaW9uKSB7XG4gICAgICAgICAgICB0aGlzLm1hcmtBY3RpdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBkID0gbmV3IERhdGUoc2Vzc2lvbik7XG4gICAgICAgICAgICB2YXIgaG91ciA9IDYwICogNjAgKiAxMDAwO1xuICAgICAgICAgICAgaWYgKGQuZ2V0VGltZSgpICsgaG91ciA8IG5ldyBEYXRlKCkuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrQWN0aXZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuICAgIEluc2lnaHRzLnByb3RvdHlwZS5tYXJrQWN0aXZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0b3JhZ2Uuc2V0KCdpbnNpZ2h0c19zZXNzaW9uJywgbmV3IERhdGUoKS50b0lTT1N0cmluZygpKTtcbiAgICAgICAgdGhpcy50cmFjaygnbW9iaWxlYXBwLmFjdGl2ZScpO1xuICAgIH07XG4gICAgSW5zaWdodHMucHJvdG90eXBlLnRyYWNrU3RhdCA9IGZ1bmN0aW9uIChzdGF0KSB7XG4gICAgICAgIHRoaXMuYmF0Y2gucHVzaChzdGF0KTtcbiAgICAgICAgaWYgKHRoaXMuc2hvdWxkU3VibWl0KCkpIHtcbiAgICAgICAgICAgIHRoaXMuc3VibWl0KCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIEluc2lnaHRzLnByb3RvdHlwZS5zaG91bGRTdWJtaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJhdGNoLmxlbmd0aCA+PSB0aGlzLm9wdGlvbnMuc3VibWl0Q291bnQ7XG4gICAgfTtcbiAgICBJbnNpZ2h0cy5wcm90b3R5cGUuc3VibWl0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5iYXRjaC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgaW5zaWdodHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBfYSA9IHRoaXMuYmF0Y2g7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICB2YXIgc3RhdCA9IF9hW19pXTtcbiAgICAgICAgICAgIGluc2lnaHRzLnB1c2goc3RhdC50b0pTT04oKSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jbGllbnQucG9zdCgnL2luc2lnaHRzJylcbiAgICAgICAgICAgIC5zZW5kKHsgJ2luc2lnaHRzJzogaW5zaWdodHMgfSlcbiAgICAgICAgICAgIC5lbmQoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmVycm9yKCdJb25pYyBJbnNpZ2h0czogQ291bGQgbm90IHNlbmQgaW5zaWdodHMuJywgZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuYmF0Y2ggPSBbXTtcbiAgICB9O1xuICAgIHJldHVybiBJbnNpZ2h0cztcbn0oKSk7XG5leHBvcnRzLkluc2lnaHRzID0gSW5zaWdodHM7XG4iLCJcInVzZSBzdHJpY3RcIjtcbi8qKlxuICogU2ltcGxlIGNvbnNvbGUgbG9nZ2VyLlxuICovXG52YXIgTG9nZ2VyID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBMb2dnZXIob3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGZ1bmN0aW9uIHRvIHVzZSB0byBsb2cgaW5mbyBsZXZlbCBtZXNzYWdlcy5cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW5mb2ZuID0gY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmdW5jdGlvbiB0byB1c2UgdG8gbG9nIHdhcm4gbGV2ZWwgbWVzc2FnZXMuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLndhcm5mbiA9IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpO1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGZ1bmN0aW9uIHRvIHVzZSB0byBsb2cgZXJyb3IgbGV2ZWwgbWVzc2FnZXMuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVycm9yZm4gPSBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNlbmQgYSBsb2cgYXQgaW5mbyBsZXZlbC5cbiAgICAgKlxuICAgICAqIEBub3RlIFRPRE86IEZpeCBvcHRpb25hbFBhcmFtcyBpbiBkb2NzLlxuICAgICAqXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSB0byBsb2cuXG4gICAgICovXG4gICAgTG9nZ2VyLnByb3RvdHlwZS5pbmZvID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgdmFyIG9wdGlvbmFsUGFyYW1zID0gW107XG4gICAgICAgIGZvciAodmFyIF9pID0gMTsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICBvcHRpb25hbFBhcmFtc1tfaSAtIDFdID0gYXJndW1lbnRzW19pXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5mb2ZuLmFwcGx5KHRoaXMsIFttZXNzYWdlXS5jb25jYXQob3B0aW9uYWxQYXJhbXMpKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICogU2VuZCBhIGxvZyBhdCB3YXJuIGxldmVsLlxuICAgICAqXG4gICAgICogQG5vdGUgVE9ETzogRml4IG9wdGlvbmFsUGFyYW1zIGluIGRvY3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIHRvIGxvZy5cbiAgICAgKi9cbiAgICBMb2dnZXIucHJvdG90eXBlLndhcm4gPSBmdW5jdGlvbiAobWVzc2FnZSkge1xuICAgICAgICB2YXIgb3B0aW9uYWxQYXJhbXMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgX2kgPSAxOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgIG9wdGlvbmFsUGFyYW1zW19pIC0gMV0gPSBhcmd1bWVudHNbX2ldO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5vcHRpb25zLnNpbGVudCkge1xuICAgICAgICAgICAgdGhpcy53YXJuZm4uYXBwbHkodGhpcywgW21lc3NhZ2VdLmNvbmNhdChvcHRpb25hbFBhcmFtcykpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBTZW5kIGEgbG9nIGF0IGVycm9yIGxldmVsLlxuICAgICAqXG4gICAgICogQG5vdGUgVE9ETzogRml4IG9wdGlvbmFsUGFyYW1zIGluIGRvY3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBtZXNzYWdlIHRvIGxvZy5cbiAgICAgKi9cbiAgICBMb2dnZXIucHJvdG90eXBlLmVycm9yID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgdmFyIG9wdGlvbmFsUGFyYW1zID0gW107XG4gICAgICAgIGZvciAodmFyIF9pID0gMTsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICBvcHRpb25hbFBhcmFtc1tfaSAtIDFdID0gYXJndW1lbnRzW19pXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVycm9yZm4uYXBwbHkodGhpcywgW21lc3NhZ2VdLmNvbmNhdChvcHRpb25hbFBhcmFtcykpO1xuICAgIH07XG4gICAgcmV0dXJuIExvZ2dlcjtcbn0oKSk7XG5leHBvcnRzLkxvZ2dlciA9IExvZ2dlcjtcbiIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gKiBAaGlkZGVuXG4gKi9cbnZhciBEZWZlcnJlZFByb21pc2UgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIERlZmVycmVkUHJvbWlzZSgpIHtcbiAgICAgICAgdGhpcy5pbml0KCk7XG4gICAgfVxuICAgIERlZmVycmVkUHJvbWlzZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgX3RoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgICAgICAgICBfdGhpcy5yZWplY3QgPSByZWplY3Q7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgcmV0dXJuIERlZmVycmVkUHJvbWlzZTtcbn0oKSk7XG5leHBvcnRzLkRlZmVycmVkUHJvbWlzZSA9IERlZmVycmVkUHJvbWlzZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gKiBSZXByZXNlbnRzIGEgcHVzaCBub3RpZmljYXRpb24gc2VudCB0byB0aGUgZGV2aWNlLlxuICpcbiAqIEBmZWF0dXJlZFxuICovXG52YXIgUHVzaE1lc3NhZ2UgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFB1c2hNZXNzYWdlKCkge1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBQdXNoTWVzc2FnZSBmcm9tIHRoZSBwdXNoIHBsdWdpbidzIGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEBoaWRkZW5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhIC0gVGhlIHBsdWdpbidzIG5vdGlmaWNhdGlvbiBvYmplY3QuXG4gICAgICovXG4gICAgUHVzaE1lc3NhZ2UuZnJvbVBsdWdpbkRhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB2YXIgbWVzc2FnZSA9IG5ldyBQdXNoTWVzc2FnZSgpO1xuICAgICAgICBtZXNzYWdlLnJhdyA9IGRhdGE7XG4gICAgICAgIG1lc3NhZ2UudGV4dCA9IGRhdGEubWVzc2FnZTtcbiAgICAgICAgbWVzc2FnZS50aXRsZSA9IGRhdGEudGl0bGU7XG4gICAgICAgIG1lc3NhZ2UuY291bnQgPSBkYXRhLmNvdW50O1xuICAgICAgICBtZXNzYWdlLnNvdW5kID0gZGF0YS5zb3VuZDtcbiAgICAgICAgbWVzc2FnZS5pbWFnZSA9IGRhdGEuaW1hZ2U7XG4gICAgICAgIG1lc3NhZ2UuYXBwID0ge1xuICAgICAgICAgICAgJ2FzbGVlcCc6ICFkYXRhLmFkZGl0aW9uYWxEYXRhLmZvcmVncm91bmQsXG4gICAgICAgICAgICAnY2xvc2VkJzogZGF0YS5hZGRpdGlvbmFsRGF0YS5jb2xkc3RhcnRcbiAgICAgICAgfTtcbiAgICAgICAgbWVzc2FnZS5wYXlsb2FkID0gZGF0YS5hZGRpdGlvbmFsRGF0YVsncGF5bG9hZCddO1xuICAgICAgICByZXR1cm4gbWVzc2FnZTtcbiAgICB9O1xuICAgIFB1c2hNZXNzYWdlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFwiPFB1c2hNZXNzYWdlIFtcXFwiXCIgKyB0aGlzLnRpdGxlICsgXCJcXFwiXT5cIjtcbiAgICB9O1xuICAgIHJldHVybiBQdXNoTWVzc2FnZTtcbn0oKSk7XG5leHBvcnRzLlB1c2hNZXNzYWdlID0gUHVzaE1lc3NhZ2U7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBwcm9taXNlXzEgPSByZXF1aXJlKCcuLi9wcm9taXNlJyk7XG52YXIgbWVzc2FnZV8xID0gcmVxdWlyZSgnLi9tZXNzYWdlJyk7XG4vKipcbiAqIGBQdXNoYCBoYW5kbGVzIHB1c2ggbm90aWZpY2F0aW9ucyBmb3IgdGhpcyBhcHAuXG4gKlxuICogQGZlYXR1cmVkXG4gKi9cbnZhciBQdXNoID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBQdXNoKGRlcHMsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJsb2NrUmVnaXN0cmF0aW9uID0gZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ibG9ja1VucmVnaXN0ZXIgPSBmYWxzZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJsb2NrU2F2ZVRva2VuID0gZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZWdpc3RlcmVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY29uZmlnID0gZGVwcy5jb25maWc7XG4gICAgICAgIHRoaXMuYXV0aCA9IGRlcHMuYXV0aDtcbiAgICAgICAgdGhpcy51c2VyU2VydmljZSA9IGRlcHMudXNlclNlcnZpY2U7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGVwcy5kZXZpY2U7XG4gICAgICAgIHRoaXMuY2xpZW50ID0gZGVwcy5jbGllbnQ7XG4gICAgICAgIHRoaXMuZW1pdHRlciA9IGRlcHMuZW1pdHRlcjtcbiAgICAgICAgdGhpcy5zdG9yYWdlID0gZGVwcy5zdG9yYWdlO1xuICAgICAgICB0aGlzLmxvZ2dlciA9IGRlcHMubG9nZ2VyO1xuICAgICAgICAvLyBDaGVjayBmb3IgdGhlIHJlcXVpcmVkIHZhbHVlcyB0byB1c2UgdGhpcyBzZXJ2aWNlXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5pc0FuZHJvaWQoKSAmJiAhdGhpcy5vcHRpb25zLnNlbmRlcl9pZCkge1xuICAgICAgICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoJ0lvbmljIFB1c2g6IEdDTSBwcm9qZWN0IG51bWJlciBub3QgZm91bmQgKGh0dHA6Ly9kb2NzLmlvbmljLmlvL2RvY3MvcHVzaC1hbmRyb2lkLXNldHVwKScpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb3B0aW9ucy5wbHVnaW5Db25maWcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMucGx1Z2luQ29uZmlnID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzQW5kcm9pZCgpKSB7XG4gICAgICAgICAgICAvLyBpbmplY3QgZ2NtIGtleSBmb3IgUHVzaFBsdWdpblxuICAgICAgICAgICAgaWYgKCFvcHRpb25zLnBsdWdpbkNvbmZpZy5hbmRyb2lkKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wbHVnaW5Db25maWcuYW5kcm9pZCA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFvcHRpb25zLnBsdWdpbkNvbmZpZy5hbmRyb2lkLnNlbmRlcklEKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wbHVnaW5Db25maWcuYW5kcm9pZC5zZW5kZXJJRCA9IHRoaXMub3B0aW9ucy5zZW5kZXJfaWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB9XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFB1c2gucHJvdG90eXBlLCBcInRva2VuXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX3Rva2VuKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdG9rZW4gPSB0aGlzLnN0b3JhZ2UuZ2V0KCdwdXNoX3Rva2VuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdG9rZW47XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICAgICAgaWYgKCF2YWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2UuZGVsZXRlKCdwdXNoX3Rva2VuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2Uuc2V0KCdwdXNoX3Rva2VuJywgdmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3Rva2VuID0gdmFsO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIHRva2VuIHdpdGggdGhlIEFQSS5cbiAgICAgKlxuICAgICAqIFdoZW4gYSB0b2tlbiBpcyBzYXZlZCwgeW91IGNhbiBzZW5kIHB1c2ggbm90aWZpY2F0aW9ucyB0byBpdC4gSWYgYSB1c2VyIGlzXG4gICAgICogbG9nZ2VkIGluLCB0aGUgdG9rZW4gaXMgbGlua2VkIHRvIHRoZW0gYnkgdGhlaXIgSUQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdG9rZW4gLSBUaGUgdG9rZW4uXG4gICAgICogQHBhcmFtIG9wdGlvbnNcbiAgICAgKi9cbiAgICBQdXNoLnByb3RvdHlwZS5zYXZlVG9rZW4gPSBmdW5jdGlvbiAodG9rZW4sIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKG9wdGlvbnMgPT09IHZvaWQgMCkgeyBvcHRpb25zID0ge307IH1cbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTtcbiAgICAgICAgdmFyIHRva2VuRGF0YSA9IHtcbiAgICAgICAgICAgICd0b2tlbic6IHRva2VuLnRva2VuLFxuICAgICAgICAgICAgJ2FwcF9pZCc6IHRoaXMuY29uZmlnLmdldCgnYXBwX2lkJylcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmlnbm9yZV91c2VyKSB7XG4gICAgICAgICAgICB2YXIgdXNlciA9IHRoaXMudXNlclNlcnZpY2UuY3VycmVudCgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuYXV0aC5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgICAgIHRva2VuRGF0YS51c2VyX2lkID0gdXNlci5pZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuYmxvY2tTYXZlVG9rZW4pIHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LnBvc3QoJy9wdXNoL3Rva2VucycpXG4gICAgICAgICAgICAgICAgLnNlbmQodG9rZW5EYXRhKVxuICAgICAgICAgICAgICAgIC5lbmQoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5ibG9ja1NhdmVUb2tlbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuZXJyb3IoJ0lvbmljIFB1c2g6JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5ibG9ja1NhdmVUb2tlbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuaW5mbygnSW9uaWMgUHVzaDogc2F2ZWQgcHVzaCB0b2tlbjogJyArIHRva2VuLnRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRva2VuRGF0YS51c2VyX2lkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuaW5mbygnSW9uaWMgUHVzaDogYWRkZWQgcHVzaCB0b2tlbiB0byB1c2VyOiAnICsgdG9rZW5EYXRhLnVzZXJfaWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRva2VuLmlkID0gcmVzLmJvZHkuZGF0YS5pZDtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW4udHlwZSA9IHJlcy5ib2R5LmRhdGEudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW4uc2F2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHRva2VuKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ0EgdG9rZW4gc2F2ZSBvcGVyYXRpb24gaXMgYWxyZWFkeSBpbiBwcm9ncmVzcy4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgdGhlIGRldmljZSB3aXRoIEdDTS9BUE5TIHRvIGdldCBhIHB1c2ggdG9rZW4uXG4gICAgICpcbiAgICAgKiBBZnRlciBhIGRldmljZSBpcyByZWdpc3RlcmVkLCB5b3Ugd2lsbCBsaWtlbHkgd2FudCB0byBzYXZlIHRoZSB0b2tlbiB3aXRoXG4gICAgICogW2BzYXZlVG9rZW4oKWBdKC9hcGkvY2xpZW50L3B1c2gvI3NhdmVUb2tlbikgdG8gdGhlIEFQSS5cbiAgICAgKi9cbiAgICBQdXNoLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTtcbiAgICAgICAgaWYgKHRoaXMuYmxvY2tSZWdpc3RyYXRpb24pIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ0Fub3RoZXIgcmVnaXN0cmF0aW9uIGlzIGFscmVhZHkgaW4gcHJvZ3Jlc3MuJykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5ibG9ja1JlZ2lzdHJhdGlvbiA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIub25jZSgnZGV2aWNlOnJlYWR5JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBwdXNoUGx1Z2luID0gX3RoaXMuX2dldFB1c2hQbHVnaW4oKTtcbiAgICAgICAgICAgICAgICBpZiAocHVzaFBsdWdpbikge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5wbHVnaW4gPSBwdXNoUGx1Z2luLmluaXQoX3RoaXMub3B0aW9ucy5wbHVnaW5Db25maWcpO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5wbHVnaW4ub24oJ3JlZ2lzdHJhdGlvbicsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5ibG9ja1JlZ2lzdHJhdGlvbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMudG9rZW4gPSB7ICd0b2tlbic6IGRhdGEucmVnaXN0cmF0aW9uSWQgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLnRva2VuLnJlZ2lzdGVyZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShfdGhpcy50b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5fY2FsbGJhY2tSZWdpc3RyYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMucmVnaXN0ZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKCdQdXNoIHBsdWdpbiBub3QgZm91bmQhIFNlZSBsb2dzLicpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEludmFsaWRhdGUgdGhlIGN1cnJlbnQgcHVzaCB0b2tlbi5cbiAgICAgKi9cbiAgICBQdXNoLnByb3RvdHlwZS51bnJlZ2lzdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgcHJvbWlzZV8xLkRlZmVycmVkUHJvbWlzZSgpO1xuICAgICAgICBpZiAoIXRoaXMuYmxvY2tVbnJlZ2lzdGVyKSB7XG4gICAgICAgICAgICB2YXIgcHVzaFRva2VuXzEgPSB0aGlzLnRva2VuO1xuICAgICAgICAgICAgaWYgKCFwdXNoVG9rZW5fMSkge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciB0b2tlbkRhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgICd0b2tlbic6IHB1c2hUb2tlbl8xLnRva2VuLFxuICAgICAgICAgICAgICAgICAgICAnYXBwX2lkJzogdGhpcy5jb25maWcuZ2V0KCdhcHBfaWQnKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGx1Z2luKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnVucmVnaXN0ZXIoZnVuY3Rpb24gKCkgeyB9LCBmdW5jdGlvbiAoKSB7IH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5wb3N0KCcvcHVzaC90b2tlbnMvaW52YWxpZGF0ZScpXG4gICAgICAgICAgICAgICAgICAgIC5zZW5kKHRva2VuRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVuZChmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuYmxvY2tVbnJlZ2lzdGVyID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5lcnJvcignSW9uaWMgUHVzaDonLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuaW5mbygnSW9uaWMgUHVzaDogdW5yZWdpc3RlcmVkIHB1c2ggdG9rZW46ICcgKyBwdXNoVG9rZW5fMS50b2tlbik7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy50b2tlbiA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ0FuIHVucmVnaXN0ZXIgb3BlcmF0aW9uIGlzIGFscmVhZHkgaW4gcHJvZ3Jlc3MuJykpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYmxvY2tVbnJlZ2lzdGVyID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIFB1c2gucHJvdG90eXBlLl9jYWxsYmFja1JlZ2lzdHJhdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5wbHVnaW4ub24oJ3JlZ2lzdHJhdGlvbicsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICBfdGhpcy50b2tlbiA9IHsgJ3Rva2VuJzogZGF0YS5yZWdpc3RyYXRpb25JZCB9O1xuICAgICAgICAgICAgaWYgKF90aGlzLm9wdGlvbnMuZGVidWcpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuaW5mbygnSW9uaWMgUHVzaCAoZGVidWcpOiBkZXZpY2UgdG9rZW4gcmVnaXN0ZXJlZDogJyArIF90aGlzLnRva2VuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF90aGlzLmVtaXR0ZXIuZW1pdCgncHVzaDpyZWdpc3RlcicsIF90aGlzLnRva2VuKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucGx1Z2luLm9uKCdub3RpZmljYXRpb24nLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSBtZXNzYWdlXzEuUHVzaE1lc3NhZ2UuZnJvbVBsdWdpbkRhdGEoZGF0YSk7XG4gICAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5kZWJ1Zykge1xuICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5pbmZvKCdJb25pYyBQdXNoIChkZWJ1Zyk6IG5vdGlmaWNhdGlvbiByZWNlaXZlZDogJyArIG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3RoaXMuZW1pdHRlci5lbWl0KCdwdXNoOm5vdGlmaWNhdGlvbicsIHsgJ21lc3NhZ2UnOiBtZXNzYWdlLCAncmF3JzogZGF0YSB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucGx1Z2luLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5kZWJ1Zykge1xuICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5lcnJvcignSW9uaWMgUHVzaCAoZGVidWcpOiB1bmV4cGVjdGVkIGVycm9yIG9jY3VyZWQuJyk7XG4gICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmVycm9yKCdJb25pYyBQdXNoOicsIGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3RoaXMuZW1pdHRlci5lbWl0KCdwdXNoOmVycm9yJywgeyAnZXJyJzogZSB9KTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIFB1c2gucHJvdG90eXBlLl9nZXRQdXNoUGx1Z2luID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcGx1Z2luID0gd2luZG93LlB1c2hOb3RpZmljYXRpb247XG4gICAgICAgIGlmICghcGx1Z2luKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5kZXZpY2UuaXNJT1MoKSB8fCB0aGlzLmRldmljZS5pc0FuZHJvaWQoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdJb25pYyBQdXNoOiBQdXNoTm90aWZpY2F0aW9uIHBsdWdpbiBpcyByZXF1aXJlZC4gSGF2ZSB5b3UgcnVuIGBpb25pYyBwbHVnaW4gYWRkIHBob25lZ2FwLXBsdWdpbi1wdXNoYCA/Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZ2dlci53YXJuKCdJb25pYyBQdXNoOiBEaXNhYmxlZCEgTmF0aXZlIHB1c2ggbm90aWZpY2F0aW9ucyB3aWxsIG5vdCB3b3JrIGluIGEgYnJvd3Nlci4gUnVuIHlvdXIgYXBwIG9uIGFuIGFjdHVhbCBkZXZpY2UgdG8gdXNlIHB1c2guJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBsdWdpbjtcbiAgICB9O1xuICAgIHJldHVybiBQdXNoO1xufSgpKTtcbmV4cG9ydHMuUHVzaCA9IFB1c2g7XG4iLCJcInVzZSBzdHJpY3RcIjtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgTG9jYWxTdG9yYWdlU3RyYXRlZ3kgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIExvY2FsU3RvcmFnZVN0cmF0ZWd5KCkge1xuICAgIH1cbiAgICBMb2NhbFN0b3JhZ2VTdHJhdGVneS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtcbiAgICB9O1xuICAgIExvY2FsU3RvcmFnZVN0cmF0ZWd5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCB2YWx1ZSk7XG4gICAgfTtcbiAgICBMb2NhbFN0b3JhZ2VTdHJhdGVneS5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4gbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcbiAgICB9O1xuICAgIHJldHVybiBMb2NhbFN0b3JhZ2VTdHJhdGVneTtcbn0oKSk7XG5leHBvcnRzLkxvY2FsU3RvcmFnZVN0cmF0ZWd5ID0gTG9jYWxTdG9yYWdlU3RyYXRlZ3k7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIFNlc3Npb25TdG9yYWdlU3RyYXRlZ3kgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFNlc3Npb25TdG9yYWdlU3RyYXRlZ3koKSB7XG4gICAgfVxuICAgIFNlc3Npb25TdG9yYWdlU3RyYXRlZ3kucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oa2V5KTtcbiAgICB9O1xuICAgIFNlc3Npb25TdG9yYWdlU3RyYXRlZ3kucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBzZXNzaW9uU3RvcmFnZS5zZXRJdGVtKGtleSwgdmFsdWUpO1xuICAgIH07XG4gICAgU2Vzc2lvblN0b3JhZ2VTdHJhdGVneS5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4gc2Vzc2lvblN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgIH07XG4gICAgcmV0dXJuIFNlc3Npb25TdG9yYWdlU3RyYXRlZ3k7XG59KCkpO1xuZXhwb3J0cy5TZXNzaW9uU3RvcmFnZVN0cmF0ZWd5ID0gU2Vzc2lvblN0b3JhZ2VTdHJhdGVneTtcbi8qKlxuICogQSBnZW5lcmljIGxvY2FsL3Nlc3Npb24gc3RvcmFnZSBhYnN0cmFjdGlvbi5cbiAqL1xudmFyIFN0b3JhZ2UgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFN0b3JhZ2UoZGVwcywgb3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7ICdwcmVmaXgnOiAnaW9uaWMnLCAnY2FjaGUnOiB0cnVlIH07IH1cbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5zdHJhdGVneSA9IGRlcHMuc3RyYXRlZ3k7XG4gICAgICAgIHRoaXMuc3RvcmFnZUNhY2hlID0ge307XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNldCBhIHZhbHVlIGluIHRoZSBzdG9yYWdlIGJ5IHRoZSBnaXZlbiBrZXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ga2V5IC0gVGhlIHN0b3JhZ2Uga2V5IHRvIHNldC5cbiAgICAgKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gc2V0LiAoTXVzdCBiZSBKU09OLXNlcmlhbGl6YWJsZSkuXG4gICAgICovXG4gICAgU3RvcmFnZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAga2V5ID0gdGhpcy5zdGFuZGFyZGl6ZUtleShrZXkpO1xuICAgICAgICB2YXIganNvbiA9IEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbiAgICAgICAgdGhpcy5zdHJhdGVneS5zZXQoa2V5LCBqc29uKTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5jYWNoZSkge1xuICAgICAgICAgICAgdGhpcy5zdG9yYWdlQ2FjaGVba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSB2YWx1ZSBmcm9tIHRoZSBzdG9yYWdlIGJ5IHRoZSBnaXZlbiBrZXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ga2V5IC0gVGhlIHN0b3JhZ2Uga2V5IHRvIGRlbGV0ZS5cbiAgICAgKi9cbiAgICBTdG9yYWdlLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGtleSA9IHRoaXMuc3RhbmRhcmRpemVLZXkoa2V5KTtcbiAgICAgICAgdGhpcy5zdHJhdGVneS5kZWxldGUoa2V5KTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5jYWNoZSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuc3RvcmFnZUNhY2hlW2tleV07XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEdldCBhIHZhbHVlIGZyb20gdGhlIHN0b3JhZ2UgYnkgdGhlIGdpdmVuIGtleS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBrZXkgLSBUaGUgc3RvcmFnZSBrZXkgdG8gZ2V0LlxuICAgICAqL1xuICAgIFN0b3JhZ2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAga2V5ID0gdGhpcy5zdGFuZGFyZGl6ZUtleShrZXkpO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmNhY2hlKSB7XG4gICAgICAgICAgICB2YXIgY2FjaGVkID0gdGhpcy5zdG9yYWdlQ2FjaGVba2V5XTtcbiAgICAgICAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FjaGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBqc29uID0gdGhpcy5zdHJhdGVneS5nZXQoa2V5KTtcbiAgICAgICAgaWYgKCFqc29uKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gSlNPTi5wYXJzZShqc29uKTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuY2FjaGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2VDYWNoZVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgU3RvcmFnZS5wcm90b3R5cGUuc3RhbmRhcmRpemVLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMucHJlZml4ICsgXCJfXCIgKyBrZXk7XG4gICAgfTtcbiAgICByZXR1cm4gU3RvcmFnZTtcbn0oKSk7XG5leHBvcnRzLlN0b3JhZ2UgPSBTdG9yYWdlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgZGF0YVR5cGVNYXBwaW5nID0ge307XG52YXIgRGF0YVR5cGVTY2hlbWEgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIERhdGFUeXBlU2NoZW1hKHByb3BlcnRpZXMpIHtcbiAgICAgICAgdGhpcy5kYXRhID0ge307XG4gICAgICAgIHRoaXMuc2V0UHJvcGVydGllcyhwcm9wZXJ0aWVzKTtcbiAgICB9XG4gICAgRGF0YVR5cGVTY2hlbWEucHJvdG90eXBlLnNldFByb3BlcnRpZXMgPSBmdW5jdGlvbiAocHJvcGVydGllcykge1xuICAgICAgICBpZiAocHJvcGVydGllcyBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICAgICAgZm9yICh2YXIgeCBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhW3hdID0gcHJvcGVydGllc1t4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgRGF0YVR5cGVTY2hlbWEucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnX19Jb25pY19EYXRhVHlwZVNjaGVtYSc6IGRhdGEubmFtZSxcbiAgICAgICAgICAgICd2YWx1ZSc6IGRhdGEudmFsdWVcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIERhdGFUeXBlU2NoZW1hLnByb3RvdHlwZS5pc1ZhbGlkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5kYXRhLm5hbWUgJiYgdGhpcy5kYXRhLnZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcbiAgICByZXR1cm4gRGF0YVR5cGVTY2hlbWE7XG59KCkpO1xuZXhwb3J0cy5EYXRhVHlwZVNjaGVtYSA9IERhdGFUeXBlU2NoZW1hO1xudmFyIERhdGFUeXBlID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBEYXRhVHlwZSgpIHtcbiAgICB9XG4gICAgRGF0YVR5cGUuZ2V0ID0gZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIGlmIChkYXRhVHlwZU1hcHBpbmdbbmFtZV0pIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgZGF0YVR5cGVNYXBwaW5nW25hbWVdKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcbiAgICBEYXRhVHlwZS5nZXRNYXBwaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZGF0YVR5cGVNYXBwaW5nO1xuICAgIH07XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KERhdGFUeXBlLCBcIlNjaGVtYVwiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIERhdGFUeXBlU2NoZW1hO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBEYXRhVHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uIChuYW1lLCBjbHMpIHtcbiAgICAgICAgZGF0YVR5cGVNYXBwaW5nW25hbWVdID0gY2xzO1xuICAgIH07XG4gICAgcmV0dXJuIERhdGFUeXBlO1xufSgpKTtcbmV4cG9ydHMuRGF0YVR5cGUgPSBEYXRhVHlwZTtcbnZhciBVbmlxdWVBcnJheSA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gVW5pcXVlQXJyYXkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gW107XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgICBmb3IgKHZhciB4IGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wdXNoKHZhbHVlW3hdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBVbmlxdWVBcnJheS5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICAgICAgdmFyIHNjaGVtYSA9IG5ldyBEYXRhVHlwZVNjaGVtYSh7ICduYW1lJzogJ1VuaXF1ZUFycmF5JywgJ3ZhbHVlJzogZGF0YSB9KTtcbiAgICAgICAgcmV0dXJuIHNjaGVtYS50b0pTT04oKTtcbiAgICB9O1xuICAgIFVuaXF1ZUFycmF5LmZyb21TdG9yYWdlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBuZXcgVW5pcXVlQXJyYXkodmFsdWUpO1xuICAgIH07XG4gICAgVW5pcXVlQXJyYXkucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YS5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgVW5pcXVlQXJyYXkucHJvdG90eXBlLnB1bGwgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5kYXRhLmluZGV4T2YodmFsdWUpO1xuICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9O1xuICAgIHJldHVybiBVbmlxdWVBcnJheTtcbn0oKSk7XG5leHBvcnRzLlVuaXF1ZUFycmF5ID0gVW5pcXVlQXJyYXk7XG5EYXRhVHlwZS5yZWdpc3RlcignVW5pcXVlQXJyYXknLCBVbmlxdWVBcnJheSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBwcm9taXNlXzEgPSByZXF1aXJlKCcuLi9wcm9taXNlJyk7XG52YXIgZGF0YV90eXBlc18xID0gcmVxdWlyZSgnLi9kYXRhLXR5cGVzJyk7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIFVzZXJDb250ZXh0ID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBVc2VyQ29udGV4dChkZXBzKSB7XG4gICAgICAgIHRoaXMuY29uZmlnID0gZGVwcy5jb25maWc7XG4gICAgICAgIHRoaXMuc3RvcmFnZSA9IGRlcHMuc3RvcmFnZTtcbiAgICB9XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFVzZXJDb250ZXh0LnByb3RvdHlwZSwgXCJsYWJlbFwiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICd1c2VyXycgKyB0aGlzLmNvbmZpZy5nZXQoJ2FwcF9pZCcpO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBVc2VyQ29udGV4dC5wcm90b3R5cGUudW5zdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zdG9yYWdlLmRlbGV0ZSh0aGlzLmxhYmVsKTtcbiAgICB9O1xuICAgIFVzZXJDb250ZXh0LnByb3RvdHlwZS5zdG9yZSA9IGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgIHRoaXMuc3RvcmFnZS5zZXQodGhpcy5sYWJlbCwgdXNlci5zZXJpYWxpemVGb3JTdG9yYWdlKCkpO1xuICAgIH07XG4gICAgVXNlckNvbnRleHQucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbiAodXNlcikge1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuc3RvcmFnZS5nZXQodGhpcy5sYWJlbCk7XG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICB1c2VyLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHVzZXIuZGF0YSA9IG5ldyBVc2VyRGF0YShkYXRhLmRhdGEpO1xuICAgICAgICAgICAgdXNlci5kZXRhaWxzID0gZGF0YS5kZXRhaWxzIHx8IHt9O1xuICAgICAgICAgICAgdXNlci5zb2NpYWwgPSBkYXRhLnNvY2lhbCB8fCB7fTtcbiAgICAgICAgICAgIHVzZXIuZnJlc2ggPSBkYXRhLmZyZXNoO1xuICAgICAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH07XG4gICAgcmV0dXJuIFVzZXJDb250ZXh0O1xufSgpKTtcbmV4cG9ydHMuVXNlckNvbnRleHQgPSBVc2VyQ29udGV4dDtcbi8qKlxuICogQGhpZGRlblxuICovXG52YXIgVXNlckRhdGEgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFVzZXJEYXRhKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEgPT09IHZvaWQgMCkgeyBkYXRhID0ge307IH1cbiAgICAgICAgdGhpcy5kYXRhID0ge307XG4gICAgICAgIGlmICgodHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSkge1xuICAgICAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgIHRoaXMuZGVzZXJpYWxpemVEYXRhVHlwZXMoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBVc2VyRGF0YS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVtrZXldO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRWYWx1ZSA9PT0gMCB8fCBkZWZhdWx0VmFsdWUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZhdWx0VmFsdWUgfHwgbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG4gICAgVXNlckRhdGEucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZGF0YVtrZXldID0gdmFsdWU7XG4gICAgfTtcbiAgICBVc2VyRGF0YS5wcm90b3R5cGUudW5zZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmRhdGFba2V5XTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgVXNlckRhdGEucHJvdG90eXBlLmRlc2VyaWFsaXplRGF0YVR5cGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5kYXRhKSB7XG4gICAgICAgICAgICBmb3IgKHZhciB4IGluIHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgYW4gb2JqZWN0LCBsZXQncyBjaGVjayBmb3IgY3VzdG9tIGRhdGEgdHlwZXNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kYXRhW3hdICYmIHR5cGVvZiB0aGlzLmRhdGFbeF0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRvIHdlIGhhdmUgYSBjdXN0b20gdHlwZT9cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZGF0YVt4XS5fX0lvbmljX0RhdGFUeXBlU2NoZW1hKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IHRoaXMuZGF0YVt4XS5fX0lvbmljX0RhdGFUeXBlU2NoZW1hO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1hcHBpbmcgPSBkYXRhX3R5cGVzXzEuRGF0YVR5cGUuZ2V0TWFwcGluZygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hcHBpbmdbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGEgY3VzdG9tIHR5cGUgYW5kIGEgcmVnaXN0ZXJlZCBjbGFzcywgZ2l2ZSB0aGUgY3VzdG9tIGRhdGEgdHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZyb20gc3RvcmFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YVt4XSA9IG1hcHBpbmdbbmFtZV0uZnJvbVN0b3JhZ2UodGhpcy5kYXRhW3hdLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIFVzZXJEYXRhO1xufSgpKTtcbmV4cG9ydHMuVXNlckRhdGEgPSBVc2VyRGF0YTtcbi8qKlxuICogUmVwcmVzZW50cyBhIHVzZXIgb2YgdGhlIGFwcC5cbiAqXG4gKiBAZmVhdHVyZWRcbiAqL1xudmFyIFVzZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFVzZXIoZGVwcykge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGRldGFpbHMgKGVtYWlsLCBwYXNzd29yZCwgZXRjKSBvZiB0aGlzIHVzZXIuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmRldGFpbHMgPSB7fTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzb2NpYWwgZGV0YWlscyBvZiB0aGlzIHVzZXIuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNvY2lhbCA9IHt9O1xuICAgICAgICB0aGlzLnNlcnZpY2UgPSBkZXBzLnNlcnZpY2U7XG4gICAgICAgIHRoaXMuZnJlc2ggPSB0cnVlO1xuICAgICAgICB0aGlzLl91bnNldCA9IHt9O1xuICAgICAgICB0aGlzLmRhdGEgPSBuZXcgVXNlckRhdGEoKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2hlY2sgd2hldGhlciB0aGlzIHVzZXIgaXMgYW5vbnltb3VzIG9yIG5vdC5cbiAgICAgKlxuICAgICAqIElmIHRoZSBgaWRgIHByb3BlcnR5IGlzIHNldCwgdGhlIHVzZXIgaXMgbm8gbG9uZ2VyIGFub255bW91cy5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS5pc0Fub255bW91cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmlkKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICogR2V0IGEgdmFsdWUgZnJvbSB0aGlzIHVzZXIncyBjdXN0b20gZGF0YS5cbiAgICAgKlxuICAgICAqIE9wdGlvbmFsbHksIGEgZGVmYXVsdCB2YWx1ZSBjYW4gYmUgcHJvdmlkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ga2V5IC0gVGhlIGRhdGEga2V5IHRvIGdldC5cbiAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIC0gVGhlIHZhbHVlIHRvIHJldHVybiBpZiB0aGUga2V5IGlzIGFic2VudC5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5LCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5nZXQoa2V5LCBkZWZhdWx0VmFsdWUpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogU2V0IGEgdmFsdWUgaW4gdGhpcyB1c2VyJ3MgY3VzdG9tIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ga2V5IC0gVGhlIGRhdGEga2V5IHRvIHNldC5cbiAgICAgKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gc2V0LlxuICAgICAqL1xuICAgIFVzZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl91bnNldFtrZXldO1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLnNldChrZXksIHZhbHVlKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIHZhbHVlIGZyb20gdGhpcyB1c2VyJ3MgY3VzdG9tIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ga2V5IC0gVGhlIGRhdGEga2V5IHRvIGRlbGV0ZS5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS51bnNldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgdGhpcy5fdW5zZXRba2V5XSA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEudW5zZXQoa2V5KTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFJldmVydCB0aGlzIHVzZXIgdG8gYSBmcmVzaCwgYW5vbnltb3VzIHN0YXRlLlxuICAgICAqL1xuICAgIFVzZXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgdGhpcy5kYXRhID0gbmV3IFVzZXJEYXRhKCk7XG4gICAgICAgIHRoaXMuZGV0YWlscyA9IHt9O1xuICAgICAgICB0aGlzLmZyZXNoID0gdHJ1ZTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFNhdmUgdGhpcyB1c2VyIHRvIHRoZSBBUEkuXG4gICAgICovXG4gICAgVXNlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fdW5zZXQgPSB7fTtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VydmljZS5zYXZlKCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBEZWxldGUgdGhpcyB1c2VyIGZyb20gdGhlIEFQSS5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlcnZpY2UuZGVsZXRlKCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBMb2FkIHRoZSB1c2VyIGZyb20gdGhlIEFQSSwgb3ZlcndyaXRpbmcgdGhlIGxvY2FsIHVzZXIncyBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIGlkIC0gVGhlIHVzZXIgSUQgdG8gbG9hZCBpbnRvIHRoaXMgdXNlci5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlcnZpY2UubG9hZChpZCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBTdG9yZSB0aGlzIHVzZXIgaW4gbG9jYWwgc3RvcmFnZS5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS5zdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXJ2aWNlLnN0b3JlKCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhpcyB1c2VyIGZyb20gbG9jYWwgc3RvcmFnZS5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS51bnN0b3JlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNlcnZpY2UudW5zdG9yZSgpO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogQGhpZGRlblxuICAgICAqL1xuICAgIFVzZXIucHJvdG90eXBlLnNlcmlhbGl6ZUZvckFQSSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdlbWFpbCc6IHRoaXMuZGV0YWlscy5lbWFpbCxcbiAgICAgICAgICAgICdwYXNzd29yZCc6IHRoaXMuZGV0YWlscy5wYXNzd29yZCxcbiAgICAgICAgICAgICd1c2VybmFtZSc6IHRoaXMuZGV0YWlscy51c2VybmFtZSxcbiAgICAgICAgICAgICdpbWFnZSc6IHRoaXMuZGV0YWlscy5pbWFnZSxcbiAgICAgICAgICAgICduYW1lJzogdGhpcy5kZXRhaWxzLm5hbWUsXG4gICAgICAgICAgICAnY3VzdG9tJzogdGhpcy5kYXRhLmRhdGFcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBoaWRkZW5cbiAgICAgKi9cbiAgICBVc2VyLnByb3RvdHlwZS5zZXJpYWxpemVGb3JTdG9yYWdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ2lkJzogdGhpcy5pZCxcbiAgICAgICAgICAgICdkYXRhJzogdGhpcy5kYXRhLmRhdGEsXG4gICAgICAgICAgICAnZGV0YWlscyc6IHRoaXMuZGV0YWlscyxcbiAgICAgICAgICAgICdmcmVzaCc6IHRoaXMuZnJlc2gsXG4gICAgICAgICAgICAnc29jaWFsJzogdGhpcy5zb2NpYWxcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIFVzZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXCI8VXNlciBbXCIgKyAodGhpcy5pc0Fub255bW91cygpID8gJ2Fub255bW91cycgOiB0aGlzLmlkKSArIFwiXT5cIjtcbiAgICB9O1xuICAgIHJldHVybiBVc2VyO1xufSgpKTtcbmV4cG9ydHMuVXNlciA9IFVzZXI7XG4vKipcbiAqIEBoaWRkZW5cbiAqL1xudmFyIFNpbmdsZVVzZXJTZXJ2aWNlID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBTaW5nbGVVc2VyU2VydmljZShkZXBzLCBjb25maWcpIHtcbiAgICAgICAgaWYgKGNvbmZpZyA9PT0gdm9pZCAwKSB7IGNvbmZpZyA9IHt9OyB9XG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgICAgICB0aGlzLmNsaWVudCA9IGRlcHMuY2xpZW50O1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBkZXBzLmNvbnRleHQ7XG4gICAgfVxuICAgIFNpbmdsZVVzZXJTZXJ2aWNlLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMudXNlcikge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdGhpcy5jb250ZXh0LmxvYWQobmV3IFVzZXIoeyAnc2VydmljZSc6IHRoaXMgfSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy51c2VyKSB7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBuZXcgVXNlcih7ICdzZXJ2aWNlJzogdGhpcyB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy51c2VyO1xuICAgIH07XG4gICAgU2luZ2xlVXNlclNlcnZpY2UucHJvdG90eXBlLnN0b3JlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmNvbnRleHQuc3RvcmUodGhpcy5jdXJyZW50KCkpO1xuICAgIH07XG4gICAgU2luZ2xlVXNlclNlcnZpY2UucHJvdG90eXBlLnVuc3RvcmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC51bnN0b3JlKCk7XG4gICAgfTtcbiAgICBTaW5nbGVVc2VyU2VydmljZS5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uIChpZCkge1xuICAgICAgICBpZiAoaWQgPT09IHZvaWQgMCkgeyBpZCA9ICdzZWxmJzsgfVxuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgcHJvbWlzZV8xLkRlZmVycmVkUHJvbWlzZSgpO1xuICAgICAgICB2YXIgdXNlciA9IHRoaXMuY3VycmVudCgpO1xuICAgICAgICB0aGlzLmNsaWVudC5nZXQoXCIvdXNlcnMvXCIgKyBpZClcbiAgICAgICAgICAgIC5lbmQoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1c2VyLmlkID0gcmVzLmJvZHkuZGF0YS51dWlkO1xuICAgICAgICAgICAgICAgIHVzZXIuZGF0YSA9IG5ldyBVc2VyRGF0YShyZXMuYm9keS5kYXRhLmN1c3RvbSk7XG4gICAgICAgICAgICAgICAgdXNlci5kZXRhaWxzID0gcmVzLmJvZHkuZGF0YS5kZXRhaWxzO1xuICAgICAgICAgICAgICAgIHVzZXIuZnJlc2ggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB1c2VyLnNvY2lhbCA9IHJlcy5ib2R5LmRhdGEuc29jaWFsO1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG4gICAgU2luZ2xlVXNlclNlcnZpY2UucHJvdG90eXBlLmRlbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gbmV3IHByb21pc2VfMS5EZWZlcnJlZFByb21pc2UoKTtcbiAgICAgICAgaWYgKHRoaXMudXNlci5pc0Fub255bW91cygpKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKCdVc2VyIGlzIGFub255bW91cyBhbmQgY2Fubm90IGJlIGRlbGV0ZWQgZnJvbSB0aGUgQVBJLicpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudW5zdG9yZSgpO1xuICAgICAgICAgICAgdGhpcy5jbGllbnQuZGVsZXRlKFwiL3VzZXJzL1wiICsgdGhpcy51c2VyLmlkKVxuICAgICAgICAgICAgICAgIC5lbmQoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuICAgIFNpbmdsZVVzZXJTZXJ2aWNlLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBuZXcgcHJvbWlzZV8xLkRlZmVycmVkUHJvbWlzZSgpO1xuICAgICAgICB0aGlzLnN0b3JlKCk7XG4gICAgICAgIGlmICh0aGlzLnVzZXIuaXNBbm9ueW1vdXMoKSkge1xuICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcignVXNlciBpcyBhbm9ueW1vdXMgYW5kIGNhbm5vdCBiZSB1cGRhdGVkIGluIHRoZSBBUEkuIFVzZSBsb2FkKDxpZD4pIG9yIHNpZ251cCBhIHVzZXIgdXNpbmcgYXV0aC4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5wYXRjaChcIi91c2Vycy9cIiArIHRoaXMudXNlci5pZClcbiAgICAgICAgICAgICAgICAuc2VuZCh0aGlzLnVzZXIuc2VyaWFsaXplRm9yQVBJKCkpXG4gICAgICAgICAgICAgICAgLmVuZChmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMudXNlci5mcmVzaCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcbiAgICByZXR1cm4gU2luZ2xlVXNlclNlcnZpY2U7XG59KCkpO1xuZXhwb3J0cy5TaW5nbGVVc2VyU2VydmljZSA9IFNpbmdsZVVzZXJTZXJ2aWNlO1xuIiwiXHJcbi8qKlxyXG4gKiBFeHBvc2UgYEVtaXR0ZXJgLlxyXG4gKi9cclxuXHJcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xyXG4gIG1vZHVsZS5leHBvcnRzID0gRW1pdHRlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEluaXRpYWxpemUgYSBuZXcgYEVtaXR0ZXJgLlxyXG4gKlxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIEVtaXR0ZXIob2JqKSB7XHJcbiAgaWYgKG9iaikgcmV0dXJuIG1peGluKG9iaik7XHJcbn07XHJcblxyXG4vKipcclxuICogTWl4aW4gdGhlIGVtaXR0ZXIgcHJvcGVydGllcy5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IG9ialxyXG4gKiBAcmV0dXJuIHtPYmplY3R9XHJcbiAqIEBhcGkgcHJpdmF0ZVxyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIG1peGluKG9iaikge1xyXG4gIGZvciAodmFyIGtleSBpbiBFbWl0dGVyLnByb3RvdHlwZSkge1xyXG4gICAgb2JqW2tleV0gPSBFbWl0dGVyLnByb3RvdHlwZVtrZXldO1xyXG4gIH1cclxuICByZXR1cm4gb2JqO1xyXG59XHJcblxyXG4vKipcclxuICogTGlzdGVuIG9uIHRoZSBnaXZlbiBgZXZlbnRgIHdpdGggYGZuYC5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUub24gPVxyXG5FbWl0dGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcbiAgKHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdKVxyXG4gICAgLnB1c2goZm4pO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgYW4gYGV2ZW50YCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBhIHNpbmdsZVxyXG4gKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuICogQHJldHVybiB7RW1pdHRlcn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5FbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcclxuICBmdW5jdGlvbiBvbigpIHtcclxuICAgIHRoaXMub2ZmKGV2ZW50LCBvbik7XHJcbiAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gIH1cclxuXHJcbiAgb24uZm4gPSBmbjtcclxuICB0aGlzLm9uKGV2ZW50LCBvbik7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVtb3ZlIHRoZSBnaXZlbiBjYWxsYmFjayBmb3IgYGV2ZW50YCBvciBhbGxcclxuICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLm9mZiA9XHJcbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID1cclxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID1cclxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50LCBmbil7XHJcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xyXG5cclxuICAvLyBhbGxcclxuICBpZiAoMCA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XHJcbiAgICB0aGlzLl9jYWxsYmFja3MgPSB7fTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLy8gc3BlY2lmaWMgZXZlbnRcclxuICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcclxuICBpZiAoIWNhbGxiYWNrcykgcmV0dXJuIHRoaXM7XHJcblxyXG4gIC8vIHJlbW92ZSBhbGwgaGFuZGxlcnNcclxuICBpZiAoMSA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XHJcbiAgICBkZWxldGUgdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLy8gcmVtb3ZlIHNwZWNpZmljIGhhbmRsZXJcclxuICB2YXIgY2I7XHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcclxuICAgIGNiID0gY2FsbGJhY2tzW2ldO1xyXG4gICAgaWYgKGNiID09PSBmbiB8fCBjYi5mbiA9PT0gZm4pIHtcclxuICAgICAgY2FsbGJhY2tzLnNwbGljZShpLCAxKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEVtaXQgYGV2ZW50YCB3aXRoIHRoZSBnaXZlbiBhcmdzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHBhcmFtIHtNaXhlZH0gLi4uXHJcbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KXtcclxuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XHJcbiAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcclxuICAgICwgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcclxuXHJcbiAgaWYgKGNhbGxiYWNrcykge1xyXG4gICAgY2FsbGJhY2tzID0gY2FsbGJhY2tzLnNsaWNlKDApO1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xyXG4gICAgICBjYWxsYmFja3NbaV0uYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYXJyYXkgb2YgY2FsbGJhY2tzIGZvciBgZXZlbnRgLlxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuICogQHJldHVybiB7QXJyYXl9XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuRW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24oZXZlbnQpe1xyXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcclxuICByZXR1cm4gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSB8fCBbXTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVjayBpZiB0aGlzIGVtaXR0ZXIgaGFzIGBldmVudGAgaGFuZGxlcnMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG4gKiBAcmV0dXJuIHtCb29sZWFufVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbkVtaXR0ZXIucHJvdG90eXBlLmhhc0xpc3RlbmVycyA9IGZ1bmN0aW9uKGV2ZW50KXtcclxuICByZXR1cm4gISEgdGhpcy5saXN0ZW5lcnMoZXZlbnQpLmxlbmd0aDtcclxufTtcclxuIiwiXG4vKipcbiAqIFJlZHVjZSBgYXJyYCB3aXRoIGBmbmAuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gYXJyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHBhcmFtIHtNaXhlZH0gaW5pdGlhbFxuICpcbiAqIFRPRE86IGNvbWJhdGlibGUgZXJyb3IgaGFuZGxpbmc/XG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhcnIsIGZuLCBpbml0aWFsKXsgIFxuICB2YXIgaWR4ID0gMDtcbiAgdmFyIGxlbiA9IGFyci5sZW5ndGg7XG4gIHZhciBjdXJyID0gYXJndW1lbnRzLmxlbmd0aCA9PSAzXG4gICAgPyBpbml0aWFsXG4gICAgOiBhcnJbaWR4KytdO1xuXG4gIHdoaWxlIChpZHggPCBsZW4pIHtcbiAgICBjdXJyID0gZm4uY2FsbChudWxsLCBjdXJyLCBhcnJbaWR4XSwgKytpZHgsIGFycik7XG4gIH1cbiAgXG4gIHJldHVybiBjdXJyO1xufTsiLCIvKipcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIEVtaXR0ZXIgPSByZXF1aXJlKCdlbWl0dGVyJyk7XG52YXIgcmVkdWNlID0gcmVxdWlyZSgncmVkdWNlJyk7XG52YXIgcmVxdWVzdEJhc2UgPSByZXF1aXJlKCcuL3JlcXVlc3QtYmFzZScpO1xudmFyIGlzT2JqZWN0ID0gcmVxdWlyZSgnLi9pcy1vYmplY3QnKTtcblxuLyoqXG4gKiBSb290IHJlZmVyZW5jZSBmb3IgaWZyYW1lcy5cbiAqL1xuXG52YXIgcm9vdDtcbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgeyAvLyBCcm93c2VyIHdpbmRvd1xuICByb290ID0gd2luZG93O1xufSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHsgLy8gV2ViIFdvcmtlclxuICByb290ID0gc2VsZjtcbn0gZWxzZSB7IC8vIE90aGVyIGVudmlyb25tZW50c1xuICByb290ID0gdGhpcztcbn1cblxuLyoqXG4gKiBOb29wLlxuICovXG5cbmZ1bmN0aW9uIG5vb3AoKXt9O1xuXG4vKipcbiAqIENoZWNrIGlmIGBvYmpgIGlzIGEgaG9zdCBvYmplY3QsXG4gKiB3ZSBkb24ndCB3YW50IHRvIHNlcmlhbGl6ZSB0aGVzZSA6KVxuICpcbiAqIFRPRE86IGZ1dHVyZSBwcm9vZiwgbW92ZSB0byBjb21wb2VudCBsYW5kXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGlzSG9zdChvYmopIHtcbiAgdmFyIHN0ciA9IHt9LnRvU3RyaW5nLmNhbGwob2JqKTtcblxuICBzd2l0Y2ggKHN0cikge1xuICAgIGNhc2UgJ1tvYmplY3QgRmlsZV0nOlxuICAgIGNhc2UgJ1tvYmplY3QgQmxvYl0nOlxuICAgIGNhc2UgJ1tvYmplY3QgRm9ybURhdGFdJzpcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBFeHBvc2UgYHJlcXVlc3RgLlxuICovXG5cbnZhciByZXF1ZXN0ID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3JlcXVlc3QnKS5iaW5kKG51bGwsIFJlcXVlc3QpO1xuXG4vKipcbiAqIERldGVybWluZSBYSFIuXG4gKi9cblxucmVxdWVzdC5nZXRYSFIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmIChyb290LlhNTEh0dHBSZXF1ZXN0XG4gICAgICAmJiAoIXJvb3QubG9jYXRpb24gfHwgJ2ZpbGU6JyAhPSByb290LmxvY2F0aW9uLnByb3RvY29sXG4gICAgICAgICAgfHwgIXJvb3QuQWN0aXZlWE9iamVjdCkpIHtcbiAgICByZXR1cm4gbmV3IFhNTEh0dHBSZXF1ZXN0O1xuICB9IGVsc2Uge1xuICAgIHRyeSB7IHJldHVybiBuZXcgQWN0aXZlWE9iamVjdCgnTWljcm9zb2Z0LlhNTEhUVFAnKTsgfSBjYXRjaChlKSB7fVxuICAgIHRyeSB7IHJldHVybiBuZXcgQWN0aXZlWE9iamVjdCgnTXN4bWwyLlhNTEhUVFAuNi4wJyk7IH0gY2F0Y2goZSkge31cbiAgICB0cnkgeyByZXR1cm4gbmV3IEFjdGl2ZVhPYmplY3QoJ01zeG1sMi5YTUxIVFRQLjMuMCcpOyB9IGNhdGNoKGUpIHt9XG4gICAgdHJ5IHsgcmV0dXJuIG5ldyBBY3RpdmVYT2JqZWN0KCdNc3htbDIuWE1MSFRUUCcpOyB9IGNhdGNoKGUpIHt9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBSZW1vdmVzIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UsIGFkZGVkIHRvIHN1cHBvcnQgSUUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbnZhciB0cmltID0gJycudHJpbVxuICA/IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHMudHJpbSgpOyB9XG4gIDogZnVuY3Rpb24ocykgeyByZXR1cm4gcy5yZXBsYWNlKC8oXlxccyp8XFxzKiQpL2csICcnKTsgfTtcblxuLyoqXG4gKiBTZXJpYWxpemUgdGhlIGdpdmVuIGBvYmpgLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZShvYmopIHtcbiAgaWYgKCFpc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICB2YXIgcGFpcnMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmIChudWxsICE9IG9ialtrZXldKSB7XG4gICAgICBwdXNoRW5jb2RlZEtleVZhbHVlUGFpcihwYWlycywga2V5LCBvYmpba2V5XSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgcmV0dXJuIHBhaXJzLmpvaW4oJyYnKTtcbn1cblxuLyoqXG4gKiBIZWxwcyAnc2VyaWFsaXplJyB3aXRoIHNlcmlhbGl6aW5nIGFycmF5cy5cbiAqIE11dGF0ZXMgdGhlIHBhaXJzIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHBhaXJzXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqL1xuXG5mdW5jdGlvbiBwdXNoRW5jb2RlZEtleVZhbHVlUGFpcihwYWlycywga2V5LCB2YWwpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsKSkge1xuICAgIHJldHVybiB2YWwuZm9yRWFjaChmdW5jdGlvbih2KSB7XG4gICAgICBwdXNoRW5jb2RlZEtleVZhbHVlUGFpcihwYWlycywga2V5LCB2KTtcbiAgICB9KTtcbiAgfVxuICBwYWlycy5wdXNoKGVuY29kZVVSSUNvbXBvbmVudChrZXkpXG4gICAgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsKSk7XG59XG5cbi8qKlxuICogRXhwb3NlIHNlcmlhbGl6YXRpb24gbWV0aG9kLlxuICovXG5cbiByZXF1ZXN0LnNlcmlhbGl6ZU9iamVjdCA9IHNlcmlhbGl6ZTtcblxuIC8qKlxuICAqIFBhcnNlIHRoZSBnaXZlbiB4LXd3dy1mb3JtLXVybGVuY29kZWQgYHN0cmAuXG4gICpcbiAgKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gICogQHJldHVybiB7T2JqZWN0fVxuICAqIEBhcGkgcHJpdmF0ZVxuICAqL1xuXG5mdW5jdGlvbiBwYXJzZVN0cmluZyhzdHIpIHtcbiAgdmFyIG9iaiA9IHt9O1xuICB2YXIgcGFpcnMgPSBzdHIuc3BsaXQoJyYnKTtcbiAgdmFyIHBhcnRzO1xuICB2YXIgcGFpcjtcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcGFpcnMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBwYWlyID0gcGFpcnNbaV07XG4gICAgcGFydHMgPSBwYWlyLnNwbGl0KCc9Jyk7XG4gICAgb2JqW2RlY29kZVVSSUNvbXBvbmVudChwYXJ0c1swXSldID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnRzWzFdKTtcbiAgfVxuXG4gIHJldHVybiBvYmo7XG59XG5cbi8qKlxuICogRXhwb3NlIHBhcnNlci5cbiAqL1xuXG5yZXF1ZXN0LnBhcnNlU3RyaW5nID0gcGFyc2VTdHJpbmc7XG5cbi8qKlxuICogRGVmYXVsdCBNSU1FIHR5cGUgbWFwLlxuICpcbiAqICAgICBzdXBlcmFnZW50LnR5cGVzLnhtbCA9ICdhcHBsaWNhdGlvbi94bWwnO1xuICpcbiAqL1xuXG5yZXF1ZXN0LnR5cGVzID0ge1xuICBodG1sOiAndGV4dC9odG1sJyxcbiAganNvbjogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICB4bWw6ICdhcHBsaWNhdGlvbi94bWwnLFxuICB1cmxlbmNvZGVkOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJyxcbiAgJ2Zvcm0nOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJyxcbiAgJ2Zvcm0tZGF0YSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG59O1xuXG4vKipcbiAqIERlZmF1bHQgc2VyaWFsaXphdGlvbiBtYXAuXG4gKlxuICogICAgIHN1cGVyYWdlbnQuc2VyaWFsaXplWydhcHBsaWNhdGlvbi94bWwnXSA9IGZ1bmN0aW9uKG9iail7XG4gKiAgICAgICByZXR1cm4gJ2dlbmVyYXRlZCB4bWwgaGVyZSc7XG4gKiAgICAgfTtcbiAqXG4gKi9cblxuIHJlcXVlc3Quc2VyaWFsaXplID0ge1xuICAgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCc6IHNlcmlhbGl6ZSxcbiAgICdhcHBsaWNhdGlvbi9qc29uJzogSlNPTi5zdHJpbmdpZnlcbiB9O1xuXG4gLyoqXG4gICogRGVmYXVsdCBwYXJzZXJzLlxuICAqXG4gICogICAgIHN1cGVyYWdlbnQucGFyc2VbJ2FwcGxpY2F0aW9uL3htbCddID0gZnVuY3Rpb24oc3RyKXtcbiAgKiAgICAgICByZXR1cm4geyBvYmplY3QgcGFyc2VkIGZyb20gc3RyIH07XG4gICogICAgIH07XG4gICpcbiAgKi9cblxucmVxdWVzdC5wYXJzZSA9IHtcbiAgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCc6IHBhcnNlU3RyaW5nLFxuICAnYXBwbGljYXRpb24vanNvbic6IEpTT04ucGFyc2Vcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGhlYWRlciBgc3RyYCBpbnRvXG4gKiBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgbWFwcGVkIGZpZWxkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZUhlYWRlcihzdHIpIHtcbiAgdmFyIGxpbmVzID0gc3RyLnNwbGl0KC9cXHI/XFxuLyk7XG4gIHZhciBmaWVsZHMgPSB7fTtcbiAgdmFyIGluZGV4O1xuICB2YXIgbGluZTtcbiAgdmFyIGZpZWxkO1xuICB2YXIgdmFsO1xuXG4gIGxpbmVzLnBvcCgpOyAvLyB0cmFpbGluZyBDUkxGXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbGluZSA9IGxpbmVzW2ldO1xuICAgIGluZGV4ID0gbGluZS5pbmRleE9mKCc6Jyk7XG4gICAgZmllbGQgPSBsaW5lLnNsaWNlKDAsIGluZGV4KS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhbCA9IHRyaW0obGluZS5zbGljZShpbmRleCArIDEpKTtcbiAgICBmaWVsZHNbZmllbGRdID0gdmFsO1xuICB9XG5cbiAgcmV0dXJuIGZpZWxkcztcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBgbWltZWAgaXMganNvbiBvciBoYXMgK2pzb24gc3RydWN0dXJlZCBzeW50YXggc3VmZml4LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNKU09OKG1pbWUpIHtcbiAgcmV0dXJuIC9bXFwvK11qc29uXFxiLy50ZXN0KG1pbWUpO1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgbWltZSB0eXBlIGZvciB0aGUgZ2l2ZW4gYHN0cmAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gdHlwZShzdHIpe1xuICByZXR1cm4gc3RyLnNwbGl0KC8gKjsgKi8pLnNoaWZ0KCk7XG59O1xuXG4vKipcbiAqIFJldHVybiBoZWFkZXIgZmllbGQgcGFyYW1ldGVycy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJhbXMoc3RyKXtcbiAgcmV0dXJuIHJlZHVjZShzdHIuc3BsaXQoLyAqOyAqLyksIGZ1bmN0aW9uKG9iaiwgc3RyKXtcbiAgICB2YXIgcGFydHMgPSBzdHIuc3BsaXQoLyAqPSAqLylcbiAgICAgICwga2V5ID0gcGFydHMuc2hpZnQoKVxuICAgICAgLCB2YWwgPSBwYXJ0cy5zaGlmdCgpO1xuXG4gICAgaWYgKGtleSAmJiB2YWwpIG9ialtrZXldID0gdmFsO1xuICAgIHJldHVybiBvYmo7XG4gIH0sIHt9KTtcbn07XG5cbi8qKlxuICogSW5pdGlhbGl6ZSBhIG5ldyBgUmVzcG9uc2VgIHdpdGggdGhlIGdpdmVuIGB4aHJgLlxuICpcbiAqICAtIHNldCBmbGFncyAoLm9rLCAuZXJyb3IsIGV0YylcbiAqICAtIHBhcnNlIGhlYWRlclxuICpcbiAqIEV4YW1wbGVzOlxuICpcbiAqICBBbGlhc2luZyBgc3VwZXJhZ2VudGAgYXMgYHJlcXVlc3RgIGlzIG5pY2U6XG4gKlxuICogICAgICByZXF1ZXN0ID0gc3VwZXJhZ2VudDtcbiAqXG4gKiAgV2UgY2FuIHVzZSB0aGUgcHJvbWlzZS1saWtlIEFQSSwgb3IgcGFzcyBjYWxsYmFja3M6XG4gKlxuICogICAgICByZXF1ZXN0LmdldCgnLycpLmVuZChmdW5jdGlvbihyZXMpe30pO1xuICogICAgICByZXF1ZXN0LmdldCgnLycsIGZ1bmN0aW9uKHJlcyl7fSk7XG4gKlxuICogIFNlbmRpbmcgZGF0YSBjYW4gYmUgY2hhaW5lZDpcbiAqXG4gKiAgICAgIHJlcXVlc3RcbiAqICAgICAgICAucG9zdCgnL3VzZXInKVxuICogICAgICAgIC5zZW5kKHsgbmFtZTogJ3RqJyB9KVxuICogICAgICAgIC5lbmQoZnVuY3Rpb24ocmVzKXt9KTtcbiAqXG4gKiAgT3IgcGFzc2VkIHRvIGAuc2VuZCgpYDpcbiAqXG4gKiAgICAgIHJlcXVlc3RcbiAqICAgICAgICAucG9zdCgnL3VzZXInKVxuICogICAgICAgIC5zZW5kKHsgbmFtZTogJ3RqJyB9LCBmdW5jdGlvbihyZXMpe30pO1xuICpcbiAqICBPciBwYXNzZWQgdG8gYC5wb3N0KClgOlxuICpcbiAqICAgICAgcmVxdWVzdFxuICogICAgICAgIC5wb3N0KCcvdXNlcicsIHsgbmFtZTogJ3RqJyB9KVxuICogICAgICAgIC5lbmQoZnVuY3Rpb24ocmVzKXt9KTtcbiAqXG4gKiBPciBmdXJ0aGVyIHJlZHVjZWQgdG8gYSBzaW5nbGUgY2FsbCBmb3Igc2ltcGxlIGNhc2VzOlxuICpcbiAqICAgICAgcmVxdWVzdFxuICogICAgICAgIC5wb3N0KCcvdXNlcicsIHsgbmFtZTogJ3RqJyB9LCBmdW5jdGlvbihyZXMpe30pO1xuICpcbiAqIEBwYXJhbSB7WE1MSFRUUFJlcXVlc3R9IHhoclxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIFJlc3BvbnNlKHJlcSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdGhpcy5yZXEgPSByZXE7XG4gIHRoaXMueGhyID0gdGhpcy5yZXEueGhyO1xuICAvLyByZXNwb25zZVRleHQgaXMgYWNjZXNzaWJsZSBvbmx5IGlmIHJlc3BvbnNlVHlwZSBpcyAnJyBvciAndGV4dCcgYW5kIG9uIG9sZGVyIGJyb3dzZXJzXG4gIHRoaXMudGV4dCA9ICgodGhpcy5yZXEubWV0aG9kICE9J0hFQUQnICYmICh0aGlzLnhoci5yZXNwb25zZVR5cGUgPT09ICcnIHx8IHRoaXMueGhyLnJlc3BvbnNlVHlwZSA9PT0gJ3RleHQnKSkgfHwgdHlwZW9mIHRoaXMueGhyLnJlc3BvbnNlVHlwZSA9PT0gJ3VuZGVmaW5lZCcpXG4gICAgID8gdGhpcy54aHIucmVzcG9uc2VUZXh0XG4gICAgIDogbnVsbDtcbiAgdGhpcy5zdGF0dXNUZXh0ID0gdGhpcy5yZXEueGhyLnN0YXR1c1RleHQ7XG4gIHRoaXMuc2V0U3RhdHVzUHJvcGVydGllcyh0aGlzLnhoci5zdGF0dXMpO1xuICB0aGlzLmhlYWRlciA9IHRoaXMuaGVhZGVycyA9IHBhcnNlSGVhZGVyKHRoaXMueGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpKTtcbiAgLy8gZ2V0QWxsUmVzcG9uc2VIZWFkZXJzIHNvbWV0aW1lcyBmYWxzZWx5IHJldHVybnMgXCJcIiBmb3IgQ09SUyByZXF1ZXN0cywgYnV0XG4gIC8vIGdldFJlc3BvbnNlSGVhZGVyIHN0aWxsIHdvcmtzLiBzbyB3ZSBnZXQgY29udGVudC10eXBlIGV2ZW4gaWYgZ2V0dGluZ1xuICAvLyBvdGhlciBoZWFkZXJzIGZhaWxzLlxuICB0aGlzLmhlYWRlclsnY29udGVudC10eXBlJ10gPSB0aGlzLnhoci5nZXRSZXNwb25zZUhlYWRlcignY29udGVudC10eXBlJyk7XG4gIHRoaXMuc2V0SGVhZGVyUHJvcGVydGllcyh0aGlzLmhlYWRlcik7XG4gIHRoaXMuYm9keSA9IHRoaXMucmVxLm1ldGhvZCAhPSAnSEVBRCdcbiAgICA/IHRoaXMucGFyc2VCb2R5KHRoaXMudGV4dCA/IHRoaXMudGV4dCA6IHRoaXMueGhyLnJlc3BvbnNlKVxuICAgIDogbnVsbDtcbn1cblxuLyoqXG4gKiBHZXQgY2FzZS1pbnNlbnNpdGl2ZSBgZmllbGRgIHZhbHVlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWVsZFxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5SZXNwb25zZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oZmllbGQpe1xuICByZXR1cm4gdGhpcy5oZWFkZXJbZmllbGQudG9Mb3dlckNhc2UoKV07XG59O1xuXG4vKipcbiAqIFNldCBoZWFkZXIgcmVsYXRlZCBwcm9wZXJ0aWVzOlxuICpcbiAqICAgLSBgLnR5cGVgIHRoZSBjb250ZW50IHR5cGUgd2l0aG91dCBwYXJhbXNcbiAqXG4gKiBBIHJlc3BvbnNlIG9mIFwiQ29udGVudC1UeXBlOiB0ZXh0L3BsYWluOyBjaGFyc2V0PXV0Zi04XCJcbiAqIHdpbGwgcHJvdmlkZSB5b3Ugd2l0aCBhIGAudHlwZWAgb2YgXCJ0ZXh0L3BsYWluXCIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGhlYWRlclxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuUmVzcG9uc2UucHJvdG90eXBlLnNldEhlYWRlclByb3BlcnRpZXMgPSBmdW5jdGlvbihoZWFkZXIpe1xuICAvLyBjb250ZW50LXR5cGVcbiAgdmFyIGN0ID0gdGhpcy5oZWFkZXJbJ2NvbnRlbnQtdHlwZSddIHx8ICcnO1xuICB0aGlzLnR5cGUgPSB0eXBlKGN0KTtcblxuICAvLyBwYXJhbXNcbiAgdmFyIG9iaiA9IHBhcmFtcyhjdCk7XG4gIGZvciAodmFyIGtleSBpbiBvYmopIHRoaXNba2V5XSA9IG9ialtrZXldO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYm9keSBgc3RyYC5cbiAqXG4gKiBVc2VkIGZvciBhdXRvLXBhcnNpbmcgb2YgYm9kaWVzLiBQYXJzZXJzXG4gKiBhcmUgZGVmaW5lZCBvbiB0aGUgYHN1cGVyYWdlbnQucGFyc2VgIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cblJlc3BvbnNlLnByb3RvdHlwZS5wYXJzZUJvZHkgPSBmdW5jdGlvbihzdHIpe1xuICB2YXIgcGFyc2UgPSByZXF1ZXN0LnBhcnNlW3RoaXMudHlwZV07XG4gIGlmICghcGFyc2UgJiYgaXNKU09OKHRoaXMudHlwZSkpIHtcbiAgICBwYXJzZSA9IHJlcXVlc3QucGFyc2VbJ2FwcGxpY2F0aW9uL2pzb24nXTtcbiAgfVxuICByZXR1cm4gcGFyc2UgJiYgc3RyICYmIChzdHIubGVuZ3RoIHx8IHN0ciBpbnN0YW5jZW9mIE9iamVjdClcbiAgICA/IHBhcnNlKHN0cilcbiAgICA6IG51bGw7XG59O1xuXG4vKipcbiAqIFNldCBmbGFncyBzdWNoIGFzIGAub2tgIGJhc2VkIG9uIGBzdGF0dXNgLlxuICpcbiAqIEZvciBleGFtcGxlIGEgMnh4IHJlc3BvbnNlIHdpbGwgZ2l2ZSB5b3UgYSBgLm9rYCBvZiBfX3RydWVfX1xuICogd2hlcmVhcyA1eHggd2lsbCBiZSBfX2ZhbHNlX18gYW5kIGAuZXJyb3JgIHdpbGwgYmUgX190cnVlX18uIFRoZVxuICogYC5jbGllbnRFcnJvcmAgYW5kIGAuc2VydmVyRXJyb3JgIGFyZSBhbHNvIGF2YWlsYWJsZSB0byBiZSBtb3JlXG4gKiBzcGVjaWZpYywgYW5kIGAuc3RhdHVzVHlwZWAgaXMgdGhlIGNsYXNzIG9mIGVycm9yIHJhbmdpbmcgZnJvbSAxLi41XG4gKiBzb21ldGltZXMgdXNlZnVsIGZvciBtYXBwaW5nIHJlc3BvbmQgY29sb3JzIGV0Yy5cbiAqXG4gKiBcInN1Z2FyXCIgcHJvcGVydGllcyBhcmUgYWxzbyBkZWZpbmVkIGZvciBjb21tb24gY2FzZXMuIEN1cnJlbnRseSBwcm92aWRpbmc6XG4gKlxuICogICAtIC5ub0NvbnRlbnRcbiAqICAgLSAuYmFkUmVxdWVzdFxuICogICAtIC51bmF1dGhvcml6ZWRcbiAqICAgLSAubm90QWNjZXB0YWJsZVxuICogICAtIC5ub3RGb3VuZFxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBzdGF0dXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cblJlc3BvbnNlLnByb3RvdHlwZS5zZXRTdGF0dXNQcm9wZXJ0aWVzID0gZnVuY3Rpb24oc3RhdHVzKXtcbiAgLy8gaGFuZGxlIElFOSBidWc6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTAwNDY5NzIvbXNpZS1yZXR1cm5zLXN0YXR1cy1jb2RlLW9mLTEyMjMtZm9yLWFqYXgtcmVxdWVzdFxuICBpZiAoc3RhdHVzID09PSAxMjIzKSB7XG4gICAgc3RhdHVzID0gMjA0O1xuICB9XG5cbiAgdmFyIHR5cGUgPSBzdGF0dXMgLyAxMDAgfCAwO1xuXG4gIC8vIHN0YXR1cyAvIGNsYXNzXG4gIHRoaXMuc3RhdHVzID0gdGhpcy5zdGF0dXNDb2RlID0gc3RhdHVzO1xuICB0aGlzLnN0YXR1c1R5cGUgPSB0eXBlO1xuXG4gIC8vIGJhc2ljc1xuICB0aGlzLmluZm8gPSAxID09IHR5cGU7XG4gIHRoaXMub2sgPSAyID09IHR5cGU7XG4gIHRoaXMuY2xpZW50RXJyb3IgPSA0ID09IHR5cGU7XG4gIHRoaXMuc2VydmVyRXJyb3IgPSA1ID09IHR5cGU7XG4gIHRoaXMuZXJyb3IgPSAoNCA9PSB0eXBlIHx8IDUgPT0gdHlwZSlcbiAgICA/IHRoaXMudG9FcnJvcigpXG4gICAgOiBmYWxzZTtcblxuICAvLyBzdWdhclxuICB0aGlzLmFjY2VwdGVkID0gMjAyID09IHN0YXR1cztcbiAgdGhpcy5ub0NvbnRlbnQgPSAyMDQgPT0gc3RhdHVzO1xuICB0aGlzLmJhZFJlcXVlc3QgPSA0MDAgPT0gc3RhdHVzO1xuICB0aGlzLnVuYXV0aG9yaXplZCA9IDQwMSA9PSBzdGF0dXM7XG4gIHRoaXMubm90QWNjZXB0YWJsZSA9IDQwNiA9PSBzdGF0dXM7XG4gIHRoaXMubm90Rm91bmQgPSA0MDQgPT0gc3RhdHVzO1xuICB0aGlzLmZvcmJpZGRlbiA9IDQwMyA9PSBzdGF0dXM7XG59O1xuXG4vKipcbiAqIFJldHVybiBhbiBgRXJyb3JgIHJlcHJlc2VudGF0aXZlIG9mIHRoaXMgcmVzcG9uc2UuXG4gKlxuICogQHJldHVybiB7RXJyb3J9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cblJlc3BvbnNlLnByb3RvdHlwZS50b0Vycm9yID0gZnVuY3Rpb24oKXtcbiAgdmFyIHJlcSA9IHRoaXMucmVxO1xuICB2YXIgbWV0aG9kID0gcmVxLm1ldGhvZDtcbiAgdmFyIHVybCA9IHJlcS51cmw7XG5cbiAgdmFyIG1zZyA9ICdjYW5ub3QgJyArIG1ldGhvZCArICcgJyArIHVybCArICcgKCcgKyB0aGlzLnN0YXR1cyArICcpJztcbiAgdmFyIGVyciA9IG5ldyBFcnJvcihtc2cpO1xuICBlcnIuc3RhdHVzID0gdGhpcy5zdGF0dXM7XG4gIGVyci5tZXRob2QgPSBtZXRob2Q7XG4gIGVyci51cmwgPSB1cmw7XG5cbiAgcmV0dXJuIGVycjtcbn07XG5cbi8qKlxuICogRXhwb3NlIGBSZXNwb25zZWAuXG4gKi9cblxucmVxdWVzdC5SZXNwb25zZSA9IFJlc3BvbnNlO1xuXG4vKipcbiAqIEluaXRpYWxpemUgYSBuZXcgYFJlcXVlc3RgIHdpdGggdGhlIGdpdmVuIGBtZXRob2RgIGFuZCBgdXJsYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIFJlcXVlc3QobWV0aG9kLCB1cmwpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLl9xdWVyeSA9IHRoaXMuX3F1ZXJ5IHx8IFtdO1xuICB0aGlzLm1ldGhvZCA9IG1ldGhvZDtcbiAgdGhpcy51cmwgPSB1cmw7XG4gIHRoaXMuaGVhZGVyID0ge307IC8vIHByZXNlcnZlcyBoZWFkZXIgbmFtZSBjYXNlXG4gIHRoaXMuX2hlYWRlciA9IHt9OyAvLyBjb2VyY2VzIGhlYWRlciBuYW1lcyB0byBsb3dlcmNhc2VcbiAgdGhpcy5vbignZW5kJywgZnVuY3Rpb24oKXtcbiAgICB2YXIgZXJyID0gbnVsbDtcbiAgICB2YXIgcmVzID0gbnVsbDtcblxuICAgIHRyeSB7XG4gICAgICByZXMgPSBuZXcgUmVzcG9uc2Uoc2VsZik7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICBlcnIgPSBuZXcgRXJyb3IoJ1BhcnNlciBpcyB1bmFibGUgdG8gcGFyc2UgdGhlIHJlc3BvbnNlJyk7XG4gICAgICBlcnIucGFyc2UgPSB0cnVlO1xuICAgICAgZXJyLm9yaWdpbmFsID0gZTtcbiAgICAgIC8vIGlzc3VlICM2NzU6IHJldHVybiB0aGUgcmF3IHJlc3BvbnNlIGlmIHRoZSByZXNwb25zZSBwYXJzaW5nIGZhaWxzXG4gICAgICBlcnIucmF3UmVzcG9uc2UgPSBzZWxmLnhociAmJiBzZWxmLnhoci5yZXNwb25zZVRleHQgPyBzZWxmLnhoci5yZXNwb25zZVRleHQgOiBudWxsO1xuICAgICAgLy8gaXNzdWUgIzg3NjogcmV0dXJuIHRoZSBodHRwIHN0YXR1cyBjb2RlIGlmIHRoZSByZXNwb25zZSBwYXJzaW5nIGZhaWxzXG4gICAgICBlcnIuc3RhdHVzQ29kZSA9IHNlbGYueGhyICYmIHNlbGYueGhyLnN0YXR1cyA/IHNlbGYueGhyLnN0YXR1cyA6IG51bGw7XG4gICAgICByZXR1cm4gc2VsZi5jYWxsYmFjayhlcnIpO1xuICAgIH1cblxuICAgIHNlbGYuZW1pdCgncmVzcG9uc2UnLCByZXMpO1xuXG4gICAgaWYgKGVycikge1xuICAgICAgcmV0dXJuIHNlbGYuY2FsbGJhY2soZXJyLCByZXMpO1xuICAgIH1cblxuICAgIGlmIChyZXMuc3RhdHVzID49IDIwMCAmJiByZXMuc3RhdHVzIDwgMzAwKSB7XG4gICAgICByZXR1cm4gc2VsZi5jYWxsYmFjayhlcnIsIHJlcyk7XG4gICAgfVxuXG4gICAgdmFyIG5ld19lcnIgPSBuZXcgRXJyb3IocmVzLnN0YXR1c1RleHQgfHwgJ1Vuc3VjY2Vzc2Z1bCBIVFRQIHJlc3BvbnNlJyk7XG4gICAgbmV3X2Vyci5vcmlnaW5hbCA9IGVycjtcbiAgICBuZXdfZXJyLnJlc3BvbnNlID0gcmVzO1xuICAgIG5ld19lcnIuc3RhdHVzID0gcmVzLnN0YXR1cztcblxuICAgIHNlbGYuY2FsbGJhY2sobmV3X2VyciwgcmVzKTtcbiAgfSk7XG59XG5cbi8qKlxuICogTWl4aW4gYEVtaXR0ZXJgIGFuZCBgcmVxdWVzdEJhc2VgLlxuICovXG5cbkVtaXR0ZXIoUmVxdWVzdC5wcm90b3R5cGUpO1xuZm9yICh2YXIga2V5IGluIHJlcXVlc3RCYXNlKSB7XG4gIFJlcXVlc3QucHJvdG90eXBlW2tleV0gPSByZXF1ZXN0QmFzZVtrZXldO1xufVxuXG4vKipcbiAqIEFib3J0IHRoZSByZXF1ZXN0LCBhbmQgY2xlYXIgcG90ZW50aWFsIHRpbWVvdXQuXG4gKlxuICogQHJldHVybiB7UmVxdWVzdH1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuUmVxdWVzdC5wcm90b3R5cGUuYWJvcnQgPSBmdW5jdGlvbigpe1xuICBpZiAodGhpcy5hYm9ydGVkKSByZXR1cm47XG4gIHRoaXMuYWJvcnRlZCA9IHRydWU7XG4gIHRoaXMueGhyICYmIHRoaXMueGhyLmFib3J0KCk7XG4gIHRoaXMuY2xlYXJUaW1lb3V0KCk7XG4gIHRoaXMuZW1pdCgnYWJvcnQnKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFNldCBDb250ZW50LVR5cGUgdG8gYHR5cGVgLCBtYXBwaW5nIHZhbHVlcyBmcm9tIGByZXF1ZXN0LnR5cGVzYC5cbiAqXG4gKiBFeGFtcGxlczpcbiAqXG4gKiAgICAgIHN1cGVyYWdlbnQudHlwZXMueG1sID0gJ2FwcGxpY2F0aW9uL3htbCc7XG4gKlxuICogICAgICByZXF1ZXN0LnBvc3QoJy8nKVxuICogICAgICAgIC50eXBlKCd4bWwnKVxuICogICAgICAgIC5zZW5kKHhtbHN0cmluZylcbiAqICAgICAgICAuZW5kKGNhbGxiYWNrKTtcbiAqXG4gKiAgICAgIHJlcXVlc3QucG9zdCgnLycpXG4gKiAgICAgICAgLnR5cGUoJ2FwcGxpY2F0aW9uL3htbCcpXG4gKiAgICAgICAgLnNlbmQoeG1sc3RyaW5nKVxuICogICAgICAgIC5lbmQoY2FsbGJhY2spO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcmV0dXJuIHtSZXF1ZXN0fSBmb3IgY2hhaW5pbmdcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuUmVxdWVzdC5wcm90b3R5cGUudHlwZSA9IGZ1bmN0aW9uKHR5cGUpe1xuICB0aGlzLnNldCgnQ29udGVudC1UeXBlJywgcmVxdWVzdC50eXBlc1t0eXBlXSB8fCB0eXBlKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFNldCByZXNwb25zZVR5cGUgdG8gYHZhbGAuIFByZXNlbnRseSB2YWxpZCByZXNwb25zZVR5cGVzIGFyZSAnYmxvYicgYW5kIFxuICogJ2FycmF5YnVmZmVyJy5cbiAqXG4gKiBFeGFtcGxlczpcbiAqXG4gKiAgICAgIHJlcS5nZXQoJy8nKVxuICogICAgICAgIC5yZXNwb25zZVR5cGUoJ2Jsb2InKVxuICogICAgICAgIC5lbmQoY2FsbGJhY2spO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWxcbiAqIEByZXR1cm4ge1JlcXVlc3R9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5SZXF1ZXN0LnByb3RvdHlwZS5yZXNwb25zZVR5cGUgPSBmdW5jdGlvbih2YWwpe1xuICB0aGlzLl9yZXNwb25zZVR5cGUgPSB2YWw7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBTZXQgQWNjZXB0IHRvIGB0eXBlYCwgbWFwcGluZyB2YWx1ZXMgZnJvbSBgcmVxdWVzdC50eXBlc2AuXG4gKlxuICogRXhhbXBsZXM6XG4gKlxuICogICAgICBzdXBlcmFnZW50LnR5cGVzLmpzb24gPSAnYXBwbGljYXRpb24vanNvbic7XG4gKlxuICogICAgICByZXF1ZXN0LmdldCgnL2FnZW50JylcbiAqICAgICAgICAuYWNjZXB0KCdqc29uJylcbiAqICAgICAgICAuZW5kKGNhbGxiYWNrKTtcbiAqXG4gKiAgICAgIHJlcXVlc3QuZ2V0KCcvYWdlbnQnKVxuICogICAgICAgIC5hY2NlcHQoJ2FwcGxpY2F0aW9uL2pzb24nKVxuICogICAgICAgIC5lbmQoY2FsbGJhY2spO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBhY2NlcHRcbiAqIEByZXR1cm4ge1JlcXVlc3R9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5SZXF1ZXN0LnByb3RvdHlwZS5hY2NlcHQgPSBmdW5jdGlvbih0eXBlKXtcbiAgdGhpcy5zZXQoJ0FjY2VwdCcsIHJlcXVlc3QudHlwZXNbdHlwZV0gfHwgdHlwZSk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBTZXQgQXV0aG9yaXphdGlvbiBmaWVsZCB2YWx1ZSB3aXRoIGB1c2VyYCBhbmQgYHBhc3NgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1c2VyXG4gKiBAcGFyYW0ge1N0cmluZ30gcGFzc1xuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgd2l0aCAndHlwZScgcHJvcGVydHkgJ2F1dG8nIG9yICdiYXNpYycgKGRlZmF1bHQgJ2Jhc2ljJylcbiAqIEByZXR1cm4ge1JlcXVlc3R9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5SZXF1ZXN0LnByb3RvdHlwZS5hdXRoID0gZnVuY3Rpb24odXNlciwgcGFzcywgb3B0aW9ucyl7XG4gIGlmICghb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnYmFzaWMnXG4gICAgfVxuICB9XG5cbiAgc3dpdGNoIChvcHRpb25zLnR5cGUpIHtcbiAgICBjYXNlICdiYXNpYyc6XG4gICAgICB2YXIgc3RyID0gYnRvYSh1c2VyICsgJzonICsgcGFzcyk7XG4gICAgICB0aGlzLnNldCgnQXV0aG9yaXphdGlvbicsICdCYXNpYyAnICsgc3RyKTtcbiAgICBicmVhaztcblxuICAgIGNhc2UgJ2F1dG8nOlxuICAgICAgdGhpcy51c2VybmFtZSA9IHVzZXI7XG4gICAgICB0aGlzLnBhc3N3b3JkID0gcGFzcztcbiAgICBicmVhaztcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuKiBBZGQgcXVlcnktc3RyaW5nIGB2YWxgLlxuKlxuKiBFeGFtcGxlczpcbipcbiogICByZXF1ZXN0LmdldCgnL3Nob2VzJylcbiogICAgIC5xdWVyeSgnc2l6ZT0xMCcpXG4qICAgICAucXVlcnkoeyBjb2xvcjogJ2JsdWUnIH0pXG4qXG4qIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gdmFsXG4qIEByZXR1cm4ge1JlcXVlc3R9IGZvciBjaGFpbmluZ1xuKiBAYXBpIHB1YmxpY1xuKi9cblxuUmVxdWVzdC5wcm90b3R5cGUucXVlcnkgPSBmdW5jdGlvbih2YWwpe1xuICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIHZhbCkgdmFsID0gc2VyaWFsaXplKHZhbCk7XG4gIGlmICh2YWwpIHRoaXMuX3F1ZXJ5LnB1c2godmFsKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFF1ZXVlIHRoZSBnaXZlbiBgZmlsZWAgYXMgYW4gYXR0YWNobWVudCB0byB0aGUgc3BlY2lmaWVkIGBmaWVsZGAsXG4gKiB3aXRoIG9wdGlvbmFsIGBmaWxlbmFtZWAuXG4gKlxuICogYGBgIGpzXG4gKiByZXF1ZXN0LnBvc3QoJy91cGxvYWQnKVxuICogICAuYXR0YWNoKG5ldyBCbG9iKFsnPGEgaWQ9XCJhXCI+PGIgaWQ9XCJiXCI+aGV5ITwvYj48L2E+J10sIHsgdHlwZTogXCJ0ZXh0L2h0bWxcIn0pKVxuICogICAuZW5kKGNhbGxiYWNrKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWVsZFxuICogQHBhcmFtIHtCbG9ifEZpbGV9IGZpbGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWxlbmFtZVxuICogQHJldHVybiB7UmVxdWVzdH0gZm9yIGNoYWluaW5nXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cblJlcXVlc3QucHJvdG90eXBlLmF0dGFjaCA9IGZ1bmN0aW9uKGZpZWxkLCBmaWxlLCBmaWxlbmFtZSl7XG4gIHRoaXMuX2dldEZvcm1EYXRhKCkuYXBwZW5kKGZpZWxkLCBmaWxlLCBmaWxlbmFtZSB8fCBmaWxlLm5hbWUpO1xuICByZXR1cm4gdGhpcztcbn07XG5cblJlcXVlc3QucHJvdG90eXBlLl9nZXRGb3JtRGF0YSA9IGZ1bmN0aW9uKCl7XG4gIGlmICghdGhpcy5fZm9ybURhdGEpIHtcbiAgICB0aGlzLl9mb3JtRGF0YSA9IG5ldyByb290LkZvcm1EYXRhKCk7XG4gIH1cbiAgcmV0dXJuIHRoaXMuX2Zvcm1EYXRhO1xufTtcblxuLyoqXG4gKiBTZW5kIGBkYXRhYCBhcyB0aGUgcmVxdWVzdCBib2R5LCBkZWZhdWx0aW5nIHRoZSBgLnR5cGUoKWAgdG8gXCJqc29uXCIgd2hlblxuICogYW4gb2JqZWN0IGlzIGdpdmVuLlxuICpcbiAqIEV4YW1wbGVzOlxuICpcbiAqICAgICAgIC8vIG1hbnVhbCBqc29uXG4gKiAgICAgICByZXF1ZXN0LnBvc3QoJy91c2VyJylcbiAqICAgICAgICAgLnR5cGUoJ2pzb24nKVxuICogICAgICAgICAuc2VuZCgne1wibmFtZVwiOlwidGpcIn0nKVxuICogICAgICAgICAuZW5kKGNhbGxiYWNrKVxuICpcbiAqICAgICAgIC8vIGF1dG8ganNvblxuICogICAgICAgcmVxdWVzdC5wb3N0KCcvdXNlcicpXG4gKiAgICAgICAgIC5zZW5kKHsgbmFtZTogJ3RqJyB9KVxuICogICAgICAgICAuZW5kKGNhbGxiYWNrKVxuICpcbiAqICAgICAgIC8vIG1hbnVhbCB4LXd3dy1mb3JtLXVybGVuY29kZWRcbiAqICAgICAgIHJlcXVlc3QucG9zdCgnL3VzZXInKVxuICogICAgICAgICAudHlwZSgnZm9ybScpXG4gKiAgICAgICAgIC5zZW5kKCduYW1lPXRqJylcbiAqICAgICAgICAgLmVuZChjYWxsYmFjaylcbiAqXG4gKiAgICAgICAvLyBhdXRvIHgtd3d3LWZvcm0tdXJsZW5jb2RlZFxuICogICAgICAgcmVxdWVzdC5wb3N0KCcvdXNlcicpXG4gKiAgICAgICAgIC50eXBlKCdmb3JtJylcbiAqICAgICAgICAgLnNlbmQoeyBuYW1lOiAndGonIH0pXG4gKiAgICAgICAgIC5lbmQoY2FsbGJhY2spXG4gKlxuICogICAgICAgLy8gZGVmYXVsdHMgdG8geC13d3ctZm9ybS11cmxlbmNvZGVkXG4gICogICAgICByZXF1ZXN0LnBvc3QoJy91c2VyJylcbiAgKiAgICAgICAgLnNlbmQoJ25hbWU9dG9iaScpXG4gICogICAgICAgIC5zZW5kKCdzcGVjaWVzPWZlcnJldCcpXG4gICogICAgICAgIC5lbmQoY2FsbGJhY2spXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBkYXRhXG4gKiBAcmV0dXJuIHtSZXF1ZXN0fSBmb3IgY2hhaW5pbmdcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuUmVxdWVzdC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGRhdGEpe1xuICB2YXIgb2JqID0gaXNPYmplY3QoZGF0YSk7XG4gIHZhciB0eXBlID0gdGhpcy5faGVhZGVyWydjb250ZW50LXR5cGUnXTtcblxuICAvLyBtZXJnZVxuICBpZiAob2JqICYmIGlzT2JqZWN0KHRoaXMuX2RhdGEpKSB7XG4gICAgZm9yICh2YXIga2V5IGluIGRhdGEpIHtcbiAgICAgIHRoaXMuX2RhdGFba2V5XSA9IGRhdGFba2V5XTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIGRhdGEpIHtcbiAgICBpZiAoIXR5cGUpIHRoaXMudHlwZSgnZm9ybScpO1xuICAgIHR5cGUgPSB0aGlzLl9oZWFkZXJbJ2NvbnRlbnQtdHlwZSddO1xuICAgIGlmICgnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJyA9PSB0eXBlKSB7XG4gICAgICB0aGlzLl9kYXRhID0gdGhpcy5fZGF0YVxuICAgICAgICA/IHRoaXMuX2RhdGEgKyAnJicgKyBkYXRhXG4gICAgICAgIDogZGF0YTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZGF0YSA9ICh0aGlzLl9kYXRhIHx8ICcnKSArIGRhdGE7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xuICB9XG5cbiAgaWYgKCFvYmogfHwgaXNIb3N0KGRhdGEpKSByZXR1cm4gdGhpcztcbiAgaWYgKCF0eXBlKSB0aGlzLnR5cGUoJ2pzb24nKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKi9cblJlc3BvbnNlLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIHNlcmlhbGl6ZShmbil7XG4gIGlmIChyb290LmNvbnNvbGUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJDbGllbnQtc2lkZSBwYXJzZSgpIG1ldGhvZCBoYXMgYmVlbiByZW5hbWVkIHRvIHNlcmlhbGl6ZSgpLiBUaGlzIG1ldGhvZCBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHN1cGVyYWdlbnQgdjIuMFwiKTtcbiAgfVxuICB0aGlzLnNlcmlhbGl6ZShmbik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuUmVzcG9uc2UucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uIHNlcmlhbGl6ZShmbil7XG4gIHRoaXMuX3BhcnNlciA9IGZuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogSW52b2tlIHRoZSBjYWxsYmFjayB3aXRoIGBlcnJgIGFuZCBgcmVzYFxuICogYW5kIGhhbmRsZSBhcml0eSBjaGVjay5cbiAqXG4gKiBAcGFyYW0ge0Vycm9yfSBlcnJcbiAqIEBwYXJhbSB7UmVzcG9uc2V9IHJlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuUmVxdWVzdC5wcm90b3R5cGUuY2FsbGJhY2sgPSBmdW5jdGlvbihlcnIsIHJlcyl7XG4gIHZhciBmbiA9IHRoaXMuX2NhbGxiYWNrO1xuICB0aGlzLmNsZWFyVGltZW91dCgpO1xuICBmbihlcnIsIHJlcyk7XG59O1xuXG4vKipcbiAqIEludm9rZSBjYWxsYmFjayB3aXRoIHgtZG9tYWluIGVycm9yLlxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cblJlcXVlc3QucHJvdG90eXBlLmNyb3NzRG9tYWluRXJyb3IgPSBmdW5jdGlvbigpe1xuICB2YXIgZXJyID0gbmV3IEVycm9yKCdSZXF1ZXN0IGhhcyBiZWVuIHRlcm1pbmF0ZWRcXG5Qb3NzaWJsZSBjYXVzZXM6IHRoZSBuZXR3b3JrIGlzIG9mZmxpbmUsIE9yaWdpbiBpcyBub3QgYWxsb3dlZCBieSBBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4sIHRoZSBwYWdlIGlzIGJlaW5nIHVubG9hZGVkLCBldGMuJyk7XG4gIGVyci5jcm9zc0RvbWFpbiA9IHRydWU7XG5cbiAgZXJyLnN0YXR1cyA9IHRoaXMuc3RhdHVzO1xuICBlcnIubWV0aG9kID0gdGhpcy5tZXRob2Q7XG4gIGVyci51cmwgPSB0aGlzLnVybDtcblxuICB0aGlzLmNhbGxiYWNrKGVycik7XG59O1xuXG4vKipcbiAqIEludm9rZSBjYWxsYmFjayB3aXRoIHRpbWVvdXQgZXJyb3IuXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuUmVxdWVzdC5wcm90b3R5cGUudGltZW91dEVycm9yID0gZnVuY3Rpb24oKXtcbiAgdmFyIHRpbWVvdXQgPSB0aGlzLl90aW1lb3V0O1xuICB2YXIgZXJyID0gbmV3IEVycm9yKCd0aW1lb3V0IG9mICcgKyB0aW1lb3V0ICsgJ21zIGV4Y2VlZGVkJyk7XG4gIGVyci50aW1lb3V0ID0gdGltZW91dDtcbiAgdGhpcy5jYWxsYmFjayhlcnIpO1xufTtcblxuLyoqXG4gKiBFbmFibGUgdHJhbnNtaXNzaW9uIG9mIGNvb2tpZXMgd2l0aCB4LWRvbWFpbiByZXF1ZXN0cy5cbiAqXG4gKiBOb3RlIHRoYXQgZm9yIHRoaXMgdG8gd29yayB0aGUgb3JpZ2luIG11c3Qgbm90IGJlXG4gKiB1c2luZyBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiIHdpdGggYSB3aWxkY2FyZCxcbiAqIGFuZCBhbHNvIG11c3Qgc2V0IFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIlxuICogdG8gXCJ0cnVlXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5SZXF1ZXN0LnByb3RvdHlwZS53aXRoQ3JlZGVudGlhbHMgPSBmdW5jdGlvbigpe1xuICB0aGlzLl93aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogSW5pdGlhdGUgcmVxdWVzdCwgaW52b2tpbmcgY2FsbGJhY2sgYGZuKHJlcylgXG4gKiB3aXRoIGFuIGluc3RhbmNlb2YgYFJlc3BvbnNlYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7UmVxdWVzdH0gZm9yIGNoYWluaW5nXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cblJlcXVlc3QucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKGZuKXtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgeGhyID0gdGhpcy54aHIgPSByZXF1ZXN0LmdldFhIUigpO1xuICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyeS5qb2luKCcmJyk7XG4gIHZhciB0aW1lb3V0ID0gdGhpcy5fdGltZW91dDtcbiAgdmFyIGRhdGEgPSB0aGlzLl9mb3JtRGF0YSB8fCB0aGlzLl9kYXRhO1xuXG4gIC8vIHN0b3JlIGNhbGxiYWNrXG4gIHRoaXMuX2NhbGxiYWNrID0gZm4gfHwgbm9vcDtcblxuICAvLyBzdGF0ZSBjaGFuZ2VcbiAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCl7XG4gICAgaWYgKDQgIT0geGhyLnJlYWR5U3RhdGUpIHJldHVybjtcblxuICAgIC8vIEluIElFOSwgcmVhZHMgdG8gYW55IHByb3BlcnR5IChlLmcuIHN0YXR1cykgb2ZmIG9mIGFuIGFib3J0ZWQgWEhSIHdpbGxcbiAgICAvLyByZXN1bHQgaW4gdGhlIGVycm9yIFwiQ291bGQgbm90IGNvbXBsZXRlIHRoZSBvcGVyYXRpb24gZHVlIHRvIGVycm9yIGMwMGMwMjNmXCJcbiAgICB2YXIgc3RhdHVzO1xuICAgIHRyeSB7IHN0YXR1cyA9IHhoci5zdGF0dXMgfSBjYXRjaChlKSB7IHN0YXR1cyA9IDA7IH1cblxuICAgIGlmICgwID09IHN0YXR1cykge1xuICAgICAgaWYgKHNlbGYudGltZWRvdXQpIHJldHVybiBzZWxmLnRpbWVvdXRFcnJvcigpO1xuICAgICAgaWYgKHNlbGYuYWJvcnRlZCkgcmV0dXJuO1xuICAgICAgcmV0dXJuIHNlbGYuY3Jvc3NEb21haW5FcnJvcigpO1xuICAgIH1cbiAgICBzZWxmLmVtaXQoJ2VuZCcpO1xuICB9O1xuXG4gIC8vIHByb2dyZXNzXG4gIHZhciBoYW5kbGVQcm9ncmVzcyA9IGZ1bmN0aW9uKGUpe1xuICAgIGlmIChlLnRvdGFsID4gMCkge1xuICAgICAgZS5wZXJjZW50ID0gZS5sb2FkZWQgLyBlLnRvdGFsICogMTAwO1xuICAgIH1cbiAgICBlLmRpcmVjdGlvbiA9ICdkb3dubG9hZCc7XG4gICAgc2VsZi5lbWl0KCdwcm9ncmVzcycsIGUpO1xuICB9O1xuICBpZiAodGhpcy5oYXNMaXN0ZW5lcnMoJ3Byb2dyZXNzJykpIHtcbiAgICB4aHIub25wcm9ncmVzcyA9IGhhbmRsZVByb2dyZXNzO1xuICB9XG4gIHRyeSB7XG4gICAgaWYgKHhoci51cGxvYWQgJiYgdGhpcy5oYXNMaXN0ZW5lcnMoJ3Byb2dyZXNzJykpIHtcbiAgICAgIHhoci51cGxvYWQub25wcm9ncmVzcyA9IGhhbmRsZVByb2dyZXNzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7XG4gICAgLy8gQWNjZXNzaW5nIHhoci51cGxvYWQgZmFpbHMgaW4gSUUgZnJvbSBhIHdlYiB3b3JrZXIsIHNvIGp1c3QgcHJldGVuZCBpdCBkb2Vzbid0IGV4aXN0LlxuICAgIC8vIFJlcG9ydGVkIGhlcmU6XG4gICAgLy8gaHR0cHM6Ly9jb25uZWN0Lm1pY3Jvc29mdC5jb20vSUUvZmVlZGJhY2svZGV0YWlscy84MzcyNDUveG1saHR0cHJlcXVlc3QtdXBsb2FkLXRocm93cy1pbnZhbGlkLWFyZ3VtZW50LXdoZW4tdXNlZC1mcm9tLXdlYi13b3JrZXItY29udGV4dFxuICB9XG5cbiAgLy8gdGltZW91dFxuICBpZiAodGltZW91dCAmJiAhdGhpcy5fdGltZXIpIHtcbiAgICB0aGlzLl90aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHNlbGYudGltZWRvdXQgPSB0cnVlO1xuICAgICAgc2VsZi5hYm9ydCgpO1xuICAgIH0sIHRpbWVvdXQpO1xuICB9XG5cbiAgLy8gcXVlcnlzdHJpbmdcbiAgaWYgKHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSByZXF1ZXN0LnNlcmlhbGl6ZU9iamVjdChxdWVyeSk7XG4gICAgdGhpcy51cmwgKz0gfnRoaXMudXJsLmluZGV4T2YoJz8nKVxuICAgICAgPyAnJicgKyBxdWVyeVxuICAgICAgOiAnPycgKyBxdWVyeTtcbiAgfVxuXG4gIC8vIGluaXRpYXRlIHJlcXVlc3RcbiAgaWYgKHRoaXMudXNlcm5hbWUgJiYgdGhpcy5wYXNzd29yZCkge1xuICAgIHhoci5vcGVuKHRoaXMubWV0aG9kLCB0aGlzLnVybCwgdHJ1ZSwgdGhpcy51c2VybmFtZSwgdGhpcy5wYXNzd29yZCk7XG4gIH0gZWxzZSB7XG4gICAgeGhyLm9wZW4odGhpcy5tZXRob2QsIHRoaXMudXJsLCB0cnVlKTtcbiAgfVxuXG4gIC8vIENPUlNcbiAgaWYgKHRoaXMuX3dpdGhDcmVkZW50aWFscykgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG5cbiAgLy8gYm9keVxuICBpZiAoJ0dFVCcgIT0gdGhpcy5tZXRob2QgJiYgJ0hFQUQnICE9IHRoaXMubWV0aG9kICYmICdzdHJpbmcnICE9IHR5cGVvZiBkYXRhICYmICFpc0hvc3QoZGF0YSkpIHtcbiAgICAvLyBzZXJpYWxpemUgc3R1ZmZcbiAgICB2YXIgY29udGVudFR5cGUgPSB0aGlzLl9oZWFkZXJbJ2NvbnRlbnQtdHlwZSddO1xuICAgIHZhciBzZXJpYWxpemUgPSB0aGlzLl9wYXJzZXIgfHwgcmVxdWVzdC5zZXJpYWxpemVbY29udGVudFR5cGUgPyBjb250ZW50VHlwZS5zcGxpdCgnOycpWzBdIDogJyddO1xuICAgIGlmICghc2VyaWFsaXplICYmIGlzSlNPTihjb250ZW50VHlwZSkpIHNlcmlhbGl6ZSA9IHJlcXVlc3Quc2VyaWFsaXplWydhcHBsaWNhdGlvbi9qc29uJ107XG4gICAgaWYgKHNlcmlhbGl6ZSkgZGF0YSA9IHNlcmlhbGl6ZShkYXRhKTtcbiAgfVxuXG4gIC8vIHNldCBoZWFkZXIgZmllbGRzXG4gIGZvciAodmFyIGZpZWxkIGluIHRoaXMuaGVhZGVyKSB7XG4gICAgaWYgKG51bGwgPT0gdGhpcy5oZWFkZXJbZmllbGRdKSBjb250aW51ZTtcbiAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihmaWVsZCwgdGhpcy5oZWFkZXJbZmllbGRdKTtcbiAgfVxuXG4gIGlmICh0aGlzLl9yZXNwb25zZVR5cGUpIHtcbiAgICB4aHIucmVzcG9uc2VUeXBlID0gdGhpcy5fcmVzcG9uc2VUeXBlO1xuICB9XG5cbiAgLy8gc2VuZCBzdHVmZlxuICB0aGlzLmVtaXQoJ3JlcXVlc3QnLCB0aGlzKTtcblxuICAvLyBJRTExIHhoci5zZW5kKHVuZGVmaW5lZCkgc2VuZHMgJ3VuZGVmaW5lZCcgc3RyaW5nIGFzIFBPU1QgcGF5bG9hZCAoaW5zdGVhZCBvZiBub3RoaW5nKVxuICAvLyBXZSBuZWVkIG51bGwgaGVyZSBpZiBkYXRhIGlzIHVuZGVmaW5lZFxuICB4aHIuc2VuZCh0eXBlb2YgZGF0YSAhPT0gJ3VuZGVmaW5lZCcgPyBkYXRhIDogbnVsbCk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuXG4vKipcbiAqIEV4cG9zZSBgUmVxdWVzdGAuXG4gKi9cblxucmVxdWVzdC5SZXF1ZXN0ID0gUmVxdWVzdDtcblxuLyoqXG4gKiBHRVQgYHVybGAgd2l0aCBvcHRpb25hbCBjYWxsYmFjayBgZm4ocmVzKWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHVybFxuICogQHBhcmFtIHtNaXhlZHxGdW5jdGlvbn0gZGF0YSBvciBmblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1JlcXVlc3R9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbnJlcXVlc3QuZ2V0ID0gZnVuY3Rpb24odXJsLCBkYXRhLCBmbil7XG4gIHZhciByZXEgPSByZXF1ZXN0KCdHRVQnLCB1cmwpO1xuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgZGF0YSkgZm4gPSBkYXRhLCBkYXRhID0gbnVsbDtcbiAgaWYgKGRhdGEpIHJlcS5xdWVyeShkYXRhKTtcbiAgaWYgKGZuKSByZXEuZW5kKGZuKTtcbiAgcmV0dXJuIHJlcTtcbn07XG5cbi8qKlxuICogSEVBRCBgdXJsYCB3aXRoIG9wdGlvbmFsIGNhbGxiYWNrIGBmbihyZXMpYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsXG4gKiBAcGFyYW0ge01peGVkfEZ1bmN0aW9ufSBkYXRhIG9yIGZuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7UmVxdWVzdH1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxucmVxdWVzdC5oZWFkID0gZnVuY3Rpb24odXJsLCBkYXRhLCBmbil7XG4gIHZhciByZXEgPSByZXF1ZXN0KCdIRUFEJywgdXJsKTtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIGRhdGEpIGZuID0gZGF0YSwgZGF0YSA9IG51bGw7XG4gIGlmIChkYXRhKSByZXEuc2VuZChkYXRhKTtcbiAgaWYgKGZuKSByZXEuZW5kKGZuKTtcbiAgcmV0dXJuIHJlcTtcbn07XG5cbi8qKlxuICogREVMRVRFIGB1cmxgIHdpdGggb3B0aW9uYWwgY2FsbGJhY2sgYGZuKHJlcylgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmxcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtSZXF1ZXN0fVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWwodXJsLCBmbil7XG4gIHZhciByZXEgPSByZXF1ZXN0KCdERUxFVEUnLCB1cmwpO1xuICBpZiAoZm4pIHJlcS5lbmQoZm4pO1xuICByZXR1cm4gcmVxO1xufTtcblxucmVxdWVzdFsnZGVsJ10gPSBkZWw7XG5yZXF1ZXN0WydkZWxldGUnXSA9IGRlbDtcblxuLyoqXG4gKiBQQVRDSCBgdXJsYCB3aXRoIG9wdGlvbmFsIGBkYXRhYCBhbmQgY2FsbGJhY2sgYGZuKHJlcylgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmxcbiAqIEBwYXJhbSB7TWl4ZWR9IGRhdGFcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtSZXF1ZXN0fVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5yZXF1ZXN0LnBhdGNoID0gZnVuY3Rpb24odXJsLCBkYXRhLCBmbil7XG4gIHZhciByZXEgPSByZXF1ZXN0KCdQQVRDSCcsIHVybCk7XG4gIGlmICgnZnVuY3Rpb24nID09IHR5cGVvZiBkYXRhKSBmbiA9IGRhdGEsIGRhdGEgPSBudWxsO1xuICBpZiAoZGF0YSkgcmVxLnNlbmQoZGF0YSk7XG4gIGlmIChmbikgcmVxLmVuZChmbik7XG4gIHJldHVybiByZXE7XG59O1xuXG4vKipcbiAqIFBPU1QgYHVybGAgd2l0aCBvcHRpb25hbCBgZGF0YWAgYW5kIGNhbGxiYWNrIGBmbihyZXMpYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsXG4gKiBAcGFyYW0ge01peGVkfSBkYXRhXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7UmVxdWVzdH1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxucmVxdWVzdC5wb3N0ID0gZnVuY3Rpb24odXJsLCBkYXRhLCBmbil7XG4gIHZhciByZXEgPSByZXF1ZXN0KCdQT1NUJywgdXJsKTtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIGRhdGEpIGZuID0gZGF0YSwgZGF0YSA9IG51bGw7XG4gIGlmIChkYXRhKSByZXEuc2VuZChkYXRhKTtcbiAgaWYgKGZuKSByZXEuZW5kKGZuKTtcbiAgcmV0dXJuIHJlcTtcbn07XG5cbi8qKlxuICogUFVUIGB1cmxgIHdpdGggb3B0aW9uYWwgYGRhdGFgIGFuZCBjYWxsYmFjayBgZm4ocmVzKWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHVybFxuICogQHBhcmFtIHtNaXhlZHxGdW5jdGlvbn0gZGF0YSBvciBmblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1JlcXVlc3R9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbnJlcXVlc3QucHV0ID0gZnVuY3Rpb24odXJsLCBkYXRhLCBmbil7XG4gIHZhciByZXEgPSByZXF1ZXN0KCdQVVQnLCB1cmwpO1xuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgZGF0YSkgZm4gPSBkYXRhLCBkYXRhID0gbnVsbDtcbiAgaWYgKGRhdGEpIHJlcS5zZW5kKGRhdGEpO1xuICBpZiAoZm4pIHJlcS5lbmQoZm4pO1xuICByZXR1cm4gcmVxO1xufTtcbiIsIi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpc09iamVjdChvYmopIHtcbiAgcmV0dXJuIG51bGwgIT0gb2JqICYmICdvYmplY3QnID09IHR5cGVvZiBvYmo7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNPYmplY3Q7XG4iLCIvKipcbiAqIE1vZHVsZSBvZiBtaXhlZC1pbiBmdW5jdGlvbnMgc2hhcmVkIGJldHdlZW4gbm9kZSBhbmQgY2xpZW50IGNvZGVcbiAqL1xudmFyIGlzT2JqZWN0ID0gcmVxdWlyZSgnLi9pcy1vYmplY3QnKTtcblxuLyoqXG4gKiBDbGVhciBwcmV2aW91cyB0aW1lb3V0LlxuICpcbiAqIEByZXR1cm4ge1JlcXVlc3R9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5leHBvcnRzLmNsZWFyVGltZW91dCA9IGZ1bmN0aW9uIF9jbGVhclRpbWVvdXQoKXtcbiAgdGhpcy5fdGltZW91dCA9IDA7XG4gIGNsZWFyVGltZW91dCh0aGlzLl90aW1lcik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBGb3JjZSBnaXZlbiBwYXJzZXJcbiAqXG4gKiBTZXRzIHRoZSBib2R5IHBhcnNlciBubyBtYXR0ZXIgdHlwZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5leHBvcnRzLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UoZm4pe1xuICB0aGlzLl9wYXJzZXIgPSBmbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFNldCB0aW1lb3V0IHRvIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtSZXF1ZXN0fSBmb3IgY2hhaW5pbmdcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZXhwb3J0cy50aW1lb3V0ID0gZnVuY3Rpb24gdGltZW91dChtcyl7XG4gIHRoaXMuX3RpbWVvdXQgPSBtcztcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEZhdXggcHJvbWlzZSBzdXBwb3J0XG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVsZmlsbFxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVqZWN0XG4gKiBAcmV0dXJuIHtSZXF1ZXN0fVxuICovXG5cbmV4cG9ydHMudGhlbiA9IGZ1bmN0aW9uIHRoZW4oZnVsZmlsbCwgcmVqZWN0KSB7XG4gIHJldHVybiB0aGlzLmVuZChmdW5jdGlvbihlcnIsIHJlcykge1xuICAgIGVyciA/IHJlamVjdChlcnIpIDogZnVsZmlsbChyZXMpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBBbGxvdyBmb3IgZXh0ZW5zaW9uXG4gKi9cblxuZXhwb3J0cy51c2UgPSBmdW5jdGlvbiB1c2UoZm4pIHtcbiAgZm4odGhpcyk7XG4gIHJldHVybiB0aGlzO1xufVxuXG5cbi8qKlxuICogR2V0IHJlcXVlc3QgaGVhZGVyIGBmaWVsZGAuXG4gKiBDYXNlLWluc2Vuc2l0aXZlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWVsZFxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5leHBvcnRzLmdldCA9IGZ1bmN0aW9uKGZpZWxkKXtcbiAgcmV0dXJuIHRoaXMuX2hlYWRlcltmaWVsZC50b0xvd2VyQ2FzZSgpXTtcbn07XG5cbi8qKlxuICogR2V0IGNhc2UtaW5zZW5zaXRpdmUgaGVhZGVyIGBmaWVsZGAgdmFsdWUuXG4gKiBUaGlzIGlzIGEgZGVwcmVjYXRlZCBpbnRlcm5hbCBBUEkuIFVzZSBgLmdldChmaWVsZClgIGluc3RlYWQuXG4gKlxuICogKGdldEhlYWRlciBpcyBubyBsb25nZXIgdXNlZCBpbnRlcm5hbGx5IGJ5IHRoZSBzdXBlcmFnZW50IGNvZGUgYmFzZSlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZmllbGRcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICogQGRlcHJlY2F0ZWRcbiAqL1xuXG5leHBvcnRzLmdldEhlYWRlciA9IGV4cG9ydHMuZ2V0O1xuXG4vKipcbiAqIFNldCBoZWFkZXIgYGZpZWxkYCB0byBgdmFsYCwgb3IgbXVsdGlwbGUgZmllbGRzIHdpdGggb25lIG9iamVjdC5cbiAqIENhc2UtaW5zZW5zaXRpdmUuXG4gKlxuICogRXhhbXBsZXM6XG4gKlxuICogICAgICByZXEuZ2V0KCcvJylcbiAqICAgICAgICAuc2V0KCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpXG4gKiAgICAgICAgLnNldCgnWC1BUEktS2V5JywgJ2Zvb2JhcicpXG4gKiAgICAgICAgLmVuZChjYWxsYmFjayk7XG4gKlxuICogICAgICByZXEuZ2V0KCcvJylcbiAqICAgICAgICAuc2V0KHsgQWNjZXB0OiAnYXBwbGljYXRpb24vanNvbicsICdYLUFQSS1LZXknOiAnZm9vYmFyJyB9KVxuICogICAgICAgIC5lbmQoY2FsbGJhY2spO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gZmllbGRcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWxcbiAqIEByZXR1cm4ge1JlcXVlc3R9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5leHBvcnRzLnNldCA9IGZ1bmN0aW9uKGZpZWxkLCB2YWwpe1xuICBpZiAoaXNPYmplY3QoZmllbGQpKSB7XG4gICAgZm9yICh2YXIga2V5IGluIGZpZWxkKSB7XG4gICAgICB0aGlzLnNldChrZXksIGZpZWxkW2tleV0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICB0aGlzLl9oZWFkZXJbZmllbGQudG9Mb3dlckNhc2UoKV0gPSB2YWw7XG4gIHRoaXMuaGVhZGVyW2ZpZWxkXSA9IHZhbDtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBoZWFkZXIgYGZpZWxkYC5cbiAqIENhc2UtaW5zZW5zaXRpdmUuXG4gKlxuICogRXhhbXBsZTpcbiAqXG4gKiAgICAgIHJlcS5nZXQoJy8nKVxuICogICAgICAgIC51bnNldCgnVXNlci1BZ2VudCcpXG4gKiAgICAgICAgLmVuZChjYWxsYmFjayk7XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGZpZWxkXG4gKi9cbmV4cG9ydHMudW5zZXQgPSBmdW5jdGlvbihmaWVsZCl7XG4gIGRlbGV0ZSB0aGlzLl9oZWFkZXJbZmllbGQudG9Mb3dlckNhc2UoKV07XG4gIGRlbGV0ZSB0aGlzLmhlYWRlcltmaWVsZF07XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBXcml0ZSB0aGUgZmllbGQgYG5hbWVgIGFuZCBgdmFsYCBmb3IgXCJtdWx0aXBhcnQvZm9ybS1kYXRhXCJcbiAqIHJlcXVlc3QgYm9kaWVzLlxuICpcbiAqIGBgYCBqc1xuICogcmVxdWVzdC5wb3N0KCcvdXBsb2FkJylcbiAqICAgLmZpZWxkKCdmb28nLCAnYmFyJylcbiAqICAgLmVuZChjYWxsYmFjayk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHBhcmFtIHtTdHJpbmd8QmxvYnxGaWxlfEJ1ZmZlcnxmcy5SZWFkU3RyZWFtfSB2YWxcbiAqIEByZXR1cm4ge1JlcXVlc3R9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuZXhwb3J0cy5maWVsZCA9IGZ1bmN0aW9uKG5hbWUsIHZhbCkge1xuICB0aGlzLl9nZXRGb3JtRGF0YSgpLmFwcGVuZChuYW1lLCB2YWwpO1xuICByZXR1cm4gdGhpcztcbn07XG4iLCIvLyBUaGUgbm9kZSBhbmQgYnJvd3NlciBtb2R1bGVzIGV4cG9zZSB2ZXJzaW9ucyBvZiB0aGlzIHdpdGggdGhlXG4vLyBhcHByb3ByaWF0ZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBib3VuZCBhcyBmaXJzdCBhcmd1bWVudFxuLyoqXG4gKiBJc3N1ZSBhIHJlcXVlc3Q6XG4gKlxuICogRXhhbXBsZXM6XG4gKlxuICogICAgcmVxdWVzdCgnR0VUJywgJy91c2VycycpLmVuZChjYWxsYmFjaylcbiAqICAgIHJlcXVlc3QoJy91c2VycycpLmVuZChjYWxsYmFjaylcbiAqICAgIHJlcXVlc3QoJy91c2VycycsIGNhbGxiYWNrKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfEZ1bmN0aW9ufSB1cmwgb3IgY2FsbGJhY2tcbiAqIEByZXR1cm4ge1JlcXVlc3R9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIHJlcXVlc3QoUmVxdWVzdENvbnN0cnVjdG9yLCBtZXRob2QsIHVybCkge1xuICAvLyBjYWxsYmFja1xuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgdXJsKSB7XG4gICAgcmV0dXJuIG5ldyBSZXF1ZXN0Q29uc3RydWN0b3IoJ0dFVCcsIG1ldGhvZCkuZW5kKHVybCk7XG4gIH1cblxuICAvLyB1cmwgZmlyc3RcbiAgaWYgKDIgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xuICAgIHJldHVybiBuZXcgUmVxdWVzdENvbnN0cnVjdG9yKCdHRVQnLCBtZXRob2QpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBSZXF1ZXN0Q29uc3RydWN0b3IobWV0aG9kLCB1cmwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVlc3Q7XG4iLCIvLyBBbmd1bGFyIDEgbW9kdWxlcyBhbmQgZmFjdG9yaWVzIGZvciB0aGUgYnVuZGxlXG5cbmlmICh0eXBlb2YgYW5ndWxhciA9PT0gJ29iamVjdCcgJiYgYW5ndWxhci5tb2R1bGUpIHtcblxuICBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCkge1xuICAgIElvbmljLmNvcmUuaW5pdCgpO1xuICAgIElvbmljLmNvcmRvdmEuYm9vdHN0cmFwKCk7XG4gIH0pO1xuXG4gIGFuZ3VsYXIubW9kdWxlKCdpb25pYy5jbG91ZCcsIFtdKVxuXG4gIC5wcm92aWRlcignJGlvbmljQ2xvdWRDb25maWcnLCBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29uZmlnID0gSW9uaWMuY29uZmlnO1xuXG4gICAgdGhpcy5yZWdpc3RlciA9IGZ1bmN0aW9uKHNldHRpbmdzKSB7XG4gICAgICBjb25maWcucmVnaXN0ZXIoc2V0dGluZ3MpO1xuICAgIH07XG5cbiAgICB0aGlzLiRnZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfTtcbiAgfSlcblxuICAucHJvdmlkZXIoJyRpb25pY0Nsb3VkJywgWyckaW9uaWNDbG91ZENvbmZpZ1Byb3ZpZGVyJywgZnVuY3Rpb24oJGlvbmljQ2xvdWRDb25maWdQcm92aWRlcikge1xuICAgIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAkaW9uaWNDbG91ZENvbmZpZ1Byb3ZpZGVyLnJlZ2lzdGVyKHZhbHVlKTtcbiAgICB9O1xuXG4gICAgdGhpcy4kZ2V0ID0gW2Z1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIElvbmljLmNvcmU7XG4gICAgfV07XG4gIH1dKVxuXG4gIC5mYWN0b3J5KCckaW9uaWNDbG91ZENsaWVudCcsIFtmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gSW9uaWMuY2xpZW50O1xuICB9XSlcblxuICAuZmFjdG9yeSgnJGlvbmljVXNlcicsIFtmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gSW9uaWMuc2luZ2xlVXNlclNlcnZpY2UuY3VycmVudCgpO1xuICB9XSlcblxuICAuZmFjdG9yeSgnJGlvbmljQXV0aCcsIFtmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gSW9uaWMuYXV0aDtcbiAgfV0pXG5cbiAgLmZhY3RvcnkoJyRpb25pY1B1c2gnLCBbZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIElvbmljLnB1c2g7XG4gIH1dKVxuXG4gIC5mYWN0b3J5KCckaW9uaWNEZXBsb3knLCBbZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIElvbmljLmRlcGxveTtcbiAgfV0pXG5cbiAgLnJ1bihbJyR3aW5kb3cnLCAnJHEnLCAnJHJvb3RTY29wZScsIGZ1bmN0aW9uKCR3aW5kb3csICRxLCAkcm9vdFNjb3BlKSB7XG4gICAgaWYgKHR5cGVvZiAkd2luZG93LlByb21pc2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAkd2luZG93LlByb21pc2UgPSAkcTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGluaXQgPSBJb25pYy5DbG91ZC5EZWZlcnJlZFByb21pc2UucHJvdG90eXBlLmluaXQ7XG5cbiAgICAgIElvbmljLkNsb3VkLkRlZmVycmVkUHJvbWlzZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpbml0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMucHJvbWlzZSA9ICRxLndoZW4odGhpcy5wcm9taXNlKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIGVtaXQgPSBJb25pYy5DbG91ZC5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQ7XG5cbiAgICBJb25pYy5DbG91ZC5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ2Nsb3VkOicgKyBuYW1lLCBkYXRhKTtcbiAgICAgIHJldHVybiBlbWl0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfV0pO1xuXG59XG4iLCJ2YXIgQ29yZSA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L2NvcmVcIikuQ29yZTtcbnZhciBEYXRhVHlwZSA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L3VzZXIvZGF0YS10eXBlc1wiKS5EYXRhVHlwZTtcbnZhciBEZXBsb3kgPSByZXF1aXJlKFwiLi8uLi9kaXN0L2VzNS9kZXBsb3kvZGVwbG95XCIpLkRlcGxveTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKFwiLi8uLi9kaXN0L2VzNS9ldmVudHNcIikuRXZlbnRFbWl0dGVyO1xudmFyIExvZ2dlciA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L2xvZ2dlclwiKS5Mb2dnZXI7XG52YXIgUHVzaCA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L3B1c2gvcHVzaFwiKS5QdXNoO1xudmFyIFB1c2hNZXNzYWdlID0gcmVxdWlyZShcIi4vLi4vZGlzdC9lczUvcHVzaC9tZXNzYWdlXCIpLlB1c2hNZXNzYWdlO1xudmFyIGF1dGggPSByZXF1aXJlKFwiLi8uLi9kaXN0L2VzNS9hdXRoXCIpO1xudmFyIGNsaWVudCA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L2NsaWVudFwiKTtcbnZhciBjb25maWcgPSByZXF1aXJlKFwiLi8uLi9kaXN0L2VzNS9jb25maWdcIik7XG52YXIgY29yZG92YSA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L2NvcmRvdmFcIik7XG52YXIgZGV2aWNlID0gcmVxdWlyZShcIi4vLi4vZGlzdC9lczUvZGV2aWNlXCIpO1xudmFyIGRpID0gcmVxdWlyZShcIi4vLi4vZGlzdC9lczUvZGlcIik7XG52YXIgcHJvbWlzZSA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L3Byb21pc2VcIik7XG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L3N0b3JhZ2VcIik7XG52YXIgdXNlciA9IHJlcXVpcmUoXCIuLy4uL2Rpc3QvZXM1L3VzZXIvdXNlclwiKTtcblxuLy8gRGVjbGFyZSB0aGUgd2luZG93IG9iamVjdFxud2luZG93LklvbmljID0gbmV3IGRpLkNvbnRhaW5lcigpO1xuXG4vLyBJb25pYyBNb2R1bGVzXG5Jb25pYy5Db3JlID0gQ29yZTtcbklvbmljLlVzZXIgPSB1c2VyLlVzZXI7XG5Jb25pYy5BdXRoID0gYXV0aC5BdXRoO1xuSW9uaWMuRGVwbG95ID0gRGVwbG95O1xuSW9uaWMuUHVzaCA9IFB1c2g7XG5Jb25pYy5QdXNoTWVzc2FnZSA9IFB1c2hNZXNzYWdlO1xuXG4vLyBEYXRhVHlwZSBOYW1lc3BhY2VcbklvbmljLkRhdGFUeXBlID0gRGF0YVR5cGU7XG5Jb25pYy5EYXRhVHlwZXMgPSBEYXRhVHlwZS5nZXRNYXBwaW5nKCk7XG5cbi8vIENsb3VkIE5hbWVzcGFjZVxuSW9uaWMuQ2xvdWQgPSB7fTtcbklvbmljLkNsb3VkLkF1dGhUeXBlID0gYXV0aC5BdXRoVHlwZTtcbklvbmljLkNsb3VkLkF1dGhUeXBlcyA9IHt9O1xuSW9uaWMuQ2xvdWQuQXV0aFR5cGVzLkJhc2ljQXV0aCA9IGF1dGguQmFzaWNBdXRoO1xuSW9uaWMuQ2xvdWQuQXV0aFR5cGVzLkN1c3RvbUF1dGggPSBhdXRoLkN1c3RvbUF1dGg7XG5Jb25pYy5DbG91ZC5BdXRoVHlwZXMuVHdpdHRlckF1dGggPSBhdXRoLlR3aXR0ZXJBdXRoO1xuSW9uaWMuQ2xvdWQuQXV0aFR5cGVzLkZhY2Vib29rQXV0aCA9IGF1dGguRmFjZWJvb2tBdXRoO1xuSW9uaWMuQ2xvdWQuQXV0aFR5cGVzLkdpdGh1YkF1dGggPSBhdXRoLkdpdGh1YkF1dGg7XG5Jb25pYy5DbG91ZC5BdXRoVHlwZXMuR29vZ2xlQXV0aCA9IGF1dGguR29vZ2xlQXV0aDtcbklvbmljLkNsb3VkLkF1dGhUeXBlcy5JbnN0YWdyYW1BdXRoID0gYXV0aC5JbnN0YWdyYW1BdXRoO1xuSW9uaWMuQ2xvdWQuQXV0aFR5cGVzLkxpbmtlZEluQXV0aCA9IGF1dGguTGlua2VkSW5BdXRoO1xuSW9uaWMuQ2xvdWQuQ29yZG92YSA9IGNvcmRvdmEuQ29yZG92YTtcbklvbmljLkNsb3VkLkNsaWVudCA9IGNsaWVudC5DbGllbnQ7XG5Jb25pYy5DbG91ZC5EZXZpY2UgPSBkZXZpY2UuRGV2aWNlO1xuSW9uaWMuQ2xvdWQuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuSW9uaWMuQ2xvdWQuTG9nZ2VyID0gTG9nZ2VyO1xuSW9uaWMuQ2xvdWQuRGVmZXJyZWRQcm9taXNlID0gcHJvbWlzZS5EZWZlcnJlZFByb21pc2U7XG5Jb25pYy5DbG91ZC5TdG9yYWdlID0gc3RvcmFnZS5TdG9yYWdlO1xuSW9uaWMuQ2xvdWQuVXNlckNvbnRleHQgPSB1c2VyLlVzZXJDb250ZXh0O1xuSW9uaWMuQ2xvdWQuU2luZ2xlVXNlclNlcnZpY2UgPSB1c2VyLlNpbmdsZVVzZXJTZXJ2aWNlO1xuSW9uaWMuQ2xvdWQuQXV0aFRva2VuQ29udGV4dCA9IGF1dGguQXV0aFRva2VuQ29udGV4dDtcbklvbmljLkNsb3VkLkNvbWJpbmVkQXV0aFRva2VuQ29udGV4dCA9IGF1dGguQ29tYmluZWRBdXRoVG9rZW5Db250ZXh0O1xuSW9uaWMuQ2xvdWQuTG9jYWxTdG9yYWdlU3RyYXRlZ3kgPSBzdG9yYWdlLkxvY2FsU3RvcmFnZVN0cmF0ZWd5O1xuSW9uaWMuQ2xvdWQuU2Vzc2lvblN0b3JhZ2VTdHJhdGVneSA9IHN0b3JhZ2UuU2Vzc2lvblN0b3JhZ2VTdHJhdGVneTtcbklvbmljLkNsb3VkLkNvbmZpZyA9IGNvbmZpZy5Db25maWc7XG4iXX0=
