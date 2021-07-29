"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = void 0;
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
    let deviceCodeRequest = await (await node_fetch_1.default(`https://${tenantId}/oauth/device/code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: [`client_id=${clientId}`, 'scope=openid email'].join('&'),
    })).json();
    console.log(chalk_1.default.yellow(`Open your browser to ${deviceCodeRequest.verification_uri} and enter code ${deviceCodeRequest.user_code} to complete authentication.`));
    open_1.default(deviceCodeRequest.verification_uri_complete);
    let result = await rxjs_1.interval(deviceCodeRequest.interval * 1000)
        .pipe(operators_1.map(() => rxjs_1.defer(async () => {
        let resp = await node_fetch_1.default(`https://${tenantId}/oauth/token`, {
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
    })), operators_1.mergeAll(1), operators_1.takeWhile((x) => x.status != 200, true), operators_1.filter((x) => x.status === 200), operators_1.tap(() => fs_extra_1.ensureDir(path_1.join(os_1.homedir(), '.dappstarter'))))
        .toPromise()
        .catch((err) => console.log(chalk_1.default.red(err)));
    if (result) {
        fs_extra_1.writeJson(path_1.join(os_1.homedir(), '.dappstarter', 'user.json'), result.data);
        let user = jwt_decode_1.default(result.data.id_token);
        console.log(chalk_1.default.green(`Successfully authenticated as ${user.email}`));
    }
}
exports.default = loginDialog;
async function isAuthenticated() {
    return await fs_extra_1.pathExists(path_1.join(os_1.homedir(), '.dappstarter', 'user.json'));
}
exports.isAuthenticated = isAuthenticated;
//# sourceMappingURL=auth.js.map