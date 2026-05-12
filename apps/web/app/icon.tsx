import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  const avatarBuffer = readFileSync(
    join(process.cwd(), 'public', 'vera-avatar.png'),
  );
  const avatarDataUrl = `data:image/png;base64,${avatarBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarDataUrl}
          alt=""
          width={64}
          height={64}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 9999,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
