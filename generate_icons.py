#!/usr/bin/env python3
"""生成 PWA 图标"""
import struct
import zlib
import math

def create_png(size, filename):
    """创建渐变圆形图标 PNG"""
    pixels = []
    cx, cy = size / 2, size / 2
    radius = size * 0.42

    for y in range(size):
        row = []
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)

            if dist <= radius:
                t = (dx + dy) / (size * 0.8) + 0.5
                t = max(0, min(1, t))
                # 橙粉渐变
                r = int(255 * (1 - t * 0.3))
                g = int(107 + t * 50)
                b = int(53 + t * 100)
                row.extend([r, g, b, 255])
            elif dist <= radius + 2:
                alpha = int(255 * (1 - (dist - radius) / 2))
                row.extend([255, 107, 53, alpha])
            else:
                row.extend([0, 0, 0, 0])
        pixels.append(bytes(row))

    def png_chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack(">I", len(data)) + c + crc

    raw = b""
    for row in pixels:
        raw += b"\x00" + row

    compressed = zlib.compress(raw, 9)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += png_chunk(b"IHDR", ihdr)
    png += png_chunk(b"IDAT", compressed)
    png += png_chunk(b"IEND", b"")

    with open(filename, "wb") as f:
        f.write(png)
    print(f"Created {filename}")

if __name__ == "__main__":
    create_png(192, "icon-192.png")
    create_png(512, "icon-512.png")
