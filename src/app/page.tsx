"use client";

import { useState } from "react";

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [dpi, setDpi] = useState(300);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [resizedImage, setResizedImage] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setImage(file);
  };

  const createChunk = (type: string, data: Uint8Array) => {
    const crc32 = (data: Uint8Array) => {
      let crc = 0xffffffff;
      for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
      }
      return (crc ^ 0xffffffff) >>> 0;
    };

    const typeBytes = new TextEncoder().encode(type);
    const chunk = new Uint8Array(12 + data.length);
    const length = data.length;

    // Set length
    chunk[0] = (length >> 24) & 0xff;
    chunk[1] = (length >> 16) & 0xff;
    chunk[2] = (length >> 8) & 0xff;
    chunk[3] = length & 0xff;

    // Set type
    chunk.set(typeBytes, 4);

    // Set data
    chunk.set(data, 8);

    // Calculate and set CRC
    const crc = crc32(chunk.subarray(4, 8 + data.length));
    chunk[8 + data.length] = (crc >> 24) & 0xff;
    chunk[9 + data.length] = (crc >> 16) & 0xff;
    chunk[10 + data.length] = (crc >> 8) & 0xff;
    chunk[11 + data.length] = crc & 0xff;

    return chunk;
  };

  const addDpiMetadata = (uint8Array: Uint8Array, dpi: number) => {
    const pixelsPerMeter = Math.round((dpi / 2.54) * 100);
    const pHYsData = new Uint8Array([
      (pixelsPerMeter >> 24) & 0xff,
      (pixelsPerMeter >> 16) & 0xff,
      (pixelsPerMeter >> 8) & 0xff,
      pixelsPerMeter & 0xff,
      (pixelsPerMeter >> 24) & 0xff,
      (pixelsPerMeter >> 16) & 0xff,
      (pixelsPerMeter >> 8) & 0xff,
      pixelsPerMeter & 0xff,
      1, // Unit specifier (1 = meters)
    ]);
    const pHYsChunk = createChunk("pHYs", pHYsData);

    const ihdrEndIndex = uint8Array.findIndex(
      (_, i) =>
        uint8Array[i] === 0x49 &&
        uint8Array[i + 1] === 0x48 &&
        uint8Array[i + 2] === 0x44 &&
        uint8Array[i + 3] === 0x52
    );
    const ihdrChunkLength =
      (uint8Array[ihdrEndIndex - 4] << 24) |
      (uint8Array[ihdrEndIndex - 3] << 16) |
      (uint8Array[ihdrEndIndex - 2] << 8) |
      uint8Array[ihdrEndIndex - 1];
    const ihdrChunkEnd = ihdrEndIndex + 4 + ihdrChunkLength + 4;

    const updatedArray = new Uint8Array(uint8Array.length + pHYsChunk.length);
    updatedArray.set(uint8Array.subarray(0, ihdrChunkEnd), 0);
    updatedArray.set(pHYsChunk, ihdrChunkEnd);
    updatedArray.set(
      uint8Array.subarray(ihdrChunkEnd),
      ihdrChunkEnd + pHYsChunk.length
    );

    return updatedArray;
  };

  const handleResize = () => {
    if (!image) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          async (blob) => {
            if (!blob) return;

            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const updatedArray = addDpiMetadata(uint8Array, dpi);

            const updatedBlob = new Blob([updatedArray], { type: "image/png" });
            const updatedURL = URL.createObjectURL(updatedBlob);
            setResizedImage(updatedURL);
          },
          "image/png",
          1.0
        );
      };
    };
    reader.readAsDataURL(image);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Image Resizer</h1>
      <div className="w-full max-w-md space-y-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="w-full border rounded p-2"
        />
        <div className="flex items-center space-x-4">
          <label className="font-medium">DPI:</label>
          <input
            type="number"
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value))}
            inputMode="numeric"
            pattern="[0-9]*"
            className="flex-1 border rounded p-2"
          />
        </div>
        <div className="flex items-center space-x-4">
          <label className="font-medium">Scale Factor:</label>
          <input
            type="number"
            step="0.1"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(Number(e.target.value))}
            inputMode="numeric"
            pattern="[0-9]*"
            className="flex-1 border rounded p-2"
          />
        </div>
        <button
          onClick={handleResize}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Resize Image
        </button>
      </div>
      {resizedImage && (
        <div className="w-full max-w-md mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Resized Image:</h2>
          <a
            href={resizedImage}
            download="resized-image.png"
            className="block text-center bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Download Image
          </a>
          <img
            src={resizedImage}
            alt="Resized"
            className="w-full border rounded"
          />
        </div>
      )}
    </div>
  );
}
