"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenesEndpoint = void 0;
const endpoint_1 = require("../endpoint");
const endpoint_client_1 = require("../endpoint-client");
class ScenesEndpoint extends endpoint_1.Endpoint {
    constructor(config) {
        super(new endpoint_client_1.EndpointClient('scenes', config));
    }
    /**
     * Returns a list of scenes filterd by the specified options. If a location ID is included in the options or the
     * client has been configured with a location ID, then only the scenes in that location are returned. If there is
     * no locationId configured or specified, then the scenes in all locations accessible to the principal are returned.
     * @param options optional filtering options accepting the location Id
     */
    list(options = {}) {
        const params = {};
        if ('locationId' in options && options.locationId) {
            params.locationId = options.locationId;
        }
        else if (this.client.config.locationId) {
            params.locationId = this.client.config.locationId;
        }
        return this.client.getPagedItems(undefined, params);
    }
    /**
     * Get a specific scene
     * @param id UUID of the scene
     */
    get(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const list = yield this.client.getPagedItems();
            if (list) {
                const item = list.find(it => it.sceneId === id);
                if (item) {
                    return item;
                }
            }
            throw Error(`Scene ${id} not found`);
        });
    }
    /**
     * Execute the actions specified in a scene
     * @param id
     */
    execute(id) {
        return this.client.post(`${id}/execute`);
    }
}
exports.ScenesEndpoint = ScenesEndpoint;
