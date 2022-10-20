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

export const screenToGlPos = (val: number, high: number, axis: Axis) => {
  return axis === 'x'
    ? translateScale(val, high, 0, 1, -1)
    : -translateScale(val, high, 0, 1, -1);
}