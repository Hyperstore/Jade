/// <reference path="../../../Scripts/typings/mongodb/mongodb.d.ts" />
export declare class MongoDbAdapter extends Hyperstore.Adapter {
    private url;
    constructor(url?: string);
    public persistElements(session: any, elements: any): void;
}
