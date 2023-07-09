import { getRandomInt, sumArray } from "./util/randomRange";
import computeShader from "./shaders/compute.sum.wgsl?raw";

function initData(workGroupSize: number, workGroupCount: number) {
  const count = workGroupSize * workGroupCount;
  const nums = Array.from({ length: count }, () => getRandomInt(0, 100));
  const inData = new Float32Array(nums);
  const outData = new Float32Array(workGroupCount);

  return {
    inData,
    outData,
    nums,
  };
}

async function run() {
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });

  if (!adapter) throw new Error("No Adapter Found");

  const maxWorkGroupSize = adapter.limits.maxComputeWorkgroupSizeX;

  const device = await adapter?.requestDevice({
    requiredLimits: {
      maxComputeInvocationsPerWorkgroup:
        adapter.limits.maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupSizeX: maxWorkGroupSize,
    },
  })!;

  const workGroupCount = 100 * 100;
  const { inData, outData, nums } = initData(maxWorkGroupSize, workGroupCount);

  const pipeline = await device.createComputePipelineAsync({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: computeShader,
      }),
      entryPoint: "main",
    },
  });

  // 全部数字
  const inDataBuffer = device.createBuffer({
    size: inData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(inDataBuffer, 0, inData);

  // out buffer
  const outDataBuffer = device.createBuffer({
    size: outData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: inDataBuffer,
        },
      },

      {
        binding: 1,
        resource: {
          buffer: outDataBuffer,
        },
      },
    ],
  });

  const readBuffer = device.createBuffer({
    size: outData.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const commandEncoder = device.createCommandEncoder();

  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.setBindGroup(0, bindGroup);

  computePass.dispatchWorkgroups(workGroupCount);

  computePass.end();

  commandEncoder.copyBufferToBuffer(
    outDataBuffer,
    0,
    readBuffer,
    0,
    outData.byteLength
  );

  device.queue.submit([commandEncoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const copyArrayBuffer = readBuffer.getMappedRange();
  const result = new Float32Array(copyArrayBuffer);
  //数组中的每个值都是每个线程组的求和， 所以最后还要求和一次
  console.log("gpu result--->", sumArray([...result]), result);

  readBuffer.unmap();

  console.log("CPU result", sumArray(nums));
}

run();
