# AudioRevive 

## 1. 项目定位
**AudioRevive** 音频超分辨率（Audio Super-Resolution）GUI 工具
利用扩散模型补全音频在压缩过程中损失的高频信号

---

## 2. 核心功能需求
### 2.1 交互设计
- **框架**：基于 Flet 1.0 Beta (Material Design 3 风格)。
- **文件管理**：支持多选、文件夹拖拽、任务队列排序。
- **进度系统**：显示总体进度条与单个任务状态（等待、推理中、拼接中、完成）。

### 2.2 推理算法
- **AudioSR**：快速超分至 48kHz（适用大多数流行音乐）。
- **AudioLBM**：母带级超分，支持 96kHz/192kHz（适用高质量音频重构）。
- **优化**：针对人声频段进行增益预设，消除低码率造成的“电音感”。

### 2.3 工程化处理
- **无缝拼接**：采用 Overlap-Add 技术消除切片边缘爆音。
- **元数据保留**：利用 FFmpeg 完整继承原文件的封面、歌词及 ID3 标签。
- **格式支持**：输出可选 WAV 或不同压缩等级的 FLAC。

---

## 3. 技术实现深度建议

### 3.1 Overlap-Add (OLA) 切片算法
为了解决显存限制，长歌曲必须分段。为防止拼接处的相位不连续产生的“咔哒”声：
- **切片参数**：每段 30s，前后各重叠 1s（共 2s 重叠区）。
- **加权融合**：在重叠区使用 **Hann 窗函数** 进行线性过渡。
- **实现逻辑**：
  ```python
  # 伪代码逻辑
  chunk = audio[start:end]
  processed_chunk = model.inference(chunk)
  # 应用窗函数并加权合并
  output[start:end] += processed_chunk * hann_window
  ```

### 3.2 FFmpeg 元数据管线
音频超分后不仅是波形的改变，必须确保元数据不丢失：
- **元数据提取与回填命令**：
  ```bash
  # 一条命令完成：新音频封入、原图拷贝、标签继承
  ffmpeg -i processed.wav -i original.mp3 \
  -map 0:a -map 1:v? -map_metadata 1 \
  -c:a flac -compression_level 8 \
  -c:v copy -disposition:v:0 attached_pic \
  output.flac
  ```

### 3.3 显存动态分配策略
程序启动时检测 `torch.cuda.get_device_properties`，根据显存自动调整参数：
- **> 8GB**：切片长度 30s，允许 2 个任务并行。
- **4GB - 6GB**：切片长度 15-20s，单任务运行。
- **< 4GB**：启用 `cpu-offload` 模式，切片长度 5s，使用半精度 (FP16) 推理。

### 3.4 频谱对比生成
使用 Librosa 生成可视化图像，增加用户“视觉增益”感：
- **区域重点**：展示 10kHz - 22kHz 的频谱密度变化。
- **实现方案**：
  ```python
  import librosa.display
  import matplotlib.pyplot as plt
  import io, base64

  def get_spectrogram_base64(y, sr):
      S = librosa.feature.melspectrogram(y=y, sr=sr)
      fig = plt.figure(figsize=(4, 2))
      librosa.display.specshow(librosa.power_to_db(S, ref=np.max))
      buf = io.BytesIO()
      plt.savefig(buf, format='png', bbox_inches='tight')
      return base64.b64encode(buf.getvalue()).decode()
  ```

---

## 4. 潜在风险与应对

| 风险点 | 应对方案 |
| :--- | :--- |
| **模型依赖冲突** | 使用 `venv` 隔离环境，针对 AudioLBM 提供独立的插件式安装脚本。 |
| **打包体积过大** | 采用 Nuitka 编译；将 FFmpeg 与 Model Weights 设为外部下载项，主程序仅 20MB。 |
| **推理速度慢** | 提供“FP16 半精度”开关；Phase 4 尝试将模型导出为 TensorRT 引擎。 |
| **中文路径乱码** | 在 Python 内部统一转换为长路径格式 `\\?\` 或使用临时随机文件名中转。 |

---

## 5. 开发路线图 (Roadmap)

### 第一阶段：原型构建 (MVP)
- [ ] 构建 Flet UI 基础界面与任务队列。
- [ ] 集成 FFmpeg 基础转换功能。
- [ ] 实现单文件 AudioSR (48kHz) 推理流程。

### 第二阶段：工程优化
- [ ] 实现 Overlap-Add 无缝拼接逻辑。
- [ ] 开发元数据 (ID3/Cover) 自动回填系统。
- [ ] 加入显存自动检测与分段逻辑。

### 第三阶段：体验升级
- [ ] 增加试听对比功能（生成 5s 预览）。
- [ ] 实现频谱可视化对比图。
- [ ] 集成 AudioLBM (96kHz+) 高级模式。

### 第四阶段：分发部署
- [ ] 编写一键部署脚本（包含 CUDA 环境检测）。
- [ ] 使用 Nuitka 打包 Windows 便携版。
- [ ] 针对低配机器优化 CPU 推理效率。
