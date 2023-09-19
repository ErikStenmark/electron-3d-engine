import { AnyVec, Obj, Vec4 } from './engine/types';

export type ObjLine = [string, number, number, number];

export interface IObjectStore {
  load(name: string, key: string): Promise<void>;
  get(key: string): Obj;
  set(key: string, obj: Obj): void;
  combine(objects: Obj[]): Obj;
  place(object: Obj, location: AnyVec): Obj;
  transform(obj: Obj, fn: (vec: Vec4) => Vec4): Obj;
}
