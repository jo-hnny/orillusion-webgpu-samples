import { initWebGPU } from "./util/initWebGPU";
import shader from './shaders/google.wgsl?raw'


async function initPipeline(device: GPUDevice, format: GPUTextureFormat) {

  const cellShaderModule = device.createShaderModule({
    label: 'Cell shader',
    code: shader
  });

  const descriptor: GPURenderPipelineDescriptor = {
    label: "Cell pipeline",
    layout: "auto",
    vertex: {
      module: cellShaderModule,
      entryPoint: "vertexMain",
      buffers: [{
        arrayStride: 8,
        attributes: [{
          format: "float32x2",
          offset: 0,
          shaderLocation: 0, // Position, see vertex shader
        }],
      }]
    },
    fragment: {
      module: cellShaderModule,
      entryPoint: "fragmentMain",
      targets: [{
        format: format
      }]
    }
  }

  return await device.createRenderPipelineAsync(descriptor)

} 


function draw(device: GPUDevice, context: GPUCanvasContext, pipeline: GPURenderPipeline) {
 

  const GRID_SIZE = 32;
  // Create a uniform buffer that describes the grid.
const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
const uniformBuffer = device.createBuffer({
  label: "Grid Uniforms",
  size: uniformArray.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);





const bindGroup =device.createBindGroup({
  label: "Cell renderer bind group A",
  layout: pipeline.getBindGroupLayout(0),
  entries: [{
    binding: 0,
    resource: { buffer: uniformBuffer }
  }],
})

  const vertices = new Float32Array([
    //   X,    Y,
      -0.8, -0.8, // Triangle 1 (Blue)
       0.8, -0.8,
       0.8,  0.8,
    
      -0.8, -0.8, // Triangle 2 (Red)
       0.8,  0.8,
      -0.8,  0.8,
    ]);

  const vertexBuffer = device.createBuffer({
    label: "Cell vertices",
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/0, vertices);

 
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      clearValue: { r: 0, g: 0, b: 0.4, a: 1.0 },
      storeOp: "store",
    }]
  });

  // Draw the grid.
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup); // Updated!
  pass.setVertexBuffer(0, vertexBuffer);
  pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);

  // End the render pass and submit the command buffer
  pass.end();
  device.queue.submit([encoder.finish()]);
}

async function run() {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    throw new Error("No Canvas");
  }

  const { device, context, format } = await initWebGPU(canvas);

  const pipeline = await initPipeline(device, format)

  draw(device, context, pipeline)
}


run()