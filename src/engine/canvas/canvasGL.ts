import { Canvas, DrawOpts, DrawTextOpts } from './canvas';
import { Triangle, Vec3d } from '../types';

export default class CanvasGL extends Canvas implements Canvas {
  private gl: WebGLRenderingContext;
  private triangleProgram: WebGLProgram;
  private triangleDimLoc: WebGLUniformLocation;
  private trianglePositionLoc: number;
  private triangleColorLoc: number;

  // 0  1  2  3  4  5, 6
  // x, y, z, w, r, g, b
  // 7 values per element (length)
  private stride = 7 * Float32Array.BYTES_PER_ELEMENT;
  private colorOffset = 4 * Float32Array.BYTES_PER_ELEMENT; // starts at pos 4 (index)

  constructor(zIndex: number, id = 'canvasGL', lockPointer = false) {
    super(zIndex, id, lockPointer);
    this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;
    this.triangleProgram = this.createTriangleProgram();

    this.triangleDimLoc = this.gl.getUniformLocation(this.triangleProgram, 'dimensions') as WebGLUniformLocation;

    this.trianglePositionLoc = this.gl.getAttribLocation(this.triangleProgram, 'position');
    this.triangleColorLoc = this.gl.getAttribLocation(this.triangleProgram, 'color');

    this.gl.enable(this.gl.DEPTH_TEST);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public setSize(w: number, h: number) {
    const aspectRatio = super.setSize(w, h);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return aspectRatio;
  }

  public clear() {
    this.fill([0, 0, 0, 0]);
  }

  public fill(color?: Vec3d) {
    if (!color || !color.length) {
      color = [0, 0, 0, 1];
    }

    this.gl.clearColor(color[0], color[1], color[2], color[3] || 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
  }

  public drawTriangle(triangle: Triangle, opts?: DrawOpts) {
    const [p1, p2, p3, color] = triangle;
    const { width, height } = this.getSize();

    const vertices = [
      p1[0], p1[1], 0.0,
      p2[0], p2[1], 0.0,
      p3[0], p3[1], 0.0
    ];

    this.gl.useProgram(this.triangleProgram);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STREAM_DRAW);
    this.gl.uniform2fv(this.triangleDimLoc, [width, height]);
    this.gl.uniform4fv(this.triangleColorLoc, color);
    this.gl.drawElements(this.gl.TRIANGLES, 3, this.gl.UNSIGNED_SHORT, 0);
  }

  public drawMesh(mesh: Triangle[], opts?: DrawOpts) {
    const { width, height } = this.getSize();

    const valuesPerTriangle = 21;
    const valuesPerIndex = 3;

    let meshIndex = mesh.length

    const vertices = new Float32Array(meshIndex * valuesPerTriangle); // amount of values per triangle
    const indices = new Uint16Array(meshIndex * valuesPerIndex); // amount of points in triangle

    while (meshIndex--) {
      let firstIndex = meshIndex * 3;
      let firstVertIndex = meshIndex * valuesPerTriangle;

      const [p1, p2, p3, color] = mesh[meshIndex];
      const [r, g, b] = color;

      // Index values
      indices[firstIndex] = firstIndex;
      indices[++firstIndex] = firstIndex;
      indices[++firstIndex] = firstIndex;

      // Triangle values
      vertices[firstVertIndex++] = p1[0];
      vertices[firstVertIndex++] = p1[1];
      vertices[firstVertIndex++] = p1[2];
      vertices[firstVertIndex++] = p1[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p2[0];
      vertices[firstVertIndex++] = p2[1];
      vertices[firstVertIndex++] = p2[2];
      vertices[firstVertIndex++] = p2[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p3[0];
      vertices[firstVertIndex++] = p3[1];
      vertices[firstVertIndex++] = p3[2];
      vertices[firstVertIndex++] = p3[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex] = b;
    }

    this.gl.useProgram(this.triangleProgram);

    // Index Buffer
    const indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); // Unbind buffer (not sure if this does anything)

    // Vertex Buffer
    const vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STREAM_DRAW);

    // Position
    this.gl.enableVertexAttribArray(this.trianglePositionLoc);
    this.gl.vertexAttribPointer(this.trianglePositionLoc, 4, this.gl.FLOAT, false, this.stride, 0);

    // Color
    this.gl.enableVertexAttribArray(this.triangleColorLoc);
    this.gl.vertexAttribPointer(this.triangleColorLoc, 3, this.gl.FLOAT, false, this.stride, this.colorOffset);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); // Unbind buffer

    // Screen dimensions for scaling
    this.gl.uniform2fv(this.triangleDimLoc, [width, height]);

    // Just draw it
    this.gl.drawElements(this.gl.TRIANGLES, indices.length, this.gl.UNSIGNED_SHORT, 0);
  }


  public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
    //not implemented
    return;
  }

  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    //not implemented
    return;
  }

  private createTriangleProgram() {
    const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
    this.gl.shaderSource(vertShader, this.getVertexShader());
    this.gl.compileShader(vertShader);

    if (!this.gl.getShaderParameter(vertShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vertShader);
      throw `Could not compile WebGL vertex shader. \n\n${info}`;
    }

    const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
    this.gl.shaderSource(fragShader, this.getFragmentShader());
    this.gl.compileShader(fragShader);

    if (!this.gl.getShaderParameter(fragShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(fragShader);
      throw `Could not compile WebGL fragment shader. \n\n${info}`;
    }

    const program = this.gl.createProgram() as WebGLProgram;
    this.gl.attachShader(program, vertShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      var info = this.gl.getProgramInfoLog(program);
      throw new Error('Could not compile WebGL program. \n\n' + info);
    }

    return program;
  }

  private getFragmentShader() {
    return `
      precision lowp float;
      varying vec3 v_color;

      void main() {
        gl_FragColor = vec4(v_color, 1.0);
      }
    `;
  }

  private getVertexShader() {
    return `
      attribute vec4 position;
      attribute vec3 color;
      uniform vec2 dimensions;
      varying vec3 v_color;

      float trans(float val, float high, float low, float ohigh, float olow) {
        float res = ((val-low)/(high-low))*(ohigh-olow)+olow;
        return res;
      }

      vec4 translatepos(vec4 position) {
        #define PI 3.1415926538
        float x = trans(position.x,dimensions.x,0.0,1.0,-1.0);
        float y = trans(position.y,dimensions.y,0.0,1.0,-1.0) * -1.0;
        float z = position.z * -1.0;
        vec4 res = vec4(x,y,z,1.0);
        return res;
      }

      vec4 matMulVec(mat4 m, vec4 v) {
        vec4 res = vec4(
          v.x * m[0][0] + v.y * m[0][1] + v.z * m[0][2] + v.w * m[0][3],
          v.x * m[1][0] + v.y * m[1][1] + v.z * m[1][2] + v.w * m[1][3],
          v.x * m[2][0] + v.y * m[2][1] + v.z * m[2][2] + v.w * m[2][3],
          v.x * m[3][0] + v.y * m[3][1] + v.z * m[3][2] + v.w * m[3][3]
        );

        return res;
      }

      vec4 project(vec4 v) {
        float fow = 90.0;
        float far = 1000.0;
        float near = 0.1;
        float middle = far - near;
        float fovRad = 1.0 / tan(fow * 0.5 / 180.0 * PI);
        float aspectRatio = dimensions.y / dimensions.x;
        mat4 projection = mat4(0.0);

        projection[0][0] = aspectRatio * fovRad;
        projection[1][1] = fovRad;
        projection[2][2] = far / middle;
        projection[3][2] = -1.0;
        projection[2][3] = (-far * near) / middle;

        vec4 res = matMulVec(projection, v);
        return res;
      }

      void main() {
        // Project from 3D --> 2D
        vec4 projected = project(position);

        // normalize into cartesian space
        vec4 normCartesian = vec4(projected / projected.w);

        // Offset verts into visible normalized space
        vec4 viewOffset = vec4(1.0, 1.0, 0.0, 1.0);
        vec4 offset = normCartesian + viewOffset;

        // center
        offset.x = offset.x * dimensions.x / 2.0;
        offset.y = offset.y * dimensions.y / 2.0;

        v_color = color;
        gl_Position = translatepos(offset);
      }
    `;
  }

}