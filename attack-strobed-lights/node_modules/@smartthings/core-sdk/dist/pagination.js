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
exports.PaginatedList = exports.PaginatedListIterator = void 0;
class PaginatedListIterator {
    constructor(client, page) {
        this.client = client;
        this.page = page;
        this.index = 0;
    }
    next() {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.index < this.page.items.length) {
                let done = false;
                const value = this.page.items[this.index++];
                if (this.index === this.page.items.length) {
                    if ((_c = (_b = (_a = this.page) === null || _a === void 0 ? void 0 : _a._links) === null || _b === void 0 ? void 0 : _b.next) === null || _c === void 0 ? void 0 : _c.href) {
                        this.index = 0;
                        this.page = yield this.client.get(this.page._links.next.href);
                    }
                    else {
                        done = true;
                    }
                }
                return { done, value };
            }
            return { done: true, value: undefined };
        });
    }
}
exports.PaginatedListIterator = PaginatedListIterator;
class PaginatedList {
    constructor(page, client) {
        this.page = page;
        this.client = client;
        this.items = page.items;
    }
    [Symbol.asyncIterator]() {
        return new PaginatedListIterator(this.client, this.page);
    }
    hasNext() {
        var _a;
        return !!((_a = this.page._links) === null || _a === void 0 ? void 0 : _a.next);
    }
    hasPrevious() {
        var _a;
        return !!((_a = this.page._links) === null || _a === void 0 ? void 0 : _a.previous);
    }
    next() {
        var _a, _b;
        if ((_b = (_a = this.page._links) === null || _a === void 0 ? void 0 : _a.next) === null || _b === void 0 ? void 0 : _b.href) {
            return this.client.get(this.page._links.next.href).then(response => {
                var _a;
                this.items = response.items;
                this.page = response;
                return !!((_a = response._links) === null || _a === void 0 ? void 0 : _a.next);
            });
        }
        return Promise.reject(new Error('No next results'));
    }
    previous() {
        var _a;
        if ((_a = this.page._links) === null || _a === void 0 ? void 0 : _a.previous) {
            return this.client.get(this.page._links.previous.href).then(response => {
                var _a;
                this.items = response.items;
                this.page = response;
                return !!((_a = response._links) === null || _a === void 0 ? void 0 : _a.previous);
            });
        }
        return Promise.reject(new Error('No previous results'));
    }
}
exports.PaginatedList = PaginatedList;
