import { AnyVec, Mesh, Obj, Vec4 } from './engine/types';

export type ObjLine = [string, number, number, number];

export type ObjStoreType = Mesh | Obj;

export interface IObjectStore<T = ObjStoreType> {
  load(name: string, key: string): Promise<void>;
  get(key: string): T;
  set(key: string, obj: T): void;
  combine(objects: T[]): T;
  place(object: T, location: AnyVec): T;
  transform(obj: T, fn: (vec: Vec4) => Vec4): T;
}
