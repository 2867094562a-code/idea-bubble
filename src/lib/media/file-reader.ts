export interface FileReadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export function readFileAsDataUrl(file: File, options: FileReadOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    const cleanUp = () => options.signal?.removeEventListener("abort", abortRead);
    const abortRead = () => reader.abort();

    if (options.signal?.aborted) {
      reject(new DOMException("读取已取消", "AbortError"));
      return;
    }

    options.signal?.addEventListener("abort", abortRead, { once: true });

    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    reader.onerror = () => {
      cleanUp();
      reject(new Error("无法读取文件，请确认文件没有损坏。"));
    };
    reader.onabort = () => {
      cleanUp();
      reject(new DOMException("读取已取消", "AbortError"));
    };
    reader.onload = () => {
      cleanUp();
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:")) {
        reject(new Error("文件读取结果无效，请重新选择文件。"));
        return;
      }
      options.onProgress?.(100);
      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });
}
