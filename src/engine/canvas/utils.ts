type Axis = 'x' | 'y'

export const translateScale = (
  val: number,
  inputHigh: number,
  inputLow: number,
  outputHigh: number,
  outputLow: number
) => {
  return ((val - inputLow) / (inputHigh - inputLow)) *
    (outputHigh - outputLow) + outputLow
}

export const screenToGLPos = (val: number, high: number, axis: Axis) => {
  return axis === 'x'
    ? translateScale(val, high, 0, 1, -1)
    : -translateScale(val, high, 0, 1, -1);
}

export const colorToGLColor = (val: number) => {
  if (val > 255) {
    val = 255;
  }

  if (val < 0) {
    val = 0;
  }

  return translateScale(val, 255, 0, 1, 0);
}