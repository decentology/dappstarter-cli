"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEnv = void 0;
const constants_1 = require("./constants");
function setEnv(env) {
    switch (env) {
        case 'staging':
            constants_1.setServiceUrl('https://dappstarter-api-staging.decentology.com');
            break;
        case 'development' || 'dev':
            constants_1.setServiceUrl('http://localhost:6001');
            break;
        case 'production' || 'prod':
            constants_1.setServiceUrl('https://dappstarter-api.decentology.com');
            break;
    }
}
exports.setEnv = setEnv;
//# sourceMappingURL=env.js.map