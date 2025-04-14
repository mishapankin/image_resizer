"use client";

import { useState } from "react";

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [dpi, setDpi] = useState(300);
  const [scaleFactor, setScaleFactor] = useState(1); // New state for scaling coefficient
  const [resizedImage, setResizedImage] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setImage(file);
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

        canvas.width = img.width * scaleFactor; // Use scaleFactor from input
        canvas.height = img.height * scaleFactor;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          async (blob) => {
            if (!blob) return;

            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Helper function to create a PNG chunk
            const createChunk = (
              type: string | undefined,
              data: ArrayLike<number>
            ) => {
              const crc32 = (
                data: string | any[] | Uint8Array<ArrayBuffer>
              ) => {
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
              const chunk = new Uint8Array(12 + data.length); // 4 bytes length + 4 bytes type + data + 4 bytes CRC
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

            // Create pHYs chunk for DPI
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

            // Insert pHYs chunk after IHDR chunk
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

            const updatedArray = new Uint8Array(
              uint8Array.length + pHYsChunk.length
            );
            updatedArray.set(uint8Array.subarray(0, ihdrChunkEnd), 0);
            updatedArray.set(pHYsChunk, ihdrChunkEnd);
            updatedArray.set(
              uint8Array.subarray(ihdrChunkEnd),
              ihdrChunkEnd + pHYsChunk.length
            );

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
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Image Resizer</h1>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="mb-4"
      />
      <div className="mb-4">
        <label className="mr-2">DPI:</label>
        <input
          type="number"
          value={dpi}
          onChange={(e) => setDpi(Number(e.target.value))}
          className="border rounded p-1"
        />
      </div>
      <div className="mb-4">
        <label className="mr-2">Scale Factor:</label>
        <input
          type="number"
          step="0.1"
          value={scaleFactor}
          onChange={(e) => setScaleFactor(Number(e.target.value))}
          className="border rounded p-1"
        />
      </div>
      <button
        onClick={handleResize}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Resize Image
      </button>
      {resizedImage && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">Resized Image:</h2>
          <img src={resizedImage} alt="Resized" className="border" />
          <a
            href={resizedImage}
            download="resized-image.png"
            className="block mt-2 text-blue-500 underline"
          >
            Download Image
          </a>
        </div>
      )}
    </div>
  );
}
