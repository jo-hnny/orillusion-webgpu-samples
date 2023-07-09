import computeTransform from "./shaders/compute.transform.wgsl?raw";
import { mat4 } from "gl-matrix";

const NUM = 1000000;

async function initWebGPU() {
  if (!navigator.gpu) throw new Error("Not Support WebGPU");
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter) throw new Error("No Adapter Found");
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    },
  });
  return device;
}

async function initPipeline(
  device: GPUDevice,
  modelMatrix: Float32Array,
  projection: Float32Array
) {
  const descriptor: GPUComputePipelineDescriptor = {
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: computeTransform,
      }),
      entryPoint: "main",
    },
  };
  const pipeline = await device.createComputePipelineAsync(descriptor);
  // papare gpu buffers
  // hold nx4x4 modelView matrix buffer
  const modelBuffer = device.createBuffer({
    size: modelMatrix.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(modelBuffer, 0, modelMatrix);

  // hold a 4x4 projection buffer
  const projectionBuffer = device.createBuffer({
    size: projection.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(projectionBuffer, 0, projection);
  // create a n*4x4 matrix buffer to hold result
  const mvpBuffer = device.createBuffer({
    size: modelMatrix.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  // indicate the size of total matrix
  const countBuffer = device.createBuffer({
    size: 4, // just one uint32 number
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(countBuffer, 0, new Uint32Array([NUM]));

  // create a bindGroup to hold 4 buffers
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: modelBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: projectionBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: mvpBuffer,
        },
      },
      {
        binding: 3,
        resource: {
          buffer: countBuffer,
        },
      },
    ],
  });
  return { pipeline, bindGroup, mvpBuffer };
}

async function run() {
  const fakeMatrix = mat4.create();
  console.log("fakeMatrix--->", fakeMatrix);
  const modelMatrix = new Float32Array(NUM * 4 * 4);
  const projection = fakeMatrix as Float32Array;

  for (let i = 0; i < NUM; i++) {
    modelMatrix.set(fakeMatrix, i * 4 * 4);
  }

  const device = await initWebGPU();
  const { pipeline, bindGroup, mvpBuffer } = await initPipeline(
    device,
    modelMatrix,
    projection
  );

  const readBuffer = device.createBuffer({
    size: modelMatrix.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const commandEncoder = device.createCommandEncoder();

  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);
  console.log("dispatchWorkgroups---->", NUM, Math.ceil(NUM / 128));
  computePass.dispatchWorkgroups(Math.ceil(NUM / 128));
  computePass.end();

  commandEncoder.copyBufferToBuffer(
    mvpBuffer,
    0,
    readBuffer,
    0,
    modelMatrix.byteLength
  );
  device.queue.submit([commandEncoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const copyArrayBuffer = readBuffer.getMappedRange();
  const result = new Float32Array(copyArrayBuffer);
  console.log("gpu result--->", result);

  readBuffer.unmap();
}

run();
