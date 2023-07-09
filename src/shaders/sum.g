import { workGroupSize, workGroupID, localInvocationID } from 'g - webgpu';

  @numthreads(1024, 1, 1)
  class Reduce {
    @in
    gData : float[];输入

    @out(10240)
    oData : float[];输出

    @shared(1024)
    sData : float[];

    @main
    compute()
    {
      // 每个组中的index
      const tid = localInvocationID.x;

      // global index
      const i = workGroupID.x * workGroupSize.x + localInvocationID.x;


      // 在线程0中，共享内存的index 0  = globalData的数据0
      this.sData[tid] = this.gData[i]; //1
      // 同步， 第一组线程中每个线程都初始化了共享内存的数据
      barrier(); //2

      // 循环，1，2，4。。。线程组
      for (let s = 1; s < workGroupSize.x; s *= 2)
      {
        // 如果是线程0，2，4
        if (tid % (s * 2) == 0)
        {
          // 第一组中的
          this.sData[tid] += this.sData[tid + s]; //3
        }
        barrier();
      }
      if (tid == 0)
      {
        this.oData[workGroupID.x] = this.sData[0]; //4
      }
    }
  }
