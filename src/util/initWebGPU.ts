export async function initWebGPU(canvas: HTMLCanvasElement) {
  if(!navigator.gpu)
      throw new Error('Not Support WebGPU')
  const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
  })
  if (!adapter)
      throw new Error('No Adapter Found')
  const device = await adapter.requestDevice({
      requiredLimits: {
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
      }
  })
  const context = canvas.getContext('webgpu') as GPUCanvasContext
  const format = navigator.gpu.getPreferredCanvasFormat()
  const devicePixelRatio = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * devicePixelRatio
  canvas.height = canvas.clientHeight * devicePixelRatio
  const size = {width: canvas.width, height: canvas.height}
  context.configure({
      device, format,
      // prevent chrome warning after v102
      alphaMode: 'opaque'
  })
  return {device, context, format, size}
}