import { Mesh, Vec3d } from './engine/types';

type ObjLine = [string, number, number, number];

export class ObjectLoader {
    public async load(name: string) {
        const data: string = await window.electron.readFile(name);

        const verts: Vec3d[] = [];
        const mesh: Mesh = [];

        const lines = data
            .split("\n")
            .map(line => line.trim().replace("\r", ''))
            .filter(line => line.charAt(0) !== '#')

        const splitLine = (line: string): ObjLine => {
            const values = line.split(' ');
            const [char, one, two, three] = values;

            const nOne = parseFloat(one);
            const nTwo = parseFloat(two);
            const nThree = parseFloat(three);

            return [char, nOne, nTwo, nThree];
        }

        const getVerts = (line: string) => {
            const [char, one, two, three] = splitLine(line);

            if (char === 'v') {
                verts.push([one, two, three]);
            }
        }

        const getTris = (line: string) => {
            const [char, one, two, three] = splitLine(line);

            if (char === 'f') {
                const vert1 = verts[one - 1];
                const vert2 = verts[two - 1];
                const vert3 = verts[three - 1];

                mesh.push([vert1, vert2, vert3]);
            }
        }

        lines.forEach(line => getVerts(line));
        lines.forEach(line => getTris(line));

        return mesh;
    }
}