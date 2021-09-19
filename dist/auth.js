"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthToken = exports.isAuthenticated = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = require("fs-extra");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const path_1 = require("path");
const os_1 = require("os");
const jwt_decode_1 = __importDefault(require("jwt-decode"));
const open_1 = __importDefault(require("open"));
const tenantId = 'decentology.us.auth0.com';
const clientId = '94QrhsnCFTFSB6r37UKNFfFjDtC55ZRU';
async function loginDialog() {
    let deviceCodeRequest = await (await (0, node_fetch_1.default)(`https://${tenantId}/oauth/device/code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: [`client_id=${clientId}`, 'scope=openid email'].join('&'),
    })).json();
    console.log(chalk_1.default.yellow(`Open your browser to ${deviceCodeRequest.verification_uri} and enter code ${deviceCodeRequest.user_code} to complete authentication.`));
    (0, open_1.default)(deviceCodeRequest.verification_uri_complete);
    let result = await (0, rxjs_1.interval)(deviceCodeRequest.interval * 1000)
        .pipe((0, operators_1.map)(() => (0, rxjs_1.defer)(async () => {
        let resp = await (0, node_fetch_1.default)(`https://${tenantId}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: [
                'grant_type=urn:ietf:params:oauth:grant-type:device_code',
                `client_id=${clientId}`,
                `device_code=${deviceCodeRequest.device_code}`,
            ].join('&'),
        });
        let body = await resp.json();
        return {
            status: resp.status,
            data: body,
        };
    })), (0, operators_1.mergeAll)(1), (0, operators_1.takeWhile)((x) => x.status != 200, true), (0, operators_1.filter)((x) => x.status === 200), (0, operators_1.tap)(() => (0, fs_extra_1.ensureDir)((0, path_1.join)((0, os_1.homedir)(), '.dappstarter'))))
        .toPromise()
        .catch((err) => console.log(chalk_1.default.red(err)));
    if (result) {
        (0, fs_extra_1.writeJson)((0, path_1.join)((0, os_1.homedir)(), '.dappstarter', 'user.json'), result.data);
        let user = (0, jwt_decode_1.default)(result.data.id_token);
        console.log(chalk_1.default.green(`Successfully authenticated as ${user.email}`));
    }
}
exports.default = loginDialog;
async function isAuthenticated() {
    return await (0, fs_extra_1.pathExists)((0, path_1.join)((0, os_1.homedir)(), '.dappstarter', 'user.json'));
}
exports.isAuthenticated = isAuthenticated;
async function getAuthToken() {
    let authKey = (await (0, fs_extra_1.readJson)((0, path_1.join)((0, os_1.homedir)(), '.dappstarter', 'user.json'))).id_token;
    return authKey;
}
exports.getAuthToken = getAuthToken;
//# sourceMappingURL=auth.js.map