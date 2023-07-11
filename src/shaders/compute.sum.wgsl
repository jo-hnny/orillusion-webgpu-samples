@group(0) @binding(0) var<storage, read> inData : array<f32>;
@group(0) @binding(1) var<storage, read_write> outData : array<f32>;

const workgroupSize : u32 = 1024;

//定义共享内存，长度为每个组的线程数，在一个工作组内的所有线程间共享
var<workgroup> sharedData : array<f32, workgroupSize>;

@compute @workgroup_size(workgroupSize)
fn main(
@builtin(local_invocation_index) local_id : u32,
@builtin(global_invocation_id) global_id : vec3 < u32>,
@builtin(workgroup_id) workgroup_id : vec3 < u32>
)
{

  //初始化共享内存，即每个位置对应原始数据
  //第一个线程组中的shardData[0] = inData[0]
  //第二个线程组中的shardData[0] = inData[1024]
  sharedData[local_id] = inData[global_id.x];

  //线程同步，确保每个线程都完成了上面的步骤
  workgroupBarrier();

  //开始循环迭代，每一次迭代，每个线程都会中对应位置都和“隔壁”相加
  for(var s : u32 = 1; s < workgroupSize; s *= 2)
  {
    if (local_id % (s * 2) == 0)
    {
      sharedData[local_id] += sharedData[local_id + s];
    }

    //等待所有线程完成第一次迭代，进行下一次迭代
    workgroupBarrier();
  }


  //只在每个线程组中的线程0赋值
  //最后用户得到一个数组，数组中的每个值是每个线程组的求和
  if (local_id == 0)
  {
    outData[workgroup_id.x] = sharedData[0];
  }


}
