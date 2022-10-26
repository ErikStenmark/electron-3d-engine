import { Canvas, DrawOpts, DrawTextOpts } from './canvas';
import { Triangle, Vec3d } from '../types';

export default class CanvasGL extends Canvas implements Canvas {
  private gl: WebGLRenderingContext;
  private triangleProgram: WebGLProgram;
  private triangleDimLoc: WebGLUniformLocation;
  private trianglePositionLoc: number;
  private triangleColorLoc: number;

  // 7 indexes per element (x, y, z, w, r, g, b)
  private stride = 7 * Float32Array.BYTES_PER_ELEMENT;
  private colorOffset = 4 * Float32Array.BYTES_PER_ELEMENT;

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

  public drawTriangles(triangles: Triangle[], opts?: DrawOpts) {
    const { width, height } = this.getSize();

    const valuesPerTriangle = 21;
    const valuesPerIndex = 3;

    let triangleIndex = triangles.length

    const vertices = new Float32Array(triangleIndex * valuesPerTriangle); // amount of values per triangle
    const indices = new Uint16Array(triangleIndex * valuesPerIndex); // amount of points in triangle

    while (triangleIndex--) {
      let firstIndex = triangleIndex * 3;
      let firstVertIndex = triangleIndex * valuesPerTriangle;

      const [p1, p2, p3, color] = triangles[triangleIndex];
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

    const transFunction = `
      float trans(float val, float high, float low, float ohigh, float olow) {
        float res = ((val-low)/(high-low))*(ohigh-olow)+olow;
        return res;
      }
    `;

    const vertCode = `
      attribute vec4 position;
      attribute vec3 color;
      uniform vec2 dimensions;
      varying vec3 v_color;

      ${transFunction}

      vec4 translatepos(vec4 position) {
        float x = trans(position.x,dimensions.x,0.0,1.0,-1.0);
        float y = trans(position.y,dimensions.y,0.0,1.0,-1.0) * -1.0;
        float z = position.z * -1.0;
        vec4 res = vec4(x,y,z,1.0);
        return res;
      }

      void main() {
        float screenCenterX = dimensions.x / 2.0;
        float screenCenterY = dimensions.y / 2.0;
        vec4 viewOffset = vec4(1.0, 1.0, 0.0, 1.0);

        // normalize into cartesian space
        vec4 normCartesian = vec4(position / position.w);

        // Offset verts into visible normalized space
        vec4 offset = normCartesian + viewOffset;

        // center
        offset.x = offset.x * screenCenterX;
        offset.y = offset.y * screenCenterY;

        v_color = color;
        gl_Position = translatepos(offset);
      }
    `;

    const fragCode = `
      precision lowp float;
      varying vec3 v_color;

      void main() {
        gl_FragColor = vec4(v_color, 1.0);
      }
    `;

    const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
    this.gl.shaderSource(vertShader, vertCode);
    this.gl.compileShader(vertShader);

    if (!this.gl.getShaderParameter(vertShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vertShader);
      throw `Could not compile WebGL vertex shader. \n\n${info}`;
    }

    const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
    this.gl.shaderSource(fragShader, fragCode);
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

}