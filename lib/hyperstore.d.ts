/// <reference path="../scripts/typings/q/q.d.ts" />
/// <reference path="../scripts/typings/node/node.d.ts" />
export interface ISchemaDefinition {
    defineSchema(schema: Schema): any;
}
export interface ICheckValueObjectConstraint {
    check(value: any, oldValue: any, ctx: ConstraintContext): any;
}
export interface IValidateValueObjectConstraint {
    validate(value: any, oldValue: any, ctx: ConstraintContext): any;
}
export declare enum SchemaKind {
    Entity = 0,
    Relationship = 1,
    ValueObject = 2,
    Primitive = 3,
}
export declare enum Cardinality {
    OneToOne = 0,
    OneToMany = 1,
    ManyToOne = 2,
    ManyToMany = 3,
}
export declare class SerializationContext {
    public domain: DomainModel;
    public id: string;
    public startId: string;
    public startSchemaId: string;
    public endId: string;
    public endSchemaId: string;
    public value: any;
    constructor(domain: DomainModel, id: string, startId?: string, startSchemaId?: string, endId?: string, endSchemaId?: string, value?: any);
}
export declare enum PropertyKind {
    Normal = 0,
    Calculated = 1,
}
export interface IReference {
    name: string;
    opposite: boolean;
    schemaRelationship: SchemaRelationship;
    isCollection: boolean;
}
export declare class Schema {
    public store: Store;
    public name: string;
    public constraints: ConstraintsManager;
    constructor(store: Store, name?: string, def?: ISchemaDefinition);
    public __addSchemaElement(schemaInfo: SchemaInfo): void;
}
export declare class SchemaInfo {
    public schema: Schema;
    public kind: SchemaKind;
    public id: string;
    public name: string;
    constructor(schema: Schema, kind: SchemaKind, id: string);
    public deserialize(ctx: SerializationContext): any;
    public serialize(value: any): any;
}
export declare class SchemaElement extends SchemaInfo {
    public baseElement: SchemaElement;
    private _properties;
    private _references;
    private proto;
    constructor(schema: Schema, kind: SchemaKind, id: string, baseElement?: SchemaElement);
    public getProperties(recursive: boolean): SchemaProperty[];
    private _getReferences(recursive);
    public getReference(name: string, recursive?: boolean): IReference;
    public getProperty(name: string, recursive?: boolean): SchemaProperty;
    public __defineReferenceProperty(schemaRelationship: SchemaRelationship, opposite: boolean): void;
    public defineProperty(name: any, schema: any, defaultValue?: any, kind?: PropertyKind): SchemaProperty;
    public isA(schema: any): boolean;
    public deserialize(ctx: SerializationContext): ModelElement;
    public addConstraint(message: string, constraint: (self: ModelElement, ctx: ConstraintContext) => boolean, asError?: boolean, kind?: ConstraintKind, propertyName?: string): void;
}
export declare class SchemaEntity extends SchemaElement {
    public baseElement: SchemaElement;
    constructor(schema: Schema, id: string, baseElement?: SchemaElement);
    public create(domain: DomainModel, id?: string, version?: number): ModelElement;
}
export declare class SchemaProperty {
    public name: string;
    public schemaProperty: SchemaInfo;
    public defaultValue: any;
    public kind: PropertyKind;
    public owner: SchemaElement;
    constructor(name: string, schemaProperty: SchemaInfo, defaultValue?: any, kind?: PropertyKind);
    public deserialize(ctx: SerializationContext): any;
    public serialize(value: string): any;
    public addConstraint(message: string, condition: (val: any, old: any, ctx: ConstraintContext) => boolean, asError: boolean, kind?: ConstraintKind): SchemaProperty;
}
export declare class SchemaRelationship extends SchemaElement {
    public startSchemaId: string;
    public endSchemaId: string;
    public embedded: boolean;
    public cardinality: Cardinality;
    public baseElement: SchemaElement;
    private _startProperty;
    private _endProperty;
    constructor(schema: Schema, id: string, startSchemaId: string, endSchemaId: string, embedded: boolean, cardinality: Cardinality, startProperty?: string, endProperty?: string, baseElement?: SchemaElement);
    public startProperty : string;
    public endProperty : string;
    public create(domain: DomainModel, start: ModelElement, endId: string, endSchemaId: string, id?: string, version?: number): ModelElement;
}
export declare class SchemaValueObject extends SchemaInfo {
    public parent: SchemaInfo;
    public constraints: IPropertyConstraint[];
    constructor(schema: Schema, id: string, parent?: SchemaInfo);
    public addConstraint(message: string, condition: (val: any, old: any, ctx: ConstraintContext) => boolean, asError?: boolean, kind?: ConstraintKind): void;
}
export declare class Primitive extends SchemaValueObject {
    constructor(schema: Schema, id: string, message?: string, condition?: (val: any, old: any, ctx: ConstraintContext) => boolean, asError?: boolean, kind?: ConstraintKind);
}
export declare enum SessionMode {
    Normal = 0,
    Loading = 4,
    Undo = 8,
    Redo = 16,
    UndoOrRedo = 24,
    Serializing = 32,
    SilentMode = 64,
    Rollback = 2048,
}
export interface SessionConfiguration {
    defaultDomain?: DomainModel;
    mode?: SessionMode;
    sessionId?: number;
    origin?: string;
}
export declare class Session {
    public store: Store;
    private config;
    public events: AbstractEvent[];
    private static _sequence;
    public aborted: boolean;
    private _depth;
    private _committed;
    public closed: boolean;
    public originStoreId: string;
    public mode: SessionMode;
    static current: Session;
    public sessionId: number;
    public trackingData: TrackingData;
    public result: SessionResult;
    constructor(store: Store, config?: SessionConfiguration);
    public __nextLevel(): void;
    public acceptChanges(): void;
    public close(): SessionResult;
    private executeConstraints(elements);
    public addEvent(evt: AbstractEvent): void;
}
export declare class SessionResult {
    private _session;
    private _promises;
    public aborted: boolean;
    public messages: any[];
    public hasErrors: boolean;
    public hasWarnings: boolean;
    public involvedElements: ModelElement[];
    public maxVersionNumber: number;
    constructor(_session: Session);
    public addPromise(q: any): void;
    public registerPromise(obj: any, method: string, callback: (err?: any, r?: any, session?: Session) => void, ...args: any[]): void;
    public async(): Q.Promise<any>;
    public hasErrorsOrWarnings : boolean;
    public __addMessages(messages: any): void;
    public log(message: DiagnosticMessage): void;
    public logError(message: string): void;
}
export declare enum TrackingState {
    Added = 0,
    Removed = 1,
    Updated = 2,
    Unknown = 3,
}
export interface ITrackedElement {
    domain: string;
    state: TrackingState;
    id: string;
    schemaId: string;
    version?: number;
    startId?: string;
    startSchemaId?: string;
    endId?: string;
    endSchemaId?: string;
    properties?: any;
}
export declare class TrackingData {
    private _trackings;
    public involvedTrackedElements : ITrackedElement[];
    public __prepareTrackedElements(store: Store): ModelElement[];
    public getTrackedElementsByState(state: TrackingState): ITrackedElement[];
    public getTrackedElementState(id: string): TrackingState;
    public __onEvent(evt: any): void;
}
export interface IUndoableEvent {
    getReverseEvent(correlationId: number): AbstractEvent;
}
export declare class AbstractEvent {
    public eventName: string;
    public domain: string;
    public correlationId: number;
    public version: number;
    public TL: boolean;
    constructor(eventName: string, domain: string, correlationId: number, version: number);
    public toString(): string;
}
export declare class AddEntityEvent extends AbstractEvent implements IUndoableEvent {
    public id: string;
    public schemaId: string;
    constructor(domain: string, id: string, schemaId: string, correlationId: number, version: number);
    public getReverseEvent(correlationId: number): RemoveEntityEvent;
}
export declare class RemoveEntityEvent extends AbstractEvent implements IUndoableEvent {
    public id: string;
    public schemaId: string;
    constructor(domain: string, id: string, schemaId: string, correlationId: number, version: number);
    public getReverseEvent(correlationId: number): AddEntityEvent;
}
export declare class AddRelationshipEvent extends AbstractEvent implements IUndoableEvent {
    public id: string;
    public schemaId: string;
    public startId: string;
    public startSchemaId: string;
    public endId: string;
    public endSchemaId: string;
    constructor(domain: string, id: string, schemaId: string, startId: string, startSchemaId: string, endId: string, endSchemaId: string, correlationId: number, version: number);
    public getReverseEvent(correlationId: number): RemoveRelationshipEvent;
}
export declare class RemoveRelationshipEvent extends AbstractEvent implements IUndoableEvent {
    public id: string;
    public schemaId: string;
    public startId: string;
    public startSchemaId: string;
    public endId: string;
    public endSchemaId: string;
    constructor(domain: string, id: string, schemaId: string, startId: string, startSchemaId: string, endId: string, endSchemaId: string, correlationId: number, version: number);
    public getReverseEvent(correlationId: number): AddRelationshipEvent;
}
export declare class ChangePropertyValueEvent extends AbstractEvent implements IUndoableEvent {
    public id: string;
    public schemaId: string;
    public propertyName: string;
    public value: any;
    public oldValue: any;
    constructor(domain: string, id: string, schemaId: string, propertyName: string, value: any, oldValue: any, correlationId: number, version: number);
    public getReverseEvent(correlationId: number): ChangePropertyValueEvent;
}
export declare class RemovePropertyEvent extends AbstractEvent implements IUndoableEvent {
    public id: string;
    public schemaId: string;
    public propertyName: string;
    public value: any;
    constructor(domain: string, id: string, schemaId: string, propertyName: string, value: any, correlationId: number, version: number);
    public getReverseEvent(correlationId: number): ChangePropertyValueEvent;
}
export interface SessionInfo {
    aborted: boolean;
    sessionId: number;
    events: AbstractEvent[];
    mode: SessionMode;
}
export interface IEventDispatcher {
    handleEvent(event: AbstractEvent): any;
}
export interface IEventHandler {
    eventName: string;
    execute(domain: DomainModel, event: any): any;
}
export declare class EventDispatcher implements IEventDispatcher {
    public store: Store;
    private _handlers;
    constructor(store: Store);
    public registerHandler(handler: IEventHandler, domain?: string): void;
    public handleEvent(event: AbstractEvent): void;
    private executeHandlers(key, event);
}
export declare class EventManager {
    private domain;
    private _subscriptions;
    static AddEntityEvent: string;
    static RemoveEntityEvent: string;
    static AddRelationshipEvent: string;
    static ChangePropertyValueEvent: string;
    static RemoveRelationshipEvent: string;
    static RemovePropertyEvent: string;
    static SessionCompleted: string;
    static OnErrors: string;
    constructor(domain: string);
    public dispose(): void;
    static createEvent(eventName: string): any;
    public onEntityAdded(callback: (s: SessionInfo, e: AddEntityEvent) => void): any;
    public onEntityRemoved(callback: (s: SessionInfo, e: AddEntityEvent) => void): any;
    public onRelationshipAdded(callback: (s: SessionInfo, e: AddEntityEvent) => void): any;
    public onRelationshipRemoved(callback: (s: SessionInfo, e: AddEntityEvent) => void): any;
    public onPropertyChanged(callback: (s: SessionInfo, e: AddEntityEvent) => void): any;
    public onSessionCompleted(callback: (s: SessionInfo, e: AddEntityEvent) => void): any;
    public on(eventName: string, callback: any): any;
    public remove(cookie: any): EventManager;
    public __notifySessionCompleted(session: Session): void;
}
export declare class PropertyValue {
    public value: any;
    public oldValue: any;
    public version: number;
    constructor(value: any, oldValue: any, version: number);
}
export interface IStoreConfiguration {
    defaultDomainModel?: string;
    storeId?: string;
    channels?: any[];
    schemas: any;
    domains?: any;
}
export declare class Store {
    private schemasBySimpleName;
    private schemas;
    private _domains;
    private _subscriptions;
    public storeId: string;
    public defaultDomainModel: DomainModel;
    public eventBus: EventBus;
    public language: string;
    constructor();
    public init(config?: any): Q.Promise<any>;
    private populateDomain(def, domain);
    public dispose(): void;
    public unloadDomain(domain: DomainModel): void;
    public domains : DomainModel[];
    public onSessionCompleted(action: (s: Session) => any): number;
    public removeSessionCompleted(cookie: number): void;
    public __sendSessionCompletedEvent(session: Session): void;
    private primitiveSchemaDefinition();
    public getDomain(name: string): DomainModel;
    public __addDomain(domain: DomainModel): void;
    public beginSession(config?: SessionConfiguration): Session;
    public __addSchemaElement(schemaInfo: SchemaInfo): void;
    public getSchemaInfo(schemaName: string, throwException?: boolean): SchemaInfo;
    public getSchemaRelationships(start?: any, end?: any): SchemaRelationship[];
    public getSchemaElement(schemaName: string, throwException?: boolean): SchemaElement;
    public getSchemaRelationship(schemaName: string, throwException?: boolean): SchemaRelationship;
    public getSchemaEntity(schemaName: string, throwException?: boolean): SchemaEntity;
    public runInSession(action: () => void): void;
    public get(id: string): ModelElement;
    public find(schemaElement?: SchemaElement, kind?: NodeType): ICursor;
}
export declare class DomainModel {
    public store: Store;
    public name: string;
    private _sequence;
    public events: EventManager;
    private _cache;
    public eventDispatcher: IEventDispatcher;
    private _adapters;
    public extension: string;
    private graph;
    constructor(store: Store, name: string);
    public dispose(): void;
    public createId(id?: string): string;
    public addAdapter(adapter: Adapter): void;
    private findSchemaId(schemas, id);
    public loadFromJson(def: any, rootSchema?: SchemaElement): ModelElement[];
    private parseJson(obj, schema, refs);
    private loadFromHyperstoreJson(def);
    public findRelationships(schemaElement?: SchemaRelationship, start?: ModelElement, end?: ModelElement): ICursor;
    public getPropertyValue(ownerId: string, property: SchemaProperty): PropertyValue;
    public setPropertyValue(ownerId: string, property: SchemaProperty, value: any, version?: number): PropertyValue;
    private updateSequence(id);
    public createEntity(schemaElement: SchemaElement, id?: string, version?: number): ModelElement;
    public createRelationship(schemaRelationship: SchemaRelationship, start: ModelElement, endId: string, endSchemaId: string, id?: string, version?: number): ModelElement;
    public remove(id: string, version?: number): void;
    public elementExists(id: string): boolean;
    public get(id: string): ModelElement;
    public find(schemaElement?: SchemaElement, kind?: NodeType): ICursor;
    private getFromCache(schemaElement, startId?, startSchemaId?, endId?, endSchemaId?, id?);
}
export declare class DomainModelScope extends DomainModel {
    public domain: DomainModel;
    constructor(domain: DomainModel, extension: string);
}
export interface ICursor {
    hasNext(): boolean;
    next: any;
    reset(): any;
}
export declare class Cursor implements ICursor {
    public reset(): void;
    public hasNext(): boolean;
    public next(): any;
    static emptyCursor: Cursor;
    public firstOrDefault(): any;
    public forEach(callback: any): void;
    public any(callback?: any): boolean;
    public toArray(): any[];
    public map(callback: any): ICursor;
    static from(obj: any): ICursor;
}
export declare enum Direction {
    Incoming = 1,
    Outgoing = 2,
    Both = 3,
}
export declare enum NodeType {
    Entity = 1,
    Relationship = 2,
    EntityOrRelationship = 3,
    Property = 4,
}
export declare class ModelElement {
    public id: string;
    public schemaElement: SchemaElement;
    public domain: DomainModel;
    public startId: string;
    public startSchemaId: string;
    public endId: string;
    public endSchemaId: string;
    private _start;
    private _end;
    public disposed: boolean;
    public dispose(): void;
    public getPropertyValue(property: SchemaProperty): any;
    public setPropertyValue(property: SchemaProperty, value: any): PropertyValue;
    public __initialize(domain: DomainModel, id: string, schemaElement: SchemaElement, startId?: string, startSchemaId?: string, endId?: string, endSchemaId?: string): void;
    public start : ModelElement;
    public end : ModelElement;
    public stringify(): string;
    public getRelationships(schemaElement?: SchemaRelationship, direction?: Direction): ModelElement[];
}
export declare class ModelElementCollection extends Cursor {
    public source: ModelElement;
    public end: ModelElement;
    public schemaRelationship: SchemaRelationship;
    public domain: DomainModel;
    public filter: any;
    public cursor: any;
    private _items;
    public setFilter(where: (mel: ModelElement) => boolean): void;
    public items : ModelElement[];
    constructor(source: ModelElement, schemaRelationship: SchemaRelationship, opposite?: boolean, filter?: (mel: ModelElement) => boolean);
    public hasNext(): boolean;
    public reset(): void;
    public next(): any;
    public dispose(): void;
    public remove(mel: ModelElement): void;
    public add(mel: ModelElement): void;
}
export interface IElementConstraint {
    kind: ConstraintKind;
    condition: (self: ModelElement, ctx: ConstraintContext) => boolean;
    message: string;
    messageType?: MessageType;
    propertyName?: string;
}
export interface IPropertyConstraint {
    kind: ConstraintKind;
    condition: (val: any, old: any, ctx: ConstraintContext) => boolean;
    message: string;
    messageType?: MessageType;
}
export declare enum ConstraintKind {
    Check = 0,
    Validate = 1,
}
export declare enum MessageType {
    Warning = 0,
    Error = 1,
}
export declare class ConstraintContext {
    public kind: ConstraintKind;
    public element: ModelElement;
    public propertyName: string;
    public messages: DiagnosticMessage[];
    constructor(kind: ConstraintKind);
    public log(msg: string, messageType?: MessageType, propertyName?: string): void;
}
export declare class ConstraintsManager {
    public schema: Schema;
    private _constraints;
    constructor(schema: Schema);
    public addPropertyConstraint(property: SchemaProperty, condition?: (value: any, oldValue: any, ctx: ConstraintContext) => boolean, message?: string, asError?: boolean, kind?: ConstraintKind): void;
    public __setPropertyConstraint(property: any, def: any, schema?: any): void;
    public addConstraint(schemaElement: SchemaElement, constraint: any): void;
    public __checkElements(elements: any): DiagnosticMessage[];
    public validate(elements: DomainModel): any;
    private checkOrValidateElements(elements, kind);
    private checkCondition(ctx, schemaElement);
}
export declare class DiagnosticMessage {
    public messageType: MessageType;
    public message: string;
    private element;
    public propertyName: string;
    public id: string;
    constructor(messageType: MessageType, message: string, element?: ModelElement, propertyName?: string);
    static __format(message: string, element: any, propertyName: string, val?: any, old?: any): string;
    static __prepareMessage(msg: string, constraint: any): string;
}
export interface Message {
    origin: string;
    sessionId: number;
    sessionMode: SessionMode;
    events: AbstractEvent[];
}
export declare class EventBus {
    private store;
    private _channels;
    public defaultEventDispatcher: IEventDispatcher;
    private cookie;
    constructor(store: Store, eventDispatcher?: IEventDispatcher);
    public dispose(): void;
    public addChannel(channel: AbstractChannel): void;
    public start(callback?: (channel: any) => any): void;
    private sendEvents(s);
}
export declare class AbstractChannel {
    public domain: DomainModel;
    public eventBus: EventBus;
    public dispatcher: IEventDispatcher;
    constructor(domain: DomainModel);
    public start(callback?: (channel: any) => any): void;
    public close(): void;
    public _sendEvents(session: Session): void;
    public sendMessage(message: Message): void;
    public _shouldBePropagated(evt: AbstractEvent): boolean;
}
export declare class Adapter {
    public reset: boolean;
    private _cookie;
    public domain: DomainModel;
    constructor(reset?: boolean);
    public init(domain: DomainModel): void;
    public dispose(): void;
    public persistElements(session: Session, elements: ITrackedElement[]): void;
    public loadElementsAsync(filter?: (id: any, schemaId: any) => boolean): Q.Promise<any>;
}
export declare class IndexedDbAdapter extends Adapter {
    private static DB_NAME;
    private indexedDB;
    constructor();
    private open();
    public persistElements(s: Session, elements: ITrackedElement[]): void;
    public loadElementsAsync(filter?: (id: any, schemaId: any) => boolean): Q.Promise<SessionResult>;
    private loadProperties(id, schema, ostore);
}
export declare class LocalStorageAdapter extends Adapter {
    private static PREFIX;
    public clearAsync(): Q.Promise<any>;
    public persistElements(s: Session, elements: ITrackedElement[]): void;
    public loadElementsAsync(filter?: (id: any, schemaId: any) => boolean): Q.Promise<any>;
    private loadProperties(id, schema);
}
export declare class DomainSerializer {
    private _monikers;
    private _writer;
    private _domain;
    private _monikerSeq;
    constructor(domain: DomainModel);
    static save(domain: DomainModel, entities?: ICursor, relationships?: ICursor): string;
    private saveInternal(entities?, relationships?);
    private serializeEntities(entities);
    private serializeRelationships(relationships);
    private getSchemaMoniker(mel);
    private serializeProperties(elem);
    private getSchemaInfo(mel, findInMoniker?);
    private getId(element);
}
export declare class UndoManager {
    private store;
    private _infos;
    public Enabled: boolean;
    private _undos;
    private _redos;
    constructor(store: Store);
    public canUndo : boolean;
    public canRedo : boolean;
    public savePoint : number;
    public clear(): void;
    public undo(toSavePoint?: number): void;
    public redo(toSavePoint?: number): void;
    public registerDomain(domain: DomainModel, dispatcher?: IEventDispatcher): void;
    private performPop(mainStack, altStack, mode, toSavePoint?);
    private push(session);
}
export declare class HashTable<TKey, TElem> extends Cursor {
    private _throttle;
    public _values: TElem[];
    public _keys: any;
    public _ix: number;
    public _deleted: number;
    private _current;
    constructor(_throttle?: number);
    public reset(): void;
    public hasNext(): boolean;
    public next(): TElem;
    public dispose(): void;
    public keyExists(key: TKey): boolean;
    public add(key: TKey, elem: TElem): void;
    public get(key: TKey): TElem;
    public remove(key: TKey): void;
    public clone(): HashTable<TKey, TElem>;
    private shrink();
    public keys : TKey[];
    public values : TElem[];
}
export declare class Utils {
    private static date;
    private static sequence;
    static Requires(val: any, name: any): void;
    static getUtcNow(): number;
    static newGuid(): string;
    static isArray(value: any): boolean;
    static firstOrDefault(list: any, fn?: any): any;
    static forEach(list: any, fn: any): void;
    static reverse(list: any): any[];
    static where(list: any, fn: any): any[];
    static indexOf(list: any, fn: any): number;
    static select(list: any, fn: any): any[];
    static selectMany(list: any, fn: any): any[];
    static groupBy(list: any, fn: any): {};
}
export declare class Query implements ICursor {
    private _config;
    private _schema;
    private _iterator;
    private _current;
    private _cx;
    private _subQueries;
    private _state;
    private _iter;
    constructor(store: Store, _config: any, _schema: SchemaElement);
    public reset(): void;
    public setStart(obj: any): void;
    public hasNext(): boolean;
    private filter(elem, config, flag?);
    private evalExpression(val, expr);
    public next(): any;
}
export declare class FileDomainSerializer {
    static save(filePath: string, domain: DomainModel, entities?: ICursor, relationships?: ICursor): Q.Promise<any>;
    static load(filePath: string, domain: DomainModel): Q.Promise<any>;
}
