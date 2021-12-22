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
exports.NotificationsEndpoint = exports.DeepLinkType = exports.NotificationRequestType = void 0;
const endpoint_1 = require("../endpoint");
const endpoint_client_1 = require("../endpoint-client");
var NotificationRequestType;
(function (NotificationRequestType) {
    NotificationRequestType["ALERT"] = "ALERT";
    NotificationRequestType["SUGGESTED_ACTION"] = "SUGGESTED_ACTION";
    NotificationRequestType["EVENT_LOGGING"] = "EVENT_LOGGING";
    NotificationRequestType["AUTOMATION_INFO"] = "AUTOMATION_INFO";
})(NotificationRequestType = exports.NotificationRequestType || (exports.NotificationRequestType = {}));
var DeepLinkType;
(function (DeepLinkType) {
    DeepLinkType["device"] = "device";
    DeepLinkType["installedApp"] = "installedApp";
    DeepLinkType["location"] = "location";
})(DeepLinkType = exports.DeepLinkType || (exports.DeepLinkType = {}));
class NotificationsEndpoint extends endpoint_1.Endpoint {
    constructor(config) {
        super(new endpoint_client_1.EndpointClient('notification', config));
    }
    /**
     * Sends a push notification to mobile apps belonging to the location
     * @param data the notification request. If the client has been configured with a location ID it can be omitted
     * from this request.
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            data.locationId = this.locationId(data.locationId);
            return this.client.post(undefined, data);
        });
    }
}
exports.NotificationsEndpoint = NotificationsEndpoint;
